import { inspectedFs, writeExtensionOpfsFile } from '../utils/opfs';
import { qIdent, qQualified, readSqliteHeader, flattenTree, parseTriggerMeta } from '../utils/helpers';
import { PAGE_SIZE, SCHEMA_TYPES, SCHEMA_TYPE_ORDER_SQL, SCHEMA_TYPE_IN_SQL } from '../constants';
import { isSqlite, isImage, isText } from '../utils/helpers';

export function useDatabaseOperations(sqliteWorker, dispatch) {
  const execRowsLogged = async (sql, rowMode = 'object') => {
    const start = performance.now();
    dispatch({ type: 'SET_STATUS', payload: `SQL> ${sql}` });
    const rows = await sqliteWorker.execRows(sql, rowMode);
    const elapsed = (performance.now() - start).toFixed(1);
    const count = Array.isArray(rows) ? rows.length : 0;
    dispatch({ type: 'SET_STATUS', payload: `SQL(${elapsed}ms, rows=${count})> ${sql}` });
    return rows;
  };

  const loadSchemaRows = async (item, page = 1) => {
    dispatch({ type: 'SET_SELECTED_SCHEMA', payload: item });
    dispatch({ type: 'SET_GRID_COLUMNS', payload: [] });
    dispatch({ type: 'SET_GRID_ROWS', payload: [] });
    dispatch({ type: 'SET_COLUMN_TYPES', payload: {} });
    dispatch({ type: 'SET_INDEX_META', payload: { unique: 0, partial: 0, origin: '', columns: [] } });
    dispatch({ type: 'SET_TRIGGER_META', payload: { timing: '', event: '', whenExpr: '' } });

    if (!item?.name) {
      dispatch({ type: 'SET_STATUS', payload: '加载数据失败: 目标对象名称为空' });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
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
        dispatch({ type: 'SET_TOTAL_ROWS', payload: allRows });
        dispatch({ type: 'SET_CURRENT_PAGE', payload: safePage });
        dispatch({ type: 'SET_JUMP_PAGE_INPUT', payload: String(safePage) });

        const dataSql = `SELECT * FROM ${target} LIMIT ${PAGE_SIZE} OFFSET ${offset}`;
        const resultRows = await execRowsLogged(dataSql, 'object');
        const columns = resultRows[0] ? Object.keys(resultRows[0]) : Object.keys(columnMap);
        dispatch({ type: 'SET_GRID_ROWS', payload: resultRows });
        dispatch({ type: 'SET_GRID_COLUMNS', payload: columns });
        dispatch({ type: 'SET_COLUMN_TYPES', payload: columnMap });
        dispatch({ type: 'SET_STATUS', payload: `已加载 ${dbName}.${item.name}（${item.type}）第 ${page} 页 / 每页 ${PAGE_SIZE} 行 / 共 ${allRows} 行` });
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
        dispatch({ type: 'SET_INDEX_META', payload: {
          unique: Number(idxListRow.unique || 0),
          partial: Number(idxListRow.partial || 0),
          origin: String(idxListRow.origin || ''),
          columns: metaCols
        }});

        const tableName = item.tbl_name;

        if (!tableName || cols.length === 0) {
          dispatch({ type: 'SET_TOTAL_ROWS', payload: 0 });
          dispatch({ type: 'SET_CURRENT_PAGE', payload: 1 });
          dispatch({ type: 'SET_JUMP_PAGE_INPUT', payload: '1' });
          dispatch({ type: 'SET_GRID_ROWS', payload: [] });
          dispatch({ type: 'SET_GRID_COLUMNS', payload: [] });
          dispatch({ type: 'SET_COLUMN_TYPES', payload: {} });
          dispatch({ type: 'SET_STATUS', payload: `索引 ${dbName}.${item.name} 无可读取列信息` });
          return;
        }

        const columnExpr = cols.map((c) => qIdent(c)).join(', ');
        const orderExpr = cols.map((c) => qIdent(c)).join(', ');
        const tableTarget = qQualified(dbName, tableName);

        const countSql = `SELECT count(*) AS cnt FROM ${tableTarget}`;
        const countRows = await execRowsLogged(countSql, 'object');
        const allRows = Number(countRows[0]?.cnt ?? 0);
        dispatch({ type: 'SET_TOTAL_ROWS', payload: allRows });
        dispatch({ type: 'SET_CURRENT_PAGE', payload: safePage });
        dispatch({ type: 'SET_JUMP_PAGE_INPUT', payload: String(safePage) });

        const dataSql = `SELECT ${columnExpr} FROM ${tableTarget} ORDER BY ${orderExpr} LIMIT ${PAGE_SIZE} OFFSET ${offset}`;
        const resultRows = await execRowsLogged(dataSql, 'object');
        const columns = resultRows[0] ? Object.keys(resultRows[0]) : cols;
        dispatch({ type: 'SET_GRID_ROWS', payload: resultRows });
        dispatch({ type: 'SET_GRID_COLUMNS', payload: columns });
        dispatch({ type: 'SET_COLUMN_TYPES', payload: Object.fromEntries(columns.map((c) => [c, ''])) });
        dispatch({ type: 'SET_STATUS', payload: `已按索引 ${dbName}.${item.name} 读取 ${dbName}.${tableName} 第 ${safePage} 页 / 每页 ${PAGE_SIZE} 行 / 共 ${allRows} 行` });
        return;
      }

      if (item.type === 'trigger') {
        const parsed = parseTriggerMeta(item.sql || '');
        dispatch({ type: 'SET_TRIGGER_META', payload: parsed });

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
        dispatch({ type: 'SET_GRID_ROWS', payload: [row] });
        dispatch({ type: 'SET_GRID_COLUMNS', payload: columns });
        dispatch({ type: 'SET_COLUMN_TYPES', payload: Object.fromEntries(columns.map((c) => [c, ''])) });
        dispatch({ type: 'SET_TOTAL_ROWS', payload: 1 });
        dispatch({ type: 'SET_CURRENT_PAGE', payload: 1 });
        dispatch({ type: 'SET_JUMP_PAGE_INPUT', payload: '1' });
        dispatch({ type: 'SET_STATUS', payload: `已显示触发器定义 ${dbName}.${item.name}` });
        return;
      }

      dispatch({ type: 'SET_TOTAL_ROWS', payload: 0 });
      dispatch({ type: 'SET_CURRENT_PAGE', payload: 1 });
      dispatch({ type: 'SET_JUMP_PAGE_INPUT', payload: '1' });
      dispatch({ type: 'SET_STATUS', payload: `已选择 ${item.type} ${item.name}` });
    } catch (err) {
      dispatch({ type: 'SET_STATUS', payload: `加载数据失败: ${err.message}` });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const runDeepDiagnostics = async (dbBytes, node, tree) => {
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

    dispatch({ type: 'SET_STATUS', payload: `schema 为空 | size=${dbBytes.length} | header=${JSON.stringify(header)} | ${diagLines.join(' | ')}` });
  };

  const openSqlite = async (node, tree, clearPreview) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    clearPreview();
    dispatch({ type: 'SET_STATUS', payload: `正在打开数据库: ${node.path}` });
    try {
      await sqliteWorker.init();
      await sqliteWorker.close();

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

      await sqliteWorker.open(tempPath);
      dispatch({ type: 'SET_STATUS', payload: `SQL> OPEN ${tempPath}` });

      const dbListRows = await execRowsLogged('PRAGMA database_list', 'object');
      const mappedDbList = dbListRows
        .map((r) => ({ seq: r.seq, name: r.name, file: r.file }))
        .filter((r) => r.name);
      dispatch({ type: 'SET_DB_LIST', payload: mappedDbList });

      const masterCountRows = await execRowsLogged("SELECT count(*) AS cnt FROM sqlite_master", 'object');
      const sqliteMasterCount = Number(masterCountRows[0]?.cnt ?? 0);

      const schemaCountRows = await execRowsLogged("SELECT count(*) AS cnt FROM sqlite_schema", 'object');
      const sqliteSchemaCount = Number(schemaCountRows[0]?.cnt ?? 0);

      dispatch({ type: 'SET_DIAG', payload: { sqliteMasterCount, sqliteSchemaCount, dbList: mappedDbList } });

      const sqliteVersionRows = await execRowsLogged('SELECT sqlite_version() AS v', 'object');
      const pageSizeRows = await execRowsLogged('PRAGMA page_size', 'object');
      const pageCountRows = await execRowsLogged('PRAGMA page_count', 'object');
      const freelistRows = await execRowsLogged('PRAGMA freelist_count', 'object');
      const journalModeRows = await execRowsLogged('PRAGMA journal_mode', 'object');
      const autoVacuumRows = await execRowsLogged('PRAGMA auto_vacuum', 'object');
      const encodingRows = await execRowsLogged('PRAGMA encoding', 'object');
      const userVersionRows = await execRowsLogged('PRAGMA user_version', 'object');
      const schemaVersionRows = await execRowsLogged('PRAGMA schema_version', 'object');
      dispatch({ type: 'SET_DB_INFO', payload: {
        sqliteVersion: String(sqliteVersionRows[0]?.v || ''),
        pageSize: Number(pageSizeRows[0]?.page_size || 0),
        pageCount: Number(pageCountRows[0]?.page_count || 0),
        freelistCount: Number(freelistRows[0]?.freelist_count || 0),
        journalMode: String(journalModeRows[0]?.journal_mode || ''),
        autoVacuum: Number(autoVacuumRows[0]?.auto_vacuum || 0),
        encoding: String(encodingRows[0]?.encoding || ''),
        userVersion: Number(userVersionRows[0]?.user_version || 0),
        schemaVersion: Number(schemaVersionRows[0]?.schema_version || 0)
      }});

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
      dispatch({ type: 'SET_SCHEMA_GROUPS', payload: groups });

      const first = groups.table[0] || groups.view[0] || null;
      if (first) await loadSchemaRows(first, 1);

      if (schemaRows.length === 0) {
        await runDeepDiagnostics(dbBytes, node, tree);
      } else {
        dispatch({ type: 'SET_STATUS', payload: `数据库已打开: ${node.path}（schema=${schemaRows.length}, dbs=${mappedDbList.length || 1}）` });
      }
    } catch (err) {
      dispatch({ type: 'SET_STATUS', payload: `打开 sqlite 失败: ${err.message}` });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const openText = async (node, clearPreview) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    clearPreview();
    try {
      const text = await inspectedFs.readText(node.path);
      dispatch({ type: 'SET_TEXT_PREVIEW', payload: text });
      dispatch({ type: 'SET_STATUS', payload: `文本预览已加载: ${node.path}` });
    } catch (err) {
      dispatch({ type: 'SET_STATUS', payload: `文本读取失败: ${err.message}` });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const openImage = async (node, clearPreview) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    clearPreview();
    try {
      const bytes = await inspectedFs.readBytes(node.path);
      const blob = new Blob([bytes]);
      const url = URL.createObjectURL(blob);
      dispatch({ type: 'SET_IMAGE_PREVIEW_URL', payload: url });
      dispatch({ type: 'SET_STATUS', payload: `图片预览已加载: ${node.path}` });
    } catch (err) {
      dispatch({ type: 'SET_STATUS', payload: `图片读取失败: ${err.message}` });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const onSelectFile = async (node, tree, clearPreview) => {
    dispatch({ type: 'SET_SELECTED_FILE', payload: node });
    if (isSqlite(node.name)) return openSqlite(node, tree, clearPreview);
    if (isImage(node.name)) return openImage(node, clearPreview);
    if (isText(node.name)) return openText(node, clearPreview);
    clearPreview();
    dispatch({ type: 'SET_STATUS', payload: '当前文件类型不支持预览' });
  };

  const jumpToPage = async (selectedSchema, currentPage, totalRows, jumpPageInput, loadSchemaRows) => {
    if (!selectedSchema) return;
    const maxPage = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
    const parsed = Number(jumpPageInput);
    const target = Number.isFinite(parsed) ? Math.max(1, Math.min(maxPage, Math.floor(parsed))) : currentPage;
    await loadSchemaRows(selectedSchema, target);
  };

  return {
    execRowsLogged,
    loadSchemaRows,
    runDeepDiagnostics,
    openSqlite,
    openText,
    openImage,
    onSelectFile,
    jumpToPage
  };
}
