import { useAtom, useAtomValue } from 'jotai';
import {
  EdgeLabelRenderer,
  type EdgeProps,
  useInternalNode,
} from '@xyflow/react';
import { relationshipsAtom, tablesAtom } from '../atoms/schema';
import { highlightedRelationshipIdsAtom } from '../atoms/ui';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getNodeRect(node: ReturnType<typeof useInternalNode>): Rect | null {
  if (!node) return null;
  const x = node.internals.positionAbsolute.x;
  const y = node.internals.positionAbsolute.y;
  const width = node.measured.width ?? node.width ?? 180;
  const height = node.measured.height ?? node.height ?? 120;
  return { x, y, width, height };
}

function getSmartOrthogonalPath(
  sourceRect: Rect,
  targetRect: Rect
): { path: string; labelX: number; labelY: number } {
  const sc = { x: sourceRect.x + sourceRect.width / 2, y: sourceRect.y + sourceRect.height / 2 };
  const tc = { x: targetRect.x + targetRect.width / 2, y: targetRect.y + targetRect.height / 2 };

  let sp: { x: number; y: number };
  let tp: { x: number; y: number };
  let mid1: { x: number; y: number } | null = null;
  let mid2: { x: number; y: number } | null = null;

  const dx = tc.x - sc.x;
  const dy = tc.y - sc.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    // Horizontal routing: source right/left edge to target left/right edge.
    if (dx >= 0) {
      sp = { x: sourceRect.x + sourceRect.width, y: sc.y };
      tp = { x: targetRect.x, y: sc.y };
    } else {
      sp = { x: sourceRect.x, y: sc.y };
      tp = { x: targetRect.x + targetRect.width, y: sc.y };
    }

    if (sc.y < targetRect.y || sc.y > targetRect.y + targetRect.height) {
      // Source centre misses the target edge, so anchor to the target edge
      // centre and route through a midpoint between the two edges.
      tp = { x: tp.x, y: tc.y };
      const midX = (sp.x + tp.x) / 2;
      mid1 = { x: midX, y: sp.y };
      mid2 = { x: midX, y: tp.y };
    }
  } else {
    // Vertical routing: source bottom/top edge to target top/bottom edge.
    if (dy >= 0) {
      sp = { x: sc.x, y: sourceRect.y + sourceRect.height };
      tp = { x: sc.x, y: targetRect.y };
    } else {
      sp = { x: sc.x, y: sourceRect.y };
      tp = { x: sc.x, y: targetRect.y + targetRect.height };
    }

    if (sc.x < targetRect.x || sc.x > targetRect.x + targetRect.width) {
      // Source centre misses the target edge, so anchor to the target edge
      // centre and route through a midpoint between the two edges.
      tp = { x: tc.x, y: tp.y };
      const midY = (sp.y + tp.y) / 2;
      mid1 = { x: sp.x, y: midY };
      mid2 = { x: tp.x, y: midY };
    }
  }

  const path = mid1 && mid2
    ? `M ${sp.x} ${sp.y} L ${mid1.x} ${mid1.y} L ${mid2.x} ${mid2.y} L ${tp.x} ${tp.y}`
    : `M ${sp.x} ${sp.y} L ${tp.x} ${tp.y}`;

  return { path, labelX: (sp.x + tp.x) / 2, labelY: (sp.y + tp.y) / 2 };
}

export function DeletableEdge(props: EdgeProps) {
  const { id, source, target, selected } = props;
  const [, setRelationships] = useAtom(relationshipsAtom);
  const highlightedRelationshipIds = useAtomValue(highlightedRelationshipIdsAtom);
  const relationships = useAtomValue(relationshipsAtom);
  const tables = useAtomValue(tablesAtom);
  const isHighlighted = highlightedRelationshipIds.includes(id);
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  const relationship = relationships.find((r) => r.id === id);
  const sourceTable = tables.find((t) => t.id === source);
  const sourceFkColumns =
    relationship?.mappings
      .map((m) => sourceTable?.columns.find((c) => c.id === m.sourceColumnId))
      .filter((c): c is NonNullable<typeof c> => c != null) ?? [];

  const isIdentifying =
    sourceFkColumns.length > 0 && sourceFkColumns.every((c) => c.isPrimaryKey);
  const isOptional =
    sourceFkColumns.length > 0 && sourceFkColumns.some((c) => c.isNullable !== false);

  const sourceRect = getNodeRect(sourceNode);
  const targetRect = getNodeRect(targetNode);

  const { path, labelX, labelY } =
    sourceRect && targetRect
      ? getSmartOrthogonalPath(sourceRect, targetRect)
      : { path: '', labelX: 0, labelY: 0 };

  const handleDelete = () => {
    setRelationships({ type: 'DELETE_RELATIONSHIP', payload: { id } });
  };

  if (!path) return null;

  const color = selected ? '#3b82f6' : isHighlighted ? '#f59e0b' : '#64748b';
  const strokeWidth = selected ? 4 : isHighlighted ? 4 : 3;
  const childMarkerId = `fk-child-marker-${id}`;
  const parentMarkerId = `fk-parent-marker-${id}`;
  const showParentMarker = !isIdentifying && isOptional;

  return (
    <>
      <defs>
        <marker
          id={childMarkerId}
          markerWidth="10"
          markerHeight="10"
          refX="5"
          refY="5"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <circle cx="5" cy="5" r="3" fill={color} />
        </marker>
        {showParentMarker && (
          <marker
            id={parentMarkerId}
            markerWidth="12"
            markerHeight="12"
            refX="6"
            refY="6"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <polygon
              points="6,0 12,6 6,12 0,6"
              fill="#ffffff"
              stroke={color}
              strokeWidth="1.5"
            />
          </marker>
        )}
      </defs>
      <path
        id={id}
        d={path}
        fill="none"
        strokeLinecap="butt"
        strokeLinejoin="miter"
        markerStart={`url(#${childMarkerId})`}
        markerEnd={showParentMarker ? `url(#${parentMarkerId})` : undefined}
        className="react-flow__edge-path"
        style={{
          stroke: color,
          strokeWidth,
          strokeDasharray: isIdentifying ? undefined : '6 4',
        }}
      />
      {selected && (
        <EdgeLabelRenderer>
          <button
            className="edge-delete-btn"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            onClick={handleDelete}
            title="Delete relationship"
          >
            ×
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
