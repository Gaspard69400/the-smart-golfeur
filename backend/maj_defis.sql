-- ════════════════════════════════════════════
-- THE SMART GOLFER — Défis entre amis dans un groupe (S49)
-- À coller EN ENTIER dans : Supabase → SQL Editor → New query → Run
-- Idempotent (on peut le relancer sans risque). Nécessite groups.sql déjà passé.
-- L'app fonctionne AVANT son exécution (le panneau des défis l'indique).
-- ════════════════════════════════════════════

create table if not exists public.group_challenges (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  created_by  uuid not null references auth.users(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 60),
  metric      text not null check (metric in ('net', 'putts', 'gir', 'gross', 'stableford', 'rounds')),
  starts_on   date not null,
  ends_on     date not null,
  created_at  timestamptz default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 92)
);
alter table public.group_challenges enable row level security;
create index if not exists group_challenges_group_idx on public.group_challenges(group_id);

-- Les membres du groupe voient et lancent les défis ; seul le créateur peut en supprimer un
drop policy if exists "group_challenges_select" on public.group_challenges;
create policy "group_challenges_select" on public.group_challenges
  for select using (public.is_group_member(group_id));

drop policy if exists "group_challenges_insert" on public.group_challenges;
create policy "group_challenges_insert" on public.group_challenges
  for insert with check (created_by = auth.uid() and public.is_group_member(group_id));

drop policy if exists "group_challenges_delete" on public.group_challenges;
create policy "group_challenges_delete" on public.group_challenges
  for delete using (created_by = auth.uid());
