import 'dotenv/config';
import { hash } from 'bcryptjs';
import { Client } from 'pg';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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
      {code:'GEN-JKT',name:'Generalat Jakarta',type:'GENERALATE',territory:'Indonesia',parentCode:'KONG-001',effectiveFrom:'1952-08-15'},
      {code:'PROV-JAWA',name:'Provinsi Jawa',type:'PROVINCE',territory:'Jawa dan Bali',parentCode:'KONG-001',effectiveFrom:'1968-01-01'},
      {code:'REG-TIMUR',name:'Regio Indonesia Timur',type:'REGION',territory:'Nusa Tenggara dan Sulawesi',parentCode:'KONG-001',effectiveFrom:'1995-07-01'},
      {code:'KOM-JKT-01',name:'Komunitas Maria Bunda',type:'COMMUNITY',territory:'Jakarta',parentCode:'PROV-JAWA',effectiveFrom:'1984-06-12'},
      {code:'KOM-YOG-01',name:'Komunitas Santa Clara',type:'COMMUNITY',territory:'Yogyakarta',parentCode:'PROV-JAWA',effectiveFrom:'1991-08-15'},
      {code:'KOM-SBY-01',name:'Komunitas Hati Kudus',type:'COMMUNITY',territory:'Surabaya',parentCode:'PROV-JAWA',effectiveFrom:'2001-01-06'},
      {code:'KOM-FLO-01',name:'Komunitas Bintang Timur',type:'COMMUNITY',territory:'Flores',parentCode:'REG-TIMUR',effectiveFrom:'2004-09-08'},
      {code:'KARYA-SMA-01',name:'SMA Santa Maria',type:'APOSTOLATE',territory:'Jakarta',parentCode:'KOM-JKT-01',effectiveFrom:'1990-07-15'},
      {code:'KARYA-KLINIK-01',name:'Klinik Kasih Sehat',type:'WORK_UNIT',territory:'Surabaya',parentCode:'KOM-SBY-01',effectiveFrom:'2008-03-19'},
      {code:'KARYA-RETRET-01',name:'Rumah Retret Magnificat',type:'APOSTOLATE',territory:'Yogyakarta',parentCode:'KOM-YOG-01',effectiveFrom:'2012-10-07'},
      {code:'KARYA-SOSIAL-01',name:'Pusat Pendampingan Harapan',type:'WORK_UNIT',territory:'Flores',parentCode:'KOM-FLO-01',effectiveFrom:'2015-05-31'},
      {code:'YYS-SM',name:'Yayasan Santa Maria',type:'LEGAL_ENTITY',territory:'Jakarta',parentCode:'KONG-001',effectiveFrom:'1988-02-20'}
    ] as const;
    const unitIds:Record<string,string>={'KONG-001':orgId};
    for (const unit of units) {
      const {code,name,type,territory,effectiveFrom}=unit;
      const parentId = unitIds[unit.parentCode];
      const row = await client.query(`INSERT INTO organizations(code,name,type,territory,parent_id,effective_from,city,address,capacity,diocese,has_oratory)
        VALUES($1,$2,$3::varchar,$4,$5,$6,$4,CASE WHEN $3::varchar='COMMUNITY' THEN 'Jl. Kasih No. 12' ELSE NULL END,CASE WHEN $3::varchar='COMMUNITY' THEN 24 ELSE NULL END,CASE WHEN $3::varchar='COMMUNITY' THEN 'Keuskupan Agung Jakarta' ELSE NULL END,$3::varchar='COMMUNITY')
        ON CONFLICT(code) DO UPDATE SET name=excluded.name,type=excluded.type,territory=excluded.territory,parent_id=excluded.parent_id,city=excluded.city RETURNING id`, [code,name,type,territory,parentId,effectiveFrom]);
      unitIds[code]=row.rows[0].id;
      await client.query(`INSERT INTO organization_structure_periods(organization_id,parent_id,effective_from,change_type,reason,recorded_by)
        SELECT $1,$2,$3,'ESTABLISHED','Data contoh struktur awal',$4 WHERE NOT EXISTS (
          SELECT 1 FROM organization_structure_periods WHERE organization_id=$1 AND effective_from=$3
        )`, [row.rows[0].id,parentId,effectiveFrom,adminId]);
    }

    const sisters = [
      {number:'K-0001',religious:'Sr. Maria Anugerah',legal:'Maria Anugerah',birth:'1978-05-12',status:'ACTIVE',org:'GEN-JKT',join:'1998-07-01',skill:'Kepemimpinan',field:'Teologi'},
      {number:'K-0002',religious:'Sr. Theresia Damai',legal:'Theresia Damai',birth:'1985-09-21',status:'ACTIVE',org:'KOM-JKT-01',join:'2005-07-01',skill:'Manajemen sekolah',field:'Pendidikan'},
      {number:'K-0003',religious:'Sr. Clara Kasih',legal:'Clara Kasih',birth:'1999-01-17',status:'IN_FORMATION',org:'KOM-YOG-01',join:'2019-07-01',skill:'Pendampingan remaja',field:'Psikologi'},
      {number:'K-0004',religious:'Sr. Agnes Setia',legal:'Agnes Setiawati',birth:'1972-02-03',status:'ACTIVE',org:'KOM-SBY-01',join:'1992-07-01',skill:'Keperawatan',field:'Keperawatan'},
      {number:'K-0005',religious:'Sr. Lucia Harapan',legal:'Lucia Hartini',birth:'1981-11-30',status:'ACTIVE',org:'KOM-FLO-01',join:'2001-07-01',skill:'Pemberdayaan masyarakat',field:'Sosiologi'},
      {number:'K-0006',religious:'Sr. Bernadette Sukacita',legal:'Bernadette Lestari',birth:'1976-04-18',status:'ACTIVE',org:'KOM-YOG-01',join:'1996-07-01',skill:'Retret dan spiritualitas',field:'Spiritualitas'},
      {number:'K-0007',religious:'Sr. Monika Tekun',legal:'Monika Rahayu',birth:'1988-07-09',status:'ACTIVE',org:'KOM-JKT-01',join:'2008-07-01',skill:'Akuntansi',field:'Akuntansi'},
      {number:'K-0008',religious:'Sr. Helena Sejahtera',legal:'Helena Pertiwi',birth:'1991-12-14',status:'ACTIVE',org:'KOM-SBY-01',join:'2011-07-01',skill:'Farmasi',field:'Farmasi'},
      {number:'K-0009',religious:'Sr. Yosefa Sahabat',legal:'Yosefa Melati',birth:'1983-03-25',status:'ACTIVE',org:'KOM-FLO-01',join:'2003-07-01',skill:'Pastoral keluarga',field:'Pastoral'},
      {number:'K-0010',religious:'Sr. Felisitas Tangguh',legal:'Felisitas Utami',birth:'1995-08-22',status:'ACTIVE',org:'KOM-JKT-01',join:'2015-07-01',skill:'Teknologi pendidikan',field:'Teknologi Pendidikan'}
    ] as const;
    for (const item of sisters) {
      const {number,religious,legal,birth,status,join}=item;
      const verificationStatus=['K-0001','K-0002','K-0004','K-0005','K-0006','K-0007'].includes(number)?'VERIFIED':number==='K-0003'?'PENDING_VERIFICATION':'NEEDS_CORRECTION';
      const sister = await client.query(`INSERT INTO sisters(organization_id,member_number,religious_name,legal_name,birth_date,join_date,status,phone,email,address,verification_status,verified_by,verified_at)
        VALUES($1,$2::varchar,$3::varchar,$4,$5,$6,$7::member_status,'0812'||right('0000000000'||replace($2::text,'K-',''),10),trim(both '.' from regexp_replace(lower($3::text),'[^a-z0-9]+','.','g'))||'@demo.local','Alamat demonstrasi '||$3::varchar,$9::varchar,CASE WHEN $9::varchar='VERIFIED' THEN $8::uuid ELSE NULL::uuid END,CASE WHEN $9::varchar='VERIFIED' THEN now() ELSE NULL END)
        ON CONFLICT(member_number) DO UPDATE SET organization_id=excluded.organization_id,religious_name=excluded.religious_name,legal_name=excluded.legal_name,birth_date=excluded.birth_date,join_date=excluded.join_date,status=excluded.status,phone=excluded.phone,email=excluded.email,address=excluded.address,verification_status=excluded.verification_status,verified_by=excluded.verified_by,verified_at=excluded.verified_at RETURNING id`, [unitIds[item.org],number,religious,legal,birth,join,status,adminId,verificationStatus]);
      const sisterId=sister.rows[0].id;
      const canonical=status==='IN_FORMATION'?'TEMPORARY_VOWS':'PERPETUAL_VOWS';
      const dimensions=[['LIFE','LIVING',null],['CANONICAL',canonical,null],['MINISTRY',status==='ACTIVE'?'ACTIVE':'NOT_ACTIVE',null],['RESIDENCE','RESIDENT',unitIds[item.org]]];
      for(const [dimension,code,residenceOrg] of dimensions) await client.query(`INSERT INTO sister_status_periods(sister_id,dimension,status_code,organization_id,effective_from,reason_code,reason_detail,recorded_by,verified_by,verified_at)
        SELECT $1,$2::varchar,$3::varchar,$4,$6,'INITIAL_REGISTRATION','Data contoh awal',$5,$5,now() WHERE NOT EXISTS(SELECT 1 FROM sister_status_periods WHERE sister_id=$1 AND dimension=$2::varchar)`,[sisterId,dimension,code,residenceOrg,adminId,join]);
      await client.query(`INSERT INTO sister_education_records(sister_id,level,field_of_study,institution,start_year,graduation_year,certificate_number,created_by)
        SELECT $1,'S1',$2,'Universitas Katolik Nusantara',extract(year from $3::date)::int-4,extract(year from $3::date)::int,'IJZ/'||$4,$5
        WHERE NOT EXISTS(SELECT 1 FROM sister_education_records WHERE sister_id=$1)`,[sisterId,item.field,join,number.replace('K-',''),adminId]);
      await client.query(`INSERT INTO sister_skills(sister_id,skill_type,name,proficiency,issuer,issued_date,created_by)
        SELECT $1,'COMPETENCY',$2,'Mahir','Pusat Formasi Kongregasi','2024-02-10',$3
        WHERE NOT EXISTS(SELECT 1 FROM sister_skills WHERE sister_id=$1)`,[sisterId,item.skill,adminId]);
      if(number!=='K-0003'){
        await client.query(`INSERT INTO sister_family_members(sister_id,relationship,full_name,phone,is_alive,is_emergency_contact,created_by)
          SELECT $1,'Saudara kandung','Kontak Keluarga '||$2,'08129999'||right('0000'||replace($2::text,'K-',''),4),true,true,$3
          WHERE NOT EXISTS(SELECT 1 FROM sister_family_members WHERE sister_id=$1)`,[sisterId,number,adminId]);
        await client.query(`INSERT INTO sister_sacramental_records(sister_id,sacrament_type,sacrament_date,parish,diocese,certificate_number,created_by)
          SELECT $1,'BAPTISM',$2::date+60,'Paroki Kelahiran','Keuskupan setempat','BAPTIS/'||replace($3::text,'K-',''),$4
          WHERE NOT EXISTS(SELECT 1 FROM sister_sacramental_records WHERE sister_id=$1)`,[sisterId,birth,number,adminId]);
        await client.query(`INSERT INTO sister_vow_records(sister_id,vow_stage,start_date,place,witness,decree_number,created_by)
          SELECT $1,'PERPETUAL',$2::date+interval '8 years','Jakarta','Pemimpin yang berwenang','KAUL/'||replace($3::text,'K-',''),$4
          WHERE NOT EXISTS(SELECT 1 FROM sister_vow_records WHERE sister_id=$1)`,[sisterId,join,number,adminId]);
      }
      if(!['K-0003','K-0009'].includes(number)) await client.query(`INSERT INTO sister_legal_documents(sister_id,document_type,identifier_encrypted,identifier_last4,issued_by,issued_date,created_by)
        SELECT $1,'BPJS',pgp_sym_encrypt('DEMO-BPJS-'||$2,$3),right(replace($2::text,'K-',''),4),'BPJS Kesehatan','2020-01-01',$4
        WHERE NOT EXISTS(SELECT 1 FROM sister_legal_documents WHERE sister_id=$1 AND document_type='BPJS')`,[sisterId,number,encryptionKey,adminId]);
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
    const sisterRows=await client.query<{id:string;member_number:string}>('SELECT id,member_number FROM sisters WHERE member_number=ANY($1::varchar[])',[sisters.map(s=>s.number)]);
    const sisterIds=Object.fromEntries(sisterRows.rows.map(s=>[s.member_number,s.id])) as Record<string,string>;
    const demoUsers = [
      {email:'pimpinan@demo.local',name:'Sr. Maria Anugerah — Pimpinan',role:'PIMPINAN',org:'KONG-001',sister:'K-0001',mfa:true,validTo:null},
      {email:'dewan@demo.local',name:'Dewan Pimpinan Kongregasi',role:'DEWAN',org:'KONG-001',sister:null,mfa:true,validTo:null},
      {email:'superior.jakarta@demo.local',name:'Sr. Theresia — Superior Lokal',role:'SUPERIOR_LOCAL',org:'KOM-JKT-01',sister:'K-0002',mfa:false,validTo:'2029-12-31'},
      {email:'sekretaris@demo.local',name:'Sekretaris Kongregasi',role:'SEKRETARIS',org:'KONG-001',sister:null,mfa:false,validTo:'2029-12-31'},
      {email:'bendahara@demo.local',name:'Bendahara Yayasan',role:'BENDAHARA',org:'YYS-SM',sister:'K-0007',mfa:true,validTo:'2027-12-31'},
      {email:'magistra@demo.local',name:'Sr. Clara — Magistra',role:'MAGISTRA',org:'KOM-YOG-01',sister:'K-0003',mfa:false,validTo:'2028-06-30'},
      {email:'kesehatan@demo.local',name:'Koordinator Pelayanan Kesehatan',role:'KESEHATAN',org:'KOM-SBY-01',sister:'K-0004',mfa:true,validTo:null},
      {email:'arsiparis@demo.local',name:'Arsiparis Kongregasi',role:'ARSIPARIS',org:'KONG-001',sister:null,mfa:false,validTo:null},
      {email:'safeguarding@demo.local',name:'Petugas Safeguarding',role:'SAFEGUARDING',org:'KONG-001',sister:null,mfa:true,validTo:'2029-12-31'},
      {email:'auditor@demo.local',name:'Auditor Internal',role:'AUDITOR',org:'KONG-001',sister:null,mfa:true,validTo:'2026-12-31'},
      {email:'admin.ti@demo.local',name:'Administrator Teknologi Informasi',role:'ADMIN_TI',org:'KONG-001',sister:null,mfa:true,validTo:null},
      {email:'suster.felisitas@demo.local',name:'Sr. Felisitas Tangguh',role:'SUSTER',org:'KOM-JKT-01',sister:'K-0010',mfa:false,validTo:null}
    ] as const;
    const demoUserIds:string[]=[];
    const demoUserIdsByEmail:Record<string,string>={};
    for(const account of demoUsers){
      const user=await client.query<{id:string}>(`INSERT INTO users(organization_id,sister_id,email,full_name,password_hash,role,must_change_password,is_active,access_valid_from,access_valid_to,mfa_required,mfa_enrolled,notes)
        VALUES($1,$2,$3,$4,$5,$6::user_role,false,true,'2026-01-01',$7,$8,false,'Akun demonstrasi presentasi; bukan untuk produksi')
        ON CONFLICT(email) DO UPDATE SET organization_id=excluded.organization_id,sister_id=excluded.sister_id,full_name=excluded.full_name,password_hash=excluded.password_hash,role=excluded.role,must_change_password=false,is_active=true,access_valid_from=excluded.access_valid_from,access_valid_to=excluded.access_valid_to,mfa_required=excluded.mfa_required,mfa_enrolled=false,notes=excluded.notes RETURNING id`,
        [unitIds[account.org],account.sister?sisterIds[account.sister]:null,account.email,account.name,passwordHash,account.role,account.validTo,account.mfa]);
      demoUserIds.push(user.rows[0].id);
      demoUserIdsByEmail[account.email]=user.rows[0].id;
    }
    for(const userId of demoUserIds){
      await client.query(`INSERT INTO user_access_reviews(user_id,reviewed_by,review_date,decision,previous_role,reviewed_role,previous_organization_id,reviewed_organization_id,note,next_review_date)
        SELECT u.id,$2,current_date,'KEEP',u.role,u.role,u.organization_id,u.organization_id,'Review awal akun demonstrasi','2027-02-05'
        FROM users u WHERE u.id=$1 AND NOT EXISTS(SELECT 1 FROM user_access_reviews r WHERE r.user_id=u.id AND r.note='Review awal akun demonstrasi')`,[userId,adminId]);
      await client.query(`UPDATE user_access_reviews r SET previous_role=u.role,reviewed_role=u.role,previous_organization_id=u.organization_id,reviewed_organization_id=u.organization_id,next_review_date='2027-02-05'
        FROM users u WHERE r.user_id=u.id AND u.id=$1 AND r.note='Review awal akun demonstrasi'`,[userId]);
    }
    await client.query(`UPDATE assignments SET organization_id=$2,title='Pemimpin Umum',location='Jakarta',start_date='2024-01-01',end_date='2029-12-31',
      decree_number='SK/KSM/001/2024',assignment_type='PRIMARY',role_category='LEADERSHIP',workload_percent=100,workflow_status='ACTIVE',decree_date='2023-12-12',notes='Data demonstrasi fiktif'
      WHERE sister_id=$1 AND title='Pimpinan Komunitas' AND notes='Data contoh untuk orientasi pengguna'`,[sisterIds['K-0001'],unitIds['GEN-JKT']]);
    const demoAssignments = [
      {member:'K-0001',org:'GEN-JKT',title:'Pemimpin Umum',category:'LEADERSHIP',type:'PRIMARY',load:100,status:'ACTIVE',start:'2024-01-01',end:'2029-12-31',sk:'SK/KSM/001/2024',handover:'COMPLETED'},
      {member:'K-0002',org:'KARYA-SMA-01',title:'Kepala SMA Santa Maria',category:'EDUCATION',type:'PRIMARY',load:80,status:'ACTIVE',start:'2023-07-01',end:'2027-06-30',sk:'SK/PROV/044/2023',handover:'COMPLETED'},
      {member:'K-0002',org:'KOM-JKT-01',title:'Anggota Dewan Komunitas',category:'LEADERSHIP',type:'PARALLEL',load:20,status:'ACTIVE',start:'2024-01-01',end:'2026-12-31',sk:'SK/KOM/002/2024',handover:'NOT_REQUIRED'},
      {member:'K-0003',org:'KARYA-RETRET-01',title:'Praktik Pastoral Formasi',category:'FORMATION',type:'TEMPORARY',load:50,status:'PROPOSED',start:'2026-09-01',end:'2026-12-15',sk:null,handover:'PENDING'},
      {member:'K-0004',org:'KARYA-KLINIK-01',title:'Koordinator Pelayanan Kesehatan',category:'HEALTH',type:'PRIMARY',load:100,status:'ACTIVE',start:'2022-01-01',end:null,sk:'SK/REG/008/2022',handover:'COMPLETED'},
      {member:'K-0005',org:'KARYA-SOSIAL-01',title:'Direktur Program Pemberdayaan',category:'SOCIAL',type:'PRIMARY',load:100,status:'ACTIVE',start:'2025-01-01',end:'2028-12-31',sk:'SK/REG/017/2024',handover:'COMPLETED'},
      {member:'K-0006',org:'KARYA-RETRET-01',title:'Direktur Rumah Retret',category:'PASTORAL',type:'PRIMARY',load:100,status:'ACTIVE',start:'2021-01-01',end:'2026-12-31',sk:'SK/PROV/003/2021',handover:'COMPLETED'},
      {member:'K-0007',org:'YYS-SM',title:'Bendahara Yayasan',category:'ADMINISTRATION',type:'PRIMARY',load:80,status:'ACTIVE',start:'2024-01-01',end:'2027-12-31',sk:'SK/YYS/001/2024',handover:'COMPLETED'},
      {member:'K-0007',org:'KOM-JKT-01',title:'Ekonom Komunitas',category:'ADMINISTRATION',type:'PARALLEL',load:20,status:'ACTIVE',start:'2024-01-01',end:'2027-12-31',sk:'SK/KOM/004/2024',handover:'NOT_REQUIRED'},
      {member:'K-0008',org:'KARYA-KLINIK-01',title:'Penanggung Jawab Farmasi',category:'HEALTH',type:'PRIMARY',load:100,status:'ACTIVE',start:'2025-02-01',end:null,sk:'SK/KLINIK/006/2025',handover:'COMPLETED'},
      {member:'K-0009',org:'KOM-FLO-01',title:'Koordinator Pastoral Keluarga',category:'PASTORAL',type:'PRIMARY',load:100,status:'IN_REVIEW',start:'2026-09-01',end:'2029-08-31',sk:null,handover:'PENDING'},
      {member:'K-0010',org:'KARYA-SMA-01',title:'Koordinator Pembelajaran Digital',category:'EDUCATION',type:'PRIMARY',load:100,status:'APPROVED',start:'2026-08-15',end:'2029-06-30',sk:'SK/PROV/061/2026',handover:'IN_PROGRESS'},
      {member:'K-0004',org:'KOM-YOG-01',title:'Pendamping Postulan',category:'FORMATION',type:'PRIMARY',load:100,status:'COMPLETED',start:'2016-01-01',end:'2021-12-31',sk:'SK/PROV/012/2016',handover:'COMPLETED'}
    ] as const;
    for(const assignment of demoAssignments) await client.query(`INSERT INTO assignments(sister_id,organization_id,source_organization_id,title,location,start_date,end_date,decree_number,decree_date,notes,assignment_type,role_category,workload_percent,workflow_status,handover_status,updates_residence,created_by)
      SELECT $1::uuid,$2::uuid,s.organization_id,$3::varchar,o.city,$4::date,$5::date,$6::varchar,CASE WHEN $6::varchar IS NULL THEN NULL ELSE $4::date-14 END,'Data demonstrasi fiktif',$7::varchar,$8::varchar,$9::integer,$10::varchar,$11::varchar,false,$12::uuid
      FROM sisters s,organizations o WHERE s.id=$1::uuid AND o.id=$2::uuid AND NOT EXISTS(SELECT 1 FROM assignments WHERE sister_id=$1::uuid AND title=$3::varchar AND start_date=$4::date)
      `,[sisterIds[assignment.member],unitIds[assignment.org],assignment.title,assignment.start,assignment.end,assignment.sk,assignment.type,assignment.category,assignment.load,assignment.status,assignment.handover,adminId]);

    const healthUserId=demoUserIdsByEmail['kesehatan@demo.local'];
    for(const profile of [
      {member:'K-0004',blood:'A',rhesus:'+',allergies:'Penisilin',chronic:'Hipertensi terkontrol',diet:'Rendah garam',doctor:'dr. Maria, Klinik Kasih Sehat',emergency:'Sr. Helena Sejahtera',care:'ASSISTED'},
      {member:'K-0008',blood:'O',rhesus:'+',allergies:'Tidak ada yang diketahui',chronic:'-',diet:'Diet umum',doctor:'dr. Maria, Klinik Kasih Sehat',emergency:'Sr. Agnes Setia',care:'INDEPENDENT'}
    ] as const) await client.query(`INSERT INTO health_profiles(sister_id,blood_type,rhesus,allergies,chronic_conditions,diet,doctor_contact,emergency_contact,care_level,notes,updated_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'Data kesehatan fiktif untuk presentasi',$10) ON CONFLICT(sister_id) DO UPDATE SET blood_type=excluded.blood_type,rhesus=excluded.rhesus,allergies=excluded.allergies,chronic_conditions=excluded.chronic_conditions,diet=excluded.diet,doctor_contact=excluded.doctor_contact,emergency_contact=excluded.emergency_contact,care_level=excluded.care_level,notes=excluded.notes,updated_by=excluded.updated_by`,[sisterIds[profile.member],profile.blood,profile.rhesus,profile.allergies,profile.chronic,profile.diet,profile.doctor,profile.emergency,profile.care,healthUserId]);
    const visitRows=[
      {member:'K-0004',date:'2026-07-28 09:00+07',provider:'Klinik Kasih Sehat',complaint:'Kontrol tekanan darah',diagnosis:'Hipertensi terkontrol',treatment:'Evaluasi obat rutin',follow:'2026-08-28'},
      {member:'K-0008',date:'2026-08-02 10:30+07',provider:'RS Santa Maria',complaint:'Pemeriksaan berkala',diagnosis:'Kondisi stabil',treatment:'Edukasi pola hidup sehat',follow:'2027-02-02'}
    ] as const;
    for(const v of visitRows)await client.query(`INSERT INTO health_visits(sister_id,visit_date,provider,complaint,diagnosis,treatment,follow_up_date,created_by) SELECT $1,$2,$3,$4,$5,$6,$7,$8 WHERE NOT EXISTS(SELECT 1 FROM health_visits WHERE sister_id=$1 AND visit_date=$2)`,[sisterIds[v.member],v.date,v.provider,v.complaint,v.diagnosis,v.treatment,v.follow,healthUserId]);
    const medication=await client.query<{id:string}>(`INSERT INTO medications(sister_id,name,dosage,schedule,start_date,instructions,stock_quantity,expires_date,prescribed_by,created_by)
      SELECT $1,'Amlodipine','5 mg','Setiap hari pukul 07.00','2026-01-01','Diminum setelah sarapan',24,'2027-06-30','dr. Maria',$2 WHERE NOT EXISTS(SELECT 1 FROM medications WHERE sister_id=$1 AND name='Amlodipine' AND start_date='2026-01-01') RETURNING id`,[sisterIds['K-0004'],healthUserId]);
    const medicationId=medication.rows[0]?.id??(await client.query<{id:string}>(`SELECT id FROM medications WHERE sister_id=$1 AND name='Amlodipine' AND start_date='2026-01-01'`,[sisterIds['K-0004']])).rows[0].id;
    for(const mar of [{at:'2026-08-04 07:00+07',status:'GIVEN',reason:null,note:'Diberikan setelah sarapan'},{at:'2026-08-05 07:00+07',status:'MISSED',reason:'Suster sedang pemeriksaan laboratorium',note:'Dijadwalkan evaluasi oleh petugas'}])await client.query(`INSERT INTO medication_administrations(medication_id,sister_id,scheduled_at,status,administered_at,administered_by,reason,note) SELECT $1,$2,$3::timestamptz,$4::varchar,CASE WHEN $4::varchar='GIVEN' THEN $3::timestamptz ELSE NULL END,$5,$6,$7 WHERE NOT EXISTS(SELECT 1 FROM medication_administrations WHERE medication_id=$1 AND scheduled_at=$3::timestamptz)`,[medicationId,sisterIds['K-0004'],mar.at,mar.status,healthUserId,mar.reason,mar.note]);
    await client.query(`INSERT INTO health_appointments(sister_id,organization_id,scheduled_at,appointment_type,facility,doctor,transport,companion_sister_id,status,follow_up,created_by)
      SELECT $1,$2,'2026-08-28 09:00+07','Kontrol rutin','Klinik Kasih Sehat','dr. Maria','Mobil komunitas',$3,'SCHEDULED','Bawa catatan tekanan darah satu bulan',$4 WHERE NOT EXISTS(SELECT 1 FROM health_appointments WHERE sister_id=$1 AND scheduled_at='2026-08-28 09:00+07')`,[sisterIds['K-0004'],unitIds['KOM-SBY-01'],sisterIds['K-0008'],healthUserId]);
    await client.query(`INSERT INTO health_incidents(sister_id,organization_id,incident_at,incident_type,location,initial_action,notification,follow_up,severity,status,reported_by)
      SELECT $1,$2,'2026-07-19 18:15+07','Jatuh ringan','Koridor komunitas','Pemeriksaan awal dan kompres','Superior lokal dan petugas kesehatan','Observasi 24 jam; tidak ada keluhan lanjutan','LOW','CLOSED',$3 WHERE NOT EXISTS(SELECT 1 FROM health_incidents WHERE sister_id=$1 AND incident_at='2026-07-19 18:15+07')`,[sisterIds['K-0004'],unitIds['KOM-SBY-01'],healthUserId]);
    await client.query(`INSERT INTO health_handovers(organization_id,sister_id,shift_date,shift,important_condition,open_tasks,handed_over_by,received_by,received_at)
      SELECT $1,$2,'2026-08-05','PAGI','Tekanan darah stabil; satu dosis terlewat karena pemeriksaan','Konfirmasi jadwal dosis berikutnya dan kontrol 28 Agustus',$3,$3,now() WHERE NOT EXISTS(SELECT 1 FROM health_handovers WHERE organization_id=$1 AND sister_id=$2 AND shift_date='2026-08-05' AND shift='PAGI')`,[unitIds['KOM-SBY-01'],sisterIds['K-0004'],healthUserId]);

    await client.query<{id:string}>(`INSERT INTO formation_records(sister_id,organization_id,stage,institution,start_date,planned_end_date,actual_end_date,end_date,mentor,status,result,change_reason,responsible_user_id,created_by)
      SELECT $1,$2,'ASPIRANT','Rumah Formasi Santa Clara','2019-07-01','2020-06-30','2020-06-28','2020-06-28','Sr. Bernadette Sukacita','COMPLETED','Lanjut tahap postulan','Tahap diselesaikan sesuai rencana',$3,$3 WHERE NOT EXISTS(SELECT 1 FROM formation_records WHERE sister_id=$1 AND stage='ASPIRANT' AND start_date='2019-07-01') RETURNING id`,[sisterIds['K-0003'],unitIds['KOM-YOG-01'],demoUserIdsByEmail['magistra@demo.local']]);
    const formationCurrent=await client.query<{id:string}>(`INSERT INTO formation_records(sister_id,organization_id,stage,institution,start_date,planned_end_date,mentor,status,notes,responsible_user_id,created_by)
      SELECT $1,$2,'POSTULANT','Rumah Formasi Santa Clara','2025-07-01','2027-06-30','Sr. Bernadette Sukacita','ACTIVE','Data formasi administratif fiktif untuk presentasi',$3,$3 WHERE NOT EXISTS(SELECT 1 FROM formation_records WHERE sister_id=$1 AND stage='POSTULANT' AND start_date='2025-07-01') RETURNING id`,[sisterIds['K-0003'],unitIds['KOM-YOG-01'],demoUserIdsByEmail['magistra@demo.local']]);
    const formationId=formationCurrent.rows[0]?.id??(await client.query<{id:string}>(`SELECT id FROM formation_records WHERE sister_id=$1 AND stage='POSTULANT' AND start_date='2025-07-01'`,[sisterIds['K-0003']])).rows[0].id;
    await client.query(`INSERT INTO formation_plans(formation_record_id,period_start,period_end,objectives,programs,required_activities,responsible_user_id,status,created_by) SELECT $1,'2026-07-01','2026-12-31','Pertumbuhan kedisiplinan, hidup komunitas, dan kesiapan pelayanan','Kelas konstitusi; praktik pelayanan; refleksi komunitas','Retret semester dan praktik pastoral',$2,'ACTIVE',$2 WHERE NOT EXISTS(SELECT 1 FROM formation_plans WHERE formation_record_id=$1 AND period_start='2026-07-01')`,[formationId,demoUserIdsByEmail['magistra@demo.local']]);
    await client.query(`INSERT INTO formation_activities(formation_record_id,activity_type,title,start_date,end_date,facilitator,administrative_result,status,created_by) SELECT $1,'MINISTRY','Praktik Pastoral Rumah Retret','2026-09-01','2026-12-15','Sr. Bernadette Sukacita','Laporan administratif dikumpulkan setelah kegiatan','PLANNED',$2 WHERE NOT EXISTS(SELECT 1 FROM formation_activities WHERE formation_record_id=$1 AND title='Praktik Pastoral Rumah Retret')`,[formationId,demoUserIdsByEmail['magistra@demo.local']]);
    await client.query(`INSERT INTO formation_evaluations(formation_record_id,period_label,criteria,factual_summary,recommendation,decision,evaluator_id,evaluated_at) SELECT $1,'Semester I 2026','Kedisiplinan, partisipasi komunitas, dan tanggung jawab kegiatan','Mengikuti seluruh kegiatan wajib dan menyelesaikan tugas administratif tepat waktu.','Lanjutkan rencana semester berikutnya dengan pendampingan terjadwal.','CONTINUE',$2,'2026-06-28' WHERE NOT EXISTS(SELECT 1 FROM formation_evaluations WHERE formation_record_id=$1 AND period_label='Semester I 2026')`,[formationId,demoUserIdsByEmail['magistra@demo.local']]);

    const unitProfiles=[
      {org:'KARYA-SMA-01',legal:'YYS-SM',field:'Pendidikan',target:'Remaja tingkat SMA',description:'Pelayanan pendidikan menengah dengan nilai kongregasi.',annual:480,capacity:520,accreditation:'A',license:'IZIN-SMA/2024/018',issuer:'Dinas Pendidikan',valid:'2028-06-30',contact:'Sr. Theresia Damai'},
      {org:'KARYA-KLINIK-01',legal:'YYS-SM',field:'Kesehatan',target:'Masyarakat sekitar dan anggota kongregasi',description:'Pelayanan kesehatan primer dan koordinasi perawatan anggota.',annual:4200,capacity:45,accreditation:'Paripurna',license:'IZIN-KLINIK/2023/044',issuer:'Dinas Kesehatan',valid:'2027-03-31',contact:'Sr. Agnes Setia'},
      {org:'KARYA-RETRET-01',legal:'YYS-SM',field:'Pastoral dan Spiritualitas',target:'Komunitas religius dan umat',description:'Retret, rekoleksi, dan pendampingan kelompok.',annual:1250,capacity:80,accreditation:'-',license:'IZIN-OPERASIONAL/2022/009',issuer:'Pemerintah Daerah',valid:'2026-11-30',contact:'Sr. Bernadette Sukacita'},
      {org:'KARYA-SOSIAL-01',legal:'YYS-SM',field:'Sosial',target:'Keluarga rentan dan kelompok perempuan',description:'Pendampingan dan pemberdayaan masyarakat berbasis komunitas.',annual:600,capacity:120,accreditation:'Terdaftar',license:'IZIN-LKS/2025/031',issuer:'Dinas Sosial',valid:'2029-05-31',contact:'Sr. Lucia Harapan'}
    ] as const;
    for(const p of unitProfiles)await client.query(`INSERT INTO work_unit_profiles(organization_id,legal_entity_organization_id,service_field,target_population,operational_description,annual_target,capacity,accreditation,license_number,license_issuer,license_valid_to,contact_person,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(organization_id) DO UPDATE SET legal_entity_organization_id=excluded.legal_entity_organization_id,service_field=excluded.service_field,target_population=excluded.target_population,operational_description=excluded.operational_description,annual_target=excluded.annual_target,capacity=excluded.capacity,accreditation=excluded.accreditation,license_number=excluded.license_number,license_issuer=excluded.license_issuer,license_valid_to=excluded.license_valid_to,contact_person=excluded.contact_person,updated_by=excluded.updated_by,updated_at=now()`,[unitIds[p.org],unitIds[p.legal],p.field,p.target,p.description,p.annual,p.capacity,p.accreditation,p.license,p.issuer,p.valid,p.contact,adminId]);
    for(const n of [{org:'KARYA-SMA-01',title:'Guru pendamping literasi digital',category:'EDUCATION',skills:['Teknologi pendidikan'],date:'2026-09-01',priority:'HIGH',load:50},{org:'KARYA-KLINIK-01',title:'Pendamping perawatan anggota lansia',category:'HEALTH',skills:['Keperawatan'],date:'2026-10-01',priority:'URGENT',load:50},{org:'KARYA-SOSIAL-01',title:'Koordinator program keluarga',category:'SOCIAL',skills:['Pastoral keluarga'],date:'2026-09-01',priority:'MEDIUM',load:100}] as const)await client.query(`INSERT INTO work_unit_needs(organization_id,title,role_category,required_competencies,needed_from,priority,workload_percent,notes,created_by) SELECT $1::uuid,$2::varchar,$3::varchar,$4::text[],$5::date,$6::varchar,$7::integer,'Kebutuhan demonstrasi yang terhubung ke pencarian kandidat',$8::uuid WHERE NOT EXISTS(SELECT 1 FROM work_unit_needs WHERE organization_id=$1::uuid AND title=$2::varchar AND needed_from=$5::date)`,[unitIds[n.org],n.title,n.category,n.skills,n.date,n.priority,n.load,adminId]);

    const guidePath=resolve(process.cwd(),'../../output/pdf/Panduan_Klaim_BPJS_Demo.pdf');const guideBytes=await readFile(guidePath);const guideChecksum=createHash('sha256').update(guideBytes).digest('hex');
    const guide=await client.query<{id:string}>(`INSERT INTO insurance_guides(organization_id,title,insurer,version,effective_date,expires_date,claim_type,requirements,contact_info,submission_deadline_days,status,file_name,file_path,file_size,checksum_sha256,uploaded_by)
      SELECT NULL,'Panduan Klaim BPJS Kesehatan - Demo','BPJS Kesehatan','DEMO-1.0','2026-01-01','2026-12-31','Rawat Jalan dan Rawat Inap','Kartu peserta; formulir; resume pelayanan; kuitansi; hasil pemeriksaan','Unit administrasi klaim internal',30,'ACTIVE','Panduan_Klaim_BPJS_Demo.pdf',$1,$2,$3,$4
      WHERE NOT EXISTS(SELECT 1 FROM insurance_guides WHERE title='Panduan Klaim BPJS Kesehatan - Demo' AND version='DEMO-1.0') RETURNING id`,[guidePath,guideBytes.length,guideChecksum,healthUserId]);
    const guideId=guide.rows[0]?.id??(await client.query<{id:string}>(`SELECT id FROM insurance_guides WHERE title='Panduan Klaim BPJS Kesehatan - Demo' AND version='DEMO-1.0' ORDER BY created_at DESC LIMIT 1`)).rows[0].id;
    const claims=[
      {number:'KLAIM-2026-DEMO-001',member:'K-0004',stage:'CLARIFICATION',incident:'2026-07-28',service:'2026-07-28',facility:'Klinik Kasih Sehat',type:'Rawat jalan',description:'Kontrol hipertensi dan pemeriksaan penunjang',request:1250000,approved:null,rejected:0,paid:0,due:'2026-08-27',next:'Unggah surat klarifikasi fasilitas'},
      {number:'KLAIM-2026-DEMO-002',member:'K-0008',stage:'PAID',incident:'2026-06-10',service:'2026-06-10',facility:'RS Santa Maria',type:'Pemeriksaan diagnostik',description:'Pemeriksaan diagnostik terjadwal',request:2800000,approved:2500000,rejected:300000,paid:2500000,due:'2026-07-10',next:'Rekonsiliasi dengan bendahara'},
      {number:'KLAIM-2026-DEMO-003',member:'K-0004',stage:'CLOSED',incident:'2026-03-12',service:'2026-03-12',facility:'RS Santa Maria',type:'Rawat inap',description:'Perawatan singkat dan observasi',request:6400000,approved:6000000,rejected:400000,paid:6000000,due:'2026-04-11',next:'Kasus selesai'}
    ] as const;
    for(const c of claims){const claim=await client.query<{id:string}>(`INSERT INTO insurance_claims(organization_id,sister_id,guide_id,assigned_to,claim_number,insurer,policy_number,incident_date,service_date,facility,incident_type,description,amount_requested,amount_approved,amount_rejected,amount_paid,congregation_share,stage,due_date,next_action,payment_date,payment_account_masked,bank_reference,reconciliation_difference,reconciliation_status,created_by,closed_at)
      VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::varchar,'BPJS Kesehatan','****7890',$6::date,$7::date,$8::varchar,$9::varchar,$10::text,$11::numeric,$12::numeric,$13::numeric,$14::numeric,$13::numeric,$15::claim_stage,$16::date,$17::text,CASE WHEN $14::numeric>0 THEN '2026-07-01'::date ELSE NULL END,CASE WHEN $14::numeric>0 THEN '**** 7788' ELSE NULL END,CASE WHEN $14::numeric>0 THEN 'BANK-DEMO-'||right($5::text,3) ELSE NULL END,CASE WHEN $15::claim_stage='CLOSED' THEN 0 ELSE NULL END,CASE WHEN $15::claim_stage='CLOSED' THEN 'MATCHED' ELSE 'PENDING' END,$4::uuid,CASE WHEN $15::claim_stage='CLOSED' THEN now() ELSE NULL END)
      ON CONFLICT(claim_number) DO UPDATE SET guide_id=excluded.guide_id,assigned_to=excluded.assigned_to,stage=excluded.stage,amount_approved=excluded.amount_approved,amount_rejected=excluded.amount_rejected,amount_paid=excluded.amount_paid,next_action=excluded.next_action,reconciliation_status=excluded.reconciliation_status RETURNING id`,[unitIds['KOM-SBY-01'],sisterIds[c.member],guideId,healthUserId,c.number,c.incident,c.service,c.facility,c.type,c.description,c.request,c.approved,c.rejected,c.paid,c.stage,c.due,c.next]);for(const event of [{stage:'DRAFT',note:'Kasus dicatat dari pelayanan kesehatan.'},{stage:'REPORTED',note:'Pelayanan dilaporkan dan petugas klaim ditetapkan.'},{stage:c.stage,note:c.stage==='CLARIFICATION'?'Penjamin meminta surat tambahan dari fasilitas.':c.stage==='PAID'?'Pembayaran diterima dan menunggu rekonsiliasi.':'Pembayaran direkonsiliasi dan kasus ditutup.'}])await client.query(`INSERT INTO insurance_claim_events(claim_id,to_stage,report_note,external_reference,reported_by) SELECT $1::uuid,$2::claim_stage,$3::text,CASE WHEN $2::text IN ('CLARIFICATION','PAID','CLOSED') THEN 'EXT-DEMO-'||right($4::text,3) ELSE NULL END,$5::uuid WHERE NOT EXISTS(SELECT 1 FROM insurance_claim_events WHERE claim_id=$1::uuid AND to_stage=$2::claim_stage AND report_note=$3::text)`,[claim.rows[0].id,event.stage,event.note,c.number,healthUserId])}

    const leaderPosition = await client.query(`INSERT INTO organization_positions(organization_id,code,title,category,authority_scope,sort_order)
      VALUES($1,'SUP-GEN','Pemimpin Umum','LEADERSHIP','Tata kelola kongregasi sesuai konstitusi',1)
      ON CONFLICT(organization_id,code) DO UPDATE SET title=excluded.title RETURNING id`, [orgId]);
    await client.query(`INSERT INTO organization_office_terms(position_id,sister_id,start_date,end_date,decree_number,appointment_basis,created_by)
      SELECT $1,$2,'2024-01-01','2029-12-31','SK/KSM/001/2024','Keputusan Kapitel Umum',$3
      WHERE NOT EXISTS(SELECT 1 FROM organization_office_terms WHERE position_id=$1 AND start_date='2024-01-01')`, [leaderPosition.rows[0].id,first.rows[0].id,adminId]);
    const demoOffices=[
      {org:'PROV-JAWA',code:'PROVINSIAL',title:'Pemimpin Provinsi',category:'LEADERSHIP',member:'K-0002',start:'2023-01-01',end:'2028-12-31',sk:'SK/KSM/021/2022'},
      {org:'KOM-JKT-01',code:'PIMP-KOM',title:'Pemimpin Komunitas',category:'LOCAL',member:'K-0007',start:'2024-01-01',end:'2026-12-31',sk:'SK/PROV/003/2024'},
      {org:'KOM-YOG-01',code:'PIMP-KOM',title:'Pemimpin Komunitas',category:'LOCAL',member:'K-0006',start:'2024-01-01',end:'2026-12-31',sk:'SK/PROV/004/2024'},
      {org:'KOM-SBY-01',code:'PIMP-KOM',title:'Pemimpin Komunitas',category:'LOCAL',member:'K-0004',start:'2024-01-01',end:'2026-12-31',sk:'SK/PROV/005/2024'},
      {org:'KOM-FLO-01',code:'PIMP-KOM',title:'Pemimpin Komunitas',category:'LOCAL',member:'K-0005',start:'2024-01-01',end:'2026-12-31',sk:'SK/REG/002/2024'}
    ] as const;
    for(const office of demoOffices){
      const position=await client.query(`INSERT INTO organization_positions(organization_id,code,title,category,authority_scope,sort_order)
        VALUES($1,$2,$3,$4,'Tata kelola sesuai konstitusi dan mandat unit',1) ON CONFLICT(organization_id,code) DO UPDATE SET title=excluded.title,category=excluded.category RETURNING id`,[unitIds[office.org],office.code,office.title,office.category]);
      await client.query(`INSERT INTO organization_office_terms(position_id,sister_id,start_date,end_date,decree_number,appointment_basis,created_by)
        SELECT $1,$2,$3,$4,$5,'Keputusan pimpinan yang berwenang',$6 WHERE NOT EXISTS(SELECT 1 FROM organization_office_terms WHERE position_id=$1 AND start_date=$3)`,[position.rows[0].id,sisterIds[office.member],office.start,office.end,office.sk,adminId]);
    }

    await client.query(`INSERT INTO governance_meetings(organization_id,meeting_type,title,meeting_date,location,participants,quorum_required,quorum_present,status,notes,created_by)
      SELECT $1,'DEWAN','Rapat Dewan Bulanan','2026-08-01 09:00+07','Ruang Dewan','Pemimpin Umum dan anggota dewan',4,4,'COMPLETED','Evaluasi pelayanan semester pertama',$2
      WHERE NOT EXISTS(SELECT 1 FROM governance_meetings WHERE organization_id=$1 AND title='Rapat Dewan Bulanan' AND meeting_date='2026-08-01 09:00+07')`, [orgId,adminId]);
    await client.query(`INSERT INTO organization_visitations(organization_id,visitation_type,start_date,end_date,visitor_sister_id,agenda,recommendations,follow_up_due,status,created_by)
      SELECT $1,'Visitasi Kanonik','2026-09-14','2026-09-16',$2,'Tata hidup komunitas, karya, dan administrasi','Tindak lanjut disepakati bersama komunitas','2026-10-15','PLANNED',$3
      WHERE NOT EXISTS(SELECT 1 FROM organization_visitations WHERE organization_id=$1 AND start_date='2026-09-14')`, [unitIds['KOM-JKT-01'],first.rows[0].id,adminId]);

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
