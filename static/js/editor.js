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
            if (!cryptoManager.sessionKey) {
                await cryptoManager.ensureSessionKey();
            }
            const response = await fetch(`/api/notes/${this.noteId}`);
            if (!response.ok) {
                throw new Error('Failed to load note');
            }

            const note = await response.json();

            const title = await cryptoManager.decryptData(note.encrypted_title, note.iv);
            const content = await cryptoManager.decryptData(note.encrypted_content, note.iv);

            document.getElementById('noteTitle').value = title;
            document.getElementById('noteContent').value = content;
        } catch (error) {
            console.error('Error loading note:', error);
            showNotification('Error loading note: ' + error.message, 'error');
        }
    }

    setupEventListeners() {
        console.log('EditorManager: Setting up event listeners');

        const inputs = ['noteTitle', 'noteContent'];
        inputs.forEach(inputId => {
            const element = document.getElementById(inputId);
            if (element) {
                element.addEventListener('input', () => this.scheduleAutoSave());
            }
        });

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
        return document.getElementById('saveButton');
    }

    scheduleAutoSave() {
        clearTimeout(this.autoSaveTimeout);
        this.autoSaveTimeout = setTimeout(() => {
            this.saveNote(false);
        }, 60000);
    }

    async saveNote(shouldRedirect = true) {
        if (!cryptoManager.sessionKey) {
            console.error('EditorManager: No session key!');
            showNotification('Encryption error: No session key. Please log in.', 'error');
            return;
        }

        const title = document.getElementById('noteTitle').value || 'Untitled';
        const content = document.getElementById('noteContent').value;

        try {
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const ivBase64 = cryptoManager.arrayBufferToBase64(iv);

            const encryptedTitle = await cryptoManager.encryptData(title, iv);
            const encryptedContent = await cryptoManager.encryptData(content, iv);

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
                    iv: ivBase64
                })
            });

            if (response.ok) {
                if (this.isNewNote) {
                    const newNote = await response.json();
                    this.noteId = newNote.id;
                    this.isNewNote = false;

                    const newUrl = `/edit/${this.noteId}`;
                    window.history.replaceState({ path: newUrl }, '', newUrl);
                }

                if (shouldRedirect) {
                    window.location.href = '/notes';
                } else {
                    showNotification('Note saved', 'success');
                }
            } else {
                const errorText = await response.text();
                console.error('EditorManager: Server error:', errorText);
                throw new Error('Failed to save note: ' + response.status);
            }
        } catch (error) {
            console.error('Error saving note:', error);
            showNotification('Error saving note: ' + error.message, 'error');
        }
    }

}

let editorManager;

document.addEventListener('DOMContentLoaded', async function() {

    try {
        if (typeof cryptoManager !== 'undefined') {
            await cryptoManager.ensureSessionKey();
        } else {
            console.error('Editor: cryptoManager not defined');
        }
    } catch (error) {
        console.error('Editor: Error ensuring session key:', error);
        showNotification(error.message, 'error')
        window.location.href = '/logout';
        return;
    }

    if (typeof NOTE_ID !== 'undefined') {
        editorManager = new EditorManager(NOTE_ID);
        editorManager.init();
    }
});

