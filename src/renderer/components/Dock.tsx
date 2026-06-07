import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import './Dock.css';

interface DockProps {
    onOpenSettings: () => void;
}

const Dock: React.FC<DockProps> = ({ onOpenSettings }) => {
    const location = useLocation();

    return (
        <div className="dock-wrapper">
            <div className="dock-panel">
                {/* Home */}
                <NavLink
                    to="/"
                    className={`dock-item ${location.pathname === '/' ? 'active' : ''}`}
                    title="Home"
                >
                    <span className="dock-tooltip">Home</span>
                    <svg className="dock-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" rx="1" />
                        <rect x="14" y="3" width="7" height="7" rx="1" />
                        <rect x="14" y="14" width="7" height="7" rx="1" />
                        <rect x="3" y="14" width="7" height="7" rx="1" />
                    </svg>
                </NavLink>

                {/* Dictionary */}
                <NavLink
                    to="/dictionary"
                    className={({ isActive }) => `dock-item ${isActive ? 'active' : ''}`}
                    title="Dictionary"
                >
                    <span className="dock-tooltip">Dictionary</span>
                    <svg className="dock-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                        <line x1="9" y1="8" x2="16" y2="8" />
                        <line x1="9" y1="12" x2="14" y2="12" />
                    </svg>
                </NavLink>

                {/* Snippets */}
                <NavLink
                    to="/snippets"
                    className={({ isActive }) => `dock-item ${isActive ? 'active' : ''}`}
                    title="Snippets"
                >
                    <span className="dock-tooltip">Snippets</span>
                    <svg className="dock-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="16 18 22 12 16 6" />
                        <polyline points="8 6 2 12 8 18" />
                        <line x1="14" y1="4" x2="10" y2="20" />
                    </svg>
                </NavLink>

                {/* Notes */}
                <NavLink
                    to="/notes"
                    className={({ isActive }) => `dock-item ${isActive ? 'active' : ''}`}
                    title="Notes"
                >
                    <span className="dock-tooltip">Notes</span>
                    <svg className="dock-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="8" y1="13" x2="16" y2="13" />
                        <line x1="8" y1="17" x2="12" y2="17" />
                    </svg>
                </NavLink>

                {/* Divider */}
                <div className="dock-divider" />

                {/* Settings */}
                <button
                    className="dock-item settings-btn"
                    onClick={onOpenSettings}
                    title="Settings"
                >
                    <span className="dock-tooltip">Settings</span>
                    <svg className="dock-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default Dock;
