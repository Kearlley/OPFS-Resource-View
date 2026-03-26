import React, { useState } from 'react';

function TreeNode({ node, selectedPath, onSelect, onRename, onDelete, onDownload }) {
  const [expanded, setExpanded] = useState(true);

  const actionButtons = (
    <div className="node-actions" onClick={(e) => e.stopPropagation()}>
      <button className="node-action" title="重命名" onClick={() => onRename(node)}>R</button>
      <button className="node-action" title="删除" onClick={() => onDelete(node)}>D</button>
      {node.kind === 'file' && (
        <button className="node-action" title="下载" onClick={() => onDownload(node)}>↓</button>
      )}
    </div>
  );

  if (node.kind === 'directory') {
    return (
      <div className="tree-node">
        <div className={`tree-row ${selectedPath === node.path ? 'active' : ''}`} onClick={() => onSelect(node)}>
          <button className="tree-toggle" onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}>{expanded ? '▾' : '▸'}</button>
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
      <button className="tree-label file" onClick={() => onSelect(node)}>{node.name}</button>
      {actionButtons}
    </div>
  );
}

export function FileTree({ tree, selectedPath, onSelect, onRename, onDelete, onDownload }) {
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
          />
        ))
      )}
    </div>
  );
}
