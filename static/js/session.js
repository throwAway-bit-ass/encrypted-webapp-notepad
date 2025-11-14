class SessionManager {
    constructor() {
        this.SESSION_TIMEOUT = 5 * 60 * 1000;
        this.WARNING_TIME = 60 * 1000;

        this.inactivityTimer = null;
        this.warningTimer = null;
        this.isWarningActive = false;
        this.countdownInterval = null;

        this.init();
    }

    async init() {
        console.log('SessionManager: Initializing for logged in user');
        await this.fetchTimeout();
        this.resetInactivityTimer();
        this.startSessionChecker();
    }

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
        this.SESSION_TIMEOUT = this.SESSION_TIMEOUT_DEFAULT;
        console.log(`SessionManager: Using default timeout: ${this.SESSION_TIMEOUT} ms`);
    }

    resetEventListeners() {
        this.removeEventListeners();

        const events = ['keypress', 'scroll', 'touchstart', 'click', 'input'];
        events.forEach(event => {
            document.addEventListener(event, this.eventHandler.bind(this), true);
        });
    }

    removeEventListeners() {
        const events = ['keypress', 'scroll', 'touchstart', 'click', 'input'];
        events.forEach(event => {
            document.removeEventListener(event, this.eventHandler.bind(this), true);
        });
    }

    eventHandler() {
        if (!this.isWarningActive) {
            this.resetInactivityTimer();
        }
    }

    resetInactivityTimer() {
        clearTimeout(this.inactivityTimer);
        clearTimeout(this.warningTimer);

        this.inactivityTimer = setTimeout(() => this.logoutDueToInactivity(), this.SESSION_TIMEOUT);

        this.warningTimer = setTimeout(() => this.showSessionWarning(), this.SESSION_TIMEOUT - this.WARNING_TIME);
    }

    showSessionWarning() {
        this.isWarningActive = true;
        this.removeEventListeners();

        const modal = document.getElementById('sessionTimeoutModal');
        const countdownElement = document.getElementById('countdown');
        const secondsLeft = Math.floor(this.WARNING_TIME / 1000);

        if (modal && countdownElement) {
            modal.style.display = 'block';

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

            if (this.countdownInterval) {
                clearInterval(this.countdownInterval);
                this.countdownInterval = null;
            }
        }

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
        showNotification('Session expired due to inactivity', 'error');
        if (typeof cryptoManager !== 'undefined') {
            cryptoManager.clearAllKeys();
        }
        setTimeout(() => this.logout(), 1000);
    }

    logout() {
        window.location.href = '/logout';
    }


    async startSessionChecker() {
        setInterval(async () => {
            try {
                const response = await fetch('/api/session/check');
                if (!response.ok) {
                    this.logoutDueToInactivity();
                }
            } catch (error) {
                console.error('Session check failed:', error);
                this.logoutDueToInactivity();
            }
        }, 60000);
    }

    resetTimer() {
        this.resetInactivityTimer();
    }
}

let sessionManager;

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('sessionTimeoutModal')) {
        sessionManager = new SessionManager();
    }
});

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