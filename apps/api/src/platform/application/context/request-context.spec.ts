import { describe, expect, it } from 'vitest';
import { createRequestContext, requireBusinessContext } from './request-context.js';

describe('RequestContext', () => {
  it('creates an immutable authenticated business context', () => {
    const context = createRequestContext({
      actor: { userId: 'user-1', businessId: 'business-1', role: 'OWNER', sessionId: 'session-1' },
      requestId: 'request-1',
      correlationId: 'correlation-1',
      traceId: 'trace-1',
    });

    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context.actor)).toBe(true);
    expect(requireBusinessContext(context)).toEqual({ userId: 'user-1', businessId: 'business-1', role: 'OWNER', sessionId: 'session-1' });
  });

  it('allows public/system contexts while making business context explicit', () => {
    expect(createRequestContext()).toEqual({ actor: undefined });
    expect(() => requireBusinessContext(createRequestContext({ actor: { userId: 'user-1' } }))).toThrow('Authenticated business context is required');
  });
});
