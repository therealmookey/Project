// supabase-client.js
// Dit bestand bevat de Supabase client setup

const SUPABASE_URL = 'https://jcdqcgviossmrvlgsiqd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_BhTGDyLsGeHEMConkTeqcg_LHK5pLoG';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
export const TABLE_NAME = 'locations_test';

// Helper: Stuur een locatie naar Supabase
export async function sendLocation(driverId, latitude, longitude, driverName = null) {
    const { data, error } = await supabase
        .from(TABLE_NAME)
        .upsert({
            driver_id: driverId,
            driver_name: driverName || `Chauffeur ${driverId}`,
            latitude: latitude,
            longitude: longitude,
            last_updated: new Date().toISOString()
        });

    if (error) {
        console.error('Fout bij verzenden:', error);
        throw error;
    }
    return data;
}

// Helper: Luister naar locatie-updates
export function subscribeToLocations(onUpdate, onDelete = null) {
    const channel = supabase
        .channel('locations_test_changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: TABLE_NAME
            },
            (payload) => {
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    if (onUpdate) onUpdate(payload.new);
                } else if (payload.eventType === 'DELETE') {
                    if (onDelete) onDelete(payload.old);
                }
            }
        )
        .subscribe();

    return channel;
}