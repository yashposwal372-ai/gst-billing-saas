import { DomainError } from '../../domain/errors/domain-error.js';

export type ErrorResponseDetails = readonly unknown[] | Readonly<Record<string, unknown>>;

export type ErrorResponse = Readonly<{
  code: string;
  message: string;
  requestId?: string;
  details?: ErrorResponseDetails;
}>;

const DEFAULT_CODE = 'INTERNAL_ERROR';
const DEFAULT_MESSAGE = 'Unable to complete request';

export function createErrorResponse(error: unknown, requestId?: string): ErrorResponse {
  if (error instanceof DomainError) {
    return {
      code: error.code,
      message: error.message,
      ...(requestId ? { requestId } : {}),
      ...(error.details === undefined ? {} : { details: error.details }),
    };
  }

  return {
    code: DEFAULT_CODE,
    message: DEFAULT_MESSAGE,
    ...(requestId ? { requestId } : {}),
  };
}
