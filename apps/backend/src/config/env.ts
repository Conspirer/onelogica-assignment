import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/onelogica"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  FIREBASE_PROJECT_ID: z.string().default("onelogica-dev-project"),
  FIREBASE_CLIENT_EMAIL: z.string().default(""),
  FIREBASE_PRIVATE_KEY: z.string().default(""),
  FRONTEND_ORIGIN: z.string().default("http://localhost:3000"),
});

export const env = envSchema.parse(process.env);
