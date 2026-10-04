# DELFINADA — backend (Supabase) 🐬

Instrukcja uruchomienia prawdziwego backendu: logowanie, baza, zdjęcia/filmy,
z izolacją danych dzieci (RODO) przez Row Level Security.

## 1. Załóż projekt Supabase (darmowy)

1. Wejdź na **https://supabase.com** → **Start your project** → zaloguj się (np. przez GitHub).
2. **New project**: nazwa `delfinada`, ustaw hasło do bazy (zapisz je), wybierz region
   najbliżej Polski (np. *Central EU (Frankfurt)*). Kliknij **Create new project** i poczekaj ~1 min.

## 2. Utwórz schemat bazy

1. W projekcie: menu po lewej → **SQL Editor** → **New query**.
2. Wklej całą zawartość pliku [`schema.sql`](schema.sql) i kliknij **Run**.
3. Powinno pojawić się „Success”. To tworzy tabele, zabezpieczenia (RLS) i bucket na media.

## 3. Skopiuj klucze do aplikacji

1. Menu → **Project Settings** → **API**.
2. Skopiuj:
   - **Project URL**
   - **Project API keys → `anon` `public`**
3. Otwórz plik [`config.js`](config.js) i wklej je:
   ```js
   window.DELFINADA_CONFIG = {
     SUPABASE_URL: 'https://TWOJ-PROJEKT.supabase.co',
     SUPABASE_ANON_KEY: 'eyJ... (klucz anon)'
   };
   ```
   > To wartości **publiczne** — bezpieczne we frontendzie. Ochronę danych daje RLS.
   > **Nie** używaj tu klucza `service_role`.

## 4. (Zalecane na start) Wyłącz potwierdzanie e-mail

Żeby łatwo testować konta:
- **Authentication** → **Providers / Sign In** (lub **Email**) → wyłącz *Confirm email*.
- Produkcyjnie możesz je później włączyć.

## 5. Utwórz konto trenera i nadaj rolę

1. **Authentication** → **Users** → **Add user** → podaj e-mail i hasło trenera.
2. Skopiuj jego **User UID**.
3. **SQL Editor** → wklej i uruchom (podmień UID):
   ```sql
   update public.profiles set rola = 'trener', imie = 'Marek'
   where id = 'WKLEJ_USER_UID_TRENERA';
   ```

## 6. Dodaj grupę, dzieci i powiąż z rodzicem

```sql
-- grupa prowadzona przez trenera
insert into public.grupy (nazwa, trener_id)
values ('Delfinki', 'WKLEJ_USER_UID_TRENERA')
returning id;  -- zapamiętaj zwrócone id grupy

-- dziecko w tej grupie
insert into public.dzieci (imie, nazwisko, grupa_id, cel_opis, cel_postep)
values ('Zosia', 'Kowalska', 'WKLEJ_ID_GRUPY', 'Kraul 15 m', 40)
returning id;  -- zapamiętaj id dziecka

-- rodzic: najpierw zarejestruj się przez app-login.html (zakładka Rejestracja),
-- potem pobierz jego UID z Authentication → Users i powiąż z dzieckiem:
insert into public.rodzic_dziecko (rodzic_id, dziecko_id)
values ('WKLEJ_UID_RODZICA', 'WKLEJ_ID_DZIECKA');
```

## 7. Testuj

- Otwórz **`app-login.html`** (na GitHub Pages: `https://www.delfinada.pl/app-login.html`).
- Zaloguj się jako **trener** → trafisz do panelu trenera → dodaj wpis ze zdjęciem/filmem.
- Zaloguj się jako **rodzic** → zobaczysz wpis i media swojego dziecka (i tylko swojego).

## Jak to jest zabezpieczone (RODO)

- **Row Level Security** w bazie wymusza, że rodzic czyta **wyłącznie** dane dziecka,
  do którego jest przypisany; wpisy i media dodaje tylko kadra (trener/admin).
- Bucket `media` jest **prywatny** — pliki serwowane są przez czasowe *signed URL*,
  a dostęp do nich też sprawdza RLS po ścieżce `media/<dziecko_id>/...`.

## Pliki

- `schema.sql` — tabele + RLS + storage (uruchamiasz raz).
- `config.js` — Twoje klucze (URL + anon). **Nie commituj prawdziwych kluczy, jeśli repo jest publiczne i tego nie chcesz** — anon key i tak jest publiczny, ale decyzja należy do Ciebie.
- `api.js` — warstwa dostępu używana przez panele (`app-login/postepy/trener`).
