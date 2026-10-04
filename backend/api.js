/* =============================================================
 *  DELFINADA — warstwa API (klient Supabase)
 *  Wymaga wcześniejszego załadowania:
 *    1) https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
 *    2) backend/config.js  (z URL + anon key)
 *  Udostępnia globalny obiekt: window.DelfinadaAPI
 * ============================================================= */
(function () {
  const cfg = window.DELFINADA_CONFIG || {};
  const skonfigurowane =
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.startsWith('TU_') &&
    !cfg.SUPABASE_ANON_KEY.startsWith('TU_');

  let sb = null;
  if (skonfigurowane && window.supabase && window.supabase.createClient) {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
    });
  }

  function wymagajKlienta() {
    if (!sb) {
      throw new Error(
        'Supabase nie jest skonfigurowany. Uzupełnij backend/config.js ' +
        '(SUPABASE_URL i SUPABASE_ANON_KEY) oraz uruchom backend/schema.sql.'
      );
    }
  }

  const API = {
    skonfigurowane,
    klient: () => sb,

    // ---------- AUTENTYKACJA ----------
    async zaloguj(email, haslo) {
      wymagajKlienta();
      const { data, error } = await sb.auth.signInWithPassword({ email, password: haslo });
      if (error) throw error;
      return data.user;
    },

    async zarejestruj(email, haslo, { imie, nazwisko, rola = 'rodzic' } = {}) {
      wymagajKlienta();
      const { data, error } = await sb.auth.signUp({
        email, password: haslo,
        options: { data: { imie, nazwisko, rola } }
      });
      if (error) throw error;
      return data.user;
    },

    async wyloguj() { wymagajKlienta(); await sb.auth.signOut(); },

    async uzytkownik() {
      if (!sb) return null;
      const { data } = await sb.auth.getUser();
      return data.user || null;
    },

    async mojProfil() {
      wymagajKlienta();
      const u = await API.uzytkownik();
      if (!u) return null;
      const { data, error } = await sb.from('profiles').select('*').eq('id', u.id).single();
      if (error) throw error;
      return data;
    },

    // reaguj na zmianę stanu logowania (np. przekierowanie)
    naZmianeSesji(cb) {
      if (!sb) return () => {};
      const { data } = sb.auth.onAuthStateChange((_e, s) => cb(s));
      return () => data.subscription.unsubscribe();
    },

    // ---------- RODZIC: dzieci + wpisy ----------
    async mojeDzieci() {
      wymagajKlienta();
      // RLS sam ograniczy do dzieci bieżącego rodzica (lub wszystkich dla kadry)
      const { data, error } = await sb
        .from('dzieci')
        .select('id, imie, nazwisko, data_ur, cel_opis, cel_postep, grupa_id, grupy(nazwa)')
        .order('imie');
      if (error) throw error;
      return data;
    },

    async wpisyDziecka(dzieckoId) {
      wymagajKlienta();
      const { data, error } = await sb
        .from('wpisy')
        .select('*, media(*), trener:profiles!wpisy_trener_id_fkey(imie, nazwisko)')
        .eq('dziecko_id', dzieckoId)
        .order('data_zajec', { ascending: false });
      if (error) throw error;
      // dołącz publiczne/signed URL-e do mediów
      for (const w of data || []) {
        for (const m of w.media || []) m.url = await API.urlMedia(m.sciezka);
      }
      return data;
    },

    // ---------- TRENER: grupy, dzieci, dodawanie wpisu ----------
    async grupy() {
      wymagajKlienta();
      const { data, error } = await sb.from('grupy').select('*').order('nazwa');
      if (error) throw error;
      return data;
    },

    async dzieciGrupy(grupaId) {
      wymagajKlienta();
      const { data, error } = await sb
        .from('dzieci').select('*').eq('grupa_id', grupaId).order('imie');
      if (error) throw error;
      return data;
    },

    async dodajWpis(wpis, pliki = []) {
      wymagajKlienta();
      const u = await API.uzytkownik();
      // 1) utwórz wpis
      const { data: nowy, error } = await sb.from('wpisy').insert({
        dziecko_id:   wpis.dziecko_id,
        trener_id:    u ? u.id : null,
        nastroj:      wpis.nastroj ?? null,
        co_sie_udalo: wpis.co_sie_udalo ?? null,
        nad_czym:     wpis.nad_czym ?? null,
        do_domu:      wpis.do_domu ?? null,
        odznaka:      wpis.odznaka || null,
        cel_postep:   wpis.cel_postep ?? null
      }).select().single();
      if (error) throw error;

      // 2) wgraj pliki do storage i zapisz wiersze media
      for (const file of pliki) {
        const typ = file.type.startsWith('video') ? 'film' : 'foto';
        const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
        const sciezka = `${wpis.dziecko_id}/${nowy.id}/${crypto.randomUUID()}.${ext}`;
        const up = await sb.storage.from('media').upload(sciezka, file, { upsert: false });
        if (up.error) throw up.error;
        const ins = await sb.from('media').insert({ wpis_id: nowy.id, sciezka, typ });
        if (ins.error) throw ins.error;
      }

      // 3) zaktualizuj aktualny cel dziecka (jeśli podano postęp)
      if (wpis.cel_postep != null) {
        await sb.from('dzieci').update({ cel_postep: wpis.cel_postep }).eq('id', wpis.dziecko_id);
      }
      return nowy;
    },

    // ---------- STORAGE ----------
    async urlMedia(sciezka) {
      wymagajKlienta();
      // bucket prywatny → signed URL ważny 1h
      const { data, error } = await sb.storage.from('media').createSignedUrl(sciezka, 3600);
      if (error) return null;
      return data.signedUrl;
    }
  };

  window.DelfinadaAPI = API;
})();
