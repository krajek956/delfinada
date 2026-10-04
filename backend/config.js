/* =============================================================
 *  DELFINADA — konfiguracja połączenia z Supabase
 *  -------------------------------------------------------------
 *  Wklej TUTAJ dwie PUBLICZNE wartości z panelu Supabase:
 *    Project Settings → API
 *      • Project URL           → SUPABASE_URL
 *      • Project API keys: anon → SUPABASE_ANON_KEY
 *
 *  To są wartości PUBLICZNE (bezpieczne we frontendzie) — prawdziwą
 *  ochronę danych zapewnia Row Level Security w bazie (schema.sql).
 *  NIGDY nie wklejaj tu klucza "service_role".
 * ============================================================= */
window.DELFINADA_CONFIG = {
  SUPABASE_URL: 'https://yrdqcvhnsihmccbyauvs.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_9HE8UWyuxBL-Jnj3cXk7vw_hCRNnZHa'
};
