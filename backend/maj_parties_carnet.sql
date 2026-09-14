-- ════════════════════════════════════════════
-- THE SMART GOLFER — Parties partagées + match play (S45-S46) + carnet de parcours (S47)
-- À coller EN ENTIER dans : Supabase → SQL Editor → New query → Run
-- Idempotent (on peut le relancer sans risque).
-- Nécessite schema.sql + groups.sql (shares_group_with) déjà passés.
--
-- Principe de sécurité : les tables ne sont LISIBLES que par les joueurs de
-- la partie (et son créateur). Aucune écriture directe : tout passe par les
-- fonctions ci-dessous, qui vérifient qui a le droit de faire quoi.
-- ════════════════════════════════════════════

-- 1) Tables
create table if not exists public.shared_games (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  created_by  uuid not null references auth.users(id) on delete cascade,
  course      jsonb not null,     -- instantané du parcours : id, name, par_total, trous[{num,par,si,longueur}]
  tee         jsonb,              -- départ joué : {id, name, rating, slope}
  format      text not null default 'stroke' check (format in ('stroke', 'stableford', 'match')),
  status      text not null default 'live'   check (status in ('live', 'done')),
  played_on   date default current_date,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table public.shared_games enable row level security;

create table if not exists public.shared_game_players (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references public.shared_games(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,   -- null = invité sans compte
  name        text not null check (char_length(name) between 1 and 40),
  initials    text,
  color       text,
  hcp         numeric,
  position    integer not null default 0,
  scores      jsonb not null default '[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]'::jsonb,
  putts       jsonb not null default '[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]'::jsonb,
  claimed     text check (claimed in ('saved', 'ignored')),        -- carte ajoutée (ou non) à l'historique du joueur
  updated_at  timestamptz default now(),
  unique (game_id, user_id)
);
alter table public.shared_game_players enable row level security;
create index if not exists sgp_game_idx on public.shared_game_players(game_id);
create index if not exists sgp_user_idx on public.shared_game_players(user_id);

-- 2) Qui fait partie d'une partie ?
create or replace function public.is_game_member(gid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.shared_games g where g.id = gid and g.created_by = auth.uid())
      or exists (select 1 from public.shared_game_players p where p.game_id = gid and p.user_id = auth.uid());
$$;

-- 3) Lecture seulement (les écritures passent par les fonctions)
drop policy if exists "shared_games_select" on public.shared_games;
create policy "shared_games_select" on public.shared_games
  for select using (public.is_game_member(id));

drop policy if exists "shared_game_players_select" on public.shared_game_players;
create policy "shared_game_players_select" on public.shared_game_players
  for select using (public.is_game_member(game_id));

-- 4) Créer une partie avec ses joueurs
--    p_players : [{ "user_id": uuid|null, "name": "...", "initials": "..", "color": "#..", "hcp": 12.4 }]
--    Un joueur avec compte ne peut être ajouté que s'il partage un groupe avec le créateur
--    (sinon il reste « invité » : il pourra rejoindre avec le code).
create or replace function public.create_shared_game(p_course jsonb, p_tee jsonb, p_format text, p_players jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_id uuid; v_code text; v_pl jsonb; v_user uuid; v_pos int := 0; v_count int;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'Non connecté'); end if;
  if p_format not in ('stroke', 'stableford', 'match') then return jsonb_build_object('ok', false, 'error', 'Format inconnu'); end if;
  if p_course is null or coalesce(jsonb_typeof(p_course -> 'trous'), '') <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'Parcours invalide');
  end if;
  v_count := coalesce(jsonb_array_length(p_players), 0);
  if v_count < 1 or v_count > 4 then return jsonb_build_object('ok', false, 'error', 'De 1 à 4 joueurs'); end if;
  if p_format = 'match' and v_count <> 2 then return jsonb_build_object('ok', false, 'error', 'Le match play se joue à 2'); end if;

  loop
    v_code := upper(substr(md5(random()::text), 1, 6));
    begin
      insert into public.shared_games (code, created_by, course, tee, format)
      values (v_code, v_uid, p_course, p_tee, p_format) returning id into v_id;
      exit;
    exception when unique_violation then
      -- code déjà pris : on retente
    end;
  end loop;

  for v_pl in select value from jsonb_array_elements(p_players) loop
    v_user := nullif(v_pl ->> 'user_id', '')::uuid;
    if v_user is not null and v_user <> v_uid and not public.shares_group_with(v_user) then
      v_user := null;
    end if;
    insert into public.shared_game_players (game_id, user_id, name, initials, color, hcp, position)
    values (v_id, v_user, left(coalesce(nullif(trim(v_pl ->> 'name'), ''), 'Joueur'), 40),
            left(v_pl ->> 'initials', 3), left(v_pl ->> 'color', 20),
            nullif(v_pl ->> 'hcp', '')::numeric, v_pos)
    on conflict (game_id, user_id) do nothing;
    v_pos := v_pos + 1;
  end loop;

  return jsonb_build_object('ok', true, 'id', v_id, 'code', v_code);
end; $$;

-- 5) Aperçu avant de rejoindre (qui joue, quelles places sont libres)
create or replace function public.shared_game_preview(p_code text)
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare g record; v_players jsonb; v_owner text;
begin
  select id, course ->> 'name' as course_name, format, status, created_by into g
    from public.shared_games where code = upper(trim(p_code));
  if g.id is null then return jsonb_build_object('ok', false); end if;
  select name into v_owner from public.profiles where id = g.created_by;
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'hcp', p.hcp,
           'taken', p.user_id is not null, 'is_me', p.user_id = auth.uid()) order by p.position), '[]'::jsonb)
    into v_players from public.shared_game_players p where p.game_id = g.id;
  return jsonb_build_object('ok', true, 'id', g.id, 'course', g.course_name, 'format', g.format,
                            'status', g.status, 'owner_name', v_owner, 'players', v_players);
end; $$;

-- 6) Rejoindre : prendre une place « invité » (p_player) ou s'ajouter comme nouveau joueur
create or replace function public.join_shared_game(p_code text, p_player uuid default null, p_hcp numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); g record; v_name text; v_ini text; v_color text; v_count int; v_done int;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'Non connecté'); end if;
  select id, format, status into g from public.shared_games where code = upper(trim(p_code));
  if g.id is null then return jsonb_build_object('ok', false, 'error', 'Code introuvable'); end if;
  if exists (select 1 from public.shared_game_players where game_id = g.id and user_id = v_uid) then
    return jsonb_build_object('ok', true, 'game_id', g.id, 'already', true);
  end if;

  if p_player is not null then
    update public.shared_game_players set user_id = v_uid, updated_at = now()
     where id = p_player and game_id = g.id and user_id is null;
    get diagnostics v_done = row_count;
    if v_done = 0 then return jsonb_build_object('ok', false, 'error', 'Cette place est déjà prise'); end if;
    return jsonb_build_object('ok', true, 'game_id', g.id);
  end if;

  if g.status <> 'live' then return jsonb_build_object('ok', false, 'error', 'La partie est terminée'); end if;
  select count(*) into v_count from public.shared_game_players where game_id = g.id;
  if v_count >= 4 or (g.format = 'match' and v_count >= 2) then
    return jsonb_build_object('ok', false, 'error', 'La partie est complète');
  end if;
  select name, initials, color into v_name, v_ini, v_color from public.profiles where id = v_uid;
  insert into public.shared_game_players (game_id, user_id, name, initials, color, hcp, position)
  values (g.id, v_uid, left(coalesce(v_name, 'Joueur'), 40), v_ini, v_color, p_hcp, v_count);
  return jsonb_build_object('ok', true, 'game_id', g.id);
end; $$;

-- 7) Marquer un score : UNE case à la fois (deux marqueurs ne s'écrasent pas)
create or replace function public.set_game_score(p_player uuid, p_hole int, p_score int, p_putts int default null, p_set_putts boolean default false, p_set_score boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_game uuid; v_status text;
begin
  select p.game_id, g.status into v_game, v_status
    from public.shared_game_players p join public.shared_games g on g.id = p.game_id
   where p.id = p_player;
  if v_game is null then return jsonb_build_object('ok', false, 'error', 'Joueur introuvable'); end if;
  if not public.is_game_member(v_game) then return jsonb_build_object('ok', false, 'error', 'Tu ne fais pas partie de cette partie'); end if;
  if v_status <> 'live' then return jsonb_build_object('ok', false, 'error', 'La partie est terminée'); end if;
  if p_hole < 1 or p_hole > 18 then return jsonb_build_object('ok', false, 'error', 'Trou invalide'); end if;
  if p_score is not null and (p_score < 1 or p_score > 20) then return jsonb_build_object('ok', false, 'error', 'Score invalide'); end if;
  if p_putts is not null and (p_putts < 0 or p_putts > 10) then return jsonb_build_object('ok', false, 'error', 'Putts invalides'); end if;

  update public.shared_game_players set
    scores = case when p_set_score
               then jsonb_set(scores, array[(p_hole - 1)::text], coalesce(to_jsonb(p_score), 'null'::jsonb))
               else scores end,
    putts  = case when p_set_putts
               then jsonb_set(putts, array[(p_hole - 1)::text], coalesce(to_jsonb(p_putts), 'null'::jsonb))
               else putts end,
    updated_at = now()
  where id = p_player;
  update public.shared_games set updated_at = now() where id = v_game;
  return jsonb_build_object('ok', true);
end; $$;

-- 8) Ajouter un invité en cours de partie / retirer un joueur (créateur)
create or replace function public.add_game_guest(p_game uuid, p_name text, p_hcp numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g record; v_count int;
begin
  select id, format, status into g from public.shared_games where id = p_game;
  if g.id is null or not public.is_game_member(g.id) then return jsonb_build_object('ok', false, 'error', 'Partie introuvable'); end if;
  if g.status <> 'live' then return jsonb_build_object('ok', false, 'error', 'La partie est terminée'); end if;
  if p_name is null or length(trim(p_name)) = 0 then return jsonb_build_object('ok', false, 'error', 'Nom requis'); end if;
  select count(*) into v_count from public.shared_game_players where game_id = g.id;
  if v_count >= 4 or (g.format = 'match' and v_count >= 2) then return jsonb_build_object('ok', false, 'error', 'La partie est complète'); end if;
  insert into public.shared_game_players (game_id, name, initials, hcp, position)
  values (g.id, left(trim(p_name), 40), upper(left(trim(p_name), 2)), p_hcp, v_count);
  return jsonb_build_object('ok', true);
end; $$;

create or replace function public.remove_game_player(p_player uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_done int;
begin
  delete from public.shared_game_players p
   using public.shared_games g
   where p.id = p_player and g.id = p.game_id and g.created_by = auth.uid() and g.status = 'live';
  get diagnostics v_done = row_count;
  return jsonb_build_object('ok', v_done > 0);
end; $$;

-- 9) Terminer / supprimer une partie (créateur)
create or replace function public.finish_shared_game(p_game uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_done int;
begin
  update public.shared_games set status = 'done', updated_at = now()
   where id = p_game and created_by = auth.uid();
  get diagnostics v_done = row_count;
  return jsonb_build_object('ok', v_done > 0);
end; $$;

create or replace function public.delete_shared_game(p_game uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_done int;
begin
  delete from public.shared_games where id = p_game and created_by = auth.uid();
  get diagnostics v_done = row_count;
  return jsonb_build_object('ok', v_done > 0);
end; $$;

-- 10) Ma carte : ajoutée à mon historique, ou ignorée
create or replace function public.claim_game_card(p_player uuid, p_state text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_done int;
begin
  if p_state not in ('saved', 'ignored') then return jsonb_build_object('ok', false); end if;
  update public.shared_game_players set claimed = p_state, updated_at = now()
   where id = p_player and user_id = auth.uid();
  get diagnostics v_done = row_count;
  return jsonb_build_object('ok', v_done > 0);
end; $$;

-- 11) Droits : réservé aux comptes connectés
revoke all on function public.is_game_member(uuid) from public, anon;
revoke all on function public.create_shared_game(jsonb, jsonb, text, jsonb) from public, anon;
revoke all on function public.shared_game_preview(text) from public, anon;
revoke all on function public.join_shared_game(text, uuid, numeric) from public, anon;
revoke all on function public.set_game_score(uuid, int, int, int, boolean, boolean) from public, anon;
revoke all on function public.add_game_guest(uuid, text, numeric) from public, anon;
revoke all on function public.remove_game_player(uuid) from public, anon;
revoke all on function public.finish_shared_game(uuid) from public, anon;
revoke all on function public.delete_shared_game(uuid) from public, anon;
revoke all on function public.claim_game_card(uuid, text) from public, anon;

grant execute on function public.is_game_member(uuid) to authenticated;
grant execute on function public.create_shared_game(jsonb, jsonb, text, jsonb) to authenticated;
grant execute on function public.shared_game_preview(text) to authenticated;
grant execute on function public.join_shared_game(text, uuid, numeric) to authenticated;
grant execute on function public.set_game_score(uuid, int, int, int, boolean, boolean) to authenticated;
grant execute on function public.add_game_guest(uuid, text, numeric) to authenticated;
grant execute on function public.remove_game_player(uuid) to authenticated;
grant execute on function public.finish_shared_game(uuid) to authenticated;
grant execute on function public.delete_shared_game(uuid) to authenticated;
grant execute on function public.claim_game_card(uuid, text) to authenticated;


-- ─────────────────────────────────────────────
-- S47 — Carnet de parcours : notes par trou (privées, chacun les siennes)
create table if not exists public.hole_notes (
  user_id    uuid not null references auth.users(id) on delete cascade,
  course_id  text not null,
  hole       integer not null check (hole between 1 and 18),
  body       text not null default '' check (char_length(body) <= 280),
  club       text check (club is null or char_length(club) <= 20),
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id, hole)
);
alter table public.hole_notes enable row level security;

drop policy if exists "hole_notes_all_own" on public.hole_notes;
create policy "hole_notes_all_own" on public.hole_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ════════════════════════════════════════════
-- FIN
-- ════════════════════════════════════════════
