INSERT OR IGNORE INTO role_permission_settings (
  role,
  permission_key,
  enabled,
  created_at,
  updated_at
)
SELECT
  role,
  'comparisons.study.complete',
  enabled,
  created_at,
  updated_at
FROM role_permission_settings
WHERE permission_key = 'comparisons.abarca.start';

INSERT OR IGNORE INTO role_permission_settings (
  role,
  permission_key,
  enabled,
  created_at,
  updated_at
)
SELECT
  role,
  'comparisons.study.review',
  enabled,
  created_at,
  updated_at
FROM role_permission_settings
WHERE permission_key = 'comparisons.abarca.review';

INSERT OR IGNORE INTO user_permission_overrides (
  user_id,
  permission_key,
  enabled,
  created_at,
  updated_at
)
SELECT
  user_id,
  'comparisons.study.complete',
  enabled,
  created_at,
  updated_at
FROM user_permission_overrides
WHERE permission_key = 'comparisons.abarca.start';

INSERT OR IGNORE INTO user_permission_overrides (
  user_id,
  permission_key,
  enabled,
  created_at,
  updated_at
)
SELECT
  user_id,
  'comparisons.study.review',
  enabled,
  created_at,
  updated_at
FROM user_permission_overrides
WHERE permission_key = 'comparisons.abarca.review';

DELETE FROM role_permission_settings
WHERE permission_key IN (
  'comparisons.abarca.start',
  'comparisons.abarca.review'
);

DELETE FROM user_permission_overrides
WHERE permission_key IN (
  'comparisons.abarca.start',
  'comparisons.abarca.review'
);
