// ============================================
// JUSKOE - Local Storage System
// JSON-based local-first storage (no native deps)
// ============================================

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// Types
export interface DictionaryEntry {
    id: number;
    word: string;
    corrections: string[];
    created_at: string;
}

export interface SnippetEntry {
    id: number;
    key: string;
    title: string;
    content: string;
    category: string;
    created_at: string;
}

export interface StyleEntry {
    id: number;
    name: string;
    prompt: string;
    language: string;
    isActive: boolean;
    created_at: string;
}

export interface NoteEntry {
    id: number;
    text: string;
    tags: string[];
    created_at: string;
}

export interface DailyStats {
    date: string;       // YYYY-MM-DD
    words: number;
    sessions: number;
    avgWpm: number;
}

export interface ProductivityData {
    totalWords: number;
    avgWpm: number;
    streakDays: number;
    lastActiveDate: string;   // YYYY-MM-DD
    dailyHistory: DailyStats[];
}

export interface HistoryEntry {
    id: number;
    time: string;      // display time e.g. "09:45 AM"
    date: string;      // ISO date YYYY-MM-DD for grouping
    text: string;      // the AI output / pasted text
    mode: string;      // 'ai' | 'grammar' | 'notes'
    created_at: string;
}

interface StorageData {
    dictionary: DictionaryEntry[];
    snippets: SnippetEntry[];
    styles: StyleEntry[];
    notes: NoteEntry[];
    settings: Record<string, string>;
    productivity: ProductivityData;
    commandHistory: HistoryEntry[];
    nextId: number;
}

// Storage file path
let storagePath: string = '';
const defaultProductivity: ProductivityData = {
    totalWords: 0,
    avgWpm: 0,
    streakDays: 0,
    lastActiveDate: '',
    dailyHistory: [],
};
let data: StorageData = {
    dictionary: [],
    snippets: [],
    styles: [],
    notes: [],
    settings: {},
    productivity: { ...defaultProductivity },
    commandHistory: [],
    nextId: 1,
};

/**
 * Initialize the local storage
 */
export function initLocalDatabase(): void {
    const userDataPath = app.getPath('userData');
    storagePath = path.join(userDataPath, 'juskoe-data.json');

    console.log(`[LocalDB] Storage at: ${storagePath}`);

    // Load existing data or create default
    if (fs.existsSync(storagePath)) {
        try {
            const raw = fs.readFileSync(storagePath, 'utf-8');
            data = JSON.parse(raw);
            console.log('[LocalDB] Loaded existing data');
        } catch (e) {
            console.error('[LocalDB] Error loading data, using defaults:', e);
            initDefaults();
        }
    } else {
        initDefaults();
    }

    // Migration: add productivity field if missing (older data files)
    if (!data.productivity) {
        data.productivity = { ...defaultProductivity };
        saveData();
        console.log('[LocalDB] Migrated: added productivity field');
    }
    // Migration: add commandHistory if missing
    if (!data.commandHistory) {
        data.commandHistory = [];
        saveData();
        console.log('[LocalDB] Migrated: added commandHistory field');
    }
}

function initDefaults(): void {
    data = {
        dictionary: [],
        snippets: [],
        styles: [{
            id: 1,
            name: 'Default',
            prompt: 'You are a helpful AI assistant. Be clear, concise, and professional.',
            language: 'English',
            isActive: true,
            created_at: new Date().toISOString(),
        }],
        notes: [],
        settings: {
            cloudSync: 'false',
            emailConfirmation: 'true',
            startOnBoot: 'true',
            minimizeToTray: 'true',
            theme: 'light',
            shortcutAI: 'F7',
            shortcutGrammar: 'F8',
        },
        productivity: { ...defaultProductivity },
        commandHistory: [],
        nextId: 2,
    };
    saveData();
    console.log('[LocalDB] Initialized with defaults');
}

function saveData(): void {
    try {
        fs.writeFileSync(storagePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
        console.error('[LocalDB] Error saving data:', e);
    }
}

function getNextId(): number {
    return data.nextId++;
}

// ============================================
// Dictionary Operations
// ============================================

export function addDictionaryWord(word: string, corrections: string[]): DictionaryEntry {
    // Check if word already exists
    const existing = data.dictionary.find(d => d.word.toLowerCase() === word.toLowerCase());
    if (existing) {
        existing.corrections = corrections;
        saveData();
        return existing;
    }

    const entry: DictionaryEntry = {
        id: getNextId(),
        word,
        corrections,
        created_at: new Date().toISOString(),
    };

    data.dictionary.push(entry);
    saveData();
    return entry;
}

export function getDictionaryWord(word: string): DictionaryEntry | null {
    return data.dictionary.find(d => d.word.toLowerCase() === word.toLowerCase()) || null;
}

export function getAllDictionaryWords(): DictionaryEntry[] {
    return [...data.dictionary].sort((a, b) => a.word.localeCompare(b.word));
}

export function deleteDictionaryWord(id: number): void {
    data.dictionary = data.dictionary.filter(d => d.id !== id);
    saveData();
}

/**
 * Apply dictionary corrections to text.
 *
 * Bug 1 (defensive): a single dictionary entry whose `word` is a long
 * paragraph (or whose `correction` regex matches too broadly) can rewrite
 * an entire transcript into stale stored content. Skip entries that look
 * malformed: `word` shorter than 2 chars or longer than 80 chars, or any
 * `correction` shorter than 1 char or longer than 80 chars. Real spelling
 * fixes are short.
 */
export function applyDictionaryCorrections(text: string): string {
    let correctedText = text;

    for (const entry of data.dictionary) {
        const word = (entry.word || '');
        if (word.trim().length < 2 || word.length > 80) {
            console.warn(
                `[Dictionary] Skipping malformed entry id=${entry.id} ` +
                `wordLen=${word.length} word="${word.substring(0, 40)}"`
            );
            continue;
        }
        for (const correction of entry.corrections) {
            const c = correction || '';
            if (c.trim().length < 1 || c.length > 80) {
                console.warn(
                    `[Dictionary] Skipping malformed correction in entry id=${entry.id} ` +
                    `len=${c.length} value="${c.substring(0, 40)}"`
                );
                continue;
            }
            try {
                const regex = new RegExp(c, 'gi');
                correctedText = correctedText.replace(regex, word);
            } catch (e) {
                console.warn(`[Dictionary] Bad regex in entry id=${entry.id}: ${c}`);
            }
        }
    }

    return correctedText;
}

// ============================================
// Snippets Operations
// ============================================

export function addSnippet(key: string, title: string, content: string, category: string = 'general'): SnippetEntry {
    const entry: SnippetEntry = {
        id: getNextId(),
        key: key.toLowerCase(),
        title,
        content,
        category,
        created_at: new Date().toISOString(),
    };

    data.snippets.push(entry);
    saveData();
    return entry;
}

export function getSnippetByKey(key: string): SnippetEntry | null {
    return data.snippets.find(s => s.key === key.toLowerCase()) || null;
}

export function getAllSnippets(): SnippetEntry[] {
    return [...data.snippets].sort((a, b) => a.title.localeCompare(b.title));
}

export function updateSnippet(id: number, key: string, title: string, content: string, category: string): void {
    const snippet = data.snippets.find(s => s.id === id);
    if (snippet) {
        snippet.key = key.toLowerCase();
        snippet.title = title;
        snippet.content = content;
        snippet.category = category;
        saveData();
    }
}

export function deleteSnippet(id: number): void {
    data.snippets = data.snippets.filter(s => s.id !== id);
    saveData();
}

// ============================================
// Styles/Roles Operations
// ============================================

export function addStyle(name: string, prompt: string, language: string = 'English'): StyleEntry {
    const entry: StyleEntry = {
        id: getNextId(),
        name,
        prompt,
        language,
        isActive: false,
        created_at: new Date().toISOString(),
    };

    data.styles.push(entry);
    saveData();
    return entry;
}

export function getActiveStyle(): StyleEntry | null {
    return data.styles.find(s => s.isActive) || null;
}

export function getAllStyles(): StyleEntry[] {
    return [...data.styles].sort((a, b) => a.name.localeCompare(b.name));
}

export function setActiveStyle(id: number): void {
    for (const style of data.styles) {
        style.isActive = style.id === id;
    }
    saveData();
}

export function updateStyle(id: number, name: string, prompt: string, language: string): void {
    const style = data.styles.find(s => s.id === id);
    if (style) {
        style.name = name;
        style.prompt = prompt;
        style.language = language;
        saveData();
    }
}

export function deleteStyle(id: number): void {
    data.styles = data.styles.filter(s => s.id !== id);
    saveData();
}

// ============================================
// Notes Operations
// ============================================

export function addNote(text: string, tags: string[] = []): NoteEntry {
    const entry: NoteEntry = {
        id: getNextId(),
        text,
        tags,
        created_at: new Date().toISOString(),
    };

    data.notes.push(entry);
    saveData();
    return entry;
}

export function getAllNotes(): NoteEntry[] {
    return [...data.notes].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}

export function searchNotes(query: string): NoteEntry[] {
    const lowerQuery = query.toLowerCase();
    return data.notes.filter(n =>
        n.text.toLowerCase().includes(lowerQuery) ||
        n.tags.some(t => t.toLowerCase().includes(lowerQuery))
    );
}

export function deleteNote(id: number): void {
    data.notes = data.notes.filter(n => n.id !== id);
    saveData();
}

// ============================================
// Settings Operations
// ============================================

export function getSetting(key: string): string | null {
    return data.settings[key] || null;
}

export function setSetting(key: string, value: string): void {
    data.settings[key] = value;
    saveData();
}

export function getAllSettings(): Record<string, string> {
    return { ...data.settings };
}

// ============================================
// Productivity Stats
// ============================================

function getTodayStr(): string {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Update local productivity stats after each successful voice command.
 * Handles word count, WPM averaging, streak calculation, and daily history.
 */
export function updateProductivityLocal(wordCount: number, wpm: number): void {
    const today = getTodayStr();
    const p = data.productivity;

    // Update totals
    p.totalWords += wordCount;

    // Weighted WPM average (smoothed)
    if (wpm > 0 && wpm <= 300) {
        p.avgWpm = p.avgWpm === 0 ? wpm : Math.round(p.avgWpm * 0.7 + wpm * 0.3);
    }

    // Update daily history
    let todayEntry = p.dailyHistory.find(d => d.date === today);
    if (!todayEntry) {
        todayEntry = { date: today, words: 0, sessions: 0, avgWpm: 0 };
        p.dailyHistory.push(todayEntry);
    }
    todayEntry.words += wordCount;
    todayEntry.sessions += 1;
    todayEntry.avgWpm = todayEntry.avgWpm === 0
        ? wpm
        : Math.round(todayEntry.avgWpm * 0.7 + wpm * 0.3);

    // Keep only last 90 days of history
    if (p.dailyHistory.length > 90) {
        p.dailyHistory = p.dailyHistory.slice(-90);
    }

    // Update streak
    if (p.lastActiveDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().slice(0, 10);

        if (p.lastActiveDate === yesterdayStr) {
            p.streakDays += 1;
        } else if (p.lastActiveDate === '') {
            p.streakDays = 1;
        } else {
            // Missed a day — reset streak
            p.streakDays = 1;
        }
        p.lastActiveDate = today;
    }

    saveData();
}

/**
 * Get current productivity stats for HomePage display.
 */
export function getProductivityStats(): ProductivityData {
    // Recalculate streak in case we haven't been active today
    const today = getTodayStr();
    const p = data.productivity;

    if (p.lastActiveDate && p.lastActiveDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().slice(0, 10);

        if (p.lastActiveDate !== yesterdayStr) {
            // Streak is broken (not active yesterday or today)
            // Don't save — only reset if they actually use the app
        }
    }

    return { ...p };
}

// ============================================
// Command History (persists across sessions)
// ============================================

/** Get all saved command history entries (newest first, max 200) */
export function getCommandHistory(): HistoryEntry[] {
    return [...(data.commandHistory || [])];
}

/** Add a new entry to command history. Caps at 200. */
export function addCommandHistory(entry: Omit<HistoryEntry, 'id' | 'created_at'>): HistoryEntry {
    const newEntry: HistoryEntry = {
        ...entry,
        id: data.nextId++,
        created_at: new Date().toISOString(),
    };
    data.commandHistory = [newEntry, ...(data.commandHistory || [])].slice(0, 200);
    saveData();
    return newEntry;
}

/** Clear all command history */
export function clearCommandHistory(): void {
    data.commandHistory = [];
    saveData();
}

// ============================================
// Close (for cleanup)
// ============================================

export function closeDatabase(): void {

    saveData();
    console.log('[LocalDB] Saved and closed');
}
