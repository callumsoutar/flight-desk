-- Drop aircraft.status column (no longer used; availability is represented by on_line).
-- On fresh installs the core schema (and thus aircraft) may not exist yet — only alter when the table exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'aircraft'
  ) THEN
    ALTER TABLE public.aircraft DROP COLUMN IF EXISTS status;
  END IF;
END $$;
