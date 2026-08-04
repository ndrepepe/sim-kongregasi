import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';
import { AuthUser } from './auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<Request & { user: AuthUser }>();
    const bearer = request.headers.authorization?.startsWith('Bearer ') ? request.headers.authorization.slice(7) : undefined;
    const token = request.cookies?.access_token ?? bearer;
    if (!token) throw new UnauthorizedException('Sesi tidak ditemukan. Silakan masuk kembali.');
    try {
      request.user = await this.jwt.verifyAsync<AuthUser>(token);
      const permittedWhileChanging = ['/api/auth/me', '/api/auth/change-password', '/api/auth/logout'];
      if (request.user.mustChangePassword && !permittedWhileChanging.includes(request.path)) {
        throw new ForbiddenException('Kata sandi awal wajib diganti sebelum menggunakan aplikasi.');
      }
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new UnauthorizedException('Sesi telah berakhir. Silakan masuk kembali.');
    }
  }
}
