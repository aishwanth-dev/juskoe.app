import React, { useState } from 'react';
import './SettingsPage.css';

type SettingsTab = 'general' | 'system' | 'account';

const SettingsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('general');
    const [settings, setSettings] = useState({
        shortcuts: 'F7 + F8',
        microphone: 'Auto-detect',
        language: 'English (US)',
        theme: 'light',
        startOnBoot: true,
        minimizeToTray: true,
    });

    const renderTabContent = () => {
        switch (activeTab) {
            case 'general':
                return (
                    <div className="settings-content fade-in">
                        <h2>General</h2>

                        <div className="setting-item">
                            <div className="setting-info">
                                <span className="setting-label">Keyboard shortcuts</span>
                                <span className="setting-value">
                                    Hold <strong>F7</strong> for AI, <strong>F8</strong> for Grammar.
                                    <a href="#"> Learn more →</a>
                                </span>
                            </div>
                            <button className="btn btn-secondary">Change</button>
                        </div>

                        <div className="setting-item">
                            <div className="setting-info">
                                <span className="setting-label">Microphone</span>
                                <span className="setting-value">{settings.microphone}</span>
                            </div>
                            <button className="btn btn-secondary">Change</button>
                        </div>

                        <div className="setting-item">
                            <div className="setting-info">
                                <span className="setting-label">Languages</span>
                                <span className="setting-value">{settings.language}</span>
                            </div>
                            <button className="btn btn-secondary">Change</button>
                        </div>
                    </div>
                );

            case 'system':
                return (
                    <div className="settings-content fade-in">
                        <h2>System</h2>

                        <div className="setting-item">
                            <div className="setting-info">
                                <span className="setting-label">Theme</span>
                                <span className="setting-value">Light mode</span>
                            </div>
                            <div className="toggle-group">
                                <button
                                    className={`toggle-btn ${settings.theme === 'light' ? 'active' : ''}`}
                                    onClick={() => setSettings({ ...settings, theme: 'light' })}
                                >
                                    ☀️ Light
                                </button>
                                <button
                                    className={`toggle-btn ${settings.theme === 'dark' ? 'active' : ''}`}
                                    onClick={() => setSettings({ ...settings, theme: 'dark' })}
                                >
                                    🌙 Dark
                                </button>
                            </div>
                        </div>

                        <div className="setting-item">
                            <div className="setting-info">
                                <span className="setting-label">Start on boot</span>
                                <span className="setting-value">Launch Juskoe when computer starts</span>
                            </div>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={settings.startOnBoot}
                                    onChange={(e) => setSettings({ ...settings, startOnBoot: e.target.checked })}
                                />
                                <span className="slider"></span>
                            </label>
                        </div>

                        <div className="setting-item">
                            <div className="setting-info">
                                <span className="setting-label">Minimize to tray</span>
                                <span className="setting-value">Keep running in system tray when closed</span>
                            </div>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={settings.minimizeToTray}
                                    onChange={(e) => setSettings({ ...settings, minimizeToTray: e.target.checked })}
                                />
                                <span className="slider"></span>
                            </label>
                        </div>
                    </div>
                );

            case 'account':
                return (
                    <div className="settings-content fade-in">
                        <h2>Account</h2>

                        <div className="account-card">
                            <div className="account-avatar">👤</div>
                            <div className="account-info">
                                <span className="account-name">User</span>
                                <span className="account-email">user@example.com</span>
                            </div>
                            <span className="badge badge-primary">Pro Trial</span>
                        </div>

                        <div className="setting-item">
                            <div className="setting-info">
                                <span className="setting-label">Plan</span>
                                <span className="setting-value">Pro Trial - 14 days remaining</span>
                            </div>
                            <button className="btn btn-primary">Upgrade</button>
                        </div>

                        <div className="setting-item">
                            <div className="setting-info">
                                <span className="setting-label">Sign out</span>
                                <span className="setting-value">Sign out of your account</span>
                            </div>
                            <button className="btn btn-secondary">Sign out</button>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="settings-page fade-in">
            <div className="settings-layout">
                {/* Settings Sidebar */}
                <aside className="settings-sidebar">
                    <div className="settings-section">
                        <span className="settings-section-title">SETTINGS</span>
                        <button
                            className={`settings-nav-item ${activeTab === 'general' ? 'active' : ''}`}
                            onClick={() => setActiveTab('general')}
                        >
                            ⚙️ General
                        </button>
                        <button
                            className={`settings-nav-item ${activeTab === 'system' ? 'active' : ''}`}
                            onClick={() => setActiveTab('system')}
                        >
                            💻 System
                        </button>
                    </div>

                    <div className="settings-section">
                        <span className="settings-section-title">ACCOUNT</span>
                        <button
                            className={`settings-nav-item ${activeTab === 'account' ? 'active' : ''}`}
                            onClick={() => setActiveTab('account')}
                        >
                            👤 Account
                        </button>
                    </div>

                    <div className="settings-footer">
                        <span className="version">Juskoe v1.0.0</span>
                    </div>
                </aside>

                {/* Settings Content */}
                <main className="settings-main">
                    {renderTabContent()}
                </main>
            </div>
        </div>
    );
};

export default SettingsPage;
