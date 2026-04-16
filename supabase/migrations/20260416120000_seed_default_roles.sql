-- Global role catalog (shared across tenants). IDs match production so local/staging
-- behave the same as hosted environments. Safe to re-run (upserts by primary key).

INSERT INTO public.roles (id, name, description, is_active, created_at, updated_at)
VALUES
  (
    '0ed3afcc-877b-4ee4-b355-44deb889afd3',
    'instructor',
    'Can manage bookings, lessons, and student progress',
    true,
    '2025-07-19T07:56:13.782166Z',
    '2025-07-19T07:56:13.782166Z'
  ),
  (
    '5837eec3-c6c8-41d4-b741-a3361bbeeaf8',
    'admin',
    'Administrative access to manage users and settings',
    true,
    '2025-07-19T07:56:13.782166Z',
    '2025-07-19T07:56:13.782166Z'
  ),
  (
    '913530da-c1e0-4370-b182-05602c43d7bf',
    'member',
    'Standard member access',
    true,
    '2025-07-19T07:56:13.782166Z',
    '2025-07-19T07:56:13.782166Z'
  ),
  (
    '9ac4dbd5-648d-4f9a-8c13-4307aae0da40',
    'student',
    'Student access for learning and booking',
    true,
    '2025-07-19T07:56:13.782166Z',
    '2025-07-19T07:56:13.782166Z'
  ),
  (
    'c1f906f4-d619-49ab-a8f9-4ce2ebcf55b0',
    'owner',
    'Full system access and control',
    true,
    '2025-07-19T07:56:13.782166Z',
    '2025-07-19T07:56:13.782166Z'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = EXCLUDED.updated_at;
