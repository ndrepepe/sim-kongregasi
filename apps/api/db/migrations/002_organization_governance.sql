BEGIN;

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_type_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_type_check CHECK (type IN (
  'CONGREGATION', 'GENERALATE', 'PROVINCE', 'REGION', 'DELEGATION',
  'COMMUNITY', 'APOSTOLATE', 'WORK_UNIT', 'LEGAL_ENTITY'
));

ALTER TABLE organizations
  ADD COLUMN abbreviation varchar(40),
  ADD COLUMN territory varchar(160),
  ADD COLUMN effective_from date,
  ADD COLUMN effective_to date,
  ADD COLUMN charism text,
  ADD COLUMN history text,
  ADD COLUMN vision text,
  ADD COLUMN mission text,
  ADD COLUMN constitution_summary text,
  ADD COLUMN capacity integer,
  ADD COLUMN diocese varchar(160),
  ADD COLUMN has_oratory boolean NOT NULL DEFAULT false,
  ADD COLUMN notes text;

UPDATE organizations SET effective_from = created_at::date WHERE effective_from IS NULL;
ALTER TABLE organizations ALTER COLUMN effective_from SET NOT NULL;
ALTER TABLE organizations ADD CONSTRAINT organizations_effective_dates_check
  CHECK (effective_to IS NULL OR effective_to >= effective_from);
ALTER TABLE organizations ADD CONSTRAINT organizations_capacity_check
  CHECK (capacity IS NULL OR capacity >= 0);

CREATE TABLE organization_structure_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  parent_id uuid REFERENCES organizations(id),
  effective_from date NOT NULL,
  effective_to date,
  change_type varchar(30) NOT NULL DEFAULT 'ESTABLISHED' CHECK (change_type IN ('ESTABLISHED','REORGANIZED','RENAMED','CLOSED','REOPENED')),
  decree_number varchar(100),
  reason text,
  recorded_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (organization_id <> parent_id),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE INDEX organization_structure_periods_lookup_idx
  ON organization_structure_periods(organization_id, effective_from DESC, effective_to);

INSERT INTO organization_structure_periods(organization_id,parent_id,effective_from,change_type,reason)
SELECT id,parent_id,effective_from,'ESTABLISHED','Riwayat awal hasil migrasi data'
FROM organizations;

CREATE TABLE organization_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  code varchar(50) NOT NULL,
  title varchar(160) NOT NULL,
  category varchar(30) NOT NULL CHECK (category IN ('LEADERSHIP','COUNCIL','SECRETARIAT','FINANCE','LOCAL','OTHER')),
  authority_scope text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, code)
);

CREATE TABLE organization_office_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES organization_positions(id),
  sister_id uuid NOT NULL REFERENCES sisters(id),
  start_date date NOT NULL,
  end_date date,
  decree_number varchar(100),
  appointment_basis text,
  is_acting boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX organization_office_terms_period_idx
  ON organization_office_terms(position_id, start_date DESC, end_date);

CREATE TABLE governance_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  meeting_type varchar(50) NOT NULL,
  title varchar(200) NOT NULL,
  meeting_date timestamptz NOT NULL,
  location varchar(160),
  participants text,
  quorum_required integer,
  quorum_present integer,
  confidentiality varchar(20) NOT NULL DEFAULT 'INTERNAL' CHECK (confidentiality IN ('INTERNAL','RESTRICTED','CONFIDENTIAL')),
  status varchar(20) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','COMPLETED','CANCELLED')),
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (quorum_required IS NULL OR quorum_required >= 0),
  CHECK (quorum_present IS NULL OR quorum_present >= 0)
);

CREATE TABLE governance_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES governance_meetings(id) ON DELETE CASCADE,
  decision_number varchar(100),
  subject varchar(200) NOT NULL,
  decision_text text NOT NULL,
  effective_date date,
  follow_up text,
  due_date date,
  status varchar(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','DONE','CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organization_visitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  visitation_type varchar(80) NOT NULL,
  start_date date NOT NULL,
  end_date date,
  visitor_sister_id uuid REFERENCES sisters(id),
  visitor_name varchar(160),
  agenda text,
  findings text,
  recommendations text,
  follow_up_due date,
  status varchar(20) NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED','IN_PROGRESS','COMPLETED','FOLLOW_UP_CLOSED','CANCELLED')),
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date),
  CHECK (visitor_sister_id IS NOT NULL OR visitor_name IS NOT NULL)
);

CREATE TRIGGER organization_positions_updated_at BEFORE UPDATE ON organization_positions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER organization_office_terms_updated_at BEFORE UPDATE ON organization_office_terms FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER governance_meetings_updated_at BEFORE UPDATE ON governance_meetings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER organization_visitations_updated_at BEFORE UPDATE ON organization_visitations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
