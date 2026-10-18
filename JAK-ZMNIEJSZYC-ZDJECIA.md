# Jak zmniejszyć zdjęcia (szybsza strona) — kilka komend 📸

Google wykrył, że niektóre zdjęcia są wielokrotnie za duże (np. foto1 to 3024×4032,
a wyświetla się jako maleńki kafelek). Zmniejszymy je — oszczędność ~500 KiB,
a jakość na ekranie zostaje taka sama.

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

Zobaczysz listę typu:
```
✓ foto1.webp: 240 KiB → 60 KiB  ...
✓ foto3.webp: 94 KiB → 45 KiB  ...
...
Łączna oszczędność: ~500 KiB 🎉
```

---

## Krok 4 — wyślij zmniejszone zdjęcia z powrotem

```bash
git add assets/*.webp
git commit -m "Zmniejsz rozmiary zdjęć (optymalizacja)"
git push
```

(Przy `git push` — jak poprzednio: username `krajek956`, hasło = Twój token `ghp_...`.)

---

## Krok 5 — napisz mi „zdjęcia zmniejszone"

Sprawdzę, że wszystko się wgrało, zweryfikuję i wdrożę. Potem odpalisz PageSpeed
jeszcze raz — punkt „Ulepsz dostarczanie obrazów" powinien zniknąć lub mocno zmaleć.

---

## Gdyby coś nie zadziałało
- `npm install sharp` zwraca błąd → napisz mi dokładny komunikat.
- `node: command not found` → otwórz nowy terminal (Node już masz zainstalowany).
Wklej mi każdy błąd — pomogę.
