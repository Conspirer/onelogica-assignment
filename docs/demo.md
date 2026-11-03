# Onelogica - Demonstration & Submission Walkthrough

This guide provides a step-by-step walkthrough to demonstrate all functional requirements and edge cases of the Onelogica platform for your submission demo video or evaluator review.

---

## 1. Quick Start Setup (Under 2 Minutes)

Open two terminal tabs:

### Terminal 1: Start Backend
```bash
npm --workspace @onelogica/backend run dev
```
*Backend starts on `http://localhost:8080` (Fastify API & WebSocket gateway).*

### Terminal 2: Start Frontend
```bash
npm --workspace @onelogica/frontend run dev
```
*Frontend starts on `http://localhost:3000` (Next.js client).*

---

## 2. Walkthrough & Video Recording Script

### Scene 1: Multi-User Authentication (Activity 1)
1. Open **Browser Window 1** (e.g. Chrome) and navigate to `http://localhost:3000/login`.
   - Click **"Sign in as Alice"** (instant dev mode login) or register via email/password.
   - You land on `/workspace` and see the diagram management dashboard.
2. Open **Browser Window 2** (e.g. Chrome Incognito or Firefox) side-by-side.
   - Navigate to `http://localhost:3000/login` and click **"Sign in as Bob"**.

### Scene 2: Diagram Creation & Workspace
1. In Alice's window, click **"+ New Diagram"**.
2. Enter Title: `E-Commerce Microservices Pipeline` and click **"Create & Open"**.
3. Copy the URL (e.g. `http://localhost:3000/workspace/<diagramId>`).
4. Click the **"Share"** button in the top right.
5. Enter Bob's email (`bob@example.com`), select role **"Editor"**, and click **"Invite"**.
6. Paste the diagram URL into Bob's window. Bob opens the diagram immediately.

### Scene 3: Live Multiplayer Collaboration & Cursors (Activity 4)
1. Notice the top status bar:
   - Green pulsing dot: `REALTIME LIVE`.
   - Collaborators avatars showing `Alice` and `Bob` active.
2. In Alice's window, move the mouse across the canvas.
   - Look at Bob's window: Alice's custom colored cursor (e.g. `#2563eb` Blue) with her name tag glides across the canvas in real time.
3. In Bob's window, move the mouse:
   - Alice sees Bob's cursor (e.g. `#16a34a` Green) moving seamlessly.

### Scene 4: Visual Diagram Editor (Activity 2)
1. **Drag & Drop**:
   - In the left component palette, drag a **"Database"** (cylinder) onto the canvas.
   - Drag an **"API Gateway"** (diamond) onto the canvas.
2. **Custom Resizing**:
   - Select the Database node. Notice the bounding resizer handles.
   - Drag a corner to resize the node.
3. **Property Inspector & Rotation**:
   - In the right-hand Inspector, change the title to `Redis Cache Cluster`.
   - Pick the **Amber** or **Emerald** color preset.
   - Move the **Rotation Slider** from 0° to 45°: the node rotates in real time on both Alice's and Bob's screens!
4. **Directional Connectors**:
   - Drag a connector from the right handle of `Microservice` to the left handle of `Database`.
   - The connection snaps into place with a directional arrow.
   - In the Inspector, set label: `TLS SQL Connection`.

### Scene 5: Diagram Intelligence (Activity 3)
1. **Auto-Layout**:
   - Disarrange the nodes randomly on the canvas.
   - Click the **"Auto-Layout"** button on the top toolbar.
   - Watch the nodes rearrange into a clean hierarchical layered topological order instantly!
2. **Circular Dependency Detection**:
   - Draw an edge from `Database` back to `Client`.
   - A red warning banner immediately appears: `⚠️ Circular Dependency: node-client → node-backend → node-db → node-client`.
3. **Disconnected Components**:
   - Add an isolated node with no connections.
   - The topology banner appears: `ℹ️ Architecture Topology: 2 disconnected components detected`.
4. **Grouping into Containers**:
   - Hold Shift and select 2 nodes.
   - Click **"Group (2)"**.
   - The nodes are nested inside a dashed subsystem boundary container box.

### Scene 6: Version History & Snapshot Restore (Activity 5)
1. Click **"History"** in the top navigation bar.
2. Type label `Initial Stable Architecture v1.0` and click **"Save Snapshot"**.
3. Delete one of the nodes on canvas.
4. Open **"History"** again and click **"Restore"** on `Initial Stable Architecture v1.0`.
5. The canvas restores the snapshot instantly, and broadcasts the restored state to Bob's window!

### Scene 7: Exporting (Activity 2)
1. Click **"PNG"** — downloads high-resolution 2x retina PNG.
2. Click **"SVG"** — downloads scalable vector graphic.
3. Click **"JSON"** — downloads full diagram schema.

---

## 3. Engineering Edge Cases Verification (Activity 6)

| Scenario | How to Demonstrate |
| :--- | :--- |
| **1. Concurrent Node Movement** | Simultaneously drag the same node in Alice's and Bob's windows. Last-Write-Wins (LWW) timestamp ensures the latest movement is preserved with no jitter or freezing. |
| **2. Deletion vs. Connection Race** | Alice deletes a node while Bob connects to it. Incident edges are safely pruned; connection validator rejects connections to missing nodes with an alert. |
| **3. 30-Second Disconnection** | Disconnect Alice's network (or toggle Offline in DevTools Network tab for 30 seconds). Re-enable network: client reconnects automatically via exponential backoff, sends `sync-request`, and updates to the latest diagram state. |
| **4. 1,000+ Nodes Scale Test** | Run `npm --workspace @onelogica/frontend test`. The automated performance test verifies cycle detection, component detection, and auto-layout on 1,000 nodes execute in under 250ms. |
| **5. Multi-User Undo / Redo** | Alice adds Node X. Bob adds Node Y. Alice presses Ctrl+Z: only Node X is undone. Bob's Node Y remains intact! |
| **6. Invalid Connections** | Attempt to connect a node to itself: connection validator rejects self-links with clear feedback. |
| **7. Batched Writes** | Drag a node continuously for 10 seconds: network operations are batched to `diagram_operation_batches` every 1.5s rather than writing to DB on every mouse pixel movement. |
