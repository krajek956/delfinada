# DELFINADA — Szkoła Pływania 🐬

Nowoczesna, responsywna strona docelowa (landing page) szkoły pływania **DELFINADA**.
Motyw: **jasny, kolorowy i zabawowy** („Playful Kids") w **kolorach logo** — dla rodziców i dzieci.
Paleta: **pomarańcz delfina** (`#F5911E` → `#F0641E`) i **turkus fali/promieni** (`#16A9BE` → `#0E7C8B`)
na bieli, zaokrąglone „bąbelkowe" kształty, **faliste przejścia** między sekcjami i animowane bąbelki.
W nagłówku i stopce widnieje **logo DELFINADA** (delfin + fala + promienie) z taglinem
„Nauka pływania & obozy sportowe". Interfejs w języku polskim, z **działającym formularzem zapisu**.

## 🐬 Logo

Strona używa **oryginalnego logo** DELFINADA ([`assets/logo-delfinada.png`](assets/logo-delfinada.png),
skopiowanego z wgranego `Logo DELFINADA.png`). Logo pojawia się w **nagłówku**, jako **wizual w hero**
oraz w **stopce** (na białym kafelku, dla czytelności na turkusowym tle).
Zachowano też wcześniejszą wersję wektorową [`assets/logo-delfinada.svg`](assets/logo-delfinada.svg).

## 🏊 Sekcje

1. **Navbar** — logo „DELFINADA", linki: Oferta / Dlaczego my / Jak to działa / Cennik, przycisk CTA „Zapisz się" (glass + menu mobilne).
2. **Hero** — „Pływaj z pewnością siebie!", podtytuł, przyciski „Zapisz się" i „Sprawdź ofertę", wizual delfina, pływające plakietki i animowane bąbelki.
3. **Oferta** — 4 karty: Niemowlęta, Dla dzieci, Dla dorosłych, Doskonalenie.
4. **Dlaczego my** — doświadczona kadra, małe grupy, autorska metodyka, bezpieczeństwo.
5. **Jak to działa** — 3 kroki (formularz → kontakt → pierwsze zajęcia).
6. **Cennik** — grupowe od 75 PLN/h, indywidualne od 160 PLN/h (wyróżnione).
7. **Opinie** — 3 recenzje kursantów z oceną gwiazdkową.
8. **Zapisy (formularz)** — działający formularz z walidacją pól i komunikatem sukcesu.
9. **Stopka / Kontakt** — telefon, e-mail, adres, godziny otwarcia, ikony social media.

## 📝 Formularz zapisu

- Pola: imię i nazwisko, e-mail, telefon, grupa, preferowany termin, wiadomość (opcjonalnie), zgoda.
- **Walidacja po stronie klienta** (w locie i przy wysyłce): wymagane pola, format e-mail i telefonu, wymagana zgoda.
- Po poprawnym wysłaniu: formularz blokuje się i pokazuje komunikat sukcesu; dane logowane są do konsoli.
- **Brak backendu** — to statyczny landing. Aby realnie wysyłać zgłoszenia, podłącz endpoint
  (np. Formspree, własne API czy funkcję serverless) w miejscu `console.log('Zgłoszenie DELFINADA', data)`.

## 🎨 Stack

- **Tailwind CSS** — stylowanie (jasny motyw, zaokrąglone kształty, faliste dividery, animacje).
- **Lucide** — ikony.
- Czcionki: **Baloo 2** (zabawowe nagłówki) + **Nunito** (tekst).
- Czysty HTML + JS (menu mobilne, bąbelki, walidacja formularza).

## ▶️ Jak uruchomić

Bez instalacji i budowania — wystarczy otworzyć plik w przeglądarce:

```bash
open index.html            # macOS
xdg-open index.html        # Linux
# lub lokalny serwer:
python3 -m http.server 8080   # potem http://localhost:8080
```

Tailwind, Lucide i czcionki ładowane są z CDN, więc do pierwszego uruchomienia
potrzebne jest połączenie z internetem.

## ⚙️ Uwaga dot. środowiska / migracja do Next.js

Wersja zbudowana jako pojedynczy, samowystarczalny plik `index.html` (Tailwind + Lucide z CDN),
ponieważ środowisko budujące **nie miało dostępu do rejestru npm** (`registry.npmjs.org` → 403).
Gdy masz dostęp do npm, migracja do pełnego **Next.js (App Router)** jest prosta:

```bash
npx create-next-app@latest delfinada --tailwind --app --eslint
cd delfinada
npm install lucide-react
```

Następnie przenieś markup do `app/page.tsx`, zamień `<i data-lucide="...">` na komponenty
z `lucide-react`, a paletę kolorów (`abyss`, `aqua`, `coral`, `sunny`, `mint`) i czcionki
przenieś do `tailwind.config.ts`. Logikę formularza łatwo przepisać na React (stan + `onSubmit`).
