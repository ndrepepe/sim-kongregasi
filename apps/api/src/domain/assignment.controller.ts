import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { DomainService } from './domain.service';

const WORKFLOW = ['DRAFT','PROPOSED','IN_REVIEW','APPROVED','ACTIVE','COMPLETED','CANCELLED'] as const;

class AssignmentDto {
  @IsUUID() sisterId!: string;
  @IsUUID() organizationId!: string;
  @IsOptional() @IsUUID() sourceOrganizationId?: string;
  @IsString() title!: string;
  @IsOptional() @IsString() location?: string;
  @IsIn(['PRIMARY','PARALLEL','TEMPORARY']) assignmentType!: string;
  @IsIn(['LEADERSHIP','EDUCATION','PASTORAL','HEALTH','ADMINISTRATION','FORMATION','SOCIAL','OTHER']) roleCategory!: string;
  @IsInt() @Min(1) @Max(100) workloadPercent!: number;
  @IsIn(WORKFLOW) workflowStatus!: string;
  @IsDateString() startDate!: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() decreeNumber?: string;
  @IsOptional() @IsDateString() decreeDate?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() updatesResidence?: boolean;
}

class AssignmentStatusDto {
  @IsIn(WORKFLOW) workflowStatus!: string;
  @IsOptional() @IsIn(['NOT_REQUIRED','PENDING','IN_PROGRESS','COMPLETED']) handoverStatus?: string;
  @IsOptional() @IsString() handoverNotes?: string;
}

@Controller('assignments')
export class AssignmentController {
  constructor(private readonly domain: DomainService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('sisterId') sisterId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('status') status?: string,
  ) {
    const scope = this.domain.scope(user, 'a');
    const params = [...scope.params];
    const filters = [scope.sql];
    if (sisterId) { params.push(sisterId); filters.push(`a.sister_id=$${params.length}`); }
    if (organizationId) { params.push(organizationId); filters.push(`a.organization_id=$${params.length}`); }
    if (status) { params.push(status); filters.push(`a.workflow_status=$${params.length}`); }
    const rows = await this.domain.db.query(`SELECT a.*,s.member_number,s.religious_name,
      current_org.name current_organization_name,o.name organization_name,o.type organization_type,
      source_org.name source_organization_name,
      CASE WHEN a.start_date<=current_date AND (a.end_date IS NULL OR a.end_date>=current_date)
        AND a.workflow_status='ACTIVE' THEN true ELSE false END is_current
      FROM assignments a JOIN sisters s ON s.id=a.sister_id
      JOIN organizations current_org ON current_org.id=s.organization_id
      JOIN organizations o ON o.id=a.organization_id
      LEFT JOIN organizations source_org ON source_org.id=a.source_organization_id
      WHERE ${filters.join(' AND ')} ORDER BY
      CASE a.workflow_status WHEN 'ACTIVE' THEN 0 WHEN 'IN_REVIEW' THEN 1 WHEN 'APPROVED' THEN 2 ELSE 3 END,
      a.start_date DESC,s.religious_name`, params);
    return rows.rows;
  }

  @Get('overview')
  async overview(@CurrentUser() user: AuthUser) {
    const sisterScope = this.domain.scope(user, 's');
    const assignmentScope = this.domain.scope(user, 'a');
    const organizations = await this.domain.db.query(`SELECT id,code,name,type,city FROM organizations
      WHERE deleted_at IS NULL AND is_active=true ORDER BY name`);
    const sisters = await this.domain.db.query(`SELECT s.id,s.member_number,s.religious_name,s.organization_id,
      o.name organization_name,coalesce(sk.skills,ARRAY[]::varchar[]) skills,coalesce(work.active_workload,0)::int active_workload
      FROM sisters s JOIN organizations o ON o.id=s.organization_id
      LEFT JOIN LATERAL (SELECT array_agg(DISTINCT name ORDER BY name) skills FROM sister_skills WHERE sister_id=s.id) sk ON true
      LEFT JOIN LATERAL (SELECT sum(workload_percent) active_workload FROM assignments WHERE sister_id=s.id
        AND workflow_status='ACTIVE' AND start_date<=current_date AND (end_date IS NULL OR end_date>=current_date)) work ON true
      WHERE ${sisterScope.sql} AND s.deleted_at IS NULL AND s.status IN ('ACTIVE','IN_FORMATION')
      ORDER BY s.religious_name`, sisterScope.params);
    const stats = await this.domain.db.query(`SELECT
      count(*) FILTER (WHERE workflow_status='ACTIVE' AND start_date<=current_date AND (end_date IS NULL OR end_date>=current_date))::int active,
      count(DISTINCT sister_id) FILTER (WHERE workflow_status='ACTIVE' AND start_date<=current_date AND (end_date IS NULL OR end_date>=current_date))::int assigned_members,
      count(DISTINCT organization_id) FILTER (WHERE workflow_status='ACTIVE' AND start_date<=current_date AND (end_date IS NULL OR end_date>=current_date))::int served_units,
      count(*) FILTER (WHERE workflow_status IN ('PROPOSED','IN_REVIEW','APPROVED') OR handover_status IN ('PENDING','IN_PROGRESS'))::int in_process
      FROM assignments a WHERE ${assignmentScope.sql}`, assignmentScope.params);
    return { stats: stats.rows[0], organizations: organizations.rows, sisters: sisters.rows };
  }

  @Get(':id')
  async detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const scoped=user.role==='SUPER_ADMIN'?{sql:'a.id=$1',params:[id]}:{sql:'a.id=$1 AND a.organization_id=$2',params:[id,user.organizationId]};
    const result = await this.domain.db.query(`SELECT a.*,s.member_number,s.religious_name,o.name organization_name,
      source.name source_organization_name FROM assignments a JOIN sisters s ON s.id=a.sister_id
      JOIN organizations o ON o.id=a.organization_id LEFT JOIN organizations source ON source.id=a.source_organization_id
      WHERE ${scoped.sql}`, scoped.params);
    return this.domain.ensureFound(result.rows);
  }

  @Roles('SUPER_ADMIN','PIMPINAN','SEKRETARIS','UNIT_ADMIN')
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: AssignmentDto) {
    if (dto.endDate && dto.endDate < dto.startDate) throw new BadRequestException('Tanggal selesai tidak boleh mendahului tanggal mulai.');
    await this.assertVisibleSister(user,dto.sisterId);
    const destinationId=this.domain.organization(user,dto.organizationId);
    await this.assertNoConflict(dto);
    const result = await this.domain.db.query(`INSERT INTO assignments(
      sister_id,organization_id,source_organization_id,title,location,assignment_type,role_category,
      workload_percent,workflow_status,start_date,end_date,decree_number,decree_date,notes,
      updates_residence,handover_status,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
        CASE WHEN $9 IN ('PROPOSED','IN_REVIEW','APPROVED') THEN 'PENDING' ELSE 'NOT_REQUIRED' END,$16)
      RETURNING *`, [dto.sisterId,destinationId,dto.sourceOrganizationId??null,dto.title,dto.location??null,
      dto.assignmentType,dto.roleCategory,dto.workloadPercent,dto.workflowStatus,dto.startDate,dto.endDate??null,
      dto.decreeNumber??null,dto.decreeDate??null,dto.notes??null,dto.updatesResidence??false,user.sub]);
    if (dto.workflowStatus==='ACTIVE' && dto.updatesResidence) await this.updateResidence(dto.sisterId,destinationId,dto.startDate,user.sub);
    return result.rows[0];
  }

  @Roles('SUPER_ADMIN','PIMPINAN','SEKRETARIS','UNIT_ADMIN')
  @Patch(':id/status')
  async updateStatus(@CurrentUser() user: AuthUser,@Param('id') id:string,@Body() dto:AssignmentStatusDto) {
    const scoped=user.role==='SUPER_ADMIN'?{sql:'a.id=$1',params:[id]}:{sql:'a.id=$1 AND a.organization_id=$2',params:[id,user.organizationId]};
    const current=await this.domain.db.query(`SELECT a.* FROM assignments a WHERE ${scoped.sql}`,scoped.params);
    const assignment=await this.domain.ensureFound<Record<string,unknown>>(current.rows);
    if(dto.workflowStatus==='ACTIVE') await this.assertNoConflict({
      sisterId:String(assignment.sister_id),startDate:String(assignment.start_date).slice(0,10),
      endDate:assignment.end_date?String(assignment.end_date).slice(0,10):undefined,
      assignmentType:String(assignment.assignment_type),workloadPercent:Number(assignment.workload_percent),excludeId:id,
    });
    const updated=await this.domain.db.query(`UPDATE assignments SET workflow_status=$2,handover_status=coalesce($3,handover_status),
      handover_notes=coalesce($4,handover_notes),updated_at=now() WHERE id=$1 RETURNING *`,
      [id,dto.workflowStatus,dto.handoverStatus??null,dto.handoverNotes??null]);
    if(dto.workflowStatus==='ACTIVE' && assignment.updates_residence) await this.updateResidence(String(assignment.sister_id),String(assignment.organization_id),String(assignment.start_date).slice(0,10),user.sub);
    return updated.rows[0];
  }

  private async assertVisibleSister(user:AuthUser,sisterId:string) {
    const scope=this.domain.scope(user,'s');
    const found=await this.domain.db.query(`SELECT s.id FROM sisters s WHERE s.id=$1 AND s.deleted_at IS NULL AND ${scope.sql}`,[sisterId,...scope.params]);
    await this.domain.ensureFound(found.rows);
  }

  private async assertNoConflict(dto:{sisterId:string;startDate:string;endDate?:string;assignmentType:string;workloadPercent:number;excludeId?:string}) {
    if(dto.assignmentType==='TEMPORARY') return;
    const rows=await this.domain.db.query(`SELECT title,workload_percent,start_date,end_date FROM assignments
      WHERE sister_id=$1 AND workflow_status IN ('APPROVED','ACTIVE') AND ($4::uuid IS NULL OR id<>$4)
      AND daterange(start_date,coalesce(end_date,'infinity'::date),'[]') && daterange($2::date,coalesce($3::date,'infinity'::date),'[]')`,
      [dto.sisterId,dto.startDate,dto.endDate??null,dto.excludeId??null]);
    const total=rows.rows.reduce((sum,row)=>sum+Number(row.workload_percent),0)+dto.workloadPercent;
    if(dto.assignmentType==='PRIMARY' && rows.rows.some(row=>Number(row.workload_percent)>=100))
      throw new BadRequestException(`Periode bentrok dengan penugasan aktif: ${rows.rows[0].title}. Gunakan tipe paralel dan atur beban kerja bila memang sah.`);
    if(total>100) throw new BadRequestException(`Total beban kerja pada periode yang sama menjadi ${total}%. Maksimal 100%.`);
  }

  private async updateResidence(sisterId:string,organizationId:string,effectiveFrom:string,userId:string) {
    await this.domain.db.transaction(async client=>{
      await client.query(`UPDATE sister_status_periods SET effective_to=$3::date-1
        WHERE sister_id=$1 AND dimension='RESIDENCE' AND effective_to IS NULL AND effective_from<$3`,[sisterId,organizationId,effectiveFrom]);
      await client.query(`INSERT INTO sister_status_periods(sister_id,dimension,status_code,organization_id,effective_from,reason_code,reason_detail,recorded_by,verified_by,verified_at)
        SELECT $1,'RESIDENCE','RESIDENT',$2,$3,'ASSIGNMENT_MUTATION','Diperbarui otomatis dari penugasan efektif',$4,$4,now()
        WHERE NOT EXISTS(SELECT 1 FROM sister_status_periods WHERE sister_id=$1 AND dimension='RESIDENCE' AND organization_id=$2 AND effective_from=$3)`,[sisterId,organizationId,effectiveFrom,userId]);
      await client.query(`UPDATE sisters SET organization_id=$2,updated_at=now() WHERE id=$1`,[sisterId,organizationId]);
    });
  }
}
