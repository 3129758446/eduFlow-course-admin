/* 
模块：SQLite 连接
定位：初始化 better-sqlite3 连接与基础 PRAGMA 配置
用法：其他模块直接 import db 执行同步 SQL
*/
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../../data/homework.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export default db;
