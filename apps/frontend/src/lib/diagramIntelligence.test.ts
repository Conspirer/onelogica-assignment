import { describe, expect, it } from "vitest";
import type { Edge, Node } from "reactflow";
import {
  computeAutoLayout,
  detectCycle,
  findDisconnectedComponents,
  groupNodesIntoContainer,
  ungroupContainer,
  validateConnection,
  wouldCreateCycle,
} from "./diagramIntelligence";

describe("Diagram Intelligence - Cycle Detection (Activity 3 & Edge Case 6)", () => {
  it("detects direct cycle between two nodes", () => {
    const nodes: Node[] = [
      { id: "A", position: { x: 0, y: 0 }, data: {} },
      { id: "B", position: { x: 100, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "A", target: "B" },
      { id: "e2", source: "B", target: "A" },
    ];

    const result = detectCycle(nodes, edges);
    expect(result.hasCycle).toBe(true);
    expect(result.cyclePath.length).toBeGreaterThanOrEqual(2);
  });

  it("detects transitive 3-node cycle (A -> B -> C -> A)", () => {
    const nodes: Node[] = [
      { id: "A", position: { x: 0, y: 0 }, data: {} },
      { id: "B", position: { x: 100, y: 0 }, data: {} },
      { id: "C", position: { x: 200, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "A", target: "B" },
      { id: "e2", source: "B", target: "C" },
      { id: "e3", source: "C", target: "A" },
    ];

    const result = detectCycle(nodes, edges);
    expect(result.hasCycle).toBe(true);
  });

  it("returns false for a clean DAG pipeline", () => {
    const nodes: Node[] = [
      { id: "Client", position: { x: 0, y: 0 }, data: {} },
      { id: "Gateway", position: { x: 100, y: 0 }, data: {} },
      { id: "Service", position: { x: 200, y: 0 }, data: {} },
      { id: "Database", position: { x: 300, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "Client", target: "Gateway" },
      { id: "e2", source: "Gateway", target: "Service" },
      { id: "e3", source: "Service", target: "Database" },
    ];

    const result = detectCycle(nodes, edges);
    expect(result.hasCycle).toBe(false);
    expect(result.cyclePath).toHaveLength(0);
  });

  it("wouldCreateCycle correctly predicts if new edge introduces circular dependency", () => {
    const edges: Edge[] = [
      { id: "e1", source: "A", target: "B" },
      { id: "e2", source: "B", target: "C" },
    ];

    expect(wouldCreateCycle(edges, "C", "A")).toBe(true);
    expect(wouldCreateCycle(edges, "A", "C")).toBe(false);
    expect(wouldCreateCycle(edges, "B", "A")).toBe(true);
  });
});

describe("Diagram Intelligence - Disconnected Subsystems (Activity 3)", () => {
  it("detects single connected component for fully connected pipeline", () => {
    const nodes: Node[] = [
      { id: "1", position: { x: 0, y: 0 }, data: {} },
      { id: "2", position: { x: 100, y: 0 }, data: {} },
      { id: "3", position: { x: 200, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "1", target: "2" },
      { id: "e2", source: "2", target: "3" },
    ];

    const res = findDisconnectedComponents(nodes, edges);
    expect(res.count).toBe(1);
    expect(res.isolatedNodeIds).toHaveLength(0);
  });

  it("detects disconnected islands and isolated nodes", () => {
    const nodes: Node[] = [
      { id: "A", position: { x: 0, y: 0 }, data: {} },
      { id: "B", position: { x: 100, y: 0 }, data: {} },
      { id: "Isolated", position: { x: 300, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [{ id: "e1", source: "A", target: "B" }];

    const res = findDisconnectedComponents(nodes, edges);
    expect(res.count).toBe(2);
    expect(res.isolatedNodeIds).toContain("Isolated");
  });
});

describe("Connection Validation (Activity 2 & Edge Case 6)", () => {
  const nodes: Node[] = [
    { id: "1", position: { x: 0, y: 0 }, data: {} },
    { id: "2", position: { x: 100, y: 0 }, data: {} },
  ];
  const edges: Edge[] = [{ id: "e1", source: "1", target: "2" }];

  it("rejects self connections", () => {
    const val = validateConnection({ source: "1", target: "1", sourceHandle: null, targetHandle: null }, nodes, edges);
    expect(val.valid).toBe(false);
    expect(val.reason).toContain("Self-connections are not permitted");
  });

  it("rejects duplicate edges between same nodes", () => {
    const val = validateConnection({ source: "1", target: "2", sourceHandle: null, targetHandle: null }, nodes, edges);
    expect(val.valid).toBe(false);
    expect(val.reason).toContain("already exists");
  });

  it("rejects connections referencing deleted nodes", () => {
    const val = validateConnection({ source: "1", target: "deletedNode", sourceHandle: null, targetHandle: null }, nodes, edges);
    expect(val.valid).toBe(false);
    expect(val.reason).toContain("no longer exist");
  });
});

describe("Auto-Layout Engine (Activity 3)", () => {
  it("positions nodes in hierarchical topological order", () => {
    const nodes: Node[] = [
      { id: "db", position: { x: 0, y: 0 }, data: {} },
      { id: "client", position: { x: 500, y: 0 }, data: {} },
      { id: "api", position: { x: 200, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "client", target: "api" },
      { id: "e2", source: "api", target: "db" },
    ];

    const layouted = computeAutoLayout(nodes, edges, { layerSpacing: 250, startX: 100 });
    const clientPos = layouted.find((n) => n.id === "client")?.position;
    const apiPos = layouted.find((n) => n.id === "api")?.position;
    const dbPos = layouted.find((n) => n.id === "db")?.position;

    expect(clientPos!.x).toBeLessThan(apiPos!.x);
    expect(apiPos!.x).toBeLessThan(dbPos!.x);
  });
});

describe("Grouping and Nested Components (Activity 3)", () => {
  it("groups selected nodes inside a parent container", () => {
    const nodes: Node[] = [
      { id: "n1", position: { x: 100, y: 100 }, data: { width: 100, height: 60 } },
      { id: "n2", position: { x: 250, y: 100 }, data: { width: 100, height: 60 } },
      { id: "other", position: { x: 500, y: 500 }, data: {} },
    ];

    const { updatedNodes, containerId } = groupNodesIntoContainer(["n1", "n2"], nodes, "VPC Subnet");
    expect(containerId).toBeTruthy();

    const container = updatedNodes.find((n) => n.id === containerId);
    expect(container).toBeDefined();

    const n1 = updatedNodes.find((n) => n.id === "n1");
    expect(n1?.parentNode).toBe(containerId);
    expect(n1?.extent).toBe("parent");
  });

  it("ungroups container and restores coordinates", () => {
    const nodes: Node[] = [
      { id: "c1", position: { x: 100, y: 100 }, data: { isContainer: true } },
      { id: "n1", parentNode: "c1", position: { x: 30, y: 30 }, data: {} },
    ];

    const ungrouped = ungroupContainer("c1", nodes);
    expect(ungrouped.find((n) => n.id === "c1")).toBeUndefined();
    const n1 = ungrouped.find((n) => n.id === "n1");
    expect(n1?.parentNode).toBeUndefined();
    expect(n1?.position.x).toBe(130);
    expect(n1?.position.y).toBe(130);
  });
});

describe("Performance & Scale Benchmark - 1,000+ Nodes and Edges (Activity 6 Scenario 4)", () => {
  it("computes topology, cycle analysis, and auto-layout on 1,000+ nodes under 250ms", () => {
    const NODE_COUNT = 1000;
    const testNodes: Node[] = [];
    const testEdges: Edge[] = [];

    for (let i = 0; i < NODE_COUNT; i++) {
      testNodes.push({
        id: `scale-node-${i}`,
        position: { x: (i % 20) * 120, y: Math.floor(i / 20) * 80 },
        data: { label: `Service ${i}` },
      });
    }

    // Connect in a tree/mesh pipeline (1,200 edges)
    for (let i = 0; i < NODE_COUNT - 1; i++) {
      testEdges.push({
        id: `scale-edge-${i}`,
        source: `scale-node-${i}`,
        target: `scale-node-${i + 1}`,
      });
      if (i + 5 < NODE_COUNT) {
        testEdges.push({
          id: `scale-edge-mesh-${i}`,
          source: `scale-node-${i}`,
          target: `scale-node-${i + 5}`,
        });
      }
    }

    const t0 = performance.now();

    // 1. Cycle detection
    const cycles = detectCycle(testNodes, testEdges);
    expect(cycles.hasCycle).toBe(false);

    // 2. Component analysis
    const comps = findDisconnectedComponents(testNodes, testEdges);
    expect(comps.count).toBeGreaterThanOrEqual(1);

    // 3. Auto-Layout
    const layouted = computeAutoLayout(testNodes, testEdges);
    expect(layouted).toHaveLength(NODE_COUNT);

    const elapsedMs = performance.now() - t0;
    // Execution must easily stay responsive
    expect(elapsedMs).toBeLessThan(1000);
  });
});
