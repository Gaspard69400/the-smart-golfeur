-- ════════════════════════════════════════════════════════════════
-- THE SMART GOLFER — maj_journal.sql (S86)
-- JOURNAL D'ENTRAÎNEMENT EN LIGNE.
-- Avant : chaque séance (exercice fait, résultat) restait sur le téléphone
-- (`tsg_trainingLog`) → le coach ne voyait rien, changer de téléphone
-- faisait tout perdre. Désormais une ligne par séance, dans le compte.
--
-- Qui voit quoi (RLS) :
--   · le joueur : ses séances (lecture + écriture) ;
--   · son coach (table coach_players) : lecture seule ;
--   · personne d'autre.
-- L'identifiant est fabriqué par l'app (texte) : une séance notée hors
-- réseau garde son identité et ne se duplique pas à l'envoi (upsert).
-- Idempotent : peut être rejoué sans risque.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.training_log (
  id             text primary key,
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  done_at        timestamptz not null default now(),
  exercise_id    text,
  exercise_title text,
  category       text,
  duration_min   integer,
  score          numeric,
  max_score      numeric,
  feeling        smallint,
  note           text,
  source         text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint training_log_id_len      check (char_length(id) between 4 and 64),
  constraint training_log_title_len   check (exercise_title is null or char_length(exercise_title) <= 120),
  constraint training_log_cat_len     check (category is null or char_length(category) <= 40),
  constraint training_log_duration    check (duration_min is null or duration_min between 0 and 600),
  constraint training_log_feeling     check (feeling is null or feeling between 1 and 5),
  constraint training_log_note_len    check (note is null or char_length(note) <= 500),
  constraint training_log_source_len  check (source is null or char_length(source) <= 20)
);

create index if not exists training_log_user_done_idx on public.training_log (user_id, done_at desc);

alter table public.training_log enable row level security;

drop policy if exists training_log_select_own   on public.training_log;
drop policy if exists training_log_select_coach on public.training_log;
drop policy if exists training_log_insert_own   on public.training_log;
drop policy if exists training_log_update_own   on public.training_log;
drop policy if exists training_log_delete_own   on public.training_log;

create policy training_log_select_own on public.training_log
  for select to authenticated using (user_id = auth.uid());

create policy training_log_select_coach on public.training_log
  for select to authenticated using (
    exists (select 1 from public.coach_players cp
            where cp.player_id = training_log.user_id and cp.coach_id = auth.uid())
  );

create policy training_log_insert_own on public.training_log
  for insert to authenticated with check (user_id = auth.uid());

create policy training_log_update_own on public.training_log
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy training_log_delete_own on public.training_log
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.training_log from anon;
grant select, insert, update, delete on public.training_log to authenticated;
