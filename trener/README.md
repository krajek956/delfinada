# DELFINADA — Panel trenera 🐬

Aplikacja tylko dla Ady, pod adresem **https://www.delfinada.pl/trener/** (po zalogowaniu).
Nie ma do niej linków ze strony głównej i jest wyłączona z wyszukiwarek (`noindex`).

## Co umie

- **Przypomnienia o treningach**: powiadomienie na telefonie (iPhone, Android) i komputerze
  przed każdą lekcją, np. *„🐬 Za 60 min: Marta Wiśniewska — 18:00 · 60 min · Basen Kapry · tel. 601 234 567”*.
  Przychodzi nawet przy zamkniętej aplikacji i zablokowanym ekranie. Czas ustawia się w panelu
  (od 15 minut do dnia wcześniej). Dla odwołanych lekcji powiadomienie nie przychodzi, a po zmianie
  godziny przychodzi o nowej porze.
- **Dziś**: lekcje na dziś i jutro, odliczanie do najbliższej, szybkie przyciski
  *Odbyta / Nie było / Odwołana / Opłacona / Notatka*, lista lekcji „do uzupełnienia”,
  podsumowanie miesiąca i kwota do zapłaty.
- **Kalendarz**: widok tygodnia, lekcje cykliczne („powtarzaj co tydzień”).
- **Kursanci**: kontakt, cena, poziom, cel, notatki, historia lekcji z notatkami (postępy), archiwum.

## Wersja demo

`trener/?demo` otwiera panel z przykładowymi danymi, bez logowania i bez Supabase.
Zmiany są trzymane tylko w przeglądarce i znikają po odświeżeniu.

## Jak to działa

```
iPhone Ady (panel z ekranu początkowego) ──► trener/index.html (GitHub Pages)
        ▲                                          │ logowanie + dane
        │ powiadomienie                            ▼
   Apple / Google push ◄── Edge Function „powiadomienia” ◄── pg_cron co minutę
                                   │
                                   └── Supabase (Postgres + RLS)
```

- `supabase/setup.sql`: tabele, zabezpieczenia (RLS), wybór lekcji do przypomnienia.
- `supabase/functions/powiadomienia/index.ts`: wysyłka powiadomień (Web Push, bez zewnętrznych bibliotek).
  Klucze do podpisywania powiadomień tworzy sama przy pierwszym uruchomieniu i trzyma w bazie.
- Nic nie kosztuje: plan darmowy Supabase wystarczy, a powiadomienia są darmowe.

## Uruchomienie (jednorazowo, ok. 15 minut)

### 1. Baza
Supabase → Twój projekt → **SQL Editor → New query** → wklej cały `supabase/setup.sql` → **Run**.

### 2. Konto Ady
1. **Authentication → Users → Add user → Create new user**: e-mail i hasło Ady,
   zaznacz *Auto Confirm User*.
2. **Authentication → Sign In / Providers** → wyłącz *Allow new users to sign up*.
3. W SQL Editor (podmień e-mail, miejsce i cenę):

```sql
insert into public.ustawienia (trener_id, domyslne_miejsce, domyslna_cena)
select id, 'Basen ...', 160 from auth.users where email = 'EMAIL-ADY@example.com'
on conflict (trener_id) do nothing;
```

### 3. Połączenie panelu z Supabase
**Project Settings → API** (albo przycisk *Connect*): skopiuj **Project URL** i **Publishable key**
(dawniej *anon public*) do [`trener/config.js`](config.js). Klucza `service_role` / `secret`
nigdy tam nie wpisuj.

### 4. Funkcja wysyłająca powiadomienia
1. **Edge Functions → Deploy a new function → Via Editor**.
2. Nazwa: `powiadomienia` (dokładnie tak).
3. Usuń przykładowy kod, wklej całą zawartość `supabase/functions/powiadomienia/index.ts` → **Deploy**.
4. W ustawieniach funkcji (**Details**) wyłącz **Verify JWT** / *Enforce JWT verification* → **Save**.
   Funkcję woła harmonogram, który nie jest zalogowany. Bez logowania funkcja może wysłać tylko
   przypomnienia, które i tak właśnie się należą. Testowe powiadomienie wymaga zalogowanej Ady.

### 5. Harmonogram (co minutę)
W SQL Editor (podmień adres projektu, ten sam co w `config.js`):

```sql
select cron.schedule('delfinada-powiadomienia', '* * * * *', $$
  select net.http_post(
    url := 'https://TWOJ-PROJEKT.supabase.co/functions/v1/powiadomienia',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 20000)
$$);
```

### 6. iPhone Ady
1. Otwórz `https://www.delfinada.pl/trener/` w **Safari** i zaloguj się.
2. **Udostępnij** (kwadrat ze strzałką) → **Do ekranu początkowego** → Dodaj.
3. Otwórz **Delfinadę z nowej ikony** (nie z Safari), zaloguj się, wejdź w **Ustawienia → Włącz powiadomienia**
   i zezwól na powiadomienia.
4. Kliknij **Wyślij testowe**. Powiadomienie powinno przyjść w kilka sekund.

Wymaga iOS 16.4 lub nowszego. Na komputerze (Chrome, Edge, Safari) i Androidzie powiadomienia
włącza się tak samo w Ustawieniach, bez dodawania do ekranu.

## Gdy coś nie działa

- **Na liście urządzeń jest „Błąd: …”**: treść błędu z Apple/Google. Usuń urządzenie (✕) i włącz powiadomienia ponownie.
- **„Funkcja powiadomienia nie odpowiada”**: sprawdź krok 4 (nazwa funkcji i wyłączone Verify JWT).
- **Test działa, przypomnienia nie przychodzą**: sprawdź krok 5:
  ```sql
  select status, return_message, start_time from cron.job_run_details
  where jobid = (select jobid from cron.job where jobname = 'delfinada-powiadomienia')
  order by start_time desc limit 10;
  ```
  oraz odpowiedzi funkcji: `select status_code, content from net._http_response order by created desc limit 5;`
- **Na iPhonie nie ma przycisku „Włącz”**: panel jest otwarty w Safari zamiast z ikony na ekranie początkowym.
- **Zablokowane**: iPhone → Ustawienia → Powiadomienia → Delfinada → Pozwalaj na powiadomienia.
