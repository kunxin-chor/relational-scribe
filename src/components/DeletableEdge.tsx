import { useAtom } from 'jotai';
import {
  EdgeLabelRenderer,
  type EdgeProps,
  useInternalNode,
} from '@xyflow/react';
import { relationshipsAtom } from '../atoms/schema';

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

  const dx = tc.x - sc.x;
  const dy = tc.y - sc.y;

  const STRAIGHT_MARGIN = 40;

  let sp: { x: number; y: number };
  let tp: { x: number; y: number };
  let mid1: { x: number; y: number } | null = null;
  let mid2: { x: number; y: number } | null = null;

  if (Math.abs(dx) >= Math.abs(dy)) {
    // Horizontal-first routing: horizontal → vertical → horizontal.
    if (dx >= 0) {
      sp = { x: sourceRect.x + sourceRect.width, y: sc.y };
      tp = { x: targetRect.x, y: tc.y };
    } else {
      sp = { x: sourceRect.x, y: sc.y };
      tp = { x: targetRect.x + targetRect.width, y: tc.y };
    }

    if (Math.abs(dy) > STRAIGHT_MARGIN) {
      const midX = (sp.x + tp.x) / 2;
      mid1 = { x: midX, y: sp.y };
      mid2 = { x: midX, y: tp.y };
    }
  } else {
    // Vertical-first routing: vertical → horizontal → vertical.
    if (dy >= 0) {
      sp = { x: sc.x, y: sourceRect.y + sourceRect.height };
      tp = { x: tc.x, y: targetRect.y };
    } else {
      sp = { x: sc.x, y: sourceRect.y };
      tp = { x: tc.x, y: targetRect.y + targetRect.height };
    }

    if (Math.abs(dx) > STRAIGHT_MARGIN) {
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
  const { id, source, target, selected, markerEnd } = props;
  const [, setRelationships] = useAtom(relationshipsAtom);
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

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

  return (
    <>
      <path
        id={id}
        d={path}
        fill="none"
        stroke={selected ? '#3b82f6' : '#64748b'}
        strokeWidth={selected ? 4 : 3}
        strokeLinecap="butt"
        strokeLinejoin="miter"
        markerEnd={markerEnd}
        className="react-flow__edge-path"
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
