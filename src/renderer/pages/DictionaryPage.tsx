import React, { useState, useEffect, useRef } from 'react';
import './DictionaryPage.css';

const ipcRenderer = (window as any).require?.('electron')?.ipcRenderer;

interface DictEntry {
    id: number;
    word: string;
    corrections: string[];
    created_at?: string;
}

const DictionaryPage: React.FC = () => {
    const [entries, setEntries] = useState<DictEntry[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editingEntry, setEditingEntry] = useState<DictEntry | null>(null);
    const [formWord, setFormWord] = useState('');
    const [formCorrection, setFormCorrection] = useState('');
    const [showTip, setShowTip] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadEntries();
        // Load tip dismiss state
        if (ipcRenderer) {
            ipcRenderer.invoke('settings:get', 'dictionaryTipDismissed').then((val: string) => {
                if (val === 'true') setShowTip(false);
            });
        }
    }, []);

    const loadEntries = async () => {
        setIsRefreshing(true);
        if (ipcRenderer) {
            const data = await ipcRenderer.invoke('dictionary:getAll');
            setEntries(data || []);
        }
        setTimeout(() => setIsRefreshing(false), 500);
    };

    const handleSave = async () => {
        if (!formWord.trim()) return;

        const word = formWord.trim();
        const correction = formCorrection.trim();
        const corrections = correction ? [correction] : [];

        if (editingEntry) {
            if (ipcRenderer) {
                await ipcRenderer.invoke('dictionary:delete', editingEntry.id);
                await ipcRenderer.invoke('dictionary:add', word, corrections);
            }
        } else {
            if (ipcRenderer) {
                await ipcRenderer.invoke('dictionary:add', word, corrections);
            }
        }

        await loadEntries();
        closeModal();
    };

    const handleDelete = async (id: number) => {
        if (ipcRenderer) {
            await ipcRenderer.invoke('dictionary:delete', id);
            await loadEntries();
        }
    };

    const openAdd = () => {
        setEditingEntry(null);
        setFormWord('');
        setFormCorrection('');
        setShowModal(true);
    };

    const openEdit = (entry: DictEntry) => {
        setEditingEntry(entry);
        setFormWord(entry.word);
        setFormCorrection(entry.corrections?.[0] || '');
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingEntry(null);
        setFormWord('');
        setFormCorrection('');
    };

    const filteredEntries = entries.filter(entry => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return entry.word.toLowerCase().includes(q) ||
            entry.corrections?.some(c => c.toLowerCase().includes(q));
    });

    return (
        <div className="dictionary-page fade-in">
            {/* Header */}
            <div className="page-header">
                <h1 className="page-title">Dictionary</h1>
                <div className="header-actions">
                    {/* Expandable Search */}
                    <div className={`search-expandable ${searchOpen ? 'open' : ''}`}>
                        {searchOpen ? (
                            <div className="search-bar-inline">
                                <svg className="search-icon-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    className="search-input-inline"
                                    placeholder="Search words..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onBlur={() => { if (!searchQuery) setSearchOpen(false); }}
                                    autoFocus
                                />
                                <button className="search-close-btn" onClick={() => { setSearchQuery(''); setSearchOpen(false); }}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>
                        ) : (
                            <button className="icon-btn" onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); }} title="Search">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                            </button>
                        )}
                    </div>
                    {/* Refresh */}
                    <button className={`icon-btn ${isRefreshing ? 'loading' : ''}`} onClick={loadEntries} title="Refresh">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                            <polyline points="23 4 23 10 17 10" />
                            <polyline points="1 20 1 14 7 14" />
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                        </svg>
                    </button>
                    {/* Add */}
                    <button className="btn-add" onClick={openAdd}>Add new word</button>
                </div>
            </div>

            {/* Tip Box */}
            {showTip && (
                <div className="tip-box">
                    <button className="tip-close" onClick={() => {
                        setShowTip(false);
                        if (ipcRenderer) ipcRenderer.invoke('settings:set', 'dictionaryTipDismissed', 'true');
                    }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                    <h2 className="tip-title">Your personal dictionary.</h2>
                    <p className="tip-text">
                        Add words Juskoe might mishear — names, technical terms, abbreviations — and tell it exactly what to write instead.
                    </p>
                    <div className="tip-pills">
                        <span className="tip-pill">Aishwanth</span>
                        <span className="tip-pill">ASAP</span>
                        <span className="tip-pill">Bengaluru</span>
                        <span className="tip-pill">iPhone</span>
                    </div>
                    <button className="btn-dark" onClick={openAdd}>Add new word</button>
                </div>
            )}

            {/* Dictionary List */}
            {filteredEntries.length === 0 ? (
                <div className="empty-list">
                    <p>{searchQuery ? 'No matching entries found.' : 'No dictionary entries yet. Add some words!'}</p>
                </div>
            ) : (
                <div className="dictionary-list">
                    {filteredEntries.map(entry => (
                        <div key={entry.id} className="dictionary-item" onClick={() => openEdit(entry)}>
                            <span className="entry-word">
                                {entry.word} {entry.corrections?.[0] ? <><span className="entry-arrow">→</span> {entry.corrections[0]}</> : null}
                            </span>
                            <button
                                className="entry-delete"
                                onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {editingEntry ? 'Edit Word' : 'Add New Word'}
                            </h3>
                            <button className="modal-close" onClick={closeModal}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">When I say</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g., BTW"
                                    value={formWord}
                                    onChange={e => setFormWord(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Write this instead (optional)</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g., By the way"
                                    value={formCorrection}
                                    onChange={e => setFormCorrection(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-cancel" onClick={closeModal}>Cancel</button>
                            <button className="btn-save" onClick={handleSave}>
                                {editingEntry ? 'Save Changes' : 'Add Word'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DictionaryPage;
