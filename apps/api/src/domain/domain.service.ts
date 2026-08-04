import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthUser } from '../auth/auth.types';

@Injectable()
export class DomainService {
  constructor(readonly db: DatabaseService) {}

  scope(user: AuthUser, alias = ''): { sql: string; params: unknown[] } {
    if (user.role === 'SUPER_ADMIN') return { sql: 'TRUE', params: [] };
    if (!user.organizationId) return { sql: 'FALSE', params: [] };
    return { sql: `${alias ? `${alias}.` : ''}organization_id = $1`, params: [user.organizationId] };
  }

  organization(user: AuthUser, requested?: string): string {
    if (user.role === 'SUPER_ADMIN' && requested) return requested;
    if (!user.organizationId) throw new BadRequestException('Pengguna belum ditempatkan pada organisasi.');
    return user.organizationId;
  }

  async ensureFound<T>(rows: T[]): Promise<T> {
    if (!rows[0]) throw new NotFoundException('Data tidak ditemukan atau berada di luar lingkup akses Anda.');
    return rows[0];
  }
}
