import 'dotenv/config';
import { hash } from 'bcryptjs';
import { Client } from 'pg';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL belum diatur.');
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@simkongregasi.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const encryptionKey = process.env.DATA_ENCRYPTION_KEY ?? process.env.JWT_SECRET;
  if (!adminPassword || adminPassword.length < 12) throw new Error('SEED_ADMIN_PASSWORD minimal 12 karakter.');
  if (!encryptionKey) throw new Error('DATA_ENCRYPTION_KEY belum diatur.');
  const client = new Client({ connectionString });
  await client.connect();
  await client.query('BEGIN');
  try {
    const org = await client.query(`INSERT INTO organizations(code,name,type,abbreviation,city,territory,effective_from,charism,vision,mission)
      VALUES('KONG-001','Kongregasi Santa Maria','CONGREGATION','KSM','Jakarta','Indonesia','1952-08-15','Menghadirkan kasih yang memulihkan','Menjadi komunitas religius yang hadir bagi kehidupan','Melayani melalui pendidikan, kesehatan, dan pendampingan sosial')
      ON CONFLICT(code) DO UPDATE SET name=excluded.name,type=excluded.type,abbreviation=excluded.abbreviation,territory=excluded.territory,
        effective_from=excluded.effective_from,charism=excluded.charism,vision=excluded.vision,mission=excluded.mission RETURNING id`);
    const orgId = org.rows[0].id;
    const passwordHash = await hash(adminPassword, 12);
    const admin = await client.query(`INSERT INTO users(organization_id,email,full_name,password_hash,role,must_change_password)
      VALUES($1,$2,'Administrator SIM Kongregasi',$3,'SUPER_ADMIN',true)
      ON CONFLICT(email) DO UPDATE SET organization_id=excluded.organization_id,full_name=excluded.full_name,role='SUPER_ADMIN' RETURNING id`, [orgId, adminEmail, passwordHash]);
    const adminId = admin.rows[0].id;
    await client.query(`UPDATE organization_structure_periods SET parent_id=NULL,effective_from='1952-08-15',reason='Pendirian kongregasi',recorded_by=$2
      WHERE organization_id=$1 AND change_type='ESTABLISHED' AND reason='Riwayat awal hasil migrasi data'`, [orgId,adminId]);
    await client.query(`INSERT INTO organization_structure_periods(organization_id,parent_id,effective_from,change_type,reason,recorded_by)
      SELECT $1,NULL,'1952-08-15','ESTABLISHED','Pendirian kongregasi',$2 WHERE NOT EXISTS (
        SELECT 1 FROM organization_structure_periods WHERE organization_id=$1
      )`, [orgId,adminId]);

    const units = [
      ['PROV-JAWA','Provinsi Jawa','PROVINCE','Jawa',orgId,'1968-01-01'],
      ['REG-TIMUR','Regio Indonesia Timur','REGION','Indonesia Timur',orgId,'1995-07-01'],
      ['KOM-JKT-01','Komunitas Maria Bunda','COMMUNITY','Jakarta',null,'1984-06-12'],
      ['KARYA-SMA-01','SMA Santa Maria','APOSTOLATE','Jakarta',null,'1990-07-15'],
      ['YYS-SM','Yayasan Santa Maria','LEGAL_ENTITY','Jakarta',orgId,'1988-02-20']
    ] as const;
    let provinceId = '';
    let communityId = '';
    for (const [code,name,type,territory,parentHint,effectiveFrom] of units) {
      const parentId = code==='KOM-JKT-01' ? provinceId : code==='KARYA-SMA-01' ? communityId : parentHint;
      const row = await client.query(`INSERT INTO organizations(code,name,type,territory,parent_id,effective_from,city,address,capacity,diocese,has_oratory)
        VALUES($1,$2,$3::varchar,$4,$5,$6,$4,CASE WHEN $3::varchar='COMMUNITY' THEN 'Jl. Kasih No. 12' ELSE NULL END,CASE WHEN $3::varchar='COMMUNITY' THEN 24 ELSE NULL END,CASE WHEN $3::varchar='COMMUNITY' THEN 'Keuskupan Agung Jakarta' ELSE NULL END,$3::varchar='COMMUNITY')
        ON CONFLICT(code) DO UPDATE SET name=excluded.name,type=excluded.type,territory=excluded.territory,parent_id=excluded.parent_id RETURNING id`, [code,name,type,territory,parentId,effectiveFrom]);
      if (code==='PROV-JAWA') provinceId=row.rows[0].id;
      if (code==='KOM-JKT-01') communityId=row.rows[0].id;
      await client.query(`INSERT INTO organization_structure_periods(organization_id,parent_id,effective_from,change_type,reason,recorded_by)
        SELECT $1,$2,$3,'ESTABLISHED','Data contoh struktur awal',$4 WHERE NOT EXISTS (
          SELECT 1 FROM organization_structure_periods WHERE organization_id=$1 AND effective_from=$3
        )`, [row.rows[0].id,parentId,effectiveFrom,adminId]);
    }

    const sisters = [
      ['K-0001','Sr. Maria Anugerah','Maria Anugerah','1978-05-12','ACTIVE'],
      ['K-0002','Sr. Theresia Damai','Theresia Damai','1985-09-21','ACTIVE'],
      ['K-0003','Sr. Clara Kasih','Clara Kasih','1999-01-17','IN_FORMATION']
    ];
    for (const [number,religious,legal,birth,status] of sisters) {
      const verificationStatus=number==='K-0001'?'VERIFIED':'NEEDS_CORRECTION';
      const sister = await client.query(`INSERT INTO sisters(organization_id,member_number,religious_name,legal_name,birth_date,join_date,status,phone,email,address,verification_status,verified_by,verified_at)
        VALUES($1,$2,$3::varchar,$4,$5,'2010-07-01',$6::member_status,'081200000001',trim(both '.' from regexp_replace(lower($3::text),'[^a-z0-9]+','.','g'))||'@example.local','Jl. Pelayanan No. 1',$8::varchar,CASE WHEN $8::varchar='VERIFIED' THEN $7::uuid ELSE NULL::uuid END,CASE WHEN $8::varchar='VERIFIED' THEN now() ELSE NULL END)
        ON CONFLICT(member_number) DO UPDATE SET religious_name=excluded.religious_name,legal_name=excluded.legal_name,phone=excluded.phone,email=excluded.email,address=excluded.address,verification_status=excluded.verification_status,verified_by=excluded.verified_by,verified_at=excluded.verified_at RETURNING id`, [orgId,number,religious,legal,birth,status,adminId,verificationStatus]);
      const sisterId=sister.rows[0].id;
      const canonical=status==='IN_FORMATION'?'TEMPORARY_VOWS':status==='EXCLAUSTRATED'?'EXCLAUSTRATED':status==='LEFT'?'LEFT':'PERPETUAL_VOWS';
      const dimensions=[['LIFE',status==='DECEASED'?'DECEASED':'LIVING',null],['CANONICAL',canonical,null],['MINISTRY',status==='ACTIVE'?'ACTIVE':'NOT_ACTIVE',null],['RESIDENCE','RESIDENT',orgId]];
      for(const [dimension,code,residenceOrg] of dimensions) await client.query(`INSERT INTO sister_status_periods(sister_id,dimension,status_code,organization_id,effective_from,reason_code,reason_detail,recorded_by,verified_by,verified_at)
        SELECT $1,$2::varchar,$3::varchar,$4,'2010-07-01','INITIAL_REGISTRATION','Data contoh awal',$5,$5,now() WHERE NOT EXISTS(SELECT 1 FROM sister_status_periods WHERE sister_id=$1 AND dimension=$2::varchar)`,[sisterId,dimension,code,residenceOrg,adminId]);
    }
    const first = await client.query(`SELECT id FROM sisters WHERE member_number='K-0001'`);
    await client.query(`INSERT INTO sister_family_members(sister_id,relationship,full_name,phone,is_alive,is_emergency_contact,created_by)
      SELECT $1,'Saudara','Theresia Anugerah','081299900001',true,true,$2 WHERE NOT EXISTS(SELECT 1 FROM sister_family_members WHERE sister_id=$1)`,[first.rows[0].id,adminId]);
    await client.query(`INSERT INTO sister_sacramental_records(sister_id,sacrament_type,sacrament_date,parish,diocese,certificate_number,created_by)
      SELECT $1,'BAPTISM','1978-06-18','Paroki Santa Maria','Keuskupan Agung Jakarta','BAPTIS/1978/112',$2 WHERE NOT EXISTS(SELECT 1 FROM sister_sacramental_records WHERE sister_id=$1)`,[first.rows[0].id,adminId]);
    await client.query(`INSERT INTO sister_vow_records(sister_id,vow_stage,start_date,place,witness,decree_number,created_by)
      SELECT $1,'PERPETUAL','2006-08-15','Jakarta','Pemimpin Provinsi','KAUL/2006/018',$2 WHERE NOT EXISTS(SELECT 1 FROM sister_vow_records WHERE sister_id=$1)`,[first.rows[0].id,adminId]);
    await client.query(`INSERT INTO sister_education_records(sister_id,level,field_of_study,institution,start_year,graduation_year,certificate_number,created_by)
      SELECT $1,'S1','Pendidikan','Universitas Katolik',1997,2001,'IJZ/2001/778',$2 WHERE NOT EXISTS(SELECT 1 FROM sister_education_records WHERE sister_id=$1)`,[first.rows[0].id,adminId]);
    await client.query(`INSERT INTO sister_skills(sister_id,skill_type,name,proficiency,issuer,issued_date,created_by)
      SELECT $1,'LANGUAGE','Bahasa Inggris','Mahir','Lembaga Bahasa','2024-02-10',$2 WHERE NOT EXISTS(SELECT 1 FROM sister_skills WHERE sister_id=$1)`,[first.rows[0].id,adminId]);
    await client.query(`INSERT INTO sister_legal_documents(sister_id,document_type,identifier_encrypted,identifier_last4,issued_by,issued_date,expires_date,created_by)
      SELECT $1,'BPJS',pgp_sym_encrypt('0001234567890',$2),'7890','BPJS Kesehatan','2020-01-01',NULL,$3 WHERE NOT EXISTS(SELECT 1 FROM sister_legal_documents WHERE sister_id=$1 AND document_type='BPJS')`,[first.rows[0].id,encryptionKey,adminId]);
    await client.query(`INSERT INTO assignments(sister_id,organization_id,title,location,start_date,notes)
      SELECT $1,$2,'Pimpinan Komunitas','Jakarta','2025-01-01','Data contoh untuk orientasi pengguna'
      WHERE NOT EXISTS(SELECT 1 FROM assignments WHERE sister_id=$1 AND title='Pimpinan Komunitas')`, [first.rows[0].id,orgId]);

    const leaderPosition = await client.query(`INSERT INTO organization_positions(organization_id,code,title,category,authority_scope,sort_order)
      VALUES($1,'SUP-GEN','Pemimpin Umum','LEADERSHIP','Tata kelola kongregasi sesuai konstitusi',1)
      ON CONFLICT(organization_id,code) DO UPDATE SET title=excluded.title RETURNING id`, [orgId]);
    await client.query(`INSERT INTO organization_office_terms(position_id,sister_id,start_date,end_date,decree_number,appointment_basis,created_by)
      SELECT $1,$2,'2024-01-01','2029-12-31','SK/KSM/001/2024','Keputusan Kapitel Umum',$3
      WHERE NOT EXISTS(SELECT 1 FROM organization_office_terms WHERE position_id=$1 AND start_date='2024-01-01')`, [leaderPosition.rows[0].id,first.rows[0].id,adminId]);

    await client.query(`INSERT INTO governance_meetings(organization_id,meeting_type,title,meeting_date,location,participants,quorum_required,quorum_present,status,notes,created_by)
      SELECT $1,'DEWAN','Rapat Dewan Bulanan','2026-08-01 09:00+07','Ruang Dewan','Pemimpin Umum dan anggota dewan',4,4,'COMPLETED','Evaluasi pelayanan semester pertama',$2
      WHERE NOT EXISTS(SELECT 1 FROM governance_meetings WHERE organization_id=$1 AND title='Rapat Dewan Bulanan' AND meeting_date='2026-08-01 09:00+07')`, [orgId,adminId]);
    await client.query(`INSERT INTO organization_visitations(organization_id,visitation_type,start_date,end_date,visitor_sister_id,agenda,recommendations,follow_up_due,status,created_by)
      SELECT $1,'Visitasi Kanonik','2026-09-14','2026-09-16',$2,'Tata hidup komunitas, karya, dan administrasi','Tindak lanjut disepakati bersama komunitas','2026-10-15','PLANNED',$3
      WHERE NOT EXISTS(SELECT 1 FROM organization_visitations WHERE organization_id=$1 AND start_date='2026-09-14')`, [communityId,first.rows[0].id,adminId]);

    const accounts = [['1001','Kas','ASSET'],['2001','Utang','LIABILITY'],['3001','Dana Bersih','EQUITY'],['4001','Donasi','REVENUE'],['5001','Kesehatan','EXPENSE']];
    for (const [code,name,type] of accounts) await client.query(`INSERT INTO finance_accounts(organization_id,code,name,type) VALUES($1,$2,$3,$4::account_type) ON CONFLICT(organization_id,code) DO NOTHING`,[orgId,code,name,type]);
    await client.query(`INSERT INTO chronicles(organization_id,event_date,title,content,location,tags,created_by)
      SELECT $1,current_date,'SIM Kongregasi mulai digunakan','Penerapan awal sistem informasi manajemen kongregasi.','Jakarta',ARRAY['sistem','administrasi'],$2
      WHERE NOT EXISTS(SELECT 1 FROM chronicles WHERE organization_id=$1 AND title='SIM Kongregasi mulai digunakan')`,[orgId,adminId]);
    await client.query('COMMIT');
    console.log(`Seed selesai. Akun admin: ${adminEmail}`);
  } catch (error) {
    await client.query('ROLLBACK'); throw error;
  } finally { await client.end(); }
}

main().catch((error)=>{console.error(error);process.exit(1);});
