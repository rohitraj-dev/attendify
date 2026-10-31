alter table public.subjects
add column pass_percent numeric not null default 40;

create table public.marks (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  component text not null check (component in ('quiz1', 'midsem', 'quiz2', 'endsem')),
  marks_obtained numeric,
  max_marks numeric not null,
  created_at timestamptz default now(),
  unique (subject_id, component)
);

alter table public.marks enable row level security;

create policy "Users can view own marks"
on public.marks
for select
to authenticated
using (
  subject_id in (
    select subjects.id
    from public.subjects
    join public.semesters on semesters.id = subjects.semester_id
    where semesters.user_id = auth.uid()
  )
);

create policy "Users can insert own marks"
on public.marks
for insert
to authenticated
with check (
  subject_id in (
    select subjects.id
    from public.subjects
    join public.semesters on semesters.id = subjects.semester_id
    where semesters.user_id = auth.uid()
  )
);

create policy "Users can update own marks"
on public.marks
for update
to authenticated
using (
  subject_id in (
    select subjects.id
    from public.subjects
    join public.semesters on semesters.id = subjects.semester_id
    where semesters.user_id = auth.uid()
  )
)
with check (
  subject_id in (
    select subjects.id
    from public.subjects
    join public.semesters on semesters.id = subjects.semester_id
    where semesters.user_id = auth.uid()
  )
);

create policy "Users can delete own marks"
on public.marks
for delete
to authenticated
using (
  subject_id in (
    select subjects.id
    from public.subjects
    join public.semesters on semesters.id = subjects.semester_id
    where semesters.user_id = auth.uid()
  )
);
