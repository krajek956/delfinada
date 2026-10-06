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
        .select('*, media(*), trener:profiles!wpisy_trener_id_fkey(imie, nazwisko), reakcje(user_id, emoji)')
        .eq('dziecko_id', dzieckoId)
        .order('data_zajec', { ascending: false });
      if (error) throw error;
      const u = await API.uzytkownik();
      for (const w of data || []) {
        for (const m of w.media || []) m.url = await API.urlMedia(m.sciezka);
        // moja reakcja + łączna liczba
        const rk = w.reakcje || [];
        w.moja_reakcja = u ? (rk.find(r => r.user_id === u.id)?.emoji || null) : null;
        w.reakcje_liczba = rk.length;
      }
      return data;
    },

    // Ustaw/zmień reakcję rodzica na wpis (upsert); emoji=null -> usuń
    async ustawReakcje(wpisId, emoji) {
      wymagajKlienta();
      const u = await API.uzytkownik();
      if (!u) throw new Error('Niezalogowany');
      if (!emoji) {
        const { error } = await sb.from('reakcje').delete()
          .eq('wpis_id', wpisId).eq('user_id', u.id);
        if (error) throw error;
        return null;
      }
      const { error } = await sb.from('reakcje')
        .upsert({ wpis_id: wpisId, user_id: u.id, emoji }, { onConflict: 'wpis_id,user_id' });
      if (error) throw error;
      return emoji;
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

    // Zbiór ID dzieci, które mają wpis z DZISIAJ (do statusu „dodano dziś")
    async dzieciZWpisemDzis(dzieckoIds = []) {
      wymagajKlienta();
      if (!dzieckoIds.length) return new Set();
      const start = new Date(); start.setHours(0,0,0,0);
      const { data, error } = await sb
        .from('wpisy').select('dziecko_id')
        .in('dziecko_id', dzieckoIds)
        .gte('data_zajec', start.toISOString());
      if (error) throw error;
      return new Set((data || []).map(w => w.dziecko_id));
    },

    async dodajWpis(wpis, pliki = []) {
      wymagajKlienta();
      const u = await API.uzytkownik();
      // 1) utwórz wpis
      const rekord = {
        dziecko_id:   wpis.dziecko_id,
        trener_id:    u ? u.id : null,
        nastroj:      wpis.nastroj ?? null,
        co_sie_udalo: wpis.co_sie_udalo ?? null,
        nad_czym:     wpis.nad_czym ?? null,
        do_domu:      wpis.do_domu ?? null,
        odznaka:      wpis.odznaka || null,
        cel_postep:   wpis.cel_postep ?? null
      };
      if (wpis.data_zajec) rekord.data_zajec = wpis.data_zajec; // inaczej baza użyje now()
      const { data: nowy, error } = await sb.from('wpisy').insert(rekord).select().single();
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

      // 3) zaktualizuj aktualny cel dziecka (postęp i/lub opis)
      const celUpd = {};
      if (wpis.cel_postep != null) celUpd.cel_postep = wpis.cel_postep;
      if (wpis.cel_opis != null)   celUpd.cel_opis = wpis.cel_opis;
      if (Object.keys(celUpd).length) {
        await sb.from('dzieci').update(celUpd).eq('id', wpis.dziecko_id);
      }
      return nowy;
    },

    // Pobierz pojedynczy wpis z mediami (do edycji)
    async wpis(wpisId) {
      wymagajKlienta();
      const { data, error } = await sb
        .from('wpisy').select('*, media(*)').eq('id', wpisId).single();
      if (error) throw error;
      for (const m of data.media || []) m.url = await API.urlMedia(m.sciezka);
      return data;
    },

    // Edytuj treść wpisu + opcjonalnie dodaj nowe pliki
    async aktualizujWpis(wpisId, dziecko_id, zmiany, nowePliki = []) {
      wymagajKlienta();
      const upd = {
        nastroj:      zmiany.nastroj ?? null,
        co_sie_udalo: zmiany.co_sie_udalo ?? null,
        nad_czym:     zmiany.nad_czym ?? null,
        do_domu:      zmiany.do_domu ?? null,
        odznaka:      zmiany.odznaka || null,
        cel_postep:   zmiany.cel_postep ?? null
      };
      if (zmiany.data_zajec) upd.data_zajec = zmiany.data_zajec;
      const { error } = await sb.from('wpisy').update(upd).eq('id', wpisId);
      if (error) throw error;

      // dodaj ewentualne nowe media
      for (const file of nowePliki) {
        const typ = file.type.startsWith('video') ? 'film' : 'foto';
        const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
        const sciezka = `${dziecko_id}/${wpisId}/${crypto.randomUUID()}.${ext}`;
        const up = await sb.storage.from('media').upload(sciezka, file, { upsert: false });
        if (up.error) throw up.error;
        const ins = await sb.from('media').insert({ wpis_id: wpisId, sciezka, typ });
        if (ins.error) throw ins.error;
      }

      // zsynchronizuj cel dziecka (postęp i/lub opis)
      const celUpd = {};
      if (zmiany.cel_postep != null) celUpd.cel_postep = zmiany.cel_postep;
      if (zmiany.cel_opis != null)   celUpd.cel_opis = zmiany.cel_opis;
      if (dziecko_id && Object.keys(celUpd).length) {
        await sb.from('dzieci').update(celUpd).eq('id', dziecko_id);
      }
    },

    // Usuń pojedyncze medium (plik ze storage + wiersz)
    async usunMedium(mediaId, sciezka) {
      wymagajKlienta();
      if (sciezka) await sb.storage.from('media').remove([sciezka]);
      const { error } = await sb.from('media').delete().eq('id', mediaId);
      if (error) throw error;
    },

    // Usuń cały wpis (jego media znikają kaskadowo z tabeli; pliki ze storage czyścimy ręcznie)
    async usunWpis(wpisId) {
      wymagajKlienta();
      // pobierz ścieżki plików, by usunąć je ze storage
      const { data: media } = await sb.from('media').select('sciezka').eq('wpis_id', wpisId);
      const sciezki = (media || []).map(m => m.sciezka).filter(Boolean);
      if (sciezki.length) await sb.storage.from('media').remove(sciezki);
      const { error } = await sb.from('wpisy').delete().eq('id', wpisId);
      if (error) throw error;
    },

    // ---------- ADMIN: grupy, dzieci, trenerzy, rodzice ----------

    // Lista kadry (trenerzy + admini) — do przypisania prowadzącego grupy
    async kadra() {
      wymagajKlienta();
      const { data, error } = await sb
        .from('profiles')
        .select('id, imie, nazwisko, email, rola')
        .in('rola', ['trener', 'admin'])
        .order('imie');
      if (error) throw error;
      return data;
    },

    // Grupy z liczbą dzieci i danymi trenera
    async grupyPelne() {
      wymagajKlienta();
      const { data, error } = await sb
        .from('grupy')
        .select('*, trener:profiles!grupy_trener_id_fkey(imie, nazwisko), dzieci(count)')
        .order('nazwa');
      if (error) throw error;
      return data;
    },

    async utworzGrupe({ nazwa, opis = null, trener_id = null }) {
      wymagajKlienta();
      const { data, error } = await sb.from('grupy')
        .insert({ nazwa, opis, trener_id }).select().single();
      if (error) throw error;
      return data;
    },

    async aktualizujGrupe(id, zmiany) {
      wymagajKlienta();
      const { error } = await sb.from('grupy').update(zmiany).eq('id', id);
      if (error) throw error;
    },

    async usunGrupe(id) {
      wymagajKlienta();
      const { error } = await sb.from('grupy').delete().eq('id', id);
      if (error) throw error;
    },

    // Wszystkie dzieci (dla admina/kadry — RLS i tak przepuści kadrę)
    async wszystkieDzieci() {
      wymagajKlienta();
      const { data, error } = await sb
        .from('dzieci')
        .select('*, grupy(nazwa), rodzic_dziecko(rodzic_id, profiles:profiles!rodzic_dziecko_rodzic_id_fkey(imie, nazwisko, email))')
        .order('imie');
      if (error) throw error;
      return data;
    },

    async utworzDziecko({ imie, nazwisko = null, grupa_id = null, cel_opis = null, cel_postep = 0, data_ur = null }) {
      wymagajKlienta();
      const { data, error } = await sb.from('dzieci')
        .insert({ imie, nazwisko, grupa_id, cel_opis, cel_postep, data_ur }).select().single();
      if (error) throw error;
      return data;
    },

    async aktualizujDziecko(id, zmiany) {
      wymagajKlienta();
      const { error } = await sb.from('dzieci').update(zmiany).eq('id', id);
      if (error) throw error;
    },

    async usunDziecko(id) {
      wymagajKlienta();
      const { error } = await sb.from('dzieci').delete().eq('id', id);
      if (error) throw error;
    },

    // Przypisz rodzica (po e-mailu) do dziecka — przez bezpieczną funkcję RPC
    async przypiszRodzica(email, dzieckoId) {
      wymagajKlienta();
      const { data, error } = await sb.rpc('przypisz_rodzica', { p_email: email, p_dziecko: dzieckoId });
      if (error) throw error;
      if (data && data !== 'OK') throw new Error(data); // komunikat z funkcji (np. nie znaleziono)
      return true;
    },

    async odlaczRodzica(rodzicId, dzieckoId) {
      wymagajKlienta();
      const { error } = await sb.from('rodzic_dziecko').delete()
        .eq('rodzic_id', rodzicId).eq('dziecko_id', dzieckoId);
      if (error) throw error;
    },

    // Nadaj/zmień rolę użytkownika (admin). Wyszukuje po e-mailu.
    async ustawRolePoEmailu(email, rola) {
      wymagajKlienta();
      const { data, error } = await sb.from('profiles')
        .update({ rola }).ilike('email', email.trim()).select('id, email, rola');
      if (error) throw error;
      if (!data || !data.length) throw new Error('Nie znaleziono użytkownika o e-mailu: ' + email + '. Czy założył już konto?');
      return data[0];
    },

    // Zmień rolę użytkownika po ID (nadanie admina / odebranie roli → 'rodzic')
    async ustawRolePoId(id, rola) {
      wymagajKlienta();
      const { error } = await sb.from('profiles').update({ rola }).eq('id', id);
      if (error) throw error;
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
