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
        <div className="pane-header">
          <div>
            <h1>{t.appTitle}</h1>
            <p>{t.fileSystem}</p>
            <p className="ctx-line">{t.origin.replace('{origin}', ctxMeta.origin || 'unknown')}</p>
            <p className="ctx-line">{t.secure.replace('{secure}', String(!!ctxMeta.isSecureContext)).replace('{opfs}', String(!!ctxMeta.hasOPFS))}</p>
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
          <button onClick={() => createEntry('file', selectedFile)} disabled={loading}>{t.createFile}</button>
          <button onClick={() => createEntry('directory', selectedFile)} disabled={loading}>{t.createDir}</button>
          <button onClick={() => uploadInputRef.current?.click()} disabled={loading}>{t.upload}</button>
          <button onClick={refreshTree} disabled={loading}>{t.refresh}</button>
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
          <div>
            <h2>{selectedFile?.path || t.noFileSelected}</h2>
            <p>{previewMode === 'sqlite' ? t.sqliteView : previewMode === 'image' ? t.imagePreview : previewMode === 'text' ? t.textPreview : t.waitingFile}</p>
          </div>
          <span className="readonly-tag">{t.readOnly}</span>
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
