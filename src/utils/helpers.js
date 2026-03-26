import { SQLITE_EXTS, IMAGE_EXTS, TEXT_EXTS } from '../constants';

function createExtensionChecker(extensions) {
  return (name = '') => extensions.some((ext) => name.toLowerCase().endsWith(ext));
}

export const isSqlite = createExtensionChecker(SQLITE_EXTS);
export const isImage = createExtensionChecker(IMAGE_EXTS);
export const isText = createExtensionChecker(TEXT_EXTS);

// SQL 标识符处理函数
export function qIdent(v) {
  return `"${String(v).replaceAll('"', '""')}"`;
}

export function qQualified(dbName, objName) {
  return `${qIdent(dbName)}.${qIdent(objName)}`;
}

// SQLite 头部读取函数
export function readSqliteHeader(bytes) {
  if (!bytes || bytes.length < 16) return '';
  return String.fromCharCode(...bytes.slice(0, 16));
}

// 树结构扁平化函数
export function flattenTree(nodes, out = []) {
  for (const node of nodes || []) {
    out.push(node);
    if (node.kind === 'directory') {
      flattenTree(node.children || [], out);
    }
  }
  return out;
}

// 触发器元数据解析函数
export function parseTriggerMeta(sql = '') {
  const normalized = String(sql || '').replace(/\s+/g, ' ').trim();
  const timingMatch = normalized.match(/\b(BEFORE|AFTER|INSTEAD\s+OF)\b/i);
  const eventMatch = normalized.match(/\b(INSERT|UPDATE|DELETE)\b/i);
  const whenMatch = normalized.match(/\bWHEN\b([\s\S]*?)\bBEGIN\b/i);

  return {
    timing: timingMatch ? timingMatch[1].toUpperCase().replace(/\s+/g, ' ') : '',
    event: eventMatch ? eventMatch[1].toUpperCase() : '',
    whenExpr: whenMatch ? whenMatch[1].trim() : ''
  };
}
