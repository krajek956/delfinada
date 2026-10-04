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
  SUPABASE_URL: 'TU_WKLEJ_PROJECT_URL',
  SUPABASE_ANON_KEY: 'TU_WKLEJ_ANON_KEY'
};
