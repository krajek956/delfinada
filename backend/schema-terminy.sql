-- =============================================================
--  DELFINADA — migracja: TERMINY zajęć (kalendarz / harmonogram)
--  Uruchom w: Supabase → SQL Editor → New query → Run
--  (bezpieczne do wielokrotnego uruchomienia)
--
--  Obsługuje:
--   • terminy jednorazowe (konkretna data+godzina),
--   • terminy cykliczne (co tydzień w wybrane dni, w zakresie dat).
--  Terminy są przypięte do GRUPY — rodzic widzi terminy grupy swojego dziecka.
-- =============================================================

create table if not exists public.terminy (
  id            uuid primary key default gen_random_uuid(),
  grupa_id      uuid not null references public.grupy(id) on delete cascade,
  tytul         text,                       -- np. „Zajęcia Delfinki" (opcjonalnie)
  -- powtarzalność: 'jednorazowy' albo 'tygodniowy'
  typ           text not null default 'jednorazowy' check (typ in ('jednorazowy','tygodniowy')),
  godzina       time not null default '10:00',
  czas_trwania  int  not null default 60,    -- minuty
  -- jednorazowy: data konkretna
  data          date,
  -- tygodniowy: dni tygodnia (0=nd..6=sob) + zakres obowiązywania
  dni_tygodnia  int[],                       -- np. {2,4} = wt, czw
  od_dnia       date,
  do_dnia       date,
  utworzono     timestamptz not null default now()
);

create index if not exists idx_terminy_grupa on public.terminy(grupa_id);

alter table public.terminy enable row level security;

-- Odczyt: kadra widzi wszystko; rodzic widzi terminy grupy swojego dziecka
drop policy if exists terminy_select on public.terminy;
create policy terminy_select on public.terminy for select using (
  public.jest_kadra() or exists (
    select 1 from public.dzieci d
    join public.rodzic_dziecko rd on rd.dziecko_id = d.id
    where d.grupa_id = terminy.grupa_id and rd.rodzic_id = auth.uid()
  )
);

-- Zapis (dodawanie/edycja/usuwanie): tylko kadra (trener/admin)
drop policy if exists terminy_write on public.terminy;
create policy terminy_write on public.terminy for all
  using (public.jest_kadra()) with check (public.jest_kadra());

-- =============================================================
--  GOTOWE. Teraz w panelu szkoły (zakładka Grupy → termin) możesz
--  dodać harmonogram, a rodzic zobaczy go w zakładce Kalendarz.
-- =============================================================
