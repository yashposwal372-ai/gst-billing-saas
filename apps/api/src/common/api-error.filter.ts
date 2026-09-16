import { Catch, HttpException, Logger, type ExceptionFilter, type ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '@gst/prisma-client/client';

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (error instanceof HttpException) {
      const body = error.getResponse();
      res.status(error.getStatus()).json(typeof body === 'string' ? { statusCode: error.getStatus(), message: body } : body);
      return;
    }
    const conflict = error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code);
    const unavailable = error instanceof Prisma.PrismaClientInitializationError ||
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code.startsWith('P10'));
    const status = conflict ? 409 : unavailable ? 503 : 500;
    this.logger.error({ event: 'request.failed', status, type: error instanceof Error ? error.name : 'unknown' });
    res.status(status).json({ statusCode: status, message: conflict ? 'Conflicting request. Please retry.' :
      unavailable ? 'Service temporarily unavailable' : 'Unable to complete request' });
  }
}
