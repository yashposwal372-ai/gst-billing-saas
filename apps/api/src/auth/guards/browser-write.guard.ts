import { Injectable, ForbiddenException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class BrowserWriteGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    // Mandatory custom header forces preflight; exact Origin rejects sibling-site CSRF.
    if (req.get('Origin') !== this.config.get<string>('FRONTEND_URL') ||
        req.get('X-CSRF-Protection') !== '1') {
      throw new ForbiddenException('Untrusted request origin');
    }
    return true;
  }
}
