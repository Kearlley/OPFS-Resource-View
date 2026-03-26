# OPFS Resource View

[中文版本 (Chinese Version)](README_CN.md)

## Project Introduction

OPFS Resource View is a Chrome browser extension that provides a DevTools panel for browsing the OPFS (Origin Private File System), viewing and analyzing SQLite databases, images, and text files.

## Main Features

- 📁 **OPFS File System Browsing**: View the OPFS file structure of the current page, support directory navigation and file counting
- 🗃️ **SQLite Database Viewing**:
  - Browse database schema (tables, views, indexes, triggers)
  - View table structure and data, support pagination, sorting, and searching
  - View database metadata (SQLite version, page size, encoding, etc.)
  - View index details (unique indexes, partial indexes, index columns, etc.)
  - View trigger definitions and metadata
- 🖼️ **Image Preview**: Directly preview image files in OPFS
- 📄 **Text File Viewing**: View content of various text format files
- ⚙️ **File Operations**: Support creating files/directories, renaming, deleting, and downloading files
- 📤 **File Upload**: Upload local files to OPFS
- 🌍 **Internationalization Support**: Support Chinese and English languages, default to English
- 🔄 **Badge Auto-update**: Automatically update the file count badge when the browser tab loads

## Technology Stack

- React + JavaScript/JSX
- SQLite WASM (WebAssembly)
- Chrome Extension API
- OPFS (Origin Private File System)

## Installation Methods

### Install from Source Code

1. Clone or download this project to your local machine
2. Open Chrome browser, go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked extension"
5. Select the project root directory
6. The extension will be installed and display "OPFS Resource View" panel in DevTools

## Usage Instructions

1. Open any web page (that supports OPFS)
2. Right-click on the page and select "Inspect" to open DevTools
3. Find the "OPFS Resource View" panel in the DevTools tabs
4. The left side shows the OPFS file system tree, and the right side shows file content preview

### SQLite Database Viewing

1. **Open Database**: Click on SQLite files (.sqlite, .db, .sqlite3, .db3) to open automatically
2. **Schema Browsing**:
   - View database tables, views, indexes, and triggers in the Schema Browser
   - Click on top tabs to switch between different types of database objects
   - Use the search box to quickly find specific tables, views, etc.
   - Each object displays basic information, such as whether a table has indexes and triggers, whether an index is an auto-index, etc.
3. **Data Viewing**:
   - Click on table or view names to view data content
   - Support paginated browsing, 50 records per page
   - Click on column names to sort, click again to toggle sort direction
   - Use the search box to search data in the current page
4. **Database Metadata**:
   - View SQLite version, page size, page count, freelist count
   - View journal mode, auto-vacuum settings, encoding format
   - View user version and schema version
5. **Index Details**:
   - View index uniqueness, whether it's a partial index
   - View index origin and index column information
   - Click on index names to view data sorted by that index
6. **Trigger Details**:
   - View trigger definition SQL
   - View trigger timing (BEFORE/AFTER/INSTEAD OF)
   - View trigger event (INSERT/UPDATE/DELETE)
   - View trigger condition expression (WHEN clause)

### Image Preview

- Click on image files (.png, .jpg, .jpeg, .gif, .webp, .bmp, .svg) to preview automatically

### Text File Viewing

- Click on text files (.txt, .log, .json, .md, .csv, .xml, .yaml, .yml, .js, .ts, .html, .css) to preview automatically

### File Operations

- **Create File/Directory**: Click the "+ FILE" or "+ DIR" button in the left panel
- **Upload File**: Click the "UPLOAD" button to select local files
- **Rename**: Click the "R" button next to files/directories
- **Delete**: Click the "D" button next to files/directories
- **Download**: Click the "↓" button next to files

## Notes

- This extension only works on pages that support OPFS
- Currently, SQLite database viewing is in read-only mode
- Directory renaming functionality is not fully supported yet
- Some file types may not be previewable

## Supported File Types

### SQLite Databases
- .sqlite
- .db
- .sqlite3
- .db3

### Images
- .png, .jpg, .jpeg, .gif, .webp, .bmp, .svg

### Text Files
- .txt, .log, .json, .md, .csv, .xml, .yaml, .yml, .js, .ts, .html, .css

## Project Structure

```
├── dist/             # Built files
│   ├── assets/       # Static resources
│   ├── lib/          # Dependent libraries (such as SQLite WASM)
│   └── ...           # Extension-related files
├── src/              # Source code
│   ├── devtools.js   # DevTools panel creation
│   ├── main.jsx      # Main application component
│   └── styles.css    # Style files
├── manifest.json     # Extension configuration file
├── package.json      # Project configuration file
├── README.md         # English description file
└── README_CN.md      # Chinese description file
```

## Development Guide

### Install Dependencies

```bash
npm install
```

### Build Project

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

## License

This project is licensed under the GNU General Public License v3.0. See the [licenses](licenses) file for details.

## Contribution

Welcome to submit Issues and Pull Requests to improve this project!

## Contact

If you have any questions or suggestions, please submit an Issue in the project repository.