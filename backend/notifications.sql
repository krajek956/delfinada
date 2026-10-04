-- =============================================================
--  DELFINADA — powiadomienia e-mail: wyzwalacz po dodaniu wpisu
--  -------------------------------------------------------------
--  ZALECANA METODA to Database Webhook (klikany w panelu — patrz
--  backend/README-powiadomienia.md, krok 4). Ten plik to ALTERNATYWA
--  dla osób, które wolą trigger SQL zamiast webhooka z panelu.
--
--  Wymaga rozszerzenia pg_net (Supabase ma je wbudowane).
--  Podmień <PROJECT_REF> na ref swojego projektu
--  (z URL: https://<PROJECT_REF>.supabase.co).
-- =============================================================

-- 1) Włącz pg_net (jeśli jeszcze nie włączone)
create extension if not exists pg_net;

-- 2) Funkcja wywołująca Edge Function po wstawieniu wpisu
create or replace function public.powiadom_po_wpisie()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/powiadom-rodzica',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      -- klucz serwisowy pozwala wywołać funkcję; trzymany po stronie bazy
      'Authorization', 'Bearer <SUPABASE_SERVICE_ROLE_KEY>'
    ),
    body := jsonb_build_object('record', to_jsonb(NEW))
  );
  return NEW;
end;
$$;

-- 3) Trigger: po każdym nowym wpisie
drop trigger if exists trg_powiadom_po_wpisie on public.wpisy;
create trigger trg_powiadom_po_wpisie
  after insert on public.wpisy
  for each row execute function public.powiadom_po_wpisie();

-- =============================================================
--  Uwaga: jeśli użyjesz Database Webhook z panelu (zalecane),
--  NIE uruchamiaj tego triggera — żeby nie wysyłać maila podwójnie.
-- =============================================================
