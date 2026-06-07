import React, { useState, useEffect, useRef } from 'react';
import './NotesPage.css';

const ipcRenderer = (window as any).require?.('electron')?.ipcRenderer;
const clipboard = (window as any).require?.('electron')?.clipboard;

interface Note {
    id: number;
    text: string;
    tags: string[];
    created_at: string;
}

const NotesPage: React.FC = () => {
    const [notes, setNotes] = useState<Note[]>([]);
    const [noteInput, setNoteInput] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [savedFeedback, setSavedFeedback] = useState('');
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [copiedToast, setCopiedToast] = useState(false);
    const [copiedNoteId, setCopiedNoteId] = useState<number | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea up to 15 lines, then scroll
    const autoResize = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        const lineHeight = 22; // ~22px per line
        const maxHeight = lineHeight * 15; // 15 lines max
        el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
        el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
    };

    useEffect(() => {
        loadNotes();

        if (!ipcRenderer) return;

        // Listen for notes:saved from the pipeline (user said "save to notes")
        const onNotesSaved = () => {
            console.log('[Notes] Voice note saved, refreshing...');
            setSavedFeedback('✓ Voice note saved!');
            setTimeout(() => setSavedFeedback(''), 2500);
            loadNotes();
        };

        // Listen for recording state changes
        const onRecordingStart = () => setIsRecording(true);
        const onRecordingStop = () => setIsRecording(false);
        const onRecordingCancel = () => setIsRecording(false);

        ipcRenderer.on('notes:saved', onNotesSaved);
        ipcRenderer.on('recording:start', onRecordingStart);
        ipcRenderer.on('recording:stop', onRecordingStop);
        ipcRenderer.on('recording:cancel', onRecordingCancel);

        return () => {
            ipcRenderer.removeListener('notes:saved', onNotesSaved);
            ipcRenderer.removeListener('recording:start', onRecordingStart);
            ipcRenderer.removeListener('recording:stop', onRecordingStop);
            ipcRenderer.removeListener('recording:cancel', onRecordingCancel);
        };
    }, []);

    const loadNotes = async () => {
        setIsRefreshing(true);
        if (ipcRenderer) {
            const data = await ipcRenderer.invoke('notes:getAll');
            setNotes(data || []);
        }
        setTimeout(() => setIsRefreshing(false), 500);
    };

    const handleAddNote = async () => {
        if (!noteInput.trim()) return;

        if (ipcRenderer) {
            await ipcRenderer.invoke('notes:add', noteInput.trim(), []);
            await loadNotes();
        }

        setNoteInput('');
        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.overflowY = 'hidden';
        }
    };

    const handleDeleteNote = async (id: number, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (ipcRenderer) {
            await ipcRenderer.invoke('notes:delete', id);
            await loadNotes();
        }
        // Close popup if deleting the selected note
        if (selectedNote && selectedNote.id === id) {
            setSelectedNote(null);
        }
    };

    const handleMicClick = () => {
        if (!ipcRenderer) return;

        if (isRecording) {
            ipcRenderer.send('recording:stop');
            setIsRecording(false);
        } else {
            ipcRenderer.send('voice:trigger', 'notes');
            setIsRecording(true);
        }
    };

    const handleCopy = async (text: string, e?: React.MouseEvent, noteId?: number) => {
        if (e) e.stopPropagation();
        try {
            if (clipboard) {
                clipboard.writeText(text);
            } else {
                await navigator.clipboard.writeText(text);
            }
            setCopiedToast(true);
            if (noteId) setCopiedNoteId(noteId);
            setTimeout(() => { setCopiedToast(false); setCopiedNoteId(null); }, 1500);
        } catch (err) {
            console.error('Copy failed:', err);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <div className="notes-page fade-in">
            {/* Hero Title */}
            <h1 className="notes-hero">For quick thoughts you want to come back to — press <span className="key-text">F9</span></h1>

            {/* Saved Feedback */}
            {savedFeedback && (
                <div className="saved-feedback">{savedFeedback}</div>
            )}

            {/* Copied Toast */}
            {copiedToast && (
                <div className="copied-toast">Copied</div>
            )}

            {/* Voice Input Box */}
            <div className={`voice-input-box ${isRecording ? 'recording' : ''}`}>
                <textarea
                    ref={textareaRef}
                    className="voice-input"
                    placeholder='Type a note or press mic and say "save to notes..."'
                    value={noteInput}
                    onChange={e => { setNoteInput(e.target.value); autoResize(); }}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            handleAddNote();
                        }
                    }}
                    rows={1}
                />
                <button className={`mic-btn ${isRecording ? 'active' : ''}`} onClick={handleMicClick} title={isRecording ? 'Stop recording' : 'Record voice note (say "save to notes...")'}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                </button>
                {noteInput && (
                    <button className="add-btn" onClick={handleAddNote}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Recents Section */}
            <div className="recents-section">
                <div className="recents-header">
                    <span className="recents-title">RECENTS</span>
                    <div className="recents-actions">
                        <button className={`icon-btn ${isRefreshing ? 'loading' : ''}`} onClick={loadNotes} title="Refresh">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                <polyline points="23 4 23 10 17 10" />
                                <polyline points="1 20 1 14 7 14" />
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                            </svg>
                        </button>
                    </div>
                </div>

                {notes.length === 0 ? (
                    <div className="no-notes">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <p>No notes yet. Press the mic and say "save to notes" followed by your note.</p>
                    </div>
                ) : (
                    <div className="notes-cards-grid">
                        {notes.map(note => (
                            <div key={note.id} className="note-card" onClick={() => setSelectedNote(note)}>
                                <div className="note-card-text">{note.text}</div>
                                <div className="note-card-footer">
                                    <span className="note-card-date">{formatDate(note.created_at)}</span>
                                    <div className="note-card-actions">
                                        <button className="note-card-copy" onClick={(e) => handleCopy(note.text, e, note.id)} title="Copy">
                                            {copiedNoteId === note.id ? (
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14" className="tick-animate">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            ) : (
                                                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                                                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                                </svg>
                                            )}
                                        </button>
                                        <button className="note-card-delete" onClick={(e) => handleDeleteNote(note.id, e)} title="Delete">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                                <polyline points="3 6 5 6 21 6" />
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Note Popup Modal */}
            {selectedNote && (
                <div className="note-modal-overlay" onClick={() => setSelectedNote(null)}>
                    <div className="note-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="note-modal-header">
                            <span className="note-modal-date">{formatDate(selectedNote.created_at)}</span>
                            <button className="note-modal-close" onClick={() => setSelectedNote(null)}>
                                <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                        <div className="note-modal-body">
                            {selectedNote.text}
                        </div>
                        <div className="note-modal-footer">
                            <button className="note-modal-copy" onClick={() => handleCopy(selectedNote.text)}>
                                {copiedToast ? (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="15" height="15" className="tick-animate">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                ) : (
                                    <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                                        <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                        <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                    </svg>
                                )}
                                {copiedToast ? 'Copied!' : 'Copy to Clipboard'}
                            </button>
                            <button className="note-modal-delete" onClick={(e) => { handleDeleteNote(selectedNote.id, e); setSelectedNote(null); }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotesPage;
