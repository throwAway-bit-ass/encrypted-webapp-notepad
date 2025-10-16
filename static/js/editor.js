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
            const tags = note.encrypted_tags ? await cryptoManager.decryptData(note.encrypted_tags, note.iv) : '';

            document.getElementById('noteTitle').value = title;
            document.getElementById('noteContent').value = content;
            document.getElementById('noteTags').value = tags;
        } catch (error) {
            console.error('Error loading note:', error);
            this.showError('Error loading note: ' + error.message);
        }
    }

    setupEventListeners() {
        console.log('EditorManager: Setting up event listeners');

        // Auto-save on input
        const inputs = ['noteTitle', 'noteContent', 'noteTags'];
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
            // Let's try to find any button that might be the save button
            const buttons = document.querySelectorAll('button');
            buttons.forEach(button => {
                if (button.textContent.trim() === 'Save') {
                    console.log('EditorManager: Found save button by text content');
                    button.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.saveNote(true);
                    });
                }
            });
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

        // Fallback: any primary button with "Save" text
        const buttons = document.querySelectorAll('.btn-primary');
        for (const button of buttons) {
            if (button.textContent.includes('Save')) {
                return button;
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

        try {
            await cryptoManager.ensureSessionKey();
        } catch (error) {
            console.error('EditorManager: Error ensuring session key:', error);
            this.showError('Encryption error: ' + error.message);
            return;
    }

        const title = document.getElementById('noteTitle').value || 'Untitled';
        const content = document.getElementById('noteContent').value;
        const tags = document.getElementById('noteTags').value;

        // Basic validation
        if (!title.trim() && !content.trim()) {
            this.showError('Note cannot be empty');
            return;
        }

        try {
            console.log('EditorManager: Encrypting data...');
            // Encrypt all data before sending to server
            const encryptedTitle = await cryptoManager.encryptData(title);
            const encryptedContent = await cryptoManager.encryptData(content);
            const encryptedTags = tags ? await cryptoManager.encryptData(tags) : null;

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
                    encrypted_tags: encryptedTags ? encryptedTags.encrypted : null,
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
                    this.showSuccess('Note saved');
                }
            } else {
                const errorText = await response.text();
                console.error('EditorManager: Server error:', errorText);
                throw new Error('Failed to save note: ' + response.status);
            }
        } catch (error) {
            console.error('Error saving note:', error);
            this.showError('Error saving note: ' + error.message);
        }
    }

    showError(message) {
        alert('Error: ' + message);
    }

    showSuccess(message) {
        // Simple success notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            z-index: 1000;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 3000);
    }
}

// Global editor instance
let editorManager;

// Initialize based on page type
document.addEventListener('DOMContentLoaded', function() {
    console.log('Editor: DOM loaded');

    // Check if we're on an editor page
    const noteId = getNoteIdFromUrl();

    if (document.getElementById('noteTitle') && document.getElementById('noteContent')) {
        console.log('Editor: Editor page detected');
        editorManager = new EditorManager(noteId);
        editorManager.init();
    }
});

function getNoteIdFromUrl() {
    // Extract note ID from URL for edit pages
    const path = window.location.pathname;
    if (path.startsWith('/edit/')) {
        const parts = path.split('/');
        return parts[2] ? parseInt(parts[2]) : null;
    }
    return null;
}