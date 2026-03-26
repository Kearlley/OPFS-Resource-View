import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const SQLITE_EXTS = ['.sqlite', '.db', '.sqlite3', '.db3'];
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];
const TEXT_EXTS = ['.txt', '.log', '.json', '.md', '.csv', '.xml', '.yaml', '.yml', '.js', '.ts', '.html', '.css'];
const PAGE_SIZE = 50;
const SCHEMA_TYPES = ['table', 'view', 'index', 'trigger'];
const SCHEMA_TYPE_ORDER_SQL = SCHEMA_TYPES.map((type, idx) => `WHEN '${type}' THEN ${idx + 1}`).join(' ');
const SCHEMA_TYPE_IN_SQL = SCHEMA_TYPES.map((type) => `'${type}'`).join(',');
const emptySchemaGroups = createEmptySchemaGroups();

function createEmptySchemaGroups() {
  return Object.fromEntries(SCHEMA_TYPES.map((type) => [type, []]));
}

function isSqlite(name = '') {
  const lower = name.toLowerCase();
  return SQLITE_EXTS.some((ext) => lower.endsWith(ext));
}

function isImage(name = '') {
  const lower = name.toLowerCase();
  return IMAGE_EXTS.some((ext) => lower.endsWith(ext));
}

function isText(name = '') {
  const lower = name.toLowerCase();
  return TEXT_EXTS.some((ext) => lower.endsWith(ext));
}

function toBase64(bytes) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

function fromBase64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function qIdent(v) {
  return `"${String(v).replaceAll('"', '""')}"`;
}

function qQualified(dbName, objName) {
  return `${qIdent(dbName)}.${qIdent(objName)}`;
}

function readSqliteHeader(bytes) {
  if (!bytes || bytes.length < 16) return '';
  return String.fromCharCode(...bytes.slice(0, 16));
}

function getInspectedTabId() {
  const tabId = chrome?.devtools?.inspectedWindow?.tabId;
  if (typeof tabId !== 'number') {
    throw new Error('未找到 inspectedWindow.tabId，请在页面 DevTools 面板中使用插件');
  }
  return tabId;
}

function normalizeSendMessageError(message = '') {
  if (message.includes('Receiving end does not exist')) {
    return '目标页面未注入 content script。请刷新目标页面，或确认页面不是 chrome:// / edge:// / devtools:// 等受限地址';
  }
  if (message.includes('Cannot access contents of url')) {
    return '当前 URL 受限，扩展无法访问该页面内容';
  }
  return message || '发送消息失败';
}

async function opfsRequest(type, payload = {}) {
  const tabId = getInspectedTabId();
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type, ...payload }, (resp) => {
      if (chrome.runtime.lastError) {
        reject(new Error(normalizeSendMessageError(chrome.runtime.lastError.message || '')));
        return;
      }
      if (!resp?.ok) {
        reject(new Error(resp?.error || 'OPFS 请求失败'));
        return;
      }
      resolve(resp.result);
    });
  });
}

const inspectedFs = {
  getContextMeta() {
    return opfsRequest('opfs:ctx');
  },
  listTree() {
    return opfsRequest('opfs:list');
  },
  getFileCount() {
    return opfsRequest('opfs:fileCount');
  },
  readText(path) {
    return opfsRequest('opfs:readText', { path });
  },
  async readBytes(path) {
    return fromBase64(await opfsRequest('opfs:readBytes', { path }));
  },
  writeBytes(path, bytes) {
    return opfsRequest('opfs:writeBytes', { path, base64: toBase64(bytes) });
  },
  createEntry(parentPath, name, kind) {
    return opfsRequest('opfs:create', { parentPath, name, kind });
  },
  removeEntry(path, recursive) {
    return opfsRequest('opfs:remove', { path, recursive: !!recursive });
  }
};

async function writeExtensionOpfsFile(path, bytes) {
  const parts = path.split('/').filter(Boolean);
  let dir = await navigator.storage.getDirectory();
  for (let i = 0; i < parts.length - 1; i += 1) dir = await dir.getDirectoryHandle(parts[i], { create: true });
  const file = await dir.getFileHandle(parts[parts.length - 1], { create: true });
  const ws = await file.createWritable();
  await ws.write(bytes);
  await ws.close();
}

class SqliteWorker {
  constructor() {
    this.worker = null;
    this.seq = 0;
    this.dbId = null;
    this.pending = new Map();
  }

  async init() {
    if (this.worker) return;
    this.worker = new Worker(chrome.runtime.getURL('lib/sqlite-wasm/sqlite3-worker1.mjs'), { type: 'module' });
    this.worker.onmessage = (ev) => {
      const msg = ev.data;
      if (msg?.type === 'sqlite3-api' && msg?.result === 'worker1-ready') return;
      if (!msg?.messageId) return;
      const pending = this.pending.get(msg.messageId);
      if (!pending) return;
      this.pending.delete(msg.messageId);
      if (msg.type === 'error') pending.reject(new Error(msg.result?.message || 'SQLite worker error'));
      else {
        if (msg.dbId) this.dbId = msg.dbId;
        pending.resolve(msg.result);
      }
    };
  }

  request(type, args, noDb = false) {
    const messageId = `m_${Date.now()}_${++this.seq}`;
    const payload = { type, args, messageId, departureTime: performance.now() };
    if (!noDb && this.dbId) payload.dbId = this.dbId;
    return new Promise((resolve, reject) => {
      this.pending.set(messageId, { resolve, reject });
      this.worker.postMessage(payload);
    });
  }

  open(path) {
    return this.request('open', { filename: path, vfs: 'opfs' }, true);
  }

  exec(sql, opts = {}) {
    return this.request('exec', { sql, ...opts });
  }

  async execRows(sql, rowMode = 'object') {
    const result = await this.exec(sql, { rowMode, resultRows: [] });
    return Array.isArray(result?.resultRows) ? result.resultRows : [];
  }

  async close() {
    if (!this.dbId) return;
    await this.request('close', {});
    this.dbId = null;
  }
}

function TreeNode({ node, selectedPath, onSelect, onRename, onDelete, onDownload }) {
  const [expanded, setExpanded] = useState(true);

  const actionButtons = (
    <div className="node-actions" onClick={(e) => e.stopPropagation()}>
      <button className="node-action" title="重命名" onClick={() => onRename(node)}>R</button>
      <button className="node-action" title="删除" onClick={() => onDelete(node)}>D</button>
      {node.kind === 'file' && (
        <button className="node-action" title="下载" onClick={() => onDownload(node)}>↓</button>
      )}
    </div>
  );

  if (node.kind === 'directory') {
    return (
      <div className="tree-node">
        <div className={`tree-row ${selectedPath === node.path ? 'active' : ''}`} onClick={() => onSelect(node)}>
          <button className="tree-toggle" onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}>{expanded ? '▾' : '▸'}</button>
          <button className="tree-label dir" onClick={() => onSelect(node)}>{node.name || '/'}</button>
          {actionButtons}
        </div>
        {expanded && (
          <div className="tree-children">
            {(node.children || []).map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                selectedPath={selectedPath}
                onSelect={onSelect}
                onRename={onRename}
                onDelete={onDelete}
                onDownload={onDownload}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`tree-row ${selectedPath === node.path ? 'active' : ''}`} onClick={() => onSelect(node)}>
      <span className="tree-spacer" />
      <button className="tree-label file" onClick={() => onSelect(node)}>{node.name}</button>
      {actionButtons}
    </div>
  );
}

function flattenTree(nodes, out = []) {
  for (const node of nodes || []) {
    out.push(node);
    if (node.kind === 'directory') {
      flattenTree(node.children || [], out);
    }
  }
  return out;
}

function parseTriggerMeta(sql = '') {
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

function App() {
  const sqliteRef = useRef(new SqliteWorker());
  const uploadInputRef = useRef(null);
  const [tree, setTree] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Ready');

  const [textPreview, setTextPreview] = useState('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [schemaGroups, setSchemaGroups] = useState(emptySchemaGroups);
  const [selectedSchema, setSelectedSchema] = useState(null);
  const [gridColumns, setGridColumns] = useState([]);
  const [gridRows, setGridRows] = useState([]);
  const [columnTypes, setColumnTypes] = useState({});
  const [sortState, setSortState] = useState({ key: '', dir: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [jumpPageInput, setJumpPageInput] = useState('1');
  const [tableSearchTerm, setTableSearchTerm] = useState('');
  const [dataSearchTerm, setDataSearchTerm] = useState('');
  const [dbList, setDbList] = useState([]);
  const [diag, setDiag] = useState({ sqliteMasterCount: 0, sqliteSchemaCount: 0, dbList: [] });
  const [dbInfo, setDbInfo] = useState({ sqliteVersion: '', pageSize: 0, pageCount: 0, freelistCount: 0, journalMode: '', autoVacuum: 0, encoding: '', userVersion: 0, schemaVersion: 0 });
  const [activeSchemaType, setActiveSchemaType] = useState('table');
  const [indexMeta, setIndexMeta] = useState({ unique: 0, partial: 0, origin: '', columns: [] });
  const [triggerMeta, setTriggerMeta] = useState({ timing: '', event: '', whenExpr: '' });
  const [ctxMeta, setCtxMeta] = useState({ href: '', origin: '', hasOPFS: false, isSecureContext: false });

  const previewMode = useMemo(() => {
    if (!selectedFile) return 'welcome';
    if (isSqlite(selectedFile.name)) return 'sqlite';
    if (isImage(selectedFile.name)) return 'image';
    if (isText(selectedFile.name)) return 'text';
    return 'unsupported';
  }, [selectedFile]);

  const flatSchemaCount = useMemo(() => SCHEMA_TYPES.reduce((acc, k) => acc + (schemaGroups[k]?.length || 0), 0), [schemaGroups]);

  const filteredSchemaItems = useMemo(() => {
    const list = schemaGroups[activeSchemaType] || [];
    const q = tableSearchTerm.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item) => `${item.dbName || 'main'}.${item.name || ''}`.toLowerCase().includes(q));
  }, [schemaGroups, activeSchemaType, tableSearchTerm]);

  const filteredGridRows = useMemo(() => {
    const q = dataSearchTerm.trim().toLowerCase();
    const base = q
      ? gridRows.filter((row) => gridColumns.some((col) => String(row?.[col] ?? '').toLowerCase().includes(q)))
      : gridRows;

    if (!sortState.key) return base;

    const sorted = [...base].sort((a, b) => {
      const av = a?.[sortState.key];
      const bv = b?.[sortState.key];
      const an = Number(av);
      const bn = Number(bv);
      const aNum = Number.isFinite(an);
      const bNum = Number.isFinite(bn);

      let cmp = 0;
      if (aNum && bNum) cmp = an - bn;
      else cmp = String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true, sensitivity: 'base' });

      return sortState.dir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [gridRows, gridColumns, dataSearchTerm, sortState]);

  const clearPreview = () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setTextPreview('');
    setImagePreviewUrl('');
    setSchemaGroups(emptySchemaGroups);
    setSelectedSchema(null);
    setGridColumns([]);
    setGridRows([]);
    setColumnTypes({});
    setCurrentPage(1);
    setTotalRows(0);
    setJumpPageInput('1');
    setDbList([]);
    setDiag({ sqliteMasterCount: 0, sqliteSchemaCount: 0, dbList: [] });
    setDbInfo({ sqliteVersion: '', pageSize: 0, pageCount: 0, freelistCount: 0, journalMode: '', autoVacuum: 0, encoding: '', userVersion: 0, schemaVersion: 0 });
    setActiveSchemaType('table');
    setIndexMeta({ unique: 0, partial: 0, origin: '', columns: [] });
    setTriggerMeta({ timing: '', event: '', whenExpr: '' });
  };

  const refreshTree = async () => {
    setLoading(true);
    try {
      const meta = await inspectedFs.getContextMeta();
      setCtxMeta(meta || { href: '', origin: '', hasOPFS: false, isSecureContext: false });
      const list = await inspectedFs.listTree();
      const safe = Array.isArray(list) ? list : [];
      setTree(safe);

      const fileCount = await inspectedFs.getFileCount();
      chrome.runtime.sendMessage(
        { type: 'opfs:fileCount', count: fileCount, tabId: getInspectedTabId() },
        () => void chrome.runtime.lastError
      );

      if (!meta?.hasOPFS) setStatus('当前页面上下文不支持 OPFS，确认该页面可访问 navigator.storage.getDirectory');
      else if (safe.length === 0) setStatus(`OPFS 为空（origin=${meta?.origin || 'unknown'}）`);
      else setStatus(`OPFS 文件树已刷新（${safe.length} 顶级项，文件 ${fileCount}）`);
    } catch (err) {
      setStatus(`刷新失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshTree();
  }, []);

  const execRowsLogged = async (sql, rowMode = 'object') => {
    const start = performance.now();
    setStatus(`SQL> ${sql}`);
    const rows = await sqliteRef.current.execRows(sql, rowMode);
    const elapsed = (performance.now() - start).toFixed(1);
    const count = Array.isArray(rows) ? rows.length : 0;
    setStatus(`SQL(${elapsed}ms, rows=${count})> ${sql}`);
    return rows;
  };

  const loadSchemaRows = async (item, page = 1) => {
    setSelectedSchema(item);
    setGridColumns([]);
    setGridRows([]);
    setColumnTypes({});
    setIndexMeta({ unique: 0, partial: 0, origin: '', columns: [] });
    setTriggerMeta({ timing: '', event: '', whenExpr: '' });

    if (!item?.name) {
      setStatus('加载数据失败: 目标对象名称为空');
      return;
    }

    setLoading(true);
    try {
      const dbName = item.dbName || 'main';

      if (['table', 'view'].includes(item.type)) {
        const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
        const offset = (safePage - 1) * PAGE_SIZE;
        const target = qQualified(dbName, item.name);

        const infoSql = `PRAGMA ${qIdent(dbName)}.table_info(${qIdent(item.name)})`;
        const infoRows = await execRowsLogged(infoSql, 'object');
        const columnMap = {};
        for (const col of infoRows) {
          if (col?.name) columnMap[col.name] = col.type || '';
        }

        const countSql = `SELECT count(*) AS cnt FROM ${target}`;
        const countRows = await execRowsLogged(countSql, 'object');
        const allRows = Number(countRows[0]?.cnt ?? 0);
        setTotalRows(allRows);
        setCurrentPage(safePage);
        setJumpPageInput(String(safePage));

        const dataSql = `SELECT * FROM ${target} LIMIT ${PAGE_SIZE} OFFSET ${offset}`;
        const resultRows = await execRowsLogged(dataSql, 'object');
        const columns = resultRows[0] ? Object.keys(resultRows[0]) : Object.keys(columnMap);
        setGridRows(resultRows);
        setGridColumns(columns);
        setColumnTypes(columnMap);
        setStatus(`已加载 ${dbName}.${item.name}（${item.type}）第 ${page} 页 / 每页 ${PAGE_SIZE} 行 / 共 ${allRows} 行`);
        return;
      }

      if (item.type === 'index') {
        const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
        const offset = (safePage - 1) * PAGE_SIZE;

        const idxInfoSql = `PRAGMA ${qIdent(dbName)}.index_info(${qIdent(item.name)})`;
        const idxRows = await execRowsLogged(idxInfoSql, 'object');
        const idxXInfoSql = `PRAGMA ${qIdent(dbName)}.index_xinfo(${qIdent(item.name)})`;
        const idxXRows = await execRowsLogged(idxXInfoSql, 'object');
        const idxListSql = `PRAGMA ${qIdent(dbName)}.index_list(${qIdent(item.tbl_name || '')})`;
        const idxListRows = item.tbl_name ? await execRowsLogged(idxListSql, 'object') : [];
        const idxListRow = idxListRows.find((r) => r.name === item.name) || {};

        const cols = idxRows.map((r) => r.name).filter(Boolean);
        const metaCols = idxXRows
          .filter((r) => Number(r.key) === 1)
          .sort((a, b) => Number(a.seqno || 0) - Number(b.seqno || 0))
          .map((r) => ({
            seqno: Number(r.seqno || 0),
            name: r.name || '',
            cid: Number(r.cid ?? -1),
            desc: Number(r.desc || 0),
            coll: r.coll || ''
          }));
        setIndexMeta({
          unique: Number(idxListRow.unique || 0),
          partial: Number(idxListRow.partial || 0),
          origin: String(idxListRow.origin || ''),
          columns: metaCols
        });

        const tableName = item.tbl_name;

        if (!tableName || cols.length === 0) {
          setTotalRows(0);
          setCurrentPage(1);
          setJumpPageInput('1');
          setGridRows([]);
          setGridColumns([]);
          setColumnTypes({});
          setStatus(`索引 ${dbName}.${item.name} 无可读取列信息`);
          return;
        }

        const columnExpr = cols.map((c) => qIdent(c)).join(', ');
        const orderExpr = cols.map((c) => qIdent(c)).join(', ');
        const tableTarget = qQualified(dbName, tableName);

        const countSql = `SELECT count(*) AS cnt FROM ${tableTarget}`;
        const countRows = await execRowsLogged(countSql, 'object');
        const allRows = Number(countRows[0]?.cnt ?? 0);
        setTotalRows(allRows);
        setCurrentPage(safePage);
        setJumpPageInput(String(safePage));

        const dataSql = `SELECT ${columnExpr} FROM ${tableTarget} ORDER BY ${orderExpr} LIMIT ${PAGE_SIZE} OFFSET ${offset}`;
        const resultRows = await execRowsLogged(dataSql, 'object');
        const columns = resultRows[0] ? Object.keys(resultRows[0]) : cols;
        setGridRows(resultRows);
        setGridColumns(columns);
        setColumnTypes(Object.fromEntries(columns.map((c) => [c, ''])));
        setStatus(`已按索引 ${dbName}.${item.name} 读取 ${dbName}.${tableName} 第 ${safePage} 页 / 每页 ${PAGE_SIZE} 行 / 共 ${allRows} 行`);
        return;
      }

      if (item.type === 'trigger') {
        const parsed = parseTriggerMeta(item.sql || '');
        setTriggerMeta(parsed);

        const row = {
          dbName,
          name: item.name,
          table: item.tbl_name || '',
          timing: parsed.timing,
          event: parsed.event,
          when: parsed.whenExpr,
          sql: item.sql || '',
          rootpage: item.rootpage ?? ''
        };
        const columns = Object.keys(row);
        setGridRows([row]);
        setGridColumns(columns);
        setColumnTypes(Object.fromEntries(columns.map((c) => [c, ''])));
        setTotalRows(1);
        setCurrentPage(1);
        setJumpPageInput('1');
        setStatus(`已显示触发器定义 ${dbName}.${item.name}`);
        return;
      }

      setTotalRows(0);
      setCurrentPage(1);
      setJumpPageInput('1');
      setStatus(`已选择 ${item.type} ${item.name}`);
    } catch (err) {
      setStatus(`加载数据失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const runDeepDiagnostics = async (dbBytes, node) => {
    const diagLines = [];
    try {
      const masterCountRows = await execRowsLogged("SELECT count(*) AS cnt FROM sqlite_master", 'object');
      const schemaCountRows = await execRowsLogged("SELECT count(*) AS cnt FROM sqlite_schema", 'object');
      diagLines.push(`sqlite_master=${masterCountRows[0]?.cnt ?? 0}`);
      diagLines.push(`sqlite_schema=${schemaCountRows[0]?.cnt ?? 0}`);
    } catch (e) {
      diagLines.push(`schema_count_err=${e.message}`);
    }

    try {
      const pageRows = await execRowsLogged('PRAGMA page_size', 'object');
      const pageCountRows = await execRowsLogged('PRAGMA page_count', 'object');
      const freelistRows = await execRowsLogged('PRAGMA freelist_count', 'object');
      diagLines.push(`page_size=${pageRows[0]?.page_size ?? '?'}`);
      diagLines.push(`page_count=${pageCountRows[0]?.page_count ?? '?'}`);
      diagLines.push(`freelist=${freelistRows[0]?.freelist_count ?? '?'}`);
    } catch (e) {
      diagLines.push(`pragma_err=${e.message}`);
    }

    const header = readSqliteHeader(dbBytes);
    const walName = `${node.name}-wal`;
    const shmName = `${node.name}-shm`;
    const flat = flattenTree(tree);
    const walExists = flat.some((n) => n.kind === 'file' && n.name === walName);
    const shmExists = flat.some((n) => n.kind === 'file' && n.name === shmName);
    diagLines.push(`wal=${walExists}`);
    diagLines.push(`shm=${shmExists}`);

    setStatus(`schema 为空 | size=${dbBytes.length} | header=${JSON.stringify(header)} | ${diagLines.join(' | ')}`);
  };

  const openSqlite = async (node) => {
    setLoading(true);
    clearPreview();
    setStatus(`正在打开数据库: ${node.path}`);
    try {
      // 移除不必要的 refreshTree 调用，避免重复计算文件数量
      await sqliteRef.current.init();
      await sqliteRef.current.close();

      const dbBytes = await inspectedFs.readBytes(node.path);
      const walPath = `${node.path}-wal`;
      const shmPath = `${node.path}-shm`;

      let walBytes = null;
      let shmBytes = null;

      try {
        walBytes = await inspectedFs.readBytes(walPath);
      } catch (_) {
        walBytes = null;
      }

      try {
        shmBytes = await inspectedFs.readBytes(shmPath);
      } catch (_) {
        shmBytes = null;
      }

      const tempPath = `cache/${Date.now()}-${node.name}`;
      await writeExtensionOpfsFile(tempPath, dbBytes);
      if (walBytes) await writeExtensionOpfsFile(`${tempPath}-wal`, walBytes);
      if (shmBytes) await writeExtensionOpfsFile(`${tempPath}-shm`, shmBytes);

      await sqliteRef.current.open(tempPath);
      setStatus(`SQL> OPEN ${tempPath}`);

      const dbListRows = await execRowsLogged('PRAGMA database_list', 'object');
      const mappedDbList = dbListRows
        .map((r) => ({ seq: r.seq, name: r.name, file: r.file }))
        .filter((r) => r.name);
      setDbList(mappedDbList);

      const masterCountRows = await execRowsLogged("SELECT count(*) AS cnt FROM sqlite_master", 'object');
      const sqliteMasterCount = Number(masterCountRows[0]?.cnt ?? 0);

      const schemaCountRows = await execRowsLogged("SELECT count(*) AS cnt FROM sqlite_schema", 'object');
      const sqliteSchemaCount = Number(schemaCountRows[0]?.cnt ?? 0);

      setDiag({ sqliteMasterCount, sqliteSchemaCount, dbList: mappedDbList });

      const sqliteVersionRows = await execRowsLogged('SELECT sqlite_version() AS v', 'object');
      const pageSizeRows = await execRowsLogged('PRAGMA page_size', 'object');
      const pageCountRows = await execRowsLogged('PRAGMA page_count', 'object');
      const freelistRows = await execRowsLogged('PRAGMA freelist_count', 'object');
      const journalModeRows = await execRowsLogged('PRAGMA journal_mode', 'object');
      const autoVacuumRows = await execRowsLogged('PRAGMA auto_vacuum', 'object');
      const encodingRows = await execRowsLogged('PRAGMA encoding', 'object');
      const userVersionRows = await execRowsLogged('PRAGMA user_version', 'object');
      const schemaVersionRows = await execRowsLogged('PRAGMA schema_version', 'object');
      setDbInfo({
        sqliteVersion: String(sqliteVersionRows[0]?.v || ''),
        pageSize: Number(pageSizeRows[0]?.page_size || 0),
        pageCount: Number(pageCountRows[0]?.page_count || 0),
        freelistCount: Number(freelistRows[0]?.freelist_count || 0),
        journalMode: String(journalModeRows[0]?.journal_mode || ''),
        autoVacuum: Number(autoVacuumRows[0]?.auto_vacuum || 0),
        encoding: String(encodingRows[0]?.encoding || ''),
        userVersion: Number(userVersionRows[0]?.user_version || 0),
        schemaVersion: Number(schemaVersionRows[0]?.schema_version || 0)
      });

      const targets = mappedDbList.length ? mappedDbList : [{ name: 'main', file: '' }];
      const schemaRows = [];
      for (const db of targets) {
        const dbName = db.name || 'main';
        const schemaSql = `
          SELECT
            m.type,
            m.name,
            m.tbl_name,
            m.sql,
            m.rootpage,
            CASE WHEN m.type='table' THEN EXISTS(SELECT 1 FROM ${qIdent(dbName)}.sqlite_master i WHERE i.type='index' AND i.tbl_name=m.name) ELSE 0 END AS has_index,
            CASE WHEN m.type='table' THEN EXISTS(SELECT 1 FROM ${qIdent(dbName)}.sqlite_master t WHERE t.type='trigger' AND t.tbl_name=m.name) ELSE 0 END AS has_trigger,
            CASE WHEN m.type='index' THEN CASE WHEN m.sql IS NULL THEN 1 ELSE 0 END ELSE 0 END AS is_auto_index
          FROM ${qIdent(dbName)}.sqlite_master m
          WHERE m.type IN (${SCHEMA_TYPE_IN_SQL})
          ORDER BY CASE m.type ${SCHEMA_TYPE_ORDER_SQL} ELSE 99 END, m.name
        `;
        const rows = await execRowsLogged(schemaSql, 'object');
        rows.forEach((row) => schemaRows.push({ ...row, dbName }));
      }

      const groups = Object.fromEntries(SCHEMA_TYPES.map((t) => [t, []]));
      for (const s of schemaRows) if (groups[s.type]) groups[s.type].push(s);
      setSchemaGroups(groups);

      const first = groups.table[0] || groups.view[0] || null;
      if (first) await loadSchemaRows(first, 1);

      if (schemaRows.length === 0) {
        await runDeepDiagnostics(dbBytes, node);
      } else {
        setStatus(`数据库已打开: ${node.path}（schema=${schemaRows.length}, dbs=${mappedDbList.length || 1}）`);
      }
    } catch (err) {
      setStatus(`打开 sqlite 失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const openText = async (node) => {
    setLoading(true);
    clearPreview();
    try {
      setTextPreview(await inspectedFs.readText(node.path));
      setStatus(`文本预览已加载: ${node.path}`);
    } catch (err) {
      setStatus(`文本读取失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const openImage = async (node) => {
    setLoading(true);
    clearPreview();
    try {
      const bytes = await inspectedFs.readBytes(node.path);
      const blob = new Blob([bytes]);
      const url = URL.createObjectURL(blob);
      setImagePreviewUrl(url);
      setStatus(`图片预览已加载: ${node.path}`);
    } catch (err) {
      setStatus(`图片读取失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const onSelectFile = async (node) => {
    setSelectedFile(node);
    if (isSqlite(node.name)) return openSqlite(node);
    if (isImage(node.name)) return openImage(node);
    if (isText(node.name)) return openText(node);
    clearPreview();
    setStatus('当前文件类型不支持预览');
  };

  const jumpToPage = async () => {
    if (!selectedSchema) return;
    const maxPage = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
    const parsed = Number(jumpPageInput);
    const target = Number.isFinite(parsed) ? Math.max(1, Math.min(maxPage, Math.floor(parsed))) : currentPage;
    await loadSchemaRows(selectedSchema, target);
  };

  const resolveBasePath = () => {
    if (!selectedFile) return '';
    if (selectedFile.kind === 'directory') return selectedFile.path;
    const parts = selectedFile.path.split('/');
    parts.pop();
    return parts.join('/');
  };

  const createEntry = async (kind) => {
    const label = kind === 'directory' ? '目录名' : '文件名';
    const name = window.prompt(`请输入${label}`)?.trim();
    if (!name) return;
    setLoading(true);
    try {
      await inspectedFs.createEntry(resolveBasePath(), name, kind);
      setStatus(`创建成功: ${name}`);
      await refreshTree();
    } catch (err) {
      setStatus(`创建失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renameNode = async (node) => {
    const target = node || selectedFile;
    if (!target) {
      setStatus('请先选择文件或目录');
      return;
    }
    const newName = window.prompt('输入新名称', target.name)?.trim();
    if (!newName || newName === target.name) return;

    setLoading(true);
    try {
      const oldPath = target.path;
      const parentPath = oldPath.split('/').slice(0, -1).join('/');
      const newPath = parentPath ? `${parentPath}/${newName}` : newName;
      if (target.kind === 'file') {
        const bytes = await inspectedFs.readBytes(oldPath);
        await inspectedFs.writeBytes(newPath, bytes);
        await inspectedFs.removeEntry(oldPath, false);
      } else {
        throw new Error('目录重命名请先新建并迁移（后续可补完整支持）');
      }

      if (selectedFile?.path === oldPath) {
        setSelectedFile({ ...target, name: newName, path: newPath });
      }
      setStatus(`重命名成功: ${newPath}`);
      await refreshTree();
    } catch (err) {
      setStatus(`重命名失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteNode = async (node) => {
    const target = node || selectedFile;
    if (!target) {
      setStatus('请先选择文件或目录');
      return;
    }
    if (!window.confirm(`确认删除 ${target.path} ?`)) return;

    setLoading(true);
    try {
      await inspectedFs.removeEntry(target.path, target.kind === 'directory');
      if (selectedFile?.path === target.path) {
        clearPreview();
        setSelectedFile(null);
      }
      setStatus(`删除成功: ${target.path}`);
      await refreshTree();
    } catch (err) {
      setStatus(`删除失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadNode = async (node) => {
    const target = node || selectedFile;
    if (!target || target.kind !== 'file') {
      setStatus('请选择文件后再下载');
      return;
    }
    setLoading(true);
    try {
      const bytes = await inspectedFs.readBytes(target.path);
      const blob = new Blob([bytes]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = target.name;
      a.click();
      URL.revokeObjectURL(url);
      setStatus(`下载已触发: ${target.name}`);
    } catch (err) {
      setStatus(`下载失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const uploadToOpfs = async (ev) => {
    const file = ev?.target?.files?.[0];
    ev.target.value = '';
    if (!file) return;

    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const basePath = resolveBasePath();
      const destPath = basePath ? `${basePath}/${file.name}` : file.name;
      await inspectedFs.writeBytes(destPath, bytes);
      setStatus(`已上传到 OPFS: ${destPath} (${bytes.length} bytes)`);
      await refreshTree();

      const uploaded = { kind: 'file', path: destPath, name: file.name };
      setSelectedFile(uploaded);
      if (isSqlite(file.name)) await openSqlite(uploaded);
      else if (isImage(file.name)) await openImage(uploaded);
      else if (isText(file.name)) await openText(uploaded);
      else {
        clearPreview();
        setStatus(`已上传到 OPFS: ${destPath}（文件类型暂不预览）`);
      }
    } catch (err) {
      setStatus(`上传失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <aside className="left-pane">
        <div className="pane-header">
          <div>
            <h1>OPFS Explorer</h1>
            <p>文件系统</p>
            <p className="ctx-line">Origin: {ctxMeta.origin || 'unknown'}</p>
            <p className="ctx-line">Secure: {String(!!ctxMeta.isSecureContext)} | OPFS: {String(!!ctxMeta.hasOPFS)}</p>
          </div>
          <button onClick={refreshTree} disabled={loading}>刷新</button>
        </div>

        <div className="action-bar">
          <button onClick={() => createEntry('file')} disabled={loading}>+ FILE</button>
          <button onClick={() => createEntry('directory')} disabled={loading}>+ DIR</button>
          <button onClick={() => uploadInputRef.current?.click()} disabled={loading}>UPLOAD</button>
          <input
            ref={uploadInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={uploadToOpfs}
          />
        </div>

        <div className="tree-panel">
          {tree.length === 0 ? <div className="tree-empty">EMPTY OR NO ACCESS</div> : tree.map((n) => (
            <TreeNode
              key={n.path || '/'}
              node={n}
              selectedPath={selectedFile?.path}
              onSelect={onSelectFile}
              onRename={renameNode}
              onDelete={deleteNode}
              onDownload={downloadNode}
            />
          ))}
        </div>
      </aside>

      <section className="center-pane">
        <header className="pane-header top">
          <div>
            <h2>{selectedFile?.path || '未选择文件'}</h2>
            <p>{previewMode === 'sqlite' ? 'SQLite 数据库视图（只读）' : previewMode === 'image' ? '图片预览' : previewMode === 'text' ? '文本预览' : '等待选择文件'}</p>
          </div>
          <span className="readonly-tag">READ ONLY</span>
        </header>

        <div className="content-body">
          {previewMode === 'sqlite' && (
            <div className="db-layout">
              <div className="schema-pane">
                <div className="section-title">Schema Browser ({flatSchemaCount})</div>
                <div className="diag-box">
                  <div className="db-meta-card">
                    <div className="db-meta-row">
                      <span className="meta-badge">db list</span>
                      <span className="meta-chip">{dbList.map((d) => `${d.name}@${d.file}`).join(' | ') || '(none)'}</span>
                    </div>
                    <div className="db-meta-row">
                      <span className="meta-badge">sqlite</span>
                      <span className="meta-chip">version: {dbInfo.sqliteVersion || '(unknown)'}</span>
                    </div>
                    <div className="db-meta-row">
                      <span className="meta-badge">session</span>
                      <span className="meta-chip">page_size: {dbInfo.pageSize}</span>
                      <span className="meta-chip">page_count: {dbInfo.pageCount}</span>
                      <span className="meta-chip">freelist: {dbInfo.freelistCount}</span>
                    </div>
                    <div className="db-meta-row">
                      <span className="meta-badge">runtime</span>
                      <span className="meta-chip">journal: {dbInfo.journalMode || '(unknown)'}</span>
                      <span className="meta-chip">auto_vacuum: {dbInfo.autoVacuum}</span>
                      <span className="meta-chip">encoding: {dbInfo.encoding || '(unknown)'}</span>
                    </div>
                    <div className="db-meta-row">
                      <span className="meta-badge">versioning</span>
                      <span className="meta-chip">user_version: {dbInfo.userVersion}</span>
                      <span className="meta-chip">schema_version: {dbInfo.schemaVersion}</span>
                    </div>
                    <div className="db-meta-row">
                      <span className="meta-badge">objects</span>
                      <span className="meta-chip">sqlite_master: {diag.sqliteMasterCount}</span>
                      <span className="meta-chip">sqlite_schema: {diag.sqliteSchemaCount}</span>
                    </div>
                  </div>
                </div>
                <div className="schema-tabs" role="tablist" aria-label="Schema types">
                  {SCHEMA_TYPES.map((type) => (
                    <button
                      key={type}
                      className={`schema-tab ${activeSchemaType === type ? 'active' : ''}`}
                      onClick={() => setActiveSchemaType(type)}
                    >
                      {type.toUpperCase()} ({schemaGroups[type].length})
                    </button>
                  ))}
                </div>
                <div className="schema-search-wrap">
                  <input
                    className="table-search-input"
                    value={tableSearchTerm}
                    onChange={(e) => setTableSearchTerm(e.target.value)}
                    placeholder={`Search ${activeSchemaType.toUpperCase()}...`}
                  />
                </div>
                <div className="schema-scroll">
                  {filteredSchemaItems.map((item) => (
                    <button
                      key={`${item.type}-${item.name}`}
                      className={`schema-item ${selectedSchema?.type === item.type && selectedSchema?.name === item.name && selectedSchema?.dbName === item.dbName ? 'active' : ''}`}
                      onClick={() => loadSchemaRows(item, 1)}
                    >
                      <div>[{item.dbName || 'main'}] {item.name}</div>
                      <div className="schema-meta-line">
                        <span className="meta-badge root-badge">root:{item.rootpage ?? '-'}</span>
                        {item.type === 'table' && (
                          <>
                            <span className={`meta-flag ${item.has_index ? 'ok' : 'no'}`}>index</span>
                            <span className={`meta-flag ${item.has_trigger ? 'ok' : 'no'}`}>trigger</span>
                          </>
                        )}
                        {item.type === 'index' && (
                          <>
                            <span className={`meta-flag ${item.is_auto_index ? 'ok' : 'no'}`}>auto</span>
                          </>
                        )}
                      </div>
                    </button>
                  ))}
                  {filteredSchemaItems.length === 0 && (
                    <div className="empty schema-empty">No {activeSchemaType.toUpperCase()} objects.</div>
                  )}
                </div>
              </div>

              <div className="result-pane">
                <div className="section-title">Data Preview {selectedSchema ? `· ${(selectedSchema.dbName || 'main')}.${selectedSchema.name} (${selectedSchema.type})` : ''}</div>
                  {selectedSchema?.sql && <pre className="sql-box">{selectedSchema.sql}</pre>}
                <div className="pager-bar">
                  <button
                    onClick={() => selectedSchema && loadSchemaRows(selectedSchema, 1)}
                    disabled={loading || !selectedSchema || currentPage <= 1}
                  >
                    First
                  </button>
                  <button
                    onClick={() => selectedSchema && loadSchemaRows(selectedSchema, currentPage - 1)}
                    disabled={loading || !selectedSchema || currentPage <= 1}
                  >
                    Prev
                  </button>
                  <span>Page {currentPage} / {Math.max(1, Math.ceil(totalRows / PAGE_SIZE))}</span>
                  <span>Total: {totalRows}</span>
                  <div className="page-jump-wrap">
                    <input
                      className="page-jump-input"
                      value={jumpPageInput}
                      onChange={(e) => setJumpPageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') jumpToPage();
                      }}
                      placeholder="Page"
                    />
                    <button onClick={jumpToPage} disabled={loading || !selectedSchema}>Go</button>
                  </div>
                  <button
                    onClick={() => selectedSchema && loadSchemaRows(selectedSchema, currentPage + 1)}
                    disabled={loading || !selectedSchema || currentPage >= Math.max(1, Math.ceil(totalRows / PAGE_SIZE))}
                  >
                    Next
                  </button>
                </div>
                {(selectedSchema?.type === 'index' || selectedSchema?.type === 'trigger') && (
                  <div className="diag-box">
                    {selectedSchema?.type === 'index' && (
                      <div className="index-meta-card">
                        <div className="index-meta-row">
                          <span className="meta-badge">index meta</span>
                          <span className="meta-chip">origin: {indexMeta.origin || '(unknown)'}</span>
                          <span className={`meta-chip ${indexMeta.unique ? 'ok' : 'no'}`}>unique: {indexMeta.unique ? 'Y' : 'N'}</span>
                          <span className={`meta-chip ${indexMeta.partial ? 'ok' : 'no'}`}>partial: {indexMeta.partial ? 'Y' : 'N'}</span>
                        </div>
                        <div className="index-meta-row columns">
                          <span className="meta-badge">columns</span>
                          <div className="index-columns-wrap">
                            {indexMeta.columns.length
                              ? indexMeta.columns.map((c) => (
                                <span key={`${c.seqno}-${c.name}-${c.coll}`} className="meta-chip">
                                  {c.seqno}:{c.name || '(expr)'} {c.desc ? 'DESC' : 'ASC'}{c.coll ? `/${c.coll}` : ''}
                                </span>
                              ))
                              : <span className="meta-chip">(none)</span>}
                          </div>
                        </div>
                      </div>
                    )}
                    {selectedSchema?.type === 'trigger' && (
                      <>
                        <div>trigger meta: timing={triggerMeta.timing || '(unknown)'} | event={triggerMeta.event || '(unknown)'}</div>
                        <div>when: {triggerMeta.whenExpr || '(none)'}</div>
                      </>
                    )}
                  </div>
                )}
                <div className="data-search-wrap">
                  <input
                    className="data-search-input"
                    value={dataSearchTerm}
                    onChange={(e) => setDataSearchTerm(e.target.value)}
                    placeholder="Search current page rows..."
                  />
                </div>
                <div className="grid-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th className="rownum">#</th>
                        {gridColumns.map((c) => (
                          <th key={c}>
                            <button
                              className="col-sort-btn"
                              onClick={() => {
                                setSortState((prev) => {
                                  if (prev.key !== c) return { key: c, dir: 'asc' };
                                  if (prev.dir === 'asc') return { key: c, dir: 'desc' };
                                  return { key: '', dir: 'asc' };
                                });
                              }}
                            >
                              <div className="col-name">{c}{sortState.key === c ? (sortState.dir === 'asc' ? ' ▲' : ' ▼') : ''}</div>
                              <div className="col-type">{columnTypes[c] || ''}</div>
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGridRows.length === 0 ? (
                        <tr>
                          <td className="grid-empty-cell" colSpan={Math.max(1, gridColumns.length + 1)}>
                            <div className="empty grid-empty">无匹配记录（可清空搜索词重试）。</div>
                          </td>
                        </tr>
                      ) : (
                        filteredGridRows.map((r, idx) => (
                          <tr key={idx}>
                            <td className="rownum">{(currentPage - 1) * PAGE_SIZE + idx + 1}</td>
                            {gridColumns.map((c) => <td key={c}>{String(r[c] ?? '')}</td>)}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {previewMode === 'image' && (
            <div className="image-preview">
              {imagePreviewUrl ? <img src={imagePreviewUrl} alt={selectedFile?.name || 'image preview'} /> : <div className="empty">图片加载中...</div>}
            </div>
          )}
          {previewMode === 'text' && <div className="text-preview"><pre>{textPreview}</pre></div>}
          {previewMode === 'unsupported' && <div className="empty">当前文件类型不支持预览（支持 sqlite/db、图片、文本/log）。</div>}
          {previewMode === 'welcome' && <div className="empty">请在左侧选择 OPFS 文件。点击 sqlite/图片/文本文件可自动预览。</div>}
        </div>

        <footer className="status-bar">{loading ? '处理中...' : status}</footer>
      </section>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
