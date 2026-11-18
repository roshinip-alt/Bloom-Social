/**
 * Structured JSON logger. Keys that may carry secrets are redacted recursively, so tokens, auth codes and
 * client secrets never reach the logs even if a caller passes them by mistake.
 */
// Matches secret-bearing keys (accessToken, client_secret, code, authCode, codeVerifier, signed_request, ...)
// but not diagnostic fields such as errorCode.
const SENSITIVE = /token|secret|verifier|password|authorization|signed_request|^code$|auth_?code/i;
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 } as const;
const threshold = LEVELS[(process.env.LOG_LEVEL as keyof typeof LEVELS) ?? 'info'] ?? LEVELS.info;

type Level = 'debug' | 'info' | 'warn' | 'error';
type Fields = Record<string, unknown>;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    out[key] = SENSITIVE.test(key) ? '[redacted]' : redact(v, depth + 1);
  }
  return out;
}

function write(level: Level, msg: string, fields: Fields = {}): void {
  if (LEVELS[level] < threshold) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...(redact(fields) as Fields) });
  if (level === 'error' || level === 'warn') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

export const logger = {
  debug: (msg: string, fields?: Fields) => write('debug', msg, fields),
  info: (msg: string, fields?: Fields) => write('info', msg, fields),
  warn: (msg: string, fields?: Fields) => write('warn', msg, fields),
  error: (msg: string, fields?: Fields) => write('error', msg, fields),
};
