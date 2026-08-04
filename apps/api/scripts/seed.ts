import 'dotenv/config';
import { hash } from 'bcryptjs';
import { Client } from 'pg';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL belum diatur.');
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@simkongregasi.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 12) throw new Error('SEED_ADMIN_PASSWORD minimal 12 karakter.');
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
      await client.query(`INSERT INTO sisters(organization_id,member_number,religious_name,legal_name,birth_date,join_date,status)
        VALUES($1,$2,$3,$4,$5,'2010-07-01',$6::member_status) ON CONFLICT(member_number) DO NOTHING`, [orgId,number,religious,legal,birth,status]);
    }
    const first = await client.query(`SELECT id FROM sisters WHERE member_number='K-0001'`);
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
