import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsArray, IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { DomainService } from './domain.service';

class AssignmentDto {
  @IsUUID() sisterId!: string;
  @IsOptional() @IsUUID() organizationId?: string;
  @IsString() title!: string;
  @IsOptional() @IsString() location?: string;
  @IsDateString() startDate!: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() decreeNumber?: string;
  @IsOptional() @IsString() notes?: string;
}

class HealthVisitDto {
  @IsUUID() sisterId!: string;
  @IsDateString() visitDate!: string;
  @IsString() provider!: string;
  @IsOptional() @IsString() complaint?: string;
  @IsOptional() @IsString() diagnosis?: string;
  @IsOptional() @IsString() treatment?: string;
  @IsOptional() @IsDateString() followUpDate?: string;
}

class ChronicleDto {
  @IsOptional() @IsUUID() organizationId?: string;
  @IsDateString() eventDate!: string;
  @IsString() title!: string;
  @IsString() content!: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsArray() tags?: string[];
}

@Controller('health-check')
export class SystemController {
  constructor(private readonly domain: DomainService) {}
  @Public() @Get() async health() {
    const result = await this.domain.db.query('SELECT now() server_time');
    return { status: 'ok', database: 'connected', serverTime: result.rows[0].server_time };
  }
}

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly domain: DomainService) {}
  @Get()
  async summary(@CurrentUser() user: AuthUser) {
    const scope = this.domain.scope(user);
    const result = await this.domain.db.query(`SELECT
      (SELECT count(*)::int FROM sisters WHERE ${scope.sql} AND deleted_at IS NULL AND status = 'ACTIVE') active_sisters,
      (SELECT count(*)::int FROM assignments WHERE ${scope.sql} AND (end_date IS NULL OR end_date >= current_date)) active_assignments,
      (SELECT count(*)::int FROM insurance_claims WHERE ${scope.sql} AND stage NOT IN ('CLOSED','REJECTED')) open_claims,
      (SELECT count(*)::int FROM documents WHERE ${scope.sql} AND deleted_at IS NULL) documents,
      (SELECT count(*)::int FROM workflow_cases WHERE ${scope.sql} AND status IN ('SUBMITTED','IN_REVIEW')) pending_approvals`, scope.params);
    const upcoming = await this.domain.db.query(`SELECT id, religious_name, birth_date FROM sisters WHERE ${scope.sql} AND deleted_at IS NULL AND birth_date IS NOT NULL ORDER BY
      (date_part('doy', birth_date) - date_part('doy', current_date) + 366)::int % 366 LIMIT 5`, scope.params);
    return { ...result.rows[0], upcomingBirthdays: upcoming.rows };
  }
}

@Controller('assignments')
export class AssignmentController {
  constructor(private readonly domain: DomainService) {}
  @Get() async list(@CurrentUser() user: AuthUser) { const s=this.domain.scope(user,'a'); return (await this.domain.db.query(`SELECT a.*,s.religious_name,o.name organization_name FROM assignments a JOIN sisters s ON s.id=a.sister_id JOIN organizations o ON o.id=a.organization_id WHERE ${s.sql} ORDER BY a.start_date DESC`,s.params)).rows; }
  @Roles('SUPER_ADMIN','PIMPINAN','SEKRETARIS','UNIT_ADMIN') @Post() async create(@CurrentUser() user: AuthUser,@Body() dto: AssignmentDto) {
    const org=this.domain.organization(user,dto.organizationId);
    return (await this.domain.db.query(`INSERT INTO assignments(sister_id,organization_id,title,location,start_date,end_date,decree_number,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[dto.sisterId,org,dto.title,dto.location??null,dto.startDate,dto.endDate??null,dto.decreeNumber??null,dto.notes??null])).rows[0];
  }
}

@Controller('health')
export class HealthController {
  constructor(private readonly domain: DomainService) {}
  @Roles('SUPER_ADMIN','PIMPINAN','KESEHATAN') @Get('visits') async list(@CurrentUser() user:AuthUser){const s=this.domain.scope(user,'si');return(await this.domain.db.query(`SELECT hv.*,si.religious_name FROM health_visits hv JOIN sisters si ON si.id=hv.sister_id WHERE ${s.sql} ORDER BY visit_date DESC LIMIT 200`,s.params)).rows;}
  @Roles('SUPER_ADMIN','PIMPINAN','KESEHATAN') @Post('visits') async create(@CurrentUser() user:AuthUser,@Body() dto:HealthVisitDto){return(await this.domain.db.query(`INSERT INTO health_visits(sister_id,visit_date,provider,complaint,diagnosis,treatment,follow_up_date,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[dto.sisterId,dto.visitDate,dto.provider,dto.complaint??null,dto.diagnosis??null,dto.treatment??null,dto.followUpDate??null,user.sub])).rows[0];}
}

@Controller('finance')
export class FinanceController {
  constructor(private readonly domain:DomainService){}
  @Roles('SUPER_ADMIN','PIMPINAN','BENDAHARA','AUDITOR') @Get('summary') async summary(@CurrentUser() user:AuthUser){const s=this.domain.scope(user,'je');const r=await this.domain.db.query(`SELECT coalesce(sum(jl.debit),0) total_debit,coalesce(sum(jl.credit),0) total_credit,count(DISTINCT je.id)::int journals FROM journal_entries je LEFT JOIN journal_lines jl ON jl.journal_entry_id=je.id WHERE ${s.sql} AND je.status='POSTED'`,s.params);return r.rows[0];}
}

@Controller('chronicles')
export class ChronicleController {
  constructor(private readonly domain:DomainService){}
  @Get() async list(@CurrentUser() user:AuthUser){const s=this.domain.scope(user,'c');return(await this.domain.db.query(`SELECT c.*,u.full_name created_by_name FROM chronicles c JOIN users u ON u.id=c.created_by WHERE ${s.sql} ORDER BY event_date DESC LIMIT 200`,s.params)).rows;}
  @Roles('SUPER_ADMIN','PIMPINAN','SEKRETARIS','ARSIPARIS','UNIT_ADMIN') @Post() async create(@CurrentUser() user:AuthUser,@Body() dto:ChronicleDto){const org=this.domain.organization(user,dto.organizationId);return(await this.domain.db.query(`INSERT INTO chronicles(organization_id,event_date,title,content,location,tags,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[org,dto.eventDate,dto.title,dto.content,dto.location??null,dto.tags??[],user.sub])).rows[0];}
}

@Controller('modules')
export class GenericModuleController {
  constructor(private readonly domain:DomainService){}
  @Get(':module') async list(@CurrentUser() user:AuthUser,@Param('module') module:string){
    const allowed=['formasi','karya','dokumen','workflow','kalender','memorial','laporan','audit'];
    if(!allowed.includes(module)) return {columns:[],rows:[]};
    if(module==='formasi'){const s=this.domain.scope(user,'si');const r=await this.domain.db.query(`SELECT fr.id,si.religious_name anggota,fr.stage tahap,fr.institution institusi,fr.start_date mulai,fr.end_date selesai,fr.result hasil FROM formation_records fr JOIN sisters si ON si.id=fr.sister_id WHERE ${s.sql} ORDER BY fr.start_date DESC`,s.params);return{columns:['anggota','tahap','institusi','mulai','selesai','hasil'],rows:r.rows};}
    if(module==='karya'){const orgs=await this.domain.db.query(`SELECT code kode,name nama,city kota,is_active aktif FROM organizations WHERE type='WORK_UNIT' AND deleted_at IS NULL ORDER BY name`);return{columns:['kode','nama','kota','aktif'],rows:orgs.rows};}
    if(module==='dokumen'){const s=this.domain.scope(user,'d');const r=await this.domain.db.query(`SELECT d.id,d.title judul,d.category kategori,d.file_name berkas,d.visibility akses,d.created_at dibuat FROM documents d WHERE ${s.sql} AND deleted_at IS NULL ORDER BY created_at DESC`,s.params);return{columns:['judul','kategori','berkas','akses','dibuat'],rows:r.rows};}
    if(module==='workflow'){const s=this.domain.scope(user,'w');const r=await this.domain.db.query(`SELECT w.id,w.title judul,w.type jenis,w.status,w.due_at tenggat,u.full_name pemohon FROM workflow_cases w JOIN users u ON u.id=w.requested_by WHERE ${s.sql} ORDER BY w.created_at DESC`,s.params);return{columns:['judul','jenis','status','tenggat','pemohon'],rows:r.rows};}
    if(module==='kalender'){const s=this.domain.scope(user,'si');const r=await this.domain.db.query(`SELECT si.id,si.religious_name kegiatan,si.birth_date tanggal,'ULANG TAHUN' jenis FROM sisters si WHERE ${s.sql} AND si.birth_date IS NOT NULL AND si.deleted_at IS NULL UNION ALL SELECT c.id,c.claim_number,c.due_date,'BATAS KLAIM' FROM insurance_claims c WHERE ${s.sql.replaceAll('si.','c.')} AND c.due_date IS NOT NULL ORDER BY tanggal`,s.params);return{columns:['kegiatan','tanggal','jenis'],rows:r.rows};}
    if(module==='memorial'){const s=this.domain.scope(user,'si');const r=await this.domain.db.query(`SELECT m.id,si.religious_name anggota,m.death_date wafat,m.death_place tempat_wafat,m.burial_place pemakaman,m.remembrance_date peringatan FROM memorials m JOIN sisters si ON si.id=m.sister_id WHERE ${s.sql} ORDER BY m.death_date DESC`,s.params);return{columns:['anggota','wafat','tempat_wafat','pemakaman','peringatan'],rows:r.rows};}
    if(module==='laporan'){const s=this.domain.scope(user);const r=await this.domain.db.query(`SELECT (SELECT count(*) FROM sisters WHERE ${s.sql} AND deleted_at IS NULL) anggota,(SELECT count(*) FROM insurance_claims WHERE ${s.sql}) klaim,(SELECT count(*) FROM assignments WHERE ${s.sql}) penugasan,(SELECT count(*) FROM documents WHERE ${s.sql} AND deleted_at IS NULL) dokumen`,s.params);return{columns:['anggota','klaim','penugasan','dokumen'],rows:r.rows};}
    if(!['SUPER_ADMIN','PIMPINAN','AUDITOR'].includes(user.role)) return{columns:[],rows:[]};
    const s=this.domain.scope(user,'a');const r=await this.domain.db.query(`SELECT a.id,a.occurred_at waktu,u.full_name pengguna,a.action aksi,a.entity_type modul,a.path,a.ip_address ip FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id WHERE ${s.sql} ORDER BY occurred_at DESC LIMIT 500`,s.params);return{columns:['waktu','pengguna','aksi','modul','path','ip'],rows:r.rows};
  }
}
