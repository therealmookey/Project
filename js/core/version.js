// ============================================================
// CORE - VERSION (Versiebeheer voor de applicatie)
// ============================================================

// ===== VERSIE INFORMATIE =====
export const VERSION = {
    number: '2.1.0',
    buildDate: new Date().toISOString().replace('T', ' ').substring(0, 16),
    moduleStep: 3,
    totalSteps: 8,
    currentStepName: 'Theme Module',
    branch: 'main'
};

// Houd bij of de versie al is getoond
let versionShown = false;

/**
 * Toon de versie in de console (slechts één keer)
 */
export function showVersion() {
    if (versionShown) return;
    versionShown = true;
    
    console.log(`%c📦 Project v${VERSION.number}`, 'font-size:16px; font-weight:bold; color:#2c7da0;');
    console.log(`%c📅 Build: ${VERSION.buildDate}`, 'font-size:12px; color:#6c757d;');
    console.log(`%c🔄 Stap ${VERSION.moduleStep}/${VERSION.totalSteps}: ${VERSION.currentStepName}`, 'font-size:12px; color:#6c757d;');
    console.log(`%c🌿 Branch: ${VERSION.branch}`, 'font-size:12px; color:#6c757d;');
}

/**
 * Update de versie naar een nieuwe stap
 */
export function updateVersion(step, stepName, versionNumber = null) {
    VERSION.moduleStep = step;
    VERSION.currentStepName = stepName;
    if (versionNumber) {
        VERSION.number = versionNumber;
    }
    VERSION.buildDate = new Date().toISOString().replace('T', ' ').substring(0, 16);
    
    // Reset de "getoond" vlag zodat de nieuwe versie wordt getoond
    versionShown = false;
    showVersion();
    
    // Update de badge als die bestaat
    updateBadge();
}

/**
 * Update de versie-badge met de huidige versie
 */
function updateBadge() {
    const badge = document.getElementById('version-badge');
    if (!badge) return;
    
    // Alleen updaten als de badge zichtbaar is
    if (badge.style.display === 'none') return;
    
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

/**
 * Voeg een versie-badge toe aan de pagina
 */
export function addVersionBadge() {
    if (document.getElementById('version-badge')) return;
    if (localStorage.getItem('hideVersionBadge') === 'true') return;

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
    document.body.appendChild(badge);
    
    // Toon ook in console
    showVersion();
}

// Toon de versie bij het laden van deze module
showVersion();

// Exporteer alles
export default VERSION;