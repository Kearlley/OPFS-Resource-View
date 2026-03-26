import React, { useState } from 'react';
import { useTranslation } from '../i18n';
import { isSqlite, isImage, isText } from '../utils/helpers';
import { FaFile, FaFolder, FaDatabase, FaImage, FaFileAlt, FaFileCode, FaEdit, FaTrash, FaDownload, FaChevronDown, FaChevronRight } from 'react-icons/fa';

function getFileIcon(name) {
  if (!name) return <FaFile />;
  const lower = name.toLowerCase();
  if (lower.endsWith('.sqlite') || lower.endsWith('.db') || lower.endsWith('.sqlite3') || lower.endsWith('.db3')) return <FaDatabase />;
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.webp') || lower.endsWith('.bmp') || lower.endsWith('.svg')) return <FaImage />;
  if (lower.endsWith('.txt') || lower.endsWith('.log') || lower.endsWith('.json') || lower.endsWith('.md') || lower.endsWith('.csv') || lower.endsWith('.xml') || lower.endsWith('.yaml') || lower.endsWith('.yml') || lower.endsWith('.js') || lower.endsWith('.ts') || lower.endsWith('.html') || lower.endsWith('.css')) return <FaFileCode />;
  return <FaFileAlt />;
}

function TreeNode({ node, selectedPath, onSelect, onRename, onDelete, onDownload, language }) {
  const t = useTranslation(language);
  const [expanded, setExpanded] = useState(true);

  const actionButtons = (
    <div className="node-actions" onClick={(e) => e.stopPropagation()}>
      <button className="node-action" title={t.rename} onClick={() => onRename(node)}><FaEdit /></button>
      <button className="node-action" title={t.delete} onClick={() => onDelete(node)}><FaTrash /></button>
      {node.kind === 'file' && (
        <button className="node-action" title={t.download} onClick={() => onDownload(node)}><FaDownload /></button>
      )}
    </div>
  );

  if (node.kind === 'directory') {
    return (
      <div className="tree-node">
        <div className={`tree-row ${selectedPath === node.path ? 'active' : ''}`} onClick={() => onSelect(node)}>
          <button className="tree-toggle" onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}>{expanded ? <FaChevronDown /> : <FaChevronRight />}</button>
          <span className="tree-icon dir-icon"><FaFolder /></span>
          <button className="tree-label dir" onClick={() => onSelect(node)}>{node.name || '/'}</button>
          {actionButtons}
        </div>
        {expanded && (
          <div className="tree-children">
            {(node.children || []).map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                selectedPath={selectedPath}
                onSelect={onSelect}
                onRename={onRename}
                onDelete={onDelete}
                onDownload={onDownload}
                language={language}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`tree-row ${selectedPath === node.path ? 'active' : ''}`} onClick={() => onSelect(node)}>
      <span className="tree-spacer" />
      <span className={`tree-icon file-icon ${isSqlite(node.name) ? 'icon-sqlite' : isImage(node.name) ? 'icon-image' : isText(node.name) ? 'icon-text' : 'icon-generic'}`}>
        {getFileIcon(node.name)}
      </span>
      <button className="tree-label file" onClick={() => onSelect(node)}>{node.name}</button>
      {actionButtons}
    </div>
  );
}

export function FileTree({ tree, selectedPath, onSelect, onRename, onDelete, onDownload, language }) {
  return (
    <div className="tree-panel">
      {tree.length === 0 ? (
        <div className="tree-empty">EMPTY OR NO ACCESS</div>
      ) : (
        tree.map((node) => (
          <TreeNode
            key={node.path || '/'}
            node={node}
            selectedPath={selectedPath}
            onSelect={onSelect}
            onRename={onRename}
            onDelete={onDelete}
            onDownload={onDownload}
            language={language}
          />
        ))
      )}
    </div>
  );
}
