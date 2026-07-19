-- ════════════════════════════════════════════
-- THE SMART GOLFER — Groupes entre joueurs (#5)
-- À coller dans : Supabase → SQL Editor → New query → Run
-- Idempotent. Nécessite schema.sql (+ coach_hub.sql déjà passés).
-- ════════════════════════════════════════════

-- 1) Tables
create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  invite_code text unique,
  created_at  timestamptz default now()
);
alter table public.groups enable row level security;

create table if not exists public.group_members (
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);
alter table public.group_members enable row level security;
create index if not exists group_members_user_idx  on public.group_members(user_id);
create index if not exists group_members_group_idx on public.group_members(group_id);

-- 2) Helpers SECURITY DEFINER (évitent la récursion RLS)
create or replace function public.is_group_member(gid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = gid and user_id = auth.uid());
$$;

create or replace function public.shares_group_with(other uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- 3) RLS
drop policy if exists "groups_select_member" on public.groups;
create policy "groups_select_member" on public.groups
  for select using (public.is_group_member(id) or owner_id = auth.uid());

drop policy if exists "groups_delete_owner" on public.groups;
create policy "groups_delete_owner" on public.groups
  for delete using (owner_id = auth.uid());

drop policy if exists "group_members_select" on public.group_members;
create policy "group_members_select" on public.group_members
  for select using (public.is_group_member(group_id));

drop policy if exists "group_members_delete_self" on public.group_members;
create policy "group_members_delete_self" on public.group_members
  for delete using (user_id = auth.uid());

-- Voir le profil et les parties de ses co-équipiers (pour le classement du groupe)
drop policy if exists "profiles_select_groupmate" on public.profiles;
create policy "profiles_select_groupmate" on public.profiles
  for select using (public.shares_group_with(public.profiles.id));

drop policy if exists "rounds_select_groupmate" on public.rounds;
create policy "rounds_select_groupmate" on public.rounds
  for select using (public.shares_group_with(public.rounds.user_id));

-- 4) RPCs : créer / rejoindre un groupe
create or replace function public.create_group(p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_code text;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'Nom requis');
  end if;
  loop
    v_code := upper(substr(md5(random()::text), 1, 6));
    begin
      insert into public.groups (name, owner_id, invite_code)
      values (trim(p_name), auth.uid(), v_code) returning id into v_id;
      exit;
    exception when unique_violation then
      -- collision de code : on retente
    end;
  end loop;
  insert into public.group_members (group_id, user_id) values (v_id, auth.uid()) on conflict do nothing;
  return jsonb_build_object('ok', true, 'id', v_id, 'invite_code', v_code, 'name', trim(p_name));
end; $$;

create or replace function public.join_group(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  select id, name into v_id, v_name from public.groups where upper(invite_code) = upper(trim(p_code));
  if v_id is null then return jsonb_build_object('ok', false, 'error', 'Code introuvable'); end if;
  insert into public.group_members (group_id, user_id) values (v_id, auth.uid()) on conflict do nothing;
  return jsonb_build_object('ok', true, 'group_id', v_id, 'group_name', v_name);
end; $$;

grant execute on function public.is_group_member(uuid)  to authenticated;
grant execute on function public.shares_group_with(uuid) to authenticated;
grant execute on function public.create_group(text)      to authenticated;
grant execute on function public.join_group(text)        to authenticated;

-- ════════════════════════════════════════════
-- FIN Groupes
-- ════════════════════════════════════════════
