import React from 'react';
import { useTranslation } from '../i18n';

export function Pagination({ currentPage, totalRows, pageSize, onPageChange, onJumpPage, jumpPageInput, onJumpPageInputChange, loading, disabled, language }) {
  const t = useTranslation(language);
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  return (
    <div className="pager-bar">
      <button
        onClick={() => onPageChange(1)}
        disabled={loading || disabled || currentPage <= 1}
      >
        First
      </button>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={loading || disabled || currentPage <= 1}
      >
        Prev
      </button>
      <span>{t.page} {currentPage} {t.of} {totalPages}</span>
      <span>Total: {totalRows}</span>
      <div className="page-jump-wrap">
        <input
          className="page-jump-input"
          value={jumpPageInput}
          onChange={(e) => onJumpPageInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onJumpPage();
          }}
          placeholder={t.page}
        />
        <button onClick={onJumpPage} disabled={loading || disabled}>{t.go}</button>
      </div>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={loading || disabled || currentPage >= totalPages}
      >
        Next
      </button>
    </div>
  );
}
