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
            await cryptoManager.ensureSessionKey();
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

        // FIX: Removed 'ensureSessionKey' block.
        // The key is loaded at login. If it's not here, saving should fail.

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
            // Encrypt all data before sending to server
            const encryptedTitle = await cryptoManager.encryptData(title);
            const encryptedContent = await cryptoManager.encryptData(content);
            // FIX: Removed tags logic

            console.log('EditorManager: Sending to server...');
            const url = this.isNewNote ? '/api/notes' : `/api/notes/${this.noteId}`;
            const method = this.isNewNote ? 'POST' : 'PUT';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    encrypted_title: encryptedTitle.encrypted,
                    encrypted_content: encryptedContent.encrypted,
                    // FIX: Removed 'encrypted_tags'
                    iv: encryptedTitle.iv
                })
            });

            console.log('EditorManager: Server response status:', response.status);

            if (response.ok) {
                console.log('EditorManager: Save successful!');
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
document.addEventListener('DOMContentLoaded', function() {
    console.log('Editor: DOM loaded');

    // FIX: Check if we're on an editor page by seeing if NOTE_ID is defined
    if (typeof NOTE_ID !== 'undefined') {
        console.log('Editor: Editor page detected');
        editorManager = new EditorManager(NOTE_ID);
        editorManager.init();
    }
});

// FIX: Removed getNoteIdFromUrl() as it's no longer needed