import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../app.module.js';
import { AuthService } from './auth.service.js';
import { readFileSync } from 'node:fs';

const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
try {
  const config = app.get(ConfigService);
  const host = new URL(config.getOrThrow<string>('DATABASE_URL')).hostname;
  if (config.get('NODE_ENV') === 'production' || !['localhost', '127.0.0.1', '[::1]'].includes(host))
    throw new Error('Local-only token utility: production and remote databases are prohibited');
  const [purpose, email] = process.argv.slice(2);
  if ((purpose !== 'reset' && purpose !== 'verify') || !email) throw new Error('Usage: auth:local-token -- reset|verify email');
  // Read reset passwords from redirected stdin, never arguments or terminal echo.
  if (purpose === 'reset' && process.stdin.isTTY) throw new Error('Provide the new password through redirected stdin');
  const password = purpose === 'reset' ? readFileSync(0, 'utf8').replace(/\r?\n$/, '') : '';
  if (purpose === 'reset' && (password.length < 12 || password.length > 128)) throw new Error('Password must contain 12 to 128 characters');
  const auth = app.get(AuthService);
  const token = await auth.issueOneTimeToken(email, purpose);
  if (!token) throw new Error('No eligible local account');
  if (purpose === 'reset') await auth.resetPassword(token, password);
  else await auth.verifyEmail(token);
  console.log('Local test operation completed (no email sent).');
} finally { await app.close(); }
