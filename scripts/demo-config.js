import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export function validateDemoDatabase(database) {
  if (!/^[a-zA-Z0-9_]+_demo$/.test(database || '')) throw new Error('O banco de demonstração precisa ter um nome terminado em _demo.');
}
export function loadDemoConfig() {
  const result = dotenv.config({ path: path.join(projectRoot, '.env.demo'), override: true });
  if (result.error) throw new Error('Crie .env.demo a partir de .env.demo.example.');
  validateDemoDatabase(process.env.DB_NAME);
  if (!process.env.DEMO_ADMIN_PASSWORD) throw new Error('Defina DEMO_ADMIN_PASSWORD em .env.demo.');
  process.env.DEMO_MODE = '1';
  process.env.NODE_ENV = 'development';
  process.env.APP_HOST = '127.0.0.1';
  return { host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root', password: process.env.DB_PASS || '', database: process.env.DB_NAME };
}
