# DELFINADA — Panel trenera 🐬

Aplikacja tylko dla Ady, dostępna pod adresem **https://www.delfinada.pl/trener/** (po zalogowaniu).
Nie ma do niej linków ze strony głównej i jest wyłączona z wyszukiwarek (`noindex`).

## Co umie

- **Dziś**: lekcje na dziś i jutro, odliczanie do najbliższej, szybkie przyciski
  *Odbyta / Nie było / Odwołana / Opłacona / Notatka*, lista lekcji „do uzupełnienia”
  (minęły, a nie mają statusu), podsumowanie miesiąca i kwota do zapłaty.
- **Kalendarz**: widok tygodnia, dodawanie lekcji w wybranym dniu.
- **Lekcje cykliczne**: „Powtarzaj co tydzień” tworzy serię (np. 10 wtorków o 17:00).
  Seria może być usunięta od wybranej lekcji w przód.
- **Kursanci**: dane kontaktowe, zgoda na SMS, cena, poziom, cel, notatki;
  karta kursanta z historią lekcji i notatkami (postępy), statystyką i zaległymi płatnościami.
  Kursanta, który skończył zajęcia, można przenieść do archiwum.
- **SMS-y automatyczne** (sprawdzane co 5 minut):
  - do kursanta: X godzin przed zajęciami (domyślnie 24 h), tylko między 8:00 a 21:00
    i tylko gdy kursant ma zaznaczoną zgodę;
  - do Ady: X minut przed każdą lekcją (domyślnie 60 min), z imieniem, miejscem i telefonem kursanta;
  - zmiana godziny lekcji = przypomnienie wyjdzie ponownie;
  - lekcja odwołana = przypomnienie nie wychodzi.
- **Ustawienia**: treść SMS-a z podglądem i licznikiem znaków, czasy wysyłki,
  testowy SMS, historia SMS-ów ze statusem z bramki.

## Jak to działa

```
Telefon/komputer Ady ──► trener/index.html (GitHub Pages)
                              │  logowanie + dane (supabase-js)
                              ▼
                         Supabase (Postgres + RLS)
                              │  pg_cron co 5 min → wyslij_przypomnienia()
                              ▼
                         pg_net ──► SMSAPI.pl ──► SMS do kursanta / Ady
```

Całe zaplecze to jeden plik [`supabase/setup.sql`](../supabase/setup.sql). Nie trzeba niczego
instalować ani wdrażać funkcji. Token SMSAPI jest w Supabase Vault, nie w kodzie.

## Uruchomienie (jednorazowo, ok. 20 minut)

### 1. SMSAPI.pl
1. Załóż konto na [smsapi.pl](https://www.smsapi.pl) i doładuj je (wystarczy najmniejsza kwota).
2. W panelu: **Ustawienia API → Tokeny API (OAuth)** → wygeneruj token z uprawnieniem do wysyłki SMS.
3. (Opcjonalnie) **Pola nadawcy** → zgłoś nazwę `DELFINADA`. Po akceptacji wpisz ją w panelu
   trenera w *Ustawienia → Nadawca SMS*. Do tego czasu SMS-y wychodzą z domyślnym nadawcą SMSAPI.

### 2. Supabase: baza
1. Supabase → Twój projekt → **SQL Editor → New query**.
2. Wklej cały plik `supabase/setup.sql` i kliknij **Run**.

### 3. Supabase: konto Ady
1. **Authentication → Users → Add user → Create new user**: e-mail i hasło Ady,
   zaznacz *Auto Confirm User*.
2. **Authentication → Sign In / Providers** → wyłącz *Allow new users to sign up*.
3. W SQL Editor uruchom (podmień e-mail, numer, miejsce, cenę i token):

```sql
insert into public.ustawienia (trener_id, telefon, domyslne_miejsce, domyslna_cena)
select id, '+48 666 515 178', 'Basen ...', 160
  from auth.users where email = 'EMAIL-ADY@example.com'
on conflict (trener_id) do nothing;

select vault.create_secret('TUTAJ-TOKEN-Z-SMSAPI', 'smsapi_token');
```

### 4. Połączenie panelu z Supabase
W **Project Settings → API** (lub przycisk *Connect*) skopiuj **Project URL** i **Publishable key**
(dawniej *anon public*) do pliku [`trener/config.js`](config.js). Klucza `service_role` / `secret`
nigdy tam nie wpisuj.

### 5. Test
1. Wejdź na `https://www.delfinada.pl/trener/` i zaloguj się.
2. *Ustawienia → Testowy SMS do mnie*. Po kilku sekundach odśwież historię SMS: status powinien być „Wysłany”.
   Jeśli jest „Błąd”, pod wiadomością widać odpowiedź bramki (np. zły token, brak środków).
3. Dodaj siebie jako kursanta (ze zgodą SMS) i lekcję za ~2 godziny, żeby sprawdzić automat.

Na telefonie: menu przeglądarki → **Dodaj do ekranu głównego**. Panel otworzy się jak aplikacja.

## Koszty

- Supabase: plan darmowy wystarczy.
- SMSAPI: płatność za każdy SMS (zwykle kilkanaście groszy). Przy 3 lekcjach tygodniowo to ok. 25 SMS-ów
  miesięcznie (przypomnienie dla kursanta + dla Ady). Panel pokazuje długość treści.
  Powyżej 160 znaków wiadomość liczy się jako 2 SMS-y. Polskie znaki są automatycznie zamieniane
  (ą→a itd.), żeby zmieścić się w jednym SMS-ie.

## Przydatne

Zmiana tokenu SMSAPI:
```sql
select vault.update_secret((select id from vault.secrets where name = 'smsapi_token'), 'NOWY-TOKEN');
```

Ręczne uruchomienie wysyłki (np. do testów): `select public.wyslij_przypomnienia();`

Podgląd zadań crona: `select * from cron.job_run_details order by start_time desc limit 20;`

## RODO

Dane kursantów są w bazie Supabase. Wybierz region UE przy zakładaniu projektu.
Przypomnienia SMS wychodzą tylko do osób z zaznaczoną zgodą. Warto ją zbierać przy zapisie
(np. zdanie w formularzu lub regulaminie).
