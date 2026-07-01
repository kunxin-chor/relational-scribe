# Logical Schema Diagram Creator — MVP Proposal

## 1. Overview
Build a single-page, frontend-only React + TypeScript application that lets users draw logical database schemas (tables, columns, relationships) on a canvas. All persistence happens in the browser via `localStorage`, JSON download/upload, and PNG export.

This proposal focuses on the MVP scope from `requirements/requirements.md` and uses the mandated stack: **React, TypeScript, Jotai, wouter**.

## 2. Tech Stack
| Layer | Choice | Rationale |
|-------|--------|-----------|
| Build tool | Vite (React + TypeScript template) | Fast dev server, simple config, modern JSX transform. |
| State | Jotai | Lightweight atomic state; easy to persist and derive relationship/selection state. |
| Routing | wouter | Minimal router for the editor and a localStorage-saves browser view. |
| Canvas / diagram | `@xyflow/react` (React Flow) | Purpose-built for node-based diagrams: draggable nodes, connection handles, edges, pan/zoom. We render tables as custom nodes and sync state with Jotai. |
| Styling | Plain CSS + CSS custom properties | Keeps dependencies minimal and styling explicit; easy to migrate to Tailwind later if desired. |
| PNG export | `html-to-image` | Renders the DOM canvas as PNG without needing a backend. |
| UID | `nanoid` | Tiny, collision-resistant IDs for tables/columns/relationships. |

## 3. Data Model
```typescript
interface Column {
  id: string;
  name: string;
  dataType: string;     // MySQL type or free-text custom type
  isPrimaryKey: boolean;
}

interface Table {
  id: string;
  name: string;
  x: number;
  y: number;
  columns: Column[];
}

interface RelationshipColumnMapping {
  sourceColumnId: string; // column in the source table that is the FK
  targetColumnId: string; // column in the target table that is referenced
}

interface Relationship {
  id: string;
  sourceTableId: string;  // table that owns the FK
  targetTableId: string;  // referenced table
  mappings: RelationshipColumnMapping[];
}

interface SchemaFile {
  version: 1;
  name: string;
  tables: Table[];
  relationships: Relationship[];
}
```

## 4. Routing (wouter)
- `/` — Main editor canvas (`<ReactFlowProvider>` wraps the editor).
- `/saves` — Browse, rename, load, and delete schemas stored in `localStorage`.

## 5. State Management (Jotai)
| Atom | Purpose |
|------|---------|
| `tablesAtom` | Array of tables. Synced with React Flow node state. |
| `relationshipsAtom` | Array of relationships. Synced with React Flow edge state. |
| `selectedTableIdAtom` | Currently selected table (controls handle visibility). |
| `schemaNameAtom` | Current schema name (for save/download). |

Derived atoms:
- `nodesAtom` / `edgesAtom`: derive React Flow `Node[]` / `Edge[]` from our domain atoms.
- Persistence atom that auto-saves the current schema to a fixed `localStorage` key on every change.

React Flow internal state (node positions, selection, connection drafts) lives in the library; we translate changes back to our domain atoms via `onNodesChange`, `onEdgesChange`, `onConnect`, and `onNodeDragStop`.

## 6. Component Architecture
### Reusable Components
- `<SchemaFlow>` — React Flow `<ReactFlow>` setup: nodes/edges, pan/zoom, connection logic, background.
- `<TableNode>` — Custom React Flow node; draggable table card with name, primary-key section, normal-column section, and corner `<Handle>`s.
- Inline editing inside `<TableNode>`: clicking the edit icon on a table makes the table name and all columns editable directly on the canvas, with separate PK and normal column sections.
- `<RelationshipMappingModal>` — After dropping a handle on a target table, asks the user which source column maps to which target column.
- `<Toolbar>` — New table, save, download JSON, upload JSON, export PNG, browse saves.

### Reducers
- `tableReducer` — add / move / rename / delete / update columns.
- `relationshipReducer` — add / delete / update column mappings.

## 7. Key Interactions
| Requirement | Implementation |
|-------------|----------------|
| Create blank canvas + table | "New table" toolbar button; prompt for name via `window.prompt` (MVP). |
| Edit table | Click the ✎ icon on a table to enter inline editing mode. Table name and columns can be edited directly on the canvas. Click outside or press Done to save. |
| MySQL data types | Dropdown with common types (`INT`, `VARCHAR`, `TEXT`, `DATETIME`, `BOOLEAN`, `DECIMAL`, `JSON`, …) plus a free-text fallback. |
| PK vs normal columns | Two separate lists in the modal; toggle or drag columns between sections. |
| Corner handles | Appear on selected table: upper-left (create FK **to** destination in original) and lower-right (create FK **from** source **in** destination). |
| Drag relationship | React Flow `<Handle>` drag-to-connect → `onConnect` callback → open mapping modal. Relationship lines are straight and can be reconnected by dragging either end. |
| Column mapping | After drop, `<RelationshipMappingModal>` lets the user pick one or more source columns and match them to target columns. |
| FK presentation | Foreign-key columns are visually marked (e.g., key icon, badge, or highlighted row) in the table node. |
| Reposition tables | `onPointerDown` on table header → move table. |
| Save / New | Auto-save current schema to `localStorage` key `schema:current`; manual save writes a named snapshot. "New" button clears the canvas. |
| Export PNG | Render `<Canvas>` area to PNG via `html-to-image`. |
| Download JSON | Serialize `SchemaFile` and trigger download. |
| Upload JSON | File input → parse → load into atoms. |
| Browse localStorage | `/saves` route lists `localStorage` snapshots; load/rename/delete. |

## 8. Implementation Phases
### Phase 1 — Project skeleton
- Initialize Vite project, install deps (jotai, wouter, nanoid, html-to-image), set up folder structure.
- Add base types and initial empty schema.

### Phase 2 — Canvas & tables
- Set up `<SchemaFlow>` with `@xyflow/react`, custom `TableNode` node type, and corner `<Handle>`s.
- Toolbar: add table with name prompt, clear canvas.

### Phase 3 — Table editing
- `<TableEditModal>` with column management and MySQL datatype handling.
- PK / normal column sections.

### Phase 4 — Relationships
- Selection state and corner `<Handle>`s (top-left / bottom-right).
- `onConnect` callback + `<RelationshipMappingModal>` for column mapping.
- Visual FK indicator on table nodes.

### Phase 5 — Persistence & export
- localStorage auto-save and named snapshots.
- JSON download/upload.
- PNG export.
- `/saves` route.

### Phase 6 — Polish
- Basic styling, handle edge cases (duplicate names, empty states, invalid uploads, circular relationships). Manual QA of the full flow.

## 9. File Structure (proposed)
```
src/
  atoms/
    schema.ts
    ui.ts
  components/
    SchemaFlow.tsx
    TableNode.tsx
    RelationshipMappingModal.tsx
    Toolbar.tsx
    DeletableEdge.tsx
    SavesBrowser.tsx
  reducers/
    tableReducer.ts
    relationshipReducer.ts
  types/
    index.ts
  utils/
    mysqlTypes.ts
    storage.ts
    export.ts
  App.tsx
  main.tsx
  index.css
```

## 10. Trade-offs & Notes
- **Relationship detail level:** Relationships are table-to-table with explicit column mappings. The mapping modal is triggered immediately after the handle drop.
- **Inline editing:** Table name and columns are edited inline on the canvas, matching the SQLDBM-style interface shown in the requirements.
- **Name prompt:** Uses `window.prompt` when adding a new table.
- **Styling:** Plain CSS keeps the dependency list short and matches the "minimal intrusion" MVP goal.
- **Routing:** wouter is used for the `/saves` browser view so the editor stays clean.
- **PNG export:** Relies on DOM rendering; the canvas and tables must therefore be regular HTML elements, not a `<canvas>` API surface.

## 11. Success Criteria
- [ ] User can create, rename, and delete tables.
- [ ] User can add/edit/remove columns with MySQL or custom data types and mark primary keys.
- [ ] User can create directional relationships by dragging corner handles.
- [ ] After creating a relationship, the user can map source columns to target columns.
- [ ] Foreign-key columns are clearly marked on the table node.
- [ ] Relationship lines update when tables are moved.
- [ ] Schema auto-saves to `localStorage`; user can download/upload JSON and export PNG.
- [ ] `/saves` route lets the user browse stored schemas.
