// Editor functionality with encryption support
class EditorManager {
    constructor(noteId = null) {
        this.noteId = noteId;
        this.isNewNote = noteId === null;
        this.autoSaveTimeout = null;
    }

    init() {
        console.log('EditorManager: Initializing editor');
        if (!this.isNewNote) {
            this.loadEncryptedNote();
        }
        this.setupEventListeners();
    }

    async loadEncryptedNote() {
        try {
            // 'ensureSessionKey' is now called at init,
            // but we check sessionKey just in case.
            if (!cryptoManager.sessionKey) {
                await cryptoManager.ensureSessionKey();
            }
            // ... (rest of function is correct)
            const response = await fetch(`/api/notes/${this.noteId}`);
            if (!response.ok) {
                throw new Error('Failed to load note');
            }

            const note = await response.json();

            // Decrypt the note data
            const title = await cryptoManager.decryptData(note.encrypted_title, note.iv);
            const content = await cryptoManager.decryptData(note.encrypted_content, note.iv);
            // FIX: Removed tags logic

            document.getElementById('noteTitle').value = title;
            document.getElementById('noteContent').value = content;
            // FIX: Removed tags logic
        } catch (error) {
            console.error('Error loading note:', error);
            // FIX: Use global notification function
            showNotification('Error loading note: ' + error.message, 'error');
        }
    }

    setupEventListeners() {
        console.log('EditorManager: Setting up event listeners');

        // Auto-save on input
        // FIX: Removed 'noteTags' from inputs
        const inputs = ['noteTitle', 'noteContent'];
        inputs.forEach(inputId => {
            const element = document.getElementById(inputId);
            if (element) {
                element.addEventListener('input', () => this.scheduleAutoSave());
            }
        });

        // Manual save button - FIXED VERSION
        const saveButton = this.getSaveButton();
        if (saveButton) {
            console.log('EditorManager: Save button found, adding event listener');
            saveButton.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('EditorManager: Save button clicked');
                this.saveNote(true);
            });
        } else {
            console.error('EditorManager: Save button not found!');
        }
    }

    getSaveButton() {
        // First try by ID
        const buttonById = document.getElementById('saveButton');
        if (buttonById) {
            return buttonById;
        }

        // Try the primary button in editor actions
        const editorActions = document.querySelector('.editor-actions');
        if (editorActions) {
            const primaryButton = editorActions.querySelector('.btn-primary');
            if (primaryButton && primaryButton.textContent.includes('Save')) {
                return primaryButton;
            }
        }
        return null;
    }

    scheduleAutoSave() {
        clearTimeout(this.autoSaveTimeout);
        this.autoSaveTimeout = setTimeout(() => {
            this.saveNote(false);
        }, 2000);
    }

    async saveNote(shouldRedirect = true) {
        console.log('EditorManager: saveNote called, redirect:', shouldRedirect);

        if (!cryptoManager.sessionKey) {
            console.error('EditorManager: No session key!');
            showNotification('Encryption error: No session key. Please log in.', 'error');
            return;
        }

        const title = document.getElementById('noteTitle').value || 'Untitled';
        const content = document.getElementById('noteContent').value;
        // FIX: Removed tags logic

        // Basic validation
        if (!title.trim() && !content.trim()) {
            // FIX: Use global notification function
            showNotification('Note cannot be empty', 'error');
            return;
        }

        try {
            console.log('EditorManager: Encrypting data...');

            // FIX: Generate ONE IV for the whole note
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const ivBase64 = cryptoManager.arrayBufferToBase64(iv);

            // FIX: Pass the same IV to both encryption calls
            const encryptedTitle = await cryptoManager.encryptData(title, iv);
            const encryptedContent = await cryptoManager.encryptData(content, iv);

            console.log('EditorManager: Sending to server...');
            const url = this.isNewNote ? '/api/notes' : `/api/notes/${this.noteId}`;
            const method = this.isNewNote ? 'POST' : 'PUT';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    encrypted_title: encryptedTitle,
                    encrypted_content: encryptedContent,
                    iv: ivBase64 // Send the single, correct IV
                })
            });

            console.log('EditorManager: Server response status:', response.status);

            if (response.ok) {
                console.log('EditorManager: Save successful!');

                // FIX: Always read the response and update state
                // const savedNote = await response.json();

                // --- FIX: Handle new note state ---
                if (this.isNewNote) {
                    const newNote = await response.json();
                    this.noteId = newNote.id;
                    this.isNewNote = false;
                    console.log(`EditorManager: State updated. New Note ID: ${this.noteId}`);

                    // Update the URL in the browser
                    const newUrl = `/edit/${this.noteId}`;
                    window.history.replaceState({ path: newUrl }, '', newUrl);
                }
                // --- End of fix ---

                if (shouldRedirect) {
                    console.log('EditorManager: Redirecting to /notes');
                    window.location.href = '/notes';
                } else {
                    // FIX: Use global notification function
                    showNotification('Note saved', 'success');
                }
            } else {
                const errorText = await response.text();
                console.error('EditorManager: Server error:', errorText);
                throw new Error('Failed to save note: ' + response.status);
            }
        } catch (error) {
            console.error('Error saving note:', error);
            // FIX: Use global notification function
            showNotification('Error saving note: ' + error.message, 'error');
        }
    }

    // FIX: Removed local showError and showSuccess, will use global showNotification
}

// Global editor instance
let editorManager;

// Initialize based on page type
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Editor: DOM loaded');

    // FIX: Re-added ensureSessionKey to load from sessionStorage
    try {
        if (typeof cryptoManager !== 'undefined') {
            await cryptoManager.ensureSessionKey();
            console.log('Editor: Session key ensured');
        } else {
            console.error('Editor: cryptoManager not defined');
        }
    } catch (error) {
        console.error('Editor: Error ensuring session key:', error);
        alert(error.message);
        window.location.href = '/logout';
        return; // Do not initialize editor if key fails
    }

    // Check if we're on an editor page
    if (typeof NOTE_ID !== 'undefined') {
        console.log('Editor: Editor page detected');
        editorManager = new EditorManager(NOTE_ID);
        editorManager.init();
    }
});

// FIX: Removed getNoteIdFromUrl() as it's no longer needed