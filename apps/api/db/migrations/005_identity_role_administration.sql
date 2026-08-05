BEGIN;

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'DEWAN';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SUPERIOR_LOCAL';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'MAGISTRA';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SAFEGUARDING';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ADMIN_TI';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SUSTER';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS access_valid_from date NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS access_valid_to date,
  ADD COLUMN IF NOT EXISTS mfa_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_enrolled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD CONSTRAINT users_access_period_check CHECK (access_valid_to IS NULL OR access_valid_to >= access_valid_from);

CREATE TABLE IF NOT EXISTS user_access_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewed_by uuid NOT NULL REFERENCES users(id),
  review_date date NOT NULL DEFAULT current_date,
  decision varchar(20) NOT NULL CHECK (decision IN ('KEEP','MODIFY','REVOKE')),
  previous_role user_role NOT NULL,
  reviewed_role user_role NOT NULL,
  previous_organization_id uuid REFERENCES organizations(id),
  reviewed_organization_id uuid REFERENCES organizations(id),
  note text NOT NULL,
  next_review_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_access_reviews_user_idx ON user_access_reviews(user_id,review_date DESC);

COMMIT;
