-- ════════════════════════════════════════════
-- THE SMART GOLFER — Pilotage (S66) : compteur de joueurs actifs
-- À coller EN ENTIER dans : Supabase → SQL Editor → New query → Run
-- Idempotent (on peut le relancer sans risque). Une seule action de ta part :
-- ce fichier en entier, une fois. Rien d'autre à faire ensuite.
--
-- Ce que ça fait :
--  1. Ajoute une colonne `profiles.is_admin` (false pour tout le monde par
--     défaut) et la met à `true` pour TON compte (repéré par ton email de
--     connexion, gaspardgolfcool@gmail.com — remplace cette adresse dans le
--     bloc « 1) Qui est admin ? » juste en dessous si tu te connectes avec
--     une autre adresse, ou pour ajouter un 2e compte admin plus tard).
--  2. Crée une fonction `admin_weekly_stats()` qui ne renvoie des chiffres
--     QUE si tu es connecté avec un compte marqué `is_admin` — n'importe
--     qui d'autre qui l'appelle reçoit une erreur, aucune donnée. C'est ce
--     que lit l'écran « Pilotage » (Paramètres → tout en bas, visible
--     seulement sur ton compte).
--  3. Elle compte, semaine par semaine (lundi à dimanche, 9 dernières
--     semaines dont celle en cours) : comptes créés, joueurs ayant
--     enregistré au moins une partie CETTE semaine-là, parties enregistrées,
--     avis « Ton avis » reçus. TON compte est retiré de ces 4 chiffres, et
--     les comptes de test créés pendant le développement aussi (adresses en
--     @smartgolfer.test — vois-les comme des faux joueurs, pas des vrais).
-- ════════════════════════════════════════════

-- 1) Qui est admin ?
alter table public.profiles add column if not exists is_admin boolean not null default false;

update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'gaspardgolfcool@gmail.com');

-- 2) Les 9 dernières semaines (lundi à dimanche, ISO), comptes réels seulement
create or replace function public.admin_weekly_stats()
returns table (
  week_start      date,
  is_current      boolean,
  new_accounts    bigint,
  active_players  bigint,
  rounds_logged   bigint,
  feedback_count  bigint
)
language plpgsql security definer stable set search_path = public
as $$
begin
  if not coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false) then
    raise exception 'Accès réservé';
  end if;

  return query
  with weeks as (
    select d::date as week_start
    from generate_series(
      date_trunc('week', now()) - interval '8 weeks',
      date_trunc('week', now()),
      interval '1 week'
    ) d
  ),
  -- Comptes « réels » : ni toi, ni les adresses de test créées pendant le développement.
  real_users as (
    select p.id
    from public.profiles p
    join auth.users u on u.id = p.id
    where not p.is_admin
      and u.email not like '%@smartgolfer.test'
  ),
  accs as (
    select date_trunc('week', p.created_at)::date as wk, count(*) as n
    from public.profiles p
    join real_users r on r.id = p.id
    group by 1
  ),
  rnds as (
    select date_trunc('week', r.created_at)::date as wk,
           count(*) as n,
           count(distinct r.user_id) as active
    from public.rounds r
    join real_users u on u.id = r.user_id
    group by 1
  ),
  fbs as (
    select date_trunc('week', f.created_at)::date as wk, count(*) as n
    from public.feedback f
    where f.user_id is null or f.user_id in (select id from real_users)
    group by 1
  )
  select
    w.week_start,
    w.week_start = date_trunc('week', now())::date,
    coalesce(a.n, 0),
    coalesce(rd.active, 0),
    coalesce(rd.n, 0),
    coalesce(f.n, 0)
  from weeks w
  left join accs a  on a.wk = w.week_start
  left join rnds rd on rd.wk = w.week_start
  left join fbs f   on f.wk = w.week_start
  order by w.week_start;
end;
$$;

revoke all on function public.admin_weekly_stats() from public, anon;
grant execute on function public.admin_weekly_stats() to authenticated;

-- ════════════════════════════════════════════
-- FIN — recharge l'app puis ouvre Paramètres, tout en bas.
-- ════════════════════════════════════════════
