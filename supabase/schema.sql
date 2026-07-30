create extension if not exists pgcrypto;

create type public.day_override_type as enum ('cancelled', 'rescheduled');
create type public.attendance_status as enum ('present', 'absent', 'cancelled');
create type public.attendance_marked_by as enum ('auto', 'manual');

create table public.semesters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  constraint semesters_date_range_check check (start_date <= end_date)
);

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters (id) on delete cascade,
  date date not null,
  reason text not null,
  constraint holidays_semester_date_unique unique (semester_id, date)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters (id) on delete cascade,
  name text not null,
  code text not null,
  min_attendance_percent numeric(5, 2) not null,
  constraint subjects_code_unique unique (semester_id, code),
  constraint subjects_min_attendance_percent_check
    check (min_attendance_percent >= 0 and min_attendance_percent <= 100)
);

create table public.schedule_slots (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  day_of_week smallint not null,
  start_time time not null,
  end_time time not null,
  constraint schedule_slots_day_of_week_check check (day_of_week between 0 and 6),
  constraint schedule_slots_time_range_check check (start_time < end_time)
);

create table public.day_overrides (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.schedule_slots (id) on delete cascade,
  date date not null,
  type public.day_override_type not null,
  new_time time,
  constraint day_overrides_slot_date_unique unique (slot_id, date),
  constraint day_overrides_new_time_check
    check (type = 'cancelled' or new_time is not null)
);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.schedule_slots (id) on delete cascade,
  date date not null,
  status public.attendance_status not null,
  marked_by public.attendance_marked_by not null,
  constraint attendance_records_slot_date_unique unique (slot_id, date)
);

create index idx_semesters_user_id on public.semesters (user_id);
create index idx_semesters_start_date on public.semesters (start_date);
create index idx_semesters_end_date on public.semesters (end_date);
create index idx_holidays_semester_id on public.holidays (semester_id);
create index idx_holidays_date on public.holidays (date);
create index idx_subjects_semester_id on public.subjects (semester_id);
create index idx_day_overrides_slot_id on public.day_overrides (slot_id);
create index idx_day_overrides_date on public.day_overrides (date);
create index idx_attendance_records_slot_id on public.attendance_records (slot_id);
create index idx_attendance_records_date on public.attendance_records (date);

create or replace function public.is_semester_owner(target_semester_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.semesters semester
    where semester.id = target_semester_id
      and semester.user_id = auth.uid()
  );
$$;

create or replace function public.is_subject_owner(target_subject_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.subjects subject
    join public.semesters semester on semester.id = subject.semester_id
    where subject.id = target_subject_id
      and semester.user_id = auth.uid()
  );
$$;

create or replace function public.is_slot_owner(target_slot_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.schedule_slots slot
    join public.subjects subject on subject.id = slot.subject_id
    join public.semesters semester on semester.id = subject.semester_id
    where slot.id = target_slot_id
      and semester.user_id = auth.uid()
  );
$$;

alter table public.semesters enable row level security;
alter table public.holidays enable row level security;
alter table public.subjects enable row level security;
alter table public.schedule_slots enable row level security;
alter table public.day_overrides enable row level security;
alter table public.attendance_records enable row level security;

create policy "authenticated users manage own semesters"
on public.semesters
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "authenticated users manage own holidays"
on public.holidays
for all
to authenticated
using (public.is_semester_owner(semester_id))
with check (public.is_semester_owner(semester_id));

create policy "authenticated users manage own subjects"
on public.subjects
for all
to authenticated
using (public.is_semester_owner(semester_id))
with check (public.is_semester_owner(semester_id));

create policy "authenticated users manage own schedule slots"
on public.schedule_slots
for all
to authenticated
using (public.is_subject_owner(subject_id))
with check (public.is_subject_owner(subject_id));

create policy "authenticated users manage own day overrides"
on public.day_overrides
for all
to authenticated
using (public.is_slot_owner(slot_id))
with check (public.is_slot_owner(slot_id));

create policy "authenticated users manage own attendance records"
on public.attendance_records
for all
to authenticated
using (public.is_slot_owner(slot_id))
with check (public.is_slot_owner(slot_id));
