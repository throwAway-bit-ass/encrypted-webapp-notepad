// Global JavaScript functionality - Shared across all pages

// Common utility functions
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function showNotification(message, type = 'info') {
    // Remove existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');

    // Determine class based on type
    let notificationClass = 'notification-';
    if (type === 'success') {
        notificationClass += 'success';
    } else if (type === 'error') {
        notificationClass += 'error';
    } else {
        notificationClass += 'info'; // Fallback
    }

    notification.className = `notification ${notificationClass}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        // A simple fade-out before removal
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 500); // Wait for fade-out
    }, 3000);
}

// Global initialization
document.addEventListener('DOMContentLoaded', function() {
    // Any global setup that applies to all pages
    console.log('Global scripts initialized');
});