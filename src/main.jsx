import React, { useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { FileTree } from './components/FileTree';
import { SqliteViewer } from './components/SqliteViewer';
import { useAppState } from './hooks/useAppState';
import { useFileOperations } from './hooks/useFileOperations';
import { useDatabaseOperations } from './hooks/useDatabaseOperations';
import { SqliteWorker } from './utils/sqlite';
import { isSqlite, isImage, isText } from './utils/helpers';
import { useTranslation } from './i18n';
import { FaFile, FaFolder, FaUpload, FaSync } from 'react-icons/fa';

function App() {
  const sqliteRef = useRef(new SqliteWorker());
  const [state, dispatch] = useAppState();
  
  const { 
    tree, selectedFile, loading, status, textPreview, imagePreviewUrl, 
    schemaGroups, selectedSchema, gridColumns, gridRows, columnTypes, 
    sortState, currentPage, totalRows, jumpPageInput, tableSearchTerm, 
    dataSearchTerm, dbList, diag, dbInfo, activeSchemaType, indexMeta, 
    triggerMeta, ctxMeta, language 
  } = state;
  
  const t = useTranslation(language);

  const previewMode = useMemo(() => {
    if (!selectedFile) return 'welcome';
    if (isSqlite(selectedFile.name)) return 'sqlite';
    if (isImage(selectedFile.name)) return 'image';
    if (isText(selectedFile.name)) return 'text';
    return 'unsupported';
  }, [selectedFile]);

  const { uploadInputRef, clearPreview, refreshTree, createEntry, renameNode, deleteNode, downloadNode, uploadToOpfs } = useFileOperations(sqliteRef.current, dispatch);
  const { loadSchemaRows, openSqlite, openText, openImage, onSelectFile, jumpToPage } = useDatabaseOperations(sqliteRef.current, dispatch);

  useEffect(() => {
    refreshTree();
  }, []);

  return (
    <div className="app-shell">
      <aside className="left-pane">
        <div className="pane-header left-header">
          <div className="header-main">
            <h1>{t.appTitle}</h1>
            <p>{t.fileSystem}</p>
            <p className="ctx-line">{t.origin.replace('{origin}', (ctxMeta.origin && ctxMeta.origin !== 'null') ? ctxMeta.origin : 'unknown')}</p>
            <p className="ctx-line">{t.secure.replace('{secure}', ctxMeta.isSecureContext ? 'Yes' : 'No').replace('{opfs}', ctxMeta.hasOPFS ? 'Yes' : 'No')}</p>
          </div>
          <div className="header-actions">
            <select
              value={language}
              onChange={(e) => dispatch({ type: 'SET_LANGUAGE', payload: e.target.value })}
              disabled={loading}
              className="language-select"
            >
              <option value="cn">{t.chinese}</option>
              <option value="en">{t.english}</option>
            </select>
          </div>
        </div>

        <div className="action-bar">
          <button className="action-btn" title={t.actionNewFile} onClick={() => createEntry('file', selectedFile)} disabled={loading}>
            <FaFile />
          </button>
          <button className="action-btn" title={t.actionNewDir} onClick={() => createEntry('directory', selectedFile)} disabled={loading}>
            <FaFolder />
          </button>
          <button className="action-btn" title={t.actionUpload} onClick={() => uploadInputRef.current?.click()} disabled={loading}>
            <FaUpload />
          </button>
          <button className="action-btn" title={t.actionRefresh} onClick={refreshTree} disabled={loading}>
            <FaSync />
          </button>
          <input
            ref={uploadInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={(ev) => uploadToOpfs(ev, selectedFile, openSqlite, openImage, openText)}
          />
        </div>

        <FileTree
          tree={tree}
          selectedPath={selectedFile?.path}
          onSelect={(node) => onSelectFile(node, tree, clearPreview)}
          onRename={(node) => renameNode(node, selectedFile)}
          onDelete={(node) => deleteNode(node, selectedFile, imagePreviewUrl)}
          onDownload={(node) => downloadNode(node, selectedFile)}
          language={language}
        />
      </aside>

      <section className="center-pane">
        <header className="pane-header top">
          <div className="header-main">
            <div className="header-title-row">
              <h2>{selectedFile?.path || t.noFileSelected}</h2>
              <span className="readonly-tag">{t.readOnly}</span>
            </div>
            <p className="header-subtitle">
              {previewMode === 'sqlite' ? '' : previewMode === 'image' ? t.imagePreview : previewMode === 'text' ? t.textPreview : t.waitingFile}
            </p>
            {previewMode === 'sqlite' && dbInfo && (
              <div className="db-info-bar">
                <span className="db-info-item">{t.databaseList}: {dbList.map((d) => `${d.name}@${d.file}`).join(' | ') || '(none)'}</span>
                <span className="db-info-sep">|</span>
                <span className="db-info-item">session: page_size: {dbInfo.pageSize} | page_count: {dbInfo.pageCount} | freelist: {dbInfo.freelistCount}</span>
                <span className="db-info-sep">|</span>
                <span className="db-info-item">runtime: journal: {dbInfo.journalMode || '(unknown)'} | auto_vacuum: {dbInfo.autoVacuum} | encoding: {dbInfo.encoding || '(unknown)'}</span>
                <span className="db-info-sep">|</span>
                <span className="db-info-item">versioning: user_version: {dbInfo.userVersion} | schema_version: {dbInfo.schemaVersion}</span>
                <span className="db-info-sep">|</span>
                <span className="db-info-item">objects: sqlite_master: {diag.sqliteMasterCount} | sqlite_schema: {diag.sqliteSchemaCount}</span>
              </div>
            )}
          </div>
        </header>

        <div className="content-body">
          {previewMode === 'sqlite' && (
            <SqliteViewer
              schemaGroups={schemaGroups}
              selectedSchema={selectedSchema}
              gridColumns={gridColumns}
              gridRows={gridRows}
              columnTypes={columnTypes}
              sortState={sortState}
              currentPage={currentPage}
              totalRows={totalRows}
              jumpPageInput={jumpPageInput}
              tableSearchTerm={tableSearchTerm}
              dataSearchTerm={dataSearchTerm}
              activeSchemaType={activeSchemaType}
              indexMeta={indexMeta}
              triggerMeta={triggerMeta}
              onLoadSchema={(item, page) => loadSchemaRows(item, page, dataSearchTerm)}
              onJumpPage={() => jumpToPage(selectedSchema, currentPage, totalRows, jumpPageInput, (item, page) => loadSchemaRows(item, page, dataSearchTerm, sortState))}
              onJumpPageInputChange={(value) => dispatch({ type: 'SET_JUMP_PAGE_INPUT', payload: value })}
              onSetTableSearch={(value) => dispatch({ type: 'SET_TABLE_SEARCH_TERM', payload: value })}
              onSetDataSearch={(value) => {
                dispatch({ type: 'SET_DATA_SEARCH_TERM', payload: value });
                if (selectedSchema) {
                  loadSchemaRows(selectedSchema, 1, value, sortState);
                }
              }}
              onSetActiveSchemaType={(value) => dispatch({ type: 'SET_ACTIVE_SCHEMA_TYPE', payload: value })}
              onSetSortState={(fn) => {
                const newSortState = typeof fn === 'function' ? fn(sortState) : fn;
                dispatch({ type: 'SET_SORT_STATE', payload: newSortState });
                if (selectedSchema) {
                  loadSchemaRows(selectedSchema, 1, dataSearchTerm, newSortState);
                }
              }}
              loading={loading}
              language={language}
            />
          )}

          {previewMode === 'image' && (
            <div className="image-preview">
              {imagePreviewUrl ? <img src={imagePreviewUrl} alt={selectedFile?.name || 'image preview'} /> : <div className="empty">图片加载中...</div>}
            </div>
          )}
          {previewMode === 'text' && <div className="text-preview"><pre>{textPreview}</pre></div>}
          {previewMode === 'unsupported' && <div className="empty">{t.unsupported}</div>}
          {previewMode === 'welcome' && <div className="empty">{t.welcome}</div>}
        </div>

        <footer className="status-bar">{loading ? t.processing : status}</footer>
      </section>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
