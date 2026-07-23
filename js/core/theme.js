// ============================================================
// CORE - THEME (Dark/Light mode beheer)
// ============================================================

import { getStorage, setStorage } from './utils.js';
import { updateVersion } from './version.js';

// Update versie naar stap 3
updateVersion(3, 'Theme Module', '2.1.0');

// ===== CONSTANTEN =====
const THEME_KEY = 'theme';
const DARK_CLASS = 'dark';
const LIGHT_CLASS = 'light';

/**
 * Haal de huidige thema voorkeur op
 * @returns {string} 'dark' of 'light'
 */
export function getCurrentTheme() {
    return getStorage(THEME_KEY, LIGHT_CLASS);
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
    setStorage(THEME_KEY, theme);
    
    console.log(`🎨 Thema gewijzigd naar: ${theme}`);
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
    const savedTheme = getCurrentTheme();
    applyTheme(savedTheme);
    
    // Event listener toevoegen aan checkbox
    const checkbox = document.getElementById('themeCheckbox');
    if (checkbox) {
        // Verwijder oude listeners om dubbel te voorkomen
        checkbox.removeEventListener('change', toggleTheme);
        checkbox.addEventListener('change', toggleTheme);
    }
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