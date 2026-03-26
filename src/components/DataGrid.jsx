import React from 'react';
import { PAGE_SIZE } from '../constants';
import { useTranslation } from '../i18n';

export function DataGrid({
  gridColumns,
  gridRows,
  columnTypes,
  sortState,
  currentPage,
  dataSearchTerm,
  onSetDataSearch,
  onSetSortState,
  language
}) {
  const t = useTranslation(language);
  return (
    <>
      <div className="data-search-wrap">
        <input
          className="data-search-input"
          value={dataSearchTerm}
          onChange={(e) => onSetDataSearch(e.target.value)}
          placeholder={t.searchData}
        />
      </div>
      <div className="grid-wrap">
        <table>
          <thead>
            <tr>
              <th className="rownum">#</th>
              {gridColumns.map((c) => (
                <th key={c}>
                  <button
                    className="col-sort-btn"
                    onClick={() => {
                      onSetSortState((prev) => {
                        if (prev.key !== c) return { key: c, dir: 'asc' };
                        if (prev.dir === 'asc') return { key: c, dir: 'desc' };
                        return { key: '', dir: 'asc' };
                      });
                    }}
                  >
                    <div className="col-name">{c}{sortState.key === c ? (sortState.dir === 'asc' ? ' ▲' : ' ▼') : ''}</div>
                    <div className="col-type">{columnTypes[c] || ''}</div>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gridRows.length === 0 ? (
              <tr>
                <td className="grid-empty-cell" colSpan={Math.max(1, gridColumns.length + 1)}>
                  <div className="empty grid-empty">{t.noData}</div>
                </td>
              </tr>
            ) : (
              gridRows.map((r, idx) => (
                <tr key={idx}>
                  <td className="rownum">{(currentPage - 1) * PAGE_SIZE + idx + 1}</td>
                  {gridColumns.map((c) => <td key={c}>{String(r[c] ?? '')}</td>)}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
