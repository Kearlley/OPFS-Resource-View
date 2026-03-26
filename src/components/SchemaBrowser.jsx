import React from 'react';
import { SCHEMA_TYPES } from '../constants';

export function SchemaBrowser({
  schemaGroups,
  selectedSchema,
  activeSchemaType,
  tableSearchTerm,
  onLoadSchema,
  onSetTableSearch,
  onSetActiveSchemaType
}) {
  const flatSchemaCount = Object.values(schemaGroups).reduce((acc, group) => acc + (group?.length || 0), 0);
  const filteredSchemaItems = schemaGroups[activeSchemaType] || [];

  return (
    <div className="schema-pane">
      <div className="section-title">Schema Browser ({flatSchemaCount})</div>
      
      <div className="schema-tabs" role="tablist" aria-label="Schema types">
        {SCHEMA_TYPES.map((type) => (
          <button
            key={type}
            className={`schema-tab ${activeSchemaType === type ? 'active' : ''}`}
            onClick={() => onSetActiveSchemaType(type)}
          >
            {type.toUpperCase()} ({schemaGroups[type]?.length || 0})
          </button>
        ))}
      </div>
      
      <div className="schema-search-wrap">
        <input
          className="table-search-input"
          value={tableSearchTerm}
          onChange={(e) => onSetTableSearch(e.target.value)}
          placeholder={`Search ${activeSchemaType.toUpperCase()}...`}
        />
      </div>
      
      <div className="schema-scroll">
        {filteredSchemaItems.map((item) => (
          <button
            key={`${item.type}-${item.name}`}
            className={`schema-item ${selectedSchema?.type === item.type && selectedSchema?.name === item.name && selectedSchema?.dbName === item.dbName ? 'active' : ''}`}
            onClick={() => onLoadSchema(item, 1)}
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
  );
}
