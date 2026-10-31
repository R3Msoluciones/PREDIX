import { z } from "zod";
import { logger } from "../logger";

const envSchema = z.object({
  JWT_SECRET: z.string().min(1, "JWT_SECRET es obligatoria"),
  VAULT_MASTER_KEY: z.string().min(1, "VAULT_MASTER_KEY es obligatoria"),
  DATABASE_URL: z.string().optional().default(""),
  OWNER_OPEN_ID: z.string().optional().default(""),
  BUILT_IN_FORGE_API_URL: z.string().optional().default(""),
  BUILT_IN_FORGE_API_KEY: z.string().optional().default(""),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_API_URL: z.string().optional().default("https://generativelanguage.googleapis.com/v1beta/openai"),
  NODE_ENV: z.string().optional().default("development"),
  PORT: z.string().optional().default("3000"),
  UPLOADS_DIR: z.string().optional().default("./data/uploads"),
  VITE_FRONTEND_URL: z.string().optional().default(""),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    logger.error(`[ENV] Variables de entorno inválidas:\n${missing}`);
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
    logger.warn("[ENV] Continuando en modo degradado (desarrollo)");
    return envSchema.parse({
      ...process.env,
      JWT_SECRET: process.env.JWT_SECRET || "dev-jwt-secret-not-for-production",
      VAULT_MASTER_KEY: process.env.VAULT_MASTER_KEY || "dev-vault-key-not-for-production",
    });
  }
  return result.data;
}

const validated = parseEnv();

export const ENV = {
  cookieSecret: validated.JWT_SECRET,
  vaultMasterKey: validated.VAULT_MASTER_KEY,
  databaseUrl: validated.DATABASE_URL,
  ownerOpenId: validated.OWNER_OPEN_ID,
  isProduction: validated.NODE_ENV === "production",
  forgeApiUrl: validated.BUILT_IN_FORGE_API_URL,
  forgeApiKey: validated.BUILT_IN_FORGE_API_KEY,
  geminiApiKey: validated.GEMINI_API_KEY,
  geminiApiUrl: validated.GEMINI_API_URL,
  port: parseInt(validated.PORT),
  uploadsDir: validated.UPLOADS_DIR,
  frontendUrl: validated.VITE_FRONTEND_URL,
};
