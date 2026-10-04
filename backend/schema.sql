-- =============================================================
--  DELFINADA — schemat bazy danych (Supabase / PostgreSQL)
--  Uruchom w: Supabase → SQL Editor → New query → Run
--  Zawiera: tabele, powiązania, Row Level Security (RODO),
--           storage na zdjęcia/filmy, automatyczny profil po rejestracji.
-- =============================================================

-- ---------- 0. Rozszerzenia ----------
create extension if not exists "pgcrypto";

-- ---------- 1. PROFILE użytkowników ----------
-- Każdy zalogowany użytkownik (rodzic/trener/admin) ma profil powiązany z auth.users.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  rola        text not null default 'rodzic' check (rola in ('rodzic','trener','admin')),
  imie        text,
  nazwisko    text,
  telefon     text,
  utworzono   timestamptz not null default now()
);

-- ---------- 2. GRUPY zajęciowe ----------
create table if not exists public.grupy (
  id          uuid primary key default gen_random_uuid(),
  nazwa       text not null,              -- np. "Delfinki"
  opis        text,
  trener_id   uuid references public.profiles(id) on delete set null,
  utworzono   timestamptz not null default now()
);

-- ---------- 3. DZIECI ----------
create table if not exists public.dzieci (
  id            uuid primary key default gen_random_uuid(),
  imie          text not null,
  nazwisko      text,
  data_ur       date,
  grupa_id      uuid references public.grupy(id) on delete set null,
  cel_opis      text,                     -- aktualny cel, np. "Kraul 15 m"
  cel_postep    int  not null default 0 check (cel_postep between 0 and 100),
  utworzono     timestamptz not null default now()
);

-- ---------- 4. POWIĄZANIE rodzic ↔ dziecko ----------
-- Umożliwia wielu opiekunów na jedno dziecko i dziecko-rodzeństwo u jednego rodzica.
create table if not exists public.rodzic_dziecko (
  rodzic_id  uuid not null references public.profiles(id) on delete cascade,
  dziecko_id uuid not null references public.dzieci(id)   on delete cascade,
  primary key (rodzic_id, dziecko_id)
);

-- ---------- 5. WPISY po zajęciach ----------
create table if not exists public.wpisy (
  id              uuid primary key default gen_random_uuid(),
  dziecko_id      uuid not null references public.dzieci(id) on delete cascade,
  trener_id       uuid references public.profiles(id) on delete set null,
  data_zajec      timestamptz not null default now(),
  nastroj         int check (nastroj between 1 and 5),  -- 1..5 (buźki)
  co_sie_udalo    text,
  nad_czym        text,
  do_domu         text,
  odznaka         text,                   -- nazwa przyznanej odznaki (opcjonalnie)
  cel_postep      int check (cel_postep between 0 and 100),
  utworzono       timestamptz not null default now()
);

-- ---------- 6. MEDIA wpisu (zdjęcia/filmy) ----------
create table if not exists public.media (
  id         uuid primary key default gen_random_uuid(),
  wpis_id    uuid not null references public.wpisy(id) on delete cascade,
  sciezka    text not null,               -- ścieżka w storage (bucket "media")
  typ        text not null check (typ in ('foto','film')),
  utworzono  timestamptz not null default now()
);

-- Indeksy pod typowe zapytania
create index if not exists idx_wpisy_dziecko on public.wpisy(dziecko_id, data_zajec desc);
create index if not exists idx_media_wpis    on public.media(wpis_id);
create index if not exists idx_rd_rodzic     on public.rodzic_dziecko(rodzic_id);
create index if not exists idx_dzieci_grupa  on public.dzieci(grupa_id);

-- =============================================================
--  FUNKCJE POMOCNICZE (bezpieczne, SECURITY DEFINER)
-- =============================================================

-- Rola bieżącego użytkownika
create or replace function public.moja_rola()
returns text language sql stable security definer set search_path = public as $$
  select rola from public.profiles where id = auth.uid();
$$;

-- Czy bieżący użytkownik jest trenerem lub adminem?
create or replace function public.jest_kadra()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.moja_rola() in ('trener','admin'), false);
$$;

-- Czy bieżący rodzic jest przypisany do danego dziecka?
create or replace function public.moje_dziecko(d uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.rodzic_dziecko
    where rodzic_id = auth.uid() and dziecko_id = d
  );
$$;

-- Automatyczne utworzenie profilu po rejestracji użytkownika
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, rola, imie, nazwisko)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'rola', 'rodzic'),
    new.raw_user_meta_data->>'imie',
    new.raw_user_meta_data->>'nazwisko'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================
--  ROW LEVEL SECURITY (RODO — izolacja danych dzieci)
--  Zasada: rodzic widzi TYLKO swoje dziecko; kadra widzi wszystko.
-- =============================================================
alter table public.profiles        enable row level security;
alter table public.grupy           enable row level security;
alter table public.dzieci          enable row level security;
alter table public.rodzic_dziecko  enable row level security;
alter table public.wpisy           enable row level security;
alter table public.media           enable row level security;

-- PROFILES: każdy widzi i edytuje swój profil; kadra widzi wszystkie
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.jest_kadra());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid());

-- GRUPY: odczyt dla zalogowanych; zapis tylko kadra
drop policy if exists grupy_select on public.grupy;
create policy grupy_select on public.grupy for select using (auth.uid() is not null);
drop policy if exists grupy_write on public.grupy;
create policy grupy_write on public.grupy for all
  using (public.jest_kadra()) with check (public.jest_kadra());

-- DZIECI: rodzic widzi swoje; kadra widzi/edytuje wszystkie
drop policy if exists dzieci_select on public.dzieci;
create policy dzieci_select on public.dzieci for select
  using (public.jest_kadra() or public.moje_dziecko(id));
drop policy if exists dzieci_write on public.dzieci;
create policy dzieci_write on public.dzieci for all
  using (public.jest_kadra()) with check (public.jest_kadra());

-- RODZIC_DZIECKO: rodzic widzi swoje powiązania; kadra zarządza
drop policy if exists rd_select on public.rodzic_dziecko;
create policy rd_select on public.rodzic_dziecko for select
  using (rodzic_id = auth.uid() or public.jest_kadra());
drop policy if exists rd_write on public.rodzic_dziecko;
create policy rd_write on public.rodzic_dziecko for all
  using (public.jest_kadra()) with check (public.jest_kadra());

-- WPISY: rodzic widzi wpisy swojego dziecka; kadra widzi/dodaje/edytuje wszystkie
drop policy if exists wpisy_select on public.wpisy;
create policy wpisy_select on public.wpisy for select
  using (public.jest_kadra() or public.moje_dziecko(dziecko_id));
drop policy if exists wpisy_write on public.wpisy;
create policy wpisy_write on public.wpisy for all
  using (public.jest_kadra()) with check (public.jest_kadra());

-- MEDIA: widoczne, jeśli widoczny jest powiązany wpis; zapis tylko kadra
drop policy if exists media_select on public.media;
create policy media_select on public.media for select using (
  exists (
    select 1 from public.wpisy w
    where w.id = media.wpis_id
      and (public.jest_kadra() or public.moje_dziecko(w.dziecko_id))
  )
);
drop policy if exists media_write on public.media;
create policy media_write on public.media for all
  using (public.jest_kadra()) with check (public.jest_kadra());

-- =============================================================
--  STORAGE — bucket "media" na zdjęcia/filmy (prywatny)
-- =============================================================
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

-- Odczyt pliku: kadra zawsze; rodzic tylko gdy plik należy do wpisu jego dziecka.
-- Konwencja ścieżki: media/<dziecko_id>/<plik>
drop policy if exists media_obj_select on storage.objects;
create policy media_obj_select on storage.objects for select using (
  bucket_id = 'media' and (
    public.jest_kadra()
    or public.moje_dziecko( (storage.foldername(name))[1]::uuid )
  )
);
-- Wgrywanie/usuwanie: tylko kadra
drop policy if exists media_obj_write on storage.objects;
create policy media_obj_write on storage.objects for insert
  with check (bucket_id = 'media' and public.jest_kadra());
drop policy if exists media_obj_delete on storage.objects;
create policy media_obj_delete on storage.objects for delete
  using (bucket_id = 'media' and public.jest_kadra());

-- =============================================================
--  GOTOWE. Następnie: utwórz konto trenera (patrz backend/README.md),
--  nadaj mu rolę 'trener', dodaj grupę i dzieci.
-- =============================================================
