export type DomainErrorDetails = Readonly<Record<string, unknown>> | readonly unknown[];

export type DomainErrorOptions = Readonly<{
  details?: DomainErrorDetails;
  cause?: unknown;
}>;

export class DomainError extends Error {
  readonly code: string;
  readonly details?: DomainErrorDetails;
  override readonly cause?: unknown;

  constructor(code: string, message: string, options: DomainErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = 'DomainError';
    this.code = code;
    this.details = options.details;
    this.cause = options.cause;
  }

  toJSON(): { code: string; message: string; details?: DomainErrorDetails } {
    return {
      code: this.code,
      message: this.message,
      ...(this.details === undefined ? {} : { details: this.details }),
    };
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
