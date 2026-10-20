// Optymalizacja zdjęć DELFINADA — zmniejsza za duże obrazy WebP (zachowuje proporcje i jakość).
// Uruchom na komputerze:  node optymalizuj-zdjecia.mjs
// (Skrypt sam pobierze bibliotekę sharp przy pierwszym uruchomieniu przez npx — patrz instrukcja.)
import sharp from 'sharp';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const DIR = 'assets';
// Maksymalny dłuższy bok dla danego pliku (px). Dobrane do tego, jak duże wyświetlają się
// na stronie — z zapasem dla zdjęć powiększanych w sliderze/lightboxie (żeby nie rozmywały się).
//  • foto3/4/5 — slider + lightbox (powiększają się) → bezpieczne 700 px
//  • ada2-trim — instruktorka w hero (NIE powiększa się) → 600 px
//  • logo333   — logo (NIE powiększa się) → 400 px
//  • foto1     — pionowe 750x1000, już małe → zostaje 1000
// Dopasowane do REALNEGO rozmiaru wyświetlania (slider Cover Flow: max kontener ~380 px,
// więc na ekranach Retina ×2 potrzeba ~560 px — nie ma lightboxa/powiększania na pełny ekran).
const LIMITY = {
  'foto1.webp': 500,   // pionowe, w sliderze pokazuje ~251x334 → 500 px starcza na Retinę
  'foto3.webp': 560,
  'foto4.webp': 560,
  'foto5.webp': 560,
  'ada2.webp': 560,
  'ada2-trim.webp': 600, // instruktorka w hero — tu zostawiamy więcej (duży obszar)
  'basen001.webp': 900,
  'basen002.webp': 900,
  'basen003.webp': 900,
  'logo333.webp': 400,
};
// jakość WebP (0-100). Logo dociskamy mocniej (jednolite tło, nie widać różnicy).
const JAKOSC = 78;
const JAKOSC_PLIK = { 'logo333.webp': 72 };

let zysk = 0;
for (const [plik, maxBok] of Object.entries(LIMITY)) {
  const p = path.join(DIR, plik);
  try {
    const przed = (await stat(p)).size;
    const img = sharp(p);
    const meta = await img.metadata();
    const dłuższy = Math.max(meta.width, meta.height);
    // tylko zmniejszamy (nigdy nie powiększamy)
    const q = JAKOSC_PLIK[plik] ?? JAKOSC;
    const buf = await img
      .resize({ width: meta.width >= meta.height ? Math.min(meta.width, maxBok) : null,
                height: meta.height > meta.width ? Math.min(meta.height, maxBok) : null,
                withoutEnlargement: true })
      .webp({ quality: q })
      .toBuffer();
    // zapisz tylko jeśli faktycznie mniejsze
    const { writeFile } = await import('node:fs/promises');
    if (buf.length < przed) {
      await writeFile(p, buf);
      const po = buf.length;
      const metaPo = await sharp(buf).metadata();
      zysk += (przed - po);
      console.log(`✓ ${plik}: ${(przed/1024|0)} KiB → ${(po/1024|0)} KiB   |   ${meta.width}x${meta.height} → ${metaPo.width}x${metaPo.height}`);
    } else {
      console.log(`– ${plik}: bez zmian (już optymalny: ${meta.width}x${meta.height})`);
    }
  } catch (e) {
    console.log(`! ${plik}: pominięto (${e.message})`);
  }
}

// ── NOWE: konwersja zdjęć JPEG → WebP (zdjęcia dorosłych na stronę dla-doroslych) ──
// Źródło to .jpeg, wynik zapisujemy jako .webp (oryginał JPEG zostaje — można go potem usunąć).
const KONWERSJA = {
  'f11.jpeg': 600,   // instruktorka prowadzi grupę
  'f22.jpeg': 600,
  'f33.jpeg': 600,
  'f44.jpeg': 600,   // selfie z grupą dorosłych
};
const { writeFile: zapisz } = await import('node:fs/promises');
for (const [zrodlo, maxBok] of Object.entries(KONWERSJA)) {
  const src = path.join(DIR, zrodlo);
  const out = path.join(DIR, zrodlo.replace(/\.jpe?g$/i, '.webp'));
  try {
    const przed = (await stat(src)).size;
    const img = sharp(src);
    const meta = await img.metadata();
    const buf = await img
      .rotate() // uszanuj orientację EXIF (zdjęcia z telefonu)
      .resize({ width: meta.width >= meta.height ? Math.min(meta.width, maxBok) : null,
                height: meta.height > meta.width ? Math.min(meta.height, maxBok) : null,
                withoutEnlargement: true })
      .webp({ quality: JAKOSC })
      .toBuffer();
    await zapisz(out, buf);
    const metaPo = await sharp(buf).metadata();
    zysk += (przed - buf.length);
    console.log(`✓ ${zrodlo} → ${path.basename(out)}: ${(przed/1024|0)} KiB → ${(buf.length/1024|0)} KiB   |   ${meta.width}x${meta.height} → ${metaPo.width}x${metaPo.height}`);
  } catch (e) {
    console.log(`! ${zrodlo}: pominięto (${e.message})`);
  }
}

console.log(`\nŁączna oszczędność: ${(zysk/1024|0)} KiB 🎉`);
console.log('\nPAMIĘTAJ: jeśli zmieniły się wymiary (strzałka → powyżej),');
console.log('zaktualizuj width/height przy <img> w HTML — albo wklej mi powyższe wyniki, a zrobię to za Ciebie.');
