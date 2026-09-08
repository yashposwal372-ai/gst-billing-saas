import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';
import { AuthGuard } from './guards/auth.guard.js';
import { BrowserWriteGuard } from './guards/browser-write.guard.js';

@Module({
  imports: [DatabaseModule], controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService, AuthGuard, BrowserWriteGuard],
  exports: [AuthService, AuthGuard, BrowserWriteGuard, TokenService],
})
export class AuthModule {}
