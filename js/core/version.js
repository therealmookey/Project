// ============================================================
// CORE - VERSION (Versiebeheer voor de applicatie)
// ============================================================

// ===== VERSIE INFORMATIE =====
export const VERSION = {
    // Semantische versie (MAJOR.MINOR.PATCH)
    number: '2.0.0',
    
    // Build datum (automatisch gegenereerd)
    buildDate: new Date().toISOString().replace('T', ' ').substring(0, 16),
    
    // Stap waar we zijn in de modularisatie
    moduleStep: 2, // 2 = supabase.js is klaar
    
    // Totaal aantal stappen
    totalSteps: 8,
    
    // Naam van de huidige stap
    currentStepName: 'Supabase Core',
    
    // Git commit hash (als je Git gebruikt, anders leeg laten)
    commitHash: '',
    
    // Branch naam
    branch: 'main'
};

/**
 * Toon de versie in de console bij het laden
 */
export function showVersion() {
    console.log(`%c📦 Project v${VERSION.number}`, 'font-size:16px; font-weight:bold; color:#2c7da0;');
    console.log(`%c📅 Build: ${VERSION.buildDate}`, 'font-size:12px; color:#6c757d;');
    console.log(`%c🔄 Stap ${VERSION.moduleStep}/${VERSION.totalSteps}: ${VERSION.currentStepName}`, 'font-size:12px; color:#6c757d;');
    console.log(`%c🌿 Branch: ${VERSION.branch}`, 'font-size:12px; color:#6c757d;');
}

/**
 * Voeg een versie-badge toe aan de pagina
 */
export function addVersionBadge() {
    // Verwijder bestaande badge
    const existingBadge = document.getElementById('version-badge');
    if (existingBadge) existingBadge.remove();

    const badge = document.createElement('div');
    badge.id = 'version-badge';
    badge.innerHTML = `
        <span style="
            position: fixed;
            bottom: 10px;
            right: 10px;
            background: rgba(44, 125, 160, 0.9);
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-family: monospace;
            z-index: 9999;
            opacity: 0.7;
            transition: opacity 0.3s ease;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        "
        onmouseenter="this.style.opacity='1'"
        onmouseleave="this.style.opacity='0.7'"
        onclick="this.style.display='none'; localStorage.setItem('hideVersionBadge', 'true')"
        title="Klik om te verbergen">
            v${VERSION.number} 
            <span style="font-size:9px; opacity:0.7;">${VERSION.buildDate.substring(5, 16)}</span>
            <span style="font-size:9px; background:rgba(255,255,255,0.2); padding:0 6px; border-radius:10px; margin-left:4px;">
                ⚡${VERSION.moduleStep}/${VERSION.totalSteps}
            </span>
        </span>
    `;

    // Alleen tonen als gebruiker hem niet heeft verborgen
    if (!localStorage.getItem('hideVersionBadge')) {
        document.body.appendChild(badge);
    }
}

/**
 * Update de versie naar een nieuwe stap
 * @param {number} step - Huidige stap nummer
 * @param {string} stepName - Naam van de stap
 * @param {string} versionNumber - Optioneel: nieuwe versie nummer
 */
export function updateVersion(step, stepName, versionNumber = null) {
    VERSION.moduleStep = step;
    VERSION.currentStepName = stepName;
    if (versionNumber) {
        VERSION.number = versionNumber;
    }
    VERSION.buildDate = new Date().toISOString().replace('T', ' ').substring(0, 16);
    
    // Update de badge als die bestaat
    const badge = document.getElementById('version-badge');
    if (badge) {
        badge.innerHTML = `
            <span style="
                position: fixed;
                bottom: 10px;
                right: 10px;
                background: rgba(44, 125, 160, 0.9);
                color: white;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 11px;
                font-family: monospace;
                z-index: 9999;
                opacity: 0.7;
                transition: opacity 0.3s ease;
                cursor: pointer;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            "
            onmouseenter="this.style.opacity='1'"
            onmouseleave="this.style.opacity='0.7'"
            onclick="this.style.display='none'; localStorage.setItem('hideVersionBadge', 'true')"
            title="Klik om te verbergen">
                v${VERSION.number} 
                <span style="font-size:9px; opacity:0.7;">${VERSION.buildDate.substring(5, 16)}</span>
                <span style="font-size:9px; background:rgba(255,255,255,0.2); padding:0 6px; border-radius:10px; margin-left:4px;">
                    ⚡${VERSION.moduleStep}/${VERSION.totalSteps}
                </span>
            </span>
        `;
    }
    
    showVersion();
}

// Toon de versie bij het laden van deze module
showVersion();

// Exporteer alles
export default VERSION;