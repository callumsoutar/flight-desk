-- syllabus_stage enum: on legacy DBs, fix typo "advances syllabus" -> "advanced syllabus".
-- On fresh installs (db reset) the type does not exist yet — create it with canonical values
-- (see lib/types/database.ts Enums.syllabus_stage).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'syllabus_stage'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typname = 'syllabus_stage'
        AND e.enumlabel = 'advances syllabus'
    ) THEN
      ALTER TYPE public.syllabus_stage RENAME VALUE 'advances syllabus' TO 'advanced syllabus';
    END IF;
  ELSE
    CREATE TYPE public.syllabus_stage AS ENUM (
      'basic syllabus',
      'advanced syllabus',
      'circuit training',
      'terrain and weather awareness',
      'instrument flying and flight test revision'
    );
  END IF;
END $$;
