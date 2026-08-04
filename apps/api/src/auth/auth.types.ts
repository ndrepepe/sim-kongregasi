export type AppRole = 'SUPER_ADMIN' | 'PIMPINAN' | 'SEKRETARIS' | 'BENDAHARA' | 'KESEHATAN' | 'ARSIPARIS' | 'UNIT_ADMIN' | 'AUDITOR' | 'VIEWER';

export interface AuthUser {
  sub: string;
  email: string;
  name: string;
  role: AppRole;
  organizationId: string | null;
  mustChangePassword: boolean;
}
