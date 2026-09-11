import { describe, expect, it } from 'vitest';
import { DomainError } from '../../domain/errors/domain-error.js';
import { createErrorResponse } from './error-response.js';

describe('createErrorResponse', () => {
  it('serializes domain errors safely with requestId and details', () => {
    expect(createErrorResponse(new DomainError('INVOICE_INVALID_STATE', 'Invoice cannot be finalized', { details: [{ field: 'status' }] }), 'req-1')).toEqual({
      code: 'INVOICE_INVALID_STATE',
      message: 'Invoice cannot be finalized',
      requestId: 'req-1',
      details: [{ field: 'status' }],
    });
  });

  it('does not expose unknown error internals', () => {
    expect(createErrorResponse(new Error('SQL stack detail'), 'req-2')).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Unable to complete request',
      requestId: 'req-2',
    });
  });
});
