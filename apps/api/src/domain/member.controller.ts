import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { DomainService } from './domain.service';

const EDIT_ROLES = ['SUPER_ADMIN','PIMPINAN','SEKRETARIS','UNIT_ADMIN'] as const;
const VERIFY_ROLES = ['SUPER_ADMIN','PIMPINAN','SEKRETARIS'] as const;
const SENSITIVE_ROLES = ['SUPER_ADMIN','PIMPINAN','SEKRETARIS'] as const;

export function maskIdentifier(last4?: string|null) { return last4 ? `•••• •••• ${last4}` : 'Tersimpan terenkripsi'; }
export function calculateCompleteness(row: Record<string,unknown>) {
  const checks = [
    Boolean(row.member_number&&row.religious_name&&row.legal_name&&row.birth_date&&row.nationality),
    Boolean(row.phone||row.email||row.address), Number(row.family_count)>0, Number(row.sacrament_count)>0,
    Number(row.vow_count)>0, Number(row.education_count)>0, Number(row.skill_count)>0,
    Number(row.legal_count)>0, Number(row.status_dimension_count)>=4, row.verification_status==='VERIFIED'
  ];
  return Math.round(checks.filter(Boolean).length/checks.length*100);
}

class MemberDto {
  @IsOptional() @IsUUID() organizationId?: string;
  @IsString() @MaxLength(50) memberNumber!: string;
  @IsString() @MaxLength(160) religiousName!: string;
  @IsString() @MaxLength(160) legalName!: string;
  @IsOptional() @IsString() @MaxLength(100) birthPlace?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsDateString() joinDate?: string;
  @IsOptional() @IsString() @MaxLength(80) nationality?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() @MaxLength(20) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsIn(['WHATSAPP','EMAIL','PHONE','LETTER','IN_PERSON']) communicationPreference?: string;
  @IsOptional() @IsIn(['CANDIDATE','NOVICE','TEMPORARY_VOWS','PERPETUAL_VOWS','EXCLAUSTRATED','TRANSFER','LEFT']) canonicalStatus?: string;
  @IsOptional() @IsIn(['ACTIVE','STUDY','SABBATICAL','SICK','RETIRED','NOT_ACTIVE']) ministryStatus?: string;
  @IsOptional() @IsIn(['RESIDENT','TEMPORARY','OUTSIDE_COMMUNITY','IN_CARE']) residenceStatus?: string;
}

class MemberPatchDto {
  @IsOptional() @IsString() @MaxLength(160) religiousName?: string;
  @IsOptional() @IsString() @MaxLength(160) legalName?: string;
  @IsOptional() @IsString() @MaxLength(100) birthPlace?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsDateString() joinDate?: string;
  @IsOptional() @IsString() @MaxLength(80) nationality?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() @MaxLength(20) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsIn(['WHATSAPP','EMAIL','PHONE','LETTER','IN_PERSON']) communicationPreference?: string;
  @IsOptional() @IsString() notes?: string;
}

class StatusDto {
  @IsIn(['LIFE','CANONICAL','MINISTRY','RESIDENCE']) dimension!: string;
  @IsString() @MaxLength(50) statusCode!: string;
  @IsOptional() @IsUUID() organizationId?: string;
  @IsDateString() effectiveFrom!: string;
  @IsString() @MaxLength(60) reasonCode!: string;
  @IsOptional() @IsString() reasonDetail?: string;
  @IsOptional() @IsString() @MaxLength(160) authorityName?: string;
  @IsOptional() @IsString() @MaxLength(100) decreeNumber?: string;
  @IsOptional() @IsUUID() documentId?: string;
}

class RecordDto {
  @IsOptional() @IsString() relationship?: string; @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() phone?: string; @IsOptional() @IsEmail() email?: string; @IsOptional() @IsString() address?: string;
  @IsOptional() @IsBoolean() isAlive?: boolean; @IsOptional() @IsBoolean() isEmergencyContact?: boolean;
  @IsOptional() @IsIn(['BAPTISM','CONFIRMATION']) sacramentType?: string; @IsOptional() @IsDateString() sacramentDate?: string;
  @IsOptional() @IsString() parish?: string; @IsOptional() @IsString() diocese?: string; @IsOptional() @IsString() certificateNumber?: string;
  @IsOptional() @IsIn(['FIRST','TEMPORARY_RENEWAL','PERPETUAL','OTHER']) vowStage?: string; @IsOptional() @IsDateString() startDate?: string; @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() place?: string; @IsOptional() @IsString() witness?: string; @IsOptional() @IsString() decreeNumber?: string;
  @IsOptional() @IsString() level?: string; @IsOptional() @IsString() fieldOfStudy?: string; @IsOptional() @IsString() institution?: string;
  @IsOptional() @IsInt() @Min(1900) startYear?: number; @IsOptional() @IsInt() @Min(1900) graduationYear?: number;
  @IsOptional() @IsIn(['COMPETENCY','LANGUAGE','CERTIFICATION']) skillType?: string; @IsOptional() @IsString() name?: string; @IsOptional() @IsString() proficiency?: string;
  @IsOptional() @IsString() issuer?: string; @IsOptional() @IsDateString() issuedDate?: string; @IsOptional() @IsDateString() expiresDate?: string;
  @IsOptional() @IsIn(['NIK','PASSPORT','VISA','BPJS','DIPLOMA','OTHER']) documentType?: string; @IsOptional() @IsString() identifier?: string; @IsOptional() @IsString() issuedBy?: string;
  @IsOptional() @IsUUID() documentId?: string; @IsOptional() @IsString() notes?: string;
}

class ReviewDto {
  @IsIn(['APPROVED','CORRECTION_REQUESTED','REJECTED']) status!: string;
  @IsOptional() @IsString() note?: string;
}

@Controller('sisters')
export class MemberController {
  private readonly encryptionKey: string;
  constructor(private readonly domain: DomainService, config: ConfigService) {
    this.encryptionKey=config.get<string>('DATA_ENCRYPTION_KEY')??config.get<string>('JWT_SECRET')??'';
    if (!this.encryptionKey) throw new Error('DATA_ENCRYPTION_KEY belum dikonfigurasi.');
  }

  private asOf(value?:string){const date=value||new Date().toISOString().slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(`${date}T00:00:00Z`)))throw new BadRequestException('Tanggal profil tidak valid.');return date}
  private async visibleIds(user:AuthUser){if(user.role==='SUPER_ADMIN')return(await this.domain.db.query<{id:string}>('SELECT id FROM organizations WHERE deleted_at IS NULL')).rows.map(r=>r.id);if(!user.organizationId)return[];return(await this.domain.db.query<{id:string}>(`WITH RECURSIVE visible AS (SELECT id FROM organizations WHERE id=$1 AND deleted_at IS NULL UNION SELECT o.id FROM organizations o JOIN visible v ON o.parent_id=v.id WHERE o.deleted_at IS NULL) SELECT id FROM visible`,[user.organizationId])).rows.map(r=>r.id)}
  private async assertOrganization(user:AuthUser,id:string){if(!(await this.visibleIds(user)).includes(id))throw new BadRequestException('Organisasi berada di luar lingkup akses Anda.')}
  private async assertMember(user:AuthUser,id:string){const ids=await this.visibleIds(user);const row=await this.domain.db.query('SELECT * FROM sisters WHERE id=$1 AND organization_id=ANY($2::uuid[]) AND deleted_at IS NULL',[id,ids]);return this.domain.ensureFound(row.rows)}
  private canSensitive(user:AuthUser){return SENSITIVE_ROLES.includes(user.role as typeof SENSITIVE_ROLES[number])}

  @Get('summary/completeness') async completeness(@CurrentUser() user:AuthUser){const rows=await this.list(user,'','','','');const distribution={complete:0,attention:0,critical:0};for(const r of rows){if(r.completeness>=80)distribution.complete++;else if(r.completeness>=50)distribution.attention++;else distribution.critical++}return{total:rows.length,average:rows.length?Math.round(rows.reduce((a,r)=>a+r.completeness,0)/rows.length):0,...distribution}}

  @Get('duplicates') async duplicates(@CurrentUser() user:AuthUser,@Query('legalName') legalName='',@Query('birthDate') birthDate=''){
    if(!legalName||!birthDate)return[];const ids=await this.visibleIds(user);return(await this.domain.db.query(`SELECT id,member_number,religious_name,legal_name,birth_date FROM sisters WHERE organization_id=ANY($1::uuid[]) AND deleted_at IS NULL AND birth_date=$2::date AND regexp_replace(lower(legal_name),'\\s','','g')=regexp_replace(lower($3),'\\s','','g')`,[ids,birthDate,legalName])).rows;
  }

  @Get() async list(@CurrentUser() user:AuthUser,@Query('search') search='',@Query('status') status='',@Query('organizationId') organizationId='',@Query('verification') verification=''){
    const ids=await this.visibleIds(user);if(!ids.length)return[];if(organizationId&&!ids.includes(organizationId))throw new BadRequestException('Filter organisasi di luar lingkup akses.');
    const result=await this.domain.db.query(`SELECT s.*,o.name organization_name,
      life.status_code life_status,canonical.status_code canonical_status,ministry.status_code ministry_status,residence.status_code residence_status,
      (SELECT count(*) FROM sister_family_members x WHERE x.sister_id=s.id)::int family_count,
      (SELECT count(*) FROM sister_sacramental_records x WHERE x.sister_id=s.id)::int sacrament_count,
      (SELECT count(*) FROM sister_vow_records x WHERE x.sister_id=s.id)::int vow_count,
      (SELECT count(*) FROM sister_education_records x WHERE x.sister_id=s.id)::int education_count,
      (SELECT count(*) FROM sister_skills x WHERE x.sister_id=s.id)::int skill_count,
      (SELECT count(*) FROM sister_legal_documents x WHERE x.sister_id=s.id)::int legal_count,
      (SELECT count(DISTINCT dimension) FROM sister_status_periods x WHERE x.sister_id=s.id)::int status_dimension_count
      FROM sisters s JOIN organizations o ON o.id=s.organization_id
      LEFT JOIN LATERAL (SELECT status_code FROM sister_status_periods x WHERE x.sister_id=s.id AND dimension='LIFE' AND effective_from<=current_date AND (effective_to IS NULL OR effective_to>=current_date) ORDER BY effective_from DESC LIMIT 1) life ON true
      LEFT JOIN LATERAL (SELECT status_code FROM sister_status_periods x WHERE x.sister_id=s.id AND dimension='CANONICAL' AND effective_from<=current_date AND (effective_to IS NULL OR effective_to>=current_date) ORDER BY effective_from DESC LIMIT 1) canonical ON true
      LEFT JOIN LATERAL (SELECT status_code FROM sister_status_periods x WHERE x.sister_id=s.id AND dimension='MINISTRY' AND effective_from<=current_date AND (effective_to IS NULL OR effective_to>=current_date) ORDER BY effective_from DESC LIMIT 1) ministry ON true
      LEFT JOIN LATERAL (SELECT status_code FROM sister_status_periods x WHERE x.sister_id=s.id AND dimension='RESIDENCE' AND effective_from<=current_date AND (effective_to IS NULL OR effective_to>=current_date) ORDER BY effective_from DESC LIMIT 1) residence ON true
      WHERE s.organization_id=ANY($1::uuid[]) AND s.deleted_at IS NULL
      AND ($2='' OR s.religious_name ILIKE '%'||$2||'%' OR s.legal_name ILIKE '%'||$2||'%' OR s.member_number ILIKE '%'||$2||'%')
      AND ($3='' OR $3 IN (life.status_code,canonical.status_code,ministry.status_code,residence.status_code))
      AND ($4='' OR s.organization_id::text=$4) AND ($5='' OR s.verification_status=$5)
      ORDER BY s.religious_name LIMIT 500`,[ids,search,status,organizationId,verification]);
    return result.rows.map(row=>({...row,legal_name:this.canSensitive(user)?row.legal_name:null,birth_date:this.canSensitive(user)?row.birth_date:null,completeness:calculateCompleteness(row)}));
  }

  @Get(':id') async get(@CurrentUser() user:AuthUser,@Param('id') id:string,@Query('asOf') dateValue?:string){
    const base=await this.assertMember(user,id) as Record<string,unknown>;const asOf=this.asOf(dateValue);const sensitive=this.canSensitive(user);
    const [organization,statuses,family,sacraments,vows,education,skills,legal,assignments,reviews]=await Promise.all([
      this.domain.db.query('SELECT name FROM organizations WHERE id=$1',[base.organization_id]),
      this.domain.db.query(`SELECT x.*,o.name organization_name,u.full_name recorded_by_name,(x.effective_from<=$2::date AND (x.effective_to IS NULL OR x.effective_to>=$2::date)) active_at_date FROM sister_status_periods x LEFT JOIN organizations o ON o.id=x.organization_id LEFT JOIN users u ON u.id=x.recorded_by WHERE x.sister_id=$1 ORDER BY x.effective_from DESC,x.dimension`,[id,asOf]),
      sensitive?this.domain.db.query('SELECT * FROM sister_family_members WHERE sister_id=$1 ORDER BY is_emergency_contact DESC,full_name',[id]):Promise.resolve({rows:[]}),
      sensitive?this.domain.db.query('SELECT * FROM sister_sacramental_records WHERE sister_id=$1 ORDER BY sacrament_date DESC',[id]):Promise.resolve({rows:[]}),
      this.domain.db.query('SELECT * FROM sister_vow_records WHERE sister_id=$1 ORDER BY start_date DESC',[id]),
      this.domain.db.query('SELECT * FROM sister_education_records WHERE sister_id=$1 ORDER BY graduation_year DESC NULLS LAST',[id]),
      this.domain.db.query('SELECT * FROM sister_skills WHERE sister_id=$1 ORDER BY skill_type,name',[id]),
      sensitive?this.domain.db.query('SELECT id,sister_id,document_type,identifier_last4,issued_by,issued_date,expires_date,document_id,notes,created_at FROM sister_legal_documents WHERE sister_id=$1 ORDER BY document_type',[id]):Promise.resolve({rows:[]}),
      this.domain.db.query('SELECT a.*,o.name organization_name FROM assignments a JOIN organizations o ON o.id=a.organization_id WHERE a.sister_id=$1 ORDER BY start_date DESC',[id]),
      sensitive?this.domain.db.query(`SELECT r.*,su.full_name submitted_by_name,rv.full_name reviewed_by_name FROM sister_profile_reviews r JOIN users su ON su.id=r.submitted_by LEFT JOIN users rv ON rv.id=r.reviewed_by WHERE r.sister_id=$1 ORDER BY submitted_at DESC`,[id]):Promise.resolve({rows:[]})
    ]);
    const activeStatuses=Object.fromEntries(['LIFE','CANONICAL','MINISTRY','RESIDENCE'].map(d=>[d,statuses.rows.find(x=>x.dimension===d&&x.active_at_date)??null]));
    const counts={family_count:family.rows.length,sacrament_count:sacraments.rows.length,vow_count:vows.rows.length,education_count:education.rows.length,skill_count:skills.rows.length,legal_count:legal.rows.length,status_dimension_count:new Set(statuses.rows.map(x=>x.dimension)).size};
    const directoryOnly=!sensitive&&!EDIT_ROLES.includes(user.role as typeof EDIT_ROLES[number]);
    return {...base,legal_name:sensitive?base.legal_name:null,birth_date:sensitive?base.birth_date:null,address:directoryOnly?null:base.address,phone:directoryOnly?null:base.phone,email:directoryOnly?null:base.email,notes:directoryOnly?null:base.notes,organization_name:organization.rows[0]?.name,asOf,activeStatuses,statusHistory:statuses.rows,family:family.rows,sacraments:sacraments.rows,vows:vows.rows,education:education.rows,skills:skills.rows,legalDocuments:legal.rows.map(x=>({...x,maskedIdentifier:maskIdentifier(x.identifier_last4)})),assignments:assignments.rows,reviews:reviews.rows,completeness:calculateCompleteness({...base,...counts})};
  }

  @Roles(...EDIT_ROLES) @Post() async create(@CurrentUser() user:AuthUser,@Body() dto:MemberDto){
    const organizationId=dto.organizationId??user.organizationId;if(!organizationId)throw new BadRequestException('Organisasi anggota wajib dipilih.');await this.assertOrganization(user,organizationId);
    if(dto.birthDate){const dup=await this.duplicates(user,dto.legalName,dto.birthDate);if(dup.length)throw new BadRequestException(`Kemungkinan duplikat ditemukan: ${dup[0].member_number} · ${dup[0].religious_name}`)}
    return this.domain.db.transaction(async client=>{const sister=(await client.query(`INSERT INTO sisters(organization_id,member_number,religious_name,legal_name,birth_place,birth_date,join_date,nationality,address,postal_code,phone,email,communication_preference,status)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'ACTIVE') RETURNING *`,[organizationId,dto.memberNumber,dto.religiousName,dto.legalName,dto.birthPlace??null,dto.birthDate??null,dto.joinDate??null,dto.nationality??'Indonesia',dto.address??null,dto.postalCode??null,dto.phone??null,dto.email??null,dto.communicationPreference??'WHATSAPP'])).rows[0];
      const start=dto.joinDate??new Date().toISOString().slice(0,10);const entries=[['LIFE','LIVING',null],['CANONICAL',dto.canonicalStatus??'CANDIDATE',null],['MINISTRY',dto.ministryStatus??'ACTIVE',null],['RESIDENCE',dto.residenceStatus??'RESIDENT',organizationId]];
      for(const [dimension,code,org] of entries)await client.query(`INSERT INTO sister_status_periods(sister_id,dimension,status_code,organization_id,effective_from,reason_code,reason_detail,recorded_by) VALUES($1,$2,$3,$4,$5,'INITIAL_REGISTRATION','Pencatatan anggota baru',$6)`,[sister.id,dimension,code,org,start,user.sub]);return sister});
  }

  @Roles(...EDIT_ROLES) @Patch(':id') async update(@CurrentUser() user:AuthUser,@Param('id') id:string,@Body() dto:MemberPatchDto){await this.assertMember(user,id);const v=[dto.religiousName,dto.legalName,dto.birthPlace,dto.birthDate,dto.joinDate,dto.nationality,dto.address,dto.postalCode,dto.phone,dto.email,dto.communicationPreference,dto.notes,id];return(await this.domain.db.query(`UPDATE sisters SET religious_name=COALESCE($1,religious_name),legal_name=COALESCE($2,legal_name),birth_place=COALESCE($3,birth_place),birth_date=COALESCE($4,birth_date),join_date=COALESCE($5,join_date),nationality=COALESCE($6,nationality),address=COALESCE($7,address),postal_code=COALESCE($8,postal_code),phone=COALESCE($9,phone),email=COALESCE($10,email),communication_preference=COALESCE($11,communication_preference),notes=COALESCE($12,notes),verification_status=CASE WHEN verification_status='VERIFIED' THEN 'DRAFT' ELSE verification_status END,verified_by=NULL,verified_at=NULL WHERE id=$13 RETURNING *`,v)).rows[0]}

  @Roles(...EDIT_ROLES) @Post(':id/statuses') async addStatus(@CurrentUser() user:AuthUser,@Param('id') id:string,@Body() dto:StatusDto){await this.assertMember(user,id);const allowed:Record<string,string[]>={LIFE:['LIVING','DECEASED'],CANONICAL:['CANDIDATE','NOVICE','TEMPORARY_VOWS','PERPETUAL_VOWS','EXCLAUSTRATED','TRANSFER','LEFT'],MINISTRY:['ACTIVE','STUDY','SABBATICAL','SICK','RETIRED','NOT_ACTIVE'],RESIDENCE:['RESIDENT','TEMPORARY','OUTSIDE_COMMUNITY','IN_CARE']};if(!allowed[dto.dimension]?.includes(dto.statusCode))throw new BadRequestException('Status tidak valid untuk dimensi yang dipilih.');if(dto.dimension==='RESIDENCE'){if(!dto.organizationId)throw new BadRequestException('Komunitas wajib dipilih untuk status residensi.');await this.assertOrganization(user,dto.organizationId)}return this.domain.db.transaction(async client=>{const current=await client.query(`SELECT * FROM sister_status_periods WHERE sister_id=$1 AND dimension=$2 AND effective_from<=$3::date AND (effective_to IS NULL OR effective_to>=$3::date) ORDER BY effective_from DESC LIMIT 1 FOR UPDATE`,[id,dto.dimension,dto.effectiveFrom]);if(current.rows[0]){if(current.rows[0].effective_from===dto.effectiveFrom)throw new BadRequestException('Sudah ada status pada tanggal efektif tersebut.');await client.query('UPDATE sister_status_periods SET effective_to=$1::date-1 WHERE id=$2',[dto.effectiveFrom,current.rows[0].id])}const next=await client.query(`SELECT effective_from FROM sister_status_periods WHERE sister_id=$1 AND dimension=$2 AND effective_from>$3::date ORDER BY effective_from LIMIT 1`,[id,dto.dimension,dto.effectiveFrom]);const created=(await client.query(`INSERT INTO sister_status_periods(sister_id,dimension,status_code,organization_id,effective_from,effective_to,reason_code,reason_detail,authority_name,decree_number,document_id,recorded_by) VALUES($1,$2,$3,$4,$5,CASE WHEN $6::date IS NULL THEN NULL ELSE $6::date-1 END,$7,$8,$9,$10,$11,$12) RETURNING *`,[id,dto.dimension,dto.statusCode,dto.organizationId??null,dto.effectiveFrom,next.rows[0]?.effective_from??null,dto.reasonCode,dto.reasonDetail??null,dto.authorityName??null,dto.decreeNumber??null,dto.documentId??null,user.sub])).rows[0];if(dto.dimension==='RESIDENCE'&&dto.effectiveFrom<=new Date().toISOString().slice(0,10))await client.query('UPDATE sisters SET organization_id=$1 WHERE id=$2',[dto.organizationId,id]);if(dto.dimension==='LIFE'&&dto.statusCode==='DECEASED')await client.query("UPDATE sisters SET status='DECEASED' WHERE id=$1",[id]);return created})}

  @Roles(...EDIT_ROLES) @Post(':id/records/:section') async addRecord(@CurrentUser() user:AuthUser,@Param('id') id:string,@Param('section') section:string,@Body() d:RecordDto){await this.assertMember(user,id);const db=this.domain.db;switch(section){
    case'family':if(!d.relationship||!d.fullName)throw new BadRequestException('Relasi dan nama keluarga wajib diisi.');return(await db.query(`INSERT INTO sister_family_members(sister_id,relationship,full_name,phone,email,address,is_alive,is_emergency_contact,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[id,d.relationship,d.fullName,d.phone??null,d.email??null,d.address??null,d.isAlive??null,d.isEmergencyContact??false,d.notes??null,user.sub])).rows[0];
    case'sacraments':if(!d.sacramentType)throw new BadRequestException('Jenis sakramen wajib diisi.');return(await db.query(`INSERT INTO sister_sacramental_records(sister_id,sacrament_type,sacrament_date,parish,diocese,certificate_number,document_id,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[id,d.sacramentType,d.sacramentDate??null,d.parish??null,d.diocese??null,d.certificateNumber??null,d.documentId??null,d.notes??null,user.sub])).rows[0];
    case'vows':if(!d.vowStage||!d.startDate)throw new BadRequestException('Tahap dan tanggal kaul wajib diisi.');return(await db.query(`INSERT INTO sister_vow_records(sister_id,vow_stage,start_date,end_date,place,witness,decree_number,document_id,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[id,d.vowStage,d.startDate,d.endDate??null,d.place??null,d.witness??null,d.decreeNumber??null,d.documentId??null,d.notes??null,user.sub])).rows[0];
    case'education':if(!d.level||!d.institution)throw new BadRequestException('Jenjang dan institusi wajib diisi.');return(await db.query(`INSERT INTO sister_education_records(sister_id,level,field_of_study,institution,start_year,graduation_year,certificate_number,document_id,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[id,d.level,d.fieldOfStudy??null,d.institution,d.startYear??null,d.graduationYear??null,d.certificateNumber??null,d.documentId??null,d.notes??null,user.sub])).rows[0];
    case'skills':if(!d.skillType||!d.name)throw new BadRequestException('Jenis dan nama keahlian wajib diisi.');return(await db.query(`INSERT INTO sister_skills(sister_id,skill_type,name,proficiency,issuer,issued_date,expires_date,document_id,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[id,d.skillType,d.name,d.proficiency??null,d.issuer??null,d.issuedDate??null,d.expiresDate??null,d.documentId??null,d.notes??null,user.sub])).rows[0];
    case'legal':if(!d.documentType)throw new BadRequestException('Jenis dokumen wajib diisi.');return(await db.query(`INSERT INTO sister_legal_documents(sister_id,document_type,identifier_encrypted,identifier_last4,issued_by,issued_date,expires_date,document_id,notes,created_by) VALUES($1,$2,CASE WHEN $3='' THEN NULL ELSE pgp_sym_encrypt($3,$4) END,CASE WHEN $3='' THEN NULL ELSE right(regexp_replace($3,'[^a-zA-Z0-9]','','g'),4) END,$5,$6,$7,$8,$9,$10) RETURNING id,document_type,identifier_last4,issued_by,issued_date,expires_date,notes`,[id,d.documentType,d.identifier??'',this.encryptionKey,d.issuedBy??null,d.issuedDate??null,d.expiresDate??null,d.documentId??null,d.notes??null,user.sub])).rows[0];
    default:throw new BadRequestException('Bagian profil tidak dikenal.')}}

  @Roles(...EDIT_ROLES) @Post(':id/submit-review') async submitReview(@CurrentUser() user:AuthUser,@Param('id') id:string){await this.assertMember(user,id);const member=(await this.list(user,'','','','')).find(x=>x.id===id);return this.domain.db.transaction(async client=>{await client.query("UPDATE sisters SET verification_status='PENDING_VERIFICATION' WHERE id=$1",[id]);return(await client.query(`INSERT INTO sister_profile_reviews(sister_id,status,submitted_by,note,snapshot) VALUES($1,'PENDING',$2,'Pengajuan verifikasi profil',$3) RETURNING *`,[id,user.sub,JSON.stringify({completeness:member?.completeness??0,submittedAt:new Date().toISOString()})])).rows[0]})}

  @Roles(...VERIFY_ROLES) @Patch(':id/review') async review(@CurrentUser() user:AuthUser,@Param('id') id:string,@Body() dto:ReviewDto){await this.assertMember(user,id);return this.domain.db.transaction(async client=>{const pending=await client.query("SELECT * FROM sister_profile_reviews WHERE sister_id=$1 AND status='PENDING' ORDER BY submitted_at DESC LIMIT 1 FOR UPDATE",[id]);if(!pending.rows[0])throw new BadRequestException('Tidak ada pengajuan verifikasi yang menunggu.');await client.query('UPDATE sister_profile_reviews SET status=$1,reviewed_by=$2,reviewed_at=now(),note=$3 WHERE id=$4',[dto.status,user.sub,dto.note??null,pending.rows[0].id]);const profileStatus=dto.status==='APPROVED'?'VERIFIED':'NEEDS_CORRECTION';await client.query('UPDATE sisters SET verification_status=$1,verification_note=$2,verified_by=$3,verified_at=CASE WHEN $1=\'VERIFIED\' THEN now() ELSE NULL END WHERE id=$4',[profileStatus,dto.note??null,user.sub,id]);return{status:profileStatus}})}
}
