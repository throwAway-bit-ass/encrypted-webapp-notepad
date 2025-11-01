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
            const keys = await cryptoManager.generateKeyPair(password);

            const response = await fetch('/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
                alert('Registration successful! Please log in.');
                window.location.href = '/login';
            } else {
                const error = await response.text();
                throw new Error(error);
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

            // Initialize crypto with user's keys
            await cryptoManager.initialize(userData, password);

            // Login to server
            const loginResponse = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username, password: password })
            });

            if (loginResponse.ok) {
                window.location.href = '/notes';
            } else {
                throw new Error('Login failed');
            }

        } catch (error) {
            console.error('Login error:', error);
            alert('Login failed: ' + error.message);
        }
    }
}

// Initialize auth manager
document.addEventListener('DOMContentLoaded', function() {
    new AuthManager();
});