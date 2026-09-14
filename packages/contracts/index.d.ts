/** Public API metadata. Internal /internal/v1 routes do not exist yet. */
export type PublicApiVersion = 'v1';
export type PublicApiPrefix = '/api/v1';
/** Current common bounded-list envelope. POS filtered counts currently describe the page. */
export interface Page<T> { items: T[]; page: number; pageSize: number; total: number; totalPages: number }
/** Matches the current HTTP filter, including class-validator failures. */
export interface LegacyError { statusCode: number; message: string | string[]; error?: string }
/** A03 compatible future envelope; not the current global error filter. */
export type ErrorResponse = Readonly<{ code: string; message: string; requestId?: string; details?: readonly unknown[] | Readonly<Record<string, unknown>> }>;
export interface BrowserWriteHeaders { 'X-CSRF-Protection': '1'; Origin: string }
/** Semantic aliases, not runtime validators. Actual formats live in the OpenAPI snapshot. */
export type DecimalString = string;
export type BusinessDate = string;
export type IsoTimestamp = string;
