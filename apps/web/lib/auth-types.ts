export type User = {
  id: string; email: string; firstName: string; lastName: string; mobile: string | null;
  emailVerifiedAt: string | null; currentBusinessId: string | null;
};
export type AuthResult = { user: User };
