create table public.exams (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  date date not null,
  title text not null default 'Exam',
  created_at timestamptz default now()
);

alter table public.exams enable row level security;

create policy "Users can view own exams"
on public.exams
for select
to authenticated
using (
  semester_id in (
    select id
    from public.semesters
    where user_id = auth.uid()
  )
);

create policy "Users can insert own exams"
on public.exams
for insert
to authenticated
with check (
  semester_id in (
    select id
    from public.semesters
    where user_id = auth.uid()
  )
);

create policy "Users can update own exams"
on public.exams
for update
to authenticated
using (
  semester_id in (
    select id
    from public.semesters
    where user_id = auth.uid()
  )
)
with check (
  semester_id in (
    select id
    from public.semesters
    where user_id = auth.uid()
  )
);

create policy "Users can delete own exams"
on public.exams
for delete
to authenticated
using (
  semester_id in (
    select id
    from public.semesters
    where user_id = auth.uid()
  )
);
