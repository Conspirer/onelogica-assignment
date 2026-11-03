export type DiagramElementType = "node" | "edge" | "container";

export type DiagramRole = "OWNER" | "EDITOR" | "VIEWER";

export type ShapeType =
  | "rectangle"
  | "rounded"
  | "circle"
  | "diamond"
  | "cylinder"
  | "cloud"
  | "container";

export interface CustomNodeData {
  label: string;
  description?: string;
  shape?: ShapeType;
  bgColor?: string;
  borderColor?: string;
  textColor?: string;
  rotation?: number;
  width?: number;
  height?: number;
  isContainer?: boolean;
  parentId?: string;
  lastUpdated?: number;
  [key: string]: unknown;
}

export interface DiagramSummary {
  id: string;
  title: string;
  description: string | null;
  ownerId: string;
  updatedAt: string;
  role?: DiagramRole;
}

export interface PresenceCursor {
  x: number;
  y: number;
}

export interface CollaboratorPresence {
  id: string;
  userId: string;
  displayName: string;
  color: string;
  cursor: PresenceCursor | null;
  lastActive?: number;
}

export type OperationType =
  | "CREATE_NODE"
  | "MOVE_NODE"
  | "RESIZE_NODE"
  | "ROTATE_NODE"
  | "UPDATE_NODE_DATA"
  | "DELETE_ELEMENTS"
  | "CONNECT_EDGE"
  | "DELETE_EDGE"
  | "BATCH_UPDATE"
  | "AUTO_LAYOUT"
  | "RESTORE_VERSION";

export interface DiagramOperation {
  opId: string;
  diagramId: string;
  actorId: string;
  timestamp: string;
  type: OperationType;
  payload: Record<string, unknown>;
}

export interface CollaborationEnvelope {
  type: "presence" | "cursor" | "operation" | "sync-request" | "sync-state" | "restore";
  payload: Record<string, unknown>;
}

export interface DiagramPermissionItem {
  id: string;
  diagramId: string;
  userId: string;
  email: string | null;
  displayName: string | null;
  role: DiagramRole;
  createdAt: string;
}
