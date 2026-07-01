import { useState } from 'react';
import { useAtom } from 'jotai';
import { useLocation } from 'wouter';
import { loadSchemaAtom } from '../atoms/schema';
import { listSnapshots, loadSnapshot, deleteSnapshot } from '../utils/storage';

interface SaveItem {
  key: string;
  name: string;
}

export function SavesBrowser() {
  const [saves, setSaves] = useState<SaveItem[]>(() =>
    listSnapshots().map((item) => ({ key: item.key, name: item.name }))
  );
  const [, loadSchema] = useAtom(loadSchemaAtom);
  const [, navigate] = useLocation();

  const refreshSaves = () => {
    const items = listSnapshots().map((item) => ({
      key: item.key,
      name: item.name,
    }));
    setSaves(items);
  };

  const handleLoad = (key: string) => {
    const schema = loadSnapshot(key);
    if (schema) {
      loadSchema(schema);
      navigate('/');
    }
  };

  const handleDelete = (key: string) => {
    if (confirm('Delete this saved schema?')) {
      deleteSnapshot(key);
      refreshSaves();
    }
  };

  return (
    <div className="saves-browser">
      <div className="saves-header">
        <h1>Saved Schemas</h1>
        <a href="#" className="toolbar-link">
          ← Back to editor
        </a>
      </div>

      {saves.length === 0 ? (
        <p>No saved schemas found.</p>
      ) : (
        <ul className="saves-list">
          {saves.map((save) => (
            <li key={save.key} className="save-item">
              <span className="save-name">{save.name}</span>
              <div className="save-actions">
                <button onClick={() => handleLoad(save.key)}>Load</button>
                <button onClick={() => handleDelete(save.key)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
