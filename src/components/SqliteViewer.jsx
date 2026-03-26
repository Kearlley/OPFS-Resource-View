import React from 'react';
import { Pagination } from './Pagination';
import { SchemaBrowser } from './SchemaBrowser';
import { DatabaseInfo } from './DatabaseInfo';
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
  dbList,
  diag,
  dbInfo,
  activeSchemaType,
  indexMeta,
  triggerMeta,
  onLoadSchema,
  onJumpPage,
  onSetTableSearch,
  onSetDataSearch,
  onSetActiveSchemaType,
  onSetSortState,
  loading,
  language
}) {
  const t = useTranslation(language);

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
        {selectedSchema?.sql && <pre className="sql-box">{selectedSchema.sql}</pre>}
        
        <DatabaseInfo dbList={dbList} diag={diag} dbInfo={dbInfo} language={language} />
        
        <Pagination
          currentPage={currentPage}
          totalRows={totalRows}
          pageSize={PAGE_SIZE}
          onPageChange={(page) => onLoadSchema(selectedSchema, page)}
          onJumpPage={onJumpPage}
          jumpPageInput={jumpPageInput}
          onJumpPageInputChange={(value) => {}}
          loading={loading}
          disabled={!selectedSchema}
          language={language}
        />
        
        <SchemaMeta
          selectedSchema={selectedSchema}
          indexMeta={indexMeta}
          triggerMeta={triggerMeta}
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
