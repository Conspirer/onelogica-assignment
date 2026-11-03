// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDiagramHistory } from "./useDiagramHistory";

describe("useDiagramHistory - Undo / Redo Isolation (Activity 2 & Edge Case 5)", () => {
  const initial = {
    nodes: [{ id: "n1", position: { x: 0, y: 0 }, data: { label: "Initial" } }],
    edges: [],
  };

  it("manages local undo and redo transitions", () => {
    const { result } = renderHook(() => useDiagramHistory(initial));

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);

    // User moves node n1 to (100, 100)
    act(() => {
      result.current.pushLocalChange({
        nodes: [{ id: "n1", position: { x: 100, y: 100 }, data: { label: "Moved" } }],
        edges: [],
      });
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    // Undo action
    let reverted: any;
    act(() => {
      reverted = result.current.undo();
    });

    expect(reverted).toBeDefined();
    expect(reverted.nodes[0].position.x).toBe(0);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    // Redo action
    let redone: any;
    act(() => {
      redone = result.current.redo();
    });

    expect(redone).toBeDefined();
    expect(redone.nodes[0].position.x).toBe(100);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });
});
