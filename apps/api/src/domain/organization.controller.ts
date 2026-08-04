import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { DomainService } from './domain.service';

export const ORGANIZATION_TYPES = ['CONGREGATION','GENERALATE','PROVINCE','REGION','DELEGATION','COMMUNITY','APOSTOLATE','WORK_UNIT','LEGAL_ENTITY'] as const;
const EDIT_ROLES = ['SUPER_ADMIN','PIMPINAN','SEKRETARIS'] as const;

class OrganizationDto {
  @IsString() @MaxLength(40) code!: string;
  @IsString() @MaxLength(160) name!: string;
  @IsIn(ORGANIZATION_TYPES) type!: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsString() @MaxLength(160) territory?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsEmail() email?: string;
}

class OrganizationProfileDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(40) abbreviation?: string;
  @IsOptional() @IsString() @MaxLength(160) territory?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() charism?: string;
  @IsOptional() @IsString() history?: string;
  @IsOptional() @IsString() vision?: string;
  @IsOptional() @IsString() mission?: string;
  @IsOptional() @IsString() constitutionSummary?: string;
  @IsOptional() @IsInt() @Min(0) capacity?: number;
  @IsOptional() @IsString() @MaxLength(160) diocese?: string;
  @IsOptional() @IsBoolean() hasOratory?: boolean;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class MoveOrganizationDto {
  @IsOptional() @IsUUID() parentId?: string;
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsString() @MaxLength(100) decreeNumber?: string;
  @IsString() reason!: string;
}

class OfficeTermDto {
  @IsUUID() organizationId!: string;
  @IsString() @MaxLength(50) positionCode!: string;
  @IsString() @MaxLength(160) positionTitle!: string;
  @IsIn(['LEADERSHIP','COUNCIL','SECRETARIAT','FINANCE','LOCAL','OTHER']) category!: string;
  @IsOptional() @IsString() authorityScope?: string;
  @IsUUID() sisterId!: string;
  @IsDateString() startDate!: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() @MaxLength(100) decreeNumber?: string;
  @IsOptional() @IsString() appointmentBasis?: string;
  @IsOptional() @IsBoolean() isActing?: boolean;
  @IsOptional() @IsString() notes?: string;
}

class MeetingDto {
  @IsUUID() organizationId!: string;
  @IsString() @MaxLength(50) meetingType!: string;
  @IsString() @MaxLength(200) title!: string;
  @IsDateString() meetingDate!: string;
  @IsOptional() @IsString() @MaxLength(160) location?: string;
  @IsOptional() @IsString() participants?: string;
  @IsOptional() @IsInt() @Min(0) quorumRequired?: number;
  @IsOptional() @IsInt() @Min(0) quorumPresent?: number;
  @IsOptional() @IsIn(['INTERNAL','RESTRICTED','CONFIDENTIAL']) confidentiality?: string;
  @IsOptional() @IsIn(['SCHEDULED','COMPLETED','CANCELLED']) status?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() @MaxLength(100) decisionNumber?: string;
  @IsOptional() @IsString() @MaxLength(200) decisionSubject?: string;
  @IsOptional() @IsString() decisionText?: string;
  @IsOptional() @IsDateString() decisionEffectiveDate?: string;
  @IsOptional() @IsString() followUp?: string;
  @IsOptional() @IsDateString() dueDate?: string;
}

class VisitationDto {
  @IsUUID() organizationId!: string;
  @IsString() @MaxLength(80) visitationType!: string;
  @IsDateString() startDate!: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsUUID() visitorSisterId?: string;
  @IsOptional() @IsString() @MaxLength(160) visitorName?: string;
  @IsOptional() @IsString() agenda?: string;
  @IsOptional() @IsString() findings?: string;
  @IsOptional() @IsString() recommendations?: string;
  @IsOptional() @IsDateString() followUpDue?: string;
  @IsOptional() @IsIn(['PLANNED','IN_PROGRESS','COMPLETED','FOLLOW_UP_CLOSED','CANCELLED']) status?: string;
}

@Controller('organizations')
export class OrganizationController {
  constructor(private readonly domain: DomainService) {}

  private asOf(value?: string) {
    const date = value || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
      throw new BadRequestException('Tanggal struktur tidak valid.');
    }
    return date;
  }

  private async visibleIds(user: AuthUser): Promise<string[]> {
    if (user.role === 'SUPER_ADMIN') {
      return (await this.domain.db.query<{id:string}>('SELECT id FROM organizations WHERE deleted_at IS NULL')).rows.map((row) => row.id);
    }
    if (!user.organizationId) return [];
    const result = await this.domain.db.query<{id:string}>(`WITH RECURSIVE visible AS (
      SELECT id FROM organizations WHERE id=$1 AND deleted_at IS NULL
      UNION SELECT o.id FROM organizations o JOIN visible v ON o.parent_id=v.id WHERE o.deleted_at IS NULL
    ) SELECT id FROM visible`, [user.organizationId]);
    return result.rows.map((row) => row.id);
  }

  private async assertVisible(user: AuthUser, organizationId: string) {
    if (!(await this.visibleIds(user)).includes(organizationId)) throw new BadRequestException('Organisasi berada di luar lingkup akses Anda.');
  }

  private async assertSisterVisible(user: AuthUser, sisterId: string) {
    const ids = await this.visibleIds(user);
    const result = await this.domain.db.query('SELECT 1 FROM sisters WHERE id=$1 AND organization_id=ANY($2::uuid[]) AND deleted_at IS NULL', [sisterId,ids]);
    if (!result.rowCount) throw new BadRequestException('Suster berada di luar lingkup akses Anda.');
  }

  @Get()
  async overview(@CurrentUser() user: AuthUser, @Query('asOf') dateValue?: string) {
    const asOf = this.asOf(dateValue);
    const ids = await this.visibleIds(user);
    if (!ids.length) return { asOf, organizations: [], structurePeriods: [], officeTerms: [], meetings: [], visitations: [], sisters: [] };
    const organizations = await this.domain.db.query(`SELECT o.*,
      COALESCE(period.parent_id,o.parent_id) effective_parent_id,
      (SELECT count(*)::int FROM sisters s WHERE s.organization_id=o.id AND s.deleted_at IS NULL) member_count,
      (SELECT count(*)::int FROM organizations child WHERE child.deleted_at IS NULL AND EXISTS (
        SELECT 1 FROM organization_structure_periods csp WHERE csp.organization_id=child.id AND csp.parent_id=o.id
          AND csp.effective_from <= $2::date AND (csp.effective_to IS NULL OR csp.effective_to >= $2::date)
      )) child_count
      FROM organizations o
      LEFT JOIN LATERAL (
        SELECT sp.parent_id FROM organization_structure_periods sp
        WHERE sp.organization_id=o.id AND sp.effective_from <= $2::date AND (sp.effective_to IS NULL OR sp.effective_to >= $2::date)
        ORDER BY sp.effective_from DESC LIMIT 1
      ) period ON true
      WHERE o.id=ANY($1::uuid[]) AND o.deleted_at IS NULL
        AND o.effective_from <= $2::date AND (o.effective_to IS NULL OR o.effective_to >= $2::date)
      ORDER BY o.name`, [ids, asOf]);
    const structurePeriods = await this.domain.db.query(`SELECT sp.*,o.name organization_name,parent.name parent_name
      FROM organization_structure_periods sp JOIN organizations o ON o.id=sp.organization_id
      LEFT JOIN organizations parent ON parent.id=sp.parent_id
      WHERE sp.organization_id=ANY($1::uuid[]) ORDER BY sp.effective_from DESC`, [ids]);
    const officeTerms = await this.domain.db.query(`SELECT t.*,p.organization_id,p.code position_code,p.title position_title,p.category,p.authority_scope,
      s.religious_name,s.member_number,o.name organization_name,
      (t.start_date <= $2::date AND (t.end_date IS NULL OR t.end_date >= $2::date)) active_at_date
      FROM organization_office_terms t JOIN organization_positions p ON p.id=t.position_id
      JOIN sisters s ON s.id=t.sister_id JOIN organizations o ON o.id=p.organization_id
      WHERE p.organization_id=ANY($1::uuid[]) ORDER BY active_at_date DESC,p.sort_order,p.title,t.start_date DESC`, [ids, asOf]);
    const meetings = await this.domain.db.query(`SELECT m.*,o.name organization_name,
      count(d.id)::int decision_count, count(d.id) FILTER (WHERE d.status NOT IN ('DONE','CANCELLED'))::int open_follow_up_count
      FROM governance_meetings m JOIN organizations o ON o.id=m.organization_id
      LEFT JOIN governance_decisions d ON d.meeting_id=m.id
      WHERE m.organization_id=ANY($1::uuid[]) GROUP BY m.id,o.name ORDER BY m.meeting_date DESC`, [ids]);
    const visitations = await this.domain.db.query(`SELECT v.*,o.name organization_name,s.religious_name visitor_sister_name
      FROM organization_visitations v JOIN organizations o ON o.id=v.organization_id
      LEFT JOIN sisters s ON s.id=v.visitor_sister_id
      WHERE v.organization_id=ANY($1::uuid[]) ORDER BY v.start_date DESC`, [ids]);
    const sisters = await this.domain.db.query(`SELECT id,religious_name,member_number,organization_id FROM sisters
      WHERE organization_id=ANY($1::uuid[]) AND deleted_at IS NULL AND status NOT IN ('LEFT','DECEASED') ORDER BY religious_name`, [ids]);
    return { asOf, organizations: organizations.rows.map((row) => ({...row, parent_id: row.effective_parent_id})), structurePeriods: structurePeriods.rows, officeTerms: officeTerms.rows, meetings: meetings.rows, visitations: visitations.rows, sisters: sisters.rows };
  }

  @Get(':id/history')
  async history(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.assertVisible(user, id);
    return (await this.domain.db.query(`SELECT sp.*,parent.name parent_name,u.full_name recorded_by_name
      FROM organization_structure_periods sp LEFT JOIN organizations parent ON parent.id=sp.parent_id
      LEFT JOIN users u ON u.id=sp.recorded_by WHERE sp.organization_id=$1 ORDER BY sp.effective_from DESC`, [id])).rows;
  }

  @Roles(...EDIT_ROLES) @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: OrganizationDto) {
    if (!dto.parentId && user.role !== 'SUPER_ADMIN') throw new BadRequestException('Hanya super admin yang dapat membuat organisasi tanpa induk.');
    if (dto.parentId) await this.assertVisible(user, dto.parentId);
    return this.domain.db.transaction(async (client) => {
      const organization = (await client.query(`INSERT INTO organizations(code,name,type,parent_id,territory,effective_from,address,city,phone,email)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [dto.code,dto.name,dto.type,dto.parentId??null,dto.territory??null,dto.effectiveFrom,dto.address??null,dto.city??null,dto.phone??null,dto.email??null])).rows[0];
      await client.query(`INSERT INTO organization_structure_periods(organization_id,parent_id,effective_from,change_type,reason,recorded_by)
        VALUES($1,$2,$3,'ESTABLISHED','Pembentukan unit organisasi',$4)`, [organization.id,dto.parentId??null,dto.effectiveFrom,user.sub]);
      return organization;
    });
  }

  @Roles(...EDIT_ROLES) @Patch(':id/profile')
  async updateProfile(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: OrganizationProfileDto) {
    await this.assertVisible(user, id);
    const values = [dto.name,dto.abbreviation,dto.territory,dto.address,dto.city,dto.phone,dto.email,dto.charism,dto.history,dto.vision,dto.mission,dto.constitutionSummary,dto.capacity,dto.diocese,dto.hasOratory,dto.notes,dto.isActive,id];
    return (await this.domain.db.query(`UPDATE organizations SET
      name=COALESCE($1,name),abbreviation=COALESCE($2,abbreviation),territory=COALESCE($3,territory),address=COALESCE($4,address),city=COALESCE($5,city),phone=COALESCE($6,phone),email=COALESCE($7,email),
      charism=COALESCE($8,charism),history=COALESCE($9,history),vision=COALESCE($10,vision),mission=COALESCE($11,mission),constitution_summary=COALESCE($12,constitution_summary),capacity=COALESCE($13,capacity),diocese=COALESCE($14,diocese),
      has_oratory=COALESCE($15,has_oratory),notes=COALESCE($16,notes),is_active=COALESCE($17,is_active)
      WHERE id=$18 AND deleted_at IS NULL RETURNING *`, values)).rows[0];
  }

  @Roles(...EDIT_ROLES) @Post(':id/move')
  async move(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MoveOrganizationDto) {
    await this.assertVisible(user, id);
    if (!dto.parentId && user.role !== 'SUPER_ADMIN') throw new BadRequestException('Hanya super admin yang dapat memindahkan unit menjadi organisasi tanpa induk.');
    if (dto.parentId) await this.assertVisible(user, dto.parentId);
    if (dto.parentId === id) throw new BadRequestException('Unit tidak dapat menjadi induk bagi dirinya sendiri.');
    const asOf = this.asOf(dto.effectiveFrom);
    if (dto.parentId) {
      const cycle = await this.domain.db.query(`WITH RECURSIVE descendants AS (
        SELECT id FROM organizations WHERE id=$1
        UNION SELECT o.id FROM organizations o JOIN descendants d ON o.parent_id=d.id WHERE o.deleted_at IS NULL
      ) SELECT 1 FROM descendants WHERE id=$2`, [id,dto.parentId]);
      if (cycle.rowCount) throw new BadRequestException('Perubahan ini akan membentuk siklus hierarki.');
    }
    return this.domain.db.transaction(async (client) => {
      const active = await client.query(`SELECT * FROM organization_structure_periods WHERE organization_id=$1
        AND effective_from <= $2::date AND (effective_to IS NULL OR effective_to >= $2::date)
        ORDER BY effective_from DESC LIMIT 1 FOR UPDATE`, [id,asOf]);
      if (!active.rows[0]) throw new BadRequestException('Tidak ada periode struktur yang aktif pada tanggal tersebut.');
      if (active.rows[0].effective_from === asOf) {
        await client.query(`UPDATE organization_structure_periods SET parent_id=$1,change_type='REORGANIZED',decree_number=$2,reason=$3,recorded_by=$4 WHERE id=$5`, [dto.parentId??null,dto.decreeNumber??null,dto.reason,user.sub,active.rows[0].id]);
      } else {
        await client.query(`UPDATE organization_structure_periods SET effective_to=$1::date-1 WHERE id=$2`, [asOf,active.rows[0].id]);
        await client.query(`INSERT INTO organization_structure_periods(organization_id,parent_id,effective_from,change_type,decree_number,reason,recorded_by)
          VALUES($1,$2,$3,'REORGANIZED',$4,$5,$6)`, [id,dto.parentId??null,asOf,dto.decreeNumber??null,dto.reason,user.sub]);
      }
      if (asOf <= new Date().toISOString().slice(0,10)) await client.query('UPDATE organizations SET parent_id=$1 WHERE id=$2', [dto.parentId??null,id]);
      return { id, parentId: dto.parentId??null, effectiveFrom: asOf };
    });
  }

  @Roles(...EDIT_ROLES) @Post('office-terms')
  async createOfficeTerm(@CurrentUser() user: AuthUser, @Body() dto: OfficeTermDto) {
    await this.assertVisible(user, dto.organizationId);
    await this.assertSisterVisible(user, dto.sisterId);
    if (dto.endDate && dto.endDate < dto.startDate) throw new BadRequestException('Akhir masa tugas tidak boleh sebelum tanggal mulai.');
    return this.domain.db.transaction(async (client) => {
      const position = (await client.query(`INSERT INTO organization_positions(organization_id,code,title,category,authority_scope)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id,code) DO UPDATE SET title=excluded.title,category=excluded.category,authority_scope=excluded.authority_scope,is_active=true RETURNING *`,
        [dto.organizationId,dto.positionCode,dto.positionTitle,dto.category,dto.authorityScope??null])).rows[0];
      const overlap = await client.query(`SELECT 1 FROM organization_office_terms WHERE position_id=$1
        AND daterange(start_date,COALESCE(end_date,'infinity'::date),'[]') && daterange($2::date,COALESCE($3::date,'infinity'::date),'[]')`, [position.id,dto.startDate,dto.endDate??null]);
      if (overlap.rowCount) throw new BadRequestException('Masa tugas bertumpang tindih dengan pemegang jabatan yang sudah tercatat.');
      return (await client.query(`INSERT INTO organization_office_terms(position_id,sister_id,start_date,end_date,decree_number,appointment_basis,is_acting,notes,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [position.id,dto.sisterId,dto.startDate,dto.endDate??null,dto.decreeNumber??null,dto.appointmentBasis??null,dto.isActing??false,dto.notes??null,user.sub])).rows[0];
    });
  }

  @Roles(...EDIT_ROLES) @Post('meetings')
  async createMeeting(@CurrentUser() user: AuthUser, @Body() dto: MeetingDto) {
    await this.assertVisible(user, dto.organizationId);
    if ((dto.quorumPresent??0) > (dto.quorumRequired??Number.MAX_SAFE_INTEGER)) throw new BadRequestException('Jumlah hadir tidak boleh melebihi kuorum yang ditetapkan.');
    return this.domain.db.transaction(async (client) => {
      const meeting = (await client.query(`INSERT INTO governance_meetings(organization_id,meeting_type,title,meeting_date,location,participants,quorum_required,quorum_present,confidentiality,status,notes,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`, [dto.organizationId,dto.meetingType,dto.title,dto.meetingDate,dto.location??null,dto.participants??null,dto.quorumRequired??null,dto.quorumPresent??null,dto.confidentiality??'INTERNAL',dto.status??'SCHEDULED',dto.notes??null,user.sub])).rows[0];
      if (dto.decisionSubject && dto.decisionText) await client.query(`INSERT INTO governance_decisions(meeting_id,decision_number,subject,decision_text,effective_date,follow_up,due_date)
        VALUES($1,$2,$3,$4,$5,$6,$7)`, [meeting.id,dto.decisionNumber??null,dto.decisionSubject,dto.decisionText,dto.decisionEffectiveDate??null,dto.followUp??null,dto.dueDate??null]);
      return meeting;
    });
  }

  @Roles(...EDIT_ROLES) @Post('visitations')
  async createVisitation(@CurrentUser() user: AuthUser, @Body() dto: VisitationDto) {
    await this.assertVisible(user, dto.organizationId);
    if (dto.visitorSisterId) await this.assertSisterVisible(user, dto.visitorSisterId);
    if (!dto.visitorSisterId && !dto.visitorName) throw new BadRequestException('Pilih atau tulis nama visitor.');
    if (dto.endDate && dto.endDate < dto.startDate) throw new BadRequestException('Tanggal selesai visitasi tidak valid.');
    return (await this.domain.db.query(`INSERT INTO organization_visitations(organization_id,visitation_type,start_date,end_date,visitor_sister_id,visitor_name,agenda,findings,recommendations,follow_up_due,status,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`, [dto.organizationId,dto.visitationType,dto.startDate,dto.endDate??null,dto.visitorSisterId??null,dto.visitorName??null,dto.agenda??null,dto.findings??null,dto.recommendations??null,dto.followUpDue??null,dto.status??'PLANNED',user.sub])).rows[0];
  }
}
