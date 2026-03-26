import React from 'react';
import { useTranslation } from '../i18n';

export function SchemaMeta({ selectedSchema, indexMeta, triggerMeta, language }) {
  const t = useTranslation(language);
  if (!selectedSchema) return null;

  return (
    <div className="diag-box">
      {selectedSchema.type === 'index' && (
        <div className="index-meta-card">
          <div className="index-meta-row">
            <span className="meta-badge">{t.indexes} meta</span>
            <span className="meta-chip">{t.origin}: {indexMeta.origin || '(unknown)'}</span>
            <span className={`meta-chip ${indexMeta.unique ? 'ok' : 'no'}`}>{t.unique}: {indexMeta.unique ? 'Y' : 'N'}</span>
            <span className={`meta-chip ${indexMeta.partial ? 'ok' : 'no'}`}>{t.partial}: {indexMeta.partial ? 'Y' : 'N'}</span>
          </div>
          <div className="index-meta-row columns">
            <span className="meta-badge">{t.columns}</span>
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
          <div>{t.triggers} meta: {t.timing}={triggerMeta.timing || '(unknown)'} | {t.event}={triggerMeta.event || '(unknown)'}</div>
          <div>{t.when}: {triggerMeta.whenExpr || '(none)'}</div>
        </>
      )}
    </div>
  );
}
