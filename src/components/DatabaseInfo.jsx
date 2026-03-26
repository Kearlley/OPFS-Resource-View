import React from 'react';

export function DatabaseInfo({ dbList, diag, dbInfo }) {
  return (
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
  );
}
