-- ════════════════════════════════════════════
-- THE SMART GOLFER — Interactions coach→joueur (S19 Partie B)
-- Assigner un exercice à un joueur + notes privées du coach.
-- À coller dans : Supabase → SQL Editor → New query → Run
-- Idempotent. Nécessite schema.sql + coach_hub.sql.
-- ════════════════════════════════════════════

-- 1) Exercices assignés par un coach à un joueur
create table if not exists public.training_assignments (
  id          uuid primary key default gen_random_uuid(),
  training_id text not null,
  player_id   uuid not null references auth.users(id) on delete cascade,
  coach_id    uuid not null references auth.users(id) on delete cascade,
  message     text,
  created_at  timestamptz default now(),
  unique (coach_id, player_id, training_id)
);
alter table public.training_assignments enable row level security;
create index if not exists ta_player_idx on public.training_assignments(player_id);
create index if not exists ta_coach_idx  on public.training_assignments(coach_id);

-- Le coach gère ses propres assignations ; le joueur voit celles qui le concernent
drop policy if exists "ta_coach_all" on public.training_assignments;
create policy "ta_coach_all" on public.training_assignments
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());

drop policy if exists "ta_player_select" on public.training_assignments;
create policy "ta_player_select" on public.training_assignments
  for select using (player_id = auth.uid());

-- 2) Notes privées du coach sur un joueur (invisibles au joueur)
create table if not exists public.coach_notes (
  coach_id   uuid not null references auth.users(id) on delete cascade,
  player_id  uuid not null references auth.users(id) on delete cascade,
  note       text,
  updated_at timestamptz default now(),
  primary key (coach_id, player_id)
);
alter table public.coach_notes enable row level security;

drop policy if exists "coach_notes_owner" on public.coach_notes;
create policy "coach_notes_owner" on public.coach_notes
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- ════════════════════════════════════════════
-- FIN interactions coach→joueur
-- ════════════════════════════════════════════
