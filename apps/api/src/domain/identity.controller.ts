import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Patch, Post } from '@nestjs/common';
import { IsBoolean, IsDateString, IsEmail, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { hash } from 'bcryptjs';
import { AuthUser, AppRole } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { DomainService } from './domain.service';
import { PERMISSIONS, ROLE_DEFINITIONS, ROLE_NAMES } from './role-catalog';

class CreateUserDto {
  @IsString() fullName!:string;
  @IsEmail() email!:string;
  @IsIn(ROLE_NAMES) role!:AppRole;
  @IsUUID() organizationId!:string;
  @IsOptional() @IsUUID() sisterId?:string;
  @IsString() @MinLength(12) temporaryPassword!:string;
  @IsOptional() @IsDateString() accessValidFrom?:string;
  @IsOptional() @IsDateString() accessValidTo?:string;
  @IsOptional() @IsBoolean() mfaRequired?:boolean;
  @IsOptional() @IsString() notes?:string;
}
class UpdateUserDto {
  @IsOptional() @IsString() fullName?:string;
  @IsOptional() @IsEmail() email?:string;
  @IsOptional() @IsIn(ROLE_NAMES) role?:AppRole;
  @IsOptional() @IsUUID() organizationId?:string;
  @IsOptional() @IsUUID() sisterId?:string;
  @IsOptional() @IsBoolean() clearSister?:boolean;
  @IsOptional() @IsBoolean() isActive?:boolean;
  @IsOptional() @IsDateString() accessValidFrom?:string;
  @IsOptional() @IsDateString() accessValidTo?:string;
  @IsOptional() @IsBoolean() clearAccessValidTo?:boolean;
  @IsOptional() @IsBoolean() mfaRequired?:boolean;
  @IsOptional() @IsString() notes?:string;
}
class ResetPasswordDto { @IsString() @MinLength(12) temporaryPassword!:string; }
class AccessReviewDto {
  @IsIn(['KEEP','MODIFY','REVOKE']) decision!:'KEEP'|'MODIFY'|'REVOKE';
  @IsOptional() @IsIn(ROLE_NAMES) reviewedRole?:AppRole;
  @IsOptional() @IsUUID() reviewedOrganizationId?:string;
  @IsString() note!:string;
  @IsOptional() @IsDateString() nextReviewDate?:string;
}

const VIEW_ROLES=['SUPER_ADMIN','PIMPINAN','ADMIN_TI','AUDITOR'] as const;
const MANAGE_ROLES=['SUPER_ADMIN','ADMIN_TI'] as const;
const SENSITIVE_ASSIGNMENTS:AppRole[]=['SUPER_ADMIN','PIMPINAN','DEWAN','SAFEGUARDING'];

@Controller('admin')
export class IdentityController {
  constructor(private readonly domain:DomainService){}

  @Roles(...VIEW_ROLES) @Get('users')
  async users(@CurrentUser() actor:AuthUser){
    const globalTechnical=['SUPER_ADMIN','ADMIN_TI'].includes(actor.role);const us=globalTechnical?{sql:'TRUE',params:[]}:this.domain.scope(actor,'u');const os=globalTechnical?{sql:'TRUE',params:[]}:this.domain.organizationScope(actor,'o');const ss=globalTechnical?{sql:'TRUE',params:[]}:this.domain.scope(actor,'s');
    const [users,organizations,sisters,reviews]=await Promise.all([
      this.domain.db.query(`SELECT u.id,u.email,u.full_name,u.role,u.organization_id,o.name organization_name,u.sister_id,s.religious_name sister_name,
        u.is_active,u.must_change_password,u.failed_login_count,u.locked_until,u.last_login_at,u.access_valid_from,u.access_valid_to,
        u.mfa_required,u.mfa_enrolled,u.notes,u.created_at,
        CASE WHEN NOT u.is_active THEN 'NONACTIVE' WHEN u.locked_until>now() THEN 'LOCKED'
          WHEN u.access_valid_from>current_date THEN 'SCHEDULED' WHEN u.access_valid_to<current_date THEN 'EXPIRED' ELSE 'ACTIVE' END account_status,
        (SELECT max(review_date) FROM user_access_reviews r WHERE r.user_id=u.id) last_review_date,
        (SELECT max(next_review_date) FROM user_access_reviews r WHERE r.user_id=u.id) next_review_date
        FROM users u LEFT JOIN organizations o ON o.id=u.organization_id LEFT JOIN sisters s ON s.id=u.sister_id WHERE ${us.sql} ORDER BY u.full_name`,us.params),
      this.domain.db.query(`SELECT o.id,o.code,o.name,o.type FROM organizations o WHERE ${os.sql} AND o.deleted_at IS NULL AND o.is_active ORDER BY o.name`,os.params),
      this.domain.db.query(`SELECT s.id,s.member_number,s.religious_name,s.organization_id FROM sisters s WHERE ${ss.sql} AND s.deleted_at IS NULL ORDER BY s.religious_name`,ss.params),
      this.domain.db.query(`SELECT r.*,u.full_name user_name,rv.full_name reviewer_name,o.name reviewed_organization_name
        FROM user_access_reviews r JOIN users u ON u.id=r.user_id JOIN users rv ON rv.id=r.reviewed_by
        LEFT JOIN organizations o ON o.id=r.reviewed_organization_id WHERE ${us.sql} ORDER BY r.review_date DESC,r.created_at DESC LIMIT 100`,us.params),
    ]);
    const rows=users.rows;const today=new Date().toISOString().slice(0,10);
    const in30=new Date(Date.now()+30*864e5).toISOString().slice(0,10);return {users:rows,organizations:organizations.rows,sisters:sisters.rows,reviews:reviews.rows,stats:{total:rows.length,active:rows.filter(x=>x.account_status==='ACTIVE').length,roles:new Set(rows.filter(x=>x.is_active).map(x=>x.role)).size,mfaPending:rows.filter(x=>x.mfa_required&&!x.mfa_enrolled).length,reviewDue:rows.filter(x=>!x.next_review_date||x.next_review_date<=today).length,locked:rows.filter(x=>x.account_status==='LOCKED').length,expired:rows.filter(x=>x.account_status==='EXPIRED').length,expiringSoon:rows.filter(x=>x.access_valid_to&&String(x.access_valid_to).slice(0,10)>=today&&String(x.access_valid_to).slice(0,10)<=in30).length,unlinked:rows.filter(x=>x.role==='SUSTER'&&!x.sister_id).length}};
  }

  @Roles(...VIEW_ROLES) @Get('roles')
  async roles(){
    const counts=await this.domain.db.query<{role:AppRole;count:number}>('SELECT role,count(*)::int count FROM users GROUP BY role');
    const countMap=new Map(counts.rows.map(x=>[x.role,x.count]));
    return {permissions:PERMISSIONS,roles:ROLE_NAMES.map(key=>({key,...ROLE_DEFINITIONS[key],userCount:countMap.get(key)??0}))};
  }

  @Roles(...MANAGE_ROLES) @Post('users')
  async create(@CurrentUser() actor:AuthUser,@Body() dto:CreateUserDto){
    this.assertAssignment(actor,dto.role);this.assertPeriod(dto.accessValidFrom,dto.accessValidTo);await this.assertReferences(dto.organizationId,dto.sisterId);
    try{return (await this.domain.db.query(`INSERT INTO users(organization_id,sister_id,email,full_name,password_hash,role,must_change_password,access_valid_from,access_valid_to,mfa_required,notes)
      VALUES($1,$2,lower($3),$4,$5,$6,true,coalesce($7,current_date),$8,$9,$10) RETURNING id,email,full_name,role,is_active`,
      [dto.organizationId,dto.sisterId??null,dto.email.trim(),dto.fullName.trim(),await hash(dto.temporaryPassword,12),dto.role,dto.accessValidFrom??null,dto.accessValidTo??null,dto.mfaRequired??false,dto.notes??null])).rows[0]}
    catch(error){this.translateUnique(error);throw error}
  }

  @Roles(...MANAGE_ROLES) @Patch('users/:id')
  async update(@CurrentUser() actor:AuthUser,@Param('id') id:string,@Body() dto:UpdateUserDto){
    const current=await this.getUser(id);const nextRole=dto.role??current.role;this.assertTarget(actor,current.role);this.assertAssignment(actor,nextRole);
    if(id===actor.sub&&dto.isActive===false)throw new BadRequestException('Anda tidak dapat menonaktifkan akun yang sedang digunakan.');
    const from=dto.accessValidFrom??String(current.access_valid_from).slice(0,10);const to=dto.clearAccessValidTo?undefined:(dto.accessValidTo??(current.access_valid_to?String(current.access_valid_to).slice(0,10):undefined));this.assertPeriod(from,to);
    const organizationId=dto.organizationId??current.organization_id;const sisterId=dto.clearSister?null:(dto.sisterId??current.sister_id);await this.assertReferences(organizationId,sisterId??undefined);
    try{const result=await this.domain.db.query(`UPDATE users SET full_name=$2,email=lower($3),role=$4,organization_id=$5,sister_id=$6,is_active=$7,
      access_valid_from=$8,access_valid_to=$9,mfa_required=$10,notes=$11,updated_at=now() WHERE id=$1 RETURNING id,email,full_name,role,is_active`,
      [id,dto.fullName??current.full_name,dto.email??current.email,nextRole,organizationId,sisterId,dto.isActive??current.is_active,from,to??null,dto.mfaRequired??current.mfa_required,dto.notes??current.notes]);
      await this.revokeSessions(id);return result.rows[0]}catch(error){this.translateUnique(error);throw error}
  }

  @Roles(...MANAGE_ROLES) @Post('users/:id/reset-password')
  async resetPassword(@CurrentUser() actor:AuthUser,@Param('id') id:string,@Body() dto:ResetPasswordDto){const current=await this.getUser(id);this.assertTarget(actor,current.role);await this.domain.db.query('UPDATE users SET password_hash=$2,must_change_password=true,failed_login_count=0,locked_until=NULL WHERE id=$1',[id,await hash(dto.temporaryPassword,12)]);await this.revokeSessions(id);return{status:'RESET',mustChangePassword:true}}

  @Roles(...MANAGE_ROLES) @Post('users/:id/unlock')
  async unlock(@CurrentUser() actor:AuthUser,@Param('id') id:string){const current=await this.getUser(id);this.assertTarget(actor,current.role);await this.domain.db.query('UPDATE users SET failed_login_count=0,locked_until=NULL WHERE id=$1',[id]);return{status:'ACTIVE'}}

  @Roles('SUPER_ADMIN','PIMPINAN') @Post('users/:id/access-reviews')
  async review(@CurrentUser() actor:AuthUser,@Param('id') id:string,@Body() dto:AccessReviewDto){
    const current=await this.getUser(id);if(id===actor.sub&&dto.decision==='REVOKE')throw new BadRequestException('Anda tidak dapat mencabut akun yang sedang digunakan.');
    if(actor.role!=='SUPER_ADMIN'&&dto.decision==='MODIFY')throw new ForbiddenException('Pimpinan dapat mempertahankan atau mencabut akses; perubahan role dilakukan Super Admin.');
    const reviewedRole=dto.reviewedRole??current.role;const reviewedOrganizationId=dto.reviewedOrganizationId??current.organization_id;if(dto.decision==='MODIFY')this.assertAssignment(actor,reviewedRole);
    return this.domain.db.transaction(async client=>{const review=(await client.query(`INSERT INTO user_access_reviews(user_id,reviewed_by,decision,previous_role,reviewed_role,previous_organization_id,reviewed_organization_id,note,next_review_date)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[id,actor.sub,dto.decision,current.role,reviewedRole,current.organization_id,reviewedOrganizationId,dto.note,dto.nextReviewDate??null])).rows[0];
      if(dto.decision==='REVOKE')await client.query('UPDATE users SET is_active=false WHERE id=$1',[id]);
      if(dto.decision==='MODIFY')await client.query('UPDATE users SET role=$2,organization_id=$3 WHERE id=$1',[id,reviewedRole,reviewedOrganizationId]);
      await client.query('UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[id]);return review});
  }

  private async getUser(id:string){return this.domain.ensureFound((await this.domain.db.query('SELECT * FROM users WHERE id=$1',[id])).rows)}
  private assertTarget(actor:AuthUser,targetRole:AppRole){if(actor.role==='ADMIN_TI'&&SENSITIVE_ASSIGNMENTS.includes(targetRole))throw new ForbiddenException('Admin TI tidak dapat mengubah akun pimpinan atau role sangat sensitif.')}
  private assertAssignment(actor:AuthUser,role:AppRole){if(actor.role==='ADMIN_TI'&&SENSITIVE_ASSIGNMENTS.includes(role))throw new ForbiddenException('Penetapan role ini memerlukan Super Admin.')}
  private assertPeriod(from?:string,to?:string){if(from&&to&&to<from)throw new BadRequestException('Akhir masa akses tidak boleh mendahului tanggal mulai.')}
  private async assertReferences(organizationId:string,sisterId?:string){if(!(await this.domain.db.query('SELECT 1 FROM organizations WHERE id=$1 AND deleted_at IS NULL',[organizationId])).rowCount)throw new BadRequestException('Organisasi tidak ditemukan.');if(sisterId&&!(await this.domain.db.query('SELECT 1 FROM sisters WHERE id=$1 AND deleted_at IS NULL',[sisterId])).rowCount)throw new BadRequestException('Anggota yang ditautkan tidak ditemukan.')}
  private async revokeSessions(id:string){await this.domain.db.query('UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[id])}
  private translateUnique(error:unknown){if((error as {code?:string})?.code==='23505')throw new BadRequestException('Email atau anggota tersebut sudah terhubung ke akun lain.')}
}
