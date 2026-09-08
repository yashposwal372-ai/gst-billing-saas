import { z } from "zod";

export const email = z.string().trim().toLowerCase().email().max(254);
export const password = z.string().min(12, "Use at least 12 characters").max(128);
export const loginSchema = z.object({ email, password });
export const signupSchema = loginSchema.extend({
  firstName: z.string().trim().min(1, "Enter your first name").max(80),
  lastName: z.string().trim().min(1, "Enter your last name").max(80),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });
export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Enter a valid token");
export const resetSchema = z.object({ token: tokenSchema, password, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

const optionalText = (max: number) => z.string().trim().max(max);
const optionalPattern = (pattern: RegExp, message: string) => z.string().trim().refine((value) => !value || pattern.test(value), message);
export const businessFields = z.object({
  name: z.string().trim().min(2).max(160), tradeName: optionalText(160),
  ownerName: z.string().trim().min(2).max(160),
  businessType: z.enum(["PROPRIETORSHIP", "PARTNERSHIP", "LLP", "PRIVATE_LIMITED", "OTHER"]),
  mobile: z.string().regex(/^\+?[1-9]\d{9,14}$/, "Enter a valid mobile number"), email,
  addressLine1: z.string().trim().min(3).max(200), addressLine2: optionalText(200),
  state: z.string().trim().min(2).max(80), stateCode: z.string().regex(/^(0[1-9]|[12][0-9]|3[0-8])$/, "Enter a two-digit state code"),
  city: z.string().trim().min(2).max(80), pincode: z.string().regex(/^[1-9][0-9]{5}$/, "Enter a six-digit pincode"),
  gstRegistered: z.boolean(),
  gstin: optionalPattern(/^[0-9]{2}[A-Z]{3}[ABCFGHLJPT][A-Z][0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a valid GSTIN format"),
  pan: optionalPattern(/^[A-Z]{3}[ABCFGHLJPT][A-Z][0-9]{4}[A-Z]$/, "Enter a valid PAN format"),
  invoicePrefix: z.string().regex(/^[A-Z][A-Z0-9-]{0,11}$/, "Use up to 12 uppercase letters, digits or hyphens"),
  financialYear: z.string().regex(/^20[0-9]{2}-[0-9]{2}$/, "Use YYYY-YY, for example 2026-27")
    .refine((value) => value.slice(5) === String((Number(value.slice(0, 4)) + 1) % 100).padStart(2, "0"), "Use consecutive years"),
  gstMode: z.enum(["EXCLUSIVE", "INCLUSIVE", "NOT_APPLICABLE"]),
  bankName: optionalText(120), accountHolder: optionalText(160),
  accountNumber: optionalPattern(/^[0-9]{6,34}$/, "Use 6–34 digits"),
  ifsc: optionalPattern(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid IFSC format"),
  upiId: optionalPattern(/^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9.-]{1,34}$/, "Enter a valid UPI ID format"),
});
export const businessSchema = businessFields.superRefine((data, ctx) => {
  const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (data.gstRegistered) {
    if (!data.gstin) issue("gstin", "GSTIN is required");
    if (data.gstin && data.gstin.slice(0, 2) !== data.stateCode) issue("gstin", "GSTIN state code must match your address");
    if (data.pan && data.gstin.slice(2, 12) !== data.pan) issue("pan", "PAN must match GSTIN");
    if (data.gstMode === "NOT_APPLICABLE") issue("gstMode", "Choose a GST mode");
  } else if (data.gstin || data.gstMode !== "NOT_APPLICABLE") issue("gstin", "GSTIN does not apply to non-GST businesses");
  const bank = [data.bankName, data.accountHolder, data.accountNumber, data.ifsc];
  if (bank.some(Boolean) && !bank.every(Boolean)) issue("bankName", "Complete all four bank fields or leave them empty");
});
export type BusinessInput = z.infer<typeof businessFields>;
export type Business = BusinessInput & { id: string; onboardingCompletedAt: string };
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    result[key] ??= issue.message;
  }
  return result;
}
