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
