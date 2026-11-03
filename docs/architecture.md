# Onelogica System Architecture

Onelogica is a real-time collaborative architecture and workflow designer designed for high concurrency, low latency, and graph intelligence.

---

## 1. High-Level Architecture

```mermaid
flowchart TB
  subgraph ClientSide["Client Tier (Netlify / Next.js 16)"]
    UI["React Flow Canvas & Custom Nodes"]
    Palette["Drag & Drop Component Palette"]
    Inspector["Property & Rotation Inspector"]
    History["Local Isolated Undo / Redo Manager"]
    Intelligence["Graph Intelligence Engine\n(Cycle DFS, Auto-Layout, Disconnected BFS)"]
    WSClient["Collab WebSocket Client\n(Exponential Backoff Reconnect)"]
    APIClient["REST API Client (Bearer Token)"]
  end

  subgraph GatewayTier["Gateway & Tunnel Tier"]
    CF["Cloudflare Tunnel / Dev Tunnels\n(WSS + HTTPS Ingress)"]
  end

  subgraph BackendTier["Backend Service (Fastify / Node.js)"]
    AuthGate["Firebase Admin Token Verifier\n(Dev Mock Fallback)"]
    DiagRoutes["Diagram REST Routes\n(CRUD, Versioning, Permissions)"]
    WSGateway["Realtime Collaboration Gateway\n(Room-Based Broadcast)"]
    Batcher["Operation Batcher Queue\n(Debounced In-Memory Buffer)"]
  end

  subgraph StorageTier["Persistence Tier"]
    PG[("PostgreSQL 16 Database\n(Users, Diagrams, Permissions, Versions, Batches)")]
    Redis[("Redis 7 Pub/Sub\n(Horizontal Room Coordination)")]
  end

  UI --> History
  UI --> Intelligence
  Palette --> UI
  Inspector --> UI

  UI --> WSClient
  UI --> APIClient

  WSClient -->|WSS| CF
  APIClient -->|HTTPS| CF
  CF --> AuthGate

  AuthGate --> DiagRoutes
  AuthGate --> WSGateway

  DiagRoutes -->|SQL Transactions| PG
  WSGateway -->|Presence & Cursors| Redis
  WSGateway -->|Queued Mutations| Batcher
  Batcher -->|Batched INSERT| PG
```

---

## 2. Real-Time Collaboration & Synchronization Workflow

The collaboration protocol uses room-scoped WebSockets (`/ws/diagrams/:diagramId?token=...`).

```mermaid
sequenceDiagram
  autonumber
  actor UserA as Alice (Architect)
  participant ClientA as Alice's Browser
  participant Gateway as Fastify WebSocket Gateway
  participant Batcher as Operation Batcher
  participant DB as PostgreSQL
  participant ClientB as Bob's Browser
  actor UserB as Bob (Engineer)

  UserA->>ClientA: Drags 'Microservice' Node
  ClientA->>Gateway: WS Operation (MOVE_NODE, timestamp: T1)
  par Broadcast to Room
    Gateway-->>ClientB: WS Operation (MOVE_NODE, from: Alice, timestamp: T1)
    ClientB->>UserB: Node moves on Bob's canvas with LWW check
  and Batch Persistence
    Gateway->>Batcher: Queue operation in memory buffer
    Note over Batcher: Debounce 1.5s or 30 ops
    Batcher->>DB: INSERT into diagram_operation_batches
  end

  UserA->>ClientA: Moves pointer on canvas
  ClientA->>Gateway: WS Cursor (x: 420, y: 180) (Throttled 25fps)
  Gateway-->>ClientB: WS Cursor (Alice, color: #2563eb, x: 420, y: 180)
  ClientB->>UserB: Renders live animated cursor with Alice's badge
```

---

## 3. Dual-Layer Persistence Strategy (Edge Case 7)

To prevent lagging the user interface or hammering the database on every mouse movement, Onelogica implements a dual-layer persistence model:

1. **Fast-Path Operation Batching (Backend)**:
   - When a node is dragged or resized, fine-grained operation events (`MOVE_NODE`, `RESIZE_NODE`, etc.) are queued into `OperationBatcher`.
   - The queue flushes to `diagram_operation_batches` every 1,500ms or when 30 operations accumulate.
   - Zero database blocking during continuous drag interactions.

2. **Debounced Document Snapshot (Frontend)**:
   - After a user finishes editing, a 1,200ms debounce timer triggers a single `PUT /api/diagrams/:diagramId` snapshot save.
   - Stores the complete document graph (`nodes`, `edges`, `viewport`) in `diagrams.data` (JSONB).

---

## 4. Graph Intelligence Engine (Activity 3)

The diagram editor features an in-browser graph intelligence pipeline:

- **Topological Hierarchical Auto-Layout**:
  - Computes vertex in-degrees.
  - Identifies root sources and builds layer ranks via Breadth-First Search (BFS).
  - Aligns nodes into clean visual columns (default 280px layer spacing, 140px node spacing) and animates positions.
- **Cycle & Circular Dependency Detection**:
  - Directed graph Depth-First Search (DFS) maintains a recursion call stack.
  - If a backward edge is detected, reconstructs and displays the cycle path (e.g. `API Gateway -> Core Service -> Kafka -> API Gateway`).
- **Disconnected Subsystems Analysis**:
  - Undirected BFS partitions the graph into disjoint connected components.
  - Highlights isolated services that are missing upstream or downstream connections.
- **Connection Rules**:
  - Prohibits self-loops, duplicate edges, and dangling references to deleted nodes.
- **Grouping & Nested Components**:
  - Wraps multiple selected nodes into a parent boundary container node (`parentNode`, `extent: 'parent'`) and ungroups on demand.

---

## 5. Engineering Edge Cases & Resolution Strategies (Activity 6)

| Scenario | Challenge | Architectural Resolution |
| :--- | :--- | :--- |
| **1. Concurrent Node Movement** | Two users drag the same node simultaneously | **Element-level Last-Write-Wins (LWW)**: Each node carries a `lastUpdated` timestamp. When remote updates arrive, the mutation with the higher timestamp takes precedence without resetting the viewport. |
| **2. Deletion vs. Connection Race** | User A deletes a node while User B connects to it | **Orphan Edge Pruning & Connection Validation**: Deleting a node prunes all incident edges locally and over the wire. The connection validator verifies both source and target existence before committing any edge. |
| **3. Disconnect for 30 Seconds** | Client drops network connection and reconnects | **Exponential Backoff & State Re-sync**: Socket reconnects with exponential backoff (1s, 2s, 4s, 8s, up to 15s). On `onopen`, client sends `sync-request`, server queries latest snapshot and replies with `sync-state`. |
| **4. 1,000+ Nodes & Connections** | Extreme scale diagram causing render degradation | **Performance Budget & Sub-quadratic Algorithms**: DFS cycle detection and topological layering execute in $O(V + E)$ linear time. Automated benchmark suite confirms full analysis on 1,000 nodes in under 250ms. |
| **5. Multi-User Undo / Redo** | User A undoes, risking rolling back User B's edits | **Isolated Local Command History**: Undo/Redo history stack only records actions initiated locally. Undoing reverses *only* the current user's local actions. |
| **6. Invalid & Circular Dependencies** | Accidental cycle loops or malformed connections | **Graph Safety Gate**: `validateConnection` and `wouldCreateCycle` run pre-commit checks and surface real-time warning badges. |
| **7. High-Frequency Mouse Movement** | Network and database congestion | **Dual Throttling**: Cursor updates are throttled to 25 FPS client-side; operations are batched in-memory and flushed to PostgreSQL every 1.5s. |

---

## 6. Database Entity-Relationship Model

```mermaid
erDiagram
  USERS ||--o{ DIAGRAMS : owns
  USERS ||--o{ DIAGRAM_PERMISSIONS : holds
  DIAGRAMS ||--o{ DIAGRAM_PERMISSIONS : has
  USERS ||--o{ DIAGRAM_VERSIONS : created_by
  DIAGRAMS ||--o{ DIAGRAM_VERSIONS : snapshot_of
  USERS ||--o{ DIAGRAM_OPERATION_BATCHES : authored
  DIAGRAMS ||--o{ DIAGRAM_OPERATION_BATCHES : belongs_to

  USERS {
    uuid id PK
    string firebase_uid UK
    string email
    string display_name
    timestamp created_at
  }

  DIAGRAMS {
    uuid id PK
    string title
    string description
    uuid owner_id FK
    jsonb data
    timestamp created_at
    timestamp updated_at
  }

  DIAGRAM_PERMISSIONS {
    uuid id PK
    uuid diagram_id FK
    uuid user_id FK
    enum role "OWNER, EDITOR, VIEWER"
    timestamp created_at
  }

  DIAGRAM_VERSIONS {
    uuid id PK
    uuid diagram_id FK
    uuid actor_id FK
    string label
    jsonb snapshot
    jsonb metadata
    timestamp created_at
  }

  DIAGRAM_OPERATION_BATCHES {
    uuid id PK
    uuid diagram_id FK
    uuid actor_id FK
    jsonb operations
    timestamp created_at
  }
```
