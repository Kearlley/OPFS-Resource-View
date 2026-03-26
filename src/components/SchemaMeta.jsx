import React from 'react';

export function SchemaMeta({ selectedSchema, indexMeta, triggerMeta }) {
  if (!selectedSchema) return null;

  return (
    <div className="diag-box">
      {selectedSchema.type === 'index' && (
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
      {selectedSchema.type === 'trigger' && (
        <>
          <div>trigger meta: timing={triggerMeta.timing || '(unknown)'} | event={triggerMeta.event || '(unknown)'}</div>
          <div>when: {triggerMeta.whenExpr || '(none)'}</div>
        </>
      )}
    </div>
  );
}
