// ===== ADRESSEN FUNCTIES (ALLEEN DATABASE BEHEER) =====

console.log('adressen.js geladen');

document.addEventListener('DOMContentLoaded', function() {
    
    if (!window.supabase) {
        console.error('Supabase niet beschikbaar!');
        return;
    }
    
    const adressenLijst = document.getElementById('adressenLijst');
    const addAddressBtn = document.getElementById('addAddressBtn');
    const addressPopup = document.getElementById('addressPopup');
    const saveAddressBtn = document.getElementById('saveAddressBtn');
    const closeAddressPopup = document.getElementById('closeAddressPopup');
    const popupTitle = document.getElementById('popupTitle');
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    
    let currentAddressId = null;
    let alleAdressen = [];
    let huidigeZoekterm = '';
    
    function getValue(id) {
        const el = document.getElementById(id);
        return el ? el.value : '';
    }
    
    function setValue(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
    }
    
    // Tabel weergeven (geen checkboxes)
    function toonAdressen(adressen) {
        if (!adressenLijst) return;
        
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
            // Telefoon weergave (maak er een klikbare link van)
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
        if (!adressenLijst) return;
        
        adressenLijst.innerHTML = '<p>Bezig met laden...</p>';
        
        try {
            const { data, error } = await window.supabase
                .from('adressen')
                .select('*')
                .order('instelling_naam');
            
            if (error) {
                adressenLijst.innerHTML = `<p class="error">Fout: ${error.message}</p>`;
                return;
            }
            
            alleAdressen = data || [];
            const gefilterdeAdressen = filterAdressen(huidigeZoekterm);
            toonAdressen(gefilterdeAdressen);
            
        } catch (err) {
            adressenLijst.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
        }
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            huidigeZoekterm = e.target.value;
            const gefilterdeAdressen = filterAdressen(huidigeZoekterm);
            toonAdressen(gefilterdeAdressen);
        });
    }
    
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            huidigeZoekterm = '';
            toonAdressen(alleAdressen);
            searchInput.focus();
        });
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
    }
    
    async function bewerkAdres(id) {
        try {
            const { data, error } = await window.supabase
                .from('adressen')
                .select('*')
                .eq('id', id)
                .single();
            
            if (error) {
                alert('Fout: ' + error.message);
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
            alert('Fout: ' + err.message);
        }
    }
    
    if (saveAddressBtn) {
        saveAddressBtn.addEventListener('click', async () => {
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
                alert('Vul alle verplichte velden in');
                return;
            }
            
            try {
                let result;
                if (currentAddressId) {
                    result = await window.supabase
                        .from('adressen')
                        .update(adresData)
                        .eq('id', currentAddressId);
                } else {
                    result = await window.supabase
                        .from('adressen')
                        .insert([adresData]);
                }
                
                if (result.error) {
                    alert('Fout: ' + result.error.message);
                } else {
                    addressPopup.style.display = 'none';
                    await laadAdressen();
                }
            } catch (err) {
                alert('Fout: ' + err.message);
            }
        });
    }
    
    async function verwijderAdres(id) {
        if (!confirm('Weet je zeker dat je dit adres wilt verwijderen?')) return;
        
        try {
            const { error } = await window.supabase
                .from('adressen')
                .delete()
                .eq('id', id);
            
            if (error) {
                alert('Fout: ' + error.message);
            } else {
                await laadAdressen();
            }
        } catch (err) {
            alert('Fout: ' + err.message);
        }
    }
    
    if (closeAddressPopup) {
        closeAddressPopup.addEventListener('click', () => {
            addressPopup.style.display = 'none';
        });
    }
    
    window.addEventListener('click', (e) => {
        if (e.target === addressPopup) {
            addressPopup.style.display = 'none';
        }
    });
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    laadAdressen();
    
});