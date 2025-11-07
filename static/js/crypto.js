// Client-side cryptography module
class CryptoManager {
    constructor() {
        this.userKeys = null;
        this.sessionKey = null;
    }

    // Generate RSA key pair for new user
    async generateKeyPair(password) {
        try {
            // Generate salt for key derivation
            const salt = crypto.getRandomValues(new Uint8Array(16));

            // Derive key from password using PBKDF2
            const masterKey = await this.deriveKey(password, salt);

            // Generate RSA key pair
            const keyPair = await crypto.subtle.generateKey(
                {
                    name: "RSA-OAEP",
                    modulusLength: 2048,
                    publicExponent: new Uint8Array([1, 0, 1]),
                    hash: "SHA-256"
                },
                true,
                ["encrypt", "decrypt"]
            );

            // 3. Generate the permanent AES Note Key
            const noteKey = await crypto.subtle.generateKey(
                { name: "AES-GCM", length: 256 },
                true,
                ["encrypt", "decrypt"]
            );

            // 4. Export keys
            const publicKey = await crypto.subtle.exportKey("spki", keyPair.publicKey);
            const privateKey = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
            const exportedNoteKey = await crypto.subtle.exportKey("raw", noteKey);

            // Encrypt private key with master key
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encryptedPrivateKey = await this.encryptAES(privateKey, masterKey, iv);

            // 6. Encrypt Note Key (with public key)
            const encryptedNoteKey = await crypto.subtle.encrypt(
                { name: "RSA-OAEP" },
                keyPair.publicKey,
                exportedNoteKey
            );

            return {
                publicKey: this.arrayBufferToBase64(publicKey),
                encryptedPrivateKey: this.arrayBufferToBase64(encryptedPrivateKey),
                encryptedNoteKey: this.arrayBufferToBase64(encryptedNoteKey),
                salt: this.arrayBufferToBase64(salt),
                iv: this.arrayBufferToBase64(iv)
            };
        } catch (error) {
            console.error('Error generating key pair:', error);
            throw error;
        }
    }

    // Initialize crypto for existing user
    async initializeUser(encryptedPrivateKey, salt, iv, password) {
        try {
            // Derive master key from password
            const masterKey = await this.deriveKey(password, this.base64ToArrayBuffer(salt));

            // Decrypt private key
            const privateKeyData = await this.decryptAES(
                this.base64ToArrayBuffer(encryptedPrivateKey),
                masterKey,
                this.base64ToArrayBuffer(iv)
            );

            // Import private key
            const privateKey = await crypto.subtle.importKey(
                "pkcs8",
                privateKeyData,
                {
                    name: "RSA-OAEP",
                    hash: "SHA-256"
                },
                true,
                ["decrypt"]
            );

            this.userKeys = { privateKey };
            return true;
        } catch (error) {
            console.error('Error initializing user:', error);
            throw new Error('Invalid password or corrupted keys');
        }
    }

    // FIX: New function to decrypt and load the Note Key
    async decryptAndLoadNoteKey(encryptedNoteKeyBase64) {
        if (!this.userKeys?.privateKey) {
            throw new Error('User private key not initialized');
        }

        try {
            const encryptedNoteKey = this.base64ToArrayBuffer(encryptedNoteKeyBase64);
            const sessionKeyBuffer = await crypto.subtle.decrypt(
                { name: "RSA-OAEP" },
                this.userKeys.privateKey,
                encryptedNoteKey
            );

            this.sessionKey = await crypto.subtle.importKey(
                "raw",
                sessionKeyBuffer,
                { name: "AES-GCM", length: 256 },
                true,
                ["encrypt", "decrypt"]
            );
            console.log('Note Encryption Key successfully decrypted and loaded.');
        } catch (error) {
            console.error('Failed to decrypt note key:', error);
            throw new Error('Could not decrypt note key.');
        }
    }

    // Derive key from password using PBKDF2
    async deriveKey(password, salt) {
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(password);

        const importedKey = await crypto.subtle.importKey(
            "raw",
            passwordBuffer,
            "PBKDF2",
            false,
            ["deriveKey"]
        );

        return await crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: salt,
                iterations: 100000,
                hash: "SHA-256"
            },
            importedKey,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    }

    // Generate session key for note encryption
    async generateSessionKey() {
        this.sessionKey = await crypto.subtle.generateKey(
            {
                name: "AES-GCM",
                length: 256
            },
            true,
            ["encrypt", "decrypt"]
        );
    }

    async persistSessionKey() {
    if (!this.sessionKey) {
        await this.generateSessionKey();
    }

    const exportedKey = await crypto.subtle.exportKey("raw", this.sessionKey);
    const keyBase64 = this.arrayBufferToBase64(exportedKey);
    localStorage.setItem('sessionKey', keyBase64);
    }

    // Load session key from localStorage
    async loadSessionKey() {
        const keyBase64 = localStorage.getItem('sessionKey');
        if (keyBase64) {
            const keyBuffer = this.base64ToArrayBuffer(keyBase64);
            this.sessionKey = await crypto.subtle.importKey(
                "raw",
                keyBuffer,
                { name: "AES-GCM", length: 256 },
                true,
                ["encrypt", "decrypt"]
            );
            return true;
        }
        return false;
    }

    // Clear session key (on logout)
    clearSessionKey() {
        this.sessionKey = null;
        this.userKeys = null;
        localStorage.removeItem('sessionKey'); // Clear old key just in case
        console.log('All in-memory keys cleared.');
    }

    // Initialize or load session key
    async ensureSessionKey() {
        if (!this.sessionKey) {
            // Try to load from localStorage first
            const loaded = await this.loadSessionKey();
            if (!loaded) {
                // If not in localStorage, generate a new one
                await this.generateSessionKey();
                await this.persistSessionKey();
            }
        }
    }

    // Encrypt data with session key
    async encryptData(data) {
        if (!this.sessionKey) {
            await this.generateSessionKey();
        }

        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const iv = crypto.getRandomValues(new Uint8Array(12));

        const encrypted = await crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            this.sessionKey,
            dataBuffer
        );

        return {
            encrypted: this.arrayBufferToBase64(encrypted),
            iv: this.arrayBufferToBase64(iv)
        };
    }

    // Decrypt data with session key
    async decryptData(encryptedData, iv) {
        if (!this.sessionKey) {
            throw new Error('Session key not initialized');
        }

        const encryptedBuffer = this.base64ToArrayBuffer(encryptedData);
        const ivBuffer = this.base64ToArrayBuffer(iv);

        const decrypted = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: ivBuffer
            },
            this.sessionKey,
            encryptedBuffer
        );

        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    }

    // FIX: Removed unused 'encryptSessionKey' method

    // FIX: Removed unused 'decryptSessionKey' method

    // Utility functions
    arrayBufferToBase64(buffer) {
        return btoa(String.fromCharCode(...new Uint8Array(buffer)));
    }

    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    // Encrypt AES (for private key encryption)
    async encryptAES(data, key, iv) {
        return await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            data
        );
    }

    // Decrypt AES (for private key decryption)
    async decryptAES(encryptedData, key, iv) {
        return await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            key,
            encryptedData
        );
    }
}

// Global crypto manager instance
const cryptoManager = new CryptoManager();