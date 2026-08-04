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
    const org = await client.query(`INSERT INTO organizations(code,name,type,city) VALUES('KONG-001','Kongregasi Contoh','GENERALATE','Jakarta')
      ON CONFLICT(code) DO UPDATE SET name=excluded.name RETURNING id`);
    const orgId = org.rows[0].id;
    const passwordHash = await hash(adminPassword, 12);
    const admin = await client.query(`INSERT INTO users(organization_id,email,full_name,password_hash,role,must_change_password)
      VALUES($1,$2,'Administrator SIM Kongregasi',$3,'SUPER_ADMIN',true)
      ON CONFLICT(email) DO UPDATE SET organization_id=excluded.organization_id,full_name=excluded.full_name,role='SUPER_ADMIN' RETURNING id`, [orgId, adminEmail, passwordHash]);
    const adminId = admin.rows[0].id;

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
