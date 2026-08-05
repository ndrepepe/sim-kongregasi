BEGIN;

ALTER TABLE health_profiles
  ADD COLUMN IF NOT EXISTS rhesus varchar(8),
  ADD COLUMN IF NOT EXISTS diet text,
  ADD COLUMN IF NOT EXISTS doctor_contact text,
  ADD COLUMN IF NOT EXISTS emergency_contact text,
  ADD COLUMN IF NOT EXISTS care_level varchar(20) NOT NULL DEFAULT 'INDEPENDENT'
    CHECK (care_level IN ('INDEPENDENT','ASSISTED','INTENSIVE'));

ALTER TABLE medications
  ADD COLUMN IF NOT EXISTS instructions text,
  ADD COLUMN IF NOT EXISTS stock_quantity integer CHECK (stock_quantity IS NULL OR stock_quantity >= 0),
  ADD COLUMN IF NOT EXISTS expires_date date,
  ADD COLUMN IF NOT EXISTS prescribed_by varchar(160),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id);

CREATE TABLE medication_administrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id uuid NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  sister_id uuid NOT NULL REFERENCES sisters(id),
  scheduled_at timestamptz NOT NULL,
  status varchar(20) NOT NULL CHECK (status IN ('SCHEDULED','GIVEN','MISSED','REFUSED','HELD')),
  administered_at timestamptz,
  administered_by uuid REFERENCES users(id),
  reason text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX medication_administrations_schedule_idx ON medication_administrations(sister_id,scheduled_at DESC);

CREATE TABLE health_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sister_id uuid NOT NULL REFERENCES sisters(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  scheduled_at timestamptz NOT NULL,
  appointment_type varchar(80) NOT NULL,
  facility varchar(160) NOT NULL,
  doctor varchar(160),
  transport text,
  companion_sister_id uuid REFERENCES sisters(id),
  status varchar(20) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','COMPLETED','CANCELLED','MISSED')),
  result_summary text,
  follow_up text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX health_appointments_schedule_idx ON health_appointments(organization_id,scheduled_at);

CREATE TABLE health_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sister_id uuid NOT NULL REFERENCES sisters(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  incident_at timestamptz NOT NULL,
  incident_type varchar(80) NOT NULL,
  location varchar(160),
  initial_action text NOT NULL,
  notification text,
  follow_up text,
  severity varchar(20) NOT NULL DEFAULT 'LOW' CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  status varchar(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','MONITORING','CLOSED')),
  reported_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX health_incidents_org_status_idx ON health_incidents(organization_id,status,incident_at DESC);

CREATE TABLE health_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  sister_id uuid REFERENCES sisters(id),
  shift_date date NOT NULL,
  shift varchar(30) NOT NULL,
  important_condition text NOT NULL,
  open_tasks text,
  handed_over_by uuid NOT NULL REFERENCES users(id),
  received_by uuid REFERENCES users(id),
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX health_handovers_shift_idx ON health_handovers(organization_id,shift_date DESC);

ALTER TYPE claim_stage ADD VALUE IF NOT EXISTS 'INTERNAL_VERIFICATION';
ALTER TYPE claim_stage ADD VALUE IF NOT EXISTS 'RECEIVED';
ALTER TYPE claim_stage ADD VALUE IF NOT EXISTS 'CLARIFICATION';
ALTER TYPE claim_stage ADD VALUE IF NOT EXISTS 'ASSESSED';
ALTER TYPE claim_stage ADD VALUE IF NOT EXISTS 'APPEAL';
ALTER TYPE claim_stage ADD VALUE IF NOT EXISTS 'RECONCILIATION';

ALTER TABLE insurance_guides
  ADD COLUMN IF NOT EXISTS claim_type varchar(120),
  ADD COLUMN IF NOT EXISTS expires_date date,
  ADD COLUMN IF NOT EXISTS requirements text,
  ADD COLUMN IF NOT EXISTS contact_info text,
  ADD COLUMN IF NOT EXISTS submission_deadline_days integer CHECK (submission_deadline_days IS NULL OR submission_deadline_days > 0),
  ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT','ACTIVE','EXPIRED','RETIRED'));

ALTER TABLE insurance_claims
  ADD COLUMN IF NOT EXISTS guide_id uuid REFERENCES insurance_guides(id),
  ADD COLUMN IF NOT EXISTS facility varchar(160),
  ADD COLUMN IF NOT EXISTS service_date date,
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS amount_rejected numeric(18,2) NOT NULL DEFAULT 0 CHECK (amount_rejected >= 0),
  ADD COLUMN IF NOT EXISTS amount_paid numeric(18,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  ADD COLUMN IF NOT EXISTS congregation_share numeric(18,2) NOT NULL DEFAULT 0 CHECK (congregation_share >= 0),
  ADD COLUMN IF NOT EXISTS next_action text,
  ADD COLUMN IF NOT EXISTS payment_date date,
  ADD COLUMN IF NOT EXISTS payment_account_masked varchar(80),
  ADD COLUMN IF NOT EXISTS bank_reference varchar(120),
  ADD COLUMN IF NOT EXISTS journal_entry_id uuid REFERENCES journal_entries(id),
  ADD COLUMN IF NOT EXISTS reconciliation_difference numeric(18,2),
  ADD COLUMN IF NOT EXISTS reconciliation_status varchar(20) NOT NULL DEFAULT 'PENDING'
    CHECK (reconciliation_status IN ('PENDING','MATCHED','DIFFERENCE_RESOLVED'));

ALTER TABLE formation_records
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS planned_end_date date,
  ADD COLUMN IF NOT EXISTS actual_end_date date,
  ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PLANNED','ACTIVE','COMPLETED','EXTENDED','STOPPED')),
  ADD COLUMN IF NOT EXISTS change_reason text,
  ADD COLUMN IF NOT EXISTS responsible_user_id uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id);
UPDATE formation_records fr SET organization_id=s.organization_id FROM sisters s WHERE fr.sister_id=s.id AND fr.organization_id IS NULL;

CREATE TABLE formation_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_record_id uuid NOT NULL REFERENCES formation_records(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  objectives text NOT NULL,
  programs text NOT NULL,
  required_activities text,
  responsible_user_id uuid REFERENCES users(id),
  status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT','ACTIVE','COMPLETED','CANCELLED')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);

CREATE TABLE formation_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_record_id uuid NOT NULL REFERENCES formation_records(id) ON DELETE CASCADE,
  period_label varchar(100) NOT NULL,
  criteria text NOT NULL,
  factual_summary text NOT NULL,
  recommendation text NOT NULL,
  decision varchar(30) CHECK (decision IN ('CONTINUE','EXTEND','ADVANCE','TRANSFER','STOP')),
  evaluator_id uuid NOT NULL REFERENCES users(id),
  evaluated_at date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE formation_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_record_id uuid NOT NULL REFERENCES formation_records(id) ON DELETE CASCADE,
  activity_type varchar(50) NOT NULL CHECK (activity_type IN ('COURSE','RETREAT','MINISTRY','WORKSHOP','OTHER')),
  title varchar(200) NOT NULL,
  start_date date NOT NULL,
  end_date date,
  facilitator varchar(160),
  administrative_result text,
  status varchar(20) NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED','COMPLETED','CANCELLED')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE formation_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_record_id uuid NOT NULL REFERENCES formation_records(id) ON DELETE CASCADE,
  decision varchar(30) NOT NULL CHECK (decision IN ('CONTINUE','EXTEND','ADVANCE','TRANSFER','STOP')),
  from_stage varchar(80) NOT NULL,
  to_stage varchar(80),
  decision_date date NOT NULL,
  authority_name varchar(160) NOT NULL,
  document_number varchar(100),
  reason text NOT NULL,
  decided_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE work_unit_profiles (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  legal_entity_organization_id uuid REFERENCES organizations(id),
  service_field varchar(100) NOT NULL,
  target_population text,
  operational_description text,
  annual_target integer CHECK (annual_target IS NULL OR annual_target >= 0),
  capacity integer CHECK (capacity IS NULL OR capacity >= 0),
  accreditation varchar(80),
  license_number varchar(100),
  license_issuer varchar(160),
  license_valid_to date,
  contact_person varchar(160),
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE work_unit_needs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  title varchar(160) NOT NULL,
  role_category varchar(32) NOT NULL CHECK (role_category IN ('LEADERSHIP','EDUCATION','PASTORAL','HEALTH','ADMINISTRATION','FORMATION','SOCIAL','OTHER')),
  required_competencies text[] NOT NULL DEFAULT '{}',
  needed_from date NOT NULL,
  priority varchar(20) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW','MEDIUM','HIGH','URGENT')),
  workload_percent integer NOT NULL DEFAULT 100 CHECK (workload_percent BETWEEN 1 AND 100),
  status varchar(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','MATCHING','PROPOSED','FILLED','CANCELLED')),
  filled_by_assignment_id uuid REFERENCES assignments(id),
  notes text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX work_unit_needs_org_status_idx ON work_unit_needs(organization_id,status,needed_from);

CREATE TRIGGER health_appointments_updated_at BEFORE UPDATE ON health_appointments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER work_unit_needs_updated_at BEFORE UPDATE ON work_unit_needs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
