document.addEventListener('DOMContentLoaded', async function() {
    try {
        if (typeof cryptoManager !== 'undefined') {
            await cryptoManager.ensureSessionKey();
        } else {
            console.error('Notes: cryptoManager not defined');
        }
    } catch (error) {
        console.error('Notes: Error ensuring session key:', error);
        showNotification(error.message, 'error')
        window.location.href = '/logout';
        return;
    }

    await loadNotes();
    setupSearch();
});

async function loadNotes() {
    try {
        if (typeof cryptoManager === 'undefined' || !cryptoManager.sessionKey) {
            throw new Error('Session key not initialized. Please log in again.');
        }

        const response = await fetch('/api/notes');

        if (!response.ok) {
            throw new Error('Failed to load notes: ' + response.status);
        }

        const notes = await response.json();
        await displayEncryptedNotes(notes);
    } catch (error) {
        console.error('Error loading notes:', error);
        showNotification('Failed to load notes: ' + error.message, 'error');
    }
}

async function displayEncryptedNotes(notes) {
    const grid = document.getElementById('notesGrid');
    grid.innerHTML = '';

    if (notes.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <h3>No notes yet</h3>
                <p>Create your first note to get started!</p>
                <a href="/create" class="btn btn-primary">Create Note</a>
            </div>
        `;
        return;
    }

    for (const note of notes) {
        try {

            if (typeof cryptoManager === 'undefined') {
                throw new Error('cryptoManager is not defined');
            }

            const title = await cryptoManager.decryptData(note.encrypted_title, note.iv);
            const content = await cryptoManager.decryptData(note.encrypted_content, note.iv);

            const noteElement = createNoteElement({
                ...note,
                title,
                content
            });
            grid.appendChild(noteElement);
        } catch (error) {
            console.error('Error decrypting note:', error);

            const noteElement = createNoteElement({
                ...note,
                title: '[Encrypted - Decryption Failed]',
                content: 'Unable to decrypt this note. Please check your encryption setup.',
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

        if (title.includes(searchTerm) || content.includes(searchTerm)) {
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
                await loadNotes();
                showNotification('Note deleted successfully', 'success');
            } else {
                throw new Error('Failed to delete note');
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('Error deleting note', 'error');
        }
    }
}

