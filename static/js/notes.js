// Notes page functionality with encryption support
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Notes: DOM loaded, initializing notes page');

    // Ensure session key is available before loading notes
    try {
        if (typeof cryptoManager !== 'undefined') {
            await cryptoManager.ensureSessionKey();
            console.log('Notes: Session key ensured');
        } else {
            console.error('Notes: cryptoManager not defined');
        }
    } catch (error) {
        console.error('Notes: Error ensuring session key:', error);
    }

    await loadNotes();
    setupSearch();
});

async function loadNotes() {
    console.log('Notes: Loading notes from server...');
    try {
        // Check if cryptoManager and session key are available
        if (typeof cryptoManager === 'undefined') {
            throw new Error('cryptoManager is not defined');
        }

        if (!cryptoManager.sessionKey) {
            console.log('Notes: No session key, trying to load from storage...');
            const loaded = await cryptoManager.loadSessionKey();
            if (!loaded) {
                throw new Error('Session key not initialized. Please log in again.');
            }
        }

        const response = await fetch('/api/notes');
        console.log('Notes: Server response status:', response.status);

        if (!response.ok) {
            throw new Error('Failed to load notes: ' + response.status);
        }

        const notes = await response.json();
        console.log('Notes: Received notes from server:', notes);
        await displayEncryptedNotes(notes);
    } catch (error) {
        console.error('Error loading notes:', error);
        showError('Failed to load notes: ' + error.message);
    }
}

async function displayEncryptedNotes(notes) {
    const grid = document.getElementById('notesGrid');
    grid.innerHTML = '';

    if (notes.length === 0) {
        console.log('Notes: No notes found');
        grid.innerHTML = `
            <div class="empty-state">
                <h3>No notes yet</h3>
                <p>Create your first note to get started!</p>
                <a href="/create" class="btn btn-primary">Create Note</a>
            </div>
        `;
        return;
    }

    console.log('Notes: Displaying', notes.length, 'notes');

    let successfulDecryptions = 0;
    let failedDecryptions = 0;

    // Decrypt and display each note
    for (const note of notes) {
        try {
            console.log('Notes: Processing note', note.id);

            // Check if cryptoManager is available
            if (typeof cryptoManager === 'undefined') {
                throw new Error('cryptoManager is not defined');
            }

            // Decrypt the note data
            const title = await cryptoManager.decryptData(note.encrypted_title, note.iv);
            const content = await cryptoManager.decryptData(note.encrypted_content, note.iv);
            const tags = note.encrypted_tags ? await cryptoManager.decryptData(note.encrypted_tags, note.iv) : '';

            console.log('Notes: Note decrypted successfully');
            successfulDecryptions++;

            const noteElement = createNoteElement({
                ...note,
                title,
                content,
                tags
            });
            grid.appendChild(noteElement);
        } catch (error) {
            console.error('Error decrypting note:', error);
            failedDecryptions++;

            // Show encrypted placeholder if decryption fails
            const noteElement = createNoteElement({
                ...note,
                title: '[Encrypted - Decryption Failed]',
                content: 'Unable to decrypt this note. Please check your encryption setup.',
                tags: ''
            });
            grid.appendChild(noteElement);
        }
    }
}

function createNoteElement(note) {
    const div = document.createElement('div');
    div.className = 'note-card';
    div.innerHTML = `
        <h3 class="note-title">${escapeHtml(note.title)}</h3>
        <div class="note-content">${escapeHtml(note.content.substring(0, 150))}${note.content.length > 150 ? '...' : ''}</div>
        <div class="note-meta">
            <small>Updated: ${formatDate(note.updated_at)}</small>
            ${note.tags ? `<div class="note-tags">${formatTags(note.tags)}</div>` : ''}
        </div>
        <div class="note-actions">
            <a href="/edit/${note.id}" class="btn btn-small">Edit</a>
            <button onclick="deleteNote(${note.id})" class="btn btn-small btn-danger">Delete</button>
        </div>
    `;
    return div;
}

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            filterNotes(searchTerm);
        });
    }
}

function filterNotes(searchTerm) {
    const notes = document.querySelectorAll('.note-card');

    notes.forEach(note => {
        const title = note.querySelector('.note-title').textContent.toLowerCase();
        const content = note.querySelector('.note-content').textContent.toLowerCase();
        const tags = note.querySelector('.note-tags') ? note.querySelector('.note-tags').textContent.toLowerCase() : '';

        if (title.includes(searchTerm) || content.includes(searchTerm) || tags.includes(searchTerm)) {
            note.style.display = 'block';
        } else {
            note.style.display = 'none';
        }
    });
}

async function deleteNote(noteId) {
    if (confirm('Are you sure you want to delete this note?')) {
        try {
            const response = await fetch(`/api/notes/${noteId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await loadNotes(); // Reload the notes list
                showSuccess('Note deleted successfully');
            } else {
                throw new Error('Failed to delete note');
            }
        } catch (error) {
            console.error('Error:', error);
            showError('Error deleting note');
        }
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatTags(tagsString) {
    if (!tagsString) return '';

    return tagsString.split(',').map(tag => {
        return `<span class="tag">${escapeHtml(tag.trim())}</span>`;
    }).join('');
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showError(message) {
    showNotification(message, 'error');
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showNotification(message, type) {
    // Remove existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 4px;
        color: white;
        z-index: 1000;
        font-weight: bold;
        transition: all 0.3s ease;
    `;

    if (type === 'error') {
        notification.style.background = '#dc3545';
    } else {
        notification.style.background = '#28a745';
    }

    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100px)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}