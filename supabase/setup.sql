-- =====================================================================
--  DELFINADA — panel trenera: baza danych + powiadomienia o treningach
-- =====================================================================
--  Jak użyć:
--    Supabase → SQL Editor → New query → wklej CAŁY plik → Run.
--    Skrypt można uruchomić ponownie (np. po aktualizacji) — dane zostaną.
--
--  Potem wykonaj kroki z trener/README.md (konto Ady, funkcja
--  „powiadomienia”, harmonogram).
--
--  Jak działają powiadomienia:
--    pg_cron co minutę wywołuje Edge Function „powiadomienia”.
--    Funkcja pobiera z bazy lekcje, przed którymi należy się przypomnienie
--    (public.push_do_wyslania), i wysyła powiadomienie Web Push na
--    urządzenia Ady zapisane w tabeli push_subskrypcje.
-- =====================================================================

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- ---------------------------------------------------------------------
--  Tabele
-- ---------------------------------------------------------------------

-- Ustawienia trenera. Wiersz w tej tabeli = konto ma dostęp do panelu.
-- Wiersz dodaje się ręcznie (README), aplikacja nie może go utworzyć.
create table if not exists public.ustawienia (
  trener_id          uuid primary key references auth.users(id) on delete cascade,
  imie               text not null default 'Ada',
  domyslne_miejsce   text,
  domyslna_cena      numeric(8,2),
  domyslny_czas_min  int  not null default 60 check (domyslny_czas_min between 15 and 240),
  push_wlaczone      boolean not null default true,
  push_minut_przed   int  not null default 60 check (push_minut_przed between 5 and 1440),
  updated_at         timestamptz not null default now()
);

create table if not exists public.kursanci (
  id          uuid primary key default gen_random_uuid(),
  trener_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  imie        text not null check (length(trim(imie)) > 0),
  nazwisko    text,
  telefon     text,
  email       text,
  cena        numeric(8,2),
  poziom      text,
  cel         text,
  notatki     text,
  aktywny     boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.lekcje (
  id               uuid primary key default gen_random_uuid(),
  trener_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kursant_id       uuid not null references public.kursanci(id) on delete cascade,
  start            timestamptz not null,
  czas_min         int not null default 60 check (czas_min between 15 and 240),
  miejsce          text,
  cena             numeric(8,2),
  oplacona         boolean not null default false,
  status           text not null default 'zaplanowana'
                   check (status in ('zaplanowana','odbyta','odwolana','nieobecnosc')),
  notatka          text,
  seria_id         uuid,
  push_wyslany_at  timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists lekcje_trener_start_idx on public.lekcje (trener_id, start);
create index if not exists lekcje_kursant_idx      on public.lekcje (kursant_id, start);
create index if not exists lekcje_seria_idx        on public.lekcje (seria_id) where seria_id is not null;
create index if not exists lekcje_push_idx         on public.lekcje (start)
  where status = 'zaplanowana' and push_wyslany_at is null;

-- Urządzenia Ady, na które idą powiadomienia (telefon, komputer).
create table if not exists public.push_subskrypcje (
  id              uuid primary key default gen_random_uuid(),
  trener_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  urzadzenie      text,
  ostatnio_ok_at  timestamptz,
  ostatni_blad    text,
  created_at      timestamptz not null default now()
);

-- Klucze VAPID do podpisywania powiadomień. Tworzy je sama funkcja
-- „powiadomienia” przy pierwszym uruchomieniu. Dostęp tylko z serwera.
create table if not exists public.push_klucze (
  id           int primary key default 1 check (id = 1),
  public_key   text  not null,
  private_jwk  jsonb not null,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
--  Zmiana terminu lekcji = przypomnienie przyjdzie ponownie
-- ---------------------------------------------------------------------
create or replace function public._lekcje_reset_push()
returns trigger language plpgsql as $$
begin
  if new.start is distinct from old.start then
    new.push_wyslany_at := null;
  end if;
  return new;
end $$;

drop trigger if exists lekcje_reset_push on public.lekcje;
create trigger lekcje_reset_push before update on public.lekcje
  for each row execute function public._lekcje_reset_push();

-- ---------------------------------------------------------------------
--  Bezpieczeństwo (RLS): dane widzi tylko zalogowany trener
-- ---------------------------------------------------------------------
create or replace function public.jest_trenerem()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ustawienia where trener_id = auth.uid());
$$;

alter table public.ustawienia       enable row level security;
alter table public.kursanci         enable row level security;
alter table public.lekcje           enable row level security;
alter table public.push_subskrypcje enable row level security;
alter table public.push_klucze      enable row level security;  -- brak polityk = brak dostępu z aplikacji

drop policy if exists ustawienia_select on public.ustawienia;
drop policy if exists ustawienia_update on public.ustawienia;
create policy ustawienia_select on public.ustawienia for select to authenticated
  using (trener_id = auth.uid());
create policy ustawienia_update on public.ustawienia for update to authenticated
  using (trener_id = auth.uid()) with check (trener_id = auth.uid());

drop policy if exists kursanci_trener on public.kursanci;
create policy kursanci_trener on public.kursanci for all to authenticated
  using (trener_id = auth.uid() and public.jest_trenerem())
  with check (trener_id = auth.uid() and public.jest_trenerem());

drop policy if exists lekcje_trener on public.lekcje;
create policy lekcje_trener on public.lekcje for all to authenticated
  using (trener_id = auth.uid() and public.jest_trenerem())
  with check (
    trener_id = auth.uid() and public.jest_trenerem()
    and exists (select 1 from public.kursanci k where k.id = kursant_id and k.trener_id = auth.uid())
  );

drop policy if exists push_subskrypcje_trener on public.push_subskrypcje;
create policy push_subskrypcje_trener on public.push_subskrypcje for all to authenticated
  using (trener_id = auth.uid() and public.jest_trenerem())
  with check (trener_id = auth.uid() and public.jest_trenerem());

revoke all on public.ustawienia, public.kursanci, public.lekcje,
              public.push_subskrypcje, public.push_klucze from anon, authenticated;
grant select, update                 on public.ustawienia to authenticated;
grant select, insert, update, delete on public.kursanci, public.lekcje, public.push_subskrypcje to authenticated;
grant all on public.ustawienia, public.kursanci, public.lekcje,
             public.push_subskrypcje, public.push_klucze to service_role;

-- ---------------------------------------------------------------------
--  Powiadomienia
-- ---------------------------------------------------------------------

-- Klucz publiczny VAPID dla panelu (jest publiczny z założenia).
create or replace function public.push_klucz_publiczny()
returns text language sql stable security definer set search_path = public as $$
  select public_key from public.push_klucze where id = 1;
$$;

-- Lekcje, przed którymi należy się przypomnienie. Od razu oznacza je jako
-- wysłane, więc równoległe wywołania nie zdublują powiadomień.
-- Wywołuje ją tylko funkcja „powiadomienia” (klucz serwisowy).
create or replace function public.push_do_wyslania()
returns table (lekcja_id uuid, trener_id uuid, tytul text, tresc text)
language sql security definer set search_path = public as $$
  with due as (
    update public.lekcje l
       set push_wyslany_at = now()
      from public.ustawienia s
     where s.trener_id = l.trener_id
       and s.push_wlaczone
       and l.status = 'zaplanowana'
       and l.push_wyslany_at is null
       and l.start > now()
       and l.start <= now() + make_interval(mins => s.push_minut_przed)
       and exists (select 1 from public.push_subskrypcje p where p.trener_id = l.trener_id)
    returning l.id, l.trener_id, l.start, l.czas_min, l.miejsce, l.kursant_id, s.domyslne_miejsce
  ), x as (
    select d.*, k.imie, k.nazwisko, k.telefon,
           greatest(1, round(extract(epoch from (d.start - now())) / 60))::int as za_min,
           to_char(d.start at time zone 'Europe/Warsaw', 'HH24:MI') as godz,
           (d.start at time zone 'Europe/Warsaw')::date - (now() at time zone 'Europe/Warsaw')::date as za_dni
      from due d join public.kursanci k on k.id = d.kursant_id
  )
  select x.id, x.trener_id,
         case
           when x.za_min < 90 then 'Za ' || x.za_min || ' min: '
           when x.za_dni = 0  then 'Dziś o ' || x.godz || ': '
           when x.za_dni = 1  then 'Jutro o ' || x.godz || ': '
           else to_char(x.start at time zone 'Europe/Warsaw', 'DD.MM') || ' o ' || x.godz || ': '
         end || trim(x.imie || ' ' || coalesce(x.nazwisko, '')),
         x.godz || ' · ' || x.czas_min || ' min · '
           || coalesce(nullif(trim(x.miejsce), ''), nullif(trim(x.domyslne_miejsce), ''), 'basen')
           || coalesce(' · tel. ' || nullif(trim(x.telefon), ''), '')
    from x;
$$;

revoke all on function public.push_do_wyslania()     from public, anon, authenticated;
revoke all on function public.push_klucz_publiczny() from public, anon;
revoke all on function public.jest_trenerem()        from public, anon;
grant execute on function public.push_do_wyslania()     to service_role;
grant execute on function public.push_klucz_publiczny() to authenticated;
grant execute on function public.jest_trenerem()        to authenticated;

-- ---------------------------------------------------------------------
--  Sprzątanie historii crona (inaczej rośnie o ~1440 wierszy dziennie)
-- ---------------------------------------------------------------------
select cron.unschedule(jobid) from cron.job
 where jobname in ('delfinada-przypomnienia', 'delfinada-czyszczenie');

select cron.schedule('delfinada-czyszczenie', '15 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '3 days'$$);

-- Harmonogram powiadomień („delfinada-powiadomienia”) dodaje się osobno,
-- po wdrożeniu funkcji, bo wymaga adresu projektu. Patrz trener/README.md.
