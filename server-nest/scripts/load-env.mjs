import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env');
const envExamplePath = resolve(process.cwd(), '.env.example');

// 作用：脚本和应用保持一致，优先读取 .env；缺失时兜底读取 .env.example。
config({ path: existsSync(envPath) ? envPath : envExamplePath, quiet: true });
