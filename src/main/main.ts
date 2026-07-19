import { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage, clipboard, screen, session, nativeTheme } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

// Load .env as early as possible so OPENROUTER_KEYS / Vertex config are available
import { loadEnv } from './envLoader';
loadEnv(process.resourcesPath, (() => { try { return app.getAppPath(); } catch { return undefined; } })());

// Pre-load ffmpeg path — handle packaged app ASAR path correctly
let ffmpegPath: string;
try {
    let rawPath: string = require('ffmpeg-static');
    // In packaged app, ffmpeg-static is in app.asar.unpacked, NOT app.asar
    // require() still returns the .asar path — fix it manually
    if (rawPath && rawPath.includes('app.asar') && !rawPath.includes('app.asar.unpacked')) {
        rawPath = rawPath.replace('app.asar', 'app.asar.unpacked');
    }
    ffmpegPath = rawPath;
} catch {
    ffmpegPath = 'ffmpeg'; // fallback to system ffmpeg
}

// Import new modules
import { getAppContext, AppContext } from './appContext';
import { processVoiceInput, generateEmail, processNotesMode } from './aiProcessor';
import { prewarmVertex, isVertexAvailable } from './vertexAI';
import { initAuth, isAuthenticated, getCachedProfile, isPro, handleDeepLinkAuth } from './authManager';
import {
    checkAndIncrementUsage, getUsageSummary, updateProductivityMetrics,
    // Cloud sync
    getCloudDictionary, upsertCloudDictionaryWord, deleteCloudDictionaryWord,
    getCloudSnippets, upsertCloudSnippet, deleteCloudSnippet,
    getCloudNotes, addCloudNote, deleteCloudNote,
    // Realtime
    subscribeToCloudChanges, unsubscribeFromCloudChanges,
} from '../shared/supabase';
import type { UsageSummary } from '../shared/types';
import {
    initLocalDatabase,
    closeDatabase,
    // Dictionary
    getAllDictionaryWords,
    addDictionaryWord,
    deleteDictionaryWord,
    applyDictionaryCorrections,
    // Snippets
    getAllSnippets,
    addSnippet,
    updateSnippet,
    deleteSnippet,
    getSnippetByKey,
    // Styles
    getAllStyles,
    addStyle,
    updateStyle,
    deleteStyle,
    setActiveStyle,
    getActiveStyle,
    // Notes
    getAllNotes,
    addNote,
    deleteNote,
    searchNotes,
    // Settings
    getSetting,
    setSetting,
    getAllSettings,
    // Productivity
    updateProductivityLocal,
    getProductivityStats,
    // Command History
    getCommandHistory,
    addCommandHistory,
    clearCommandHistory,
    // Data Management
    clearAllLocalData,
} from './localStorage';

// ============================================
// JUSKOE - Voice to Text AI Assistant
// ============================================

// --- Persistent log file (readable even from packaged exe) ---
import { app as _app } from 'electron';
let _logStream: import('fs').WriteStream | null = null;
function _initLogFile() {
    try {
        const logDir = _app.getPath('userData');
        const logPath = require('path').join(logDir, 'juskoe-debug.log');
        _logStream = require('fs').createWriteStream(logPath, { flags: 'a' });
        _logStream!.write(`\n\n===== SESSION ${new Date().toISOString()} =====\n`);
    } catch { /* silent */ }
}
function _writeLog(tag: string, args: any[]) {
    if (!_logStream) return;
    try { _logStream.write(`[${tag}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`); } catch { }
}

// Prevent EPIPE crash — wrap ALL console methods to be pipe-safe
// EPIPE happens when the terminal that spawned Electron closes but the app keeps running
const _origLog = console.log;
const _origError = console.error;
const _origWarn = console.warn;
console.log = (...args: any[]) => { _writeLog('LOG', args); try { _origLog.apply(console, args); } catch (e: any) { if (e?.code !== 'EPIPE') throw e; } };
console.error = (...args: any[]) => { _writeLog('ERR', args); try { _origError.apply(console, args); } catch (e: any) { if (e?.code !== 'EPIPE') throw e; } };

// Catch any remaining EPIPE errors at process level
process.stdout?.on?.('error', (err: any) => { if (err.code === 'EPIPE') return; });
process.stderr?.on?.('error', (err: any) => { if (err.code === 'EPIPE') return; });
process.on('uncaughtException', (err: Error) => {
    if ((err as any).code === 'EPIPE') return; // Silently ignore broken pipe
    // Don't use console here — pipe might be broken
});

// Force light theme — prevents Electron/Chromium from applying OS dark mode
nativeTheme.themeSource = 'light';

// Fix Electron network stack interfering with Node.js fetch
// Without this, Supabase calls timeout due to Chromium's proxy resolver
app.commandLine.appendSwitch('no-proxy-server');

console.log('\n' + '='.repeat(50));
console.log('   JUSKOE v1.0 - Voice Powered');
console.log('='.repeat(50) + '\n');
console.log('[Startup] isPackaged:', app.isPackaged);
console.log('[Startup] ffmpegPath:', ffmpegPath);
console.log('[Startup] ffmpeg exists:', require('fs').existsSync(ffmpegPath));
console.log('[Startup] resourcesPath:', process.resourcesPath);

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let isRecording = false;
let currentMode: 'ai' | 'grammar' | 'notes' = 'ai';
let lastPastedText = '';  // For clipboard history
let capturedSelectedText = '';  // Store selected text when recording starts
let recordingStartTime = 0;  // Track actual recording duration for real WPM

// ============================================
// PATHS
// ============================================

function getAssetPath(filename: string): string {
    const devPath = path.join(__dirname, '..', '..', 'assets', filename);
    const prodPath = path.join(process.resourcesPath || __dirname, 'assets', filename);
    return fs.existsSync(devPath) ? devPath : prodPath;
}

function getTempDir(): string {
    const tempDir = path.join(app.getPath('temp'), 'juskoe');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    return tempDir;
}

// Sherpa-ONNX STT - in-process model (no CLI subprocess)
const { OfflineRecognizer } = require('sherpa-onnx-node');

function getSherpaModelDir(): string {
    const isDev = !app.isPackaged;
    const basePath = isDev
        ? path.join(__dirname, '..', '..')  // src/main -> project root
        : process.resourcesPath;           // packaged: resources/ folder
    return path.join(basePath, 'assets', 'sherpa-onnx-whisper-base');
}

let sttRecognizer: any = null;

function initSTT(): void {
    const modelDir = getSherpaModelDir();
    const encoder = path.join(modelDir, 'base-encoder.int8.onnx');
    const decoder = path.join(modelDir, 'base-decoder.int8.onnx');
    const tokens = path.join(modelDir, 'base-tokens.txt');

    if (!fs.existsSync(encoder) || !fs.existsSync(decoder) || !fs.existsSync(tokens)) {
        console.error('[STT] Model files missing in:', modelDir);
        console.error('[STT]   encoder:', fs.existsSync(encoder));
        console.error('[STT]   decoder:', fs.existsSync(decoder));
        console.error('[STT]   tokens:', fs.existsSync(tokens));
        return;
    }

    // Detect input language setting for initial config
    const inputLang = getSetting('inputLanguage') || 'Auto';
    const langCode = (inputLang !== 'Auto' && LANGUAGE_CODES[inputLang]) ? LANGUAGE_CODES[inputLang] : '';

    const config = {
        modelConfig: {
            whisper: {
                encoder,
                decoder,
                language: langCode,
                task: 'transcribe',
                tailPaddings: -1,
            },
            tokens,
            numThreads: 4,
            debug: 0,
        },
    };

    try {
        sttRecognizer = new OfflineRecognizer(config);
        console.log('[STT] Sherpa-ONNX model loaded ✓');
        console.log(`[STT] Model: base (int8), Lang: ${langCode || 'auto'}, Threads: 4`);
    } catch (e: any) {
        console.error('[STT] Failed to load model:', e.message || e);
    }
}

// ============================================
// MAIN WINDOW
// ============================================

/**
 * Detect whether the app was auto-launched at Windows startup.
 * Electron passes `--openAsHidden` when the login item is configured with
 * openAsHidden, and Windows also passes process.argv flags. We also treat
 * an explicit `--hidden` flag as a hidden launch.
 */
function shouldLaunchHidden(): boolean {
    try {
        const args = process.argv || [];
        if (args.includes('--hidden') || args.includes('--openAsHidden')) return true;
        const login = app.getLoginItemSettings();
        // wasOpenedAtLogin is true on macOS; on Windows we rely on the launch arg
        if ((login as any).wasOpenedAtLogin) return true;
        if ((login as any).wasOpenedAsHidden) return true;
    } catch { /* noop */ }
    return false;
}

function createMainWindow(): void {
    console.log('[Main] Creating window...');
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 750,
        minWidth: 900,
        minHeight: 600,
        frame: false,
        backgroundColor: '#ffffff',
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false,
        },
    });

    const isDev = !app.isPackaged;
    const devUrl = 'http://localhost:3000';
    const fileUrl = `file://${path.join(__dirname, '..', 'renderer', 'index.html')}`;

    if (isDev) {
        mainWindow.loadURL(devUrl).catch(() => {
            console.log('[Main] Dev server not running, loading built files...');
            mainWindow!.loadURL(fileUrl);
        });
    } else {
        mainWindow.loadURL(fileUrl);
    }

    session.defaultSession.setPermissionRequestHandler((_, permission, callback) => {
        callback(permission === 'media');
    });

    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });

    mainWindow.once('ready-to-show', () => {
        // Background launch: when the app is auto-started on Windows boot,
        // do NOT show the window — just run in the tray/background.
        if (shouldLaunchHidden()) {
            console.log('[Main] Launched at startup — staying in background (window hidden)');
            return;
        }
        mainWindow?.show();
        console.log('[Main] Ready');
    });

    mainWindow.on('close', (e) => {
        if (!isQuitting) {
            e.preventDefault();
            mainWindow?.hide();
        }
    });

    // Emit 'window:shown' to renderer when window becomes visible (reopen from tray, etc.)
    // Skip the first show (initial launch — app already starts at home)
    let isFirstShow = true;
    mainWindow.on('show', () => {
        if (isFirstShow) {
            isFirstShow = false;
            return;
        }
        console.log('[Main] Window shown — sending reset signal to renderer');
        safeSendMain('window:shown');
    });

    // ---- Renderer crash diagnostics ----
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
        console.error(`[CRASH] Renderer process gone! Reason: ${details.reason}, exitCode: ${details.exitCode}`);
        // Auto-recover: reload the renderer after a short delay
        setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                console.log('[CRASH] Reloading renderer...');
                mainWindow.webContents.reload();
            }
        }, 1000);
    });

    mainWindow.webContents.on('crashed' as any, (_event: any, killed: boolean) => {
        console.error(`[CRASH] webContents crashed! killed=${killed}`);
    });

    mainWindow.on('unresponsive', () => {
        console.error('[CRASH] Window became unresponsive!');
    });
}

// ============================================
// OVERLAY WINDOW
// ============================================

function createOverlay(): void {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const overlayWidth = 260;
    const overlayHeight = 60;
    const x = Math.floor(width / 2 - overlayWidth / 2);

    // Read saved position (default to 'bottom')
    const savedPosition = getSetting('overlayPosition') || 'bottom';
    let y = height - overlayHeight - 10; // bottom default (above taskbar)
    if (savedPosition === 'top') {
        y = 10;
    }

    console.log(`[Overlay] Creating: pos=${savedPosition}, x=${x}, y=${y}, w=${overlayWidth}, h=${overlayHeight}`);

    overlayWindow = new BrowserWindow({
        width: overlayWidth,
        height: overlayHeight,
        x,
        y,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        hasShadow: false,
        show: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    overlayWindow.setIgnoreMouseEvents(true);
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');

    const isDev = !app.isPackaged;
    const devUrl = 'http://localhost:3000/overlay.html';
    const fileUrl = `file://${path.join(__dirname, '..', 'renderer', 'overlay.html')}`;

    if (isDev) {
        overlayWindow.loadURL(devUrl).catch(() => {
            console.log('[Overlay] Dev server not running, loading built files...');
            overlayWindow!.loadURL(fileUrl);
        });
    } else {
        overlayWindow.loadURL(fileUrl);
    }

    overlayWindow.webContents.on('did-finish-load', () => {
        console.log('[Overlay] ✓ Content loaded');
        // Send initial idle visibility setting
        const idleVisible = getSetting('showIdlePill');
        if (idleVisible === 'false') {
            safeSendOverlay('overlay:idleVisible', false);
        }
    });

    overlayWindow.webContents.on('did-fail-load', (_e: any, code: number, desc: string) => {
        console.error(`[Overlay] ✗ Failed to load: ${code} ${desc}`);
    });

    overlayWindow.webContents.on('console-message', (_e: any, level: number, message: string) => {
        console.log(`[Overlay Console] ${message}`);
    });
}

function setOverlayState(state: string): void {
    safeSendOverlay('state', state);
}

// Safe send helpers - prevent crashes when windows aren't ready
// Safe send helpers - prevent crashes when windows aren't ready
function safeSendOverlay(channel: string, ...args: any[]): void {
    try {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.webContents.send(channel, ...args);
        }
    } catch (e) {
        // Window or frame might be disposed - ignore
    }
}

function safeSendMain(channel: string, ...args: any[]): void {
    try {
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isCrashed()) {
            mainWindow.webContents.send(channel, ...args);
        } else {
            console.warn(`[IPC] Cannot send '${channel}' — window not ready (destroyed=${mainWindow?.isDestroyed()}, crashed=${mainWindow?.webContents?.isCrashed()})`);
        }
    } catch (e: any) {
        console.error('Error sending from webFrameMain: ', e?.message || e);
    }
}

// ============================================
// WHISPER TRANSCRIPTION
// ============================================

// Map full language names (from SettingsModal) to ISO-639-1 codes for Whisper
// Full list of all 99 Whisper-supported languages
const LANGUAGE_CODES: Record<string, string> = {
    'Afrikaans': 'af', 'Albanian': 'sq', 'Amharic': 'am', 'Arabic': 'ar',
    'Armenian': 'hy', 'Assamese': 'as', 'Azerbaijani': 'az', 'Bashkir': 'ba',
    'Basque': 'eu', 'Belarusian': 'be', 'Bengali': 'bn', 'Bosnian': 'bs',
    'Breton': 'br', 'Bulgarian': 'bg', 'Burmese': 'my', 'Cantonese': 'yue',
    'Catalan': 'ca', 'Chinese': 'zh', 'Croatian': 'hr', 'Czech': 'cs',
    'Danish': 'da', 'Dutch': 'nl', 'English': 'en', 'Estonian': 'et',
    'Faroese': 'fo', 'Finnish': 'fi', 'French': 'fr', 'Galician': 'gl',
    'Georgian': 'ka', 'German': 'de', 'Greek': 'el', 'Gujarati': 'gu',
    'Haitian Creole': 'ht', 'Hausa': 'ha', 'Hawaiian': 'haw', 'Hebrew': 'he',
    'Hindi': 'hi', 'Hungarian': 'hu', 'Icelandic': 'is', 'Indonesian': 'id',
    'Italian': 'it', 'Japanese': 'ja', 'Javanese': 'jw', 'Kannada': 'kn',
    'Kazakh': 'kk', 'Khmer': 'km', 'Korean': 'ko', 'Lao': 'lo',
    'Latin': 'la', 'Latvian': 'lv', 'Lingala': 'ln', 'Lithuanian': 'lt',
    'Luxembourgish': 'lb', 'Macedonian': 'mk', 'Malagasy': 'mg', 'Malay': 'ms',
    'Malayalam': 'ml', 'Maltese': 'mt', 'Maori': 'mi', 'Marathi': 'mr',
    'Mongolian': 'mn', 'Nepali': 'ne', 'Norwegian': 'no', 'Nynorsk': 'nn',
    'Occitan': 'oc', 'Pashto': 'ps', 'Persian': 'fa', 'Polish': 'pl',
    'Portuguese': 'pt', 'Punjabi': 'pa', 'Romanian': 'ro', 'Russian': 'ru',
    'Sanskrit': 'sa', 'Serbian': 'sr', 'Shona': 'sn', 'Sindhi': 'sd',
    'Sinhala': 'si', 'Slovak': 'sk', 'Slovenian': 'sl', 'Somali': 'so',
    'Spanish': 'es', 'Sundanese': 'su', 'Swahili': 'sw', 'Swedish': 'sv',
    'Tagalog': 'tl', 'Tajik': 'tg', 'Tamil': 'ta', 'Tatar': 'tt',
    'Telugu': 'te', 'Thai': 'th', 'Tibetan': 'bo', 'Turkish': 'tr',
    'Turkmen': 'tk', 'Ukrainian': 'uk', 'Urdu': 'ur', 'Uzbek': 'uz',
    'Vietnamese': 'vi', 'Welsh': 'cy', 'Yiddish': 'yi', 'Yoruba': 'yo',
};

async function transcribeWithWhisper(audioPath: string): Promise<string> {
    try {
        if (!sttRecognizer) {
            console.error('[STT] Recognizer not initialized');
            return '';
        }

        if (!fs.existsSync(audioPath)) {
            console.error('[STT] Audio file not found:', audioPath);
            return '';
        }

        const startTime = Date.now();

        // Read WAV file manually to avoid "External buffers are not allowed" error
        // The WAV is already 16-bit PCM, 16kHz, mono from ffmpeg conversion
        const wavBuffer = fs.readFileSync(audioPath);

        // Parse WAV header to get data offset and sample count
        // Standard WAV: RIFF header (12) + fmt chunk (24) + data header (8) = 44 bytes
        // But some WAVs have extra chunks, so find the 'data' chunk
        let dataOffset = 12; // Skip RIFF header
        while (dataOffset < wavBuffer.length - 8) {
            const chunkId = wavBuffer.toString('ascii', dataOffset, dataOffset + 4);
            const chunkSize = wavBuffer.readUInt32LE(dataOffset + 4);
            if (chunkId === 'data') {
                dataOffset += 8; // Skip 'data' + size
                break;
            }
            dataOffset += 8 + chunkSize;
        }

        if (dataOffset >= wavBuffer.length) {
            console.error('[STT] Invalid WAV file — no data chunk found');
            return '';
        }

        // Convert Int16 PCM to Float32 (sherpa-onnx expects Float32Array)
        const numSamples = Math.floor((wavBuffer.length - dataOffset) / 2);
        if (numSamples === 0) {
            console.error('[STT] Empty audio — no samples');
            return '';
        }

        const samples = new Float32Array(numSamples);
        for (let i = 0; i < numSamples; i++) {
            samples[i] = wavBuffer.readInt16LE(dataOffset + i * 2) / 32768.0;
        }

        // Check if language setting changed since model init
        const inputLangName = getSetting('inputLanguage') || 'Auto';
        const langCode = (inputLangName !== 'Auto' && LANGUAGE_CODES[inputLangName]) ? LANGUAGE_CODES[inputLangName] : '';

        // Create a fresh recognizer if language setting changed
        // (sherpa-onnx whisper config sets language at recognizer creation time)
        // For auto-detect, we use empty string which triggers Whisper's built-in detection

        const stream = sttRecognizer.createStream();
        stream.acceptWaveform({ sampleRate: 16000, samples });
        sttRecognizer.decode(stream);
        let text = sttRecognizer.getResult(stream).text.trim();

        // Apply dictionary corrections
        text = applyDictionaryCorrections(text);

        const elapsed = Date.now() - startTime;
        console.log(`[STT] ✓ "${text.substring(0, 80)}" (${elapsed}ms)`);

        // Clean up audio file
        try { fs.unlinkSync(audioPath); } catch (e) { }

        return text;
    } catch (err: any) {
        console.error('[STT] Transcription error:', err.message || err);
        return '';
    }
}

// ============================================
// TEXT INJECTION
// ============================================

function pasteAtCursor(text: string): void {
    if (!text.trim()) return;

    // Store for undo
    lastPastedText = text;

    // ALWAYS copy to clipboard first — this is the user's fallback
    clipboard.writeText(text);
    console.log('[Inject] Text copied to clipboard');

    // Attempt to paste via Ctrl+V (works in writable fields)
    // If the target is non-writable, the paste silently fails but text is still on clipboard
    setTimeout(() => {
        try {
            const { exec } = require('child_process');
            exec('powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\'^v\')"',
                { timeout: 3000 },
                (err: any) => {
                    if (err) {
                        console.log('[Inject] Paste may have failed (non-writable target) — text is on clipboard');
                    } else {
                        console.log('[Inject] Paste sent via Ctrl+V');
                    }
                }
            );
        } catch (e) {
            console.log('[Inject] Paste error — text is still on clipboard:', e);
        }
    }, 100);
}

/**
 * Paste grammar output with file tag support.
 * Splits text at «ENTER» markers, pastes each segment, then presses Enter
 * to trigger file tag autocomplete in coding apps (VS Code, Cursor, etc.)
 */
function pasteWithFileTags(text: string): void {
    if (!text.trim()) return;

    // Check if text has any «ENTER» markers
    if (!text.includes('«ENTER»')) {
        // No file tags — use normal paste
        pasteAtCursor(text);
        return;
    }

    lastPastedText = text.replace(/«ENTER»/g, '');

    // Split text into segments around «ENTER» markers
    const segments = text.split('«ENTER»');
    console.log(`[Inject] File tags detected: ${segments.length - 1} tag(s)`);

    const { exec } = require('child_process');
    let delay = 100;

    segments.forEach((segment, i) => {
        const isLast = i === segments.length - 1;

        setTimeout(() => {
            if (!segment && !isLast) {
                // Empty segment before marker — just press Enter
                exec('powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\'{ENTER}\')"',
                    { timeout: 3000 });
                return;
            }

            if (segment) {
                // Copy segment to clipboard and paste
                clipboard.writeText(segment);
                exec('powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\'^v\')"',
                    { timeout: 3000 },
                    (err: any) => {
                        if (!err && !isLast) {
                            // After pasting @filename, press Enter to tag it
                            setTimeout(() => {
                                exec('powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\'{ENTER}\')"',
                                    { timeout: 3000 },
                                    () => console.log(`[Inject] Enter pressed after file tag #${i + 1}`)
                                );
                            }, 200);
                        }
                    }
                );
            }
        }, delay);

        // Each segment needs time: paste (100ms) + wait (200ms) + Enter (100ms) + buffer
        delay += 600;
    });
}

/**
 * Get selected text — simulate Ctrl+C and check if clipboard CHANGED.
 * Only returns text if user had something actively selected.
 * Old/stale clipboard content is NEVER used as selected text.
 */
/**
 * Detect if the user has text selected in the foreground app.
 * Sends Ctrl+C and compares clipboard before/after.
 *   - If clipboard CHANGED → user had text selected → return that text
 *   - If clipboard SAME → nothing selected → return ''
 * That's it. No size/newline heuristics.
 */
async function getSelectedText(): Promise<string> {
    return new Promise((resolve) => {
        try {
            // Skip if Juskoe's own window is focused (avoid capturing our own UI)
            if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused()) {
                console.log('[Selection] Juskoe focused — skipping');
                resolve('');
                return;
            }

            const beforeClipboard = clipboard.readText();

            const psCommand = `
                Add-Type -AssemblyName System.Windows.Forms
                Start-Sleep -Milliseconds 120
                [System.Windows.Forms.SendKeys]::SendWait('^c')
                Start-Sleep -Milliseconds 350
            `;

            const { exec } = require('child_process');
            exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand.replace(/\n/g, '; ')}"`, { timeout: 5000 }, () => {
                setTimeout(() => {
                    const afterClipboard = clipboard.readText();

                    // Selection = clipboard changed after Ctrl+C
                    if (afterClipboard && afterClipboard.trim() !== beforeClipboard.trim()) {
                        // Length guard: >5000 chars is probably a full doc copy, not a selection
                        if (afterClipboard.length > 5000) {
                            console.log(`[Selection] Skipping — clipboard too long (${afterClipboard.length} chars), likely not a selection`);
                            resolve('');
                            return;
                        }
                        console.log(`[Selection] ✓ Selected text: "${afterClipboard.substring(0, 80)}" (${afterClipboard.length} chars)`);
                        resolve(afterClipboard.trim());
                    } else {
                        console.log('[Selection] No selection — pure AI mode');
                        resolve('');
                    }
                }, 350);
            });
        } catch (error) {
            console.error('[Selection] Error:', error);
            resolve('');
        }
    });
}

// ============================================
// RECORDING CONTROL
// ============================================

// Debounce + pipeline lock
let lastHotkeyTime = 0;
let isPipelineRunning = false;
const HOTKEY_DEBOUNCE_MS = 500;
let stopFailsafeTimer: ReturnType<typeof setTimeout> | null = null;

async function startRecording(mode: 'ai' | 'grammar' | 'notes'): Promise<void> {
    // If already recording, ANY hotkey press = stop (don't switch modes)
    if (isRecording) {
        stopRecording();
        return;
    }

    // Debounce rapid presses
    const now = Date.now();
    if (now - lastHotkeyTime < HOTKEY_DEBOUNCE_MS) {
        return; // Silent debounce — no log spam
    }
    lastHotkeyTime = now;

    // Don't start if pipeline is still running from previous recording
    if (isPipelineRunning) {
        return; // Silent block — overlay is already showing processing
    }

    // ---- AUTH GATE: Block all voice features if not logged in ----
    if (!isAuthenticated()) {
        console.log('[Voice] BLOCKED — user not authenticated');
        safeSendOverlay('overlay:show-message', 'Please sign in to use Juskoe');
        setOverlayState('error');
        // Also show the main window so user can log in
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
        return;
    }

    // ---- CREDIT CHECK: Block F7/F8 if per-mode daily credits are exhausted ----
    if (mode !== 'notes' && isAuthenticated() && !isPro()) {
        try {
            const usageCheck = await Promise.race([
                getUsageSummary(),
                new Promise<UsageSummary>((resolve) =>
                    setTimeout(() => resolve({ dailyAI: 0, dailyGrammar: 0, monthlyTotal: 0, limitReached: false }), 2000)
                ),
            ]);

            const { FREE_PLAN_LIMITS } = await import('../shared/config');
            let blocked = false;

            if (mode === 'ai' && usageCheck.dailyAI >= FREE_PLAN_LIMITS.dailyAI) {
                blocked = true;
            } else if (mode === 'grammar' && usageCheck.dailyGrammar >= FREE_PLAN_LIMITS.dailyGrammar) {
                blocked = true;
            } else if (usageCheck.monthlyTotal >= FREE_PLAN_LIMITS.monthlyTotal) {
                blocked = true;
            }

            if (blocked) {
                console.log(`[Voice] BLOCKED — ${mode} credits exhausted`);
                safeSendOverlay('overlay:error-category', 'credits');
                setOverlayState('error');
                return;
            }
        } catch (e) {
            // Fail-open: if check fails, allow recording
            console.warn('[Voice] Credit check failed (allowing):', e);
        }
    }

    console.log(`\n[Voice] START ${mode.toUpperCase()}`);

    // F7 (AI) only: detect if user has text selected → rewrite mode.
    // F8 (grammar) and F9 (notes): STT only, never touch clipboard.
    capturedSelectedText = '';
    if (mode === 'ai') {
        try {
            capturedSelectedText = await getSelectedText();
            if (capturedSelectedText) {
                console.log(`[Selection] Rewrite mode: "${capturedSelectedText.substring(0, 50)}..."`);
            }
        } catch (e) {
            console.error('[Selection] Failed, continuing without selection:', e);
            capturedSelectedText = '';
        }
    }

    // Clear any previous failsafe timer
    if (stopFailsafeTimer) {
        clearTimeout(stopFailsafeTimer);
        stopFailsafeTimer = null;
    }

    isRecording = true;
    currentMode = mode;
    recordingStartTime = Date.now();  // Start tracking recording duration
    safeSendOverlay('overlay:mode', mode);
    setOverlayState('listening');
    safeSendMain('recording:start', mode);
}

function stopRecording(): void {
    if (!isRecording) return;

    console.log('[Voice] STOP');
    isRecording = false;
    setOverlayState('processing');
    safeSendMain('recording:stop');

    // FAILSAFE: If audio:blob never arrives (e.g. renderer crashed),
    // reset everything after 10 seconds so the app doesn't stay stuck
    stopFailsafeTimer = setTimeout(() => {
        if (!isPipelineRunning) {
            // Pipeline never started — renderer likely crashed or didn't send audio
            console.warn('[Voice] FAILSAFE: No audio:blob received within 10s — resetting');
            setOverlayState('error');
            setTimeout(() => setOverlayState('idle'), 3000);

            // Try to reload the renderer if it crashed
            try {
                if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents.isCrashed()) {
                    console.log('[Voice] Renderer crashed — reloading');
                    mainWindow.webContents.reload();
                }
            } catch (e) {
                console.error('[Voice] Failed to reload renderer:', e);
            }
        }
        stopFailsafeTimer = null;
    }, 10000);
}

// ============================================
// IPC HANDLERS
// ============================================

function setupIPC(): void {
    // ---- Window controls ----
    ipcMain.on('window:minimize', () => mainWindow?.minimize());
    ipcMain.on('window:maximize', () =>
        mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize()
    );
    ipcMain.on('window:close', () => mainWindow?.hide());

    // ---- Voice control ----
    ipcMain.on('voice:trigger', (_, mode: 'ai' | 'grammar') => startRecording(mode));
    ipcMain.on('mic:ready', () => console.log('[Mic] Ready'));

    // ---- Recording error from renderer (audio processing failed) ----
    ipcMain.on('recording:error', (_, errorMsg: string) => {
        console.error('[Pipeline] Renderer reported error:', errorMsg);
        // Clear the failsafe timer since we got a response (even if it's an error)
        if (stopFailsafeTimer) {
            clearTimeout(stopFailsafeTimer);
            stopFailsafeTimer = null;
        }
        // Reset state so user can try again
        isPipelineRunning = false;
        setOverlayState('error');
        setTimeout(() => setOverlayState('idle'), 3000);
    });

    // ---- Audio processing (the main pipeline) ----
    ipcMain.on('audio:blob', async (_, { wavBase64 }: { wavBase64: string }) => {
        // Clear the failsafe timer — audio arrived successfully
        if (stopFailsafeTimer) {
            clearTimeout(stopFailsafeTimer);
            stopFailsafeTimer = null;
        }

        if (isPipelineRunning) {
            console.log('[Pipeline] Already running — skipping duplicate');
            return;
        }
        isPipelineRunning = true;

        // Safety timeout: if pipeline takes >95s, force error and reset
        const pipelineTimeout = setTimeout(() => {
            if (isPipelineRunning) {
                console.error('[Pipeline] TIMEOUT (95s) — forcing error state');
                isPipelineRunning = false;
                setOverlayState('error');
                // Auto-recover to idle after showing error
                setTimeout(() => setOverlayState('idle'), 3000);
            }
        }, 95000);

        const pipelineStart = Date.now();
        console.log('\n========== JUSKOE PIPELINE ==========');
        console.log(`[START] Mode: ${currentMode.toUpperCase()}`);

        try {
            // Step 1: Decode webm from renderer
            const buffer = Buffer.from(wavBase64, 'base64');
            console.log(`[Pipeline] Received webm: ${buffer.length} bytes`);

            // Step 2: Convert webm → wav via ffmpeg pipe (no disk I/O for input)
            const wavPath = path.join(getTempDir(), `rec_${Date.now()}.wav`);
            console.log(`[ffmpeg] Using: ${ffmpegPath}`);
            await new Promise<void>((resolve, reject) => {
                const ffmpeg = spawn(ffmpegPath, [
                    '-i', 'pipe:0',          // read from stdin
                    '-acodec', 'pcm_s16le',  // 16-bit signed PCM (whisper REQUIRES this)
                    '-ar', '16000',          // 16kHz sample rate
                    '-ac', '1',              // mono
                    '-f', 'wav',             // WAV container
                    '-y',                    // overwrite
                    wavPath
                ]);
                ffmpeg.on('close', (code) => {
                    if (code === 0) {
                        const wavSize = fs.existsSync(wavPath) ? fs.statSync(wavPath).size : 0;
                        console.log(`[Pipeline] Converted webm → wav (${(wavSize / 1024).toFixed(1)} KB, pcm_s16le 16kHz mono)`);
                        resolve();
                    } else {
                        reject(new Error(`ffmpeg exit code ${code}`));
                    }
                });
                ffmpeg.on('error', reject);
                // Pipe webm directly to ffmpeg stdin (skip disk write)
                ffmpeg.stdin.write(buffer);
                ffmpeg.stdin.end();
                // Timeout ffmpeg after 5s
                setTimeout(() => { ffmpeg.kill(); reject(new Error('ffmpeg timeout')); }, 5000);
            });

            // Step 3: Transcribe with Whisper + get app context IN PARALLEL
            const whisperStart = Date.now();
            const [transcript, appContext] = await Promise.all([
                transcribeWithWhisper(wavPath),
                getAppContext(),
            ]);
            const whisperTime = Date.now() - whisperStart;
            console.log(`[WHISPER] "${transcript.substring(0, 60)}..." (${whisperTime}ms)`);

            if (!transcript) {
                console.log('[RESULT] No speech detected');
                safeSendOverlay('overlay:error-category', 'voice');
                setOverlayState('error');
                clearTimeout(pipelineTimeout);
                isPipelineRunning = false;
                return;
            }

            // Calculate productivity metrics
            // wordCount = output words (what AI produced or transcript for grammar)
            const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;

            // Real WPM = how fast the user SPOKE (recording duration vs spoken words)
            const recordingDurationMin = recordingStartTime > 0
                ? (Date.now() - recordingStartTime - whisperTime) / 60000  // subtract Whisper time
                : whisperTime / 60000;
            const rawWpm = recordingDurationMin > 0
                ? Math.round(wordCount / recordingDurationMin)
                : 0;
            // Clamp to realistic speaking range (60–250 WPM)
            const wpm = rawWpm >= 60 && rawWpm <= 250 ? rawWpm : 120;

            // Filter Whisper hallucinations — don't waste AI credits on noise
            let cleanedTranscript = transcript
                .replace(/\[.*?\]/g, '')
                .replace(/\(.*?\)/g, '')
                .replace(/\.\.\./g, '')
                .replace(/\s+/g, ' ')
                .trim();

            if (!cleanedTranscript || cleanedTranscript.length < 2) {
                console.log(`[RESULT] Filtered noise: "${transcript.substring(0, 40)}"`);
                safeSendOverlay('overlay:error-category', 'voice');
                setOverlayState('error');
                clearTimeout(pipelineTimeout);
                isPipelineRunning = false;
                return;
            }

            // Quality gate: reject very short transcripts (< 3 words) as likely noise
            const shortWordCount = cleanedTranscript.split(/\s+/).length;
            if (shortWordCount < 3) {
                console.log(`[RESULT] Too short (${shortWordCount} words), likely noise: "${cleanedTranscript}"`);
                safeSendOverlay('overlay:error-category', 'voice');
                setOverlayState('error');
                clearTimeout(pipelineTimeout);
                isPipelineRunning = false;
                return;
            }

            // === NOTES MODE: Clean STT + format + save (F7+F8 combined) ===
            if (currentMode === 'notes') {
                console.log(`[NOTES] Processing with AI formatter...`);
                console.log(`[PIPELINE→AI] notes mode | transcript[0..120]="${cleanedTranscript.substring(0, 120)}"`);
                const notesResult = await processNotesMode(cleanedTranscript);
                setOverlayState('success');
                const notesNow = new Date();
                safeSendMain('recording:result', {
                    success: true,
                    text: `✓ Note saved: "${notesResult.text.substring(0, 80)}${notesResult.text.length > 80 ? '...' : ''}"`,
                    createdAt: notesNow.toISOString(),
                });
                safeSendMain('notes:saved');

                // Persist to command history (local)
                const now = notesNow;
                addCommandHistory({
                    time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                    date: now.toISOString().slice(0, 10),
                    text: notesResult.text,
                    mode: 'notes',
                });

                // GAP #21: Cloud sync note for Pro users (fire-and-forget)
                if (shouldCloudSync()) {
                    addCloudNote(notesResult.text, ['voice-note', 'f9']).catch(e =>
                        console.warn('[CloudSync] Note push failed:', e?.message || e)
                    );
                }

                const totalTime = Date.now() - pipelineStart;
                console.log(`[NOTES] Saved: "${notesResult.text.substring(0, 60)}"`);
                console.log(`[TIME] Total: ${totalTime}ms (Whisper: ${whisperTime}ms)`);
                console.log('======================================\n');
                setTimeout(() => setOverlayState('idle'), 1500);
                clearTimeout(pipelineTimeout);
                isPipelineRunning = false;
                return;
            }

            // Use the selected text that was captured when recording started
            const selectedText = capturedSelectedText;
            capturedSelectedText = ''; // Clear after use

            // Diagnostic log — single source of truth for "what we are about
            // to send to OpenRouter". Confirms Bug 1 (stale input) is fixed
            // in production by showing fresh transcript + fresh selection
            // for every press, with no cross-press contamination.
            console.log(
                `[PIPELINE→AI] mode=${currentMode}` +
                ` | transcript[0..120]="${cleanedTranscript.substring(0, 120)}"` +
                ` | selectedText[0..60]="${(selectedText || '').substring(0, 60)}"` +
                ` | selectedTextLen=${(selectedText || '').length}`
            );

            // Process with AI — NO blocking Supabase calls before this!
            const aiStart = Date.now();
            const result = await processVoiceInput(cleanedTranscript, currentMode as 'ai' | 'grammar', appContext, selectedText || undefined);
            const aiTime = Date.now() - aiStart;
            console.log(`[AI] "${result.output?.substring(0, 60)}..." (${aiTime}ms)`);

            if (result.success && result.output) {
                const resultNow = new Date();
                // Check if this was a "save to notes" command
                if (result.savedToNotes) {
                    setOverlayState('success');
                    safeSendMain('recording:result', {
                        success: true,
                        text: result.output,
                        createdAt: resultNow.toISOString(),
                    });
                    safeSendMain('notes:saved');
                    console.log('[RESULT] Saved to notes');
                } else {
                    // Grammar mode uses file-tag-aware paste, AI mode uses normal paste
                    if (currentMode === 'grammar') {
                        pasteWithFileTags(result.output);
                    } else {
                        pasteAtCursor(result.output);
                    }
                    setOverlayState('success');
                    safeSendMain('recording:result', {
                        success: true,
                        text: result.output.replace(/«ENTER»/g, ''),
                        createdAt: resultNow.toISOString(),
                    });
                    console.log('[RESULT] Pasted successfully');
                }

                // ---- Persist to command history local (survives logout/reinstall) ----
                const now = resultNow;
                addCommandHistory({
                    time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                    date: now.toISOString().slice(0, 10),
                    text: result.output.replace(/«ENTER»/g, ''),
                    mode: currentMode,
                });

                // GAP #23: Cloud-sync command history for Pro users (cross-device restore)
                if (shouldCloudSync()) {
                    addCloudNote(result.output.replace(/«ENTER»/g, ''), ['command-history', currentMode]).catch(e =>
                        console.warn('[CloudSync] History push failed:', e?.message || e)
                    );
                }

                // ---- Track local productivity stats (always, works offline) ----
                const clampedWpm = wpm > 0 ? wpm : 120;
                updateProductivityLocal(wordCount, clampedWpm);
                console.log(`[Stats] +${wordCount} words, ${clampedWpm} WPM`);

                // Push live stats update to renderer so UI reflects immediately
                const freshStats = getProductivityStats();
                safeSendMain('stats:updated', freshStats);

                // ---- Increment usage + cloud stats (authenticated only, fire-and-forget) ----
                if (isAuthenticated()) {
                    checkAndIncrementUsage(currentMode as 'ai' | 'grammar').then(usageResult => {
                        if (!usageResult.allowed) {
                            console.log(`[LIMIT] Next use blocked: ${usageResult.reason}`);
                        }
                    }).catch(e => {
                        console.warn('[LIMIT] Usage increment failed (non-critical):', e);
                    });

                    // Cloud productivity stats — already handles total_words, avg_wpm, streak_days in Supabase
                    updateProductivityMetrics({ words_added: wordCount, wpm: clampedWpm }).catch(e => {
                        console.warn('[Stats] Cloud update failed (non-critical):', e);
                    });
                }
            } else {
                // Detect error category for overlay
                const errMsg = result.error || 'Unknown error';
                let category = 'generic';
                let aiMessage = '';
                if (errMsg.startsWith('bad_response:')) {
                    category = 'bad_response';
                    aiMessage = errMsg.replace('bad_response:', '');
                } else if (errMsg === 'bad_response') {
                    category = 'bad_response';
                } else if (errMsg.includes('timed out') || errMsg.includes('fetch') || errMsg.includes('network')) {
                    category = 'network';
                }
                if (aiMessage) {
                    safeSendOverlay('overlay:error-message', aiMessage);
                }
                safeSendOverlay('overlay:error-category', category);
                setOverlayState('error');
                console.log(`[RESULT] Error - ${errMsg}`);
            }

            const totalTime = Date.now() - pipelineStart;
            console.log(`[TIME] Total: ${totalTime}ms (Whisper: ${whisperTime}ms, AI: ${aiTime}ms)`);
            console.log('======================================\n');

            setTimeout(() => setOverlayState('idle'), 1500);

        } catch (err: any) {
            console.error('[RESULT] Pipeline Error:', err);
            const errStr = err?.message || String(err);
            let category = 'generic';
            if (errStr.includes('fetch') || errStr.includes('timeout') || errStr.includes('ENOTFOUND') || errStr.includes('ECONNREFUSED')) {
                category = 'network';
            } else if (errStr.includes('ffmpeg') || errStr.includes('audio')) {
                category = 'voice';
            }
            safeSendOverlay('overlay:error-category', category);
            setOverlayState('error');
        } finally {
            clearTimeout(pipelineTimeout);
            isPipelineRunning = false;
        }
    });

    // ---- Cloud Sync Helper ---- 
    function shouldCloudSync(): boolean {
        return isPro() && isAuthenticated() && getSetting('cloudSync') === 'true';
    }

    // ---- Dictionary IPC (local-first + cloud push) ----
    ipcMain.handle('dictionary:getAll', () => getAllDictionaryWords());
    ipcMain.handle('dictionary:add', (_, word: string, corrections: string[]) => {
        const entry = addDictionaryWord(word, corrections);
        if (shouldCloudSync()) {
            upsertCloudDictionaryWord(word, corrections.join(', ')).catch(e =>
                console.warn('[CloudSync] Dict push failed:', e?.message || e)
            );
        }
        return entry;
    });
    ipcMain.handle('dictionary:delete', (_, id: number) => {
        // Get word before deleting locally (for cloud delete)
        const allWords = getAllDictionaryWords();
        const wordEntry = allWords.find(w => w.id === id);
        deleteDictionaryWord(id);
        if (shouldCloudSync() && wordEntry) {
            // Cloud uses string IDs, we search by word
            getCloudDictionary().then(cloudWords => {
                const cloudEntry = cloudWords.find(c => c.word === wordEntry.word.toLowerCase());
                if (cloudEntry) deleteCloudDictionaryWord(cloudEntry.id);
            }).catch(e => console.warn('[CloudSync] Dict delete failed:', e?.message || e));
        }
    });

    // ---- Snippets IPC (local-first + cloud push) ----
    ipcMain.handle('snippets:getAll', () => getAllSnippets());
    ipcMain.handle('snippets:add', (_, key: string, title: string, content: string, category: string) => {
        const entry = addSnippet(key, title, content, category);
        if (shouldCloudSync()) {
            upsertCloudSnippet(key, title, content, category).catch(e =>
                console.warn('[CloudSync] Snippet push failed:', e?.message || e)
            );
        }
        return entry;
    });
    ipcMain.handle('snippets:update', (_, id: number, key: string, title: string, content: string, category: string) => {
        updateSnippet(id, key, title, content, category);
        if (shouldCloudSync()) {
            upsertCloudSnippet(key, title, content, category).catch(e =>
                console.warn('[CloudSync] Snippet update failed:', e?.message || e)
            );
        }
    });
    ipcMain.handle('snippets:delete', (_, id: number) => {
        const allSnippets = getAllSnippets();
        const snippetEntry = allSnippets.find(s => s.id === id);
        deleteSnippet(id);
        if (shouldCloudSync() && snippetEntry) {
            getCloudSnippets().then(cloudSnippets => {
                const cloudEntry = cloudSnippets.find(c => c.key === snippetEntry.key);
                if (cloudEntry) deleteCloudSnippet(cloudEntry.id);
            }).catch(e => console.warn('[CloudSync] Snippet delete failed:', e?.message || e));
        }
    });

    // ---- Styles IPC ----
    ipcMain.handle('styles:getAll', () => getAllStyles());
    ipcMain.handle('styles:getActive', () => getActiveStyle());
    ipcMain.handle('styles:add', (_, name: string, prompt: string, language: string) =>
        addStyle(name, prompt, language)
    );
    ipcMain.handle('styles:update', (_, id: number, name: string, prompt: string, language: string) =>
        updateStyle(id, name, prompt, language)
    );
    ipcMain.handle('styles:delete', (_, id: number) => deleteStyle(id));
    ipcMain.handle('styles:setActive', (_, id: number) => setActiveStyle(id));

    // ---- Notes IPC (local-first + cloud push) ----
    ipcMain.handle('notes:getAll', () => getAllNotes());
    ipcMain.handle('notes:add', (_, text: string, tags: string[]) => {
        const entry = addNote(text, tags);
        if (shouldCloudSync()) {
            addCloudNote(text, tags).catch(e =>
                console.warn('[CloudSync] Note push failed:', e?.message || e)
            );
        }
        return entry;
    });
    ipcMain.handle('notes:delete', (_, id: number) => {
        const allNotes = getAllNotes();
        const noteEntry = allNotes.find(n => n.id === id);
        deleteNote(id);
        if (shouldCloudSync() && noteEntry) {
            getCloudNotes().then(cloudNotes => {
                const cloudEntry = cloudNotes.find(c => c.text === noteEntry.text);
                if (cloudEntry) deleteCloudNote(cloudEntry.id);
            }).catch(e => console.warn('[CloudSync] Note delete failed:', e?.message || e));
        }
    });
    ipcMain.handle('notes:search', (_, query: string) => searchNotes(query));

    // ---- Productivity Stats IPC ----
    ipcMain.handle('stats:get', () => getProductivityStats());

    // ---- Command History IPC ----
    ipcMain.handle('history:get', () => getCommandHistory());
    ipcMain.handle('history:clear', () => { clearCommandHistory(); return true; });

    // ---- Data Management IPC ----
    ipcMain.handle('data:clear-all', () => { clearAllLocalData(); return true; });

    // ---- Settings IPC ----
    ipcMain.handle('settings:getAll', () => getAllSettings());
    ipcMain.handle('settings:get-all', () => getAllSettings());
    ipcMain.handle('settings:get', (_, key: string) => getSetting(key));
    ipcMain.handle('settings:set', (_, key: string, value: string) => {
        // SECURITY: Block cloudSync for non-pro users — no bypass possible
        if (key === 'cloudSync' && value === 'true' && !isPro()) {
            console.warn('[Settings] Blocked cloudSync enable — user is not Pro');
            return { error: 'pro_required' };
        }
        setSetting(key, value);

        // Manage realtime sync when cloudSync is toggled
        if (key === 'cloudSync' && isAuthenticated()) {
            if (value === 'true') {
                console.log('[CloudSync] Cloud sync enabled — syncing + starting realtime');
                syncFromCloud()
                    .then(() => startCloudRealtimeSync())
                    .catch(e => console.warn('[CloudSync] Sync failed:', e?.message || e));
            } else {
                console.log('[CloudSync] Cloud sync disabled — stopping realtime');
                unsubscribeFromCloudChanges();
            }
        }

        return { success: true };
    });

    // ---- Cloud Sync IPC ----
    ipcMain.handle('sync:trigger', async () => {
        if (!shouldCloudSync()) {
            return { success: false, error: 'Cloud sync not available (requires Pro + enabled)' };
        }
        try {
            await syncFromCloud();
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e?.message || 'Sync failed' };
        }
    });

    // Plan check — lets frontend know if user is pro
    ipcMain.handle('settings:isPro', () => isPro());

    // ---- Launch on Startup ----
    ipcMain.handle('app:getAutoLaunch', () => {
        return app.getLoginItemSettings().openAtLogin;
    });
    ipcMain.handle('app:setAutoLaunch', (_, enabled: boolean) => {
        app.setLoginItemSettings({
            openAtLogin: enabled,
            openAsHidden: true,                 // macOS: start hidden
            args: enabled ? ['--hidden'] : [],  // Windows: pass hidden flag so we launch in background
        });
        setSetting('launchOnStartup', enabled.toString());
        return enabled;
    });

    // ---- Overlay Position ----
    ipcMain.handle('overlay:setPosition', (_, position: string) => {
        setSetting('overlayPosition', position);
        if (overlayWindow && !overlayWindow.isDestroyed()) {
            const primaryDisplay = screen.getPrimaryDisplay();
            const { width, height } = primaryDisplay.workAreaSize;
            const x = Math.floor(width / 2 - 130);

            if (position === 'top') {
                overlayWindow.setPosition(x, 10);
                overlayWindow.show();
            } else if (position === 'bottom') {
                overlayWindow.setPosition(x, height - 70);
                overlayWindow.show();
            } else if (position === 'hidden') {
                overlayWindow.hide();
            }
        }
        return position;
    });

    // ---- Overlay Idle Pill Visibility ----
    ipcMain.on('overlay:setIdleVisible', (_, visible: boolean) => {
        safeSendOverlay('overlay:idleVisible', visible);
    });

    // ---- Undo last paste ----
    ipcMain.on('undo:lastPaste', () => {
        if (lastPastedText) {
            console.log('[Undo] Reverting last paste');
            // This is a placeholder - proper undo would need to track what was selected before
        }
    });

    console.log('[IPC] Ready');
}

// ============================================
// GLOBAL SHORTCUTS
// ============================================

function registerHotkeys(): void {
    globalShortcut.unregisterAll();

    globalShortcut.register('F7', () => {
        console.log('[F7]');
        startRecording('ai');
    });

    globalShortcut.register('F8', () => {
        console.log('[F8]');
        startRecording('grammar');
    });

    globalShortcut.register('F9', () => {
        console.log('[F9]');
        startRecording('notes');
    });

    globalShortcut.register('Escape', () => {
        if (isRecording) {
            isRecording = false;
            setOverlayState('idle');
            mainWindow?.webContents.send('recording:cancel');
        }
    });

    console.log('[Hotkeys] F7=AI, F8=Grammar, F9=Notes, Esc=Cancel');
}

// ============================================
// CLOUD SYNC — Pull cloud data into local storage
// ============================================

async function syncFromCloud(): Promise<void> {
    console.log('[CloudSync] Starting sync from cloud...');
    try {
        // Sync Dictionary: cloud → local (merge, don't overwrite)
        const cloudDict = await getCloudDictionary();
        const localDict = getAllDictionaryWords();
        let dictAdded = 0;
        for (const cd of cloudDict) {
            const exists = localDict.find(ld => ld.word.toLowerCase() === cd.word.toLowerCase());
            if (!exists) {
                addDictionaryWord(cd.word, [cd.correction]);
                dictAdded++;
            }
        }
        if (dictAdded > 0) console.log(`[CloudSync] Dict: +${dictAdded} words from cloud`);

        // Sync Snippets: cloud → local (merge by key)
        const cloudSnippets = await getCloudSnippets();
        const localSnippets = getAllSnippets();
        let snippetsAdded = 0;
        for (const cs of cloudSnippets) {
            const exists = localSnippets.find(ls => ls.key === cs.key.toLowerCase());
            if (!exists) {
                addSnippet(cs.key, cs.title, cs.content, cs.category);
                snippetsAdded++;
            }
        }
        if (snippetsAdded > 0) console.log(`[CloudSync] Snippets: +${snippetsAdded} from cloud`);

        // Sync Notes: cloud → local (merge by text match)
        const cloudNotes = await getCloudNotes();
        const localNotes = getAllNotes();
        let notesAdded = 0;
        for (const cn of cloudNotes) {
            const exists = localNotes.find(ln => ln.text === cn.text);
            if (!exists) {
                addNote(cn.text, cn.tags || []);
                notesAdded++;
            }
        }
        if (notesAdded > 0) console.log(`[CloudSync] Notes: +${notesAdded} from cloud`);

        // Push local-only data → cloud
        const updatedLocalDict = getAllDictionaryWords();
        for (const ld of updatedLocalDict) {
            const inCloud = cloudDict.find(cd => cd.word.toLowerCase() === ld.word.toLowerCase());
            if (!inCloud) {
                upsertCloudDictionaryWord(ld.word, ld.corrections.join(', ')).catch(() => { });
            }
        }

        const updatedLocalSnippets = getAllSnippets();
        for (const ls of updatedLocalSnippets) {
            const inCloud = cloudSnippets.find(cs => cs.key === ls.key);
            if (!inCloud) {
                upsertCloudSnippet(ls.key, ls.title, ls.content, ls.category).catch(() => { });
            }
        }

        const updatedLocalNotes = getAllNotes();
        for (const ln of updatedLocalNotes) {
            const inCloud = cloudNotes.find(cn => cn.text === ln.text);
            if (!inCloud) {
                addCloudNote(ln.text, ln.tags).catch(() => { });
            }
        }

        console.log('[CloudSync] Sync complete ✓');
    } catch (e: any) {
        console.error('[CloudSync] Sync error:', e?.message || e);
    }
}

// ============================================
// REALTIME SYNC — event-driven, on-change only
// ============================================

// Debounce timers for each collection
let dictSyncTimer: ReturnType<typeof setTimeout> | null = null;
let snippetSyncTimer: ReturnType<typeof setTimeout> | null = null;
let noteSyncTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced dict sync: fetch cloud dict and merge into local */
function syncDictFromCloud(): void {
    if (dictSyncTimer) clearTimeout(dictSyncTimer);
    dictSyncTimer = setTimeout(async () => {
        try {
            const cloudDict = await getCloudDictionary();
            const localDict = getAllDictionaryWords();
            let added = 0;
            for (const cd of cloudDict) {
                const exists = localDict.find(ld => ld.word.toLowerCase() === cd.word.toLowerCase());
                if (!exists) {
                    addDictionaryWord(cd.word, [cd.correction]);
                    added++;
                }
            }
            if (added > 0) console.log(`[Realtime] Dict: +${added} words synced from cloud`);
        } catch (e: any) {
            console.warn('[Realtime] Dict sync error:', e?.message || e);
        }
    }, 2000); // 2s debounce
}

/** Debounced snippet sync */
function syncSnippetsFromCloud(): void {
    if (snippetSyncTimer) clearTimeout(snippetSyncTimer);
    snippetSyncTimer = setTimeout(async () => {
        try {
            const cloudSnippets = await getCloudSnippets();
            const localSnippets = getAllSnippets();
            let added = 0;
            for (const cs of cloudSnippets) {
                const exists = localSnippets.find(ls => ls.key === cs.key.toLowerCase());
                if (!exists) {
                    addSnippet(cs.key, cs.title, cs.content, cs.category);
                    added++;
                }
            }
            if (added > 0) console.log(`[Realtime] Snippets: +${added} synced from cloud`);
        } catch (e: any) {
            console.warn('[Realtime] Snippet sync error:', e?.message || e);
        }
    }, 2000);
}

/** Debounced notes sync */
function syncNotesFromCloud(): void {
    if (noteSyncTimer) clearTimeout(noteSyncTimer);
    noteSyncTimer = setTimeout(async () => {
        try {
            const cloudNotes = await getCloudNotes();
            const localNotes = getAllNotes();
            let added = 0;
            for (const cn of cloudNotes) {
                const exists = localNotes.find(ln => ln.text === cn.text);
                if (!exists) {
                    addNote(cn.text, cn.tags || []);
                    added++;
                }
            }
            if (added > 0) console.log(`[Realtime] Notes: +${added} synced from cloud`);
        } catch (e: any) {
            console.warn('[Realtime] Note sync error:', e?.message || e);
        }
    }, 2000);
}

/** Start listening for realtime cloud changes */
function startCloudRealtimeSync(): void {
    console.log('[CloudSync] Starting realtime event-driven sync...');
    subscribeToCloudChanges({
        onDictionaryChange: syncDictFromCloud,
        onSnippetChange: syncSnippetsFromCloud,
        onNoteChange: syncNotesFromCloud,
    });
}

// ============================================
// SYSTEM TRAY
// ============================================

function createTray(): void {
    const iconPath = getAssetPath('juskoe_logo.png');
    let icon;

    try {
        icon = fs.existsSync(iconPath)
            ? nativeImage.createFromPath(iconPath).resize({ width: 16 })
            : nativeImage.createEmpty();
    } catch {
        icon = nativeImage.createEmpty();
    }

    tray = new Tray(icon);
    tray.setToolTip('Juskoe');

    tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Open Juskoe', click: () => mainWindow?.show() },
        { type: 'separator' },
        { label: 'AI Mode (F7)', click: () => startRecording('ai') },
        { label: 'Grammar (F8)', click: () => startRecording('grammar') },
        { label: 'Notes Mode (F9)', click: () => startRecording('notes') },
        { type: 'separator' },
        { label: 'Quit', click: () => { isQuitting = true; app.quit(); } }
    ]));

    tray.on('double-click', () => mainWindow?.show());
}

// ============================================
// APP LIFECYCLE
// ============================================

// Register juskoe:// protocol for OAuth deep link callback
if (process.defaultApp) {
    // Dev mode: pass the script path
    app.setAsDefaultProtocolClient('juskoe', process.execPath, [__filename]);
} else {
    app.setAsDefaultProtocolClient('juskoe');
}
console.log('[App] Registered juskoe:// protocol handler');

// Request single instance lock FIRST
const lock = app.requestSingleInstanceLock();
if (!lock) {
    app.quit();
} else {
    // On Windows, deep link URLs come via second-instance
    app.on('second-instance', (_event, commandLine) => {
        mainWindow?.show();
        // Check if launched with a deep link URL
        const deepLinkUrl = commandLine.find(arg => arg.startsWith('juskoe://'));
        if (deepLinkUrl) {
            console.log('[App] Deep link received:', deepLinkUrl.substring(0, 80) + '...');
            handleDeepLinkAuth(deepLinkUrl);
        }
    });

    app.whenReady().then(() => {
        // Init persistent log file FIRST — captures all subsequent logs to disk
        _initLogFile();

        // Initialize Sherpa-ONNX STT model (stays loaded in memory)
        initSTT();

        // Pre-warm Vertex AI OAuth token in background (saves ~500ms on first AI call)
        if (isVertexAvailable()) {
            console.log('[Vertex] Primary AI provider active (Gemini 2.5 Flash Lite)');
            prewarmVertex().catch(() => { /* non-fatal */ });
        } else {
            console.log('[Vertex] No key found — using OpenRouter as primary');
        }

        // Initialize local database
        initLocalDatabase();

        createMainWindow();
        createOverlay();
        createTray();
        registerHotkeys();
        setupIPC();

        // Initialize auth system (must be after mainWindow is created)
        if (mainWindow) {
            initAuth(mainWindow);
            console.log('[Auth] Initialized');
        }

        // Ensure auto-launch (if enabled) is registered to start HIDDEN in background
        try {
            const wantAutoLaunch = getSetting('launchOnStartup') === 'true'
                || app.getLoginItemSettings().openAtLogin;
            if (wantAutoLaunch) {
                app.setLoginItemSettings({
                    openAtLogin: true,
                    openAsHidden: true,
                    args: ['--hidden'],
                });
                console.log('[Main] Auto-launch configured to start in background');
            }
        } catch (e) {
            console.warn('[Main] Auto-launch config failed:', (e as Error)?.message);
        }

        // Cloud sync on startup + realtime event-driven sync
        setTimeout(() => {
            if (isPro() && isAuthenticated() && getSetting('cloudSync') === 'true') {
                console.log('[CloudSync] Running startup sync...');
                syncFromCloud()
                    .then(() => startCloudRealtimeSync())
                    .catch(e => console.warn('[CloudSync] Startup sync failed:', e?.message || e));
            }
        }, 3000); // Delay 3s to let auth settle

        console.log('\n' + '='.repeat(50));
        console.log('   READY! Press F7 or F8 to speak');
        console.log('='.repeat(50) + '\n');
    });

    app.on('window-all-closed', () => { });
    app.on('before-quit', () => { isQuitting = true; unsubscribeFromCloudChanges(); closeDatabase(); });
    app.on('will-quit', () => { globalShortcut.unregisterAll(); });
}
