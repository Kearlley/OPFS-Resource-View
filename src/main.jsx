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

function App() {
  const sqliteRef = useRef(new SqliteWorker());
  const [state, dispatch] = useAppState();
  
  const { 
    tree, selectedFile, loading, status, textPreview, imagePreviewUrl, 
    schemaGroups, selectedSchema, gridColumns, gridRows, columnTypes, 
    sortState, currentPage, totalRows, jumpPageInput, tableSearchTerm, 
    dataSearchTerm, dbList, diag, dbInfo, activeSchemaType, indexMeta, 
    triggerMeta, ctxMeta 
  } = state;

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
          <button onClick={() => createEntry('file', selectedFile)} disabled={loading}>+ FILE</button>
          <button onClick={() => createEntry('directory', selectedFile)} disabled={loading}>+ DIR</button>
          <button onClick={() => uploadInputRef.current?.click()} disabled={loading}>UPLOAD</button>
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
        />
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
              dbList={dbList}
              diag={diag}
              dbInfo={dbInfo}
              activeSchemaType={activeSchemaType}
              indexMeta={indexMeta}
              triggerMeta={triggerMeta}
              onLoadSchema={loadSchemaRows}
              onJumpPage={() => jumpToPage(selectedSchema, currentPage, totalRows, jumpPageInput, loadSchemaRows)}
              onSetTableSearch={(value) => dispatch({ type: 'SET_TABLE_SEARCH_TERM', payload: value })}
              onSetDataSearch={(value) => dispatch({ type: 'SET_DATA_SEARCH_TERM', payload: value })}
              onSetActiveSchemaType={(value) => dispatch({ type: 'SET_ACTIVE_SCHEMA_TYPE', payload: value })}
              onSetSortState={(value) => dispatch({ type: 'SET_SORT_STATE', payload: value })}
              loading={loading}
            />
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
