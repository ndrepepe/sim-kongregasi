import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthUser } from '../auth/auth.types';

@Injectable()
export class DomainService {
  constructor(readonly db: DatabaseService) {}

  scope(user: AuthUser, alias = ''): { sql: string; params: unknown[] } {
    if (user.role === 'SUPER_ADMIN') return { sql: 'TRUE', params: [] };
    if (!user.organizationId) return { sql: 'FALSE', params: [] };
    const column = `${alias ? `${alias}.` : ''}organization_id`;
    if (['PIMPINAN','DEWAN','SUPERIOR_LOCAL','SEKRETARIS','KESEHATAN','ARSIPARIS','AUDITOR','UNIT_ADMIN'].includes(user.role)) {
      return {
        sql: `${column} IN (WITH RECURSIVE scoped_organizations AS (
          SELECT id FROM organizations WHERE id=$1 AND deleted_at IS NULL
          UNION ALL
          SELECT child.id FROM organizations child JOIN scoped_organizations parent ON child.parent_id=parent.id WHERE child.deleted_at IS NULL
        ) SELECT id FROM scoped_organizations)`,
        params: [user.organizationId]
      };
    }
    return { sql: `${column} = $1`, params: [user.organizationId] };
  }

  organization(user: AuthUser, requested?: string): string {
    if (user.role === 'SUPER_ADMIN' && requested) return requested;
    if (!user.organizationId) throw new BadRequestException('Pengguna belum ditempatkan pada organisasi.');
    return user.organizationId;
  }

  async organizationInScope(user: AuthUser, requested?: string): Promise<string> {
    const organizationId = requested ?? user.organizationId;
    if (!organizationId) throw new BadRequestException('Pengguna belum ditempatkan pada organisasi.');
    if (user.role === 'SUPER_ADMIN') return organizationId;
    const scope = this.scope(user, 'o');
    const result = await this.db.query(`SELECT o.id FROM organizations o WHERE o.id=$${scope.params.length + 1} AND ${scope.sql}`,[...scope.params,organizationId]);
    await this.ensureFound(result.rows);
    return organizationId;
  }

  async ensureFound<T>(rows: T[]): Promise<T> {
    if (!rows[0]) throw new NotFoundException('Data tidak ditemukan atau berada di luar lingkup akses Anda.');
    return rows[0];
  }
}
