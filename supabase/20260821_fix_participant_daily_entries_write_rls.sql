-- Разрешает действующему участнику создавать и обновлять только свои записи дня.
-- Не отключает RLS, не даёт доступ к чужим строкам и не разрешает DELETE.
-- Выполните вручную в Supabase Dashboard -> SQL Editor.

begin;

create schema if not exists private;

create or replace function private.is_active_participant()
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
      from public.memberships
      where user_id = auth.uid()
        and role = 'participant'
        and status = 'active'
    );
$$;

revoke all on function private.is_active_participant() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_active_participant() to authenticated;

grant select, insert, update on table public.daily_entries to authenticated;

alter table public.daily_entries enable row level security;

drop policy if exists participant_insert_own_daily_entries on public.daily_entries;
create policy participant_insert_own_daily_entries
on public.daily_entries
for insert
to authenticated
with check (
  user_id = auth.uid()
  and private.is_active_participant()
);

drop policy if exists participant_update_own_daily_entries on public.daily_entries;
create policy participant_update_own_daily_entries
on public.daily_entries
for update
to authenticated
using (
  user_id = auth.uid()
  and private.is_active_participant()
)
with check (
  user_id = auth.uid()
  and private.is_active_participant()
);

commit;

-- Проверка после выполнения: должны вернуться две строки INSERT и UPDATE.
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'daily_entries'
  and policyname in (
    'participant_insert_own_daily_entries',
    'participant_update_own_daily_entries'
  )
order by policyname;
