/* ════════════════════════════════════════════
   THE SMART GOLFER — Parcours partagés (Session 31)

   Problème résolu : jusqu'ici chaque joueur devait ressaisir ses parcours
   à la main (18 trous × 3 champs). Désormais, un parcours saisi par
   quelqu'un peut être partagé, cherché et importé par tous.

   À exécuter dans Supabase → SQL Editor. Idempotent : relançable sans risque.
════════════════════════════════════════════ */

-- 1) Colonnes de partage + colonnes dénormalisées (pour chercher sans lire le JSON)
alter table public.user_courses add column if not exists shared      boolean not null default false;
alter table public.user_courses add column if not exists name        text;
alter table public.user_courses add column if not exists region      text;
alter table public.user_courses add column if not exists ville       text;
alter table public.user_courses add column if not exists par_total   integer;
alter table public.user_courses add column if not exists holes       integer;
alter table public.user_courses add column if not exists author_name text;
alter table public.user_courses add column if not exists updated_at  timestamptz default now();

-- 2) Renseigner les colonnes depuis le JSON pour les parcours déjà créés
update public.user_courses
   set name      = coalesce(name,      data->>'name'),
       region    = coalesce(region,    data->>'region'),
       ville     = coalesce(ville,     data->>'ville'),
       par_total = coalesce(par_total, nullif(data->>'par_total','')::int),
       holes     = coalesce(holes,     jsonb_array_length(coalesce(data->'trous','[]'::jsonb)))
 where name is null;

-- 3) Lecture : tout utilisateur connecté peut voir les parcours PARTAGÉS
--    (la policy "user_courses_all_own" existante couvre déjà ses propres parcours)
drop policy if exists "user_courses_select_shared" on public.user_courses;
create policy "user_courses_select_shared" on public.user_courses
  for select using (shared = true and auth.role() = 'authenticated');

-- 4) Index de recherche
create index if not exists user_courses_shared_idx on public.user_courses(shared) where shared = true;
create index if not exists user_courses_name_idx   on public.user_courses(lower(name));

/* Vérification rapide :
   select id, name, ville, region, par_total, holes, shared, author_name
     from public.user_courses order by updated_at desc limit 20;
*/
