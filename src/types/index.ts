export interface Column {
  id: string;
  name: string;
  dataType: string;
  isPrimaryKey: boolean;
}

export interface Table {
  id: string;
  name: string;
  x: number;
  y: number;
  columns: Column[];
}

export interface RelationshipColumnMapping {
  sourceColumnId: string;
  targetColumnId: string;
}

export interface Relationship {
  id: string;
  sourceTableId: string;
  targetTableId: string;
  mappings: RelationshipColumnMapping[];
}

export interface SchemaFile {
  version: 1;
  name: string;
  tables: Table[];
  relationships: Relationship[];
}

export type TableAction =
  | { type: 'ADD_TABLE'; payload: Table }
  | { type: 'UPDATE_TABLE'; payload: Partial<Table> & { id: string } }
  | { type: 'DELETE_TABLE'; payload: { id: string } }
  | { type: 'MOVE_TABLE'; payload: { id: string; x: number; y: number } }
  | { type: 'ADD_COLUMN'; payload: { tableId: string; column: Column } }
  | { type: 'UPDATE_COLUMN'; payload: { tableId: string; column: Column } }
  | { type: 'DELETE_COLUMN'; payload: { tableId: string; columnId: string } };

export type RelationshipAction =
  | { type: 'ADD_RELATIONSHIP'; payload: Relationship }
  | { type: 'UPDATE_RELATIONSHIP'; payload: Relationship }
  | { type: 'DELETE_RELATIONSHIP'; payload: { id: string } };
