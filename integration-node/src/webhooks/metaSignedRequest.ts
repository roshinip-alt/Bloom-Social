import { createHmac, timingSafeEqual } from 'node:crypto';

export interface SignedRequestPayload {
  algorithm?: string;
  user_id?: string;
  issued_at?: number;
}

/**
 * Verifies a Meta `signed_request` ("<base64url sig>.<base64url payload>", HMAC-SHA256 with the app secret).
 * Returns the payload, or null when the signature or algorithm is wrong.
 */
export function verifySignedRequest(signedRequest: string, appSecret: string): SignedRequestPayload | null {
  if (!appSecret) return null;
  const [encodedSig, payload] = signedRequest.split('.', 2);
  if (!encodedSig || !payload) return null;
  const expected = createHmac('sha256', appSecret).update(payload).digest();
  const given = Buffer.from(encodedSig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SignedRequestPayload;
    return data.algorithm?.toUpperCase() === 'HMAC-SHA256' ? data : null;
  } catch {
    return null;
  }
}

/** Builds a signed_request — used by tests and local tooling. */
export function signRequest(payload: SignedRequestPayload, appSecret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', appSecret).update(body).digest('base64url');
  return `${sig}.${body}`;
}
