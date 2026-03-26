export class SqliteWorker {
  constructor() {
    this.worker = null;
    this.seq = 0;
    this.dbId = null;
    this.pending = new Map();
  }

  async init() {
    if (this.worker) return;
    this.worker = new Worker(chrome.runtime.getURL('lib/sqlite-wasm/sqlite3-worker1.mjs'), { type: 'module' });
    this.worker.onmessage = (ev) => {
      const msg = ev.data;
      if (msg?.type === 'sqlite3-api' && msg?.result === 'worker1-ready') return;
      if (!msg?.messageId) return;
      const pending = this.pending.get(msg.messageId);
      if (!pending) return;
      this.pending.delete(msg.messageId);
      if (msg.type === 'error') pending.reject(new Error(msg.result?.message || 'SQLite worker error'));
      else {
        if (msg.dbId) this.dbId = msg.dbId;
        pending.resolve(msg.result);
      }
    };
  }

  request(type, args, noDb = false) {
    const messageId = `m_${Date.now()}_${++this.seq}`;
    const payload = { type, args, messageId, departureTime: performance.now() };
    if (!noDb && this.dbId) payload.dbId = this.dbId;
    return new Promise((resolve, reject) => {
      this.pending.set(messageId, { resolve, reject });
      this.worker.postMessage(payload);
    });
  }

  open(path) {
    return this.request('open', { filename: path, vfs: 'opfs' }, true);
  }

  exec(sql, opts = {}) {
    return this.request('exec', { sql, ...opts });
  }

  async execRows(sql, rowMode = 'object') {
    const result = await this.exec(sql, { rowMode, resultRows: [] });
    return Array.isArray(result?.resultRows) ? result.resultRows : [];
  }

  async close() {
    if (!this.dbId) return;
    await this.request('close', {});
    this.dbId = null;
  }
}
