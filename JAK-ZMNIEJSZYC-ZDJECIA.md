# Jak zmniejszyć zdjęcia (szybsza strona) — kilka komend 📸

PageSpeed wskazał ostatnie kilka zdjęć, które wciąż są większe niż potrzeba
(foto3/foto4/foto5 w galerii, logo oraz zdjęcie instruktorki). Zmniejszymy je —
ale **z zapasem**, żeby w galerii/powiększeniu nie wyszły rozmyte. Spodziewana
oszczędność ~150–250 KiB, jakość na ekranie zostaje bardzo dobra.

Masz już Node na komputerze, więc to pójdzie szybko.

---

## Krok 1 — wejdź do folderu projektu i pobierz najnowsze pliki

W terminalu:

```bash
cd delfinada
git checkout feat/swimming-school-landing
git pull
```

---

## Krok 2 — zainstaluj narzędzie do obróbki zdjęć (jednorazowo)

```bash
npm install sharp
```

Poczeka chwilę (pobiera bibliotekę). Pojawi się kilka linijek — to normalne.

---

## Krok 3 — uruchom optymalizację

```bash
node optymalizuj-zdjecia.mjs
```

Zobaczysz listę typu (ze strzałką pokazującą nowe wymiary):
```
✓ foto3.webp: 56 KiB → 24 KiB   |   1200x800 → 700x467
✓ foto4.webp: 76 KiB → 30 KiB   |   1200x800 → 700x467
✓ logo333.webp: 37 KiB → 18 KiB |   600x136 → 400x91
...
Łączna oszczędność: ~180 KiB 🎉
```

**Skopiuj tę listę** — przyda się w kroku 5 (gdybym musiał dopasować wymiary w kodzie).

---

## Krok 4 — wyślij zmniejszone zdjęcia z powrotem

```bash
git add assets/*.webp
git commit -m "Zmniejsz rozmiary zdjęć (optymalizacja)"
git push
```

(Przy `git push` — jak poprzednio: username `krajek956`, hasło = Twój token `ghp_...`.)

---

## Krok 5 — wklej mi wynik + napisz „zdjęcia zmniejszone"

Wklej mi listę ze strzałkami z kroku 3. Sprawdzę, że wszystko się wgrało,
w razie potrzeby dopasuję wymiary `width`/`height` w kodzie i wdrożę. Potem
odpalisz PageSpeed jeszcze raz — punkt „Ulepsz dostarczanie obrazów" powinien
zniknąć lub mocno zmaleć.

> Uwaga: wymiary w kodzie (width/height przy zdjęciach) już ustawiłem na
> docelowe (foto3/4/5 → 700×467, logo → 400×91, instruktorka → 377×600).
> Jeśli skrypt pokaże inne liczby, daj znać — poprawię.

---

## Gdyby coś nie zadziałało
- `npm install sharp` zwraca błąd → napisz mi dokładny komunikat.
- `node: command not found` → otwórz nowy terminal (Node już masz zainstalowany).
Wklej mi każdy błąd — pomogę.
