// ============================================
// JUSKOE - App Context Detection
// Get active window and optimize AI output
// ============================================

// We use dynamic import for active-win (ESM module)
// Pre-load at startup to avoid ~4s delay on first recording
let activeWin: any = null;

// Start loading immediately (don't await — runs in background)
(async () => {
    try {
        activeWin = await import('active-win');
        console.log('[AppContext] active-win module pre-loaded ✓');
    } catch (e) {
        console.warn('[AppContext] active-win not available:', e);
    }
})();

async function getActiveWinModule() {
    if (!activeWin) {
        try {
            activeWin = await import('active-win');
        } catch (e) {
            console.error('[AppContext] Failed to load active-win:', e);
            return null;
        }
    }
    return activeWin;
}

export interface AppContext {
    appName: string;           // e.g., "Chrome", "Cursor", "Word"
    appTitle: string;          // Window title
    appType: AppType;          // Category for AI optimization
    suggestedTone: string;     // Tone recommendation for AI
}

export type AppType = 
    | 'browser'        // Chrome, Firefox, Edge
    | 'code'           // Cursor, VS Code, Sublime
    | 'email'          // Gmail (in browser), Outlook
    | 'chat'           // WhatsApp, Slack, Discord, Telegram
    | 'document'       // Word, Google Docs, Notion
    | 'notes'          // Notepad, OneNote
    | 'terminal'       // PowerShell, CMD, Terminal
    | 'other';

// App name to type mapping
const APP_TYPE_MAP: Record<string, AppType> = {
    // Browsers
    'chrome': 'browser',
    'firefox': 'browser',
    'edge': 'browser',
    'safari': 'browser',
    'brave': 'browser',
    'opera': 'browser',
    
    // Code editors
    'cursor': 'code',
    'code': 'code',           // VS Code
    'visual studio code': 'code',
    'sublime_text': 'code',
    'atom': 'code',
    'webstorm': 'code',
    'pycharm': 'code',
    'intellij': 'code',
    
    // Email
    'outlook': 'email',
    'thunderbird': 'email',
    
    // Chat
    'whatsapp': 'chat',
    'slack': 'chat',
    'discord': 'chat',
    'telegram': 'chat',
    'teams': 'chat',
    'skype': 'chat',
    'signal': 'chat',
    
    // Documents
    'winword': 'document',    // Microsoft Word
    'word': 'document',
    'notion': 'document',
    'onenote': 'notes',
    
    // Notes
    'notepad': 'notes',
    'notepad++': 'notes',
    
    // Terminal
    'powershell': 'terminal',
    'cmd': 'terminal',
    'windowsterminal': 'terminal',
    'terminal': 'terminal',
    'iterm': 'terminal',
};

// Tone suggestions based on app type
const TONE_MAP: Record<AppType, string> = {
    'browser': 'neutral and clear',
    'code': 'technical, precise, and developer-focused',
    'email': 'professional and polished',
    'chat': 'casual and conversational',
    'document': 'clear and well-structured',
    'notes': 'concise and to-the-point',
    'terminal': 'technical and command-focused',
    'other': 'neutral and helpful',
};

// Check window title for context clues
function detectAppTypeFromTitle(title: string): AppType | null {
    const lowerTitle = title.toLowerCase();
    
    // Gmail detection (browser window with Gmail)
    if (lowerTitle.includes('gmail') || lowerTitle.includes('inbox')) {
        return 'email';
    }
    
    // WhatsApp Web
    if (lowerTitle.includes('whatsapp')) {
        return 'chat';
    }
    
    // Slack
    if (lowerTitle.includes('slack')) {
        return 'chat';
    }
    
    // Discord
    if (lowerTitle.includes('discord')) {
        return 'chat';
    }
    
    // Google Docs
    if (lowerTitle.includes('google docs') || lowerTitle.includes('- docs')) {
        return 'document';
    }
    
    // Notion
    if (lowerTitle.includes('notion')) {
        return 'document';
    }
    
    return null;
}

/**
 * Get the current active application context
 */
export async function getAppContext(): Promise<AppContext> {
    try {
        const mod = await getActiveWinModule();
        if (!mod) {
            return getDefaultContext();
        }
        
        const window = await mod.default();
        if (!window) {
            return getDefaultContext();
        }
        
        const appName = window.owner?.name || 'Unknown';
        const appTitle = window.title || '';
        const lowerAppName = appName.toLowerCase();
        
        // First check title for web apps (Gmail in Chrome, etc.)
        let appType = detectAppTypeFromTitle(appTitle);
        
        // If no match from title, use app name
        if (!appType) {
            appType = APP_TYPE_MAP[lowerAppName] || 'other';
        }
        
        const suggestedTone = TONE_MAP[appType];
        
        console.log(`[AppContext] Active: ${appName} (${appType}) - "${appTitle.substring(0, 50)}"`);
        
        return {
            appName,
            appTitle,
            appType,
            suggestedTone,
        };
    } catch (error) {
        console.error('[AppContext] Error:', error);
        return getDefaultContext();
    }
}

function getDefaultContext(): AppContext {
    return {
        appName: 'Unknown',
        appTitle: '',
        appType: 'other',
        suggestedTone: 'neutral and helpful',
    };
}

/**
 * Generate AI system context from app context
 */
export function getAIContextPrompt(context: AppContext): string {
    return `Current application: ${context.appName}
Window: ${context.appTitle.substring(0, 100)}
Suggested tone: ${context.suggestedTone}`;
}
