-- Drop aircraft.status column (no longer used; availability is represented by on_line).
ALTER TABLE aircraft DROP COLUMN IF EXISTS status;
