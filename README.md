# Onelogica — Collaborative Architecture & Workflow Designer

A real-time collaborative platform for creating, editing, sharing, and managing technical architecture diagrams, flowcharts, and workflows. Built with Next.js, Fastify, React Flow, WebSockets, Firebase Authentication, and PostgreSQL.

> **Reviewer note — current hosted demo:** The frontend is deployed on Netlify. The backend used by the hosted demo is currently running locally on the developer's machine and exposed through a temporary Cloudflare Quick Tunnel. It is not a permanently hosted backend. The machine, backend process, and tunnel must remain online for the deployed application to reach the API. The tunnel URL can change whenever it is restarted.

## Table of Contents

- [Features](#features)
- [Architecture and Tech Stack](#architecture-and-tech-stack)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Run Locally](#run-locally)
- [Environment Configuration](#environment-configuration)
- [Authentication Setup](#authentication-setup)
- [Database Setup](#database-setup)
- [Local Evaluation Mode](#local-evaluation-mode)
- [Tests](#tests)
- [Deployment and Cloudflare Tunnel](#deployment-and-cloudflare-tunnel)
- [Engineering Edge Cases](#engineering-edge-cases)
- [Demo Walkthrough](#demo-walkthrough)

---

## Features

### 1. Authentication and access management

- Firebase Authentication with email/password and Google sign-in.
- Protected workspace routes.
- Diagram ownership and collaborator roles: `OWNER`, `EDITOR`, and `VIEWER`.
- Collaborator invitations and permission management.

### 2. Visual diagram editor

- Drag-and-drop architectural elements, including Microservice, Client, Database, Cloud Provider, Decision Gateway, and VPC Container.
- Node resizing and rotation.
- SmoothStep, Bezier, and Straight connectors, with directional arrowheads and editable labels.
- Property inspector for labels, descriptions, colors, and geometry.
- Canvas pan, zoom, multi-selection, and MiniMap.
- Local undo/redo (`Ctrl+Z` and `Ctrl+Y`).
- Export to PNG, SVG, and JSON; JSON import.

### 3. Diagram intelligence

- Topological auto-layout.
- Circular dependency detection with cycle-path reporting.
- Disconnected subsystem analysis.
- Connection validation, including self-link, duplicate-edge, and dangling-reference checks.
- Grouping and nested components.

### 4. Real-time collaboration

- Shared diagram rooms over WebSockets.
- Live collaborator cursors.
- Real-time synchronization of node and edge operations.
- Element-level Last-Write-Wins timestamp merging.
- Automatic reconnect with backoff and state resynchronization.

### 5. Version history

- Named diagram snapshots.
- Version metadata, including node and edge counts.
- Change attribution and timestamps.
- Version browser and restore functionality; restored state is broadcast to connected collaborators.

---

## Architecture and Tech Stack

```mermaid
flowchart LR
  subgraph Frontend["Frontend — Next.js 16 + React Flow"]
    Canvas[Visual Canvas]
    Intel[Diagram Intelligence]
    WSClient[WebSocket Client]
  end

  subgraph Backend["Backend — Fastify + WebSockets"]
    Gateway[Collaboration Gateway]
    Batcher[Operation Batcher]
    Routes[REST API]
  end

  subgraph Persistence["Persistence"]
    PG[(PostgreSQL 16)]
    Redis[(Redis 7)]
  end

  Canvas --> WSClient
  WSClient <-->|WSS| Gateway
  Canvas --> Routes
  Routes --> PG
  Gateway --> Batcher
  Batcher --> PG
  Gateway --> Redis
```

- **Frontend:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, React Flow v11, `html-to-image`.
- **Backend:** Node.js, Fastify, `@fastify/websocket`, `@fastify/cors`, Zod, and `pg`.
- **Authentication:** Firebase Authentication client SDK and Firebase Admin SDK, with a development mock-auth fallback.
- **Database:** PostgreSQL 16, SQL migrations, and Prisma schema.
- **Realtime coordination:** WebSockets and Redis Pub/Sub support.

## Repository Structure

```text
onelogica/
├── apps/
│   ├── frontend/
│   │   ├── src/app/           # Login and workspace routes
│   │   ├── src/components/    # Editor, nodes, inspector, cursors, modals
│   │   └── src/lib/           # Firebase, API clients, intelligence, history
│   └── backend/
│       ├── src/routes/        # Diagram, version, and permission APIs
│       ├── src/realtime/      # WebSocket gateway and operation batcher
│       ├── src/auth/          # Firebase verification and development auth
│       └── src/db/            # PostgreSQL pool and in-memory fallback
├── packages/
│   └── shared-types/          # Shared TypeScript contracts
├── infra/
│   ├── migrations/            # PostgreSQL schema migrations
│   └── tunnel/                # Cloudflare tunnel helper/configuration
├── docs/
│   ├── architecture.md        # Architecture notes and sequence diagrams
│   └── demo.md                # Demo recording walkthrough
├── netlify.toml
└── docker-compose.yml
```

---

## Prerequisites

- Node.js 20 or later.
- npm 10 or later.
- Git.
- Docker and Docker Compose (recommended for persistent local database storage).
- A Firebase project if you want to use real Google/email authentication.

Check your installed versions:

```bash
node --version
npm --version
docker --version
docker compose version
```

## Run Locally

### 1. Get the source code

```bash
git clone <GITHUB_REPOSITORY_URL>
cd Onelogica
```

Replace `<GITHUB_REPOSITORY_URL>` with the repository's Git URL.

### 2. Install dependencies and build shared types

Run these commands from the repository root:

```bash
npm install
npm --workspace @onelogica/shared-types run build
```

### 3. Configure environment variables

Create the frontend and backend environment files described in [Environment Configuration](#environment-configuration) below.

At minimum, configure the frontend API URLs to point to the local backend:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_WS_BASE_URL=ws://localhost:8080
```

### 4. Start the database (recommended)

If Docker is available:

```bash
docker compose up -d
npm --workspace @onelogica/backend run db:migrate
```

The repository includes an in-memory fallback for evaluation without the database infrastructure. **Data stored in the in-memory fallback is not durable** and may be lost when the backend process restarts. Use PostgreSQL when you need data to survive restarts.

### 5. Start the backend

Open a terminal at the repository root and run:

```bash
npm --workspace @onelogica/backend run dev
```

The backend listens on:

```text
http://localhost:8080
```

Check that it is running:

```text
http://localhost:8080/health
```

A healthy response contains `"status":"ok"`.

### 6. Start the frontend

Open a second terminal at the repository root and run:

```bash
npm --workspace @onelogica/frontend run dev
```

Open:

```text
http://localhost:3000
```

Keep both development servers running while using the application.

---

## Environment Configuration

Do not commit `.env`, `.env.local`, service-account JSON files, private keys, or other credentials.

### Frontend: `apps/frontend/.env.local`

Create this file in the frontend directory:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_WS_BASE_URL=ws://localhost:8080

NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_web_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_web_app_id
```

The Firebase values are available in the Firebase Console under **Project settings → General → Your apps → Web app**.

For a local setup using the development mock-auth flow, the Firebase client values may not be required. Use the mock sign-in options shown by the application when that development mode is available.

### Backend: `apps/backend/.env`

For real Firebase token verification, create this file in the backend directory:

```env
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_admin_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_CONTENT\n-----END PRIVATE KEY-----\n"
FRONTEND_ORIGIN=http://localhost:3000
```

To obtain the Admin SDK credentials:

1. Open the Firebase Console and select your project.
2. Go to **Project settings → Service accounts**.
3. Generate a private key for the Firebase Admin SDK.
4. Store the downloaded JSON securely outside version control.
5. Copy the `project_id`, `client_email`, and `private_key` values into the backend environment file, preserving the `\n` newline escapes in the private key.

Never paste service-account credentials into source files, commit them, or share them in the repository.

If the backend is configured to use a database connection string in your environment, use the variable name expected by the backend configuration in this repository. Do not guess a variable name; check the backend environment schema/configuration before setting it. The Docker Compose setup is the recommended starting point for local PostgreSQL.

After changing environment variables, restart the relevant development server so the new values are loaded.

---

## Authentication Setup

For real Firebase authentication:

1. Create or select a project in the [Firebase Console](https://console.firebase.google.com/).
2. Open **Authentication → Sign-in method**.
3. Enable **Google** and, if needed, **Email/Password**.
4. Register a Web App under **Project settings → General**.
5. Copy the web app configuration into `apps/frontend/.env.local`.
6. Configure the Firebase Admin SDK credentials in `apps/backend/.env` as described above.
7. Add the local frontend host (`localhost`) to Firebase Authentication's authorized domains if it is not already listed.

The frontend uses the Firebase client SDK for sign-in. The backend uses Firebase Admin to verify authenticated requests.

---

## Local Evaluation Mode

The application includes a development mock-auth fallback intended to make local evaluation easier without setting up Firebase credentials.

When the development mock-auth options are available on the login page:

1. Open `http://localhost:3000/login` in one browser window.
2. Sign in as **Alice**.
3. Open `http://localhost:3000/login` in an Incognito or second browser window.
4. Sign in as **Bob**.
5. Create a diagram in Alice's window.
6. Use the diagram's **Share** action to invite Bob's email.
7. Open the shared diagram in Bob's window to evaluate collaboration and live cursors.

When real Firebase credentials are configured, the application uses Firebase authentication and backend token verification instead of relying on mock authentication.

---

## Tests

Run the repository test suite from the root:

```bash
npm test
```

The existing test suite covers areas including:

- Cycle detection and cycle-path reconstruction.
- Topological layout and disconnected components.
- Connection validation, including self-links and duplicate edges.
- Grouping and nested-component coordinate handling.
- Large graph performance (1,000+ nodes and 1,200 edges).
- Local undo/redo isolation.
- Operation batching.
- REST API behavior for diagrams, sharing permissions, and version restoration.

---

## Deployment and Cloudflare Tunnel

### Frontend on Netlify

The repository includes `netlify.toml` for the Next.js frontend.

The current deployment configuration builds the shared types and frontend from the monorepo root. When configuring a new Netlify site:

1. Connect the Git repository.
2. Use the repository root as the base directory.
3. Use the build configuration from `netlify.toml`.
4. Add the frontend environment variables from `apps/frontend/.env.local` in Netlify's environment-variable settings.
5. Set the production API and WebSocket URLs to the publicly reachable backend URL:
   - `NEXT_PUBLIC_API_BASE_URL=https://YOUR_BACKEND_HOST`
   - `NEXT_PUBLIC_WS_BASE_URL=wss://YOUR_BACKEND_HOST`
6. Add the Netlify site's hostname to Firebase Authentication's authorized domains.
7. Trigger a fresh deployment after changing environment variables.

Do not use `localhost` for the production API URLs: a visitor's browser would try to connect to their own computer.

### Exposing a local backend with Cloudflare Quick Tunnel

For temporary testing or review, a local backend can be exposed over HTTPS/WSS using Cloudflare Tunnel.

1. Start the backend on port `8080`.
2. Install and authenticate/configure `cloudflared` as required by your environment.
3. In another terminal, run:

```bash
cloudflared tunnel --url http://localhost:8080
```

4. Cloudflare prints a temporary `https://...trycloudflare.com` URL.
5. Set the frontend production environment variables to:

```env
NEXT_PUBLIC_API_BASE_URL=https://YOUR_TEMPORARY_TUNNEL_URL
NEXT_PUBLIC_WS_BASE_URL=wss://YOUR_TEMPORARY_TUNNEL_URL
```

6. Set the backend's `FRONTEND_ORIGIN` to the exact Netlify site origin, then restart the backend.
7. Redeploy the frontend after changing its environment variables.

Keep the backend process, Cloudflare Tunnel process, and host machine running while reviewers use the deployed application. A Quick Tunnel URL is temporary and may change after a restart; if it changes, update the Netlify environment variables and redeploy.

**Important:** A Cloudflare Quick Tunnel does not host the backend permanently. It forwards requests to the backend running on the local machine. The hosted frontend will not be fully functional when that machine or tunnel is offline.

---

## Engineering Edge Cases

1. **Two users move the same node simultaneously:** element-level Last-Write-Wins timestamp merging.
2. **A node is deleted while another user edits its connections:** incident edges are pruned and references to deleted nodes are rejected.
3. **A user disconnects and reconnects:** exponential-backoff reconnection and a `sync-request` snapshot catch-up.
4. **Large diagrams:** graph algorithms are tested with 1,000+ nodes and 1,200 edges.
5. **Multiple users use undo/redo:** local history stacks isolate each user's undo/redo actions.
6. **Invalid connections and circular dependencies:** connection validation and DFS-based cycle warnings.
7. **Frequent changes:** backend operation batching and debounced frontend snapshot saves.

## Demo Walkthrough

See [`docs/demo.md`](docs/demo.md) for the step-by-step demo recording guide.

---

## Useful URLs

- **Local frontend:** http://localhost:3000
- **Local backend health check:** http://localhost:8080/health
- **Firebase Console:** https://console.firebase.google.com/
- **Netlify:** https://www.netlify.com/
