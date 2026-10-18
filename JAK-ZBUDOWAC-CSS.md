# Jak zbudować lekki CSS (zastąpić Tailwind CDN) — 2 komendy 🚀

Dzięki temu strona będzie szybka (bez ostrzeżenia Google „blokowanie renderowania")
i **bez ryzyka rozjechania** — bo CSS generuje oficjalne narzędzie Tailwind.

Potrzebujesz tylko **Node.js** na komputerze (https://nodejs.org — wersja LTS).
Robisz to **raz**; przy kolejnych zmianach strony powtarzasz tylko krok 2.

---

## Krok 0 — pobierz projekt na komputer (jeśli jeszcze nie masz)

Otwórz terminal (na Macu: „Terminal"; na Windows: „PowerShell") i wpisz:

```bash
git clone https://github.com/krajek956/delfinada.git
cd delfinada
git checkout feat/swimming-school-landing
```

Jeśli już masz projekt sklonowany — wejdź do jego folderu i zrób `git pull`.

---

## Krok 1 — zbuduj CSS (pierwsza komenda)

W folderze projektu uruchom:

```bash
npx tailwindcss@3 -i ./src-input.css -o ./assets/app.css --minify
```

Co to robi: pobiera oficjalny Tailwind, czyta `tailwind.config.js` i `index.html`,
i tworzy plik **`assets/app.css`** zawierający **dokładnie** style, których używa strona
(zminifikowane). Przy pierwszym uruchomieniu npx zapyta o instalację — zgódź się (wpisz `y`).

> Powinno pojawić się coś w stylu: `Done in 900ms`.

---

## Krok 2 — wyślij wygenerowany plik z powrotem (druga komenda)

```bash
git add assets/app.css && git commit -m "Zbuduj lekki CSS (Tailwind prebuilt)" && git push
```

To wgra `assets/app.css` do repozytorium.

---

## Krok 3 — daj mi znać

Napisz w czacie: **„CSS zbudowany"**.
Wtedy JA podmienię w `index.html` ciężki `<script cdn.tailwindcss.com>` na lekki
`<link rel="stylesheet" href="assets/app.css">`, sprawdzę i wdrożę. Gotowe!

---

## Gdyby coś nie zadziałało
- „command not found: npx" → zainstaluj Node.js z https://nodejs.org (wersja LTS), zamknij i otwórz terminal ponownie.
- „git: not found" → zainstaluj Git (https://git-scm.com).
- Przy `git push` poprosi o login → użyj swojego konta GitHub (krajek956).
Napisz mi, jaki dokładnie komunikat widzisz — pomogę.
