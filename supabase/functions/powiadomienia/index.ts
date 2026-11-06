// =====================================================================
//  DELFINADA — Edge Function „powiadomienia”
// =====================================================================
//  Wysyła powiadomienia Web Push o treningach na urządzenia trenera.
//
//  Wywołania (POST, JSON):
//    {}                  — z pg_cron co minutę: wyślij należne przypomnienia
//    { akcja: 'klucz' }  — panel pobiera publiczny klucz VAPID (jest publiczny)
//    { akcja: 'test' }   — testowe powiadomienie (wymaga zalogowanego trenera)
//
//  Funkcja jest wdrażana z wyłączoną weryfikacją JWT, bo woła ją pg_cron.
//  Wywołanie bez logowania może tylko wysłać przypomnienia, które i tak
//  właśnie się należą (każda lekcja jest oznaczana jako wysłana tylko raz).
//
//  Bez zewnętrznych bibliotek: Web Push (RFC 8291 + RFC 8292) na WebCrypto.
//  Klucze VAPID są tworzone automatycznie przy pierwszym uruchomieniu
//  i trzymane w tabeli push_klucze (dostęp tylko z serwera).
// =====================================================================

const KONTAKT = 'mailto:delfinada.info@gmail.com';

// ---------------------------------------------------------------------
//  base64url i bajty
// ---------------------------------------------------------------------
export function b64u(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function unb64u(str: string): Uint8Array {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const enc = new TextEncoder();
// WebCrypto przyjmuje widoki bajtów; rzutowanie uspokaja nowsze wersje TypeScriptu.
const bs = (u: Uint8Array) => u as unknown as BufferSource;

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', bs(ikm), 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: bs(salt), info: bs(info) }, key, length * 8);
  return new Uint8Array(bits);
}

// Klucz publiczny P-256 w formacie „raw” (65 bajtów: 0x04 || x || y) z JWK.
export function rawFromJwk(jwk: JsonWebKey): Uint8Array {
  return concat(new Uint8Array([4]), unb64u(jwk.x!), unb64u(jwk.y!));
}

// ---------------------------------------------------------------------
//  Szyfrowanie treści (RFC 8291, kodowanie aes128gcm z RFC 8188)
// ---------------------------------------------------------------------
export interface Odbiorca { p256dh: string; auth: string }

export async function zaszyfruj(
  tresc: Uint8Array,
  odbiorca: Odbiorca,
  opcje: { asKeys?: CryptoKeyPair; salt?: Uint8Array } = {},
): Promise<Uint8Array> {
  const uaPublic = unb64u(odbiorca.p256dh);
  const authSecret = unb64u(odbiorca.auth);
  const asKeys = opcje.asKeys ??
    await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', bs(uaPublic), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256));

  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdh, keyInfo, 32);
  const salt = opcje.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const aes = await crypto.subtle.importKey('raw', bs(cek), 'AES-GCM', false, ['encrypt']);
  const zaszyfrowane = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: bs(nonce) }, aes, bs(concat(tresc, new Uint8Array([2]))),
  ));

  const rs = 4096;
  const naglowek = concat(
    salt,
    new Uint8Array([(rs >>> 24) & 255, (rs >>> 16) & 255, (rs >>> 8) & 255, rs & 255]),
    new Uint8Array([asPublic.length]),
    asPublic,
  );
  return concat(naglowek, zaszyfrowane);
}

// ---------------------------------------------------------------------
//  VAPID (RFC 8292): podpis JWT ES256
// ---------------------------------------------------------------------
export async function naglowekVapid(endpoint: string, privateJwk: JsonWebKey): Promise<string> {
  const aud = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 3600; // podpisujemy przy każdej wysyłce, więc 1 h wystarczy
  const header = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud, exp, sub: KONTAKT })));
  const key = await crypto.subtle.importKey('jwk', privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`),
  ));
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${b64u(rawFromJwk(privateJwk))}`;
}

export async function nowyKluczVapid(): Promise<{ publicKey: string; privateJwk: JsonWebKey }> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { publicKey: b64u(rawFromJwk(privateJwk)), privateJwk };
}

export interface Subskrypcja { id: string; endpoint: string; p256dh: string; auth: string }

export async function wyslijPush(
  sub: Subskrypcja, dane: unknown, privateJwk: JsonWebKey, fetchFn: typeof fetch = fetch,
): Promise<Response> {
  const body = await zaszyfruj(enc.encode(JSON.stringify(dane)), sub);
  return fetchFn(sub.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': await naglowekVapid(sub.endpoint, privateJwk),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'TTL': '3600',
      'Urgency': 'high',
    },
    body: bs(body),
  });
}

// ---------------------------------------------------------------------
//  Dostęp do bazy (REST Supabase z kluczem serwisowym)
// ---------------------------------------------------------------------
function env(name: string): string {
  const v = (globalThis as any).Deno?.env.get(name);
  if (!v) throw new Error(`Brak zmiennej środowiskowej ${name}`);
  return v;
}

async function api(path: string, init: RequestInit = {}): Promise<any> {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function kluczVapid(): Promise<{ public_key: string; private_jwk: JsonWebKey }> {
  let rows = await api('push_klucze?id=eq.1&select=public_key,private_jwk');
  if (!rows.length) {
    const k = await nowyKluczVapid();
    await api('push_klucze', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ id: 1, public_key: k.publicKey, private_jwk: k.privateJwk }),
    });
    rows = await api('push_klucze?id=eq.1&select=public_key,private_jwk');
  }
  return rows[0];
}

async function zalogowanyTrener(req: Request): Promise<string | null> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const anon = (globalThis as any).Deno?.env.get('SUPABASE_ANON_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');
  const res = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = await res.json();
  const ust = await api(`ustawienia?trener_id=eq.${encodeURIComponent(user.id)}&select=trener_id`);
  return ust.length ? user.id : null;
}

async function wyslijDoTrenera(trenerId: string, dane: unknown, privateJwk: JsonWebKey) {
  const subs: Subskrypcja[] = await api(
    `push_subskrypcje?trener_id=eq.${encodeURIComponent(trenerId)}&select=id,endpoint,p256dh,auth`);
  let ok = 0;
  for (const s of subs) {
    try {
      const res = await wyslijPush(s, dane, privateJwk);
      if (res.status === 404 || res.status === 410) {
        // urządzenie wyrejestrowane (np. usunięta aplikacja z ekranu)
        await api(`push_subskrypcje?id=eq.${s.id}`, { method: 'DELETE' });
      } else if (res.ok) {
        ok++;
        await api(`push_subskrypcje?id=eq.${s.id}`, {
          method: 'PATCH', body: JSON.stringify({ ostatnio_ok_at: new Date().toISOString(), ostatni_blad: null }),
        });
      } else {
        const blad = `${res.status} ${(await res.text()).slice(0, 300)}`;
        console.error('push', s.endpoint, blad);
        await api(`push_subskrypcje?id=eq.${s.id}`, { method: 'PATCH', body: JSON.stringify({ ostatni_blad: blad }) });
      }
    } catch (e) {
      console.error('push', s.endpoint, e);
      await api(`push_subskrypcje?id=eq.${s.id}`, {
        method: 'PATCH', body: JSON.stringify({ ostatni_blad: String(e).slice(0, 300) }),
      });
    }
  }
  return { urzadzenia: subs.length, wyslane: ok };
}

// ---------------------------------------------------------------------
//  Obsługa żądań
// ---------------------------------------------------------------------
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

export async function obsluz(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Tylko POST' }, 405);
  try {
    const { akcja } = await req.json().catch(() => ({}));
    const klucz = await kluczVapid();

    if (akcja === 'klucz') return json({ publicKey: klucz.public_key });

    if (akcja === 'test') {
      const trener = await zalogowanyTrener(req);
      if (!trener) return json({ error: 'Brak dostępu' }, 401);
      const wynik = await wyslijDoTrenera(trener, {
        title: '🐬 Powiadomienia działają!',
        body: 'Tak będą wyglądać przypomnienia o treningach.',
        tag: 'test',
      }, klucz.private_jwk);
      return json(wynik);
    }

    // Wywołanie z pg_cron: należne przypomnienia
    const lekcje = await api('rpc/push_do_wyslania', { method: 'POST', body: '{}' });
    const wyniki = [];
    for (const l of lekcje) {
      wyniki.push(await wyslijDoTrenera(l.trener_id, {
        title: `🐬 ${l.tytul}`,
        body: l.tresc,
        tag: `lekcja-${l.lekcja_id}`,
      }, klucz.private_jwk));
    }
    return json({ lekcje: lekcje.length, wyniki });
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
}

(globalThis as any).Deno?.serve(obsluz);
