ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS source_organization_id uuid REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS assignment_type varchar(24) NOT NULL DEFAULT 'PRIMARY'
    CHECK (assignment_type IN ('PRIMARY','PARALLEL','TEMPORARY')),
  ADD COLUMN IF NOT EXISTS role_category varchar(32) NOT NULL DEFAULT 'OTHER'
    CHECK (role_category IN ('LEADERSHIP','EDUCATION','PASTORAL','HEALTH','ADMINISTRATION','FORMATION','SOCIAL','OTHER')),
  ADD COLUMN IF NOT EXISTS workload_percent integer NOT NULL DEFAULT 100
    CHECK (workload_percent BETWEEN 1 AND 100),
  ADD COLUMN IF NOT EXISTS workflow_status varchar(24) NOT NULL DEFAULT 'ACTIVE'
    CHECK (workflow_status IN ('DRAFT','PROPOSED','IN_REVIEW','APPROVED','ACTIVE','COMPLETED','CANCELLED')),
  ADD COLUMN IF NOT EXISTS decree_date date,
  ADD COLUMN IF NOT EXISTS handover_status varchar(24) NOT NULL DEFAULT 'NOT_REQUIRED'
    CHECK (handover_status IN ('NOT_REQUIRED','PENDING','IN_PROGRESS','COMPLETED')),
  ADD COLUMN IF NOT EXISTS handover_notes text,
  ADD COLUMN IF NOT EXISTS updates_residence boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_assignments_organization_period
  ON assignments(organization_id,start_date,end_date);
CREATE INDEX IF NOT EXISTS idx_assignments_sister_period_status
  ON assignments(sister_id,start_date,end_date,workflow_status);
