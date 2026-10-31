alter table public.marks
drop constraint marks_component_check;

alter table public.marks
add constraint marks_component_check
check (component in ('quiz1', 'midsem', 'quiz2', 'endsem', 'teacher'));
