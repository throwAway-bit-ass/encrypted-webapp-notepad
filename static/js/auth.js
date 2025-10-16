// Authentication and registration with encryption support
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
            // Generate encryption keys for new user
            const keys = await cryptoManager.generateKeyPair(password);

            // Send registration data to server
            const response = await fetch('/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username,
                    email: email,
                    password: password,
                    public_key: keys.publicKey,
                    encrypted_private_key: keys.encryptedPrivateKey,
                    salt: keys.salt,
                    iv: keys.iv
                })
            });

            if (response.ok) {
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
            // First, get user's encryption keys from server
            const userResponse = await fetch(`/api/user/keys/${username}`);
            if (!userResponse.ok) {
                throw new Error('User not found');
            }

            const userData = await userResponse.json();

            // Initialize crypto with user's keys
            await cryptoManager.initializeUser(
                userData.encrypted_private_key,
                userData.salt,
                userData.iv,
                password
            );

            // Ensure session key is generated and persisted
            await cryptoManager.ensureSessionKey();
            await cryptoManager.persistSessionKey();

            console.log('CryptoManager initialized and session key persisted');

            // Login using JSON
            const loginResponse = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });

            if (loginResponse.ok) {
                window.location.href = '/notes';
            } else {
                const errorData = await loginResponse.json();
                throw new Error(errorData.error || 'Login failed');
            }

        } catch (error) {
            console.error('Login error:', error);
            alert('Login failed: ' + error.message);
        }
    }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    new AuthManager();
});