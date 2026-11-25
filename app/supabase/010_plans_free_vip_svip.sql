-- 010 · Plans: Free by default, VIP and SVIP
-- Run once in Supabase → SQL Editor, after 009. Safe to run again.
--
--  • profiles.plan is now free / vip / svip, default free. Everyone starts on Free
--    (the old "creator" / "studio" values from 009 go back to Free).
--      Free  10 GB · 3 active projects · finals kept 60 days · 3 AI credits a month
--      VIP   Creator $7.99  · 100 GB · 30 AI credits a month
--      SVIP  Studio $19.99  · 1 TB · AI unlimited
--  • ai_credits starts at 3 (Free).

alter table public.profiles drop constraint if exists profiles_plan_check;

update public.profiles
set plan = 'free'
where plan is null or plan not in ('free', 'vip', 'svip');

alter table public.profiles
  alter column plan set default 'free',
  add constraint profiles_plan_check check (plan in ('free', 'vip', 'svip'));

alter table public.profiles alter column ai_credits set default 3;
update public.profiles set ai_credits = least(ai_credits, 3) where plan = 'free';
