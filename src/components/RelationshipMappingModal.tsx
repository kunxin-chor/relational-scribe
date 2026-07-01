import { useAtom, useAtomValue } from 'jotai';
import { useState, useMemo } from 'react';
import { nanoid } from 'nanoid';
import { mappingRelationshipAtom } from '../atoms/ui';
import { relationshipsAtom, tablesAtom, createRelationship, createColumn } from '../atoms/schema';
import type { Column, RelationshipColumnMapping } from '../types';

const CREATE_NEW_OPTION = '__create_new__';

function getUniqueColumnName(baseName: string, existingNames: Set<string>): string {
  if (!existingNames.has(baseName)) return baseName;
  let suffix = 1;
  let name = `${baseName}_${suffix}`;
  while (existingNames.has(name)) {
    suffix += 1;
    name = `${baseName}_${suffix}`;
  }
  return name;
}

export function RelationshipMappingModal() {
  const [mappingRelationship, setMappingRelationship] = useAtom(mappingRelationshipAtom);
  const tables = useAtomValue(tablesAtom);
  const [, setRelationships] = useAtom(relationshipsAtom);
  const [, setTables] = useAtom(tablesAtom);

  const relationship = mappingRelationship;

  const sourceTable = useMemo(
    () => tables.find((t) => t.id === relationship?.sourceTableId),
    [tables, relationship]
  );
  const targetTable = useMemo(
    () => tables.find((t) => t.id === relationship?.targetTableId),
    [tables, relationship]
  );
  const existingSourceNames = useMemo(
    () => new Set(sourceTable?.columns.map((c) => c.name) ?? []),
    [sourceTable]
  );

  const [mappings, setMappings] = useState<RelationshipColumnMapping[]>([]);

  if (!relationship || !sourceTable || !targetTable) return null;

  const addMapping = () => {
    const targetColumn = targetTable.columns.find(
      (c) => !mappings.some((m) => m.targetColumnId === c.id)
    );
    if (!targetColumn) return;

    setMappings([
      ...mappings,
      {
        sourceColumnId: CREATE_NEW_OPTION,
        targetColumnId: targetColumn.id,
      },
    ]);
  };

  const updateMapping = (
    index: number,
    key: keyof RelationshipColumnMapping,
    value: string
  ) => {
    setMappings(
      mappings.map((m, i) => (i === index ? { ...m, [key]: value } : m))
    );
  };

  const removeMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!sourceTable || !targetTable) return;

    const finalMappings: RelationshipColumnMapping[] = [];
    const reservedNames = new Set(existingSourceNames);

    mappings.forEach((mapping) => {
      const targetColumn = targetTable.columns.find((c) => c.id === mapping.targetColumnId);
      if (!targetColumn) return;

      let sourceColumnId = mapping.sourceColumnId;

      if (sourceColumnId === CREATE_NEW_OPTION) {
        // Create a new FK column in the source table with a unique name.
        const baseName = targetColumn.name;
        const uniqueName = getUniqueColumnName(baseName, reservedNames);
        reservedNames.add(uniqueName);
        const newColumn: Column = createColumn(
          nanoid(),
          uniqueName,
          targetColumn.dataType,
          false
        );
        setTables({
          type: 'ADD_COLUMN',
          payload: { tableId: sourceTable.id, column: newColumn },
        });
        sourceColumnId = newColumn.id;
      }

      finalMappings.push({ sourceColumnId, targetColumnId: mapping.targetColumnId });
    });

    setRelationships({
      type: 'ADD_RELATIONSHIP',
      payload: createRelationship(
        relationship.id,
        relationship.sourceTableId,
        relationship.targetTableId,
        finalMappings
      ),
    });
    setMappingRelationship(null);
    setMappings([]);
  };

  const handleCancel = () => {
    setMappingRelationship(null);
    setMappings([]);
  };

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Map Foreign Key</h2>
        <p>
          Foreign key table: <strong>{sourceTable.name}</strong>
          <br />
          References table: <strong>{targetTable.name}</strong>
        </p>

        <p className="mapping-criteria">
          Only destination columns with the same data type as the selected origin key can be selected.
        </p>

        <div className="mapping-list">
          {mappings.map((mapping, index) => {
            const sourceColumn =
              mapping.sourceColumnId === CREATE_NEW_OPTION
                ? null
                : sourceTable.columns.find((c) => c.id === mapping.sourceColumnId);
            const targetColumn = targetTable.columns.find(
              (c) => c.id === mapping.targetColumnId
            );
            const proposedName = targetColumn
              ? getUniqueColumnName(targetColumn.name, existingSourceNames)
              : '';

            const allowedTargetColumns = sourceColumn
              ? targetTable.columns.filter(
                  (c) => c.dataType.toUpperCase() === sourceColumn.dataType.toUpperCase()
                )
              : targetTable.columns;

            return (
              <div key={index} className="mapping-row">
                <label className="mapping-field">
                  <span className="mapping-label">{sourceTable.name}</span>
                  <select
                    value={mapping.sourceColumnId}
                    onChange={(e) => {
                      const newSourceId = e.target.value;
                      updateMapping(index, 'sourceColumnId', newSourceId);

                      if (newSourceId !== CREATE_NEW_OPTION) {
                        const selectedSource = sourceTable.columns.find(
                          (c) => c.id === newSourceId
                        );
                        if (selectedSource) {
                          const matchingTargets = targetTable.columns.filter(
                            (c) =>
                              c.dataType.toUpperCase() === selectedSource.dataType.toUpperCase()
                          );
                          if (
                            matchingTargets.length > 0 &&
                            !matchingTargets.some((c) => c.id === mapping.targetColumnId)
                          ) {
                            updateMapping(index, 'targetColumnId', matchingTargets[0].id);
                          }
                        }
                      }
                    }}
                  >
                    <option value={CREATE_NEW_OPTION}>+ New Key</option>
                    {sourceTable.columns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.dataType})
                      </option>
                    ))}
                  </select>
                  {mapping.sourceColumnId === CREATE_NEW_OPTION && (
                    <span className="mapping-hint">Will create: {proposedName}</span>
                  )}
                </label>
                <span className="mapping-arrow">→</span>
                <label className="mapping-field">
                  <span className="mapping-label">{targetTable.name}</span>
                  <select
                    value={mapping.targetColumnId}
                    onChange={(e) => updateMapping(index, 'targetColumnId', e.target.value)}
                  >
                    {allowedTargetColumns.length === 0 ? (
                      <option value="">No matching columns</option>
                    ) : (
                      allowedTargetColumns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.dataType})
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <button onClick={() => removeMapping(index)}>🗑</button>
              </div>
            );
          })}
        </div>

        <button onClick={addMapping}>+ Add Column Mapping</button>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave}>
            Save Relationship
          </button>
        </div>
      </div>
    </div>
  );
}
