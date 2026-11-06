// Konfiguracja połączenia z Supabase.
// Wartości znajdziesz w Supabase: Project Settings → API (lub „Connect”):
//   - Project URL
//   - Publishable key (dawniej „anon public”)
// Oba są publiczne z założenia: dane chronią reguły RLS w bazie i logowanie.
// NIGDY nie wpisuj tu klucza „service_role” / „secret”.
window.DELFINADA_CONFIG = {
  supabaseUrl: 'https://TWOJ-PROJEKT.supabase.co',
  supabaseAnonKey: 'TWOJ-PUBLISHABLE-KEY',
};
