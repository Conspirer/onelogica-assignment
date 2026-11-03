import { useCallback, useRef, useState } from "react";
import type { Edge, Node } from "reactflow";

export interface CanvasSnapshot {
  nodes: Node[];
  edges: Edge[];
}

export function useDiagramHistory(initialSnapshot: CanvasSnapshot) {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pastRef = useRef<CanvasSnapshot[]>([]);
  const futureRef = useRef<CanvasSnapshot[]>([]);
  const currentRef = useRef<CanvasSnapshot>(initialSnapshot);

  const setSnapshot = useCallback((snapshot: CanvasSnapshot) => {
    currentRef.current = snapshot;
  }, []);

  const pushLocalChange = useCallback((newSnapshot: CanvasSnapshot) => {
    // Save current into past stack
    pastRef.current.push({
      nodes: JSON.parse(JSON.stringify(currentRef.current.nodes)),
      edges: JSON.parse(JSON.stringify(currentRef.current.edges)),
    });

    // Keep past stack bounded to 50 operations to prevent memory leaks
    if (pastRef.current.length > 50) {
      pastRef.current.shift();
    }

    // A new local change invalidates redo branch
    futureRef.current = [];
    currentRef.current = newSnapshot;

    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = useCallback((): CanvasSnapshot | null => {
    if (pastRef.current.length === 0) return null;

    const previous = pastRef.current.pop()!;
    futureRef.current.push({
      nodes: JSON.parse(JSON.stringify(currentRef.current.nodes)),
      edges: JSON.parse(JSON.stringify(currentRef.current.edges)),
    });

    currentRef.current = previous;
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(true);

    return previous;
  }, []);

  const redo = useCallback((): CanvasSnapshot | null => {
    if (futureRef.current.length === 0) return null;

    const next = futureRef.current.pop()!;
    pastRef.current.push({
      nodes: JSON.parse(JSON.stringify(currentRef.current.nodes)),
      edges: JSON.parse(JSON.stringify(currentRef.current.edges)),
    });

    currentRef.current = next;
    setCanUndo(true);
    setCanRedo(futureRef.current.length > 0);

    return next;
  }, []);

  return {
    canUndo,
    canRedo,
    pushLocalChange,
    undo,
    redo,
    setSnapshot,
  };
}
