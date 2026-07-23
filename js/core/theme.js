// ============================================================
// CORE - THEME (Dark/Light mode beheer)
// ============================================================

// ===== CONSTANTEN =====
const THEME_KEY = 'theme';
const DARK_CLASS = 'dark';
const LIGHT_CLASS = 'light';

// Voorkom dubbele initialisatie
let isInitialized = false;

/**
 * Haal de huidige thema voorkeur op
 * @returns {string} 'dark' of 'light'
 */
export function getCurrentTheme() {
    try {
        return localStorage.getItem(THEME_KEY) || LIGHT_CLASS;
    } catch {
        return LIGHT_CLASS;
    }
}

/**
 * Pas het thema toe op de pagina
 * @param {string} theme - 'dark' of 'light'
 */
export function applyTheme(theme) {
    const isDark = theme === DARK_CLASS;
    
    // Zet data-theme attribute op html element
    document.documentElement.setAttribute('data-theme', theme);
    
    // Update checkbox als die bestaat
    const checkbox = document.getElementById('themeCheckbox');
    if (checkbox) {
        checkbox.checked = isDark;
    }
    
    // Opslaan in localStorage
    try {
        localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
        // Negeer storage fouten
    }
    
    console.log(`🎨 Thema toegepast: ${theme}`);
}

/**
 * Wissel tussen dark en light mode
 * @param {Event} event - Change event van checkbox
 */
export function toggleTheme(event) {
    const isChecked = event.target.checked;
    const newTheme = isChecked ? DARK_CLASS : LIGHT_CLASS;
    applyTheme(newTheme);
}

/**
 * Initialiseer het thema bij het laden van de pagina
 * Dit zorgt ervoor dat de voorkeur wordt toegepast
 */
export function initTheme() {
    // Voorkom dubbele initialisatie
    if (isInitialized) {
        console.log('ℹ️ Thema al geïnitialiseerd, sla over');
        return;
    }
    
    isInitialized = true;
    
    const savedTheme = getCurrentTheme();
    applyTheme(savedTheme);
    
    // Event listener toevoegen aan checkbox (als die bestaat)
    const checkbox = document.getElementById('themeCheckbox');
    if (checkbox) {
        // Verwijder oude listeners om dubbel te voorkomen
        const newCheckbox = checkbox.cloneNode(true);
        checkbox.parentNode.replaceChild(newCheckbox, checkbox);
        newCheckbox.addEventListener('change', toggleTheme);
    }
    
    console.log('✅ Thema geïnitialiseerd');
}

/**
 * Voeg een thema-toggle knop toe aan de pagina (als die niet bestaat)
 */
export function addThemeToggle() {
    // Zoek naar een bestaande toggle
    const existingToggle = document.querySelector('.theme-switch-wrapper');
    if (existingToggle) {
        initTheme();
        return;
    }
    
    // Maak een nieuwe toggle
    const toggleWrapper = document.createElement('div');
    toggleWrapper.className = 'theme-switch-wrapper';
    toggleWrapper.innerHTML = `
        <span class="theme-icon">☀️</span>
        <label class="theme-switch">
            <input type="checkbox" id="themeCheckbox">
            <span class="slider round"></span>
        </label>
        <span class="theme-icon">🌙</span>
    `;
    
    // Voeg toe aan de navigatie
    const navLinks = document.querySelector('.nav-links');
    if (navLinks) {
        navLinks.appendChild(toggleWrapper);
    }
    
    // Initialiseer
    initTheme();
}

// ===== EXPORT =====
export default {
    getCurrentTheme,
    applyTheme,
    toggleTheme,
    initTheme,
    addThemeToggle
};