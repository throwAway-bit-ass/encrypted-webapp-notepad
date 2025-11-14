class AuthManager {
    constructor() {
        this.setupAuthForms();
    }

    setupAuthForms() {
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
    }

    async handleRegister(e) {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const keys = await cryptoManager.generateUserKeys(password);
            const response = await fetch('/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: username,
                    email: email,
                    password: password,
                    public_key: keys.publicKey,
                    encrypted_private_key: keys.encryptedPrivateKey,
                    encrypted_note_key: keys.encryptedNoteKey,
                    salt: keys.salt,
                    iv: keys.iv
                })
            });

            if (response.ok) {
                window.location.href = '/login';
            } else {
                const error = await response.text();
                showNotification('Registration failed: ' + error, 'error');
            }
            } catch (error) {
                console.error('Registration error:', error);
                showNotification('Registration failed: ' + error.message, 'error');
            }
    }

    async handleLogin(e) {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const userResponse = await fetch(`/api/user/keys/${username}`);
            if (!userResponse.ok) throw new Error('User not found');
            const userData = await userResponse.json();

            await cryptoManager.initializeUser(
                userData.encrypted_private_key,
                userData.salt,
                userData.iv,
                password
            );

            await cryptoManager.decryptAndLoadNoteKey(
                userData.encrypted_note_key
            );

            await cryptoManager.persistSessionKey();

            console.log('CryptoManager initialized, key persisted.');

            const loginResponse = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username, password: password })
            });

            if (loginResponse.ok) {
                console.log("Server login successful.");
                setTimeout(() => {
                    window.location.href = '/notes';
                }, 0);

            } else {
                const errorData = await loginResponse.json();
                cryptoManager.clearAllKeys();
                throw new Error(errorData.error || 'Login failed');
            }

        } catch (error) {
            console.error('Login error:', error);
            cryptoManager.clearAllKeys();
            showNotification('Login failed: ' + error.message, 'error');
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    new AuthManager();
});