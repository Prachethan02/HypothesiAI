# Local Development Guide

## Prerequisites
- **Node.js**: v18+ (tested with v22+)
- **npm**: v9+ (tested with v11+)
- **Python**: 3.10+ (tested with 3.13+)
- **Docker & Docker Compose** (for running PostgreSQL & Neo4j locally)

---

## Step 1: Clone and Configure Environment

1. In the repository root, copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. For the frontend:
   ```bash
   cp .env.example frontend/.env
   ```

---

## Step 2: Start Databases (PostgreSQL + Neo4j)

Using Docker Compose:
```bash
docker-compose up -d
```
This starts:
- PostgreSQL on `localhost:5432` with the `hypothesiai` database and schema pre-applied.
- Neo4j on `localhost:7474` (browser) and `localhost:7687` (Bolt protocol).

---

## Step 3: Run Backend Service (Node.js + Express)

```bash
cd backend
npm install
npm run dev
```
The backend will be live on `http://localhost:5000`.
Verify liveness:
```bash
curl http://localhost:5000/api/v1/health
```

---

## Step 4: Run AI Service (Python + FastAPI)

1. Navigate to the AI service directory:
   ```bash
   cd ai-service
   ```
2. Create and activate a virtual environment:
   - **Windows (PowerShell)**:
     ```powershell
     python -m venv .venv
     .\.venv\Scripts\Activate.ps1
     ```
   - **Linux / macOS**:
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the development server:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
Verify liveness:
```bash
curl http://localhost:8000/api/v1/health
```

---

## Step 5: Run Frontend UI (React + Vite)

```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## Independent Service Verification
All 3 services (Frontend, Backend, and AI Service) can be run and tested independently:
- Frontend provides offline/fallback diagnostics if backend is temporarily unreachable.
- Backend gracefully handles database reconnects and AI Service degradation with descriptive health endpoints.
- AI Service is completely decoupled and exposes standalone OpenAPI docs at `http://localhost:8000/docs`.
