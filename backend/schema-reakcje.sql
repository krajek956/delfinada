-- =============================================================
--  DELFINADA — migracja: REAKCJE rodzica na wpis
--  Uruchom w: Supabase → SQL Editor → New query → Run
--  (bezpieczne do wielokrotnego uruchomienia)
--
--  Rodzic może zareagować na wpis o swoim dziecku (❤️ 👍 🎉 itp.).
--  Jedna reakcja na parę (wpis, użytkownik) — ponowne kliknięcie zmienia emoji.
-- =============================================================

create table if not exists public.reakcje (
  wpis_id    uuid not null references public.wpisy(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null default '❤️',
  utworzono  timestamptz not null default now(),
  primary key (wpis_id, user_id)
);

create index if not exists idx_reakcje_wpis on public.reakcje(wpis_id);

alter table public.reakcje enable row level security;

-- Odczyt: kadra widzi wszystko; rodzic widzi reakcje przy wpisach swojego dziecka
drop policy if exists reakcje_select on public.reakcje;
create policy reakcje_select on public.reakcje for select using (
  public.jest_kadra() or exists (
    select 1 from public.wpisy w
    where w.id = reakcje.wpis_id and public.moje_dziecko(w.dziecko_id)
  )
);

-- Zapis: użytkownik dodaje/zmienia WŁASNĄ reakcję i tylko przy wpisie,
-- który może widzieć (swoje dziecko) — lub kadra.
drop policy if exists reakcje_insert on public.reakcje;
create policy reakcje_insert on public.reakcje for insert with check (
  user_id = auth.uid() and (
    public.jest_kadra() or exists (
      select 1 from public.wpisy w
      where w.id = reakcje.wpis_id and public.moje_dziecko(w.dziecko_id)
    )
  )
);

drop policy if exists reakcje_update on public.reakcje;
create policy reakcje_update on public.reakcje for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists reakcje_delete on public.reakcje;
create policy reakcje_delete on public.reakcje for delete
  using (user_id = auth.uid());

-- =============================================================
--  GOTOWE. Rodzic może teraz reagować na wpisy w panelu postępów.
-- =============================================================
