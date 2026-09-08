import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthContext } from '../../users/user.select.js';

export const CurrentAuth = createParamDecorator((_data: unknown, context: ExecutionContext): AuthContext =>
  context.switchToHttp().getRequest<{ auth: AuthContext }>().auth);
