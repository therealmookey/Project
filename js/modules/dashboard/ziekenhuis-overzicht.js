// ============================================================
// MODULE - ZIEKENHUIS OVERZICHT (Aangepast voor nieuwe statussen)
// ============================================================
console.log('🏥 Ziekenhuis overzicht module geladen!');

const supabase = window.supabase;

// ===== HULPFUNCTIES =====
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('nl-NL');
}

function toonZiekenhuisKaart(item, statusType) {
  // Bepaal de CSS-klasse op basis van de status
  let statusClass = 'status-';
  if (item.status === '✅ Actief') {
    statusClass += 'actief';
  } else if (item.status === '⚠️ Onvoldoende ophalingen' || item.status === '⚠️ Onvoldoende intervallen') {
    statusClass += 'onvoldoende';
  } else if (item.status === '❌ Geen ophalingen') {
    statusClass += 'geen';
  } else {
    statusClass += 'onbekend';
  }

  // 🔥 CONTACTKNOP: Alleen tonen bij Actief of Onvoldoende (dus NIET bij "Geen ophalingen")
  let contactInfo = '';
  const heeftContactGegevens = item.telefoon || item.contactpersoon_naam || item.contactpersoon_email;
  const toonContactKnop = item.status !== '❌ Geen ophalingen' && heeftContactGegevens;

  if (toonContactKnop) {
    contactInfo = `
      <div class="contact-info">
        ${item.contactpersoon_naam ? `<span>👤 ${escapeHtml(item.contactpersoon_naam)}</span>` : ''}
        ${item.telefoon ? `<span>📞 ${escapeHtml(item.telefoon)}</span>` : ''}
        ${item.contactpersoon_email ? `<span>✉️ ${escapeHtml(item.contactpersoon_email)}</span>` : ''}
        <button class="btn btn-secondary btn-small contact-btn" 
                data-naam="${escapeHtml(item.instelling_naam)}" 
                data-telefoon="${escapeHtml(item.telefoon || '')}" 
                data-email="${escapeHtml(item.contactpersoon_email || '')}">
          📞 Contact
        </button>
      </div>
    `;
  }

  let dataInfo = '';
  if (statusType === 'actief') {
    dataInfo = `
      <div class="data-info">
        <span>📦 ${item.aantal_ophalingen} ophalingen</span>
        <span>📊 Gem. interval: ${item.gemiddeld_betrouwbaar_interval || '?'} dagen</span>
        <span>⚖️ ${item.totaal_gewicht || 0} kg</span>
        <span>📅 Laatste: ${formatDate(item.laatste_ophaling)}</span>
        ${item.rendabiliteit ? `<span>📈 ${item.rendabiliteit}</span>` : ''}
      </div>
    `;
  } else if (item.status === '⚠️ Onvoldoende ophalingen' || item.status === '⚠️ Onvoldoende intervallen') {
    dataInfo = `
      <div class="data-info">
        <span>📦 ${item.aantal_ophalingen || 0} ophalingen</span>
        ${item.gemiddeld_betrouwbaar_interval ? `<span>📊 Gem. interval: ${item.gemiddeld_betrouwbaar_interval} dagen</span>` : ''}
        ${item.laatste_ophaling ? `<span>📅 Laatste: ${formatDate(item.laatste_ophaling)}</span>` : ''}
        ${item.dagen_sinds_laatste ? `<span>⏳ ${item.dagen_sinds_laatste} dagen geleden</span>` : ''}
        ${item.rendabiliteit ? `<span>📈 ${item.rendabiliteit}</span>` : ''}
        <span class="status-toelichting">${escapeHtml(item.status_toelichting || '')}</span>
      </div>
    `;
  } else {
    // '❌ Geen ophalingen' of onbekend
    dataInfo = `
      <div class="data-info">
        <span>${item.status_toelichting || 'Nog geen ophalingen geregistreerd.'}</span>
        ${item.rendabiliteit ? `<span>📈 ${item.rendabiliteit}</span>` : ''}
      </div>
    `;
  }

  return `
    <div class="ziekenhuis-item ${statusClass}">
      <div class="ziekenhuis-header">
        <strong>${escapeHtml(item.instelling_naam)}</strong>
        <span class="status-label">${item.status}</span>
      </div>
      <div class="ziekenhuis-adres">
        📍 ${escapeHtml(item.straat)}, ${escapeHtml(item.postcode)} ${escapeHtml(item.plaats)}
      </div>
      ${dataInfo}
      ${contactInfo}
    </div>
  `;
}

// ===== HOOFDFUNCTIE: OVERZICHT LADEN =====
export async function laadZiekenhuisOverzicht() {
  const container = document.getElementById('ziekenhuisOverzicht');
  if (!container) {
    console.warn('ziekenhuisOverzicht element niet gevonden');
    return;
  }

  console.log('🏥 Ziekenhuis overzicht wordt geladen...');
  container.innerHTML = '<p>Bezig met laden...</p>';

  try {
    const { data, error } = await supabase
      .from('ziekenhuis_status')
      .select('*');

    if (error) {
      console.error('Fout bij laden overzicht:', error);
      container.innerHTML = `<p class="error">Fout bij laden: ${error.message}</p>`;
      return;
    }

    if (!data || data.length === 0) {
      container.innerHTML = '<p>Geen ziekenhuizen gevonden.</p>';
      return;
    }

    // Groepeer op status (exacte tekst van de view)
    const actief = data.filter(item => item.status === '✅ Actief');
    const onvoldoendeOphalingen = data.filter(item => item.status === '⚠️ Onvoldoende ophalingen');
    const onvoldoendeIntervallen = data.filter(item => item.status === '⚠️ Onvoldoende intervallen');
    const geenData = data.filter(item => item.status === '❌ Geen ophalingen');

    let html = `
      <div class="ziekenhuis-overzicht">
        <div class="overzicht-header">
          <h3>🏥 Alle ziekenhuizen</h3>
          <span class="overzicht-totaal">${data.length} totaal</span>
        </div>

        <!-- Samenvatting badges -->
        <div class="status-badges">
          <span class="badge status-actief">✅ ${actief.length} actief</span>
          <span class="badge status-onvoldoende">⚠️ ${onvoldoendeOphalingen.length + onvoldoendeIntervallen.length} onvoldoende</span>
          <span class="badge status-geen">❌ ${geenData.length} geen ophalingen</span>
        </div>
    `;

    // SECTIE 1: Actieve ziekenhuizen
    if (actief.length > 0) {
      html += `
        <div class="status-sectie">
          <details>
            <summary><strong>✅ Actieve ziekenhuizen</strong> (${actief.length})</summary>
            <div class="ziekenhuis-lijst">
      `;
      actief.forEach(item => {
        html += toonZiekenhuisKaart(item, 'actief');
      });
      html += `
            </div>
          </details>
        </div>
      `;
    }

    // SECTIE 2: Onvoldoende ophalingen
    if (onvoldoendeOphalingen.length > 0) {
      html += `
        <div class="status-sectie">
          <details>
            <summary><strong>⚠️ Onvoldoende ophalingen</strong> (${onvoldoendeOphalingen.length})</summary>
            <div class="ziekenhuis-lijst">
      `;
      onvoldoendeOphalingen.forEach(item => {
        html += toonZiekenhuisKaart(item, 'onvoldoende');
      });
      html += `
            </div>
          </details>
        </div>
      `;
    }

    // SECTIE 3: Onvoldoende intervallen
    if (onvoldoendeIntervallen.length > 0) {
      html += `
        <div class="status-sectie">
          <details>
            <summary><strong>⚠️ Onvoldoende intervallen</strong> (${onvoldoendeIntervallen.length})</summary>
            <div class="ziekenhuis-lijst">
      `;
      onvoldoendeIntervallen.forEach(item => {
        html += toonZiekenhuisKaart(item, 'onvoldoende');
      });
      html += `
            </div>
          </details>
        </div>
      `;
    }

    // SECTIE 4: Geen ophalingen
    if (geenData.length > 0) {
      html += `
        <div class="status-sectie">
          <details>
            <summary><strong>❌ Geen ophalingen</strong> (${geenData.length})</summary>
            <div class="ziekenhuis-lijst">
      `;
      geenData.forEach(item => {
        html += toonZiekenhuisKaart(item, 'geen');
      });
      html += `
            </div>
          </details>
        </div>
      `;
    }

    html += `
      </div>
    `;

    container.innerHTML = html;

    // Event listeners voor contactknoppen
    document.querySelectorAll('.contact-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const naam = this.dataset.naam;
        const telefoon = this.dataset.telefoon;
        const email = this.dataset.email;
        toonContactPopup(naam, telefoon, email);
      });
    });

  } catch (err) {
    console.error('Fout bij laden overzicht:', err);
    container.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
  }
}

// ===== CONTACT POPUP =====
function toonContactPopup(naam, telefoon, email) {
  const popup = document.getElementById('contactPopup');
  if (!popup) {
    const newPopup = document.createElement('div');
    newPopup.id = 'contactPopup';
    newPopup.className = 'popup';
    newPopup.innerHTML = `
      <div class="popup-content">
        <h3>📞 Contact</h3>
        <p><strong>Ziekenhuis:</strong> <span id="contactNaam"></span></p>
        <p><strong>Telefoon:</strong> <span id="contactTelefoon"></span></p>
        <p><strong>E-mail:</strong> <span id="contactEmail"></span></p>
        <div style="display:flex; gap:10px; margin-top:1rem; flex-wrap:wrap;">
          <button id="contactBelBtn" class="btn btn-primary">📞 Bellen</button>
          <button id="contactMailBtn" class="btn btn-secondary">✉️ E-mail</button>
          <button id="closeContactPopup" class="btn btn-secondary">Sluiten</button>
        </div>
      </div>
    `;
    document.body.appendChild(newPopup);

    document.getElementById('closeContactPopup').addEventListener('click', () => {
      newPopup.style.display = 'none';
    });

    document.getElementById('contactBelBtn').addEventListener('click', () => {
      const tel = document.getElementById('contactTelefoon').textContent;
      if (tel && tel !== '-') {
        window.location.href = `tel:${tel}`;
      } else {
        alert('Geen telefoonnummer beschikbaar.');
      }
    });

    document.getElementById('contactMailBtn').addEventListener('click', () => {
      const email = document.getElementById('contactEmail').textContent;
      if (email && email !== '-') {
        window.location.href = `mailto:${email}`;
      } else {
        alert('Geen e-mailadres beschikbaar.');
      }
    });

    window.addEventListener('click', (e) => {
      if (e.target === newPopup) {
        newPopup.style.display = 'none';
      }
    });
  }

  document.getElementById('contactNaam').textContent = naam || '-';
  document.getElementById('contactTelefoon').textContent = telefoon || '-';
  document.getElementById('contactEmail').textContent = email || '-';
  popup.style.display = 'flex';
}

export default {
  laadZiekenhuisOverzicht
};