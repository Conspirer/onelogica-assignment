import type { Connection, Edge, Node } from "reactflow";
import type { CustomNodeData } from "@onelogica/shared-types";

export interface CycleDetectionResult {
  hasCycle: boolean;
  cyclePath: string[];
}

export interface DisconnectedResult {
  count: number;
  components: string[][];
  isolatedNodeIds: string[];
}

/**
 * Directed cycle detection using Depth-First Search with recursion stack tracking.
 * Returns the exact cycle path if one exists (e.g. ['n1', 'n2', 'n3', 'n1']).
 */
export function detectCycle(nodes: Node[], edges: Edge[]): CycleDetectionResult {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const adj = new Map<string, string[]>();

  for (const n of nodes) {
    adj.set(n.id, []);
  }

  for (const e of edges) {
    if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
      const list = adj.get(e.source) ?? [];
      list.push(e.target);
      adj.set(e.source, list);
    }
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const parentMap = new Map<string, string>();
  let cyclePath: string[] = [];

  function dfs(curr: string): boolean {
    visited.add(curr);
    inStack.add(curr);

    const neighbors = adj.get(curr) ?? [];
    for (const next of neighbors) {
      if (!visited.has(next)) {
        parentMap.set(next, curr);
        if (dfs(next)) return true;
      } else if (inStack.has(next)) {
        // Cycle detected: reconstruct path
        const path = [next, curr];
        let p = parentMap.get(curr);
        while (p && p !== next) {
          path.push(p);
          p = parentMap.get(p);
        }
        path.push(next);
        cyclePath = path.reverse();
        return true;
      }
    }

    inStack.delete(curr);
    return false;
  }

  for (const n of nodes) {
    if (!visited.has(n.id)) {
      if (dfs(n.id)) {
        return { hasCycle: true, cyclePath };
      }
    }
  }

  return { hasCycle: false, cyclePath: [] };
}

/**
 * Checks whether adding a candidate edge from source to target would create a cycle.
 */
export function wouldCreateCycle(edges: Edge[], source: string, target: string): boolean {
  if (source === target) return true;

  // BFS from target to see if source is reachable
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.source) ?? [];
    list.push(e.target);
    adj.set(e.source, list);
  }

  const visited = new Set<string>();
  const queue = [target];
  visited.add(target);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === source) {
      return true;
    }
    const neighbors = adj.get(curr) ?? [];
    for (const next of neighbors) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return false;
}

/**
 * Undirected component detection to identify disconnected / isolated subsystems.
 */
export function findDisconnectedComponents(nodes: Node[], edges: Edge[]): DisconnectedResult {
  if (nodes.length === 0) {
    return { count: 0, components: [], isolatedNodeIds: [] };
  }

  const adj = new Map<string, string[]>();
  for (const n of nodes) {
    adj.set(n.id, []);
  }

  const nodeSet = new Set(nodes.map((n) => n.id));
  for (const e of edges) {
    if (nodeSet.has(e.source) && nodeSet.has(e.target)) {
      adj.get(e.source)?.push(e.target);
      adj.get(e.target)?.push(e.source);
    }
  }

  const visited = new Set<string>();
  const components: string[][] = [];
  const isolatedNodeIds: string[] = [];

  for (const n of nodes) {
    if (visited.has(n.id)) continue;

    const comp: string[] = [];
    const queue = [n.id];
    visited.add(n.id);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      comp.push(curr);
      const neighbors = adj.get(curr) ?? [];
      for (const next of neighbors) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }

    components.push(comp);
    if (comp.length === 1) {
      isolatedNodeIds.push(comp[0]);
    }
  }

  return {
    count: components.length,
    components,
    isolatedNodeIds,
  };
}

/**
 * Validates connection parameters before committing to state.
 */
export function validateConnection(
  connection: Connection,
  nodes: Node[],
  edges: Edge[],
): { valid: boolean; reason?: string } {
  const { source, target } = connection;
  if (!source || !target) {
    return { valid: false, reason: "Source and target are required." };
  }

  if (source === target) {
    return { valid: false, reason: "Self-connections are not permitted." };
  }

  const sourceNode = nodes.find((n) => n.id === source);
  const targetNode = nodes.find((n) => n.id === target);
  if (!sourceNode || !targetNode) {
    return { valid: false, reason: "One or both connected nodes no longer exist." };
  }

  const exists = edges.some((e) => e.source === source && e.target === target);
  if (exists) {
    return { valid: false, reason: "A directional connection already exists between these nodes." };
  }

  return { valid: true };
}

/**
 * Hierarchical Topological Auto-Layout Algorithm.
 * Assigns ranks based on in-degree and dependency depth, then organizes nodes
 * into aligned visual columns and rows with clean spacing.
 */
export function computeAutoLayout(
  nodes: Node[],
  edges: Edge[],
  options: {
    layerSpacing?: number;
    nodeSpacing?: number;
    startX?: number;
    startY?: number;
  } = {},
): Node[] {
  if (nodes.length === 0) return [];

  const layerSpacing = options.layerSpacing ?? 280;
  const nodeSpacing = options.nodeSpacing ?? 140;
  const startX = options.startX ?? 80;
  const startY = options.startY ?? 80;

  const nodeMap = new Map<string, Node>(nodes.map((n) => [n.id, n]));
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const n of nodes) {
    adj.set(n.id, []);
    inDegree.set(n.id, 0);
  }

  for (const e of edges) {
    if (nodeMap.has(e.source) && nodeMap.has(e.target)) {
      adj.get(e.source)?.push(e.target);
      inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
    }
  }

  // Assign layers using BFS from zero-in-degree roots
  const layers = new Map<string, number>();
  const queue: { id: string; layer: number }[] = [];

  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push({ id, layer: 0 });
      layers.set(id, 0);
    }
  }

  // If there are cycles and no node with inDegree == 0, pick first node as root
  if (queue.length === 0 && nodes.length > 0) {
    queue.push({ id: nodes[0].id, layer: 0 });
    layers.set(nodes[0].id, 0);
  }

  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, layer } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const neighbors = adj.get(id) ?? [];
    for (const next of neighbors) {
      const currentLayer = layers.get(next) ?? 0;
      const newLayer = Math.max(currentLayer, layer + 1);
      layers.set(next, newLayer);
      if (!visited.has(next)) {
        queue.push({ id: next, layer: newLayer });
      }
    }
  }

  // Handle any remaining unvisited nodes
  let maxAssignedLayer = 0;
  for (const l of layers.values()) {
    if (l > maxAssignedLayer) maxAssignedLayer = l;
  }

  for (const n of nodes) {
    if (!layers.has(n.id)) {
      maxAssignedLayer += 1;
      layers.set(n.id, maxAssignedLayer);
    }
  }

  // Group nodes by layer
  const layerGroups = new Map<number, string[]>();
  for (const [id, l] of layers.entries()) {
    const group = layerGroups.get(l) ?? [];
    group.push(id);
    layerGroups.set(l, group);
  }

  const sortedLayers = [...layerGroups.keys()].sort((a, b) => a - b);
  const layoutedNodes: Node[] = [];

  for (const l of sortedLayers) {
    const group = layerGroups.get(l) ?? [];
    const x = startX + l * layerSpacing;
    const totalHeight = group.length * nodeSpacing;
    const startNodeY = startY + Math.max(0, (500 - totalHeight) / 4);

    group.forEach((nodeId, idx) => {
      const originalNode = nodeMap.get(nodeId);
      if (!originalNode) return;

      const y = startNodeY + idx * nodeSpacing;
      layoutedNodes.push({
        ...originalNode,
        position: { x, y },
      });
    });
  }

  return layoutedNodes;
}

/**
 * Wraps selected nodes into a container element and updates their coordinates
 * to be relative to the new container.
 */
export function groupNodesIntoContainer(
  selectedNodeIds: string[],
  nodes: Node[],
  containerTitle = "Subsystem Container",
): { updatedNodes: Node[]; containerId: string } {
  if (selectedNodeIds.length === 0) {
    return { updatedNodes: nodes, containerId: "" };
  }

  const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
  if (selectedNodes.length === 0) {
    return { updatedNodes: nodes, containerId: "" };
  }

  // Calculate bounding box
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of selectedNodes) {
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    const w = (n.data as CustomNodeData)?.width || 180;
    const h = (n.data as CustomNodeData)?.height || 80;
    maxX = Math.max(maxX, n.position.x + w);
    maxY = Math.max(maxY, n.position.y + h);
  }

  const padding = 40;
  const containerX = Math.max(0, minX - padding);
  const containerY = Math.max(0, minY - padding - 30);
  const containerWidth = Math.max(260, maxX - minX + padding * 2);
  const containerHeight = Math.max(160, maxY - minY + padding * 2 + 30);
  const containerId = `container-${Date.now()}`;

  const containerNode: Node<CustomNodeData> = {
    id: containerId,
    type: "architectureNode",
    position: { x: containerX, y: containerY },
    data: {
      label: containerTitle,
      description: "Boundary / Group",
      shape: "container",
      isContainer: true,
      bgColor: "rgba(241, 245, 249, 0.6)",
      borderColor: "#64748b",
      textColor: "#334155",
      width: containerWidth,
      height: containerHeight,
    },
    style: {
      width: containerWidth,
      height: containerHeight,
      zIndex: -1,
    },
  };

  const updatedNodes: Node[] = nodes.map((n) => {
    if (selectedNodeIds.includes(n.id)) {
      return {
        ...n,
        parentNode: containerId,
        extent: "parent" as const,
        position: {
          x: Math.max(20, n.position.x - containerX),
          y: Math.max(50, n.position.y - containerY),
        },
      };
    }
    return n;
  });

  return {
    updatedNodes: [containerNode, ...updatedNodes],
    containerId,
  };
}

/**
 * Ungroups nodes from a container and converts coordinates back to canvas root space.
 */
export function ungroupContainer(
  containerId: string,
  nodes: Node[],
): Node[] {
  const container = nodes.find((n) => n.id === containerId);
  if (!container) return nodes;

  const containerX = container.position.x;
  const containerY = container.position.y;

  return nodes
    .filter((n) => n.id !== containerId)
    .map((n) => {
      if (n.parentNode === containerId) {
        return {
          ...n,
          parentNode: undefined,
          extent: undefined,
          position: {
            x: containerX + n.position.x,
            y: containerY + n.position.y,
          },
        };
      }
      return n;
    });
}
