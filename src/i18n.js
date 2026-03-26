export const translations = {
  cn: {
    // App 组件
    appTitle: 'OPFS Explorer',
    fileSystem: '文件系统',
    refresh: '刷新',
    createFile: '新建文件',
    createDir: '新建目录',
    upload: '上传',
    origin: '来源: {origin}',
    secure: '安全: {secure} | OPFS: {opfs}',
    noFileSelected: '未选择文件',
    imagePreview: '图片预览',
    textPreview: '文本预览',
    waitingFile: '等待选择文件',
    readOnly: '只读',
    processing: '处理中...',
    ready: '已准备',
    unsupported: '当前文件类型不支持预览（支持 sqlite/db、图片、文本/log）。',
    welcome: '请在左侧选择 OPFS 文件。点击 sqlite/图片/文本文件可自动预览。',

    // SqliteViewer 组件
    dataPreview: '数据预览',

    // SchemaBrowser 组件
    schemaTypes: {
      table: '表',
      view: '视图',
      index: '索引',
      trigger: '触发器'
    },
    searchTables: '搜索表...',

    // DatabaseInfo 组件
    databaseInfo: '数据库信息',
    databaseList: '数据库列表',
    diagnostics: '诊断信息',
    sqliteVersion: 'SQLite 版本',
    pageSize: '页大小',
    pageCount: '页数',
    freelistCount: '空闲列表计数',
    journalMode: '日志模式',
    autoVacuum: '自动真空',
    encoding: '编码',
    userVersion: '用户版本',
    schemaVersion: '模式版本',
    sqliteMasterCount: 'sqlite_master 计数',
    sqliteSchemaCount: 'sqlite_schema 计数',

    // SchemaMeta 组件
    schemaInfo: '结构信息',
    indexes: '索引',
    triggers: '触发器',
    unique: '唯一',
    partial: '部分',
    origin: '来源',
    columns: '列',
    timing: '时机',
    event: '事件',
    when: '条件',

    // DataGrid 组件
    searchData: '搜索数据...',
    noData: '无数据',

    // Pagination 组件
    page: '页',
    of: '共',
    go: '前往',

    // FileTree 组件
    rename: '重命名',
    delete: '删除',
    download: '下载',

    // SQL 相关
    copySql: '复制 SQL',
    copied: '已复制',
    createStatement: '建表语句',

    // 语言切换
    language: '语言',
    chinese: '中文',
    english: 'English'
  },
  en: {
    // App 组件
    appTitle: 'OPFS Explorer',
    fileSystem: 'File System',
    refresh: 'Refresh',
    createFile: 'New File',
    createDir: 'New Directory',
    upload: 'Upload',
    origin: 'Origin: {origin}',
    secure: 'Secure: {secure} | OPFS: {opfs}',
    noFileSelected: 'No file selected',
    imagePreview: 'Image Preview',
    textPreview: 'Text Preview',
    waitingFile: 'Waiting for file selection',
    readOnly: 'READ ONLY',
    processing: 'Processing...',
    ready: 'Ready',
    unsupported: 'Current file type is not supported for preview (supports sqlite/db, images, text/log).',
    welcome: 'Please select an OPFS file on the left. Click sqlite/image/text files to preview automatically.',

    // SqliteViewer 组件
    dataPreview: 'Data Preview',

    // SchemaBrowser 组件
    schemaTypes: {
      table: 'Tables',
      view: 'Views',
      index: 'Indexes',
      trigger: 'Triggers'
    },
    searchTables: 'Search tables...',

    // DatabaseInfo 组件
    databaseInfo: 'Database Info',
    databaseList: 'Database List',
    diagnostics: 'Diagnostics',
    sqliteVersion: 'SQLite Version',
    pageSize: 'Page Size',
    pageCount: 'Page Count',
    freelistCount: 'Freelist Count',
    journalMode: 'Journal Mode',
    autoVacuum: 'Auto Vacuum',
    encoding: 'Encoding',
    userVersion: 'User Version',
    schemaVersion: 'Schema Version',
    sqliteMasterCount: 'sqlite_master Count',
    sqliteSchemaCount: 'sqlite_schema Count',

    // SchemaMeta 组件
    schemaInfo: 'Schema Info',
    indexes: 'Indexes',
    triggers: 'Triggers',
    unique: 'Unique',
    partial: 'Partial',
    origin: 'Origin',
    columns: 'Columns',
    timing: 'Timing',
    event: 'Event',
    when: 'When',

    // DataGrid 组件
    searchData: 'Search data...',
    noData: 'No Data',

    // Pagination 组件
    page: 'Page',
    of: 'of',
    go: 'Go',

    // FileTree 组件
    rename: 'Rename',
    delete: 'Delete',
    download: 'Download',

    // SQL 相关
    copySql: 'Copy SQL',
    copied: 'Copied',
    createStatement: 'CREATE Statement',

    // 语言切换
    language: 'Language',
    chinese: '中文',
    english: 'English'
  }
};

export function useTranslation(language) {
  return translations[language] || translations.cn;
}
