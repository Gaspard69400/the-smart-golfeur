-- ════════════════════════════════════════════════════════════════
-- THE SMART GOLFER — maj_defi_hiver.sql (S89)
-- DÉFI D'HIVER DANS LES GROUPES : qui s'entraîne le plus ?
-- Le journal (training_log) n'est lisible que par le joueur et son coach.
-- Cette fonction donne aux MEMBRES d'un groupe uniquement des TOTAUX par
-- membre (séances, minutes, jours actifs, date de la dernière séance)
-- depuis une date — jamais les notes ni le détail des séances.
-- Appelant non membre du groupe → aucune ligne.
-- Période limitée aux 200 derniers jours.
-- Idempotent : peut être rejoué sans risque.
-- ════════════════════════════════════════════════════════════════

create or replace function public.group_training_board(p_group uuid, p_since timestamptz)
returns table (user_id uuid, name text, sessions integer, minutes integer, active_days integer, last_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id,
         coalesce(p.name, 'Joueur') as name,
         count(t.id)::int as sessions,
         coalesce(sum(t.duration_min), 0)::int as minutes,
         count(distinct (t.done_at at time zone 'Europe/Paris')::date)::int as active_days,
         max(t.done_at) as last_at
    from public.group_members m
    left join public.profiles p on p.id = m.user_id
    left join public.training_log t
           on t.user_id = m.user_id
          and t.done_at >= greatest(p_since, now() - interval '200 days')
   where m.group_id = p_group
     and exists (select 1 from public.group_members me
                  where me.group_id = p_group and me.user_id = auth.uid())
   group by m.user_id, p.name
$$;

revoke execute on function public.group_training_board(uuid, timestamptz) from public, anon;
grant execute on function public.group_training_board(uuid, timestamptz) to authenticated;
