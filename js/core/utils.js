// ============================================================
// CORE - UTILS (Algemene hulpfuncties)
// ============================================================

/**
 * Escape HTML speciale karakters om XSS te voorkomen
 */
export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Formatteer een datum naar NL-notatie (DD-MM-YYYY)
 */
export function formatDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('nl-NL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

/**
 * Formatteer een datum naar lange NL-notatie (dinsdag 1 januari 2025)
 */
export function formatDateLong(date) {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('nl-NL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

/**
 * Krijg vandaag als Date object met tijd op 00:00:00
 */
export function getToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

/**
 * Bereken dagen tussen twee datums (afgerond naar beneden)
 */
export function getDaysBetween(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    return Math.floor((d1 - d2) / (1000 * 60 * 60 * 24));
}

/**
 * Maak een datum string in YYYY-MM-DD formaat
 */
export function toDateString(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
}

/**
 * Valideer of een string een geldig e-mailadres is
 */
export function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Genereer een unieke ID (voor tijdelijke items)
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}

/**
 * Sorteer een array op een specifieke eigenschap
 */
export function sortBy(arr, key, ascending = true) {
    return [...arr].sort((a, b) => {
        const valA = a[key] || '';
        const valB = b[key] || '';
        if (valA < valB) return ascending ? -1 : 1;
        if (valA > valB) return ascending ? 1 : -1;
        return 0;
    });
}

/**
 * Groepeer een array op een specifieke eigenschap
 */
export function groupBy(arr, key) {
    return arr.reduce((groups, item) => {
        const groupKey = item[key] || 'onbekend';
        if (!groups[groupKey]) {
            groups[groupKey] = [];
        }
        groups[groupKey].push(item);
        return groups;
    }, {});
}

/**
 * Haal een waarde uit localStorage met fallback
 */
export function getStorage(key, fallback = null) {
    try {
        const value = localStorage.getItem(key);
        return value !== null ? value : fallback;
    } catch {
        return fallback;
    }
}

/**
 * Zet een waarde in localStorage
 */
export function setStorage(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        console.warn('Kon niet opslaan in localStorage:', e);
    }
}

/**
 * Toon een tijdelijke melding (toast)
 */
export function showToast(message, type = 'info', duration = 3000) {
    const existingToast = document.querySelector('.toast-message');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#2c7da0'};
        max-width: 90%;
        text-align: center;
        animation: fadeInUp 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Voeg de animatie toe (als die nog niet bestaat)
if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateX(-50%) translateY(20px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
    `;
    document.head.appendChild(style);
}