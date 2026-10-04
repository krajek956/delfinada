# DELFINADA — powiadomienia e-mail dla rodziców 🔔🐬

Gdy trener doda wpis o postępach, rodzice tego dziecka dostaną automatycznie
e-mail z linkiem do aplikacji. Wszystko dzieje się po stronie serwera — rodzic
nie musi mieć otwartej aplikacji.

**Jak to działa:** nowy wpis → Database Webhook → Edge Function `powiadom-rodzica`
→ e-mail przez Resend do rodziców przypisanych do dziecka.

Wszystko robisz **przez przeglądarkę** (panel Supabase + resend.com) — bez instalowania narzędzi.

---

## Krok 1 — załóż konto Resend (darmowe) i klucz API

1. Wejdź na **https://resend.com** → załóż konto.
2. **API Keys** → **Create API Key** → skopiuj klucz `re_...` (pokaże się raz).
3. **Nadawca e-maili:**
   - **Na szybki test** możesz użyć gotowego nadawcy Resend: `onboarding@resend.dev`
     (maile trafią tylko na Twój własny, zweryfikowany adres — wystarczy do testów).
   - **Docelowo** dodaj swoją domenę: **Domains** → **Add Domain** → `delfinada.pl`,
     dodaj wskazane rekordy DNS u operatora domeny. Wtedy nadawca to np.
     `DELFINADA <powiadomienia@delfinada.pl>`.

## Krok 2 — wdróż Edge Function w Supabase

1. Panel Supabase → menu **Edge Functions** → **Deploy a new function**
   (lub **Create a new function**).
2. Nazwa funkcji: **`powiadom-rodzica`** (dokładnie tak).
3. Wklej całą zawartość pliku [`functions/powiadom-rodzica/index.ts`](functions/powiadom-rodzica/index.ts).
4. Kliknij **Deploy**.

## Krok 3 — ustaw sekrety funkcji

W **Edge Functions → Secrets** (lub **Project Settings → Edge Functions → Secrets**)
dodaj:

| Nazwa | Wartość |
|---|---|
| `RESEND_API_KEY` | Twój klucz `re_...` z Resend |
| `MAIL_FROM` | `DELFINADA <onboarding@resend.dev>` (lub nadawca z Twojej domeny) |
| `APP_URL` | `https://www.delfinada.pl/app-postepy.html` |

> `SUPABASE_URL` i `SUPABASE_SERVICE_ROLE_KEY` są wstrzykiwane automatycznie — nie dodawaj ich ręcznie.

## Krok 4 — podłącz wyzwalacz (Database Webhook) — ZALECANE

1. Panel Supabase → **Database** → **Webhooks** → **Create a new hook**.
2. Ustaw:
   - **Name:** `powiadom-po-wpisie`
   - **Table:** `wpisy`  •  **Events:** zaznacz **Insert**
   - **Type:** **Supabase Edge Functions**
   - **Edge Function:** `powiadom-rodzica`
   - **Method:** `POST`
3. **Create webhook**.

> ⚠️ Jeśli użyjesz webhooka (jak wyżej), **NIE** uruchamiaj `backend/notifications.sql`
> — to alternatywna metoda i wysyłałaby maile podwójnie. Wybierz jedną z dróg.

### (Alternatywa) wyzwalacz przez SQL
Jeśli wolisz trigger SQL zamiast webhooka: otwórz [`notifications.sql`](notifications.sql),
podmień `<PROJECT_REF>` i `<SUPABASE_SERVICE_ROLE_KEY>`, uruchom w SQL Editor.

## Krok 5 — test 🎉

1. Zaloguj się jako **trener** → dodaj wpis dla dziecka, które ma **przypisanego rodzica z e-mailem**.
2. Rodzic powinien dostać e-mail „🐬 Nowy wpis o postępach — <imię>".
3. Jeśli maila nie ma:
   - sprawdź **Edge Functions → Logs** (błędy funkcji),
   - przy nadawcy `onboarding@resend.dev` maile dojdą tylko na Twój zweryfikowany w Resend adres,
   - sprawdź, czy rodzic ma uzupełniony `email` w tabeli `profiles` (panel admina pokaże to w zakładce Dzieci).

---

## Co dalej (opcjonalnie)
- **Push na telefon** (dymek jak z komunikatora) — można dołożyć później; wymaga
  dodatkowej konfiguracji (klucze VAPID + obsługa w service workerze). E-mail działa od razu i trafia do wszystkich.
- **Własna domena nadawcy** — gdy zweryfikujesz `delfinada.pl` w Resend, maile będą bardziej wiarygodne i nie trafią do spamu.
