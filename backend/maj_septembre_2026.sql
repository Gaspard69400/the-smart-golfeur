-- ════════════════════════════════════════════
-- THE SMART GOLFER — Mise à jour de septembre 2026 (sessions 41 et suivantes)
-- À coller EN ENTIER dans : Supabase → SQL Editor → New query → Run
-- Idempotent (on peut le relancer sans risque). Nécessite schema.sql + groups.sql déjà passés.
-- L'app fonctionne AVANT son exécution ; ce script débloque les éléments indiqués.
-- ════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- S41 — Aperçu d'un groupe AVANT de le rejoindre (nom, nb de membres, créateur).
-- Les règles RLS cachent un groupe à qui n'en est pas membre : cette fonction
-- ne révèle que ces 3 informations, et seulement à qui connaît le code.
create or replace function public.group_preview(p_code text)
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare g record; v_count int; v_owner text; v_member boolean;
begin
  select id, name, owner_id into g from public.groups
   where upper(invite_code) = upper(trim(p_code));
  if g.id is null then return jsonb_build_object('ok', false); end if;
  select count(*) into v_count from public.group_members where group_id = g.id;
  select name into v_owner from public.profiles where id = g.owner_id;
  select exists (select 1 from public.group_members where group_id = g.id and user_id = auth.uid()) into v_member;
  return jsonb_build_object('ok', true, 'name', g.name, 'members', v_count,
                            'owner_name', v_owner, 'is_member', v_member);
end; $$;

grant execute on function public.group_preview(text) to authenticated;

-- ─────────────────────────────────────────────
-- S42 — Données complètes des parties dans le cloud
-- Départ joué, rating/slope, points stableford, putts trou par trou…
-- Sans cette colonne, ces informations ne quittent pas le téléphone
-- (l'app les conserve en local, mais un autre appareil ne les verra pas).
alter table public.rounds add column if not exists extra jsonb;

-- ─────────────────────────────────────────────
-- S43 — Suppression de compte (RGPD)
-- Efface le compte : toutes les tables suivent (on delete cascade).
-- Les groupes que la personne a créés passent d'abord au plus ancien membre,
-- sinon ils disparaîtraient aussi pour les autres.
create or replace function public.delete_my_account()
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid := auth.uid(); g record; v_next uuid;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'Non connecté'); end if;
  for g in select id from public.groups where owner_id = v_uid loop
    select user_id into v_next from public.group_members
     where group_id = g.id and user_id <> v_uid order by joined_at limit 1;
    if v_next is not null then
      update public.groups set owner_id = v_next where id = g.id;
    end if;
  end loop;
  delete from auth.users where id = v_uid;
  return jsonb_build_object('ok', true);
end; $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ─────────────────────────────────────────────
-- S43 — Statistiques d'usage ANONYMES
-- Un compteur par jour et par page. Aucun identifiant, aucune adresse.
-- Aucune policy RLS : personne ne lit cette table depuis l'app ; toi, tu la
-- consultes dans Supabase (Table Editor → usage_daily, ou la requête plus bas).
create table if not exists public.usage_daily (
  day   date not null default current_date,
  page  text not null,
  views integer not null default 0,
  primary key (day, page)
);
alter table public.usage_daily enable row level security;

create or replace function public.track_page(p_page text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_page is null or p_page !~ '^[a-z_-]{2,24}$' then return; end if;
  insert into public.usage_daily (day, page, views) values (current_date, p_page, 1)
  on conflict (day, page) do update set views = public.usage_daily.views + 1;
end; $$;

grant execute on function public.track_page(text) to anon, authenticated;

-- Pour lire les chiffres (à lancer quand tu veux, dans le SQL Editor) :
--   select page, sum(views) as vues from public.usage_daily
--   where day > current_date - 30 group by page order by vues desc;

-- ─────────────────────────────────────────────
-- S44 — Kudos partagés et commentaires sous les parties
-- Visibles par ceux qui voient la partie : son auteur et les membres de ses groupes.
create or replace function public.can_see_round(rid bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.rounds r
    where r.id = rid and (r.user_id = auth.uid() or public.shares_group_with(r.user_id))
  );
$$;
grant execute on function public.can_see_round(bigint) to authenticated;

create table if not exists public.round_kudos (
  round_id   bigint not null references public.rounds(id) on delete cascade,
  user_id    uuid   not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (round_id, user_id)
);
alter table public.round_kudos enable row level security;

drop policy if exists "round_kudos_select" on public.round_kudos;
create policy "round_kudos_select" on public.round_kudos
  for select using (public.can_see_round(round_id));
drop policy if exists "round_kudos_insert" on public.round_kudos;
create policy "round_kudos_insert" on public.round_kudos
  for insert with check (user_id = auth.uid() and public.can_see_round(round_id));
drop policy if exists "round_kudos_delete" on public.round_kudos;
create policy "round_kudos_delete" on public.round_kudos
  for delete using (user_id = auth.uid());

create table if not exists public.round_comments (
  id         uuid primary key default gen_random_uuid(),
  round_id   bigint not null references public.rounds(id) on delete cascade,
  user_id    uuid   not null references auth.users(id) on delete cascade,
  body       text   not null check (char_length(body) between 1 and 500),
  created_at timestamptz default now()
);
alter table public.round_comments enable row level security;
create index if not exists round_comments_round_idx on public.round_comments(round_id);

drop policy if exists "round_comments_select" on public.round_comments;
create policy "round_comments_select" on public.round_comments
  for select using (public.can_see_round(round_id));
drop policy if exists "round_comments_insert" on public.round_comments;
create policy "round_comments_insert" on public.round_comments
  for insert with check (user_id = auth.uid() and public.can_see_round(round_id));
-- Supprimer : son propre commentaire, ou n'importe quel commentaire sous SA partie
drop policy if exists "round_comments_delete" on public.round_comments;
create policy "round_comments_delete" on public.round_comments
  for delete using (
    user_id = auth.uid()
    or exists (select 1 from public.rounds r where r.id = round_id and r.user_id = auth.uid())
  );
