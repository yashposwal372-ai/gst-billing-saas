export type ActorRole = 'OWNER' | 'ADMIN' | 'STAFF' | 'SYSTEM' | string;

export type RequestActor = Readonly<{
  userId?: string;
  businessId?: string;
  role?: ActorRole;
  sessionId?: string;
}>;

export type RequestContext = Readonly<{
  actor?: RequestActor;
  requestId?: string;
  correlationId?: string;
  traceId?: string;
}>;

export function createRequestContext(context: RequestContext = {}): RequestContext {
  return Object.freeze({
    ...context,
    actor: context.actor ? Object.freeze({ ...context.actor }) : undefined,
  });
}

export function requireBusinessContext(context: RequestContext): Required<Pick<RequestActor, 'userId' | 'businessId' | 'role'>> & Pick<RequestActor, 'sessionId'> {
  const actor = context.actor;
  if (!actor?.userId || !actor.businessId || !actor.role) {
    throw new Error('Authenticated business context is required');
  }
  return {
    userId: actor.userId,
    businessId: actor.businessId,
    role: actor.role,
    ...(actor.sessionId ? { sessionId: actor.sessionId } : {}),
  };
}
