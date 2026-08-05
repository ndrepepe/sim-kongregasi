export type AppRole = 'SUPER_ADMIN' | 'PIMPINAN' | 'DEWAN' | 'SUPERIOR_LOCAL' | 'SEKRETARIS' | 'BENDAHARA' | 'MAGISTRA' | 'KESEHATAN' | 'ARSIPARIS' | 'SAFEGUARDING' | 'AUDITOR' | 'ADMIN_TI' | 'SUSTER' | 'UNIT_ADMIN' | 'VIEWER';

export interface AuthUser {
  sub: string;
  email: string;
  name: string;
  role: AppRole;
  organizationId: string | null;
  sisterId: string | null;
  mustChangePassword: boolean;
}
