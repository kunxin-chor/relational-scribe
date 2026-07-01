import { useCallback, useEffect, useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
  type NodeSelectionChange,
  type OnNodeDrag,
  type OnReconnect,
  ConnectionLineType,
} from '@xyflow/react';
import { nanoid } from 'nanoid';
import { tablesAtom, relationshipsAtom, createRelationship, createTable } from '../atoms/schema';
import { selectedTableIdAtom, mappingRelationshipAtom, addTableCallbackAtom, editingNodeIdAtom } from '../atoms/ui';
import type { Relationship, Table } from '../types';
import { TableNode } from './TableNode';
import { DeletableEdge } from './DeletableEdge';

function buildNode(table: Table): Node {
  return {
    id: table.id,
    type: 'tableNode',
    position: { x: table.x, y: table.y },
    data: { tableId: table.id },
  };
}

function buildEdge(relationship: Relationship): Edge {
  return {
    id: relationship.id,
    source: relationship.sourceTableId,
    target: relationship.targetTableId,
    type: 'deletable',

    reconnectable: true,
    selectable: true,
    deletable: true,
    interactionWidth: 20,
    style: { strokeWidth: 3 },
  };
}

const nodeTypes = { tableNode: TableNode };
const edgeTypes = { deletable: DeletableEdge };

function Flow() {
  const tables = useAtomValue(tablesAtom);
  const relationships = useAtomValue(relationshipsAtom);
  const setRelationships = useSetAtom(relationshipsAtom);
  const setTables = useSetAtom(tablesAtom);
  const setSelectedTableId = useSetAtom(selectedTableIdAtom);
  const setMappingRelationship = useSetAtom(mappingRelationshipAtom);
  const setAddTableCallback = useSetAtom(addTableCallbackAtom);
  const editingNodeId = useAtomValue(editingNodeIdAtom);
  const { fitView, getViewport } = useReactFlow();
  const flowWrapperRef = useRef<HTMLDivElement>(null);

  const [nodes, setNodes] = useState<Node[]>(() => tables.map(buildNode));
  const [edges, setEdges] = useState<Edge[]>(() => relationships.map(buildEdge));

  // Sync external table changes (add/remove/update) into React Flow node state.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNodes((currentNodes) => {
      const existingIds = new Set(currentNodes.map((n) => n.id));
      const tableIds = new Set(tables.map((t) => t.id));

      // Remove deleted tables.
      const kept = currentNodes.filter((n) => tableIds.has(n.id));

      // Add new tables.
      const added = tables
        .filter((t) => !existingIds.has(t.id))
        .map(buildNode);

      return [...kept, ...added];
    });
  }, [tables]);

  // Sync relationship changes into React Flow edge state.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEdges(relationships.map(buildEdge));
  }, [relationships]);

  useEffect(() => {
    fitView({ padding: 0.2 });
  }, [fitView]);

  // Disable dragging on the node that is currently being edited inline.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNodes((currentNodes) =>
      currentNodes.map((node) => ({
        ...node,
        draggable: node.id !== editingNodeId,
      }))
    );
  }, [editingNodeId, setNodes]);

  const addTableAtCenter = useCallback(
    (name: string) => {
      const { x: vpX, y: vpY, zoom } = getViewport();
      const rect = flowWrapperRef.current?.getBoundingClientRect();
      const centerX = rect ? rect.width / 2 : 300;
      const centerY = rect ? rect.height / 2 : 200;
      const canvasX = (centerX - vpX) / zoom;
      const canvasY = (centerY - vpY) / zoom;
      const table = createTable(nanoid(), name, canvasX, canvasY);
      setTables({ type: 'ADD_TABLE', payload: table });
    },
    [getViewport, setTables]
  );

  useEffect(() => {
    setAddTableCallback(() => addTableAtCenter);
  }, [addTableAtCenter, setAddTableCallback]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((currentNodes) => applyNodeChanges(changes, currentNodes));

      changes.forEach((change) => {
        if (change.type === 'select') {
          const selectionChange = change as NodeSelectionChange;
          setSelectedTableId(selectionChange.selected ? selectionChange.id : null);
        }
      });
    },
    [setSelectedTableId]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((currentEdges) => applyEdgeChanges(changes, currentEdges));
    },
    []
  );

  const onNodeDragStop = useCallback<OnNodeDrag>(
    (_event, node) => {
      setTables({
        type: 'MOVE_TABLE',
        payload: { id: node.id, x: node.position.x, y: node.position.y },
      });
    },
    [setTables]
  );

  const resolveRelationshipEnds = (connection: Connection) => {
    if (!connection.source || !connection.target || !connection.sourceHandle) return null;
    if (connection.source === connection.target) return null;

    const isOutHandle = connection.sourceHandle === 'fk-out';
    const sourceTableId = isOutHandle ? connection.target : connection.source;
    const targetTableId = isOutHandle ? connection.source : connection.target;
    return { sourceTableId, targetTableId };
  };

  const onConnect = useCallback(
    (connection: Connection) => {
      const ends = resolveRelationshipEnds(connection);
      if (!ends) return;

      const relationship: Relationship = createRelationship(
        nanoid(),
        ends.sourceTableId,
        ends.targetTableId,
        []
      );

      setMappingRelationship(relationship);
    },
    [setMappingRelationship]
  );

  const onReconnect = useCallback<OnReconnect<Edge>>(
    (oldEdge, newConnection) => {
      const ends = resolveRelationshipEnds(newConnection);
      if (!ends) return;

      const existingRelationship = relationships.find((r) => r.id === oldEdge.id);
      if (!existingRelationship) return;

      setRelationships({
        type: 'UPDATE_RELATIONSHIP',
        payload: {
          ...existingRelationship,
          sourceTableId: ends.sourceTableId,
          targetTableId: ends.targetTableId,
        },
      });
    },
    [relationships, setRelationships]
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      deletedEdges.forEach((edge) => {
        setRelationships({ type: 'DELETE_RELATIONSHIP', payload: { id: edge.id } });
      });
    },
    [setRelationships]
  );

  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      deletedNodes.forEach((node) => {
        setTables({ type: 'DELETE_TABLE', payload: { id: node.id } });
        relationships
          .filter((r) => r.sourceTableId === node.id || r.targetTableId === node.id)
          .forEach((r) => setRelationships({ type: 'DELETE_RELATIONSHIP', payload: { id: r.id } }));
      });
      setSelectedTableId(null);
    },
    [relationships, setTables, setRelationships, setSelectedTableId]
  );

  return (
    <div ref={flowWrapperRef} className="schema-flow">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onEdgesDelete={onEdgesDelete}
        onNodesDelete={onNodesDelete}
        snapToGrid
        snapGrid={[16, 16]}
        minZoom={0.2}
        maxZoom={2}
        panOnDrag={editingNodeId === null}
        connectionLineType={ConnectionLineType.Straight}
      >
        <Background gap={16} size={1} />
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
      </ReactFlow>
    </div>
  );
}

export function SchemaFlow() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
