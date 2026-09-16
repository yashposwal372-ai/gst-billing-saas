import type { Prisma } from '@gst/prisma-client/client';

export const safeUserSelect = {
  id: true, email: true, firstName: true, lastName: true, mobile: true,
  emailVerifiedAt: true, currentBusinessId: true,
} satisfies Prisma.UserSelect;
export type SafeUser = Prisma.UserGetPayload<{ select: typeof safeUserSelect }>;
export type AuthContext = { user: SafeUser; sessionId: string };
