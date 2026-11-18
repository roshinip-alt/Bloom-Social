import { describe, expect, it } from 'vitest';
import { redact } from '../src/config/logger.js';

describe('logger redaction', () => {
  it('redacts secrets at any depth', () => {
    expect(redact({ accessToken: 'x', nested: { refresh_token: 'y', ok: 1 }, list: [{ code: 'z' }], provider: 'instagram' })).toEqual({
      accessToken: '[redacted]', nested: { refresh_token: '[redacted]', ok: 1 }, list: [{ code: '[redacted]' }], provider: 'instagram',
    });
  });

  it('keeps diagnostic fields such as errorCode', () => {
    expect(redact({ errorCode: 'IG_RATE_LIMITED', codeVerifier: 'v', client_secret: 's' })).toEqual({
      errorCode: 'IG_RATE_LIMITED', codeVerifier: '[redacted]', client_secret: '[redacted]',
    });
  });
});
