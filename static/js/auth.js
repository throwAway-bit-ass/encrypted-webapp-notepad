// Authentication manager
class AuthManager {
    constructor() {
        this.setupAuthForms();
    }

    setupAuthForms() {
        // Registration form
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        // Login form
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
                    // FIX: Send the new encrypted note key
                    encrypted_note_key: keys.encryptedNoteKey,
                    salt: keys.salt,
                    iv: keys.iv
                })
            });

            if (response.ok) {
                alert('Registration successful! Please log in.');
                window.location.href = '/login';
            } else {
                const error = await response.text();
                alert('Registration failed: ' + error);
            }
        } catch (error) {
            console.error('Registration error:', error);
            alert('Registration failed: ' + error.message);
        }
    }

    async handleLogin(e) {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            // Get user's encryption keys
            const userResponse = await fetch(`/api/user/keys/${username}`);
            if (!userResponse.ok) {
                throw new Error('User not found');
            }

            const userData = await userResponse.json();

            // 2. Decrypt and load RSA private key
            await cryptoManager.initializeUser(
                userData.encrypted_private_key,
                userData.salt,
                userData.iv,
                password
            );

            // 3. Decrypt and load the Note Encryption Key
            await cryptoManager.decryptAndLoadNoteKey(
                userData.encrypted_note_key
            );

            // FIX: Persist the decrypted key to sessionStorage
            await cryptoManager.persistSessionKey();

            console.log('CryptoManager initialized, private key and note key loaded into memory.');

            // 4. Login to server (handles session cookie)
            const loginResponse = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username, password: password })
            });

            if (loginResponse.ok) {
                // FIX: Key is ONLY persisted *after* server confirms login
                await cryptoManager.persistSessionKey();
                console.log("Server login successful, key persisted.");

                // 6. Redirect
                window.location.href = '/notes';
            } else {
                const errorData = await loginResponse.json();
                // FIX: Clear keys on failed login
                cryptoManager.clearAllKeys();
                throw new Error(errorData.error || 'Login failed');
            }

        } catch (error) {
            console.error('Login error:', error);
            // FIX: Clear keys on any error
            cryptoManager.clearAllKeys();
            alert('Login failed: ' + error.message);
        }
    }
}

// Initialize auth manager
document.addEventListener('DOMContentLoaded', function() {
    new AuthManager();
});