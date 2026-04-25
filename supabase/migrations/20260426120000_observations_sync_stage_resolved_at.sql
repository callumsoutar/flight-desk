-- Align observations.stage with resolved_at for rows updated outside the app or before API sync.
-- UI and queries treat `stage = closed` as the canonical "resolved" state.

UPDATE public.observations
SET stage = 'closed'::public.observation_stage
WHERE resolved_at IS NOT NULL
  AND stage IS DISTINCT FROM 'closed';

UPDATE public.observations
SET resolved_at = COALESCE(resolved_at, now())
WHERE stage = 'closed'
  AND resolved_at IS NULL;
