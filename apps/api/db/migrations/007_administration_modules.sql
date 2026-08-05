BEGIN;

CREATE TABLE fiscal_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name varchar(80) NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','REVIEW','LOCKED')),
  locked_by uuid REFERENCES users(id),
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,start_date,end_date),
  CHECK(end_date>=start_date)
);

CREATE TABLE finance_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name varchar(120) NOT NULL,
  bank_name varchar(120) NOT NULL,
  account_number_masked varchar(80) NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'IDR',
  ledger_account_id uuid NOT NULL REFERENCES finance_accounts(id),
  opening_balance numeric(18,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE finance_bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id uuid NOT NULL REFERENCES finance_bank_accounts(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  transaction_date date NOT NULL,
  description text NOT NULL,
  reference varchar(120),
  debit numeric(18,2) NOT NULL DEFAULT 0 CHECK(debit>=0),
  credit numeric(18,2) NOT NULL DEFAULT 0 CHECK(credit>=0),
  journal_entry_id uuid REFERENCES journal_entries(id),
  reconciliation_status varchar(20) NOT NULL DEFAULT 'UNMATCHED' CHECK(reconciliation_status IN ('UNMATCHED','MATCHED','DIFFERENCE')),
  reconciled_by uuid REFERENCES users(id),
  reconciled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK((debit>0 AND credit=0) OR (credit>0 AND debit=0))
);

CREATE TABLE budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  fiscal_period_id uuid NOT NULL REFERENCES fiscal_periods(id),
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  title varchar(180) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','REVISED','LOCKED')),
  total_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK(total_amount>=0),
  notes text,
  workflow_case_id uuid REFERENCES workflow_cases(id),
  created_by uuid NOT NULL REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,fiscal_period_id,version)
);

CREATE TABLE budget_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES finance_accounts(id),
  period_label varchar(40),
  amount numeric(18,2) NOT NULL CHECK(amount>=0),
  description text
);

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS fiscal_period_id uuid REFERENCES fiscal_periods(id),
  ADD COLUMN IF NOT EXISTS currency varchar(3) NOT NULL DEFAULT 'IDR',
  ADD COLUMN IF NOT EXISTS reference_type varchar(40),
  ADD COLUMN IF NOT EXISTS reference_id uuid,
  ADD COLUMN IF NOT EXISTS evidence_document_id uuid REFERENCES documents(id),
  ADD COLUMN IF NOT EXISTS workflow_case_id uuid REFERENCES workflow_cases(id),
  ADD COLUMN IF NOT EXISTS reversal_of uuid REFERENCES journal_entries(id),
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS verification_note text,
  ADD COLUMN IF NOT EXISTS bank_transaction_id uuid REFERENCES finance_bank_transactions(id);

ALTER TABLE journal_lines
  ADD COLUMN IF NOT EXISTS fund_code varchar(60),
  ADD COLUMN IF NOT EXISTS cost_center varchar(80);

CREATE TABLE archive_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  code varchar(40) NOT NULL,
  name varchar(140) NOT NULL,
  function_name varchar(120) NOT NULL,
  access_level document_visibility NOT NULL DEFAULT 'RESTRICTED',
  retention_years integer CHECK(retention_years IS NULL OR retention_years>=0),
  final_disposition varchar(20) NOT NULL DEFAULT 'REVIEW' CHECK(final_disposition IN ('REVIEW','DESTROY','PERMANENT')),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(organization_id,code)
);

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS classification_id uuid REFERENCES archive_classifications(id),
  ADD COLUMN IF NOT EXISTS document_number varchar(120),
  ADD COLUMN IF NOT EXISTS document_date date,
  ADD COLUMN IF NOT EXISTS creator_name varchar(160),
  ADD COLUMN IF NOT EXISTS language varchar(10) NOT NULL DEFAULT 'id',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS source_module varchar(40),
  ADD COLUMN IF NOT EXISTS entity_type varchar(40),
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1 CHECK(version_number>0),
  ADD COLUMN IF NOT EXISTS previous_version_id uuid REFERENCES documents(id),
  ADD COLUMN IF NOT EXISTS ocr_status varchar(20) NOT NULL DEFAULT 'NOT_REQUESTED' CHECK(ocr_status IN ('NOT_REQUESTED','PENDING','COMPLETED','FAILED')),
  ADD COLUMN IF NOT EXISTS scan_quality varchar(20) CHECK(scan_quality IN ('GOOD','REVIEW','POOR')),
  ADD COLUMN IF NOT EXISTS retention_due_at date,
  ADD COLUMN IF NOT EXISTS legal_hold boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_final boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;
CREATE INDEX documents_entity_idx ON documents(entity_type,entity_id) WHERE deleted_at IS NULL;
CREATE INDEX documents_retention_idx ON documents(retention_due_at) WHERE deleted_at IS NULL;

CREATE TABLE archive_borrowings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id),
  requested_by uuid NOT NULL REFERENCES users(id),
  reason text NOT NULL,
  access_type varchar(20) NOT NULL DEFAULT 'DIGITAL' CHECK(access_type IN ('DIGITAL','COPY','ORIGINAL')),
  status varchar(20) NOT NULL DEFAULT 'REQUESTED' CHECK(status IN ('REQUESTED','APPROVED','RETURNED','REJECTED','OVERDUE')),
  due_at timestamptz,
  approved_by uuid REFERENCES users(id),
  returned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE archive_retention_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id),
  proposed_disposition varchar(20) NOT NULL CHECK(proposed_disposition IN ('DESTROY','PERMANENT','EXTEND')),
  proposed_until date,
  reason text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'SUBMITTED' CHECK(status IN ('SUBMITTED','APPROVED','REJECTED','COMPLETED')),
  workflow_case_id uuid REFERENCES workflow_cases(id),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE workflow_cases
  ADD COLUMN IF NOT EXISTS priority varchar(20) NOT NULL DEFAULT 'MEDIUM' CHECK(priority IN ('LOW','MEDIUM','HIGH','URGENT')),
  ADD COLUMN IF NOT EXISTS object_type varchar(40),
  ADD COLUMN IF NOT EXISTS object_id uuid,
  ADD COLUMN IF NOT EXISTS amount numeric(18,2),
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS recommendation text,
  ADD COLUMN IF NOT EXISTS decision_note text,
  ADD COLUMN IF NOT EXISTS decided_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_hours integer CHECK(sla_hours IS NULL OR sla_hours>0),
  ADD COLUMN IF NOT EXISTS data_version integer NOT NULL DEFAULT 1;

ALTER TABLE workflow_events
  ADD COLUMN IF NOT EXISTS action varchar(30),
  ADD COLUMN IF NOT EXISTS comment text,
  ADD COLUMN IF NOT EXISTS data_snapshot jsonb;
CREATE INDEX workflow_cases_object_idx ON workflow_cases(object_type,object_id);

CREATE TABLE calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  title varchar(200) NOT NULL,
  event_type varchar(40) NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  location varchar(160),
  description text,
  audience varchar(30) NOT NULL DEFAULT 'ALL_MEMBERS' CHECK(audience IN ('ALL_MEMBERS','LEADERS','ROLE','PRIVATE')),
  audience_role varchar(30),
  source_module varchar(40) NOT NULL DEFAULT 'CALENDAR',
  source_type varchar(40),
  source_id uuid,
  link text,
  status varchar(20) NOT NULL DEFAULT 'SCHEDULED' CHECK(status IN ('DRAFT','SCHEDULED','COMPLETED','CANCELLED')),
  owner_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(ends_at IS NULL OR ends_at>=starts_at)
);
CREATE INDEX calendar_events_org_date_idx ON calendar_events(organization_id,starts_at);

CREATE TABLE calendar_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_event_id uuid REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  remind_at timestamptz NOT NULL,
  channel varchar(20) NOT NULL DEFAULT 'IN_APP' CHECK(channel IN ('IN_APP','EMAIL','WHATSAPP')),
  status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SENT','SNOOZED','CANCELLED')),
  snoozed_until timestamptz,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER budgets_updated_at BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER calendar_events_updated_at BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
