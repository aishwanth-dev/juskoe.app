import React from 'react';
import './Titlebar.css';
import logo from '../assets/juskoe_logo.png';

// Get Electron IPC
const ipcRenderer = (window as any).require?.('electron')?.ipcRenderer;

const Titlebar: React.FC = () => {
    const handleMinimize = () => {
        ipcRenderer?.send('window:minimize');
    };

    const handleMaximize = () => {
        ipcRenderer?.send('window:maximize');
    };

    const handleClose = () => {
        ipcRenderer?.send('window:close');
    };

    return (
        <header className="titlebar">
            {/* Drag Area - Left */}
            <div className="titlebar-drag" />

            {/* Centered Brand */}
            <div className="titlebar-brand">
                <img src={logo} alt="Juskoe" className="titlebar-logo" />
                <span className="titlebar-name">
                    <span className="titlebar-name-jus">jus</span>
                    <span className="titlebar-name-koe">koe.</span>
                </span>
            </div>

            {/* Window Controls */}
            <div className="window-controls">
                <button className="window-btn" onClick={handleMinimize} title="Minimize">
                    <svg viewBox="0 0 12 12" width="12" height="12">
                        <rect fill="currentColor" x="2" y="5.5" width="8" height="1" />
                    </svg>
                </button>
                <button className="window-btn" onClick={handleMaximize} title="Maximize">
                    <svg viewBox="0 0 12 12" width="12" height="12">
                        <rect stroke="currentColor" strokeWidth="1" fill="none" x="2" y="2" width="8" height="8" />
                    </svg>
                </button>
                <button className="window-btn close" onClick={handleClose} title="Close">
                    <svg viewBox="0 0 12 12" width="12" height="12">
                        <path stroke="currentColor" strokeWidth="1.2" d="M3 3l6 6M9 3l-6 6" />
                    </svg>
                </button>
            </div>
        </header>
    );
};

export default Titlebar;
