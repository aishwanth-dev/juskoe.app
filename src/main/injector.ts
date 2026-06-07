import { clipboard } from 'electron';

// ============================================
// Text Injector - Using Electron clipboard API
// Note: For full keyboard simulation, consider using
// uiohook-napi or @nut-tree/nut-js after npm install
// ============================================

export class TextInjector {
    private platform: NodeJS.Platform;

    constructor() {
        this.platform = process.platform;
        console.log(`[Injector] Initialized for ${this.platform}`);
    }

    // ============================================
    // Get Selected Text
    // ============================================

    async getSelectedText(): Promise<string> {
        // Note: This requires keyboard simulation to work properly
        // For MVP, return empty string - user can select text manually
        console.log('[Injector] getSelectedText: Not implemented without native module');
        
        // Return current clipboard content as fallback
        return clipboard.readText() || '';
    }

    // ============================================
    // Type Text at Cursor (using clipboard paste)
    // ============================================

    async typeText(text: string): Promise<void> {
        if (!text) return;

        console.log(`[Injector] Copying text to clipboard (${text.length} chars)`);
        
        // Copy text to clipboard - user needs to paste manually
        // This is a limitation without native keyboard simulation
        clipboard.writeText(text);
        
        console.log('[Injector] Text copied to clipboard. Press Ctrl+V to paste.');
    }

    // ============================================
    // Replace Selected Text
    // ============================================

    async replaceSelectedText(newText: string): Promise<void> {
        console.log(`[Injector] Copying replacement text (${newText.length} chars)`);
        
        // Copy to clipboard - user pastes to replace
        clipboard.writeText(newText);
    }

    // ============================================
    // Clipboard Utilities
    // ============================================

    copyToClipboard(text: string): void {
        clipboard.writeText(text);
    }

    readFromClipboard(): string {
        return clipboard.readText();
    }

    // ============================================
    // Utilities
    // ============================================

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ============================================
// Singleton Export
// ============================================

let injectorInstance: TextInjector | null = null;

export function getTextInjector(): TextInjector {
    if (!injectorInstance) {
        injectorInstance = new TextInjector();
    }
    return injectorInstance;
}
