import { describe, expect, it } from 'vitest';
import { DomainError, isDomainError } from './domain-error.js';

describe('DomainError', () => {
  it('retains stable code, safe message and details', () => {
    const error = new DomainError('CATALOGUE_DUPLICATE_SKU', 'SKU already exists', { details: { field: 'sku' } });

    expect(error.code).toBe('CATALOGUE_DUPLICATE_SKU');
    expect(error.message).toBe('SKU already exists');
    expect(error.details).toEqual({ field: 'sku' });
    expect(error.toJSON()).toEqual({ code: 'CATALOGUE_DUPLICATE_SKU', message: 'SKU already exists', details: { field: 'sku' } });
  });

  it('keeps cause internal and detects domain errors without framework dependencies', () => {
    const cause = new Error('database detail');
    const error = new DomainError('PAYMENT_REJECTED', 'Payment could not be posted', { cause });

    expect(isDomainError(error)).toBe(true);
    expect(error.cause).toBe(cause);
    expect(error.toJSON()).toEqual({ code: 'PAYMENT_REJECTED', message: 'Payment could not be posted' });
  });
});
