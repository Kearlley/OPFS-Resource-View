import React, { useState } from 'react';
import { Pagination } from './Pagination';
import { SchemaBrowser } from './SchemaBrowser';
import { DataGrid } from './DataGrid';
import { SchemaMeta } from './SchemaMeta';
import { PAGE_SIZE } from '../constants';
import { useTranslation } from '../i18n';

export function SqliteViewer({
  schemaGroups,
  selectedSchema,
  gridColumns,
  gridRows,
  columnTypes,
  sortState,
  currentPage,
  totalRows,
  jumpPageInput,
  tableSearchTerm,
  dataSearchTerm,
  activeSchemaType,
  indexMeta,
  triggerMeta,
  onLoadSchema,
  onJumpPage,
  onJumpPageInputChange,
  onSetTableSearch,
  onSetDataSearch,
  onSetActiveSchemaType,
  onSetSortState,
  loading,
  language
}) {
  const t = useTranslation(language);
  const [copied, setCopied] = useState(false);

  const handleCopySql = async () => {
    if (selectedSchema?.sql) {
      try {
        await navigator.clipboard.writeText(selectedSchema.sql);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  return (
    <div className="db-layout">
      <SchemaBrowser
        schemaGroups={schemaGroups}
        selectedSchema={selectedSchema}
        activeSchemaType={activeSchemaType}
        tableSearchTerm={tableSearchTerm}
        onLoadSchema={onLoadSchema}
        onSetTableSearch={onSetTableSearch}
        onSetActiveSchemaType={onSetActiveSchemaType}
        language={language}
      />

      <div className="result-pane">
        <div className="section-title">{t.dataPreview} {selectedSchema ? `· ${(selectedSchema.dbName || 'main')}.${selectedSchema.name} (${selectedSchema.type})` : ''}</div>

        <div className="sql-meta-row">
          {selectedSchema?.sql && (
            <div className="sql-box-wrapper">
              <div className="sql-box-header">
                <span className="sql-box-label">{t.createStatement}</span>
                <button className="copy-btn" onClick={handleCopySql} disabled={!selectedSchema?.sql}>
                  {copied ? t.copied : t.copySql}
                </button>
              </div>
              <pre className="sql-box">{selectedSchema.sql}</pre>
            </div>
          )}

          {selectedSchema && (
            <div className="diag-box-container">
              <SchemaMeta
                selectedSchema={selectedSchema}
                indexMeta={indexMeta}
                triggerMeta={triggerMeta}
                language={language}
              />
            </div>
          )}
        </div>

        <Pagination
          currentPage={currentPage}
          totalRows={totalRows}
          pageSize={PAGE_SIZE}
          onPageChange={(page) => onLoadSchema(selectedSchema, page)}
          onJumpPage={onJumpPage}
          jumpPageInput={jumpPageInput}
          onJumpPageInputChange={onJumpPageInputChange}
          loading={loading}
          disabled={!selectedSchema}
          language={language}
        />

        <DataGrid
          gridColumns={gridColumns}
          gridRows={gridRows}
          columnTypes={columnTypes}
          sortState={sortState}
          currentPage={currentPage}
          dataSearchTerm={dataSearchTerm}
          onSetDataSearch={onSetDataSearch}
          onSetSortState={onSetSortState}
          language={language}
        />
      </div>
    </div>
  );
}
