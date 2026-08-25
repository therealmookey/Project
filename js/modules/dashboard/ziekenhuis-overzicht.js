// ============================================================
// MODULE - ZIEKENHUIS OVERZICHT (Met filter en verbeterde styling)
// ============================================================
console.log('🏥 Ziekenhuis overzicht module geladen!');

const supabase = window.supabase;
let alleZiekenhuizen = []; // Alle data opslaan voor filtering

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
  const statusClass = statusType === 'actief' ? 'status-actief' : 
                      (statusType === 'onvoldoende' ? 'status-onvoldoende' : 'status-geen');

  let contactInfo = '';
  if (item.telefoon || item.contactpersoon_naam) {
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
        <span>📊 Gem. interval: ${item.gemiddeld_betrouwbaar_interval} dagen</span>
        <span>⚖️ ${item.totaal_gewicht || 0} kg</span>
        <span>📅 Laatste: ${formatDate(item.laatste_ophaling)}</span>
      </div>
    `;
  } else if (statusType === 'onvoldoende') {
    dataInfo = `
      <div class="data-info">
        <span>📦 ${item.aantal_ophalingen || 0} ophalingen</span>
        <span>${item.status_toelichting || 'Onvoldoende data voor betrouwbare voorspelling.'}</span>
      </div>
    `;
  } else {
    dataInfo = `
      <div class="data-info">
        <span>${item.status_toelichting || 'Nog geen ophalingen geregistreerd.'}</span>
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
        ${item.extra_info ? `<br><span class="extra-info">📝 ${escapeHtml(item.extra_info)}</span>` : ''}
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

    // Sla alle data op voor filtering
    alleZiekenhuizen = data;

    // Bouw de filterbalk en de lijst
    toonOverzichtMetFilter(alleZiekenhuizen, container);

  } catch (err) {
    console.error('Fout bij laden overzicht:', err);
    container.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
  }
}

// ===== OVERZICHT TONEN MET FILTER =====
function toonOverzichtMetFilter(data, container) {
  const filterWaarde = document.getElementById('overzichtLimit')?.value || '10';
  const limit = filterWaarde === 'alles' ? data.length : parseInt(filterWaarde);

  // Groepeer op status
  const actief = data.filter(item => item.status === '✅ Actief').slice(0, limit);
  const onvoldoende = data.filter(item => item.status === '⚠️ Onvoldoende data').slice(0, limit);
  const geenData = data.filter(item => item.status === '❌ Geen ophalingen').slice(0, limit);

  let html = `
    <div class="ziekenhuis-overzicht">
      <div class="overzicht-header">
        <h3>🏥 Alle ziekenhuizen</h3>
        <div class="overzicht-filter">
          <label for="overzichtLimit">Toon:</label>
          <select id="overzichtLimit" class="form-input">
            <option value="5">5 ziekenhuizen</option>
            <option value="10" selected>10 ziekenhuizen</option>
            <option value="15">15 ziekenhuizen</option>
            <option value="alles">Alle ziekenhuizen</option>
          </select>
          <span class="overzicht-totaal">${data.length} totaal</span>
        </div>
      </div>

      <!-- Samenvatting badges -->
      <div class="status-badges">
        <span class="badge status-actief">✅ ${data.filter(item => item.status === '✅ Actief').length} actief</span>
        <span class="badge status-onvoldoende">⚠️ ${data.filter(item => item.status === '⚠️ Onvoldoende data').length} onvoldoende data</span>
        <span class="badge status-geen">❌ ${data.filter(item => item.status === '❌ Geen ophalingen').length} geen ophalingen</span>
      </div>
  `;

  // SECTIE 1: Actieve ziekenhuizen
  if (actief.length > 0) {
    html += `
      <div class="status-sectie">
        <details open>
          <summary><strong>✅ Actieve ziekenhuizen</strong> (${data.filter(item => item.status === '✅ Actief').length})</summary>
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

  // SECTIE 2: Onvoldoende data
  if (onvoldoende.length > 0) {
    html += `
      <div class="status-sectie">
        <details open>
          <summary><strong>⚠️ Onvoldoende data</strong> (${data.filter(item => item.status === '⚠️ Onvoldoende data').length})</summary>
          <div class="ziekenhuis-lijst">
    `;
    onvoldoende.forEach(item => {
      html += toonZiekenhuisKaart(item, 'onvoldoende');
    });
    html += `
          </div>
        </details>
      </div>
    `;
  }

  // SECTIE 3: Geen ophalingen
  if (geenData.length > 0) {
    html += `
      <div class="status-sectie">
        <details open>
          <summary><strong>❌ Geen ophalingen</strong> (${data.filter(item => item.status === '❌ Geen ophalingen').length})</summary>
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

  // Event listener voor de filter
  const filterSelect = document.getElementById('overzichtLimit');
  if (filterSelect) {
    filterSelect.addEventListener('change', function() {
      toonOverzichtMetFilter(alleZiekenhuizen, container);
    });
  }
}

// ===== CONTACT POPUP =====
function toonContactPopup(naam, telefoon, email) {
  const popup = document.getElementById('contactPopup');
  if (!popup) {
    // Maak popup als die niet bestaat
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

// ===== EXPORT =====
export default {
  laadZiekenhuisOverzicht
};