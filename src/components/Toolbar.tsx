import { useRef, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { schemaAtom, schemaNameAtom, loadSchemaAtom, clearSchemaAtom } from '../atoms/schema';
import { addTableCallbackAtom } from '../atoms/ui';
import { saveCurrent, saveSnapshot, downloadJson, readJsonFile } from '../utils/storage';
import { exportPng } from '../utils/export';

interface ToolbarProps {
  flowRef: React.RefObject<HTMLDivElement | null>;
}

export function Toolbar({ flowRef }: ToolbarProps) {
  const [schemaName, setSchemaName] = useAtom(schemaNameAtom);
  const schema = useAtomValue(schemaAtom);
  const [, loadSchema] = useAtom(loadSchemaAtom);
  const [, clearSchema] = useAtom(clearSchemaAtom);
  const addTableCallback = useAtomValue(addTableCallbackAtom);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTableName, setNewTableName] = useState('');

  const openAddTableDialog = () => {
    setNewTableName('');
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setNewTableName('');
  };

  const confirmAddTable = () => {
    const name = newTableName.trim();
    if (!name) return;
    addTableCallback?.(name);
    closeDialog();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      confirmAddTable();
    } else if (event.key === 'Escape') {
      closeDialog();
    }
  };

  const handleSave = () => {
    saveCurrent(schema);
    saveSnapshot(schemaName, schema);
    alert('Saved to localStorage');
  };

  const handleDownload = () => {
    downloadJson(schema);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const schema = await readJsonFile(file);
      loadSchema(schema);
    } catch {
      alert('Failed to load file');
    }
    event.target.value = '';
  };

  const handleExportPng = async () => {
    if (!flowRef.current) return;
    try {
      await exportPng(flowRef.current, schemaName || 'schema');
    } catch {
      alert('Failed to export PNG');
    }
  };

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <input
          type="text"
          value={schemaName}
          onChange={(e) => setSchemaName(e.target.value)}
          placeholder="Schema name"
          className="toolbar-input"
        />
      </div>

      <div className="toolbar-group">
        <button onClick={openAddTableDialog}>+ Table</button>
        <button onClick={() => { if (confirm('Start a new canvas?')) clearSchema(); }}>New</button>
        <button onClick={handleSave}>Save</button>
        <button onClick={handleDownload}>Download JSON</button>
        <button onClick={handleUploadClick}>Upload JSON</button>
        <button onClick={handleExportPng}>Export PNG</button>
        <a href="#/saves" className="toolbar-link">
          Browse Saves
        </a>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {isDialogOpen && (
        <div className="modal-overlay" onClick={closeDialog}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Add New Table</h2>
            <div className="modal-field">
              <label htmlFor="new-table-name">Table name</label>
              <input
                id="new-table-name"
                type="text"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. users"
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={closeDialog}>
                Cancel
              </button>
              <button className="btn-primary" onClick={confirmAddTable}>
                Add Table
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
