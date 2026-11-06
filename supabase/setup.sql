-- =====================================================================
--  DELFINADA — panel trenera: baza danych + automatyczne SMS-y
-- =====================================================================
--  Jak użyć:
--    Supabase → SQL Editor → New query → wklej CAŁY plik → Run.
--    Skrypt można uruchomić ponownie (np. po aktualizacji) — nic nie zginie.
--
--  Po uruchomieniu wykonaj jeszcze kroki z sekcji „KROK RĘCZNY” na końcu
--  pliku (konto Ady + token SMSAPI). Szczegóły w trener/README.md.
--
--  Jak działają SMS-y:
--    pg_cron co 5 minut uruchamia public.wyslij_przypomnienia().
--    Funkcja wybiera lekcje, którym należy się przypomnienie, i wysyła je
--    przez bramkę SMSAPI.pl (rozszerzenie pg_net, zapytanie HTTP).
--    Odpowiedź bramki jest zapisywana w tabeli sms_log.
-- =====================================================================

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- ---------------------------------------------------------------------
--  Tabele
-- ---------------------------------------------------------------------

-- Ustawienia trenera. Wiersz w tej tabeli = konto ma dostęp do panelu.
-- Wiersz dodaje się ręcznie (KROK RĘCZNY), aplikacja nie może go utworzyć.
create table if not exists public.ustawienia (
  trener_id               uuid primary key references auth.users(id) on delete cascade,
  imie                    text not null default 'Ada',
  telefon                 text,
  nadawca                 text,
  domyslne_miejsce        text,
  domyslna_cena           numeric(8,2),
  domyslny_czas_min       int  not null default 60 check (domyslny_czas_min between 15 and 240),
  sms_klient_wlaczone     boolean not null default true,
  sms_klient_godzin_przed int  not null default 24 check (sms_klient_godzin_przed between 1 and 72),
  sms_klient_szablon      text not null default
    'Cześć {imie}! Przypominam o zajęciach pływania: {data} o {godzina}, {miejsce}. Jeśli nie możesz przyjść, daj znać: 666 515 178. Ada, DELFINADA',
  sms_trener_wlaczone     boolean not null default true,
  sms_trener_minut_przed  int  not null default 60 check (sms_trener_minut_przed between 10 and 600),
  updated_at              timestamptz not null default now()
);

create table if not exists public.kursanci (
  id          uuid primary key default gen_random_uuid(),
  trener_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  imie        text not null check (length(trim(imie)) > 0),
  nazwisko    text,
  telefon     text,
  email       text,
  zgoda_sms   boolean not null default false,
  cena        numeric(8,2),
  poziom      text,
  cel         text,
  notatki     text,
  aktywny     boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.lekcje (
  id                     uuid primary key default gen_random_uuid(),
  trener_id              uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kursant_id             uuid not null references public.kursanci(id) on delete cascade,
  start                  timestamptz not null,
  czas_min               int not null default 60 check (czas_min between 15 and 240),
  miejsce                text,
  cena                   numeric(8,2),
  oplacona               boolean not null default false,
  status                 text not null default 'zaplanowana'
                         check (status in ('zaplanowana','odbyta','odwolana','nieobecnosc')),
  notatka                text,
  seria_id               uuid,
  sms_klient_wyslany_at  timestamptz,
  sms_trener_wyslany_at  timestamptz,
  created_at             timestamptz not null default now()
);

create index if not exists lekcje_trener_start_idx on public.lekcje (trener_id, start);
create index if not exists lekcje_kursant_idx      on public.lekcje (kursant_id, start);
create index if not exists lekcje_seria_idx        on public.lekcje (seria_id) where seria_id is not null;

create table if not exists public.sms_log (
  id          bigserial primary key,
  trener_id   uuid references auth.users(id) on delete cascade,
  lekcja_id   uuid references public.lekcje(id) on delete set null,
  typ         text not null check (typ in ('klient','trener','reczny','test')),
  numer       text,
  tresc       text,
  request_id  bigint,
  status      text not null default 'wysylany'
              check (status in ('wysylany','wyslany','blad','nieznany')),
  odpowiedz   text,
  created_at  timestamptz not null default now()
);

create index if not exists sms_log_trener_idx  on public.sms_log (trener_id, created_at desc);
create index if not exists sms_log_pending_idx on public.sms_log (request_id) where status = 'wysylany';

-- ---------------------------------------------------------------------
--  Zmiana terminu lekcji = przypomnienia wyślą się ponownie
-- ---------------------------------------------------------------------
create or replace function public._lekcje_reset_sms()
returns trigger language plpgsql as $$
begin
  if new.start is distinct from old.start then
    new.sms_klient_wyslany_at := null;
    new.sms_trener_wyslany_at := null;
  end if;
  return new;
end $$;

drop trigger if exists lekcje_reset_sms on public.lekcje;
create trigger lekcje_reset_sms before update on public.lekcje
  for each row execute function public._lekcje_reset_sms();

-- ---------------------------------------------------------------------
--  Bezpieczeństwo (RLS): dane widzi tylko zalogowany trener
-- ---------------------------------------------------------------------
create or replace function public.jest_trenerem()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ustawienia where trener_id = auth.uid());
$$;

alter table public.ustawienia enable row level security;
alter table public.kursanci   enable row level security;
alter table public.lekcje     enable row level security;
alter table public.sms_log    enable row level security;

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

drop policy if exists sms_log_select on public.sms_log;
create policy sms_log_select on public.sms_log for select to authenticated
  using (trener_id = auth.uid());

revoke all on public.ustawienia, public.kursanci, public.lekcje, public.sms_log from anon;
revoke all on public.ustawienia, public.sms_log from authenticated;
grant select, update                 on public.ustawienia           to authenticated;
grant select, insert, update, delete on public.kursanci, public.lekcje to authenticated;
grant select                         on public.sms_log              to authenticated;

-- ---------------------------------------------------------------------
--  SMS — funkcje pomocnicze
-- ---------------------------------------------------------------------

-- Numer w formacie 48XXXXXXXXX (spacje, +, 00 i myślniki są usuwane).
create or replace function public._tel(p text)
returns text language sql immutable as $$
  select case
           when d = '' then null
           when length(d) = 9 then '48' || d
           when length(d) between 10 and 15 then d
           else null
         end
  from (select regexp_replace(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '^00', '') as d) x;
$$;

-- Treść przypomnienia dla kursanta na podstawie szablonu z ustawień.
create or replace function public._tresc_przypomnienia(p_lekcja uuid)
returns text language sql stable security definer set search_path = public as $$
  select replace(replace(replace(replace(s.sms_klient_szablon,
           '{imie}', k.imie),
           '{data}', (array['niedziela','poniedziałek','wtorek','środa','czwartek','piątek','sobota'])
                       [extract(dow from l.start at time zone 'Europe/Warsaw')::int + 1]
                     || ' ' || to_char(l.start at time zone 'Europe/Warsaw', 'DD.MM')),
           '{godzina}', to_char(l.start at time zone 'Europe/Warsaw', 'HH24:MI')),
           '{miejsce}', coalesce(nullif(trim(l.miejsce), ''), nullif(trim(s.domyslne_miejsce), ''), 'basen'))
  from public.lekcje l
  join public.kursanci k   on k.id = l.kursant_id
  join public.ustawienia s on s.trener_id = l.trener_id
  where l.id = p_lekcja;
$$;

-- Wysyłka jednego SMS-a przez SMSAPI.pl. Zwraca id wpisu w sms_log.
-- Token jest czytany z Supabase Vault (sekret o nazwie smsapi_token).
create or replace function public._wyslij_sms(
  p_trener uuid, p_numer text, p_tresc text, p_lekcja uuid, p_typ text
) returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_numer   text := public._tel(p_numer);
  v_token   text;
  v_nadawca text;
  v_params  jsonb;
  v_req     bigint;
  v_log     bigint;
begin
  if v_numer is null then
    insert into public.sms_log (trener_id, lekcja_id, typ, numer, tresc, status, odpowiedz)
    values (p_trener, p_lekcja, p_typ, p_numer, p_tresc, 'blad', 'Niepoprawny numer telefonu')
    returning id into v_log;
    return v_log;
  end if;

  select decrypted_secret into v_token
  from vault.decrypted_secrets where name = 'smsapi_token' limit 1;

  if coalesce(trim(v_token), '') = '' then
    insert into public.sms_log (trener_id, lekcja_id, typ, numer, tresc, status, odpowiedz)
    values (p_trener, p_lekcja, p_typ, v_numer, p_tresc, 'blad', 'Brak tokenu SMSAPI (sekret smsapi_token w Vault)')
    returning id into v_log;
    return v_log;
  end if;

  select nullif(trim(nadawca), '') into v_nadawca from public.ustawienia where trener_id = p_trener;

  -- normalize=1: bramka zamienia polskie znaki na łacińskie (SMS mieści 160 znaków zamiast 70)
  v_params := jsonb_build_object(
    'to', v_numer, 'message', p_tresc, 'format', 'json', 'encoding', 'utf-8', 'normalize', '1');
  if v_nadawca is not null then
    v_params := v_params || jsonb_build_object('from', v_nadawca);
  end if;

  v_req := net.http_get(
    url                  := 'https://api.smsapi.pl/sms.do',
    params               := v_params,
    headers              := jsonb_build_object('Authorization', 'Bearer ' || trim(v_token)),
    timeout_milliseconds := 10000
  );

  insert into public.sms_log (trener_id, lekcja_id, typ, numer, tresc, request_id)
  values (p_trener, p_lekcja, p_typ, v_numer, p_tresc, v_req)
  returning id into v_log;
  return v_log;
end $$;

-- Przepisuje odpowiedzi bramki (net._http_response) do sms_log.
-- pg_net trzyma odpowiedzi ok. 6 godzin, dlatego robimy to przy każdym uruchomieniu.
create or replace function public._aktualizuj_statusy_sms()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.sms_log l set
    status = case
               when r.timed_out or r.error_msg is not null then 'blad'
               when r.status_code between 200 and 299 and r.content like '%"list"%' then 'wyslany'
               else 'blad'
             end,
    odpowiedz = left(coalesce(r.error_msg, r.content, ''), 500)
  from net._http_response r
  where r.id = l.request_id and l.status = 'wysylany';

  update public.sms_log
     set status = 'nieznany', odpowiedz = 'Brak odpowiedzi bramki'
   where status = 'wysylany' and created_at < now() - interval '5 hours';
end $$;

-- ---------------------------------------------------------------------
--  Główne zadanie (pg_cron co 5 minut)
-- ---------------------------------------------------------------------
create or replace function public.wyslij_przypomnienia()
returns void language plpgsql security definer set search_path = public as $$
declare
  r      record;
  v_godz int := extract(hour from now() at time zone 'Europe/Warsaw')::int;
begin
  perform public._aktualizuj_statusy_sms();

  -- 1) Przypomnienia dla kursantów: tylko 8:00–20:59, żeby nikogo nie budzić.
  if v_godz between 8 and 20 then
    for r in
      update public.lekcje l
         set sms_klient_wyslany_at = now()
        from public.kursanci k, public.ustawienia s
       where k.id = l.kursant_id
         and s.trener_id = l.trener_id
         and s.sms_klient_wlaczone
         and k.zgoda_sms
         and coalesce(trim(k.telefon), '') <> ''
         and l.status = 'zaplanowana'
         and l.sms_klient_wyslany_at is null
         and l.start > now()
         and l.start <= now() + make_interval(hours => s.sms_klient_godzin_przed)
      returning l.id, l.trener_id, k.telefon
    loop
      perform public._wyslij_sms(r.trener_id, r.telefon, public._tresc_przypomnienia(r.id), r.id, 'klient');
    end loop;
  end if;

  -- 2) Przypomnienia dla trenera przed każdą lekcją.
  for r in
    update public.lekcje l
       set sms_trener_wyslany_at = now()
      from public.kursanci k, public.ustawienia s
     where k.id = l.kursant_id
       and s.trener_id = l.trener_id
       and s.sms_trener_wlaczone
       and coalesce(trim(s.telefon), '') <> ''
       and l.status = 'zaplanowana'
       and l.sms_trener_wyslany_at is null
       and l.start > now()
       and l.start <= now() + make_interval(mins => s.sms_trener_minut_przed)
    returning l.id, l.trener_id, l.start, l.czas_min, l.miejsce,
              s.telefon as tel_trenera, s.domyslne_miejsce,
              k.imie, k.nazwisko, k.telefon as tel_kursanta
  loop
    perform public._wyslij_sms(
      r.trener_id,
      r.tel_trenera,
      'DELFINADA: ' || to_char(r.start at time zone 'Europe/Warsaw', 'HH24:MI')
        || ' lekcja - ' || trim(r.imie || ' ' || coalesce(r.nazwisko, ''))
        || ' (' || r.czas_min || ' min), '
        || coalesce(nullif(trim(r.miejsce), ''), nullif(trim(r.domyslne_miejsce), ''), 'basen')
        || coalesce('. Tel. ' || nullif(trim(r.tel_kursanta), ''), '') || '.',
      r.id,
      'trener'
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
--  Funkcje wywoływane z panelu (przyciski)
-- ---------------------------------------------------------------------
create or replace function public.wyslij_przypomnienie_teraz(p_lekcja uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_tel   text;
  v_zgoda boolean;
  v_tr    uuid;
  v_log   bigint;
begin
  if not public.jest_trenerem() then
    raise exception 'Brak dostępu';
  end if;

  select k.telefon, k.zgoda_sms, l.trener_id into v_tel, v_zgoda, v_tr
  from public.lekcje l join public.kursanci k on k.id = l.kursant_id
  where l.id = p_lekcja and l.trener_id = auth.uid();

  if v_tr is null then raise exception 'Nie znaleziono lekcji'; end if;
  if coalesce(trim(v_tel), '') = '' then raise exception 'Kursant nie ma numeru telefonu'; end if;
  if not v_zgoda then raise exception 'Kursant nie zgodził się na przypomnienia SMS'; end if;

  v_log := public._wyslij_sms(v_tr, v_tel, public._tresc_przypomnienia(p_lekcja), p_lekcja, 'reczny');
  update public.lekcje set sms_klient_wyslany_at = now() where id = p_lekcja;
  return v_log;
end $$;

create or replace function public.wyslij_test_sms()
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_tel text;
begin
  if not public.jest_trenerem() then
    raise exception 'Brak dostępu';
  end if;
  select telefon into v_tel from public.ustawienia where trener_id = auth.uid();
  if coalesce(trim(v_tel), '') = '' then
    raise exception 'Najpierw wpisz i zapisz swój numer telefonu';
  end if;
  return public._wyslij_sms(auth.uid(), v_tel,
    'DELFINADA: testowy SMS z panelu trenera. Wszystko dziala!', null, 'test');
end $$;

create or replace function public.odswiez_statusy_sms()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.jest_trenerem() then
    raise exception 'Brak dostępu';
  end if;
  perform public._aktualizuj_statusy_sms();
end $$;

-- Uprawnienia: funkcje wewnętrzne tylko dla bazy, przyciski tylko dla zalogowanych.
revoke all on function public._tel(text)                                  from public, anon, authenticated;
revoke all on function public._tresc_przypomnienia(uuid)                  from public, anon, authenticated;
revoke all on function public._wyslij_sms(uuid, text, text, uuid, text)   from public, anon, authenticated;
revoke all on function public._aktualizuj_statusy_sms()                   from public, anon, authenticated;
revoke all on function public.wyslij_przypomnienia()                      from public, anon, authenticated;
revoke all on function public.wyslij_przypomnienie_teraz(uuid)            from public, anon;
revoke all on function public.wyslij_test_sms()                           from public, anon;
revoke all on function public.odswiez_statusy_sms()                       from public, anon;
revoke all on function public.jest_trenerem()                             from public, anon;
grant execute on function public.wyslij_przypomnienie_teraz(uuid) to authenticated;
grant execute on function public.wyslij_test_sms()                to authenticated;
grant execute on function public.odswiez_statusy_sms()            to authenticated;
grant execute on function public.jest_trenerem()                  to authenticated;

-- ---------------------------------------------------------------------
--  Harmonogram (pg_cron)
-- ---------------------------------------------------------------------
select cron.unschedule(jobid) from cron.job
 where jobname in ('delfinada-przypomnienia', 'delfinada-czyszczenie');

select cron.schedule('delfinada-przypomnienia', '*/5 * * * *',
  'select public.wyslij_przypomnienia();');

-- Sprzątanie historii uruchomień crona (inaczej rośnie o ~300 wierszy dziennie).
select cron.schedule('delfinada-czyszczenie', '15 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$);


-- =====================================================================
--  KROK RĘCZNY (wykonaj raz, w osobnym zapytaniu, po uzupełnieniu danych)
-- =====================================================================
--  1. Authentication → Users → Add user → Create new user
--     (e-mail i hasło Ady, zaznacz „Auto Confirm User”).
--  2. Authentication → Sign In / Providers → wyłącz „Allow new users to sign up”.
--  3. Odkomentuj, uzupełnij i uruchom:
--
-- insert into public.ustawienia (trener_id, telefon, domyslne_miejsce, domyslna_cena)
-- select id, '+48 666 515 178', 'Basen ...', 160
--   from auth.users where email = 'EMAIL-ADY@example.com'
-- on conflict (trener_id) do nothing;
--
-- select vault.create_secret('TUTAJ-TOKEN-Z-SMSAPI', 'smsapi_token');
--
--  Zmiana tokenu w przyszłości:
-- select vault.update_secret(
--   (select id from vault.secrets where name = 'smsapi_token'), 'NOWY-TOKEN');
-- =====================================================================
