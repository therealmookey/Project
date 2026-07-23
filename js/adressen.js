// ============================================================
// ADRESSEN - Adressen pagina (adressen.html)
// ============================================================

console.log('🚀 adressen.js wordt geladen...');

import { requireAuth } from './core/auth.js';
import { showToast, escapeHtml } from './core/utils.js';
import { supabase } from './core/supabase.js';

console.log('✅ Imports geladen!');

// ===== STATE =====
let alleAdressen = [];
let huidigeZoekterm = '';
let currentAddressId = null;

// ===== DOM ELEMENTEN =====
const adressenLijst = document.getElementById('adressenLijst');
const addAddressBtn = document.getElementById('addAddressBtn');
const addressPopup = document.getElementById('addressPopup');
const saveAddressBtn = document.getElementById('saveAddressBtn');
const closeAddressPopup = document.getElementById('closeAddressPopup');
const popupTitle = document.getElementById('popupTitle');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');

console.log('✅ DOM elementen gevonden:', {
    adressenLijst: !!adressenLijst,
    addAddressBtn: !!addAddressBtn,
    addressPopup: !!addressPopup
});

// ===== HULPFUNCTIES =====
function getValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
}

function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
}

// ===== ADRESSEN FUNCTIES =====

function toonAdressen(adressen) {
    console.log('📋 toonAdressen aangeroepen met', adressen?.length || 0, 'adressen');
    
    if (!adressenLijst) {
        console.error('❌ adressenLijst element niet gevonden!');
        return;
    }
    
    if (!adressen || adressen.length === 0) {
        adressenLijst.innerHTML = '<p>Geen adressen gevonden. Klik op "+ Nieuw adres" om er een toe te voegen.</p>';
        return;
    }
    
    let html = `
        <table>
            <thead>
                <tr>
                    <th>Instelling</th>
                    <th>Adres</th>
                    <th>Postcode/Plaats</th>
                    <th>Telefoon</th>
                    <th>Contactpersoon</th>
                    <th>Extra info</th>
                    <th>Acties</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    adressen.forEach(adres => {
        let telefoonHtml = '-';
        if (adres.telefoon) {
            telefoonHtml = `<a href="tel:${escapeHtml(adres.telefoon)}" class="telefoon-link">${escapeHtml(adres.telefoon)}</a>`;
        }
        
        let contactpersoonHtml = '-';
        if (adres.contactpersoon_naam) {
            contactpersoonHtml = `<strong>${escapeHtml(adres.contactpersoon_naam)}</strong>`;
            if (adres.contactpersoon_email) {
                contactpersoonHtml += `<br><a href="mailto:${escapeHtml(adres.contactpersoon_email)}" class="email-link">${escapeHtml(adres.contactpersoon_email)}</a>`;
            }
        } else if (adres.contactpersoon_email) {
            contactpersoonHtml = `<a href="mailto:${escapeHtml(adres.contactpersoon_email)}" class="email-link">${escapeHtml(adres.contactpersoon_email)}</a>`;
        }
        
        let extraInfoShort = '-';
        if (adres.extra_info) {
            extraInfoShort = escapeHtml(adres.extra_info.substring(0, 80));
            if (adres.extra_info.length > 80) extraInfoShort += '...';
        }
        
        html += `
            <tr>
                <td><strong>${escapeHtml(adres.instelling_naam)}</strong></td>
                <td>${escapeHtml(adres.straat)}</td>
                <td>${escapeHtml(adres.postcode)}<br>${escapeHtml(adres.plaats)}</td>
                <td class="telefoon-cell">${telefoonHtml}</td>
                <td class="contactpersoon-cell">${contactpersoonHtml}</td>
                <td class="extra-info-cell">${extraInfoShort}</td>
                <td class="adres-buttons">
                    <button class="btn btn-secondary edit-btn" data-id="${adres.id}">✏️ Bewerken</button>
                    <button class="btn btn-danger delete-btn" data-id="${adres.id}">🗑️ Verwijderen</button>
                </td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    adressenLijst.innerHTML = html;
    
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => bewerkAdres(btn.dataset.id));
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => verwijderAdres(btn.dataset.id));
    });
    
    console.log('✅ Adressen weergegeven!');
}

function filterAdressen(zoekterm) {
    if (!zoekterm || zoekterm.trim() === '') {
        return alleAdressen;
    }
    const term = zoekterm.toLowerCase().trim();
    return alleAdressen.filter(adres => {
        return (
            (adres.instelling_naam && adres.instelling_naam.toLowerCase().includes(term)) ||
            (adres.straat && adres.straat.toLowerCase().includes(term)) ||
            (adres.plaats && adres.plaats.toLowerCase().includes(term)) ||
            (adres.postcode && adres.postcode.toLowerCase().includes(term)) ||
            (adres.telefoon && adres.telefoon.toLowerCase().includes(term)) ||
            (adres.contactpersoon_naam && adres.contactpersoon_naam.toLowerCase().includes(term)) ||
            (adres.contactpersoon_email && adres.contactpersoon_email.toLowerCase().includes(term))
        );
    });
}

async function laadAdressen() {
    console.log('📋 laadAdressen aangeroepen...');
    
    if (!adressenLijst) {
        console.error('❌ adressenLijst element niet gevonden!');
        return;
    }
    
    adressenLijst.innerHTML = '<p>Bezig met laden...</p>';
    
    try {
        console.log('📡 Ophalen adressen van Supabase...');
        
        const { data, error } = await supabase
            .from('adressen')
            .select('*')
            .order('instelling_naam');
        
        if (error) {
            console.error('❌ Supabase fout:', error);
            adressenLijst.innerHTML = `<p class="error">Fout: ${error.message}</p>`;
            return;
        }
        
        console.log('📋 Aantal adressen ontvangen:', data?.length || 0);
        
        alleAdressen = data || [];
        const gefilterdeAdressen = filterAdressen(huidigeZoekterm);
        toonAdressen(gefilterdeAdressen);
        
        console.log('✅ Adressen geladen!');
    } catch (err) {
        console.error('❌ Fout bij laden adressen:', err);
        adressenLijst.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
    }
}

async function bewerkAdres(id) {
    try {
        const { data, error } = await supabase
            .from('adressen')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) {
            showToast('Fout: ' + error.message, 'error');
            return;
        }
        
        currentAddressId = id;
        popupTitle.textContent = 'Adres bewerken';
        setValue('instellingNaam', data.instelling_naam);
        setValue('straat', data.straat);
        setValue('postcode', data.postcode);
        setValue('plaats', data.plaats);
        setValue('telefoon', data.telefoon || '');
        setValue('contactpersoon_naam', data.contactpersoon_naam || '');
        setValue('contactpersoon_email', data.contactpersoon_email || '');
        setValue('extra_info', data.extra_info || '');
        addressPopup.style.display = 'flex';
    } catch (err) {
        showToast('Fout: ' + err.message, 'error');
    }
}

async function verwijderAdres(id) {
    if (!confirm('Weet je zeker dat je dit adres wilt verwijderen?')) return;
    
    try {
        const { error } = await supabase
            .from('adressen')
            .delete()
            .eq('id', id);
        
        if (error) {
            showToast('Fout: ' + error.message, 'error');
        } else {
            showToast('✅ Adres verwijderd!', 'success');
            await laadAdressen();
        }
    } catch (err) {
        showToast('Fout: ' + err.message, 'error');
    }
}

async function saveAddress() {
    const adresData = {
        instelling_naam: getValue('instellingNaam'),
        straat: getValue('straat'),
        postcode: getValue('postcode'),
        plaats: getValue('plaats'),
        telefoon: getValue('telefoon') || null,
        contactpersoon_naam: getValue('contactpersoon_naam') || null,
        contactpersoon_email: getValue('contactpersoon_email') || null,
        extra_info: getValue('extra_info') || null
    };
    
    if (!adresData.instelling_naam || !adresData.straat || !adresData.postcode || !adresData.plaats) {
        showToast('Vul alle verplichte velden in', 'error');
        return;
    }
    
    try {
        let result;
        if (currentAddressId) {
            result = await supabase
                .from('adressen')
                .update(adresData)
                .eq('id', currentAddressId);
        } else {
            result = await supabase
                .from('adressen')
                .insert([adresData]);
        }
        
        if (result.error) {
            showToast('Fout: ' + result.error.message, 'error');
        } else {
            showToast('✅ Adres opgeslagen!', 'success');
            addressPopup.style.display = 'none';
            await laadAdressen();
        }
    } catch (err) {
        showToast('Fout: ' + err.message, 'error');
    }
}

// ===== INITIALISATIE =====

console.log('🔄 Initialisatie gestart...');

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🔄 DOMContentLoaded event triggered');
    
    // Controleer of gebruiker is ingelogd en goedgekeurd
    console.log('🔐 Auth check...');
    const auth = await requireAuth('index.html');
    console.log('🔐 Auth result:', auth);
    
    if (!auth.isAuthenticated) {
        console.warn('⚠️ Niet ingelogd, redirect...');
        return;
    }
    
    console.log('✅ Ingelogd als:', auth.user?.email);
    
    // Laad adressen
    await laadAdressen();
    
    // ===== EVENT LISTENERS =====
    console.log('🔄 Event listeners toevoegen...');
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            huidigeZoekterm = e.target.value;
            const gefilterdeAdressen = filterAdressen(huidigeZoekterm);
            toonAdressen(gefilterdeAdressen);
        });
        console.log('✅ Search input listener toegevoegd');
    }
    
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            huidigeZoekterm = '';
            toonAdressen(alleAdressen);
            searchInput.focus();
        });
        console.log('✅ Clear search button listener toegevoegd');
    }
    
    if (addAddressBtn) {
        addAddressBtn.addEventListener('click', () => {
            currentAddressId = null;
            popupTitle.textContent = 'Nieuw adres';
            setValue('instellingNaam', '');
            setValue('straat', '');
            setValue('postcode', '');
            setValue('plaats', '');
            setValue('telefoon', '');
            setValue('contactpersoon_naam', '');
            setValue('contactpersoon_email', '');
            setValue('extra_info', '');
            addressPopup.style.display = 'flex';
        });
        console.log('✅ Add address button listener toegevoegd');
    }
    
    if (saveAddressBtn) {
        saveAddressBtn.addEventListener('click', saveAddress);
        console.log('✅ Save address button listener toegevoegd');
    }
    
    if (closeAddressPopup) {
        closeAddressPopup.addEventListener('click', () => {
            addressPopup.style.display = 'none';
        });
        console.log('✅ Close popup button listener toegevoegd');
    }
    
    window.addEventListener('click', (e) => {
        if (e.target === addressPopup) {
            addressPopup.style.display = 'none';
        }
    });
    
    console.log('✅ Adressen pagina geïnitialiseerd!');
});

// Als DOM al geladen is
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('🔄 DOM is al geladen, trigger direct...');
    // We moeten de event listener opnieuw triggeren
    document.dispatchEvent(new Event('DOMContentLoaded'));
}