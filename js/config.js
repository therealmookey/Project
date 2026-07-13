// ===== SUPABASE CONFIGURATIE =====
const SUPABASE_URL = 'https://jcdqcgviossmrvlgsiqd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_BhTGDyLsGeHEMConkTeqcg_LHK5pLoG';

// ===== OPENROUTER CONFIGURATIE =====
// De API key wordt opgehaald uit localStorage (veiliger)
// Voeg je key toe via de console: localStorage.setItem('openrouter_key', 'jouw-key')
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('✅ Supabase client geladen!');