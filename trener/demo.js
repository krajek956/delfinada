// Tryb demo panelu trenera (adres z ?demo).
// Udaje klienta Supabase: przykładowe dane trzymane są w pamięci przeglądarki,
// nic nie jest wysyłane ani zapisywane na serwerze. Odświeżenie strony = dane od nowa.
(function () {
  'use strict';

  const UID = 'demo-ada';
  const now = new Date();
  const at = (days, h, m = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  let seq = 1000;
  const id = () => 'demo-' + (++seq);

  function sampleData() {
    const kursanci = [
      { id: 'k-marta', imie: 'Marta', nazwisko: 'Wiśniewska', telefon: '601 234 567', email: 'marta@example.com', zgoda_sms: true, cena: 160,
        poziom: 'Początkujący', cel: 'Przestać bać się głębokiej wody, przepłynąć 25 m kraulem', notatki: 'Stres przy zanurzaniu twarzy. Lubi wtorki po pracy.', aktywny: true },
      { id: 'k-tomek', imie: 'Tomasz', nazwisko: 'Zieliński', telefon: '512 987 654', email: null, zgoda_sms: true, cena: 160,
        poziom: 'Średniozaawansowany', cel: 'Triathlon sprint w czerwcu', notatki: 'Kontuzja lewego barku w przeszłości, uważać na zakres ruchu.', aktywny: true },
      { id: 'k-kasia', imie: 'Katarzyna', nazwisko: 'Lewandowska', telefon: '698 111 222', email: null, zgoda_sms: false, cena: 140,
        poziom: 'Zaawansowany', cel: 'Poprawa techniki motylkowego', notatki: null, aktywny: true },
      { id: 'k-piotr', imie: 'Piotr', nazwisko: 'Kamiński', telefon: '500 600 700', email: null, zgoda_sms: true, cena: 160,
        poziom: 'Początkujący', cel: 'Nauka pływania od zera', notatki: 'Skończył kurs w zeszłym miesiącu.', aktywny: false },
    ].map((k) => ({ trener_id: UID, created_at: at(-60, 12), ...k }));

    const L = (kursant_id, start, extra = {}) => ({
      id: id(), trener_id: UID, kursant_id, start, czas_min: 60, miejsce: null,
      cena: kursanci.find((k) => k.id === kursant_id).cena, oplacona: false, status: 'zaplanowana',
      notatka: null, seria_id: null, sms_klient_wyslany_at: null, sms_trener_wyslany_at: null, created_at: at(-30, 12), ...extra,
    });

    const seriaMarta = 'seria-marta';
    const lekcje = [
      // Marta: seria co tydzień, ta sama godzina
      L('k-marta', at(-21, 18), { status: 'odbyta', oplacona: true, seria_id: seriaMarta, notatka: 'Pierwsze zajęcia. Oswajanie z wodą, wydechy do wody, leżenie na plecach z makaronem.' }),
      L('k-marta', at(-14, 18), { status: 'odbyta', oplacona: true, seria_id: seriaMarta, notatka: 'Szybowanie na piersiach 5 m bez pomocy! Nogi do kraula przy desce.' }),
      L('k-marta', at(-7, 18), { status: 'odbyta', oplacona: false, seria_id: seriaMarta, notatka: 'Kraul z deską 2 × 25 m. Następnym razem: oddech na bok.' }),
      L('k-marta', at(0, 18), { seria_id: seriaMarta }),
      L('k-marta', at(7, 18), { seria_id: seriaMarta }),
      L('k-marta', at(14, 18), { seria_id: seriaMarta }),
      // Tomek
      L('k-tomek', at(-10, 7), { status: 'odbyta', oplacona: true, czas_min: 90, cena: 220, notatka: '400 m kraulem ciągiem, łokieć za nisko w fazie przenoszenia.' }),
      L('k-tomek', at(-3, 7), { status: 'nieobecnosc', notatka: 'Nie przyszedł, bez uprzedzenia.' }),
      L('k-tomek', at(-1, 7), { czas_min: 90, cena: 220 }),
      L('k-tomek', at(1, 7), { czas_min: 90, cena: 220 }),
      L('k-tomek', at(5, 7), { czas_min: 90, cena: 220 }),
      // Kasia
      L('k-kasia', at(-5, 20), { status: 'odbyta', oplacona: false, notatka: 'Fala ciała w motylku coraz lepsza. Praca nad oddechem co drugi ruch.' }),
      L('k-kasia', at(-2, 20), { status: 'odwolana', notatka: 'Odwołała, choroba.' }),
      L('k-kasia', at(0, 20, 30), {}),
      L('k-kasia', at(4, 20), {}),
      // Piotr (archiwum)
      L('k-piotr', at(-40, 16), { status: 'odbyta', oplacona: true, notatka: 'Ostatnie zajęcia kursu. Przepłynął 50 m żabką!' }),
    ];

    const ustawienia = [{
      trener_id: UID, imie: 'Ada', telefon: '+48 666 515 178', nadawca: null,
      domyslne_miejsce: 'Basen Kapry, Pruszków', domyslna_cena: 160, domyslny_czas_min: 60,
      sms_klient_wlaczone: true, sms_klient_godzin_przed: 24,
      sms_klient_szablon: 'Cześć {imie}! Przypominam o zajęciach pływania: {data} o {godzina}, {miejsce}. Jeśli nie możesz przyjść, daj znać: 666 515 178. Ada, DELFINADA',
      sms_trener_wlaczone: true, sms_trener_minut_przed: 60, updated_at: at(-1, 12),
    }];

    return { ustawienia, kursanci, lekcje, sms_log: [] };
  }

  const db = sampleData();

  function withRelations(table, row, sel) {
    const r = { ...row };
    if (table === 'lekcje' && /kursant:kursanci/.test(sel)) {
      const k = db.kursanci.find((x) => x.id === row.kursant_id);
      r.kursant = k ? { ...k } : null;
    }
    return r;
  }

  const cmp = (a, b) => ((a ?? '') > (b ?? '') ? 1 : (a ?? '') < (b ?? '') ? -1 : 0);

  function query(table) {
    const st = { op: 'select', sel: '*', filters: [], order: [], limit: null, single: false, maybe: false, payload: null };
    const b = {
      select(s = '*') { st.sel = s; return b; },
      insert(p) { st.op = 'insert'; st.payload = p; return b; },
      update(p) { st.op = 'update'; st.payload = p; return b; },
      delete() { st.op = 'delete'; return b; },
      eq(c, v) { st.filters.push((r) => r[c] === v); return b; },
      gte(c, v) { st.filters.push((r) => r[c] >= v); return b; },
      lt(c, v) { st.filters.push((r) => r[c] < v); return b; },
      order(c, o = {}) { st.order.push([c, o.ascending !== false]); return b; },
      limit(n) { st.limit = n; return b; },
      single() { st.single = true; return b; },
      maybeSingle() { st.maybe = true; return b; },
      then(resolve, reject) {
        // małe opóźnienie, żeby demo zachowywało się jak prawdziwa aplikacja
        return new Promise((r) => setTimeout(r, 120)).then(run).then(resolve, reject);
      },
    };

    function run() {
      const match = () => db[table].filter((r) => st.filters.every((f) => f(r)));
      let out;
      if (st.op === 'insert') {
        const rows = (Array.isArray(st.payload) ? st.payload : [st.payload]).map((p) => ({
          id: id(), trener_id: UID, created_at: new Date().toISOString(),
          ...(table === 'kursanci' ? { aktywny: true } : {}),
          ...(table === 'lekcje' ? { status: 'zaplanowana', sms_klient_wyslany_at: null, sms_trener_wyslany_at: null } : {}),
          ...p,
        }));
        db[table].push(...rows);
        out = rows;
      } else if (st.op === 'update') {
        out = match();
        out.forEach((r) => {
          if (table === 'lekcje' && st.payload.start && st.payload.start !== r.start) {
            r.sms_klient_wyslany_at = null;
            r.sms_trener_wyslany_at = null;
          }
          Object.assign(r, st.payload);
        });
      } else if (st.op === 'delete') {
        out = match();
        db[table] = db[table].filter((r) => !out.includes(r));
        if (table === 'kursanci') db.lekcje = db.lekcje.filter((l) => !out.some((k) => k.id === l.kursant_id));
      } else {
        out = match();
        for (const [c, asc] of [...st.order].reverse()) out = [...out].sort((a, b) => cmp(a[c], b[c]) * (asc ? 1 : -1));
        if (st.limit) out = out.slice(0, st.limit);
      }
      out = out.map((r) => withRelations(table, r, st.sel));
      if (st.single) return out.length === 1 ? { data: out[0], error: null } : { data: null, error: { message: 'Nie znaleziono rekordu' } };
      if (st.maybe) return { data: out[0] || null, error: null };
      return { data: out, error: null };
    }
    return b;
  }

  window.DELFINADA_DEMO = {
    createClient() {
      let session = { user: { id: UID, email: 'ada@delfinada.pl (demo)' } };
      let listener = null;
      const notify = (ev, s) => setTimeout(() => listener && listener(ev, s), 0);
      return {
        auth: {
          getSession: async () => ({ data: { session } }),
          onAuthStateChange: (cb) => { listener = cb; return { data: { subscription: { unsubscribe() {} } } }; },
          signInWithPassword: async () => {
            session = { user: { id: UID, email: 'ada@delfinada.pl (demo)' } };
            notify('SIGNED_IN', session);
            return { data: { session }, error: null };
          },
          signOut: async () => { session = null; notify('SIGNED_OUT', null); return { error: null }; },
        },
        from: (t) => query(t),
        rpc: async (name) => {
          if (name === 'odswiez_statusy_sms') return { data: null, error: null };
          return { data: null, error: { message: 'W wersji demo SMS-y nie są wysyłane.' } };
        },
      };
    },
  };
})();
