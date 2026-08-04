BEGIN;

ALTER TABLE users ADD COLUMN sister_id uuid REFERENCES sisters(id);
CREATE UNIQUE INDEX users_sister_unique_idx ON users(sister_id) WHERE sister_id IS NOT NULL;

ALTER TABLE sisters
  ADD COLUMN address text,
  ADD COLUMN postal_code varchar(20),
  ADD COLUMN communication_preference varchar(30) NOT NULL DEFAULT 'WHATSAPP'
    CHECK (communication_preference IN ('WHATSAPP','EMAIL','PHONE','LETTER','IN_PERSON')),
  ADD COLUMN verification_status varchar(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (verification_status IN ('DRAFT','PENDING_VERIFICATION','VERIFIED','NEEDS_CORRECTION')),
  ADD COLUMN verification_note text,
  ADD COLUMN verified_by uuid REFERENCES users(id),
  ADD COLUMN verified_at timestamptz;

CREATE TABLE sister_family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sister_id uuid NOT NULL REFERENCES sisters(id) ON DELETE CASCADE,
  relationship varchar(60) NOT NULL,
  full_name varchar(160) NOT NULL,
  phone varchar(40),
  email varchar(160),
  address text,
  is_alive boolean,
  is_emergency_contact boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sister_family_members_sister_idx ON sister_family_members(sister_id);

CREATE TABLE sister_sacramental_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sister_id uuid NOT NULL REFERENCES sisters(id) ON DELETE CASCADE,
  sacrament_type varchar(30) NOT NULL CHECK (sacrament_type IN ('BAPTISM','CONFIRMATION')),
  sacrament_date date,
  parish varchar(160),
  diocese varchar(160),
  certificate_number varchar(100),
  document_id uuid REFERENCES documents(id),
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sister_sacramental_records_sister_idx ON sister_sacramental_records(sister_id);

CREATE TABLE sister_vow_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sister_id uuid NOT NULL REFERENCES sisters(id) ON DELETE CASCADE,
  vow_stage varchar(40) NOT NULL CHECK (vow_stage IN ('FIRST','TEMPORARY_RENEWAL','PERPETUAL','OTHER')),
  start_date date NOT NULL,
  end_date date,
  place varchar(160),
  witness varchar(160),
  decree_number varchar(100),
  document_id uuid REFERENCES documents(id),
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX sister_vow_records_sister_idx ON sister_vow_records(sister_id,start_date DESC);

CREATE TABLE sister_education_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sister_id uuid NOT NULL REFERENCES sisters(id) ON DELETE CASCADE,
  level varchar(80) NOT NULL,
  field_of_study varchar(160),
  institution varchar(200) NOT NULL,
  start_year integer,
  graduation_year integer,
  certificate_number varchar(100),
  document_id uuid REFERENCES documents(id),
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (start_year IS NULL OR start_year BETWEEN 1900 AND 2200),
  CHECK (graduation_year IS NULL OR graduation_year BETWEEN 1900 AND 2200),
  CHECK (graduation_year IS NULL OR start_year IS NULL OR graduation_year >= start_year)
);
CREATE INDEX sister_education_records_sister_idx ON sister_education_records(sister_id,graduation_year DESC);

CREATE TABLE sister_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sister_id uuid NOT NULL REFERENCES sisters(id) ON DELETE CASCADE,
  skill_type varchar(30) NOT NULL CHECK (skill_type IN ('COMPETENCY','LANGUAGE','CERTIFICATION')),
  name varchar(160) NOT NULL,
  proficiency varchar(60),
  issuer varchar(160),
  issued_date date,
  expires_date date,
  document_id uuid REFERENCES documents(id),
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_date IS NULL OR issued_date IS NULL OR expires_date >= issued_date)
);
CREATE INDEX sister_skills_sister_idx ON sister_skills(sister_id,skill_type);

CREATE TABLE sister_legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sister_id uuid NOT NULL REFERENCES sisters(id) ON DELETE CASCADE,
  document_type varchar(30) NOT NULL CHECK (document_type IN ('NIK','PASSPORT','VISA','BPJS','DIPLOMA','OTHER')),
  identifier_encrypted bytea,
  identifier_last4 varchar(4),
  issued_by varchar(160),
  issued_date date,
  expires_date date,
  document_id uuid REFERENCES documents(id),
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_date IS NULL OR issued_date IS NULL OR expires_date >= issued_date)
);
CREATE INDEX sister_legal_documents_sister_idx ON sister_legal_documents(sister_id,document_type);

CREATE TABLE sister_status_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sister_id uuid NOT NULL REFERENCES sisters(id) ON DELETE CASCADE,
  dimension varchar(20) NOT NULL CHECK (dimension IN ('LIFE','CANONICAL','MINISTRY','RESIDENCE')),
  status_code varchar(50) NOT NULL,
  organization_id uuid REFERENCES organizations(id),
  effective_from date NOT NULL,
  effective_to date,
  reason_code varchar(60) NOT NULL,
  reason_detail text,
  authority_name varchar(160),
  decree_number varchar(100),
  document_id uuid REFERENCES documents(id),
  recorded_by uuid NOT NULL REFERENCES users(id),
  verified_by uuid REFERENCES users(id),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CHECK (dimension <> 'RESIDENCE' OR organization_id IS NOT NULL)
);
CREATE INDEX sister_status_periods_timeline_idx ON sister_status_periods(sister_id,dimension,effective_from DESC);

CREATE TABLE sister_profile_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sister_id uuid NOT NULL REFERENCES sisters(id) ON DELETE CASCADE,
  status varchar(30) NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED','CORRECTION_REQUESTED')),
  submitted_by uuid NOT NULL REFERENCES users(id),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  note text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX sister_profile_reviews_sister_idx ON sister_profile_reviews(sister_id,submitted_at DESC);

INSERT INTO sister_status_periods(sister_id,dimension,status_code,organization_id,effective_from,reason_code,reason_detail,recorded_by,verified_by,verified_at)
SELECT s.id,'LIFE',CASE WHEN s.status='DECEASED' THEN 'DECEASED' ELSE 'LIVING' END,NULL,
  COALESCE(s.join_date,s.created_at::date),'INITIAL_MIGRATION','Migrasi dari status anggota lama',u.id,u.id,now()
FROM sisters s JOIN LATERAL (SELECT id FROM users ORDER BY created_at LIMIT 1) u ON true;

INSERT INTO sister_status_periods(sister_id,dimension,status_code,organization_id,effective_from,reason_code,reason_detail,recorded_by,verified_by,verified_at)
SELECT s.id,'CANONICAL',CASE s.status WHEN 'IN_FORMATION' THEN 'IN_FORMATION' WHEN 'EXCLAUSTRATED' THEN 'EXCLAUSTRATED' WHEN 'LEFT' THEN 'LEFT' ELSE 'PERPETUAL_VOWS' END,NULL,
  COALESCE(s.join_date,s.created_at::date),'INITIAL_MIGRATION','Migrasi dari status anggota lama',u.id,u.id,now()
FROM sisters s JOIN LATERAL (SELECT id FROM users ORDER BY created_at LIMIT 1) u ON true
WHERE s.status <> 'DECEASED';

INSERT INTO sister_status_periods(sister_id,dimension,status_code,organization_id,effective_from,reason_code,reason_detail,recorded_by,verified_by,verified_at)
SELECT s.id,'MINISTRY',CASE WHEN s.status='ACTIVE' THEN 'ACTIVE' ELSE 'NOT_ACTIVE' END,NULL,
  COALESCE(s.join_date,s.created_at::date),'INITIAL_MIGRATION','Migrasi dari status anggota lama',u.id,u.id,now()
FROM sisters s JOIN LATERAL (SELECT id FROM users ORDER BY created_at LIMIT 1) u ON true
WHERE s.status NOT IN ('DECEASED','LEFT');

INSERT INTO sister_status_periods(sister_id,dimension,status_code,organization_id,effective_from,reason_code,reason_detail,recorded_by,verified_by,verified_at)
SELECT s.id,'RESIDENCE','RESIDENT',s.organization_id,COALESCE(s.join_date,s.created_at::date),'INITIAL_MIGRATION','Migrasi komunitas aktif',u.id,u.id,now()
FROM sisters s JOIN LATERAL (SELECT id FROM users ORDER BY created_at LIMIT 1) u ON true;

CREATE TRIGGER sister_family_members_updated_at BEFORE UPDATE ON sister_family_members FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER sister_sacramental_records_updated_at BEFORE UPDATE ON sister_sacramental_records FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER sister_vow_records_updated_at BEFORE UPDATE ON sister_vow_records FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER sister_education_records_updated_at BEFORE UPDATE ON sister_education_records FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER sister_skills_updated_at BEFORE UPDATE ON sister_skills FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER sister_legal_documents_updated_at BEFORE UPDATE ON sister_legal_documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
