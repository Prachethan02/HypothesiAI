# HypothesiAI — Production Deployment Guide

This document provides definitive, end-to-end instructions for deploying HypothesiAI into production environments. The system is designed to support containerized orchestration (Docker / Kubernetes / AWS ECS / Google Cloud Run) or independent serverless/managed deployments.

---

## Architecture Overview

```
                          ┌───────────────────────────────┐
                          │   Frontend Client (SPA)       │
                          │   Cloudflare Pages / Nginx    │
                          └───────────────┬───────────────┘
                                          │ HTTPS (Public API)
                                          ▼
                          ┌───────────────────────────────┐
                          │   Backend API Gateway (Node)  │
                          │   Port 5000 / ECS / Cloud Run │
                          └───────┬───────────────┬───────┘
                                  │               │
             Internal HTTP (REST) │               │ AWS S3 / Cloudflare R2
                                  ▼               ▼
      ┌─────────────────────────────┐   ┌───────────────────────────┐
      │   Python AI Service         │   │   Cloud Object Storage    │
      │   Port 8000 / PyTorch / GPU │   │   Secure Private Bucket   │
      └─────────────┬───────────────┘   └───────────────────────────┘
                    │
                    ├────────────────────────────────┐
                    ▼                                ▼
      ┌─────────────────────────────┐  ┌───────────────────────────┐
      │   PostgreSQL 16+ (pgvector) │  │   Neo4j Graph Database    │
      │   Supabase / RDS / Neon     │  │   Neo4j AuraDB (Cloud)    │
      └─────────────────────────────┘  └───────────────────────────┘
```

---

## 1. Frontend Deployment

The frontend is a Single-Page Application (SPA) built with React 18, TypeScript, and Vite. It compiles into static JavaScript, CSS, and HTML assets with manual chunk splitting for optimal caching.

### Option A: Static CDN Hosting (Cloudflare Pages / Vercel / AWS S3 + CloudFront)
1. **Compile Static Assets**:
   ```bash
   cd frontend
   npm ci
   # Set the public URL for the backend API (must include /api/v1 prefix)
   VITE_API_BASE_URL="https://api.yourdomain.com/api/v1" npm run build
   ```
2. **SPA Routing Configuration**:
   All client-side routes (`/dashboard`, `/papers/:id`, `/hypotheses`, etc.) must rewrite to `/index.html`:
   - **Cloudflare Pages**: Add `frontend/public/_redirects`:
     ```text
     /*    /index.html   200
     ```
   - **Vercel**: Included via `vercel.json`:
     ```json
     {
       "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
     }
     ```
   - **AWS CloudFront**: Configure Custom Error Responses for HTTP 403 and 404 to return `/index.html` with HTTP 200.

### Option B: Docker Container (Nginx)
The included `frontend/Dockerfile` uses multi-stage builds (`node:20-alpine` -> `nginx:alpine`):
```bash
docker build \
  --build-arg VITE_API_BASE_URL="https://api.yourdomain.com/api/v1" \
  -t hypothesiai-frontend:latest ./frontend

docker run -d \
  --name hypothesiai-frontend \
  -p 80:80 \
  --restart always \
  hypothesiai-frontend:latest
```

---

## 2. Backend API Deployment

The Node.js API Gateway runs Express, TypeScript, Helmet security headers, rate limiting, and Winston structured logging.

### Building & Running
1. **Compile TypeScript**:
   ```bash
   cd backend
   npm ci
   npm run build
   ```
2. **Launch with Node.js**:
   ```bash
   NODE_ENV=production node dist/server.js
   ```
3. **Using Process Manager (PM2)**:
   ```bash
   pm2 start dist/server.js \
     --name "hypothesiai-backend" \
     -i max \
     --env production
   ```

### Docker Containerization
```bash
docker build -t hypothesiai-backend:latest ./backend

docker run -d \
  --name hypothesiai-backend \
  -p 5000:5000 \
  --env-file ./backend/.env \
  --restart always \
  hypothesiai-backend:latest
```

---

## 3. Python AI Service Deployment

The AI service handles PDF document parsing, entity resolution, text embeddings, HDBSCAN clustering, and NLI contradiction analysis.

### Hardware Sizing
- **Minimal**: 2 vCPUs, 4 GB RAM (CPU mode, `DEVICE=cpu`)
- **Production Recommended**: 4 vCPUs, 8 GB RAM, or NVIDIA T4/A10G GPU (`DEVICE=cuda`)

### Running with Gunicorn + Uvicorn Workers
```bash
cd ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run multi-worker production server
gunicorn app.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
```

### Docker Containerization
```bash
docker build -t hypothesiai-ai-service:latest ./ai-service

docker run -d \
  --name hypothesiai-ai-service \
  -p 8000:8000 \
  --env-file ./ai-service/.env \
  -v hypothesiai_models:/app/.cache/models \
  --restart always \
  hypothesiai-ai-service:latest
```

---

## 4. PostgreSQL Setup

PostgreSQL 16+ is required for relational metadata, papers, entities, evidence, and vector search embeddings.

### Cloud Providers
Compatible with **Supabase**, **Neon Serverless**, **AWS RDS PostgreSQL**, or self-hosted PostgreSQL.

### Database Initialization
1. **Enable pgvector extension**:
   Connect as superuser/postgres and execute:
   ```sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
2. **Configure Pool & Timeouts**:
   In high-concurrency environments, configure `backend/src/config/index.ts` via env vars:
   - `DATABASE_MAX_CONNECTIONS`: `20` (or `50` for dedicated database clusters)
   - `DATABASE_SSL`: `true` (enforced when connecting to cloud DBs like Supabase or Neon)

---

## 5. Neo4j Graph Database Setup

Neo4j stores knowledge graphs representing paper citations, method-dataset co-occurrences, and cross-paper contradictions.

### Option A: Neo4j AuraDB (Cloud Managed - Recommended)
1. Provision a free or professional instance at [console.neo4j.io](https://console.neo4j.io).
2. Download the connection credentials (`credentials.txt`).
3. Set backend environment variables:
   ```bash
   NEO4J_URI=neo4j+s://<dbid>.databases.neo4j.io
   NEO4J_USER=neo4j
   NEO4J_PASSWORD=<your-auradb-password>
   NEO4J_DATABASE=neo4j
   NEO4J_ENCRYPTED=true
   ```

### Option B: Self-Hosted Neo4j (Docker)
```bash
docker run -d \
  --name hypothesiai-neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/hypothesiai_secret \
  -e NEO4J_PLUGINS='["apoc"]' \
  -v neo4j_data:/data \
  neo4j:5-community
```

---

## 6. Object Storage Setup

HypothesiAI abstracts file storage via `backend/src/services/storage.service.ts`, supporting AWS S3, Cloudflare R2, MinIO, or local disk.

### AWS S3 Configuration
1. Create a private bucket: e.g., `hypothesiai-production-papers`.
2. Block all public access (files are streamed securely via signed routes).
3. Set CORS configuration on bucket:
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "PUT", "POST"],
       "AllowedOrigins": ["https://app.yourdomain.com"],
       "ExposeHeaders": ["ETag"]
     }
   ]
   ```
4. Configure backend environment:
   ```bash
   STORAGE_DRIVER=s3
   STORAGE_BUCKET=hypothesiai-production-papers
   STORAGE_REGION=us-east-1
   STORAGE_ACCESS_KEY=<IAM_ACCESS_KEY>
   STORAGE_SECRET_KEY=<IAM_SECRET_KEY>
   STORAGE_FORCE_PATH_STYLE=false
   ```

---

## 7. Environment Variables Reference

### Backend Gateway (`backend/.env`)
| Variable | Required | Default / Example | Purpose |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | Yes | `production` | Enables production security & logging mode |
| `PORT` | No | `5000` | HTTP port the server listens on |
| `API_PREFIX` | No | `/api/v1` | Base API routing prefix |
| `CORS_ORIGIN` | Yes | `https://app.yourdomain.com` | Allowed CORS origins (comma-separated) |
| `DATABASE_URL` | Yes | `postgresql://user:pass@host:5432/db` | PostgreSQL connection string |
| `DATABASE_SSL` | No | `true` | Enforce TLS connection to database |
| `DATABASE_MAX_CONNECTIONS` | No | `20` | Max clients in pool |
| `NEO4J_URI` | Yes | `neo4j+s://<dbid>.databases.neo4j.io` | Neo4j Bolt connection URI |
| `NEO4J_USER` | Yes | `neo4j` | Neo4j database user |
| `NEO4J_PASSWORD` | Yes | `<secret>` | Neo4j database password |
| `NEO4J_DATABASE` | No | `neo4j` | Graph database name |
| `AI_SERVICE_URL` | Yes | `http://ai-service:8000` | Internal URL for Python AI Service |
| `STORAGE_DRIVER` | Yes | `s3` (or `local`) | Driver for paper uploads |
| `STORAGE_BUCKET` | Cond. | `hypothesiai-production-papers` | Bucket name (for S3 driver) |
| `STORAGE_REGION` | Cond. | `us-east-1` | AWS region |
| `STORAGE_ACCESS_KEY` | Cond. | `<aws-access-key>` | AWS access key ID |
| `STORAGE_SECRET_KEY` | Cond. | `<aws-secret-key>` | AWS secret access key |
| `JWT_SECRET` | Yes | `<64-char-random-string>` | Secret key for signing user tokens |
| `JWT_EXPIRES_IN` | No | `7d` | Token validity duration |
| `RATE_LIMIT_MAX_REQUESTS` | No | `120` | Max API requests per window |
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | Rate limiting window in milliseconds |

### Python AI Engine (`ai-service/.env`)
| Variable | Required | Default / Example | Purpose |
| :--- | :---: | :--- | :--- |
| `ENVIRONMENT` | Yes | `production` | Application runtime environment |
| `PORT` | No | `8000` | FastAPI server port |
| `HOST` | No | `0.0.0.0` | Bind host address |
| `BACKEND_INTERNAL_URL` | Yes | `http://backend:5000` | Internal backend callback address |
| `CORS_ORIGINS` | Yes | `https://app.yourdomain.com` | Allowed origins (comma-separated) |
| `DEVICE` | No | `auto` (`cuda`, `cpu`, `mps`) | Compute device for PyTorch inference |
| `MAX_WORKERS` | No | `4` | Parallel processing workers |
| `MODEL_CACHE_DIR` | No | `.cache/models` | Local directory for pre-downloaded weights |
| `LLM_PROVIDER` | Yes | `gemini` (or `openai`) | Provider for hypothesis generation |
| `GEMINI_API_KEY` | Cond. | `<gemini-api-key>` | Google Gemini API key |
| `OPENAI_API_KEY` | Cond. | `<openai-api-key>` | OpenAI API key |
| `POSTGRES_HOST` | No | `db` | Database host for pipeline sync |
| `POSTGRES_PORT` | No | `5432` | Database port |
| `POSTGRES_DB` | No | `hypothesiai` | Database name |
| `POSTGRES_USER` | No | `postgres` | Database user |
| `POSTGRES_PASSWORD` | No | `<secret>` | Database password |

### Frontend (`frontend/.env`)
| Variable | Required | Default / Example | Purpose |
| :--- | :---: | :--- | :--- |
| `VITE_API_BASE_URL` | Yes | `https://api.yourdomain.com/api/v1` | Public API endpoint for browser calls |

---

## 8. Database Migrations

The database migration suite applies versioned DDL scripts idempotently using an internal tracking table (`schema_migrations`).

### Migration Files
- `001_initial_schema.sql`: Core schema (users, papers, sections, entities).
- `002_user_status.sql`: User verification and status columns.
- `003_extraction_sections.sql`: Extended section extraction tables.
- `004_embeddings_pgvector.sql`: 384-dimension vector embeddings table and ivfflat index.
- `005_stage11_hdbscan_clusters.sql`: Evidence clusters, topics, and pattern tables.
- `006_production_indexes.sql`: Composite B-tree and GIN indexes for production query acceleration.

### Executing Migrations
Run from the backend container or CI/CD deployment step:
```bash
cd backend
npm run db:migrate
```

### Verifying Migration Status
```bash
npm run db:verify
```

---

## 9. CORS Configuration

HypothesiAI implements strict origin validation across all services to protect against CSRF and cross-origin data exposure.

1. **Production Restrictions**:
   - In production (`NODE_ENV=production`), wildcard `*` is prohibited when `credentials: true`.
   - Set `CORS_ORIGIN` on the backend to match your frontend domain exactly:
     ```bash
     CORS_ORIGIN="https://app.yourdomain.com,https://hypothesiai.com"
     ```
2. **AI Service Whitelist**:
   - Set `CORS_ORIGINS` on the AI service to match the frontend and internal gateway:
     ```bash
     CORS_ORIGINS="https://app.yourdomain.com,http://backend:5000"
     ```

---

## 10. Production Health Checks & Probes

Each layer exposes health check endpoints for Kubernetes, AWS ALB, or Docker health monitoring.

### 1. Backend API Gateway
- **Liveness Probe**: `GET /api/v1/health/live`
  - Returns: `200 OK` (`{"status":"ok","timestamp":"..."}`)
- **Readiness Probe**: `GET /api/v1/health/ready`
  - Tests live connectivity to:
    - PostgreSQL (`SELECT 1`)
    - Neo4j (`RETURN 1`)
    - Python AI Service (`GET /health`)
    - Object Storage Driver
  - Returns `200 OK` if healthy, `503 Service Unavailable` if critical dependency is offline.

### 2. Python AI Service
- **Liveness Probe**: `GET /health`
  - Returns `200 OK` (`{"status":"healthy","service":"ai-service"}`)
- **Readiness & Diagnostics Probe**: `GET /api/v1/health/ready`
  - Returns memory usage, CPU load, and device capability (`cuda` / `cpu`).

### 3. Frontend Container (Nginx)
- **Liveness Probe**: `GET /health`
  - Returns `200 OK` directly from Nginx without touching backend.

---

## 11. Troubleshooting Common Issues

### Issue 1: Database Connection Refused / Timeout
- **Symptom**: Backend readiness probe fails with `PostgreSQL connection error`.
- **Diagnosis**: Verify `DATABASE_URL` credentials. If using Supabase or Neon, verify `DATABASE_SSL=true`. Ensure PostgreSQL port `5432` is reachable through cloud security groups.

### Issue 2: AI Service Out-of-Memory (OOM) / Killed
- **Symptom**: Large PDF uploads trigger container restart (Exit code 137).
- **Diagnosis**: PyTorch transformer models require sufficient RAM. Increase container memory to at least 4 GB. Ensure `MAX_PARSABLE_PAGES=500` is active to block decompression bombs.

### Issue 3: Neo4j Routing Error (`SessionExpiredException`)
- **Symptom**: Neo4j operations fail with routing table lookup errors.
- **Diagnosis**: When using Neo4j AuraDB, use `neo4j+s://` protocol instead of `bolt://`. Set `NEO4J_ENCRYPTED=true`.

### Issue 4: CORS Header Missing
- **Symptom**: Browser reports `No 'Access-Control-Allow-Origin' header is present`.
- **Diagnosis**: Check the browser's origin. Ensure exact match (including protocol and port) in the backend `CORS_ORIGIN` environment variable.

---

## 12. Rollback Procedure

In the event of a deployment failure or regression:

### Step 1: Revert Traffic Routing
- Switch DNS / Load Balancer traffic back to the previous stable target group or container version.
- On Cloudflare / Vercel, rollback to the previous deployment instantly via the deployment history dashboard.

### Step 2: Roll Back Container Images
- If using Docker or Kubernetes, redeploy the previous tagged container image:
  ```bash
  # Docker
  docker stop hypothesiai-backend
  docker rm hypothesiai-backend
  docker run -d --name hypothesiai-backend [previous_image_tag]

  # Kubernetes
  kubectl rollout undo deployment/hypothesiai-backend
  kubectl rollout undo deployment/hypothesiai-ai-service
  kubectl rollout undo deployment/hypothesiai-frontend
  ```

### Step 3: Database Rollback (If Migration Required Rollback)
- If a schema migration caused an issue:
  1. Check `backend/src/db/migrator.ts` for the failing migration.
  2. Restore from the pre-deployment database snapshot (automated daily snapshots in RDS/Supabase).
  3. Verify schema state using:
     ```bash
     npm run db:verify
     ```

### Step 4: Validate Restored State
- Run readiness health checks across all components:
  ```bash
  curl -f https://api.yourdomain.com/api/v1/health/ready
  ```
