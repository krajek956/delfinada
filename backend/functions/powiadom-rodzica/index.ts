// =============================================================
//  DELFINADA — Edge Function: powiadom-rodzica
//  Wysyła e-mail do rodziców dziecka po dodaniu nowego wpisu.
//  Wyzwalana przez trigger w bazie (patrz backend/notifications.sql).
//
//  Wdrożenie (przez panel Supabase, bez CLI):
//    Edge Functions → Deploy a new function → nazwa: powiadom-rodzica
//    → wklej ten kod → Deploy.
//  Sekrety (Edge Functions → Secrets / Project Settings → Edge Functions):
//    RESEND_API_KEY   = re_xxx           (klucz z resend.com)
//    MAIL_FROM        = "DELFINADA <powiadomienia@twojadomena.pl>"
//    APP_URL          = https://www.delfinada.pl/app-postepy.html
//  (SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY są dostępne automatycznie.)
// =============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

type WpisRecord = {
  id: string;
  dziecko_id: string;
  co_sie_udalo: string | null;
  nad_czym: string | null;
  odznaka: string | null;
};

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    // Database Webhook przysyła { type, table, record, ... }
    const wpis: WpisRecord = payload.record ?? payload;
    if (!wpis?.dziecko_id) {
      return new Response('Brak dziecko_id', { status: 400 });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const MAIL_FROM = Deno.env.get('MAIL_FROM') ?? 'DELFINADA <onboarding@resend.dev>';
    const APP_URL = Deno.env.get('APP_URL') ?? 'https://www.delfinada.pl/app-postepy.html';

    if (!RESEND_API_KEY) {
      return new Response('Brak RESEND_API_KEY', { status: 500 });
    }

    // klient z service_role — omija RLS, bo działamy po stronie serwera
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) dane dziecka
    const { data: dziecko } = await sb
      .from('dzieci').select('imie, nazwisko').eq('id', wpis.dziecko_id).single();
    const imieDziecka = dziecko?.imie ?? 'Twojego dziecka';

    // 2) e-maile rodziców przypisanych do dziecka
    const { data: powiazania } = await sb
      .from('rodzic_dziecko').select('rodzic_id').eq('dziecko_id', wpis.dziecko_id);
    const rodzicIds = (powiazania ?? []).map((r) => r.rodzic_id);
    if (!rodzicIds.length) {
      return new Response(JSON.stringify({ info: 'Brak rodziców do powiadomienia' }), { status: 200 });
    }
    const { data: profile } = await sb
      .from('profiles').select('email, imie').in('id', rodzicIds);
    const odbiorcy = (profile ?? []).map((p) => p.email).filter(Boolean) as string[];
    if (!odbiorcy.length) {
      return new Response(JSON.stringify({ info: 'Rodzice bez adresu e-mail' }), { status: 200 });
    }

    // 3) treść maila
    const tytul = wpis.co_sie_udalo?.trim() || 'Nowy wpis o postępach';
    const odznaka = wpis.odznaka
      ? `<p style="margin:8px 0;padding:8px 12px;background:#eafafc;border-radius:12px;color:#0e7c8b;font-weight:700;">🏅 Nowa odznaka: ${escapeHtml(wpis.odznaka)}</p>`
      : '';
    const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #d2f2f6">
      <div style="background:linear-gradient(120deg,#0e7c8b,#189aad);padding:22px 24px;color:#fff">
        <p style="margin:0;font-size:20px;font-weight:800">DELFINADA 🐬</p>
        <p style="margin:4px 0 0;opacity:.9;font-size:13px">Nowy wpis o postępach dziecka</p>
      </div>
      <div style="padding:24px">
        <p style="margin:0 0 6px;color:#0b6270;font-size:16px">Cześć! 👋</p>
        <p style="margin:0 0 14px;color:#334;line-height:1.5">
          Pojawił się nowy wpis o postępach <strong>${escapeHtml(imieDziecka)}</strong> po ostatnich zajęciach:
        </p>
        <p style="margin:0 0 6px;color:#0e7c8b;font-size:18px;font-weight:800">${escapeHtml(tytul)}</p>
        ${wpis.nad_czym ? `<p style="margin:6px 0;color:#556;line-height:1.5"><strong>Nad czym pracujemy:</strong> ${escapeHtml(wpis.nad_czym)}</p>` : ''}
        ${odznaka}
        <a href="${APP_URL}" style="display:inline-block;margin-top:16px;background:#ff8826;color:#fff;text-decoration:none;padding:12px 22px;border-radius:14px;font-weight:800">
          Zobacz w aplikacji →
        </a>
        <p style="margin:18px 0 0;color:#9ab;font-size:12px">Otrzymujesz tę wiadomość, bo Twoje dziecko uczęszcza na zajęcia DELFINADA.</p>
      </div>
    </div>`;

    // 4) wyślij przez Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: odbiorcy,
        subject: `🐬 Nowy wpis o postępach — ${imieDziecka}`,
        html,
      }),
    });

    const wynik = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: wynik }), { status: 502 });
    }
    return new Response(JSON.stringify({ ok: true, wyslano_do: odbiorcy.length }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
