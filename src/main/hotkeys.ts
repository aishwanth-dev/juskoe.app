import { globalShortcut, app } from 'electron';

// ============================================
// Hotkey Configuration
// ============================================

interface HotkeyCallbacks {
    onAIModePress: () => void;
    onAIModeRelease: () => void;
    onGrammarModePress: () => void;
    onGrammarModeRelease: () => void;
}

let callbacks: HotkeyCallbacks | null = null;
let aiModePressed = false;
let grammarModePressed = false;

// Track key states for press/release detection
const keyStates = {
    alt: false,
    ctrl: false,
    meta: false, // Win key
};

// ============================================
// Platform-specific hotkey handling
// ============================================

// On Windows, we use native hooks via iohook for better key tracking
// On macOS, we can use globalShortcut more reliably

export function registerHotkeys(cbs: HotkeyCallbacks) {
    callbacks = cbs;

    if (process.platform === 'win32') {
        // For Windows, we'll use a polling approach with globalShortcut
        // This is a workaround since globalShortcut doesn't support key release
        registerWindowsHotkeys();
    } else {
        // macOS - use globalShortcut
        registerMacHotkeys();
    }

    console.log('[Hotkeys] Registered global hotkeys');
}

function registerWindowsHotkeys() {
    // AI Mode: Alt + Win
    globalShortcut.register('Alt+Super', () => {
        if (!aiModePressed) {
            aiModePressed = true;
            console.log('[Hotkeys] AI Mode activated (Alt+Win)');
            callbacks?.onAIModePress();
        }
    });

    // Grammar Mode: Ctrl + Win
    globalShortcut.register('Control+Super', () => {
        if (!grammarModePressed) {
            grammarModePressed = true;
            console.log('[Hotkeys] Grammar Mode activated (Ctrl+Win)');
            callbacks?.onGrammarModePress();
        }
    });

    // Use a polling mechanism to detect key release
    // This is necessary because Electron's globalShortcut doesn't fire on release
    setInterval(() => {
        // Check if keys are still pressed using native method
        // For now, we use a timeout-based approach
        // In production, use node-global-key-listener or uiohook-napi
    }, 50);

    // Workaround: Register release handlers via global key listener
    // We'll trigger release after a short timeout when the shortcut isn't firing
    setupKeyReleaseDetection();
}

function registerMacHotkeys() {
    // AI Mode: Option + Command (Alt + Win equivalent on Mac)
    globalShortcut.register('Alt+Command', () => {
        if (!aiModePressed) {
            aiModePressed = true;
            console.log('[Hotkeys] AI Mode activated (Alt+Cmd)');
            callbacks?.onAIModePress();
        }
    });

    // Grammar Mode: Ctrl + Command
    globalShortcut.register('Control+Command', () => {
        if (!grammarModePressed) {
            grammarModePressed = true;
            console.log('[Hotkeys] Grammar Mode activated (Ctrl+Cmd)');
            callbacks?.onGrammarModePress();
        }
    });

    setupKeyReleaseDetection();
}

// ============================================
// Key Release Detection
// ============================================

let releaseCheckInterval: NodeJS.Timeout | null = null;
let lastPressTime = 0;
const RELEASE_TIMEOUT = 200; // ms

function setupKeyReleaseDetection() {
    releaseCheckInterval = setInterval(() => {
        const now = Date.now();

        // If we haven't detected a key press in RELEASE_TIMEOUT, consider it released
        if (aiModePressed && now - lastPressTime > RELEASE_TIMEOUT) {
            aiModePressed = false;
            console.log('[Hotkeys] AI Mode released');
            callbacks?.onAIModeRelease();
        }

        if (grammarModePressed && now - lastPressTime > RELEASE_TIMEOUT) {
            grammarModePressed = false;
            console.log('[Hotkeys] Grammar Mode released');
            callbacks?.onGrammarModeRelease();
        }
    }, 50);

    // Update last press time when shortcuts fire
    const originalAICallback = callbacks?.onAIModePress;
    const originalGrammarCallback = callbacks?.onGrammarModePress;

    if (callbacks) {
        callbacks.onAIModePress = () => {
            lastPressTime = Date.now();
            originalAICallback?.();
        };
        callbacks.onGrammarModePress = () => {
            lastPressTime = Date.now();
            originalGrammarCallback?.();
        };
    }
}

export function unregisterHotkeys() {
    globalShortcut.unregisterAll();

    if (releaseCheckInterval) {
        clearInterval(releaseCheckInterval);
        releaseCheckInterval = null;
    }

    console.log('[Hotkeys] Unregistered all hotkeys');
}

// ============================================
// Manual Trigger (for UI buttons)
// ============================================

export function triggerAIMode(press: boolean) {
    if (press) {
        callbacks?.onAIModePress();
    } else {
        callbacks?.onAIModeRelease();
    }
}

export function triggerGrammarMode(press: boolean) {
    if (press) {
        callbacks?.onGrammarModePress();
    } else {
        callbacks?.onGrammarModeRelease();
    }
}
