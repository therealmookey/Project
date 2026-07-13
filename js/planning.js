// ===== PLANNING FUNCTIES - 1 LIJST OP DATUM MET CHAUFFEUR PER DAG & AI =====

console.log('planning.js geladen');

document.addEventListener('DOMContentLoaded', function() {
    
    if (!window.supabase) {
        console.error('Supabase niet beschikbaar!');
        return;
    }
    
    // Vaste start- en eindlocatie
    const START_LOCATIE = {
        adres: 'Schoonmansveld 48, 2870 Puurs',
        lat: 51.0589,
        lon: 4.2863
    };
    
    // DOM elementen
    const planningLijst = document.getElementById('planningLijst');
    const newPlanningBtn = document.getElementById('newPlanningBtn');
    const planningPopup = document.getElementById('planningPopup');
    const savePlanningBtn = document.getElementById('savePlanningBtn');
    const closePlanningPopup = document.getElementById('closePlanningPopup');
    const planningPopupTitle = document.getElementById('planningPopupTitle');
    const adresSelect = document.getElementById('adresSelect');
    const typeSelect = document.getElementById('typeSelect');
    const ophalingVelden = document.getElementById('ophalingVelden');
    const plaatsingVelden = document.getElementById('plaatsingVelden');
    
    // WhatsApp popup
    const whatsappPopup = document.getElementById('whatsappPopup');
    const closeWhatsappPopup = document.getElementById('closeWhatsappPopup');
    const sendWhatsAppBtn = document.getElementById('sendWhatsAppBtn');
    const copyBerichtBtn = document.getElementById('copyBerichtBtn');
    const whatsappBericht = document.getElementById('whatsappBericht');
    
    let currentPlanningId = null;
    let adressen = [];
    let allePlanningen = [];
    let chauffeurs = [];
    let sortableInstance = null;
    let huidigeWhatsAppDatum = '';
    
    // Laad adressen voor dropdown
    async function laadAdressen() {
        const { data, error } = await window.supabase
            .from('adressen')
            .select('id, instelling_naam, straat, postcode, plaats')
            .order('instelling_naam');
        
        if (error) {
            console.error('Fout bij laden adressen:', error);
            return [];
        }
        adressen = data || [];
        return adressen;
    }
    
    function vulAdresDropdown() {
        if (!adresSelect) return;
        adresSelect.innerHTML = '<option value="">Kies een adres...</option>';
        adressen.forEach(adres => {
            const option = document.createElement('option');
            option.value = adres.id;
            option.textContent = `${adres.instelling_naam} - ${adres.straat}, ${adres.plaats}`;
            adresSelect.appendChild(option);
        });
    }
    
    // Laad chauffeurs
    async function laadChauffeurs() {
        const { data, error } = await window.supabase
            .from('gebruikers_rollen')
            .select('user_id, gebruikersnaam, chauffeur_nummer, chauffeur_telefoon')
            .eq('is_chauffeur', true);
        
        if (error) {
            console.error('Fout bij laden chauffeurs:', error);
            return;
        }
        
        chauffeurs = data || [];
    }
    
    // Toon/verberg velden op basis van type
    if (typeSelect) {
        typeSelect.addEventListener('change', (e) => {
            const type = e.target.value;
            ophalingVelden.style.display = type === 'ophaling' ? 'block' : 'none';
            plaatsingVelden.style.display = type === 'plaatsing' ? 'block' : 'none';
        });
    }
    
    // Genereer chauffeur dropdown HTML
    function generateChauffeurDropdown(selectedValue) {
        let html = '<select class="chauffeur-select" data-datum="">';
        html += '<option value="">Geen chauffeur geselecteerd</option>';
        
        for (const chauffeur of chauffeurs) {
            const selected = chauffeur.chauffeur_telefoon === selectedValue ? 'selected' : '';
            const label = `${chauffeur.gebruikersnaam || 'Chauffeur'} - ${chauffeur.chauffeur_telefoon || 'geen telefoon'}`;
            html += `<option value="${chauffeur.chauffeur_telefoon || ''}" ${selected}>${label}</option>`;
        }
        html += '</select>';
        return html;
    }
    
    // Sla chauffeur keuze op in localStorage per datum
    function saveChauffeurForDate(datum, chauffeurTelefoon) {
        const key = `chauffeur_${datum}`;
        if (chauffeurTelefoon) {
            localStorage.setItem(key, chauffeurTelefoon);
        } else {
            localStorage.removeItem(key);
        }
    }
    
    function getChauffeurForDate(datum) {
        const key = `chauffeur_${datum}`;
        return localStorage.getItem(key) || '';
    }
    
    // ===== PDF GENERATIE VOOR ROUTE =====
    function genereerPDFVoorDatum(datum) {
        const items = document.querySelectorAll(`.planning-item[data-datum="${datum}"]`);
        if (items.length === 0) {
            alert('Geen ritten voor deze datum.');
            return;
        }
        
        // Verzamel de planning data voor deze datum
        const planningData = [];
        items.forEach(item => {
            const id = parseInt(item.dataset.id);
            const planning = allePlanningen.find(p => p.id === id);
            if (planning) {
                planningData.push(planning);
            }
        });
        
        // Haal de geselecteerde chauffeur voor deze datum
        const chauffeurSelect = document.querySelector(`.datum-header[data-datum="${datum}"] .chauffeur-select`);
        const chauffeurTel = chauffeurSelect ? chauffeurSelect.value : '';
        const chauffeurNaam = chauffeurSelect ? chauffeurSelect.options[chauffeurSelect.selectedIndex]?.text || 'Niet geselecteerd' : 'Niet geselecteerd';
        
        // Genereer de HTML voor de PDF
        const datumObj = new Date(datum + 'T00:00:00');
        const dagVanWeek = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'][datumObj.getDay()];
        const datumStr = `${dagVanWeek} ${datumObj.getDate()} ${datumObj.toLocaleString('nl-NL', { month: 'long' })} ${datumObj.getFullYear()}`;
        
        let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Routeplanning - ${datumStr}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    padding: 40px; 
                    background: white;
                    color: #333;
                }
                .route-pdf {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 30px;
                    background: white;
                    border: 1px solid #e9ecef;
                    border-radius: 12px;
                }
                .header {
                    text-align: center;
                    border-bottom: 3px solid #2c7da0;
                    padding-bottom: 20px;
                    margin-bottom: 25px;
                }
                .header h1 {
                    color: #2c7da0;
                    font-size: 28px;
                    margin-bottom: 5px;
                }
                .header h2 {
                    color: #1f5e7e;
                    font-size: 18px;
                    font-weight: 400;
                }
                .header .datum {
                    color: #6c757d;
                    font-size: 14px;
                    margin-top: 8px;
                }
                .header .chauffeur-info {
                    margin-top: 10px;
                    padding: 8px 16px;
                    background: #f8f9fa;
                    border-radius: 6px;
                    display: inline-block;
                    font-size: 14px;
                }
                .start-location {
                    background: #e8f4f8;
                    padding: 15px 20px;
                    border-radius: 8px;
                    margin-bottom: 25px;
                    border-left: 4px solid #2c7da0;
                }
                .start-location strong {
                    color: #2c7da0;
                    font-size: 16px;
                }
                .start-location p {
                    margin-top: 4px;
                    font-size: 14px;
                }
                .route-stops {
                    margin-bottom: 25px;
                }
                .route-stops h3 {
                    color: #2c7da0;
                    font-size: 18px;
                    margin-bottom: 15px;
                    padding-bottom: 8px;
                    border-bottom: 2px solid #e9ecef;
                }
                .stop-item {
                    display: flex;
                    gap: 15px;
                    padding: 12px 16px;
                    margin-bottom: 8px;
                    background: #f8f9fa;
                    border-radius: 8px;
                    border-left: 3px solid #2c7da0;
                }
                .stop-number {
                    font-weight: bold;
                    color: #2c7da0;
                    min-width: 30px;
                    font-size: 16px;
                }
                .stop-details {
                    flex: 1;
                }
                .stop-details strong {
                    color: #2c7da0;
                    font-size: 15px;
                }
                .stop-details .adres {
                    color: #555;
                    font-size: 13px;
                    margin-top: 2px;
                }
                .stop-details .extra {
                    color: #6c757d;
                    font-size: 12px;
                    margin-top: 4px;
                    padding: 4px 8px;
                    background: #fff8e1;
                    border-radius: 4px;
                    display: inline-block;
                }
                .stop-details .opmerking {
                    color: #0d47a1;
                    font-size: 12px;
                    margin-top: 4px;
                    padding: 4px 8px;
                    background: #e3f2fd;
                    border-radius: 4px;
                    display: inline-block;
                }
                .stop-details .telefoon {
                    color: #2c7da0;
                    font-size: 12px;
                    margin-top: 4px;
                }
                .stop-details .type {
                    font-size: 12px;
                    font-weight: 600;
                    margin-top: 4px;
                    display: inline-block;
                    padding: 2px 10px;
                    background: #e9ecef;
                    border-radius: 12px;
                }
                .return-location {
                    background: #d4edda;
                    padding: 15px 20px;
                    border-radius: 8px;
                    margin-top: 20px;
                    border-left: 4px solid #28a745;
                }
                .return-location strong {
                    color: #155724;
                    font-size: 16px;
                }
                .footer {
                    text-align: center;
                    margin-top: 30px;
                    padding-top: 15px;
                    border-top: 1px solid #e9ecef;
                    font-size: 12px;
                    color: #6c757d;
                }
                .footer .generated {
                    color: #adb5bd;
                }
                .summary {
                    background: #f8f9fa;
                    padding: 12px 16px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    display: flex;
                    justify-content: space-between;
                    flex-wrap: wrap;
                }
                .summary-item {
                    font-size: 14px;
                }
                .summary-item strong {
                    color: #2c7da0;
                }
                @media print {
                    body { padding: 20px; }
                    .route-pdf { border: none; padding: 0; }
                    .stop-item { break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            <div class="route-pdf" id="pdf-content">
                <div class="header">
                    <h1>🚚 ROUTEPLANNING</h1>
                    <h2>Routeoverzicht voor chauffeur</h2>
                    <div class="datum">📅 ${datumStr}</div>
                    <div class="chauffeur-info">👨‍✈️ Chauffeur: ${escapeHtml(chauffeurNaam)} ${chauffeurTel ? '📞 ' + escapeHtml(chauffeurTel) : ''}</div>
                </div>
                
                <div class="start-location">
                    <strong>🚀 VERTREKPUNT</strong>
                    <p>📍 ${START_LOCATIE.adres}</p>
                </div>
                
                <div class="route-stops">
                    <h3>📋 ROUTE (${planningData.length} stops)</h3>
        `;
        
        planningData.forEach((planning, index) => {
            const volgnummer = planning.dag_volgorde || (index + 1);
            let typeInfo = '';
            if (planning.type === 'ophaling') {
                typeInfo = `📦 OPHALING - ${planning.aantal_tonnen || 1} volle ton(nen)`;
            } else if (planning.type === 'plaatsing') {
                typeInfo = `🚚 PLAATSING - ${planning.aantal_lege_tonnen || 1} lege ton(nen)`;
            }
            
            let extraInfo = '';
            if (planning.adres?.extra_info) {
                extraInfo = `<div class="extra">📝 ${escapeHtml(planning.adres.extra_info)}</div>`;
            }
            
            let opmerking = '';
            if (planning.opmerkingen) {
                opmerking = `<div class="opmerking">📋 ${escapeHtml(planning.opmerkingen)}</div>`;
            }
            
            let telefoon = '';
            if (planning.adres?.telefoon) {
                telefoon = `<div class="telefoon">📞 ${escapeHtml(planning.adres.telefoon)}</div>`;
            }
            
            html += `
                <div class="stop-item">
                    <div class="stop-number">#${volgnummer}</div>
                    <div class="stop-details">
                        <strong>${escapeHtml(planning.adres?.instelling_naam || 'Onbekend')}</strong>
                        <div class="adres">📍 ${escapeHtml(planning.adres?.straat || '')}, ${escapeHtml(planning.adres?.postcode || '')} ${escapeHtml(planning.adres?.plaats || '')}</div>
                        <div class="type">${typeInfo}</div>
                        ${telefoon}
                        ${extraInfo}
                        ${opmerking}
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
                
                <div class="return-location">
                    <strong>🏁 TERUGKEER NAAR BASIS</strong>
                    <p>📍 ${START_LOCATIE.adres}</p>
                </div>
                
                <div class="summary">
                    <span class="summary-item"><strong>📋 Aantal stops:</strong> ${planningData.length}</span>
                    <span class="summary-item"><strong>📅 Datum:</strong> ${datumStr}</span>
                    <span class="summary-item"><strong>👨‍✈️ Chauffeur:</strong> ${escapeHtml(chauffeurNaam)}</span>
                </div>
                
                <div class="footer">
                    <div>Route gegenereerd via Platform</div>
                    <div class="generated">Gegenereerd op ${new Date().toLocaleString('nl-NL')}</div>
                </div>
            </div>
        </body>
        </html>
        `;
        
        // Open een nieuw venster en print
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) {
            alert('Popup geblokkeerd! Sta popups toe voor deze site.');
            return;
        }
        
        printWindow.document.write(html);
        printWindow.document.close();
        
        // Wacht tot de inhoud is geladen en print dan
        printWindow.onload = function() {
            setTimeout(function() {
                printWindow.focus();
                printWindow.print();
            }, 500);
        };
    }
    
    // ===== AI OPTIMALISATIE (via Edge Function) =====
    async function optimaliseerMetAI(datum) {
        // Verzamel alle adressen voor deze datum
        const items = document.querySelectorAll(`.planning-item[data-datum="${datum}"]`);
        const adressenList = [];
        
        items.forEach(item => {
            const id = parseInt(item.dataset.id);
            const planning = allePlanningen.find(p => p.id === id);
            if (planning && planning.adres) {
                adressenList.push({
                    id: planning.id,
                    instelling_naam: planning.adres.instelling_naam,
                    straat: planning.adres.straat,
                    postcode: planning.adres.postcode,
                    plaats: planning.adres.plaats
                });
            }
        });
        
        if (adressenList.length === 0) {
            alert('Geen adressen gevonden voor deze dag.');
            return;
        }
        
        if (adressenList.length < 2) {
            alert('Er zijn minimaal 2 adressen nodig voor optimalisatie.');
            return;
        }
        
        // Toon loading state
        const btn = document.querySelector(`.ai-optimize-btn[data-datum="${datum}"]`);
        if (!btn) {
            alert('AI knop niet gevonden.');
            return;
        }
        const origText = btn.textContent;
        btn.textContent = 'Bezig...';
        btn.disabled = true;
        
        try {
            // Haal de Supabase session token op
            const { data: { session }, error: sessionError } = await window.supabase.auth.getSession();
            
            if (sessionError) {
                console.error('Session error:', sessionError);
                throw new Error('Kon sessie niet ophalen: ' + sessionError.message);
            }
            
            const token = session?.access_token;
            
            if (!token) {
                console.log('Geen token gevonden, probeer refresh...');
                const { data: { user } } = await window.supabase.auth.getUser();
                if (!user) {
                    throw new Error('Je bent niet ingelogd. Log opnieuw in.');
                }
                const { data: refreshData } = await window.supabase.auth.refreshSession();
                const refreshToken = refreshData?.session?.access_token;
                if (!refreshToken) {
                    throw new Error('Kon geen geldige sessie verkrijgen. Log opnieuw in.');
                }
                var finalToken = refreshToken;
            } else {
                var finalToken = token;
            }
            
            console.log('Token aanwezig:', finalToken ? 'Ja' : 'Nee');
            
            // Roep de Edge Function aan
            const response = await fetch(
                'https://jcdqcgviossmrvlgsiqd.supabase.co/functions/v1/optimize',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + finalToken,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        adressen: adressenList,
                        datum: datum 
                    })
                }
            );
            
            const result = await response.json();
            
            console.log('Response status:', response.status);
            console.log('Response result:', result);
            
            if (!response.ok) {
                throw new Error(result.error || 'Er ging iets mis met de AI');
            }
            
            if (!result.success) {
                throw new Error(result.error || 'AI optimalisatie mislukt');
            }
            
            let nieuweVolgorde = result.volgorde;
            
            if (!nieuweVolgorde || nieuweVolgorde.length === 0) {
                throw new Error('Geen geldige volgorde ontvangen van AI');
            }
            
            // Debug logs
            var huidigeVolgorde = adressenList.map(function(a) { return a.id; });
            console.log('Huidige volgorde:', huidigeVolgorde);
            console.log('Nieuwe volgorde:', nieuweVolgorde);
            
            // Controleer of de volgorde verandert
            var isGelijk = JSON.stringify(huidigeVolgorde) === JSON.stringify(nieuweVolgorde);
            if (isGelijk) {
                alert('De AI heeft geen betere volgorde gevonden. De huidige volgorde is al optimaal.');
                btn.textContent = origText;
                btn.disabled = false;
                return;
            }
            
            // Sla de nieuwe volgorde op
            for (var i = 0; i < nieuweVolgorde.length; i++) {
                var planningId = nieuweVolgorde[i];
                var volgorde = i + 1;
                
                var updateResult = await window.supabase
                    .from('planningen')
                    .update({ dag_volgorde: volgorde })
                    .eq('id', planningId);
                
                if (updateResult.error) throw updateResult.error;
            }
            
            alert('Route geoptimaliseerd! De volgorde is aangepast op basis van AI-advies.');
            
            // Herlaad de planning
            await laadPlanningen();
            
            // Scroll naar de datum header
            var datumHeader = document.querySelector('.datum-header[data-datum="' + datum + '"]');
            if (datumHeader) {
                datumHeader.scrollIntoView({ behavior: 'smooth', block: 'center' });
                datumHeader.style.transition = 'background-color 0.5s';
                datumHeader.style.backgroundColor = '#d4edda';
                setTimeout(function() {
                    datumHeader.style.backgroundColor = '';
                }, 2000);
            }
            
        } catch (err) {
            console.error('AI optimalisatie fout:', err);
            alert('Fout bij AI optimalisatie: ' + err.message);
        } finally {
            btn.textContent = origText;
            btn.disabled = false;
        }
    }
    
    // Laad alle planningen, gesorteerd op datum (nieuwste eerst)
    async function laadPlanningen() {
        if (!planningLijst) return;
        
        planningLijst.innerHTML = '<p>Laden...</p>';
        
        // Eerst chauffeurs laden als die nog niet geladen zijn
        if (chauffeurs.length === 0) {
            await laadChauffeurs();
        }
        
        const { data, error } = await window.supabase
            .from('planningen')
            .select(`
                *,
                adres:adres_id (id, instelling_naam, straat, postcode, plaats, telefoon, extra_info)
            `)
            .order('datum', { ascending: false })
            .order('dag_volgorde', { ascending: true })
            .order('id', { ascending: true });
        
        if (error) {
            planningLijst.innerHTML = `<p class="error">Fout bij laden: ${error.message}</p>`;
            return;
        }
        
        allePlanningen = data || [];
        planningLijst.innerHTML = '';
        
        if (!data || data.length === 0) {
            planningLijst.innerHTML = '<p>Geen planningen gevonden. Klik op "+ Nieuwe planning" om er een toe te voegen.</p>';
            return;
        }
        
        // Groepeer per datum
        const datumGroepen = {};
        for (const planning of data) {
            if (!datumGroepen[planning.datum]) {
                datumGroepen[planning.datum] = [];
            }
            datumGroepen[planning.datum].push(planning);
        }
        
        // Toon planningen met per datum opnieuw beginnende nummering
        for (const datum of Object.keys(datumGroepen)) {
            const datumObj = new Date(datum + 'T00:00:00');
            const dagVanWeek = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'][datumObj.getDay()];
            const items = datumGroepen[datum];
            const opgeslagenChauffeur = getChauffeurForDate(datum);
            
            // Datum header met chauffeur selector en AI knop
            const datumHeader = document.createElement('div');
            datumHeader.className = 'datum-header';
            datumHeader.dataset.datum = datum;
            datumHeader.innerHTML = `
                <div class="datum-header-content">
                    <span class="datum-dag">${dagVanWeek}</span>
                    <span class="datum-datum">${datumObj.getDate()} ${datumObj.toLocaleString('nl-NL', { month: 'long' })} ${datumObj.getFullYear()}</span>
                    <span class="datum-count">${items.length} ritten</span>
                </div>
                <div class="datum-actions">
                    <div class="chauffeur-selector-wrapper">
                        <label>👨‍✈️ Chauffeur:</label>
                        ${generateChauffeurDropdown(opgeslagenChauffeur)}
                    </div>
                    <button class="btn btn-success markeer-dag-btn" data-datum="${datum}">✅ Uitgevoerd</button>
                    <button class="btn btn-primary whatsapp-dag-btn" data-datum="${datum}">📱 WhatsApp</button>
                    <button class="btn btn-primary ai-optimize-btn" data-datum="${datum}">🤖 AI Optimaliseer</button>
                    <button class="btn btn-secondary pdf-dag-btn" data-datum="${datum}">📄 PDF Route</button>
                </div>
            `;
            planningLijst.appendChild(datumHeader);
            
            // Event listener voor chauffeur selectie
            const chauffeurSelect = datumHeader.querySelector('.chauffeur-select');
            if (chauffeurSelect) {
                chauffeurSelect.dataset.datum = datum;
                chauffeurSelect.addEventListener('change', (e) => {
                    saveChauffeurForDate(datum, e.target.value);
                });
            }
            
            // Event listeners voor dag acties
            datumHeader.querySelector('.markeer-dag-btn').addEventListener('click', () => markeerDagUitgevoerd(datum));
            datumHeader.querySelector('.whatsapp-dag-btn').addEventListener('click', () => genereerWhatsAppVoorDatum(datum));
            datumHeader.querySelector('.ai-optimize-btn').addEventListener('click', () => optimaliseerMetAI(datum));
            datumHeader.querySelector('.pdf-dag-btn').addEventListener('click', () => genereerPDFVoorDatum(datum));
            
            // Planning items voor deze datum
            for (let i = 0; i < items.length; i++) {
                const planning = items[i];
                const item = document.createElement('div');
                item.className = 'planning-item sortable-item';
                item.dataset.id = planning.id;
                item.dataset.datum = planning.datum;
                item.dataset.volgorde = planning.dag_volgorde || (i + 1);
                
                let statusClass = planning.status === 'gepland' ? 'status-gepland' : 
                                 (planning.status === 'uitgevoerd' ? 'status-uitgevoerd' : 'status-geannuleerd');
                
                let extraInfo = '';
                if (planning.type === 'ophaling' && planning.aantal_tonnen) {
                    extraInfo = `<p>📦 <strong>Aantal volle tonnen:</strong> ${planning.aantal_tonnen} stuks</p>`;
                } else if (planning.type === 'plaatsing' && planning.aantal_lege_tonnen) {
                    extraInfo = `<p>🚚 <strong>Aantal lege tonnen meenemen:</strong> ${planning.aantal_lege_tonnen} stuks</p>`;
                }
                
                let extraInfoText = '';
                if (planning.adres?.extra_info) {
                    extraInfoText = `<p class="adres-extra-info">📝 ${escapeHtml(planning.adres.extra_info)}</p>`;
                }
                
                let telefoonText = '';
                if (planning.adres?.telefoon) {
                    telefoonText = `<p>📞 ${escapeHtml(planning.adres.telefoon)}</p>`;
                }
                
                const volgnummer = (planning.dag_volgorde || (i + 1));
                
                item.innerHTML = `
                    <div class="planning-info">
                        <div class="planning-header">
                            <span class="drag-handle">⠿</span>
                            <span class="stop-number-badge">#${volgnummer}</span>
                            <h4>${planning.type === 'ophaling' ? '📦 Ophaling' : '🚚 Plaatsing'}</h4>
                            <span class="planning-status ${statusClass}">${getStatusText(planning.status)}</span>
                        </div>
                        <p><strong>${escapeHtml(planning.adres?.instelling_naam || 'Onbekend')}</strong></p>
                        <p>📍 ${escapeHtml(planning.adres?.straat || '')}, ${escapeHtml(planning.adres?.postcode || '')} ${escapeHtml(planning.adres?.plaats || '')}</p>
                        ${telefoonText}
                        ${extraInfo}
                        ${extraInfoText}
                        ${planning.opmerkingen ? `<p>📝 ${escapeHtml(planning.opmerkingen)}</p>` : ''}
                    </div>
                    <div class="planning-buttons">
                        <select class="status-select" data-id="${planning.id}">
                            <option value="gepland" ${planning.status === 'gepland' ? 'selected' : ''}>Gepland</option>
                            <option value="uitgevoerd" ${planning.status === 'uitgevoerd' ? 'selected' : ''}>Uitgevoerd</option>
                            <option value="geannuleerd" ${planning.status === 'geannuleerd' ? 'selected' : ''}>Geannuleerd</option>
                        </select>
                        <button class="btn btn-secondary edit-planning-btn" data-id="${planning.id}">✏️</button>
                        <button class="btn btn-danger delete-planning-btn" data-id="${planning.id}">🗑️</button>
                    </div>
                `;
                planningLijst.appendChild(item);
            }
        }
        
        // Event listeners voor status, bewerken, verwijderen
        document.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', (e) => updateStatus(e.target.dataset.id, e.target.value));
        });
        document.querySelectorAll('.edit-planning-btn').forEach(btn => {
            btn.addEventListener('click', () => bewerkPlanning(btn.dataset.id));
        });
        document.querySelectorAll('.delete-planning-btn').forEach(btn => {
            btn.addEventListener('click', () => verwijderPlanning(btn.dataset.id));
        });
        
        // Initialiseer SortableJS
        initSortable();
    }
    
    // Initialiseer SortableJS
    function initSortable() {
        const list = document.getElementById('planningLijst');
        if (!list) return;
        
        if (sortableInstance) {
            sortableInstance.destroy();
        }
        
        sortableInstance = new Sortable(list, {
            handle: '.drag-handle',
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            filter: '.datum-header',
            preventOnFilter: false,
            onEnd: function(evt) {
                updateStopNumbers();
                const datum = evt.item.dataset.datum;
                if (datum) {
                    saveRouteOrderForDate(datum);
                }
            }
        });
    }
    
    // Update de stop nummers
    function updateStopNumbers() {
        const items = document.querySelectorAll('.planning-item');
        let currentDatum = '';
        let teller = 0;
        
        items.forEach(item => {
            const datum = item.dataset.datum;
            if (datum !== currentDatum) {
                currentDatum = datum;
                teller = 1;
            } else {
                teller++;
            }
            const badge = item.querySelector('.stop-number-badge');
            if (badge) {
                badge.textContent = `#${teller}`;
            }
            item.dataset.volgorde = teller;
        });
    }
    
    // Sla de route volgorde op voor een specifieke datum
    async function saveRouteOrderForDate(datum) {
        const items = document.querySelectorAll(`.planning-item[data-datum="${datum}"]`);
        const updates = [];
        
        items.forEach((item, index) => {
            const id = parseInt(item.dataset.id);
            const volgorde = index + 1;
            updates.push({ id, volgorde });
        });
        
        if (updates.length === 0) return;
        
        try {
            for (const update of updates) {
                const { error } = await window.supabase
                    .from('planningen')
                    .update({ dag_volgorde: update.volgorde })
                    .eq('id', update.id);
                
                if (error) throw error;
            }
            console.log(`Volgorde voor ${datum} opgeslagen`);
        } catch (err) {
            console.error('Fout bij opslaan volgorde:', err);
        }
    }
    
    // Markeer alle ritten van een dag als uitgevoerd
    async function markeerDagUitgevoerd(datum) {
        const items = document.querySelectorAll(`.planning-item[data-datum="${datum}"]`);
        if (items.length === 0) return;
        
        if (!confirm(`Weet je zeker dat je alle ${items.length} ritten van ${datum} wilt markeren als uitgevoerd?`)) return;
        
        try {
            for (const item of items) {
                const id = parseInt(item.dataset.id);
                const { error } = await window.supabase
                    .from('planningen')
                    .update({ status: 'uitgevoerd' })
                    .eq('id', id);
                
                if (error) throw error;
            }
            
            alert(`Alle ritten van ${datum} gemarkeerd als uitgevoerd!`);
            laadPlanningen();
            
        } catch (err) {
            alert('Fout: ' + err.message);
        }
    }
    
    // Genereer WhatsApp bericht voor een specifieke datum
    function genereerWhatsAppVoorDatum(datum) {
        const items = document.querySelectorAll(`.planning-item[data-datum="${datum}"]`);
        if (items.length === 0) {
            alert('Geen ritten voor deze datum.');
            return;
        }
        
        // Haal de geselecteerde chauffeur voor deze datum
        const chauffeurSelect = document.querySelector(`.datum-header[data-datum="${datum}"] .chauffeur-select`);
        const chauffeurTel = chauffeurSelect ? chauffeurSelect.value : '';
        
        if (!chauffeurTel) {
            alert('Selecteer eerst een chauffeur voor deze dag via de dropdown bij de datum header.');
            return;
        }
        
        // Verzamel de planning data voor deze datum
        const planningData = [];
        items.forEach(item => {
            const id = parseInt(item.dataset.id);
            const planning = allePlanningen.find(p => p.id === id);
            if (planning) {
                planningData.push(planning);
            }
        });
        
        // Genereer WhatsApp bericht
        const datumObj = new Date(datum + 'T00:00:00');
        const datumStr = datumObj.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        let bericht = `🚚 *PROJECT ROUTE PLANNING* 🚚\n\n`;
        bericht += `📅 *Datum:* ${datumStr}\n`;
        bericht += `📍 *START & EINDE:* Schoonmansveld 48, 2870 Puurs\n\n`;
        bericht += `*📋 CIRCULAIRE ROUTE (${planningData.length} stops)*\n`;
        bericht += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        // Bouw de adreslijst voor de route links
        const adressenVoorRoute = [];
        
        planningData.forEach((planning, index) => {
            const stopNumber = planning.dag_volgorde || (index + 1);
            const adresString = `${planning.adres?.straat || ''}, ${planning.adres?.postcode || ''} ${planning.adres?.plaats || ''}`;
            adressenVoorRoute.push(adresString);
            
            bericht += `${stopNumber}. *${planning.adres?.instelling_naam || 'Onbekend'}*\n`;
            bericht += `   📍 ${planning.adres?.straat || ''}\n`;
            bericht += `   📮 ${planning.adres?.postcode || ''} ${planning.adres?.plaats || ''}\n`;
            if (planning.type === 'ophaling') {
                bericht += `   📦 OPHALING: ${planning.aantal_tonnen || 1} volle ton(nen)\n`;
            } else if (planning.type === 'plaatsing') {
                bericht += `   🚚 PLAATSING: ${planning.aantal_lege_tonnen || 1} lege ton(nen)\n`;
            }
            if (planning.adres?.telefoon) {
                bericht += `   📞 Contact: ${planning.adres.telefoon}\n`;
            }
            if (planning.adres?.extra_info) {
                bericht += `   📝 *EXTRA INFO:* ${planning.adres.extra_info}\n`;
            }
            if (planning.opmerkingen) {
                bericht += `   📋 *OPMERKINGEN:* ${planning.opmerkingen}\n`;
            }
            bericht += `\n`;
        });
        
        // Na de laatste stop: terug naar basis
        bericht += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        bericht += `${planningData.length + 1}. *TERUGKEER NAAR BASIS*\n`;
        bericht += `   📍 Schoonmansveld 48, 2870 Puurs\n`;
        bericht += `   🏁 EINDE RIT\n\n`;
        
        bericht += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        
        // ===== GOOGLE MAPS LINK (Cross-platform met alle stops) =====
        bericht += `🗺️ *OPEN IN GOOGLE MAPS:*\n`;
        
        let googleMapsUrl = 'https://www.google.com/maps/dir/?api=1&origin=';
        googleMapsUrl += encodeURIComponent('Schoonmansveld 48, 2870 Puurs');
        
        if (adressenVoorRoute.length === 0) {
            googleMapsUrl += '&destination=' + encodeURIComponent('Schoonmansveld 48, 2870 Puurs');
        } else {
            // Eerste stop wordt de eerste waypoint
            // Laatste stop wordt de destination
            // Terug naar basis wordt een extra waypoint
            const laatsteAdres = adressenVoorRoute[adressenVoorRoute.length - 1];
            googleMapsUrl += '&destination=' + encodeURIComponent(laatsteAdres);
            
            // Alle stops behalve de laatste zijn waypoints
            if (adressenVoorRoute.length > 1) {
                const waypoints = adressenVoorRoute.slice(0, -1);
                googleMapsUrl += '&waypoints=' + waypoints.map(w => encodeURIComponent(w)).join('%7C');
            }
            
            // Voeg het eindpunt toe als extra waypoint (terug naar basis)
            googleMapsUrl += '&waypoints=' + encodeURIComponent('Schoonmansveld 48, 2870 Puurs');
        }
        
        googleMapsUrl += '&travelmode=driving';
        
        bericht += googleMapsUrl + '\n\n';
        
        bericht += `📌 *Instructie:* Klik op de link om de route te openen in Google Maps.\n`;
        bericht += `De route toont alle stops in de juiste volgorde.`;
        
        huidigeWhatsAppDatum = datum;
        
        if (whatsappBericht) whatsappBericht.value = bericht;
        whatsappPopup.style.display = 'flex';
    }
    
    // Update status
    async function updateStatus(id, nieuweStatus) {
        const { error } = await window.supabase.from('planningen').update({ status: nieuweStatus }).eq('id', id);
        if (error) alert('Fout: ' + error.message);
        else laadPlanningen();
    }
    
    // Verwijder planning
    async function verwijderPlanning(id) {
        if (!confirm('Weet je zeker dat je deze planning wilt verwijderen?')) return;
        const { error } = await window.supabase.from('planningen').delete().eq('id', id);
        if (error) alert('Fout: ' + error.message);
        else laadPlanningen();
    }
    
    // Bewerk planning
    async function bewerkPlanning(id) {
        const { data, error } = await window.supabase.from('planningen').select('*').eq('id', id).single();
        if (error) { alert('Fout: ' + error.message); return; }
        
        currentPlanningId = id;
        planningPopupTitle.textContent = 'Planning bewerken';
        await laadAdressen();
        vulAdresDropdown();
        
        typeSelect.value = data.type;
        adresSelect.value = data.adres_id;
        document.getElementById('planningDatum').value = data.datum;
        document.getElementById('aantalTonnen').value = data.aantal_tonnen || 1;
        document.getElementById('aantalLegeTonnen').value = data.aantal_lege_tonnen || 1;
        document.getElementById('opmerkingen').value = data.opmerkingen || '';
        
        ophalingVelden.style.display = data.type === 'ophaling' ? 'block' : 'none';
        plaatsingVelden.style.display = data.type === 'plaatsing' ? 'block' : 'none';
        planningPopup.style.display = 'flex';
    }
    
    // Nieuwe planning
    if (newPlanningBtn) {
        newPlanningBtn.addEventListener('click', async () => {
            currentPlanningId = null;
            planningPopupTitle.textContent = 'Nieuwe planning';
            await laadAdressen();
            vulAdresDropdown();
            typeSelect.value = '';
            adresSelect.value = '';
            document.getElementById('planningDatum').value = new Date().toISOString().split('T')[0];
            document.getElementById('aantalTonnen').value = '1';
            document.getElementById('aantalLegeTonnen').value = '1';
            document.getElementById('opmerkingen').value = '';
            ophalingVelden.style.display = 'none';
            plaatsingVelden.style.display = 'none';
            planningPopup.style.display = 'flex';
        });
    }
    
    // Opslaan planning
    if (savePlanningBtn) {
        savePlanningBtn.addEventListener('click', async () => {
            const type = typeSelect?.value;
            const adresId = adresSelect?.value;
            const datum = document.getElementById('planningDatum')?.value;
            const aantalTonnen = document.getElementById('aantalTonnen')?.value;
            const aantalLegeTonnen = document.getElementById('aantalLegeTonnen')?.value;
            const opmerkingen = document.getElementById('opmerkingen')?.value;
            
            if (!type || !adresId || !datum) {
                alert('Vul alle verplichte velden in');
                return;
            }
            
            const planningData = { 
                adres_id: parseInt(adresId), 
                type, 
                datum, 
                opmerkingen: opmerkingen || null, 
                status: 'gepland',
                dag_volgorde: 0
            };
            
            if (type === 'ophaling') planningData.aantal_tonnen = parseInt(aantalTonnen) || 1;
            if (type === 'plaatsing') planningData.aantal_lege_tonnen = parseInt(aantalLegeTonnen) || 1;
            
            let error;
            if (currentPlanningId) {
                const result = await window.supabase.from('planningen').update(planningData).eq('id', currentPlanningId);
                error = result.error;
            } else {
                const result = await window.supabase.from('planningen').insert([planningData]);
                error = result.error;
            }
            
            if (error) alert('Fout: ' + error.message);
            else { planningPopup.style.display = 'none'; laadPlanningen(); }
        });
    }
    
    if (closePlanningPopup) closePlanningPopup.addEventListener('click', () => planningPopup.style.display = 'none');
    
    // WhatsApp versturen
    if (sendWhatsAppBtn) {
        sendWhatsAppBtn.addEventListener('click', () => {
            const chauffeurSelect = document.querySelector(`.datum-header[data-datum="${huidigeWhatsAppDatum}"] .chauffeur-select`);
            const telefoon = chauffeurSelect ? chauffeurSelect.value : '';
            const bericht = whatsappBericht?.value;
            
            if (!telefoon) {
                alert('Selecteer eerst een chauffeur voor deze dag in de datum header.');
                return;
            }
            
            let nummer = telefoon.replace(/\s/g, '').replace(/^0/, '32');
            if (!nummer.startsWith('+')) nummer = '+' + nummer;
            
            const whatsappUrl = `https://wa.me/${nummer}?text=${encodeURIComponent(bericht)}`;
            window.open(whatsappUrl, '_blank');
        });
    }
    
    if (copyBerichtBtn) {
        copyBerichtBtn.addEventListener('click', () => {
            whatsappBericht.select();
            document.execCommand('copy');
            alert('Bericht gekopieerd!');
        });
    }
    
    if (closeWhatsappPopup) {
        closeWhatsappPopup.addEventListener('click', () => {
            whatsappPopup.style.display = 'none';
        });
    }
    
    window.addEventListener('click', (e) => {
        if (e.target === planningPopup) planningPopup.style.display = 'none';
        if (e.target === whatsappPopup) whatsappPopup.style.display = 'none';
    });
    
    function getStatusText(status) {
        switch(status) {
            case 'gepland': return 'Gepland';
            case 'uitgevoerd': return 'Uitgevoerd';
            case 'geannuleerd': return 'Geannuleerd';
            default: return status;
        }
    }
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Initialiseer
    laadPlanningen();
    
});