import { toBase64, fromBase64 } from './base64.js';

function getInspectedTabId() {
  const tabId = chrome?.devtools?.inspectedWindow?.tabId;
  if (typeof tabId !== 'number') {
    throw new Error('未找到 inspectedWindow.tabId，请在页面 DevTools 面板中使用插件');
  }
  return tabId;
}

function normalizeSendMessageError(message = '') {
  if (message.includes('Receiving end does not exist')) {
    return '目标页面未注入 content script。请刷新目标页面，或确认页面不是 chrome:// / edge:// / devtools:// 等受限地址';
  }
  if (message.includes('Cannot access contents of url')) {
    return '当前 URL 受限，扩展无法访问该页面内容';
  }
  if (message.includes('Extension context invalidated')) {
    return '扩展上下文已失效。请刷新 DevTools 面板或目标页面后重试';
  }
  return message || '发送消息失败';
}

async function opfsRequest(type, payload = {}) {
  const tabId = getInspectedTabId();
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type, ...payload }, (resp) => {
      if (chrome.runtime.lastError) {
        reject(new Error(normalizeSendMessageError(chrome.runtime.lastError.message || '')));
        return;
      }
      if (!resp?.ok) {
        reject(new Error(resp?.error || 'OPFS 请求失败'));
        return;
      }
      resolve(resp.result);
    });
  });
}

let fileChangeListeners = [];

// 监听文件变化消息
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'opfs:fileChanged') {
    fileChangeListeners.forEach(listener => {
      try {
        listener(message.path);
      } catch (e) {
        console.error('File change listener error:', e);
      }
    });
  }
});

export const inspectedFs = {
  getContextMeta() {
    return opfsRequest('opfs:ctx');
  },
  listTree() {
    return opfsRequest('opfs:list');
  },
  getFileCount() {
    return opfsRequest('opfs:fileCount');
  },
  readText(path) {
    return opfsRequest('opfs:readText', { path });
  },
  async readBytes(path) {
    return fromBase64(await opfsRequest('opfs:readBytes', { path }));
  },
  writeBytes(path, bytes) {
    return opfsRequest('opfs:writeBytes', { path, base64: toBase64(bytes) });
  },
  createEntry(parentPath, name, kind) {
    return opfsRequest('opfs:create', { parentPath, name, kind });
  },
  removeEntry(path, recursive) {
    return opfsRequest('opfs:remove', { path, recursive: !!recursive });
  },
  monitorFile(path, enable) {
    return opfsRequest('opfs:monitorFile', { path, enable });
  },
  onFileChange(listener) {
    fileChangeListeners.push(listener);
    return () => {
      fileChangeListeners = fileChangeListeners.filter(l => l !== listener);
    };
  }
};

export async function writeExtensionOpfsFile(path, bytes) {
  const parts = path.split('/').filter(Boolean);
  let dir = await navigator.storage.getDirectory();
  for (let i = 0; i < parts.length - 1; i += 1) dir = await dir.getDirectoryHandle(parts[i], { create: true });
  const file = await dir.getFileHandle(parts[parts.length - 1], { create: true });
  const ws = await file.createWritable();
  await ws.write(bytes);
  await ws.close();
}
