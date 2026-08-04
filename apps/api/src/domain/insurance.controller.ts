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

const claimStages = ['DRAFT','REPORTED','DOCUMENTS_PENDING','SUBMITTED','VERIFICATION','APPROVED','REJECTED','PAID','CLOSED'] as const;
type ClaimStage = typeof claimStages[number];
export const claimTransitions: Record<ClaimStage, ClaimStage[]> = {
  DRAFT:['REPORTED'], REPORTED:['DOCUMENTS_PENDING','SUBMITTED'], DOCUMENTS_PENDING:['SUBMITTED'],
  SUBMITTED:['VERIFICATION'], VERIFICATION:['APPROVED','REJECTED','DOCUMENTS_PENDING'], APPROVED:['PAID'],
  REJECTED:['CLOSED'], PAID:['CLOSED'], CLOSED:[]
};
export const canTransitionClaim = (from: ClaimStage, to: ClaimStage) => claimTransitions[from].includes(to);

class ClaimDto {
  @IsOptional() @IsUUID() organizationId?: string;
  @IsUUID() sisterId!: string;
  @IsString() insurer!: string;
  @IsOptional() @IsString() policyNumber?: string;
  @IsDateString() incidentDate!: string;
  @IsString() incidentType!: string;
  @IsString() description!: string;
  @IsNumber() @Min(0) amountRequested!: number;
  @IsOptional() @IsDateString() dueDate?: string;
}
class StageDto {
  @IsIn(claimStages) stage!: ClaimStage;
  @IsString() reportNote!: string;
  @IsOptional() @IsString() externalReference?: string;
  @IsOptional() @IsNumber() @Min(0) amountApproved?: number;
}
class GuideDto {
  @IsOptional() @IsUUID() organizationId?: string;
  @IsString() title!: string;
  @IsString() insurer!: string;
  @IsString() version!: string;
  @IsDateString() effectiveDate!: string;
}

@Controller('insurance')
export class InsuranceController {
  constructor(private readonly domain: DomainService) {}

  @Get('claims')
  async claims(@CurrentUser() user:AuthUser) {
    const s=this.domain.scope(user,'c');
    return (await this.domain.db.query(`SELECT c.*,s.religious_name,o.name organization_name FROM insurance_claims c JOIN sisters s ON s.id=c.sister_id JOIN organizations o ON o.id=c.organization_id WHERE ${s.sql} ORDER BY c.created_at DESC`,s.params)).rows;
  }

  @Get('claims/:id')
  async claim(@CurrentUser() user:AuthUser,@Param('id') id:string) {
    const s=this.domain.scope(user,'c');
    const result=await this.domain.db.query(`SELECT c.*,s.religious_name,o.name organization_name FROM insurance_claims c JOIN sisters s ON s.id=c.sister_id JOIN organizations o ON o.id=c.organization_id WHERE c.id=$${s.params.length+1} AND ${s.sql}`,[...s.params,id]);
    const claim=await this.domain.ensureFound(result.rows);
    const events=await this.domain.db.query(`SELECT e.*,u.full_name reported_by_name FROM insurance_claim_events e JOIN users u ON u.id=e.reported_by WHERE claim_id=$1 ORDER BY report_date`,[id]);
    const documents=await this.domain.db.query(`SELECT id,title,category,file_name,mime_type,file_size,created_at FROM documents WHERE claim_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC`,[id]);
    return {...claim,events:events.rows,documents:documents.rows};
  }

  @Roles('SUPER_ADMIN','PIMPINAN','SEKRETARIS','KESEHATAN','UNIT_ADMIN') @Post('claims')
  async createClaim(@CurrentUser() user:AuthUser,@Body() dto:ClaimDto) {
    const org=this.domain.organization(user,dto.organizationId);
    return this.domain.db.transaction(async(client)=>{
      const sequence=await client.query(`SELECT count(*)::int + 1 seq FROM insurance_claims WHERE date_part('year',created_at)=date_part('year',now())`);
      const number=`KLAIM-${new Date().getFullYear()}-${String(sequence.rows[0].seq).padStart(5,'0')}`;
      const result=await client.query(`INSERT INTO insurance_claims(organization_id,sister_id,claim_number,insurer,policy_number,incident_date,incident_type,description,amount_requested,due_date,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[org,dto.sisterId,number,dto.insurer,dto.policyNumber??null,dto.incidentDate,dto.incidentType,dto.description,dto.amountRequested,dto.dueDate??null,user.sub]);
      await client.query(`INSERT INTO insurance_claim_events(claim_id,to_stage,report_note,reported_by) VALUES($1,'DRAFT',$2,$3)`,[result.rows[0].id,'Klaim dibuat dan menunggu pelaporan awal.',user.sub]);
      return result.rows[0];
    });
  }

  @Roles('SUPER_ADMIN','PIMPINAN','SEKRETARIS','KESEHATAN','UNIT_ADMIN') @Post('claims/:id/stages')
  async updateStage(@CurrentUser() user:AuthUser,@Param('id') id:string,@Body() dto:StageDto) {
    const s=this.domain.scope(user);
    return this.domain.db.transaction(async(client)=>{
      const current=await client.query(`SELECT * FROM insurance_claims WHERE id=$${s.params.length+1} AND ${s.sql} FOR UPDATE`,[...s.params,id]);
      const claim=await this.domain.ensureFound<{stage:ClaimStage}>(current.rows);
      if(!canTransitionClaim(claim.stage,dto.stage)) throw new BadRequestException(`Tahap ${claim.stage} tidak dapat langsung diubah ke ${dto.stage}.`);
      const result=await client.query(`UPDATE insurance_claims SET stage=$1::claim_stage,amount_approved=coalesce($2,amount_approved),submitted_at=CASE WHEN $1::claim_stage='SUBMITTED'::claim_stage THEN now() ELSE submitted_at END,closed_at=CASE WHEN $1::claim_stage='CLOSED'::claim_stage THEN now() ELSE closed_at END WHERE id=$3 RETURNING *`,[dto.stage,dto.amountApproved??null,id]);
      await client.query(`INSERT INTO insurance_claim_events(claim_id,from_stage,to_stage,report_note,external_reference,reported_by) VALUES($1,$2,$3,$4,$5,$6)`,[id,claim.stage,dto.stage,dto.reportNote,dto.externalReference??null,user.sub]);
      return result.rows[0];
    });
  }

  @Get('guides') async guides(@CurrentUser() user:AuthUser){const s=this.domain.scope(user,'g');return(await this.domain.db.query(`SELECT g.*,u.full_name uploaded_by_name FROM insurance_guides g LEFT JOIN users u ON u.id=g.uploaded_by WHERE (g.organization_id IS NULL OR ${s.sql}) AND g.is_active ORDER BY effective_date DESC`,s.params)).rows;}

  @Roles('SUPER_ADMIN','PIMPINAN','SEKRETARIS','KESEHATAN') @Post('guides') @UseInterceptors(FileInterceptor('file',{limits:{fileSize:10*1024*1024}}))
  async uploadGuide(@CurrentUser() user:AuthUser,@Body() dto:GuideDto,@UploadedFile() file?:Express.Multer.File){
    this.validatePdf(file);
    const org=user.role==='SUPER_ADMIN'?(dto.organizationId??null):this.domain.organization(user,dto.organizationId);
    const stored=await this.store(file!,'guides');
    return(await this.domain.db.query(`INSERT INTO insurance_guides(organization_id,title,insurer,version,effective_date,file_name,file_path,file_size,checksum_sha256,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[org,dto.title,dto.insurer,dto.version,dto.effectiveDate,file!.originalname,stored.path,file!.size,stored.checksum,user.sub])).rows[0];
  }

  @Get('guides/:id/file') async downloadGuide(@CurrentUser() user:AuthUser,@Param('id') id:string,@Res() response:Response){
    const s=this.domain.scope(user,'g');const result=await this.domain.db.query(`SELECT * FROM insurance_guides g WHERE g.id=$${s.params.length+1} AND (g.organization_id IS NULL OR ${s.sql})`,[...s.params,id]);
    const guide=await this.domain.ensureFound<any>(result.rows);return response.download(resolve(guide.file_path),guide.file_name);
  }

  @Roles('SUPER_ADMIN','PIMPINAN','SEKRETARIS','KESEHATAN','UNIT_ADMIN') @Post('claims/:id/documents') @UseInterceptors(FileInterceptor('file',{limits:{fileSize:10*1024*1024}}))
  async uploadClaimDocument(@CurrentUser() user:AuthUser,@Param('id') claimId:string,@Body('title') title:string,@Body('category') category:string,@UploadedFile() file?:Express.Multer.File){
    if(!file?.buffer?.length) throw new BadRequestException('Berkas wajib dipilih.');
    const s=this.domain.scope(user,'c');const claim=await this.domain.db.query(`SELECT c.* FROM insurance_claims c WHERE c.id=$${s.params.length+1} AND ${s.sql}`,[...s.params,claimId]);await this.domain.ensureFound(claim.rows);
    const stored=await this.store(file,'claims');
    return(await this.domain.db.query(`INSERT INTO documents(organization_id,claim_id,category,title,file_name,file_path,mime_type,file_size,checksum_sha256,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,title,category,file_name,created_at`,[claim.rows[0].organization_id,claimId,category||'KLAIM_ASURANSI',title||file.originalname,file.originalname,stored.path,file.mimetype,file.size,stored.checksum,user.sub])).rows[0];
  }

  private validatePdf(file?:Express.Multer.File){if(!file?.buffer?.length||file.mimetype!=='application/pdf'||file.buffer.subarray(0,5).toString()!=='%PDF-')throw new BadRequestException('Panduan wajib berupa PDF valid dengan ukuran maksimum 10 MB.');}
  private async store(file:Express.Multer.File,folder:string){const dir=resolve(process.cwd(),'../../uploads',folder);await mkdir(dir,{recursive:true});const safe=`${randomUUID()}${extname(file.originalname).toLowerCase()}`;const path=resolve(dir,safe);await writeFile(path,file.buffer,{flag:'wx'});return{path,checksum:createHash('sha256').update(file.buffer).digest('hex')};}
}
