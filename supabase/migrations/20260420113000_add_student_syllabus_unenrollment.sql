-- Track explicit syllabus unenrollment events.
alter table public.student_syllabus_enrollment
  add column if not exists unenrolled_at timestamptz;

-- Backfill existing withdrawn rows if any historical data exists.
update public.student_syllabus_enrollment
set unenrolled_at = coalesce(unenrolled_at, completion_date, updated_at)
where status = 'withdrawn'
  and unenrolled_at is null;

-- A withdrawn enrollment should always record when it was ended.
alter table public.student_syllabus_enrollment
  add constraint student_syllabus_enrollment_withdrawn_requires_unenrolled_at
  check (status <> 'withdrawn' or unenrolled_at is not null)
  not valid;

alter table public.student_syllabus_enrollment
  validate constraint student_syllabus_enrollment_withdrawn_requires_unenrolled_at;

-- An enrollment cannot be both completed and withdrawn.
alter table public.student_syllabus_enrollment
  add constraint student_syllabus_enrollment_terminal_date_exclusive
  check (completion_date is null or unenrolled_at is null)
  not valid;

alter table public.student_syllabus_enrollment
  validate constraint student_syllabus_enrollment_terminal_date_exclusive;

create index if not exists idx_student_syllabus_enrollment_unenrolled_at
  on public.student_syllabus_enrollment (tenant_id, user_id, unenrolled_at desc)
  where unenrolled_at is not null;
