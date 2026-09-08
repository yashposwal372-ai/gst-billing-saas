import { Body, Controller, Get, Post, Req, Res, UseGuards, HttpCode, Header, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { SignupDto, LoginDto, EmailDto, ResetPasswordDto, TokenDto } from './dto/auth.dto.js';
import { AuthGuard } from './guards/auth.guard.js';
import { BrowserWriteGuard } from './guards/browser-write.guard.js';
import { CurrentAuth } from './decorators/current-auth.js';
import type { AuthContext } from '../users/user.select.js';
import { cookieNames, readCookie, setAuthCookies, clearAuthCookies } from './auth.cookies.js';

@Controller('auth')
@UseGuards(BrowserWriteGuard)
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly config: ConfigService) {}
  private get production() { return this.config.get('NODE_ENV') === 'production'; }

  @Post('signup')
  async signup(@Body() dto: SignupDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.signup(dto);
    setAuthCookies(res, this.production, result.access, result.refresh, result.expiresAt);
    return { user: result.user, emailDelivery: 'not_configured' };
  }
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto);
    setAuthCookies(res, this.production, result.access, result.refresh, result.expiresAt);
    return { user: result.user };
  }
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const result = await this.auth.refresh(readCookie(req, cookieNames(this.production).refresh));
      setAuthCookies(res, this.production, result.access, result.refresh, result.expiresAt);
      return { status: 'ok' };
    } catch (error) {
      if (error instanceof UnauthorizedException) clearAuthCookies(res, this.production);
      throw error;
    }
  }
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const names = cookieNames(this.production);
    await this.auth.logout(readCookie(req, names.refresh), readCookie(req, names.access));
    clearAuthCookies(res, this.production);
    return { status: 'ok' };
  }
  @Get('me')
  @UseGuards(AuthGuard)
  @Header('Cache-Control', 'no-store')
  me(@CurrentAuth() context: AuthContext) { return { user: context.user }; }

  @Post('forgot-password')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async forgot(@Body() dto: EmailDto) {
    await this.auth.issueOneTimeToken(dto.email, 'reset');
    return { message: 'If an eligible account exists, a reset request has been prepared. Email delivery is not configured.' };
  }
  @Post('reset-password')
  @HttpCode(200)
  async reset(@Body() dto: ResetPasswordDto, @Res({ passthrough: true }) res: Response) {
    await this.auth.resetPassword(dto.token, dto.password);
    clearAuthCookies(res, this.production);
    return { message: 'Password changed. Sign in again.' };
  }
  @Post('verify-email')
  @HttpCode(200)
  async verify(@Body() dto: TokenDto) {
    await this.auth.verifyEmail(dto.token);
    return { message: 'Email address verified.' };
  }
  @Post('request-verification')
  @UseGuards(AuthGuard)
  @HttpCode(200)
  async requestVerification(@CurrentAuth() context: AuthContext) {
    await this.auth.issueOneTimeToken(context.user.email, 'verify');
    return { message: 'Verification request prepared. Email delivery is not configured.' };
  }
}
