import { useReducer } from 'react';

const SCHEMA_TYPES = ['table', 'view', 'index', 'trigger'];

const createEmptySchemaGroups = () => {
  return Object.fromEntries(SCHEMA_TYPES.map((type) => [type, []]));
};

const initialState = {
  tree: [],
  selectedFile: null,
  loading: false,
  status: 'Ready',
  textPreview: '',
  imagePreviewUrl: '',
  schemaGroups: createEmptySchemaGroups(),
  selectedSchema: null,
  gridColumns: [],
  gridRows: [],
  columnTypes: {},
  sortState: { key: '', dir: 'asc' },
  currentPage: 1,
  totalRows: 0,
  jumpPageInput: '1',
  tableSearchTerm: '',
  dataSearchTerm: '',
  dbList: [],
  diag: { sqliteMasterCount: 0, sqliteSchemaCount: 0, dbList: [] },
  dbInfo: { sqliteVersion: '', pageSize: 0, pageCount: 0, freelistCount: 0, journalMode: '', autoVacuum: 0, encoding: '', userVersion: 0, schemaVersion: 0 },
  activeSchemaType: 'table',
  indexMeta: { unique: 0, partial: 0, origin: '', columns: [] },
  triggerMeta: { timing: '', event: '', whenExpr: '' },
  ctxMeta: { href: '', origin: '', hasOPFS: false, isSecureContext: false }
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_TREE':
      return { ...state, tree: action.payload };
    case 'SET_SELECTED_FILE':
      return { ...state, selectedFile: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_STATUS':
      return { ...state, status: action.payload };
    case 'SET_TEXT_PREVIEW':
      return { ...state, textPreview: action.payload };
    case 'SET_IMAGE_PREVIEW_URL':
      return { ...state, imagePreviewUrl: action.payload };
    case 'SET_SCHEMA_GROUPS':
      return { ...state, schemaGroups: action.payload };
    case 'SET_SELECTED_SCHEMA':
      return { ...state, selectedSchema: action.payload };
    case 'SET_GRID_COLUMNS':
      return { ...state, gridColumns: action.payload };
    case 'SET_GRID_ROWS':
      return { ...state, gridRows: action.payload };
    case 'SET_COLUMN_TYPES':
      return { ...state, columnTypes: action.payload };
    case 'SET_SORT_STATE':
      return { ...state, sortState: action.payload };
    case 'SET_CURRENT_PAGE':
      return { ...state, currentPage: action.payload };
    case 'SET_TOTAL_ROWS':
      return { ...state, totalRows: action.payload };
    case 'SET_JUMP_PAGE_INPUT':
      return { ...state, jumpPageInput: action.payload };
    case 'SET_TABLE_SEARCH_TERM':
      return { ...state, tableSearchTerm: action.payload };
    case 'SET_DATA_SEARCH_TERM':
      return { ...state, dataSearchTerm: action.payload };
    case 'SET_DB_LIST':
      return { ...state, dbList: action.payload };
    case 'SET_DIAG':
      return { ...state, diag: action.payload };
    case 'SET_DB_INFO':
      return { ...state, dbInfo: action.payload };
    case 'SET_ACTIVE_SCHEMA_TYPE':
      return { ...state, activeSchemaType: action.payload };
    case 'SET_INDEX_META':
      return { ...state, indexMeta: action.payload };
    case 'SET_TRIGGER_META':
      return { ...state, triggerMeta: action.payload };
    case 'SET_CTX_META':
      return { ...state, ctxMeta: action.payload };
    case 'CLEAR_PREVIEW':
      return {
        ...state,
        textPreview: '',
        imagePreviewUrl: '',
        schemaGroups: createEmptySchemaGroups(),
        selectedSchema: null,
        gridColumns: [],
        gridRows: [],
        columnTypes: {},
        currentPage: 1,
        totalRows: 0,
        jumpPageInput: '1',
        dbList: [],
        diag: { sqliteMasterCount: 0, sqliteSchemaCount: 0, dbList: [] },
        dbInfo: { sqliteVersion: '', pageSize: 0, pageCount: 0, freelistCount: 0, journalMode: '', autoVacuum: 0, encoding: '', userVersion: 0, schemaVersion: 0 },
        activeSchemaType: 'table',
        indexMeta: { unique: 0, partial: 0, origin: '', columns: [] },
        triggerMeta: { timing: '', event: '', whenExpr: '' }
      };
    default:
      return state;
  }
}

export function useAppState() {
  return useReducer(appReducer, initialState);
}
