import type { SchemaFile } from '../types';

const CURRENT_KEY = 'schema:current';
const SNAPSHOT_PREFIX = 'schema:snapshot:';

export function saveCurrent(schema: SchemaFile): void {
  localStorage.setItem(CURRENT_KEY, JSON.stringify(schema));
}

export function loadCurrent(): SchemaFile | null {
  const raw = localStorage.getItem(CURRENT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SchemaFile;
  } catch {
    return null;
  }
}

export function listSnapshots(): Array<{ key: string; name: string; savedAt: number }> {
  const items: Array<{ key: string; name: string; savedAt: number }> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(SNAPSHOT_PREFIX)) {
      try {
        const schema = JSON.parse(localStorage.getItem(key)!) as SchemaFile;
        items.push({ key, name: schema.name || 'Untitled', savedAt: Date.now() });
      } catch {
        // ignore invalid entries
      }
    }
  }
  return items;
}

export function saveSnapshot(name: string, schema: SchemaFile): void {
  localStorage.setItem(
    `${SNAPSHOT_PREFIX}${name}`,
    JSON.stringify({ ...schema, name })
  );
}

export function loadSnapshot(key: string): SchemaFile | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SchemaFile;
  } catch {
    return null;
  }
}

export function deleteSnapshot(key: string): void {
  localStorage.removeItem(key);
}

export function downloadJson(schema: SchemaFile): void {
  const blob = new Blob([JSON.stringify(schema, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${schema.name || 'schema'}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function readJsonFile(file: File): Promise<SchemaFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const schema = JSON.parse(reader.result as string) as SchemaFile;
        resolve(schema);
      } catch {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
