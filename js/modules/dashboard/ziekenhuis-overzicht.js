// ============================================================
// MODULE - ZIEKENHUIS OVERZICHT (TESTVERSIE)
// ============================================================
console.log('🏥 Ziekenhuis overzicht module geladen!');

export async function laadZiekenhuisOverzicht() {
  console.log('🏥 laadZiekenhuisOverzicht aangeroepen!');
  
  const container = document.getElementById('ziekenhuisOverzicht');
  if (!container) {
    console.error('❌ Container "ziekenhuisOverzicht" niet gevonden!');
    return;
  }

  try {
    // Eerst een simpele testmelding tonen
    container.innerHTML = '<p>✅ Test: Module werkt! Nu data laden...</p>';

    // Probeer data op te halen
    const { data, error } = await window.supabase
      .from('ziekenhuis_status')
      .select('*')
      .limit(5);

    if (error) {
      console.error('❌ Fout bij laden:', error);
      container.innerHTML = `<p class="error">Fout: ${error.message}</p>`;
      return;
    }

    console.log('📊 Data ontvangen:', data);

    if (!data || data.length === 0) {
      container.innerHTML = '<p>⚠️ Geen data gevonden. Controleer of de view "ziekenhuis_status" bestaat.</p>';
      return;
    }

    // Toon een simpele lijst
    let html = '<h4>📋 Eerste 5 ziekenhuizen:</h4><ul>';
    data.forEach(item => {
      html += `<li>${item.instelling_naam} - ${item.status || 'Onbekend'}</li>`;
    });
    html += '</ul>';
    container.innerHTML = html;

  } catch (err) {
    console.error('❌ Fout:', err);
    container.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
  }
}

export default {
  laadZiekenhuisOverzicht
};