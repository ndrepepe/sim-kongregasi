import { BadRequestException, Body, Controller, Get, Param, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Response } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { DomainService } from './domain.service';

const claimStages = ['DRAFT','REPORTED','DOCUMENTS_PENDING','INTERNAL_VERIFICATION','SUBMITTED','RECEIVED','CLARIFICATION','ASSESSED','VERIFICATION','APPROVED','REJECTED','APPEAL','PAID','RECONCILIATION','CLOSED'] as const;
type ClaimStage = typeof claimStages[number];
export const claimTransitions: Record<ClaimStage, ClaimStage[]> = {
  DRAFT:['REPORTED'], REPORTED:['DOCUMENTS_PENDING','INTERNAL_VERIFICATION'], DOCUMENTS_PENDING:['INTERNAL_VERIFICATION'],
  INTERNAL_VERIFICATION:['SUBMITTED','DOCUMENTS_PENDING'], SUBMITTED:['RECEIVED'], RECEIVED:['CLARIFICATION','ASSESSED'],
  CLARIFICATION:['ASSESSED','DOCUMENTS_PENDING'], ASSESSED:['APPROVED','REJECTED'], VERIFICATION:['APPROVED','REJECTED','DOCUMENTS_PENDING'],
  APPROVED:['PAID'], REJECTED:['APPEAL','CLOSED'], APPEAL:['SUBMITTED','APPROVED','REJECTED'], PAID:['RECONCILIATION'],
  RECONCILIATION:['CLOSED'], CLOSED:[]
};
export const canTransitionClaim = (from: ClaimStage, to: ClaimStage) => claimTransitions[from].includes(to);

class ClaimDto {
  @IsOptional() @IsUUID() organizationId?: string;
  @IsUUID() sisterId!: string;
  @IsOptional() @IsUUID() guideId?: string;
  @IsOptional() @IsUUID() assignedTo?: string;
  @IsString() insurer!: string;
  @IsOptional() @IsString() policyNumber?: string;
  @IsDateString() incidentDate!: string;
  @IsString() incidentType!: string;
  @IsString() description!: string;
  @IsOptional() @IsString() facility?:string;
  @IsOptional() @IsDateString() serviceDate?:string;
  @IsNumber() @Min(0) amountRequested!: number;
  @IsOptional() @IsDateString() dueDate?: string;
}
class StageDto {
  @IsIn(claimStages) stage!: ClaimStage;
  @IsString() reportNote!: string;
  @IsOptional() @IsString() externalReference?: string;
  @IsOptional() @IsNumber() @Min(0) amountApproved?: number;
  @IsOptional() @IsNumber() @Min(0) amountRejected?:number;
  @IsOptional() @IsNumber() @Min(0) amountPaid?:number;
  @IsOptional() @IsNumber() @Min(0) congregationShare?:number;
  @IsOptional() @IsString() nextAction?:string;
  @IsOptional() @IsDateString() paymentDate?:string;
  @IsOptional() @IsString() paymentAccountMasked?:string;
  @IsOptional() @IsString() bankReference?:string;
  @IsOptional() @IsNumber() reconciliationDifference?:number;
  @IsOptional() @IsIn(['PENDING','MATCHED','DIFFERENCE_RESOLVED']) reconciliationStatus?:string;
}
class GuideDto {
  @IsOptional() @IsUUID() organizationId?: string;
  @IsString() title!: string;
  @IsString() insurer!: string;
  @IsString() version!: string;
  @IsDateString() effectiveDate!: string;
  @IsOptional() @IsString() claimType?:string;
  @IsOptional() @IsDateString() expiresDate?:string;
  @IsOptional() @IsString() requirements?:string;
  @IsOptional() @IsString() contactInfo?:string;
  @IsOptional() @IsNumber() @Min(1) submissionDeadlineDays?:number;
}

@Controller('insurance')
export class InsuranceController {
  constructor(private readonly domain: DomainService) {}
  private async assertSister(user:AuthUser,id:string){const s=this.domain.scope(user,'x');return this.domain.ensureFound<any>((await this.domain.db.query(`SELECT x.* FROM sisters x WHERE x.id=$${s.params.length+1} AND x.deleted_at IS NULL AND ${s.sql}`,[...s.params,id])).rows)}

  @Roles('SUPER_ADMIN','PIMPINAN','SUPERIOR_LOCAL','SEKRETARIS','KESEHATAN','AUDITOR','UNIT_ADMIN')
  @Get('claims')
  async claims(@CurrentUser() user:AuthUser) {
    const s=this.domain.scope(user,'c');
    return (await this.domain.db.query(`SELECT c.*,s.religious_name,o.name organization_name,g.title guide_title,g.version guide_version,u.full_name assigned_to_name,
      (SELECT count(*)::int FROM documents d WHERE d.claim_id=c.id AND d.deleted_at IS NULL) document_count,
      current_date>c.due_date AND c.stage NOT IN ('CLOSED','REJECTED') overdue
      FROM insurance_claims c JOIN sisters s ON s.id=c.sister_id JOIN organizations o ON o.id=c.organization_id LEFT JOIN insurance_guides g ON g.id=c.guide_id LEFT JOIN users u ON u.id=c.assigned_to WHERE ${s.sql} ORDER BY (current_date>c.due_date AND c.stage NOT IN ('CLOSED','REJECTED')) DESC,c.created_at DESC`,s.params)).rows;
  }

  @Roles('SUPER_ADMIN','PIMPINAN','SUPERIOR_LOCAL','SEKRETARIS','KESEHATAN','AUDITOR','UNIT_ADMIN')
  @Get('claims/:id')
  async claim(@CurrentUser() user:AuthUser,@Param('id') id:string) {
    const s=this.domain.scope(user,'c');
    const result=await this.domain.db.query(`SELECT c.*,s.religious_name,o.name organization_name,g.title guide_title,g.version guide_version,u.full_name assigned_to_name FROM insurance_claims c JOIN sisters s ON s.id=c.sister_id JOIN organizations o ON o.id=c.organization_id LEFT JOIN insurance_guides g ON g.id=c.guide_id LEFT JOIN users u ON u.id=c.assigned_to WHERE c.id=$${s.params.length+1} AND ${s.sql}`,[...s.params,id]);
    const claim=await this.domain.ensureFound(result.rows);
    const events=await this.domain.db.query(`SELECT e.*,u.full_name reported_by_name FROM insurance_claim_events e JOIN users u ON u.id=e.reported_by WHERE claim_id=$1 ORDER BY report_date`,[id]);
    const documents=await this.domain.db.query(`SELECT id,title,category,file_name,mime_type,file_size,created_at FROM documents WHERE claim_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC`,[id]);
    return {...claim,events:events.rows,documents:documents.rows};
  }

  @Roles('SUPER_ADMIN','PIMPINAN','SUPERIOR_LOCAL','SEKRETARIS','KESEHATAN','UNIT_ADMIN') @Post('claims')
  async createClaim(@CurrentUser() user:AuthUser,@Body() dto:ClaimDto) {
    const sister=await this.assertSister(user,dto.sisterId);const org=await this.domain.organizationInScope(user,dto.organizationId??sister.organization_id);
    let dueDate=dto.dueDate??null;if(dto.guideId){const guide=await this.domain.ensureFound<any>((await this.domain.db.query(`SELECT * FROM insurance_guides WHERE id=$1 AND status='ACTIVE' AND is_active`,[dto.guideId])).rows);if(!dueDate&&guide.submission_deadline_days){const d=new Date(dto.serviceDate??dto.incidentDate);d.setDate(d.getDate()+Number(guide.submission_deadline_days));dueDate=d.toISOString().slice(0,10)}}
    return this.domain.db.transaction(async(client)=>{
      const sequence=await client.query(`SELECT count(*)::int + 1 seq FROM insurance_claims WHERE date_part('year',created_at)=date_part('year',now())`);
      const number=`KLAIM-${new Date().getFullYear()}-${String(sequence.rows[0].seq).padStart(5,'0')}`;
      const result=await client.query(`INSERT INTO insurance_claims(organization_id,sister_id,guide_id,assigned_to,claim_number,insurer,policy_number,incident_date,service_date,facility,incident_type,description,amount_requested,due_date,next_action,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'Lengkapi dokumen sesuai panduan',$15) RETURNING *`,[org,dto.sisterId,dto.guideId??null,dto.assignedTo??user.sub,number,dto.insurer,dto.policyNumber??null,dto.incidentDate,dto.serviceDate??dto.incidentDate,dto.facility??null,dto.incidentType,dto.description,dto.amountRequested,dueDate,user.sub]);
      await client.query(`INSERT INTO insurance_claim_events(claim_id,to_stage,report_note,reported_by) VALUES($1,'DRAFT',$2,$3)`,[result.rows[0].id,'Klaim dibuat dan menunggu pelaporan awal.',user.sub]);
      return result.rows[0];
    });
  }

  @Roles('SUPER_ADMIN','PIMPINAN','SUPERIOR_LOCAL','SEKRETARIS','KESEHATAN','UNIT_ADMIN') @Post('claims/:id/stages')
  async updateStage(@CurrentUser() user:AuthUser,@Param('id') id:string,@Body() dto:StageDto) {
    const s=this.domain.scope(user);
    return this.domain.db.transaction(async(client)=>{
      const current=await client.query(`SELECT * FROM insurance_claims WHERE id=$${s.params.length+1} AND ${s.sql} FOR UPDATE`,[...s.params,id]);
      const claim=await this.domain.ensureFound<{stage:ClaimStage}>(current.rows);
      if(!canTransitionClaim(claim.stage,dto.stage)) throw new BadRequestException(`Tahap ${claim.stage} tidak dapat langsung diubah ke ${dto.stage}.`);
      if(dto.stage==='PAID'&&(!dto.paymentDate||dto.amountPaid===undefined||!dto.bankReference))throw new BadRequestException('Tanggal, nilai, dan referensi pembayaran wajib dilaporkan.');
      if(dto.stage==='RECONCILIATION'&&dto.reconciliationStatus===undefined)throw new BadRequestException('Status rekonsiliasi wajib dilaporkan.');
      const result=await client.query(`UPDATE insurance_claims SET stage=$1::claim_stage,amount_approved=coalesce($2,amount_approved),amount_rejected=coalesce($3,amount_rejected),amount_paid=coalesce($4,amount_paid),congregation_share=coalesce($5,congregation_share),next_action=coalesce($6,next_action),payment_date=coalesce($7,payment_date),payment_account_masked=coalesce($8,payment_account_masked),bank_reference=coalesce($9,bank_reference),reconciliation_difference=coalesce($10,reconciliation_difference),reconciliation_status=coalesce($11,reconciliation_status),submitted_at=CASE WHEN $1::claim_stage='SUBMITTED'::claim_stage THEN now() ELSE submitted_at END,closed_at=CASE WHEN $1::claim_stage='CLOSED'::claim_stage THEN now() ELSE closed_at END WHERE id=$12 RETURNING *`,[dto.stage,dto.amountApproved??null,dto.amountRejected??null,dto.amountPaid??null,dto.congregationShare??null,dto.nextAction??null,dto.paymentDate??null,dto.paymentAccountMasked??null,dto.bankReference??null,dto.reconciliationDifference??null,dto.reconciliationStatus??null,id]);
      await client.query(`INSERT INTO insurance_claim_events(claim_id,from_stage,to_stage,report_note,external_reference,reported_by) VALUES($1,$2,$3,$4,$5,$6)`,[id,claim.stage,dto.stage,dto.reportNote,dto.externalReference??null,user.sub]);
      return result.rows[0];
    });
  }

  @Roles('SUPER_ADMIN','PIMPINAN','SUPERIOR_LOCAL','SEKRETARIS','KESEHATAN','AUDITOR','UNIT_ADMIN') @Get('guides') async guides(@CurrentUser() user:AuthUser){const s=this.domain.scope(user,'g');return(await this.domain.db.query(`SELECT g.*,u.full_name uploaded_by_name,(g.expires_date IS NOT NULL AND g.expires_date<current_date) expired FROM insurance_guides g LEFT JOIN users u ON u.id=g.uploaded_by WHERE (g.organization_id IS NULL OR ${s.sql}) AND g.is_active ORDER BY (g.status='ACTIVE') DESC,effective_date DESC`,s.params)).rows;}

  @Roles('SUPER_ADMIN','PIMPINAN','SEKRETARIS','KESEHATAN') @Post('guides') @UseInterceptors(FileInterceptor('file',{limits:{fileSize:10*1024*1024}}))
  async uploadGuide(@CurrentUser() user:AuthUser,@Body() dto:GuideDto,@UploadedFile() file?:Express.Multer.File){
    this.validatePdf(file);
    const org=user.role==='SUPER_ADMIN'?(dto.organizationId??null):await this.domain.organizationInScope(user,dto.organizationId);
    const stored=await this.store(file!,'guides');
    if(dto.expiresDate&&dto.expiresDate<dto.effectiveDate)throw new BadRequestException('Tanggal kedaluwarsa panduan tidak valid.');
    return this.domain.db.transaction(async client=>{await client.query(`UPDATE insurance_guides SET status='RETIRED' WHERE insurer=$1 AND coalesce(claim_type,'')=coalesce($2,'') AND status='ACTIVE' AND ($3::uuid IS NULL OR organization_id=$3 OR organization_id IS NULL)`,[dto.insurer,dto.claimType??null,org]);return(await client.query(`INSERT INTO insurance_guides(organization_id,title,insurer,version,effective_date,expires_date,claim_type,requirements,contact_info,submission_deadline_days,status,file_name,file_path,file_size,checksum_sha256,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ACTIVE',$11,$12,$13,$14,$15) RETURNING *`,[org,dto.title,dto.insurer,dto.version,dto.effectiveDate,dto.expiresDate??null,dto.claimType??null,dto.requirements??null,dto.contactInfo??null,dto.submissionDeadlineDays??null,file!.originalname,stored.path,file!.size,stored.checksum,user.sub])).rows[0]});
  }

  @Roles('SUPER_ADMIN','PIMPINAN','SUPERIOR_LOCAL','SEKRETARIS','KESEHATAN','AUDITOR','UNIT_ADMIN') @Get('guides/:id/file') async downloadGuide(@CurrentUser() user:AuthUser,@Param('id') id:string,@Res() response:Response){
    const s=this.domain.scope(user,'g');const result=await this.domain.db.query(`SELECT * FROM insurance_guides g WHERE g.id=$${s.params.length+1} AND (g.organization_id IS NULL OR ${s.sql})`,[...s.params,id]);
    const guide=await this.domain.ensureFound<any>(result.rows);return response.download(resolve(guide.file_path),guide.file_name);
  }

  @Roles('SUPER_ADMIN','PIMPINAN','SUPERIOR_LOCAL','SEKRETARIS','KESEHATAN','UNIT_ADMIN') @Post('claims/:id/documents') @UseInterceptors(FileInterceptor('file',{limits:{fileSize:10*1024*1024}}))
  async uploadClaimDocument(@CurrentUser() user:AuthUser,@Param('id') claimId:string,@Body('title') title:string,@Body('category') category:string,@UploadedFile() file?:Express.Multer.File){
    if(!file?.buffer?.length) throw new BadRequestException('Berkas wajib dipilih.');
    const s=this.domain.scope(user,'c');const claim=await this.domain.db.query(`SELECT c.* FROM insurance_claims c WHERE c.id=$${s.params.length+1} AND ${s.sql}`,[...s.params,claimId]);await this.domain.ensureFound(claim.rows);
    const stored=await this.store(file,'claims');
    return(await this.domain.db.query(`INSERT INTO documents(organization_id,claim_id,category,title,file_name,file_path,mime_type,file_size,checksum_sha256,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,title,category,file_name,created_at`,[claim.rows[0].organization_id,claimId,category||'KLAIM_ASURANSI',title||file.originalname,file.originalname,stored.path,file.mimetype,file.size,stored.checksum,user.sub])).rows[0];
  }

  private validatePdf(file?:Express.Multer.File){if(!file?.buffer?.length||file.mimetype!=='application/pdf'||file.buffer.subarray(0,5).toString()!=='%PDF-')throw new BadRequestException('Panduan wajib berupa PDF valid dengan ukuran maksimum 10 MB.');}
  private async store(file:Express.Multer.File,folder:string){const dir=resolve(process.cwd(),'../../uploads',folder);await mkdir(dir,{recursive:true});const safe=`${randomUUID()}${extname(file.originalname).toLowerCase()}`;const path=resolve(dir,safe);await writeFile(path,file.buffer,{flag:'wx'});return{path,checksum:createHash('sha256').update(file.buffer).digest('hex')};}
}
