// Session management functionality - ONLY for authenticated users
class SessionManager {
    constructor() {
        // Safety check - only initialize if user is actually logged in
        if (!this.isUserLoggedIn()) {
            console.log('SessionManager: User not logged in, skipping initialization');
            return;
        }

        // Session timeout configuration (5 minutes = 300000 ms)
        this.SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds
        this.WARNING_TIME = 60 * 1000; // Show warning 1 minute before timeout

        this.inactivityTimer = null;
        this.warningTimer = null;
        this.isWarningActive = false;
        this.countdownInterval = null;
        this.warningEventListenersActive = false;

        this.init();
    }

    isUserLoggedIn() {
        // Check if user is logged in by looking for authenticated user indicators
        const navLinks = document.querySelector('.nav-links');
        if (navLinks) {
            // Check if logout link exists (indicates user is logged in)
            return navLinks.textContent.includes('Logout');
        }
        return false;
    }

    async init() {
        console.log('SessionManager: Initializing for logged in user');
        await this.fetchTimeout(); // Fetch the real timeout
        this.setupEventListeners();
        this.resetInactivityTimer();
        this.startSessionChecker();
    }

    // FIX: New function to get timeout from the server
    async fetchTimeout() {
        try {
            const response = await fetch('/api/session/timeout');
            if (response.ok) {
                const data = await response.json();
                if (data.timeout && data.timeout > this.WARNING_TIME) {
                    this.SESSION_TIMEOUT = data.timeout;
                    console.log(`SessionManager: Timeout set by server: ${this.SESSION_TIMEOUT} ms`);
                    return;
                }
            }
        } catch (error) {
            console.error('SessionManager: Could not fetch timeout, using default.', error);
        }
        // Fallback to default
        this.SESSION_TIMEOUT = this.SESSION_TIMEOUT_DEFAULT;
        console.log(`SessionManager: Using default timeout: ${this.SESSION_TIMEOUT} ms`);
    }

    setupEventListeners() {
        // Events that reset the inactivity timer (only when warning is not active)
        this.resetEventListeners();
    }

    resetEventListeners() {
        // First, remove any existing event listeners to avoid duplicates
        this.removeEventListeners();

        // Add events that reset the inactivity timer
        const events = ['keypress', 'scroll', 'touchstart', 'click', 'input'];
        events.forEach(event => {
            document.addEventListener(event, this.eventHandler.bind(this), true);
        });
    }

    removeEventListeners() {
        // Remove all event listeners
        const events = ['keypress', 'scroll', 'touchstart', 'click', 'input'];
        events.forEach(event => {
            document.removeEventListener(event, this.eventHandler.bind(this), true);
        });
    }

    eventHandler() {
        // Only reset timer if warning is not active
        if (!this.isWarningActive) {
            this.resetInactivityTimer();
        }
    }

    resetInactivityTimer() {
        // Clear existing timers
        clearTimeout(this.inactivityTimer);
        clearTimeout(this.warningTimer);

        // Set new timer for session timeout
        this.inactivityTimer = setTimeout(() => this.logoutDueToInactivity(), this.SESSION_TIMEOUT);

        // Set timer to show warning before timeout
        this.warningTimer = setTimeout(() => this.showSessionWarning(), this.SESSION_TIMEOUT - this.WARNING_TIME);
    }

    showSessionWarning() {
        this.isWarningActive = true;

        // Remove event listeners that automatically extend session
        this.removeEventListeners();

        const modal = document.getElementById('sessionTimeoutModal');
        const countdownElement = document.getElementById('countdown');
        const secondsLeft = Math.floor(this.WARNING_TIME / 1000);

        if (modal && countdownElement) {
            modal.style.display = 'block';

            // Start countdown from 60 seconds
            let currentCountdown = secondsLeft;
            countdownElement.textContent = currentCountdown;

            this.countdownInterval = setInterval(() => {
                currentCountdown--;
                countdownElement.textContent = currentCountdown;

                if (currentCountdown <= 0) {
                    clearInterval(this.countdownInterval);
                    this.logoutDueToInactivity();
                }
            }, 1000);
        }
    }

    hideSessionWarning() {
        this.isWarningActive = false;
        const modal = document.getElementById('sessionTimeoutModal');
        if (modal) {
            modal.style.display = 'none';

            // Clear the countdown interval
            if (this.countdownInterval) {
                clearInterval(this.countdownInterval);
                this.countdownInterval = null;
            }
        }

        // Re-enable event listeners for automatic session extension
        this.resetEventListeners();
    }

    async extendSession() {
        try {
            const response = await fetch('/api/session/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                this.resetInactivityTimer();
                this.hideSessionWarning();
                // FIX: Use global notification function
                showNotification('Session extended', 'success');
            } else {
                throw new Error('Failed to extend session');
            }
        } catch (error) {
            console.error('Error extending session:', error);
            this.logout();
        }
    }

    logoutDueToInactivity() {
        // FIX: Use global notification function
        showNotification('Session expired due to inactivity', 'error');
        setTimeout(() => this.logout(), 1000);
    }

    logout() {
        window.location.href = '/logout';
    }

    // FIX: Removed local showNotification, using global one from script.js

    async startSessionChecker() {
        // Check session status periodically (every minute)
        setInterval(async () => {
            try {
                const response = await fetch('/api/session/check');
                if (!response.ok) {
                    // Session is no longer valid
                    this.logoutDueToInactivity();
                }
            } catch (error) {
                // Network error or server down
                console.error('Session check failed:', error);
                this.logoutDueToInactivity();
            }
        }, 60000); // Check every minute
    }

    // Public method to manually reset timer if needed
    resetTimer() {
        this.resetInactivityTimer();
    }
}

// Initialize session manager when DOM is loaded
let sessionManager;

document.addEventListener('DOMContentLoaded', function() {
    // Only initialize session manager if the modal exists (user is logged in)
    if (document.getElementById('sessionTimeoutModal')) {
        sessionManager = new SessionManager();
    }
});

// Global functions for HTML onclick handlers
function extendSession() {
    if (sessionManager) {
        sessionManager.extendSession();
    }
}

function logout() {
    if (sessionManager) {
        sessionManager.logout();
    }
}