import { z } from 'zod';

/** Environment configuration, validated once at startup. Secrets are optional so the service runs without them. */
const schema = z.object({
  PORT: z.coerce.number().int().positive().default(8090),
  BACKEND_URL: z.string().url().default('http://localhost:8080'),
  APP_PUBLIC_URL: z.string().url().default('http://localhost:5173'),
  INTERNAL_API_TOKEN: z.string().default(''),
  HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  INSTAGRAM_APP_ID: z.string().default(''),
  INSTAGRAM_APP_SECRET: z.string().default(''),
  INSTAGRAM_GRAPH_API_VERSION: z.string().default('v27.0'),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  TIKTOK_CLIENT_KEY: z.string().default(''),
  TIKTOK_CLIENT_SECRET: z.string().default(''),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return schema.parse(source);
}
