import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { nanoid } from 'nanoid';
import { tablesAtom, relationshipsAtom, createColumn } from '../atoms/schema';
import { selectedTableIdAtom, editingNodeIdAtom } from '../atoms/ui';
import { MYSQL_DATA_TYPES } from '../utils/mysqlTypes';
import type { Column, Relationship, Table } from '../types';

export interface TableNodeData extends Record<string, unknown> {
  tableId: string;
}

export type TableNodeType = Node<TableNodeData, 'tableNode'>;

function isForeignKeyColumn(table: Table, columnId: string, relationships: Relationship[]) {
  return relationships.some(
    (rel) =>
      rel.sourceTableId === table.id &&
      rel.mappings.some((m) => m.sourceColumnId === columnId)
  );
}

export function TableNode(props: NodeProps<TableNodeType>) {
  const { id, selected } = props;
  const tables = useAtomValue(tablesAtom);
  const relationships = useAtomValue(relationshipsAtom);
  const setTables = useSetAtom(tablesAtom);
  const setRelationships = useSetAtom(relationshipsAtom);
  const setSelectedTableId = useSetAtom(selectedTableIdAtom);
  const setEditingNodeId = useSetAtom(editingNodeIdAtom);
  const nodeRef = useRef<HTMLDivElement>(null);

  const table = useMemo(
    () => tables.find((t) => t.id === id) as Table | undefined,
    [tables, id]
  );

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editColumns, setEditColumns] = useState<Column[]>([]);
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);

  const saveEdit = useCallback(() => {
    if (!table) return;
    setTables({
      type: 'UPDATE_TABLE',
      payload: { id: table.id, name: editName, columns: editColumns },
    });

    // Cascade data-type changes from referenced (target) columns to dependent FK columns.
    const originalColumnsById = new Map(table.columns.map((c) => [c.id, c]));
    const changedDataTypeColumns = editColumns.filter((column) => {
      const original = originalColumnsById.get(column.id);
      return original && original.dataType !== column.dataType;
    });

    if (changedDataTypeColumns.length > 0) {
      const getColumn = (tableId: string, columnId: string): Column | undefined => {
        if (tableId === table.id) {
          return editColumns.find((c) => c.id === columnId);
        }
        return tables.find((t) => t.id === tableId)?.columns.find((c) => c.id === columnId);
      };

      const changedById = new Map(changedDataTypeColumns.map((c) => [c.id, c]));
      relationships.forEach((relationship) => {
        if (relationship.targetTableId !== table.id) return;
        relationship.mappings.forEach((mapping) => {
          const changedColumn = changedById.get(mapping.targetColumnId);
          if (!changedColumn) return;
          const sourceColumn = getColumn(relationship.sourceTableId, mapping.sourceColumnId);
          if (!sourceColumn || sourceColumn.dataType === changedColumn.dataType) return;
          setTables({
            type: 'UPDATE_COLUMN',
            payload: {
              tableId: relationship.sourceTableId,
              column: { ...sourceColumn, dataType: changedColumn.dataType },
            },
          });
        });
      });
    }

    // Delete relationships whose FK source columns were removed.
    const keptColumnIds = new Set(editColumns.map((c) => c.id));
    const removedColumnIds = table.columns
      .filter((c) => !keptColumnIds.has(c.id))
      .map((c) => c.id);
    relationships
      .filter(
        (r) =>
          r.sourceTableId === table.id &&
          r.mappings.some((m) => removedColumnIds.includes(m.sourceColumnId))
      )
      .forEach((r) => setRelationships({ type: 'DELETE_RELATIONSHIP', payload: { id: r.id } }));

    setIsEditing(false);
    setEditingNodeId(null);
  }, [table, editName, editColumns, setTables, setRelationships, setEditingNodeId, relationships, tables]);

  const deleteTable = useCallback(() => {
    if (!table) return;
    if (!confirm(`Delete table "${table.name}"?`)) return;
    setTables({ type: 'DELETE_TABLE', payload: { id: table.id } });
    relationships
      .filter((r) => r.sourceTableId === table.id || r.targetTableId === table.id)
      .forEach((r) => setRelationships({ type: 'DELETE_RELATIONSHIP', payload: { id: r.id } }));
    setSelectedTableId(null);
  }, [table, relationships, setTables, setRelationships, setSelectedTableId]);

  const startEditing = useCallback(() => {
    if (!table) return;
    setEditName(table.name);
    setEditColumns(table.columns);
    setIsEditing(true);
    setSelectedTableId(table.id);
    setEditingNodeId(table.id);
  }, [table, setSelectedTableId, setEditingNodeId]);

  // Click outside to finish editing.
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (nodeRef.current && !nodeRef.current.contains(event.target as Element)) {
        saveEdit();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing, saveEdit]);

  if (!table) return null;

  const addColumn = (isPrimaryKey: boolean) => {
    const newColumn = createColumn(
      nanoid(),
      isPrimaryKey ? 'id' : 'column_name',
      isPrimaryKey ? 'INT' : 'VARCHAR',
      isPrimaryKey,
      isPrimaryKey ? undefined : true,
      undefined
    );
    setEditColumns([...editColumns, newColumn]);
  };

  const updateColumn = (updated: Column) => {
    setEditColumns(editColumns.map((c) => (c.id === updated.id ? updated : c)));
  };

  const deleteColumn = (columnId: string) => {
    setEditColumns(editColumns.filter((c) => c.id !== columnId));
  };

  const togglePrimaryKey = (column: Column) => {
    const isPrimaryKey = !column.isPrimaryKey;
    updateColumn({
      ...column,
      isPrimaryKey,
      isNullable: isPrimaryKey ? undefined : true,
      defaultValue: isPrimaryKey ? undefined : column.defaultValue,
    });
  };

  const reorderColumns = (draggedId: string, targetId: string) => {
    const draggedIndex = editColumns.findIndex((c) => c.id === draggedId);
    const targetIndex = editColumns.findIndex((c) => c.id === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    const draggedColumn = editColumns[draggedIndex];
    const targetColumn = editColumns[targetIndex];
    if (draggedColumn.isPrimaryKey !== targetColumn.isPrimaryKey) return;

    const newColumns = [...editColumns];
    const [removed] = newColumns.splice(draggedIndex, 1);
    newColumns.splice(targetIndex, 0, removed);
    setEditColumns(newColumns);
  };

  const createDragHandlers = (column: Column) => ({
    onDragStart: () => setDraggedColumnId(column.id),
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: () => {
      if (draggedColumnId && draggedColumnId !== column.id) {
        reorderColumns(draggedColumnId, column.id);
      }
      setDraggedColumnId(null);
    },
    onDragEnd: () => setDraggedColumnId(null),
    isDragging: draggedColumnId === column.id,
  });

  const displayColumns = isEditing ? editColumns : table.columns;
  const pkColumns = displayColumns.filter((c) => c.isPrimaryKey);
  const normalColumns = displayColumns.filter((c) => !c.isPrimaryKey);

  return (
    <div
      ref={nodeRef}
      className={`table-node ${selected ? 'selected' : ''} ${isEditing ? 'editing' : ''}`}
      onClick={() => setSelectedTableId(table.id)}
      onDoubleClick={() => startEditing()}
      onPointerDown={isEditing ? (e) => e.stopPropagation() : undefined}
      onMouseDown={isEditing ? (e) => e.stopPropagation() : undefined}
    >
      <Handle
        type="source"
        position={Position.Top}
        id="fk-in"
        className={`table-handle table-handle--tl ${selected || isEditing ? 'visible' : ''}`}
        title="Create FK from this table"
        style={{ left: 0, top: 0, transform: 'translate(-50%, -50%)' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="fk-out"
        className={`table-handle table-handle--br ${selected || isEditing ? 'visible' : ''}`}
        title="Create FK referencing this table"
        style={{ left: '100%', top: '100%', transform: 'translate(-50%, -50%)' }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        className="table-handle-target table-handle-target--top"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="target-bottom"
        className="table-handle-target table-handle-target--bottom"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className="table-handle-target table-handle-target--left"
      />
      <Handle
        type="target"
        position={Position.Right}
        id="target-right"
        className="table-handle-target table-handle-target--right"
      />

      <div className="table-header">
        {isEditing ? (
          <input
            className="table-name-input"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit();
            }}
            autoFocus
          />
        ) : (
          <>
            <span>{table.name}</span>
            <button
              className="table-edit-btn"
              onClick={(e) => {
                e.stopPropagation();
                startEditing();
              }}
              title="Edit table"
            >
              ✎
            </button>
            <button
              className="table-delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                deleteTable();
              }}
              title="Delete table"
            >
              🗑
            </button>
          </>
        )}
      </div>

      <div className="table-section">
        {pkColumns.length === 0 && !isEditing && (
          <div className="table-empty">No primary keys</div>
        )}
        {pkColumns.map((column) =>
          isEditing ? (
            <InlineColumnEditor
              key={column.id}
              column={column}
              onChange={updateColumn}
              onDelete={deleteColumn}
              onTogglePk={() => togglePrimaryKey(column)}
              dragHandlers={createDragHandlers(column)}
            />
          ) : (
            <div key={column.id} className="table-row table-row--pk">
              <div className="table-row-name-cell">
                <span className="table-row-icon">🔑</span>
                <span className="table-row-name">{column.name}</span>
              </div>
              <span className="table-row-type">{column.dataType}</span>
            </div>
          )
        )}
        {isEditing && (
          <button className="table-add-column" onClick={() => addColumn(true)}>
            + PK
          </button>
        )}
      </div>

      <div className="table-divider" />

      <div className="table-section">
        {normalColumns.length === 0 && pkColumns.length === 0 && !isEditing && (
          <div className="table-empty">No columns</div>
        )}
        {normalColumns.map((column) => {
          if (isEditing) {
            return (
              <InlineColumnEditor
                key={column.id}
                column={column}
                onChange={updateColumn}
                onDelete={deleteColumn}
                onTogglePk={() => togglePrimaryKey(column)}
                dragHandlers={createDragHandlers(column)}
              />
            );
          }
          const isFk = isForeignKeyColumn(table, column.id, relationships);
          return (
            <div key={column.id} className={`table-row ${isFk ? 'table-row--fk' : ''}`}>
              <div className="table-row-name-cell">
                {isFk && <span className="table-row-icon">🔗</span>}
                <span className="table-row-name">{column.name}</span>
              </div>
              <span className="table-row-type">{column.dataType}</span>
              <div className="table-row-badges">
                {column.isNullable === false && (
                  <span className="table-row-badge table-row-badge--nn">NOT NULL</span>
                )}
                {column.defaultValue !== undefined && column.defaultValue !== '' && (
                  <span className="table-row-badge table-row-badge--default">
                    DEFAULT {column.defaultValue}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {isEditing && (
          <button className="table-add-column" onClick={() => addColumn(false)}>
            + Column
          </button>
        )}
      </div>

      {isEditing && (
        <div className="table-edit-actions">
          <button className="btn-primary" onClick={saveEdit}>
            Done
          </button>
        </div>
      )}
    </div>
  );
}

interface InlineColumnEditorProps {
  column: Column;
  onChange: (column: Column) => void;
  onDelete: (id: string) => void;
  onTogglePk: () => void;
  dragHandlers?: {
    onDragStart: () => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onDragEnd: (e: React.DragEvent) => void;
    isDragging: boolean;
  };
}

function InlineColumnEditor({ column, onChange, onDelete, onTogglePk, dragHandlers }: InlineColumnEditorProps) {
  return (
    <div
      className={`inline-column-editor ${dragHandlers?.isDragging ? 'dragging' : ''}`}
      onDragOver={dragHandlers?.onDragOver}
      onDrop={dragHandlers?.onDrop}
    >
      <input
        type="text"
        value={column.name}
        onChange={(e) => onChange({ ...column, name: e.target.value })}
        placeholder={column.isPrimaryKey ? '<pk column name>' : '<column name>'}
      />
      <input
        type="text"
        list="mysql-data-types"
        value={column.dataType}
        onChange={(e) => onChange({ ...column, dataType: e.target.value })}
        placeholder="<data type>"
        className="datatype-input"
      />
      <datalist id="mysql-data-types">
        {MYSQL_DATA_TYPES.map((type) => (
          <option key={type} value={type} />
        ))}
      </datalist>
      {!column.isPrimaryKey && (
        <>
          <input
            type="text"
            value={column.defaultValue ?? ''}
            onChange={(e) =>
              onChange({ ...column, defaultValue: e.target.value || undefined })
            }
            placeholder="DEFAULT"
            className="default-input"
            title="DEFAULT value"
          />
          <select
            value={column.isNullable === false ? 'not-null' : 'null'}
            onChange={(e) =>
              onChange({ ...column, isNullable: e.target.value === 'null' })
            }
            title="NULL / NOT NULL"
          >
            <option value="null">NULL</option>
            <option value="not-null">NOT NULL</option>
          </select>
        </>
      )}
      {dragHandlers && (
        <span
          className="column-drag-handle"
          draggable
          onDragStart={dragHandlers.onDragStart}
          onDragEnd={dragHandlers.onDragEnd}
          title="Drag to reorder"
        >
          ⋮⋮
        </span>
      )}
      <button onClick={onTogglePk} title="Toggle primary key">
        {column.isPrimaryKey ? '🔑' : '○'}
      </button>
      <button onClick={() => onDelete(column.id)} title="Delete column">
        🗑
      </button>
    </div>
  );
}
