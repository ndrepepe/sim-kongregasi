import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthUser } from './auth.types';
import { CurrentUser } from './current-user.decorator';
import { Public } from './public.decorator';

class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
}
class ChangePasswordDto {
  @IsString() currentPassword!: string;
  @IsString() @MinLength(12) newPassword!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public() @Post('login') @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(dto.email, dto.password);
    this.cookies(response, result.accessToken, result.refreshToken, result.refreshDays);
    return { user: result.user };
  }

  @Public() @Post('refresh') @HttpCode(200)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.refresh(request.cookies?.refresh_token ?? '');
    response.cookie('access_token', result.accessToken, this.cookieOptions(15 * 60 * 1000));
    return { user: result.user };
  }

  @Post('logout') @HttpCode(204)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(request.cookies?.refresh_token);
    response.clearCookie('access_token'); response.clearCookie('refresh_token');
  }

  @Get('me') me(@CurrentUser() user: AuthUser) { return user; }

  @Post('change-password') @HttpCode(204)
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto, @Res({ passthrough: true }) response: Response) {
    await this.auth.changePassword(user.sub, dto.currentPassword, dto.newPassword);
    response.clearCookie('access_token'); response.clearCookie('refresh_token');
  }

  private cookies(response: Response, access: string, refresh: string, days: number) {
    response.cookie('access_token', access, this.cookieOptions(15 * 60 * 1000));
    response.cookie('refresh_token', refresh, this.cookieOptions(days * 86_400_000));
  }
  private cookieOptions(maxAge: number) { return { httpOnly: true, sameSite: 'strict' as const, secure: process.env.NODE_ENV === 'production', maxAge, path: '/' }; }
}
