// ============================================================
// DASHBOARD - Hoofd dashboard logica
// ============================================================
console.log('🚀 dashboard.js wordt geladen...');

import { requireAuth, getGebruikersnaam } from './core/auth.js';
import { showToast } from './core/utils.js';
import { supabase } from './core/supabase.js';

// ===== MODULES IMPORTEREN =====
import { laadAgenda, vorigeMaand, volgendeMaand, gaNaarVandaag } from './modules/dashboard/agenda.js';
import { laadOphalingAnalyse } from './modules/dashboard/voorspelling.js';
import { laadActieLijst } from './modules/dashboard/actie.js';
import { laadZiekenhuisOverzicht } from './modules/dashboard/ziekenhuis-overzicht.js'; // <-- NIEUW

console.log('✅ Alle modules geïmporteerd!');

// ============================================================
// INITIALISATIE
// ============================================================
document.addEventListener('DOMContentLoaded', async function() {
  console.log('📄 DOM geladen, dashboard start...');

  // 1. Controleer of gebruiker is ingelogd
  const auth = await requireAuth('index.html');
  if (!auth.isAuthenticated) {
    console.warn('⚠️ Niet ingelogd, redirect...');
    return;
  }

  // 2. Toon gebruikersnaam
  if (auth.user) {
    const naam = await getGebruikersnaam(auth.user.id);
    const userEmailEl = document.getElementById('userEmail');
    if (userEmailEl) {
      userEmailEl.textContent = naam || auth.user.email || 'Gebruiker';
    }
  }

  // 3. Laad alle dashboard onderdelen
  console.log('📊 Dashboard onderdelen laden...');

  // Agenda
  await laadAgenda();

  // Voorspellingen
  await laadOphalingAnalyse();

  // Actie lijst (proactief bellen)
  await laadActieLijst();

  // ZIEKENHUIS OVERZICHT (nieuw)
  await laadZiekenhuisOverzicht();

  console.log('✅ Dashboard geladen!');

  // ============================================================
  // EVENT LISTENERS
  // ============================================================

  // Agenda navigatie
  const prevBtn = document.getElementById('prevMonthBtn');
  const nextBtn = document.getElementById('nextMonthBtn');
  const todayBtn = document.getElementById('todayBtn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      vorigeMaand();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      volgendeMaand();
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      gaNaarVandaag();
    });
  }

  // Filter voor voorspellingen
  const filterEl = document.getElementById('voorspellingFilter');
  if (filterEl) {
    filterEl.addEventListener('change', () => {
      laadOphalingAnalyse();
    });
  }

  // Statistieken knop
  const statsBtn = document.getElementById('statsBtn');
  if (statsBtn) {
    statsBtn.addEventListener('click', () => {
      window.location.href = 'analytics.html';
    });
  }
});

console.log('✅ dashboard.js geladen!');