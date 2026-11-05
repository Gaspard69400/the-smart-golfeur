-- ════════════════════════════════════════════════════════════════
-- THE SMART GOLFER — maj_plans.sql (S88)
-- PLANS D'ENTRAÎNEMENT DONNÉS PAR LE COACH.
-- Un coach fixe à un de SES joueurs (table coach_players) un plan :
-- durée (semaines), objectif de séances et de minutes par semaine,
-- exercices à faire chaque semaine, message. Le suivi se calcule à partir
-- du journal (training_log, S86) que le coach peut déjà lire.
--
-- Qui voit quoi (RLS) :
--   · le coach : crée / modifie / supprime ses plans, seulement pour un
--     joueur qui lui est relié ;
--   · le joueur : lit les plans qui lui sont destinés ;
--   · personne d'autre.
-- Un seul plan actif par couple coach / joueur.
-- Idempotent : peut être rejoué sans risque.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.training_plans (
  id                uuid primary key default gen_random_uuid(),
  coach_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  player_id         uuid not null references auth.users(id) on delete cascade,
  title             text not null,
  message           text,
  start_date        date not null default current_date,
  weeks             smallint not null default 4,
  sessions_per_week smallint not null default 3,
  minutes_per_week  smallint not null default 120,
  exercises         jsonb not null default '[]'::jsonb,
  status            text not null default 'active',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint training_plans_title_len  check (char_length(title) between 1 and 80),
  constraint training_plans_msg_len    check (message is null or char_length(message) <= 500),
  constraint training_plans_weeks      check (weeks between 1 and 16),
  constraint training_plans_sessions   check (sessions_per_week between 1 and 7),
  constraint training_plans_minutes    check (minutes_per_week between 0 and 1200),
  constraint training_plans_exercises  check (jsonb_typeof(exercises) = 'array' and jsonb_array_length(exercises) <= 12),
  constraint training_plans_status     check (status in ('active', 'archived'))
);

create index if not exists training_plans_player_idx on public.training_plans (player_id, status);
create unique index if not exists training_plans_one_active
  on public.training_plans (coach_id, player_id) where status = 'active';

alter table public.training_plans enable row level security;

drop policy if exists training_plans_select       on public.training_plans;
drop policy if exists training_plans_insert_coach on public.training_plans;
drop policy if exists training_plans_update_coach on public.training_plans;
drop policy if exists training_plans_delete_coach on public.training_plans;

create policy training_plans_select on public.training_plans
  for select to authenticated using (coach_id = auth.uid() or player_id = auth.uid());

create policy training_plans_insert_coach on public.training_plans
  for insert to authenticated with check (
    coach_id = auth.uid()
    and exists (select 1 from public.coach_players cp
                where cp.coach_id = auth.uid() and cp.player_id = training_plans.player_id)
  );

create policy training_plans_update_coach on public.training_plans
  for update to authenticated
  using (coach_id = auth.uid())
  with check (
    coach_id = auth.uid()
    and exists (select 1 from public.coach_players cp
                where cp.coach_id = auth.uid() and cp.player_id = training_plans.player_id)
  );

create policy training_plans_delete_coach on public.training_plans
  for delete to authenticated using (coach_id = auth.uid());

revoke all on public.training_plans from anon;
grant select, insert, update, delete on public.training_plans to authenticated;
