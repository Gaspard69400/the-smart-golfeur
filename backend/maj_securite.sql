-- ════════════════════════════════════════════════════════════════
-- THE SMART GOLFER — maj_securite.sql (S84)
-- Verrouille les anciennes fonctions « SECURITY DEFINER » qui étaient
-- appelables SANS être connecté (rôle anon), repérées par l'audit Supabase.
-- Supabase donne EXECUTE à public/anon par défaut à chaque nouvelle fonction ;
-- les fichiers SQL récents le retiraient déjà, pas les plus anciens.
--
-- · 9 fonctions : réservées aux comptes connectés (l'app ne les appelle
--   jamais hors connexion — vérifié dans le code).
-- · handle_new_user : fonction du déclencheur de création de profil, jamais
--   appelée directement → retirée à tout le monde (le déclencheur continue
--   de marcher : un déclencheur ne vérifie pas ce droit).
-- · track_page : RESTE ouverte à anon, c'est voulu (compteur de visites
--   anonyme, y compris sur la page d'accueil avant inscription).
-- · is_full_round : search_path fixé (alerte « search path mutable »).
-- Idempotent : peut être rejoué sans risque.
-- ════════════════════════════════════════════════════════════════

revoke execute on function public.can_see_event(uuid)       from public, anon;
revoke execute on function public.can_see_round(bigint)     from public, anon;
revoke execute on function public.create_group(text)        from public, anon;
revoke execute on function public.ensure_coach_code()       from public, anon;
revoke execute on function public.group_preview(text)       from public, anon;
revoke execute on function public.is_group_member(uuid)     from public, anon;
revoke execute on function public.join_coach_by_code(text)  from public, anon;
revoke execute on function public.join_group(text)          from public, anon;
revoke execute on function public.shares_group_with(uuid)   from public, anon;

grant execute on function public.can_see_event(uuid)       to authenticated;
grant execute on function public.can_see_round(bigint)     to authenticated;
grant execute on function public.create_group(text)        to authenticated;
grant execute on function public.ensure_coach_code()       to authenticated;
grant execute on function public.group_preview(text)       to authenticated;
grant execute on function public.is_group_member(uuid)     to authenticated;
grant execute on function public.join_coach_by_code(text)  to authenticated;
grant execute on function public.join_group(text)          to authenticated;
grant execute on function public.shares_group_with(uuid)   to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

alter function public.is_full_round(jsonb, jsonb) set search_path = public;
