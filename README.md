# Szkoła Pływania — Landing Page

Nowoczesna, responsywna strona docelowa (landing page) dla szkoły pływania.
Interfejs w języku polskim, w wodnej kolorystyce (odcienie błękitu, cyjanu, bieli i jasnej szarości).

Układ i sekcje wzorowane na polskich szkołach pływania (m.in. smile-swim.pl i swimple.pl) —
segmentacja oferty na niemowlęta/dzieci/dorosłych, wyeksponowany zespół instruktorów,
sekcja „Dlaczego my", opinie kursantów oraz kilka lokalizacji/pływalni.
*(Treść i formy własne, sformułowania przygotowane samodzielnie.)*

## 🏊 Sekcje

1. **Navbar** — logo „Szkoła Pływania", linki: Oferta / Dlaczego my / Instruktorzy / Cennik / Kontakt, przycisk CTA „Zapisz się" (z menu mobilnym).
2. **Hero** — nagłówek „Pływaj z pewnością siebie!", podtytuł, przycisk „Sprawdź ofertę" oraz tło z basenem (obraz + gradientowy fallback).
3. **Pasek statystyk** — lata doświadczenia, liczba kursantów, instruktorów i lokalizacji.
4. **Oferta** — 4 karty z ikonami: „Niemowlęta", „Dla dzieci", „Dla dorosłych", „Doskonalenie".
5. **Dlaczego my** — przewagi (doświadczona kadra, małe grupy, autorska metodyka, bezpieczeństwo) + obraz i badge.
6. **Instruktorzy** — zespół (placeholdery zdjęć + krótkie bio), wzorowane na stronie instruktorów swimple.pl.
7. **Cennik** — zajęcia grupowe od 75 PLN/h i indywidualne od 160 PLN/h.
8. **Opinie** — trzy opinie kursantów z oceną gwiazdkową.
9. **Lokalizacje** — kilka pływalni do wyboru.
10. **Baner CTA** + **Stopka / Kontakt** — telefon, e-mail, adres pływalni, godziny otwarcia i ikony social media.

## 🎨 Stack

- **Tailwind CSS** — stylowanie (motyw wodny, animacje, responsywność)
- **Lucide** — ikony
- Czysty HTML + odrobina JS (menu mobilne, rok w stopce)

## ▶️ Jak uruchomić

Nie wymaga instalacji ani budowania. Wystarczy otworzyć plik w przeglądarce:

```bash
# dowolny sposób, np.:
open index.html          # macOS
xdg-open index.html      # Linux
# lub lokalny serwer:
python3 -m http.server 8080   # potem http://localhost:8080
```

Tailwind i Lucide ładowane są z CDN, więc strona wymaga połączenia z internetem
do pobrania tych zasobów przy pierwszym uruchomieniu.

## ⚙️ Uwaga dot. środowiska / migracja do Next.js

Ta wersja została zbudowana jako pojedynczy, samowystarczalny plik `index.html`
(Tailwind + Lucide z CDN), ponieważ środowisko, w którym powstała, **nie miało
dostępu do rejestru npm** (`registry.npmjs.org` zwracał 403), przez co nie dało
się zainstalować pakietów `next`, `react`, `tailwindcss` ani `lucide-react`.

Gdy masz dostęp do npm, migracja do pełnego projektu **Next.js (App Router)**
jest prosta:

```bash
npx create-next-app@latest szkola-plywania --tailwind --app --eslint
cd szkola-plywania
npm install lucide-react
```

Następnie przenieś markup z `index.html` do `app/page.tsx`, zamień `<i data-lucide="...">`
na komponenty ikon z `lucide-react` (np. `import { Waves } from 'lucide-react'`),
a konfigurację kolorów z sekcji `tailwind.config` w `index.html` przenieś do
`tailwind.config.ts` (paleta `water`).
