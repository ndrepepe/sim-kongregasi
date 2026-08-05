import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { AuthUser } from './auth.types';

interface UserRow {
  id: string; email: string; full_name: string; password_hash: string; role: AuthUser['role'];
  organization_id: string | null; sister_id: string | null; is_active: boolean; locked_until: Date | null; must_change_password: boolean;
  access_valid_from: string; access_valid_to: string | null;
}

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService, private readonly jwt: JwtService, private readonly config: ConfigService) {}

  async login(email: string, password: string) {
    const result = await this.db.query<UserRow>('SELECT * FROM users WHERE lower(email) = lower($1)', [email.trim()]);
    const user = result.rows[0];
    const today=new Date().toISOString().slice(0,10);
    if (!user || !user.is_active || user.access_valid_from>today || (user.access_valid_to&&user.access_valid_to<today) || (user.locked_until && user.locked_until > new Date())) {
      throw new UnauthorizedException('Email atau kata sandi tidak valid.');
    }
    if (!(await compare(password, user.password_hash))) {
      await this.db.query(`UPDATE users SET failed_login_count = failed_login_count + 1,
        locked_until = CASE WHEN failed_login_count + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END WHERE id = $1`, [user.id]);
      throw new UnauthorizedException('Email atau kata sandi tidak valid.');
    }
    await this.db.query('UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = now() WHERE id = $1', [user.id]);
    const payload: AuthUser = { sub: user.id, email: user.email, name: user.full_name, role: user.role, organizationId: user.organization_id, sisterId:user.sister_id, mustChangePassword: user.must_change_password };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: this.config.get('ACCESS_TOKEN_TTL', '15m') });
    const rawRefresh = randomBytes(48).toString('base64url');
    const days = this.config.get<number>('REFRESH_TOKEN_DAYS', 7);
    await this.db.query('INSERT INTO refresh_tokens(user_id, token_hash, expires_at) VALUES($1, $2, now() + ($3 || \' days\')::interval)', [user.id, this.digest(rawRefresh), days]);
    return { user: payload, accessToken, refreshToken: rawRefresh, refreshDays: days };
  }

  async refresh(rawToken: string) {
    const result = await this.db.query<UserRow & { token_id: string }>(`SELECT u.*, rt.id token_id FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
      WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL AND rt.expires_at > now() AND u.is_active
        AND u.access_valid_from<=current_date AND (u.access_valid_to IS NULL OR u.access_valid_to>=current_date)`, [this.digest(rawToken)]);
    const user = result.rows[0];
    if (!user) throw new UnauthorizedException('Sesi tidak valid.');
    const payload: AuthUser = { sub: user.id, email: user.email, name: user.full_name, role: user.role, organizationId: user.organization_id, sisterId:user.sister_id, mustChangePassword: user.must_change_password };
    return { accessToken: await this.jwt.signAsync(payload, { expiresIn: this.config.get('ACCESS_TOKEN_TTL', '15m') }), user: payload };
  }

  async logout(rawToken?: string) {
    if (rawToken) await this.db.query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1', [this.digest(rawToken)]);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const result = await this.db.query<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];
    if (!user || !(await compare(currentPassword, user.password_hash))) throw new UnauthorizedException('Kata sandi saat ini salah.');
    await this.db.query('UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2', [await hash(newPassword, 12), userId]);
    await this.db.query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1', [userId]);
  }

  private digest(value: string) { return createHash('sha256').update(value).digest('hex'); }
}
