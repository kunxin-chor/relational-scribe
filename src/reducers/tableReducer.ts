import type { Table, TableAction } from '../types';

export function tableReducer(tables: Table[], action: TableAction): Table[] {
  switch (action.type) {
    case 'ADD_TABLE':
      return [...tables, action.payload];

    case 'UPDATE_TABLE': {
      const { id, ...rest } = action.payload;
      return tables.map((table) =>
        table.id === id ? { ...table, ...rest } : table
      );
    }

    case 'DELETE_TABLE':
      return tables.filter((table) => table.id !== action.payload.id);

    case 'MOVE_TABLE':
      return tables.map((table) =>
        table.id === action.payload.id
          ? { ...table, x: action.payload.x, y: action.payload.y }
          : table
      );

    case 'ADD_COLUMN':
      return tables.map((table) =>
        table.id === action.payload.tableId
          ? { ...table, columns: [...table.columns, action.payload.column] }
          : table
      );

    case 'UPDATE_COLUMN':
      return tables.map((table) =>
        table.id === action.payload.tableId
          ? {
              ...table,
              columns: table.columns.map((column) =>
                column.id === action.payload.column.id
                  ? action.payload.column
                  : column
              ),
            }
          : table
      );

    case 'DELETE_COLUMN':
      return tables.map((table) =>
        table.id === action.payload.tableId
          ? {
              ...table,
              columns: table.columns.filter(
                (column) => column.id !== action.payload.columnId
              ),
            }
          : table
      );

    default:
      return tables;
  }
}
