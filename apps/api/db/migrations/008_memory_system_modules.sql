BEGIN;

ALTER TABLE chronicles
  ADD COLUMN IF NOT EXISTS event_end_date date,
  ADD COLUMN IF NOT EXISTS category varchar(80) NOT NULL DEFAULT 'KEHIDUPAN_KONGREGASI',
  ADD COLUMN IF NOT EXISTS people text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source_notes text,
  ADD COLUMN IF NOT EXISTS photo_document_id uuid REFERENCES documents(id),
  ADD COLUMN IF NOT EXISTS publication_status varchar(30) NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS previous_version_id uuid REFERENCES chronicles(id),
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS public_content text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;
ALTER TABLE chronicles DROP CONSTRAINT IF EXISTS chronicles_event_period_check;
ALTER TABLE chronicles ADD CONSTRAINT chronicles_event_period_check CHECK(event_end_date IS NULL OR event_end_date>=event_date);
ALTER TABLE chronicles DROP CONSTRAINT IF EXISTS chronicles_publication_status_check;
ALTER TABLE chronicles ADD CONSTRAINT chronicles_publication_status_check CHECK(publication_status IN ('DRAFT','IN_REVIEW','PUBLISHED_INTERNAL','PUBLISHED_PUBLIC','CORRECTION_REQUIRED'));
CREATE INDEX IF NOT EXISTS chronicles_search_idx ON chronicles(organization_id,publication_status,event_date DESC);

ALTER TABLE memorials
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS title varchar(200),
  ADD COLUMN IF NOT EXISTS age_at_death integer,
  ADD COLUMN IF NOT EXISTS years_in_vows integer,
  ADD COLUMN IF NOT EXISTS photo_document_id uuid REFERENCES documents(id),
  ADD COLUMN IF NOT EXISTS cemetery_name varchar(160),
  ADD COLUMN IF NOT EXISTS grave_block varchar(80),
  ADD COLUMN IF NOT EXISTS grave_latitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS grave_longitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS grave_condition varchar(30) NOT NULL DEFAULT 'GOOD',
  ADD COLUMN IF NOT EXISTS maintenance_note text,
  ADD COLUMN IF NOT EXISTS prayer_text text,
  ADD COLUMN IF NOT EXISTS audience varchar(30) NOT NULL DEFAULT 'ALL_MEMBERS',
  ADD COLUMN IF NOT EXISTS notification_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS publication_status varchar(30) NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE memorials m SET organization_id=s.organization_id FROM sisters s WHERE s.id=m.sister_id AND m.organization_id IS NULL;
ALTER TABLE memorials ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE memorials DROP CONSTRAINT IF EXISTS memorials_grave_condition_check;
ALTER TABLE memorials ADD CONSTRAINT memorials_grave_condition_check CHECK(grave_condition IN ('GOOD','NEEDS_ATTENTION','UNDER_MAINTENANCE','UNKNOWN'));
ALTER TABLE memorials DROP CONSTRAINT IF EXISTS memorials_publication_status_check;
ALTER TABLE memorials ADD CONSTRAINT memorials_publication_status_check CHECK(publication_status IN ('DRAFT','PUBLISHED_INTERNAL','PUBLISHED_PUBLIC'));
CREATE INDEX IF NOT EXISTS memorials_org_date_idx ON memorials(organization_id,remembrance_date,death_date DESC);

CREATE TABLE IF NOT EXISTS report_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  report_key varchar(80) NOT NULL,
  report_title varchar(200) NOT NULL,
  format varchar(12) NOT NULL CHECK(format IN ('PDF','CSV','XLSX')),
  purpose text NOT NULL,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  classification varchar(30) NOT NULL DEFAULT 'INTERNAL' CHECK(classification IN ('INTERNAL','CONFIDENTIAL','VERY_CONFIDENTIAL')),
  status varchar(30) NOT NULL DEFAULT 'READY' CHECK(status IN ('READY','PENDING_APPROVAL','APPROVED','REJECTED','EXPIRED')),
  watermark varchar(240),
  workflow_case_id uuid REFERENCES workflow_cases(id),
  requested_by uuid NOT NULL REFERENCES users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  downloaded_at timestamptz,
  expires_at timestamptz
);
CREATE INDEX IF NOT EXISTS report_exports_org_idx ON report_exports(organization_id,requested_at DESC);

CREATE TABLE IF NOT EXISTS system_operation_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  check_type varchar(30) NOT NULL CHECK(check_type IN ('BACKUP','RESTORE_TEST','HEALTH_CHECK','MAINTENANCE','KEY_REVIEW')),
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  status varchar(24) NOT NULL CHECK(status IN ('SUCCESS','WARNING','FAILED','IN_PROGRESS')),
  rpo_hours integer,
  rto_hours integer,
  evidence text,
  note text NOT NULL,
  performed_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS system_operation_checks_idx ON system_operation_checks(organization_id,check_type,started_at DESC);

CREATE TABLE IF NOT EXISTS security_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  incident_number varchar(60) NOT NULL UNIQUE,
  occurred_at timestamptz NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  category varchar(60) NOT NULL,
  severity varchar(20) NOT NULL CHECK(severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  title varchar(200) NOT NULL,
  summary text NOT NULL,
  containment text,
  root_cause text,
  follow_up text,
  owner_id uuid REFERENCES users(id),
  status varchar(30) NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','CONTAINED','INVESTIGATING','RESOLVED','CLOSED')),
  reported_by uuid NOT NULL REFERENCES users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_incidents_idx ON security_incidents(organization_id,status,severity,occurred_at DESC);

CREATE TABLE IF NOT EXISTS security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  alert_type varchar(60) NOT NULL,
  severity varchar(20) NOT NULL CHECK(severity IN ('INFO','LOW','MEDIUM','HIGH','CRITICAL')),
  title varchar(200) NOT NULL,
  detail text NOT NULL,
  entity_type varchar(80),
  entity_id text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_by uuid REFERENCES users(id),
  acknowledged_at timestamptz,
  resolution_note text
);
CREATE INDEX IF NOT EXISTS security_alerts_open_idx ON security_alerts(detected_at DESC) WHERE acknowledged_at IS NULL;

CREATE OR REPLACE FUNCTION protect_audit_logs() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit log bersifat append-only dan tidak dapat diubah atau dihapus';
END;
$$;
DROP TRIGGER IF EXISTS audit_logs_append_only ON audit_logs;
CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION protect_audit_logs();

DROP TRIGGER IF EXISTS memorials_updated_at ON memorials;
CREATE TRIGGER memorials_updated_at BEFORE UPDATE ON memorials FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS security_incidents_updated_at ON security_incidents;
CREATE TRIGGER security_incidents_updated_at BEFORE UPDATE ON security_incidents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
