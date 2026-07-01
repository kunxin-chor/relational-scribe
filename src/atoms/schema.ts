import { atom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';
import type { Column, Relationship, RelationshipColumnMapping, SchemaFile, Table, TableAction, RelationshipAction } from '../types';
import { tableReducer } from '../reducers/tableReducer';
import { relationshipReducer } from '../reducers/relationshipReducer';

const defaultSchema: SchemaFile = {
  version: 1,
  name: 'Untitled Schema',
  tables: [],
  relationships: [],
};

const storage = createJSONStorage<SchemaFile>(() => localStorage);

export const schemaAtom = atomWithStorage<SchemaFile>('schema:current', defaultSchema, storage);

export const schemaNameAtom = atom(
  (get) => get(schemaAtom).name,
  (get, set, name: string) => {
    set(schemaAtom, { ...get(schemaAtom), name });
  }
);

export const tablesAtom = atom(
  (get) => get(schemaAtom).tables,
  (get, set, action: TableAction) => {
    set(schemaAtom, {
      ...get(schemaAtom),
      tables: tableReducer(get(schemaAtom).tables, action),
    });
  }
);

export const relationshipsAtom = atom(
  (get) => get(schemaAtom).relationships,
  (get, set, action: RelationshipAction) => {
    set(schemaAtom, {
      ...get(schemaAtom),
      relationships: relationshipReducer(get(schemaAtom).relationships, action),
    });
  }
);

export const loadSchemaAtom = atom(null, (_get, set, schema: SchemaFile) => {
  set(schemaAtom, schema);
});

export const clearSchemaAtom = atom(null, (_get, set) => {
  set(schemaAtom, defaultSchema);
});

export function createTable(id: string, name: string, x: number, y: number): Table {
  return {
    id,
    name,
    x,
    y,
    columns: [],
  };
}

export function createColumn(
  id: string,
  name: string,
  dataType: string,
  isPrimaryKey = false,
  isNullable?: boolean,
  defaultValue?: string
): Column {
  return {
    id,
    name,
    dataType,
    isPrimaryKey,
    isNullable,
    defaultValue,
  };
}

export function createRelationship(
  id: string,
  sourceTableId: string,
  targetTableId: string,
  mappings: RelationshipColumnMapping[] = []
): Relationship {
  return {
    id,
    sourceTableId,
    targetTableId,
    mappings,
  };
}
