import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { DatabaseService } from '../database/database.service';
import { AuthUser } from '../auth/auth.types';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly db: DatabaseService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<any>();
    if (!request || request.method === 'GET' || request.path?.includes('/auth/login')) return next.handle();
    const user = request.user as AuthUser | undefined;
    const safeBody = this.redact(request.body);
    return next.handle().pipe(tap(() => {
      void this.db.query(
        `INSERT INTO audit_logs(user_id, organization_id, action, entity_type, method, path, ip_address, user_agent, after_data)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [user?.sub ?? null, user?.organizationId ?? null, request.method, this.entity(request.path), request.method,
          request.originalUrl, request.ip, request.headers['user-agent'] ?? null, safeBody]
      ).catch(() => undefined);
    }));
  }

  private entity(path = '') { return path.split('/').filter(Boolean).slice(1, 2)[0] ?? 'system'; }
  private redact(body: unknown) {
    if (!body || typeof body !== 'object') return null;
    const copy = { ...(body as Record<string, unknown>) };
    for (const key of Object.keys(copy)) if (/password|token|secret|identifier|nik|passport|bpjs|policy/i.test(key)) copy[key] = '[REDACTED]';
    return copy;
  }
}
