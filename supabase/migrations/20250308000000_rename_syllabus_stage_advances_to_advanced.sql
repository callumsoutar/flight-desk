-- Rename enum value: "advances syllabus" -> "advanced syllabus" (spelling fix)
-- Run this in the Supabase SQL editor or via supabase db push if you use Supabase CLI.
ALTER TYPE syllabus_stage RENAME VALUE 'advances syllabus' TO 'advanced syllabus';
