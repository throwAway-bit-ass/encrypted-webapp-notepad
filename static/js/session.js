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

    init() {
        console.log('SessionManager: Initializing for logged in user');
        this.setupEventListeners();
        this.resetInactivityTimer();
        this.startSessionChecker();
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

        if (modal && countdownElement) {
            modal.style.display = 'block';

            // Start countdown from 60 seconds
            let secondsLeft = 60;
            countdownElement.textContent = secondsLeft;

            this.countdownInterval = setInterval(() => {
                secondsLeft--;
                countdownElement.textContent = secondsLeft;

                if (secondsLeft <= 0) {
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
                this.showNotification('Session extended', 'success');
            } else {
                throw new Error('Failed to extend session');
            }
        } catch (error) {
            console.error('Error extending session:', error);
            this.logout();
        }
    }

    logoutDueToInactivity() {
        this.showNotification('Session expired due to inactivity', 'error');
        setTimeout(() => this.logout(), 1000);
    }

    logout() {
        window.location.href = '/logout';
    }

    showNotification(message, type) {
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
        `;

        if (type === 'error') {
            notification.style.background = '#dc3545';
        } else {
            notification.style.background = '#28a745';
        }

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

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