BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'PIMPINAN', 'SEKRETARIS', 'BENDAHARA', 'KESEHATAN', 'ARSIPARIS', 'UNIT_ADMIN', 'AUDITOR', 'VIEWER');
CREATE TYPE member_status AS ENUM ('ACTIVE', 'IN_FORMATION', 'EXCLAUSTRATED', 'LEFT', 'DECEASED');
CREATE TYPE claim_stage AS ENUM ('DRAFT', 'REPORTED', 'DOCUMENTS_PENDING', 'SUBMITTED', 'VERIFICATION', 'APPROVED', 'REJECTED', 'PAID', 'CLOSED');
CREATE TYPE workflow_status AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED');
CREATE TYPE document_visibility AS ENUM ('GENERAL', 'RESTRICTED', 'CONFIDENTIAL');
CREATE TYPE journal_status AS ENUM ('DRAFT', 'POSTED', 'VOID');
CREATE TYPE account_type AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES organizations(id),
  code varchar(40) NOT NULL UNIQUE,
  name varchar(160) NOT NULL,
  type varchar(40) NOT NULL CHECK (type IN ('GENERALATE', 'PROVINCE', 'DELEGATION', 'COMMUNITY', 'WORK_UNIT')),
  address text,
  city varchar(100),
  phone varchar(40),
  email varchar(160),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX organizations_parent_idx ON organizations(parent_id);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  email varchar(200) NOT NULL,
  full_name varchar(160) NOT NULL,
  password_hash text NOT NULL,
  role user_role NOT NULL DEFAULT 'VIEWER',
  is_active boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT true,
  failed_login_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_ci_unique UNIQUE (email)
);

CREATE TABLE refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sisters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  member_number varchar(50) NOT NULL UNIQUE,
  religious_name varchar(160) NOT NULL,
  legal_name varchar(160) NOT NULL,
  birth_place varchar(100),
  birth_date date,
  join_date date,
  first_vow_date date,
  perpetual_vow_date date,
  status member_status NOT NULL DEFAULT 'ACTIVE',
  nationality varchar(80) DEFAULT 'Indonesia',
  phone varchar(40),
  email varchar(160),
  emergency_contact jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX sisters_org_status_idx ON sisters(organization_id, status) WHERE deleted_at IS NULL;

CREATE TABLE assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sister_id uuid NOT NULL REFERENCES sisters(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  title varchar(160) NOT NULL,
  location varchar(160),
  start_date date NOT NULL,
  end_date date,
  decree_number varchar(100),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX assignments_sister_idx ON assignments(sister_id, start_date DESC);

CREATE TABLE insurance_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  title varchar(200) NOT NULL,
  insurer varchar(160) NOT NULL,
  version varchar(40) NOT NULL,
  effective_date date NOT NULL,
  file_name varchar(255) NOT NULL,
  file_path text NOT NULL,
  mime_type varchar(100) NOT NULL DEFAULT 'application/pdf',
  file_size bigint,
  checksum_sha256 varchar(64),
  is_active boolean NOT NULL DEFAULT true,
  uploaded_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE insurance_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  sister_id uuid NOT NULL REFERENCES sisters(id),
  claim_number varchar(80) NOT NULL UNIQUE,
  insurer varchar(160) NOT NULL,
  policy_number varchar(100),
  incident_date date NOT NULL,
  incident_type varchar(120) NOT NULL,
  description text NOT NULL,
  amount_requested numeric(18,2) NOT NULL DEFAULT 0 CHECK (amount_requested >= 0),
  amount_approved numeric(18,2) CHECK (amount_approved >= 0),
  stage claim_stage NOT NULL DEFAULT 'DRAFT',
  due_date date,
  submitted_at timestamptz,
  closed_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX insurance_claims_org_stage_idx ON insurance_claims(organization_id, stage);

CREATE TABLE insurance_claim_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES insurance_claims(id) ON DELETE CASCADE,
  from_stage claim_stage,
  to_stage claim_stage NOT NULL,
  report_date timestamptz NOT NULL DEFAULT now(),
  report_note text NOT NULL,
  external_reference varchar(160),
  reported_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX claim_events_claim_idx ON insurance_claim_events(claim_id, report_date DESC);

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  sister_id uuid REFERENCES sisters(id),
  claim_id uuid REFERENCES insurance_claims(id),
  category varchar(80) NOT NULL,
  title varchar(200) NOT NULL,
  file_name varchar(255) NOT NULL,
  file_path text NOT NULL,
  mime_type varchar(100) NOT NULL,
  file_size bigint NOT NULL,
  checksum_sha256 varchar(64) NOT NULL,
  visibility document_visibility NOT NULL DEFAULT 'RESTRICTED',
  expires_at date,
  uploaded_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX documents_org_category_idx ON documents(organization_id, category) WHERE deleted_at IS NULL;

CREATE TABLE health_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sister_id uuid NOT NULL UNIQUE REFERENCES sisters(id),
  blood_type varchar(3),
  allergies text,
  chronic_conditions text,
  bpjs_number varchar(80),
  insurance_provider varchar(160),
  insurance_policy_number varchar(100),
  notes text,
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE health_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sister_id uuid NOT NULL REFERENCES sisters(id),
  visit_date timestamptz NOT NULL,
  provider varchar(160) NOT NULL,
  complaint text,
  diagnosis text,
  treatment text,
  follow_up_date date,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sister_id uuid NOT NULL REFERENCES sisters(id),
  name varchar(160) NOT NULL,
  dosage varchar(100) NOT NULL,
  schedule varchar(160) NOT NULL,
  start_date date NOT NULL,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE finance_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  code varchar(40) NOT NULL,
  name varchar(160) NOT NULL,
  type account_type NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (organization_id, code)
);

CREATE TABLE journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  journal_number varchar(80) NOT NULL UNIQUE,
  entry_date date NOT NULL,
  description text NOT NULL,
  status journal_status NOT NULL DEFAULT 'DRAFT',
  created_by uuid NOT NULL REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES finance_accounts(id),
  description text,
  debit numeric(18,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(18,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);

CREATE TABLE formation_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sister_id uuid NOT NULL REFERENCES sisters(id),
  stage varchar(80) NOT NULL,
  institution varchar(160),
  start_date date NOT NULL,
  end_date date,
  mentor varchar(160),
  result varchar(120),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chronicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  event_date date NOT NULL,
  title varchar(200) NOT NULL,
  content text NOT NULL,
  location varchar(160),
  tags text[] NOT NULL DEFAULT '{}',
  visibility document_visibility NOT NULL DEFAULT 'GENERAL',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sister_id uuid NOT NULL UNIQUE REFERENCES sisters(id),
  death_date date NOT NULL,
  death_place varchar(160),
  burial_place varchar(160),
  biography text,
  remembrance_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workflow_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  type varchar(80) NOT NULL,
  reference_id uuid,
  title varchar(200) NOT NULL,
  status workflow_status NOT NULL DEFAULT 'DRAFT',
  requested_by uuid NOT NULL REFERENCES users(id),
  assigned_to uuid REFERENCES users(id),
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_case_id uuid NOT NULL REFERENCES workflow_cases(id) ON DELETE CASCADE,
  from_status workflow_status,
  to_status workflow_status NOT NULL,
  note text,
  acted_by uuid NOT NULL REFERENCES users(id),
  acted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(200) NOT NULL,
  message text NOT NULL,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES users(id),
  organization_id uuid REFERENCES organizations(id),
  action varchar(80) NOT NULL,
  entity_type varchar(80) NOT NULL,
  entity_id text,
  method varchar(12),
  path text,
  ip_address inet,
  user_agent text,
  before_data jsonb,
  after_data jsonb,
  request_id uuid NOT NULL DEFAULT gen_random_uuid()
);
CREATE INDEX audit_logs_occurred_idx ON audit_logs(occurred_at DESC);
CREATE INDEX audit_logs_entity_idx ON audit_logs(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER sisters_updated_at BEFORE UPDATE ON sisters FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER assignments_updated_at BEFORE UPDATE ON assignments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER insurance_claims_updated_at BEFORE UPDATE ON insurance_claims FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER chronicles_updated_at BEFORE UPDATE ON chronicles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER workflow_cases_updated_at BEFORE UPDATE ON workflow_cases FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
