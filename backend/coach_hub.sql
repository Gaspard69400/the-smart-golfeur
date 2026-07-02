-- ════════════════════════════════════════════
-- THE SMART GOLFER — Coach Hub (liaison coach ↔ joueurs)
-- À coller dans : Supabase → SQL Editor → New query → Run
-- Idempotent. Nécessite d'avoir déjà lancé schema.sql.
-- ════════════════════════════════════════════

-- 1) Code d'équipe sur le profil du coach
alter table public.profiles add column if not exists coach_code text;
create unique index if not exists profiles_coach_code_uidx
  on public.profiles (coach_code) where coach_code is not null;

-- 2) Table de liaison coach ↔ joueur
create table if not exists public.coach_players (
  coach_id   uuid not null references auth.users(id) on delete cascade,
  player_id  uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (coach_id, player_id)
);
alter table public.coach_players enable row level security;
create index if not exists coach_players_coach_idx  on public.coach_players(coach_id);
create index if not exists coach_players_player_idx on public.coach_players(player_id);

-- Un coach voit ses liens ; un joueur voit les siens
drop policy if exists "coach_players_select" on public.coach_players;
create policy "coach_players_select" on public.coach_players
  for select using (auth.uid() = coach_id or auth.uid() = player_id);

-- Chacun peut supprimer un lien qui le concerne (se délier)
drop policy if exists "coach_players_delete" on public.coach_players;
create policy "coach_players_delete" on public.coach_players
  for delete using (auth.uid() = coach_id or auth.uid() = player_id);

-- (Les insertions passent par la fonction join_coach_by_code, en SECURITY DEFINER)

-- 3) Le coach peut LIRE les données de SES joueurs (et voir leur profil)
drop policy if exists "profiles_select_related" on public.profiles;
create policy "profiles_select_related" on public.profiles
  for select using (
    exists (
      select 1 from public.coach_players cp
      where (cp.coach_id = auth.uid() and cp.player_id = public.profiles.id)
         or (cp.player_id = auth.uid() and cp.coach_id = public.profiles.id)
    )
  );

drop policy if exists "rounds_select_coach" on public.rounds;
create policy "rounds_select_coach" on public.rounds
  for select using (
    exists (select 1 from public.coach_players cp
            where cp.player_id = public.rounds.user_id and cp.coach_id = auth.uid())
  );

drop policy if exists "objectives_select_coach" on public.objectives;
create policy "objectives_select_coach" on public.objectives
  for select using (
    exists (select 1 from public.coach_players cp
            where cp.player_id = public.objectives.user_id and cp.coach_id = auth.uid())
  );

drop policy if exists "training_done_select_coach" on public.training_done;
create policy "training_done_select_coach" on public.training_done
  for select using (
    exists (select 1 from public.coach_players cp
            where cp.player_id = public.training_done.user_id and cp.coach_id = auth.uid())
  );

-- 4) Fonction : obtenir (ou générer) mon code d'équipe
create or replace function public.ensure_coach_code()
returns text language plpgsql security definer set search_path = public as $$
declare v_code text; v_existing text;
begin
  select coach_code into v_existing from public.profiles where id = auth.uid();
  if v_existing is not null and length(v_existing) > 0 then return v_existing; end if;
  loop
    v_code := upper(substr(md5(random()::text), 1, 6));
    begin
      update public.profiles set coach_code = v_code where id = auth.uid();
      return v_code;
    exception when unique_violation then
      -- collision improbable : on retente
    end;
  end loop;
end; $$;

-- 5) Fonction : rejoindre un coach via son code
create or replace function public.join_coach_by_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_coach uuid; v_name text;
begin
  select id, name into v_coach, v_name
  from public.profiles where upper(coach_code) = upper(trim(p_code));
  if v_coach is null then
    return jsonb_build_object('ok', false, 'error', 'Code introuvable');
  end if;
  if v_coach = auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'Tu ne peux pas te lier à toi-même');
  end if;
  insert into public.coach_players (coach_id, player_id)
  values (v_coach, auth.uid()) on conflict do nothing;
  return jsonb_build_object('ok', true, 'coach_id', v_coach, 'coach_name', v_name);
end; $$;

grant execute on function public.ensure_coach_code() to authenticated;
grant execute on function public.join_coach_by_code(text) to authenticated;

-- ════════════════════════════════════════════
-- FIN Coach Hub
-- ════════════════════════════════════════════
