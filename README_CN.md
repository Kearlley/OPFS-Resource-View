# OPFS Resource View

[English Version](README.md)

## 项目简介

OPFS Resource View 是一个 Chrome 浏览器扩展，提供了一个 DevTools 面板，用于浏览 OPFS (Origin Private File System) 文件系统，查看和分析 SQLite 数据库、图片和文本文件。

## 主要功能

- 📁 **OPFS 文件系统浏览**：查看当前页面的 OPFS 文件结构，支持目录导航和文件计数
- 🗃️ **SQLite 数据库查看**：
  - 浏览数据库 schema（表、视图、索引、触发器）
  - 查看表结构和数据，支持分页、排序和搜索
  - 查看数据库元信息（SQLite 版本、页面大小、编码等）
  - 查看索引详情（唯一索引、部分索引、索引列等）
  - 查看触发器定义和元数据
- 🖼️ **图片预览**：直接预览 OPFS 中的图片文件
- 📄 **文本文件查看**：查看各种文本格式的文件内容
- ⚙️ **文件操作**：支持创建文件/目录、重命名、删除和下载文件
- 📤 **文件上传**：将本地文件上传到 OPFS
- 🌍 **国际化支持**：支持中文和英文语言，默认为英文
- 🔄 **角标自动更新**：浏览器标签加载时自动更新文件计数角标

## 技术栈

- React + JavaScript/JSX
- SQLite WASM (WebAssembly)
- Chrome 扩展 API
- OPFS (Origin Private File System)

## 安装方法

### 从源码安装

1. 克隆或下载本项目到本地
2. 打开 Chrome 浏览器，进入 `chrome://extensions/`
3. 开启 "开发者模式"
4. 点击 "加载已解压的扩展程序"
5. 选择项目根目录
6. 扩展将被安装并在 DevTools 中显示 "OPFS Resource View" 面板

## 使用说明

1. 打开任意网页（支持 OPFS 的页面）
2. 右键点击页面，选择 "检查" 打开 DevTools
3. 在 DevTools 标签页中找到 "OPFS Resource View" 面板
4. 左侧显示 OPFS 文件系统树，右侧显示文件内容预览

### SQLite 数据库查看

1. **打开数据库**：点击 SQLite 文件（.sqlite, .db, .sqlite3, .db3）自动打开
2. **Schema 浏览**：
   - 在 Schema Browser 中查看数据库的表、视图、索引和触发器
   - 点击顶部标签页切换不同类型的数据库对象
   - 使用搜索框快速查找特定的表、视图等
   - 每个对象显示基本信息，如表是否有索引和触发器，索引是否为自动索引等
3. **数据查看**：
   - 点击表名或视图名查看数据内容
   - 支持分页浏览，每页显示 50 条记录
   - 点击列名进行排序，再次点击切换排序方向
   - 使用搜索框在当前页中搜索数据
4. **数据库元信息**：
   - 查看 SQLite 版本、页面大小、页面数量、空闲列表数量
   - 查看日志模式、自动真空设置、编码格式
   - 查看用户版本和 schema 版本
5. **索引详情**：
   - 查看索引的唯一性、是否为部分索引
   - 查看索引的来源和索引列信息
   - 点击索引名查看按该索引排序的数据
6. **触发器详情**：
   - 查看触发器的定义 SQL
   - 查看触发器的触发时机（BEFORE/AFTER/INSTEAD OF）
   - 查看触发器的触发事件（INSERT/UPDATE/DELETE）
   - 查看触发器的条件表达式（WHEN 子句）

### 图片预览

- 点击图片文件（.png, .jpg, .jpeg, .gif, .webp, .bmp, .svg）自动预览

### 文本文件查看

- 点击文本文件（.txt, .log, .json, .md, .csv, .xml, .yaml, .yml, .js, .ts, .html, .css）自动预览

### 文件操作

- **创建文件/目录**：点击左侧面板的 "+ FILE" 或 "+ DIR" 按钮
- **上传文件**：点击 "UPLOAD" 按钮选择本地文件
- **重命名**：点击文件/目录旁的 "R" 按钮
- **删除**：点击文件/目录旁的 "D" 按钮
- **下载**：点击文件旁的 "↓" 按钮

## 注意事项

- 本扩展仅在支持 OPFS 的页面中工作
- 目前 SQLite 数据库查看为只读模式
- 目录重命名功能暂未完全支持
- 部分文件类型可能无法预览

## 支持的文件类型

### SQLite 数据库

- .sqlite
- .db
- .sqlite3
- .db3

### 图片

- .png, .jpg, .jpeg, .gif, .webp, .bmp, .svg

### 文本文件

- .txt, .log, .json, .md, .csv, .xml, .yaml, .yml, .js, .ts, .html, .css

## 项目结构

```
├── dist/             # 构建后的文件
│   ├── assets/       # 静态资源
│   ├── lib/          # 依赖库（如 SQLite WASM）
│   └── ...           # 扩展相关文件
├── src/              # 源代码
│   ├── devtools.js   # DevTools 面板创建
│   ├── main.jsx      # 主应用组件
│   └── styles.css    # 样式文件
├── manifest.json     # 扩展配置文件
├── package.json      # 项目配置文件
├── README.md         # 英文说明文件
└── README_CN.md      # 中文说明文件
```

## 开发指南

### 安装依赖

```bash
npm install
```

### 构建项目

```bash
npm run build
```

### 开发模式

```bash
npm run dev
```

## 许可证

本项目使用 GNU General Public License v3.0 许可证。详情请查看 [licenses](licenses) 文件。

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目！

## 联系方式

如有问题或建议，请在项目仓库中提交 Issue。
