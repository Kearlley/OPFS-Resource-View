# OPFS SQLite DevTools 关键修复记录

## 问题现象

插件中打开 `data.db` 时显示：

- `Schema Browser (0)`
- `DB LIST: (none)`
- `sqlite_master count: 0`
- `page_size/page_count/freelist` 也读不到

但实际业务页面可正常使用该数据库。

---

## 根因

SQLite Worker API 的 `exec` 调用结果读取方式用错了。

### 错误做法（之前）

在主线程调用：

- `exec(sql, { rowMode, resultRows: [] })`
- 期望传进去的 `resultRows` 数组被 Worker 直接填充

这在 Worker 消息通信中不可依赖：

- 主线程 -> Worker 通过 `postMessage` 是结构化克隆
- 传入数组不是“共享引用”
- 调用方本地数组不会被 Worker 原地修改

所以 UI 看到的是空数组，误判成“数据库没有 schema”。

### 正确做法（修复后）

统一从 `exec()` 的返回值里读取 `result.resultRows`：

- 封装 `execRows(sql, rowMode)`
- 在封装内部：`const result = await exec(...); return result.resultRows || []`

然后所有读取路径都改为使用 `execRows(...)`：

- `PRAGMA database_list`
- `SELECT count(*) FROM sqlite_master/sqlite_schema`
- Schema 扫描
- 数据预览

---

## 为什么这样就可以

因为 Worker API 的结果数据是通过**响应消息**返回的，不是通过“修改请求参数对象”返回的。

换句话说：

- 正确数据在 `onmessage` 回包的 `result` 中
- 只要从返回值提取 `resultRows`，就能拿到真实查询结果
- UI 不再误判为空库

---

## 额外稳定性改造（同一轮完成）

1. DevTools 目标页定位

- 由 `active tab query` 改为 `chrome.devtools.inspectedWindow.tabId`
- 防止“未找到当前活动标签页”

2. OPFS 访问链路

- 由 `inspectedWindow.eval` 改为 `content script + tabs.sendMessage`
- 避免上下文错位导致 `Origin unknown / OPFS false`

3. sqlite wasm CSP 兼容

- 在构建流程中自动 patch `sqlite3-worker1.mjs`
- 强制非 `instantiateStreaming` 路径，规避 DevTools CSP 下 wasm 编译限制

---

## 结论

这次问题本质不是数据库内容问题，而是**Worker 查询结果读取方式错误**。
改为“从 exec 返回值读取 resultRows”后恢复正常。
