import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from backend directory or fallback to project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const configSchema = z.object({
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:3000'),

  // PostgreSQL
  DATABASE_URL: z.string().default('postgresql://postgres:postgrespassword@localhost:5432/hypothesiai'),
  DATABASE_SSL: z
    .string()
    .default('false')
    .transform((val) => val === 'true' || val === '1'),
  DATABASE_MAX_CONNECTIONS: z
    .string()
    .default('20')
    .transform((val) => parseInt(val, 10)),

  // Neo4j
  NEO4J_URI: z.string().default('bolt://localhost:7687'),
  NEO4J_USER: z.string().default('neo4j'),
  NEO4J_PASSWORD: z.string().default('hypothesiai_secret'),
  NEO4J_DATABASE: z.string().default('neo4j'),
  NEO4J_ENCRYPTED: z
    .string()
    .default('false')
    .transform((val) => val === 'true' || val === '1'),

  // AI Service
  AI_SERVICE_URL: z.string().default('http://127.0.0.1:8000'),

  // Storage
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_BUCKET: z.string().default('hypothesiai-papers'),
  STORAGE_REGION: z.string().default('us-east-1'),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  STORAGE_FORCE_PATH_STYLE: z
    .string()
    .default('false')
    .transform((val) => val === 'true' || val === '1'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .default('60000')
    .transform((val) => parseInt(val, 10)),
  RATE_LIMIT_MAX_REQUESTS: z
    .string()
    .default('120')
    .transform((val) => parseInt(val, 10)),

  // Auth
  JWT_SECRET: z.string().default('dev_jwt_secret_replace_in_production'),
  JWT_EXPIRES_IN: z.string().default('7d'),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:', parsed.error.format());
  throw new Error('Invalid environment configuration');
}

export const config = parsed.data;
export type Config = typeof config;
