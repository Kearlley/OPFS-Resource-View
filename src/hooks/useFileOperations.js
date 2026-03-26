import { useRef } from 'react';
import { inspectedFs, writeExtensionOpfsFile } from '../utils/opfs';
import { isSqlite, isImage, isText } from '../utils/helpers';

export function useFileOperations(sqliteWorker, dispatch) {
  const uploadInputRef = useRef(null);

  const clearPreview = () => {
    dispatch({ type: 'CLEAR_PREVIEW' });
  };

  const refreshTree = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      // 并行获取上下文元数据和文件计数
      const [meta, fileCount] = await Promise.all([
        inspectedFs.getContextMeta(),
        inspectedFs.getFileCount()
      ]);
      
      // 发送文件计数消息，尽快更新角标
      chrome.runtime.sendMessage(
        { type: 'opfs:fileCount', count: fileCount, tabId: chrome?.devtools?.inspectedWindow?.tabId },
        () => void chrome.runtime.lastError
      );
      
      // 单独获取文件树
      const list = await inspectedFs.listTree();
      const safe = Array.isArray(list) ? list : [];
      dispatch({ type: 'SET_TREE', payload: safe });
      dispatch({ type: 'SET_CTX_META', payload: meta });

      if (!meta?.hasOPFS) dispatch({ type: 'SET_STATUS', payload: '当前页面上下文不支持 OPFS，确认该页面可访问 navigator.storage.getDirectory' });
      else if (safe.length === 0) dispatch({ type: 'SET_STATUS', payload: `OPFS 为空（origin=${meta?.origin || 'unknown'}）` });
      else dispatch({ type: 'SET_STATUS', payload: `OPFS 文件树已刷新（${safe.length} 顶级项，文件 ${fileCount}）` });
    } catch (err) {
      dispatch({ type: 'SET_STATUS', payload: `刷新失败: ${err.message}` });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const resolveBasePath = (selectedFile) => {
    if (!selectedFile) return '';
    if (selectedFile.kind === 'directory') return selectedFile.path;
    const parts = selectedFile.path.split('/');
    parts.pop();
    return parts.join('/');
  };

  const createEntry = async (kind, selectedFile) => {
    const label = kind === 'directory' ? '目录名' : '文件名';
    const name = window.prompt(`请输入${label}`)?.trim();
    if (!name) return;
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await inspectedFs.createEntry(resolveBasePath(selectedFile), name, kind);
      dispatch({ type: 'SET_STATUS', payload: `创建成功: ${name}` });
      await refreshTree();
    } catch (err) {
      dispatch({ type: 'SET_STATUS', payload: `创建失败: ${err.message}` });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const renameNode = async (node, selectedFile) => {
    const target = node || selectedFile;
    if (!target) {
      dispatch({ type: 'SET_STATUS', payload: '请先选择文件或目录' });
      return;
    }
    const newName = window.prompt('输入新名称', target.name)?.trim();
    if (!newName || newName === target.name) return;

    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const oldPath = target.path;
      const parentPath = oldPath.split('/').slice(0, -1).join('/');
      const newPath = parentPath ? `${parentPath}/${newName}` : newName;
      if (target.kind === 'file') {
        const bytes = await inspectedFs.readBytes(oldPath);
        await inspectedFs.writeBytes(newPath, bytes);
        await inspectedFs.removeEntry(oldPath, false);
      } else {
        throw new Error('目录重命名请先新建并迁移（后续可补完整支持）');
      }

      if (selectedFile?.path === oldPath) {
        dispatch({ type: 'SET_SELECTED_FILE', payload: { ...target, name: newName, path: newPath } });
      }
      dispatch({ type: 'SET_STATUS', payload: `重命名成功: ${newPath}` });
      await refreshTree();
    } catch (err) {
      dispatch({ type: 'SET_STATUS', payload: `重命名失败: ${err.message}` });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const deleteNode = async (node, selectedFile, imagePreviewUrl) => {
    const target = node || selectedFile;
    if (!target) {
      dispatch({ type: 'SET_STATUS', payload: '请先选择文件或目录' });
      return;
    }
    if (!window.confirm(`确认删除 ${target.path} ?`)) return;

    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await inspectedFs.removeEntry(target.path, target.kind === 'directory');
      if (selectedFile?.path === target.path) {
        if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
        clearPreview();
        dispatch({ type: 'SET_SELECTED_FILE', payload: null });
      }
      dispatch({ type: 'SET_STATUS', payload: `删除成功: ${target.path}` });
      await refreshTree();
    } catch (err) {
      dispatch({ type: 'SET_STATUS', payload: `删除失败: ${err.message}` });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const downloadNode = async (node, selectedFile) => {
    const target = node || selectedFile;
    if (!target || target.kind !== 'file') {
      dispatch({ type: 'SET_STATUS', payload: '请选择文件后再下载' });
      return;
    }
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const bytes = await inspectedFs.readBytes(target.path);
      const blob = new Blob([bytes]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = target.name;
      a.click();
      URL.revokeObjectURL(url);
      dispatch({ type: 'SET_STATUS', payload: `下载已触发: ${target.name}` });
    } catch (err) {
      dispatch({ type: 'SET_STATUS', payload: `下载失败: ${err.message}` });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const uploadToOpfs = async (ev, selectedFile, openSqlite, openImage, openText) => {
    const file = ev?.target?.files?.[0];
    ev.target.value = '';
    if (!file) return;

    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const basePath = resolveBasePath(selectedFile);
      const destPath = basePath ? `${basePath}/${file.name}` : file.name;
      await inspectedFs.writeBytes(destPath, bytes);
      dispatch({ type: 'SET_STATUS', payload: `已上传到 OPFS: ${destPath} (${bytes.length} bytes)` });
      await refreshTree();

      const uploaded = { kind: 'file', path: destPath, name: file.name };
      dispatch({ type: 'SET_SELECTED_FILE', payload: uploaded });
      if (isSqlite(file.name)) await openSqlite(uploaded);
      else if (isImage(file.name)) await openImage(uploaded);
      else if (isText(file.name)) await openText(uploaded);
      else {
        clearPreview();
        dispatch({ type: 'SET_STATUS', payload: `已上传到 OPFS: ${destPath}（文件类型暂不预览）` });
      }
    } catch (err) {
      dispatch({ type: 'SET_STATUS', payload: `上传失败: ${err.message}` });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  return {
    uploadInputRef,
    clearPreview,
    refreshTree,
    resolveBasePath,
    createEntry,
    renameNode,
    deleteNode,
    downloadNode,
    uploadToOpfs
  };
}
