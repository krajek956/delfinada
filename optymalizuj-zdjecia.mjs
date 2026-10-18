// Optymalizacja zdjęć DELFINADA — zmniejsza za duże obrazy WebP (zachowuje proporcje i jakość).
// Uruchom na komputerze:  node optymalizuj-zdjecia.mjs
// (Skrypt sam pobierze bibliotekę sharp przy pierwszym uruchomieniu przez npx — patrz instrukcja.)
import sharp from 'sharp';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const DIR = 'assets';
// maksymalny dłuższy bok dla danego pliku (px). Dobrane do tego, jak duże wyświetlają się na stronie.
const LIMITY = {
  'foto1.webp': 1000,
  'foto3.webp': 1200,
  'foto4.webp': 1200,
  'foto5.webp': 1200,
  'ada2.webp': 1100,
  'ada2-trim.webp': 1100,
  'basen001.webp': 1000,
  'basen002.webp': 1000,
  'basen003.webp': 1000,
  'logo333.webp': 600,
};
const JAKOSC = 80; // jakość WebP (0-100) — 80 to bardzo dobry kompromis

let zysk = 0;
for (const [plik, maxBok] of Object.entries(LIMITY)) {
  const p = path.join(DIR, plik);
  try {
    const przed = (await stat(p)).size;
    const img = sharp(p);
    const meta = await img.metadata();
    const dłuższy = Math.max(meta.width, meta.height);
    // tylko zmniejszamy (nigdy nie powiększamy)
    const buf = await img
      .resize({ width: meta.width >= meta.height ? Math.min(meta.width, maxBok) : null,
                height: meta.height > meta.width ? Math.min(meta.height, maxBok) : null,
                withoutEnlargement: true })
      .webp({ quality: JAKOSC })
      .toBuffer();
    // zapisz tylko jeśli faktycznie mniejsze
    const { writeFile } = await import('node:fs/promises');
    if (buf.length < przed) {
      await writeFile(p, buf);
      const po = buf.length;
      zysk += (przed - po);
      console.log(`✓ ${plik}: ${(przed/1024|0)} KiB → ${(po/1024|0)} KiB  (${meta.width}x${meta.height}, max bok ${maxBok})`);
    } else {
      console.log(`– ${plik}: bez zmian (już optymalny)`);
    }
  } catch (e) {
    console.log(`! ${plik}: pominięto (${e.message})`);
  }
}
console.log(`\nŁączna oszczędność: ${(zysk/1024|0)} KiB 🎉`);
