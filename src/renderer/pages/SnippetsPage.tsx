import React, { useState, useEffect, useRef } from 'react';
import './SnippetsPage.css';

const ipcRenderer = (window as any).require?.('electron')?.ipcRenderer;

interface Snippet {
    id: number;
    key: string;
    content: string;
}

const SnippetsPage: React.FC = () => {
    const [snippets, setSnippets] = useState<Snippet[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);
    const [formKey, setFormKey] = useState('');
    const [formContent, setFormContent] = useState('');
    const [showTip, setShowTip] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadSnippets();
        // Load tip dismiss state
        if (ipcRenderer) {
            ipcRenderer.invoke('settings:get', 'snippetsTipDismissed').then((val: string) => {
                if (val === 'true') setShowTip(false);
            });
        }
    }, []);

    const loadSnippets = async () => {
        setIsRefreshing(true);
        if (ipcRenderer) {
            const data = await ipcRenderer.invoke('snippets:getAll');
            setSnippets(data || []);
        }
        setTimeout(() => setIsRefreshing(false), 500);
    };

    const handleSave = async () => {
        if (!formKey.trim() || !formContent.trim()) return;

        if (editingSnippet) {
            if (ipcRenderer) {
                await ipcRenderer.invoke('snippets:update', editingSnippet.id, formKey.trim(), formKey.trim(), formContent.trim(), 'personal');
            }
        } else {
            if (ipcRenderer) {
                await ipcRenderer.invoke('snippets:add', formKey.trim(), formKey.trim(), formContent.trim(), 'personal');
            }
        }

        await loadSnippets();
        closeModal();
    };

    const handleDelete = async (id: number) => {
        if (ipcRenderer) {
            await ipcRenderer.invoke('snippets:delete', id);
            await loadSnippets();
        }
    };

    const openAdd = () => {
        setEditingSnippet(null);
        setFormKey('');
        setFormContent('');
        setShowModal(true);
    };

    const openEdit = (snippet: Snippet) => {
        setEditingSnippet(snippet);
        setFormKey(snippet.key);
        setFormContent(snippet.content);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingSnippet(null);
        setFormKey('');
        setFormContent('');
    };

    const filteredSnippets = snippets.filter(snippet => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return snippet.key.toLowerCase().includes(q) ||
            snippet.content.toLowerCase().includes(q);
    });

    return (
        <div className="snippets-page fade-in">
            {/* Header */}
            <div className="page-header">
                <h1 className="page-title">Snippets</h1>
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
                                    placeholder="Search snippets..."
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
                    <button className={`icon-btn ${isRefreshing ? 'loading' : ''}`} onClick={loadSnippets} title="Refresh">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                            <polyline points="23 4 23 10 17 10" />
                            <polyline points="1 20 1 14 7 14" />
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                        </svg>
                    </button>
                    {/* Add */}
                    <button className="btn-add" onClick={openAdd}>Add new snippet</button>
                </div>
            </div>

            {/* Tip Box */}
            {showTip && (
                <div className="tip-box">
                    <button className="tip-close" onClick={() => {
                        setShowTip(false);
                        if (ipcRenderer) ipcRenderer.invoke('settings:set', 'snippetsTipDismissed', 'true');
                    }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                    <h2 className="tip-title">Say it once, use it everywhere.</h2>
                    <p className="tip-text">
                        Save text you use all the time — emails, links, addresses, intros — and let Juskoe paste them instantly when you speak the trigger word.
                    </p>
                    <div className="tip-examples">
                        <div className="tip-example-row">
                            <span className="example-key">my github</span>
                            <span className="example-arrow">→</span>
                            <span className="example-value">https://github.com/your-username</span>
                        </div>
                        <div className="tip-example-row">
                            <span className="example-key">my email</span>
                            <span className="example-arrow">→</span>
                            <span className="example-value">yourname@example.com</span>
                        </div>
                    </div>
                    <button className="btn-dark" onClick={openAdd}>Add new snippet</button>
                </div>
            )}

            {/* Snippets List */}
            {filteredSnippets.length === 0 ? (
                <div className="empty-list">
                    <p>{searchQuery ? 'No matching snippets found.' : 'No snippets yet. Add some shortcuts!'}</p>
                </div>
            ) : (
                <div className="snippets-list">
                    {filteredSnippets.map(snippet => (
                        <div key={snippet.id} className="snippet-item" onClick={() => openEdit(snippet)}>
                            <span className="snippet-text">
                                {snippet.key} <span className="snippet-arrow">→</span> {snippet.content}
                            </span>
                            <button
                                className="snippet-delete"
                                onClick={(e) => { e.stopPropagation(); handleDelete(snippet.id); }}
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
                                {editingSnippet ? 'Edit Snippet' : 'Add New Snippet'}
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
                                    placeholder="e.g., my email"
                                    value={formKey}
                                    onChange={e => setFormKey(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Expand to</label>
                                <textarea
                                    className="form-textarea"
                                    placeholder="e.g., hello@example.com"
                                    value={formContent}
                                    onChange={e => setFormContent(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-cancel" onClick={closeModal}>Cancel</button>
                            <button className="btn-save" onClick={handleSave}>
                                {editingSnippet ? 'Save Changes' : 'Add Snippet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SnippetsPage;
