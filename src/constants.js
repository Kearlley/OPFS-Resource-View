// 文件扩展名常量
export const SQLITE_EXTS = ['.sqlite', '.db', '.sqlite3', '.db3'];
export const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];
export const TEXT_EXTS = ['.txt', '.log', '.json', '.md', '.csv', '.xml', '.yaml', '.yml', '.js', '.ts', '.html', '.css'];

// 分页大小常量
export const PAGE_SIZE = 50;

// 数据库 schema 相关常量
export const SCHEMA_TYPES = ['table', 'view', 'index', 'trigger'];
export const SCHEMA_TYPE_ORDER_SQL = SCHEMA_TYPES.map((type, idx) => `WHEN '${type}' THEN ${idx + 1}`).join(' ');
export const SCHEMA_TYPE_IN_SQL = SCHEMA_TYPES.map((type) => `'${type}'`).join(',');
