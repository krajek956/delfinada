-- =============================================================
--  DELFINADA — migracja pod PANEL ADMINA
--  Uruchom w: Supabase → SQL Editor → New query → Run
--  (bezpieczne do wielokrotnego uruchomienia)
--
--  Co dodaje:
--   1. kolumnę profiles.email (żeby admin mógł wyszukać rodzica po e-mailu),
--   2. uzupełnienie e-maili dla istniejących użytkowników,
--   3. zaktualizowany trigger zapisujący e-mail przy rejestracji,
--   4. politykę pozwalającą adminowi dodawać/edytować profile,
--   5. funkcję pomocniczą do przypisania rodzica po e-mailu.
-- =============================================================

-- 1) Kolumna email w profilu
alter table public.profiles add column if not exists email text;

-- 2) Uzupełnij e-maile istniejących użytkowników z auth.users
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and (p.email is null or p.email = '');

-- 3) Trigger: przy rejestracji zapisuj też e-mail
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, rola, imie, nazwisko, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'rola', 'rodzic'),
    new.raw_user_meta_data->>'imie',
    new.raw_user_meta_data->>'nazwisko',
    new.email
  )
  on conflict (id) do update
    set email = excluded.email,
        imie = coalesce(public.profiles.imie, excluded.imie),
        nazwisko = coalesce(public.profiles.nazwisko, excluded.nazwisko);
  return new;
end;
$$;

-- 4) RLS: admin może dodawać/edytować dowolne profile (np. nadać rolę trenera)
--    (kadra już miała SELECT; tu dokładamy INSERT/UPDATE dla admina)
drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles for all
  using (public.moja_rola() = 'admin')
  with check (public.moja_rola() = 'admin');

-- 5) Funkcja: przypisz rodzica do dziecka po adresie e-mail rodzica
--    Zwraca komunikat tekstowy. Wywoływana z panelu admina przez RPC.
create or replace function public.przypisz_rodzica(p_email text, p_dziecko uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_rodzic uuid;
begin
  -- tylko kadra (trener/admin) może przypisywać
  if not public.jest_kadra() then
    return 'Brak uprawnień.';
  end if;

  select id into v_rodzic from public.profiles
  where lower(email) = lower(trim(p_email)) limit 1;

  if v_rodzic is null then
    return 'Nie znaleziono rodzica o e-mailu: ' || p_email || '. Poproś rodzica, aby najpierw założył konto.';
  end if;

  insert into public.rodzic_dziecko (rodzic_id, dziecko_id)
  values (v_rodzic, p_dziecko)
  on conflict do nothing;

  return 'OK';
end;
$$;

-- =============================================================
--  NADANIE SOBIE ROLI ADMINA
--  Podmień UID na swój (Authentication → Users → Twój użytkownik → User UID)
--  i uruchom poniższą linię (odkomentuj):
-- =============================================================
-- update public.profiles set rola = 'admin' where id = 'WKLEJ_SWOJ_UID';
