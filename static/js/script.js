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
    // Simple notification system - can be enhanced
    console.log(`${type}: ${message}`);
}

// Global initialization
document.addEventListener('DOMContentLoaded', function() {
    // Any global setup that applies to all pages
    console.log('Global scripts initialized');
});