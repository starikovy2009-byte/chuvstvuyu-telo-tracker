-- Общие рейтинги клуба: чтение данных только между активными участниками.
-- Запускается один раз в Supabase Dashboard -> SQL Editor от имени владельца проекта.
-- Права INSERT / UPDATE / DELETE этот файл не меняет.

begin;

create schema if not exists private;

create or replace function private.can_read_active_participant(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.memberships as viewer
      where viewer.user_id = auth.uid()
        and viewer.role = 'participant'
        and viewer.status = 'active'
    )
    and exists (
      select 1
      from public.memberships as target
      where target.user_id = target_user_id
        and target.role = 'participant'
        and target.status = 'active'
    );
$$;

revoke all on function private.can_read_active_participant(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.can_read_active_participant(uuid) to authenticated;

drop policy if exists club_active_participants_read_memberships on public.memberships;
create policy club_active_participants_read_memberships
on public.memberships
for select
to authenticated
using (private.can_read_active_participant(user_id));

drop policy if exists club_active_participants_read_profiles on public.profiles;
create policy club_active_participants_read_profiles
on public.profiles
for select
to authenticated
using (private.can_read_active_participant(id));

drop policy if exists club_active_participants_read_daily_entries on public.daily_entries;
create policy club_active_participants_read_daily_entries
on public.daily_entries
for select
to authenticated
using (private.can_read_active_participant(user_id));

commit;

-- Проверка после запуска: должны вернуться три строки.
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and policyname in (
    'club_active_participants_read_memberships',
    'club_active_participants_read_profiles',
    'club_active_participants_read_daily_entries'
  )
order by tablename;

-- Откат при необходимости (снимите комментарии и выполните отдельно):
-- begin;
-- drop policy if exists club_active_participants_read_memberships on public.memberships;
-- drop policy if exists club_active_participants_read_profiles on public.profiles;
-- drop policy if exists club_active_participants_read_daily_entries on public.daily_entries;
-- drop function if exists private.can_read_active_participant(uuid);
-- commit;
