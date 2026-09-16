import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { PartyInternalContext } from './internal-context.guard.js';

export const CurrentInternalContext = createParamDecorator((_data: unknown, context: ExecutionContext): PartyInternalContext =>
  context.switchToHttp().getRequest<{ internalContext: PartyInternalContext }>().internalContext);
