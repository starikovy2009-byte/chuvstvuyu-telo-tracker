-- Выполните этот файл вручную в Supabase SQL Editor один раз.
-- Миграция не удаляет таблицу, строки, UUID и не изменяет RLS-политики.

begin;

alter table public.daily_entries
  add column if not exists water_done boolean;

update public.daily_entries
set water_done = false
where water_done is null;

alter table public.daily_entries
  alter column water_done set default false,
  alter column water_done set not null;

alter table public.daily_entries
  add column if not exists sleep_hours numeric;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.daily_entries'::regclass
      and conname = 'daily_entries_sleep_hours_range'
  ) then
    alter table public.daily_entries
      add constraint daily_entries_sleep_hours_range
      check (sleep_hours is null or sleep_hours between 0 and 24);
  end if;
end
$$;

comment on column public.daily_entries.water_done is
  'Участник выполнил дневную цель воды 1,5 л.';

comment on column public.daily_entries.sleep_hours is
  'Продолжительность сна в часах от 0 до 24.';

commit;
