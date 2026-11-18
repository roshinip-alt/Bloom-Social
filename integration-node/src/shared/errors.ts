/**
 * Error categories shared with the Java service (GatewayException.Category). The category decides retry policy:
 * AUTH_INVALID and PERMISSION are never retried — the owner must reconnect.
 */
export type ErrorCategory =
  | 'AUTH_INVALID'
  | 'PERMISSION'
  | 'RATE_LIMITED'
  | 'TRANSIENT'
  | 'BAD_RESPONSE'
  | 'NOT_CONFIGURED'
  | 'UNREACHABLE';

const HTTP_STATUS: Record<ErrorCategory, number> = {
  AUTH_INVALID: 401,
  PERMISSION: 403,
  RATE_LIMITED: 429,
  TRANSIENT: 502,
  BAD_RESPONSE: 502,
  NOT_CONFIGURED: 503,
  UNREACHABLE: 504,
};

export class IntegrationError extends Error {
  constructor(
    readonly category: ErrorCategory,
    readonly code: string,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'IntegrationError';
  }

  get httpStatus(): number {
    return HTTP_STATUS[this.category];
  }

  get retryable(): boolean {
    return this.category === 'RATE_LIMITED' || this.category === 'TRANSIENT' || this.category === 'UNREACHABLE';
  }

  /** Wire format understood by the Java gateway client. */
  toBody() {
    return {
      code: this.code,
      category: this.category,
      message: this.message,
      retryAfterSeconds: this.retryAfterSeconds ?? null,
    };
  }
}

export function notConfigured(provider: string, missing: string[]): IntegrationError {
  return new IntegrationError(
    'NOT_CONFIGURED',
    'PROVIDER_NOT_CONFIGURED',
    `${provider} is not configured. Missing: ${missing.join(', ')}. See docs/integrations.`,
  );
}
