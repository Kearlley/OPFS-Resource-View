// Base64 conversion functions
function toBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

(() => {

  async function getDirAndName(path, createDirs = false) {
    const parts = String(path).split('/').filter(Boolean);
    const name = parts.pop();
    let dir = await navigator.storage.getDirectory();
    for (const p of parts) {
      dir = await dir.getDirectoryHandle(p, { create: createDirs });
    }
    return { dir, name };
  }

  async function listTree() {
    const walk = async (dirHandle, parentPath) => {
      const entries = [];
      for await (const [name, handle] of dirHandle.entries()) {
        const path = parentPath ? `${parentPath}/${name}` : name;
        if (handle.kind === 'directory') {
          entries.push({ kind: 'directory', name, path, children: await walk(handle, path) });
        } else {
          entries.push({ kind: 'file', name, path });
        }
      }
      entries.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      return entries;
    };

    const root = await navigator.storage.getDirectory();
    return walk(root, '');
  }

  async function countFilesFast() {
    // 使用非递归方式遍历文件系统，避免深层递归导致的性能问题
    let count = 0;
    const stack = [];
    
    const root = await navigator.storage.getDirectory();
    stack.push(root);
    
    while (stack.length > 0) {
      const dirHandle = stack.pop();
      for await (const [, handle] of dirHandle.entries()) {
        if (handle.kind === 'directory') {
          stack.push(handle);
        } else {
          count += 1;
        }
      }
    }
    
    return count;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message?.type?.startsWith('opfs:')) return;

    (async () => {
      try {
        if (message.type === 'opfs:ctx') {
          sendResponse({ ok: true, result: {
            href: location.href,
            origin: location.origin,
            isSecureContext,
            hasOPFS: !!navigator?.storage?.getDirectory,
            frameIdHint: window === top ? 0 : -1
          } });
          return;
        }

        if (!navigator?.storage?.getDirectory) {
          throw new Error('navigator.storage.getDirectory 不可用');
        }

        if (message.type === 'opfs:list') {
          sendResponse({ ok: true, result: await listTree() });
          return;
        }

        if (message.type === 'opfs:fileCount') {
          sendResponse({ ok: true, result: await countFilesFast() });
          return;
        }

        if (message.type === 'opfs:readText') {
          const { dir, name } = await getDirAndName(message.path);
          const file = await (await dir.getFileHandle(name)).getFile();
          sendResponse({ ok: true, result: await file.text() });
          return;
        }

        if (message.type === 'opfs:readBytes') {
          const { dir, name } = await getDirAndName(message.path);
          const file = await (await dir.getFileHandle(name)).getFile();
          const bytes = new Uint8Array(await file.arrayBuffer());
          sendResponse({ ok: true, result: toBase64(bytes) });
          return;
        }

        if (message.type === 'opfs:writeBytes') {
          const { dir, name } = await getDirAndName(message.path, true);
          const fh = await dir.getFileHandle(name, { create: true });
          const ws = await fh.createWritable();
          await ws.write(fromBase64(message.base64));
          await ws.close();
          sendResponse({ ok: true, result: true });
          return;
        }

        if (message.type === 'opfs:create') {
          let dir = await navigator.storage.getDirectory();
          const parentParts = String(message.parentPath || '').split('/').filter(Boolean);
          for (const p of parentParts) dir = await dir.getDirectoryHandle(p, { create: true });
          if (message.kind === 'directory') {
            await dir.getDirectoryHandle(message.name, { create: true });
          } else {
            const fh = await dir.getFileHandle(message.name, { create: true });
            const ws = await fh.createWritable();
            await ws.close();
          }
          sendResponse({ ok: true, result: true });
          return;
        }

        if (message.type === 'opfs:remove') {
          const { dir, name } = await getDirAndName(message.path);
          await dir.removeEntry(name, { recursive: !!message.recursive });
          sendResponse({ ok: true, result: true });
          return;
        }

        throw new Error(`Unknown message type: ${message.type}`);
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || String(error) });
      }
    })();

    return true;
  });
})();
