// 文件作用：加载本地环境变量配置，为应用启动和 MySQL 连接提供统一配置来源。
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env');
const envExamplePath = resolve(process.cwd(), '.env.example');

// 作用：本地优先读取 .env；如果用户只配置了 .env.example，也能按该文件启动和创建 MySQL 数据库。
config({ path: existsSync(envPath) ? envPath : envExamplePath, quiet: true });
