export interface EmployeeRow {
  id: string; // Unique internal ID for React keys
  [key: string]: string | number | boolean;
}

export interface SheetData {
  fileName: string;
  sheetName: string;
  headers: string[];
  rows: any[];
}

export interface ColumnMapping {
  targetField: string;
  sourceHeaders: string[]; // Which headers from the uploaded files map to this target
}

export interface FieldDefinition {
  key: string;
  label: string;
  type: 'string' | 'number';
}

export type MergeMethod = 'vertical' | 'join';
export type JoinType = 'outer' | 'inner' | 'left';

export interface MergeConfig {
  method: MergeMethod;
  joinKey: string; // The target field key used as the primary key
  joinType: JoinType;
  removeDuplicates: boolean;
}

export enum AppStep {
  UPLOAD = 'UPLOAD',
  MAPPING = 'MAPPING',
  PREVIEW = 'PREVIEW',
}

export enum AppMode {
  SPLITTER = 'SPLITTER',
  CLEANER = 'CLEANER',
}

// Removed MANDATORY_FIELDS to make the app generic