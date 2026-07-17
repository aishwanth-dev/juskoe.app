// ============================================
// JUSKOE — Lightweight .env loader (no dependency)
// Loads environment variables from a .env file so both dev and the
// packaged .exe have access to OPENROUTER_KEYS, VERTEX config, etc.
//
// Search order (first match wins, but all are merged — later does NOT override existing):
//   1. process.cwd()/.env                 (dev)
//   2. <resourcesPath>/.env               (packaged — electron-builder extraResources)
//   3. <appPath>/.env                     (packaged alt)
//   4. <dirname>/../../.env               (relative to compiled dist)
// ============================================

import * as fs from 'fs';
import * as path from 'path';

function parseEnv(content: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        let val = line.slice(eq + 1).trim();
        // Strip surrounding quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        if (key) out[key] = val;
    }
    return out;
}

export function loadEnv(resourcesPath?: string, appPath?: string): void {
    const candidates: string[] = [
        path.join(process.cwd(), '.env'),
    ];
    if (resourcesPath) candidates.push(path.join(resourcesPath, '.env'));
    if (appPath) candidates.push(path.join(appPath, '.env'));
    try {
        candidates.push(path.join(__dirname, '..', '..', '.env'));
    } catch { /* noop */ }

    for (const file of candidates) {
        try {
            if (file && fs.existsSync(file)) {
                const parsed = parseEnv(fs.readFileSync(file, 'utf8'));
                let added = 0;
                for (const [k, v] of Object.entries(parsed)) {
                    if (process.env[k] === undefined) {
                        process.env[k] = v;
                        added++;
                    }
                }
                console.log(`[Env] Loaded ${added} vars from ${file}`);
            }
        } catch (e) {
            console.warn(`[Env] Failed to load ${file}:`, (e as Error).message);
        }
    }
}
