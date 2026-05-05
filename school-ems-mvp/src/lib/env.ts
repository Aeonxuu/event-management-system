import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().min(1).default("7d"),
  AUTH_COOKIE_NAME: z.string().min(1).default("school_ems_token"),
  APP_URL: z.string().url().default("http://localhost:3000"),
});

let cachedEnv: ReturnType<typeof envSchema.parse> | null = null;

function parseEnv() {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse({
    MONGODB_URI: process.env.MONGODB_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
    AUTH_COOKIE_NAME: process.env.AUTH_COOKIE_NAME,
    APP_URL: process.env.APP_URL,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid environment variables: ${issues}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

// Lazy parse - export a getter function instead
export const env = new Proxy({} as any, {
  get(_target: any, prop: string | symbol) {
    const envData = parseEnv();
    return envData[prop as keyof typeof envData];
  },
});
