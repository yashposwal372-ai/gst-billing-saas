import { z } from "zod";

const apiUrlSchema = z
  .url()
  .refine(
    (value) => ["http:", "https:"].includes(new URL(value).protocol),
    "API URL must use HTTP or HTTPS",
  );

export function getApiBaseUrl(): string {
  return apiUrlSchema
    .parse(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1")
    .replace(/\/$/, "");
}
