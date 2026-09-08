# HypothesiAI API Documentation

## Overview
All external clients communicate with the **Node.js Gateway** on `/api/v1`. The Gateway validates requests, handles authorization, interacts with the databases, and delegates complex processing to the **Python AI Service**.

---

## Backend Gateway Endpoints (`http://localhost:5000/api/v1`)

### 1. Health & Status
- **`GET /api/v1/health`**
  - Description: Basic service liveness probe.
  - Response:
    ```json
    {
      "status": "ok",
      "service": "hypothesiai-backend",
      "version": "1.0.0",
      "timestamp": "2026-09-04T12:00:00.000Z",
      "uptime": 12.34
    }
    ```

- **`GET /api/v1/health/ready`**
  - Description: Readiness probe verifying database, Neo4j, and AI Service reachability.

### 2. Authentication (Stage 3)
- **`POST /api/v1/auth/signup`**
  - Body: `{ "email": "researcher@university.edu", "password": "StrongPassword123!", "full_name": "Dr. Marie Curie" }`
  - Response: `201 Created` with `{ "success": true, "data": { "user": { ... }, "token": "jwt_token..." } }`
- **`POST /api/v1/auth/login`**
  - Body: `{ "email": "researcher@university.edu", "password": "StrongPassword123!" }`
  - Response: `200 OK` with `{ "success": true, "data": { "user": { ... }, "token": "jwt_token..." } }`
- **`POST /api/v1/auth/logout`**
  - Headers: `Authorization: Bearer <token>`
  - Response: `200 OK` with `{ "success": true, "message": "Logged out successfully" }`
- **`GET /api/v1/auth/me`**
  - Headers: `Authorization: Bearer <token>`
  - Response: `200 OK` with `{ "success": true, "data": { "id": "...", "email": "...", "full_name": "...", "role": "researcher" } }`

### 2. Paper Management (Stage 2)
- `POST /api/v1/papers/upload`: Upload PDF research paper (multipart/form-data).
- `GET /api/v1/papers`: List processed papers with filters and pagination.
- `GET /api/v1/papers/:id`: Get structured paper data, extracted sections, and metadata.

### 3. Knowledge Graph (Stage 3)
- `GET /api/v1/graph/overview`: Subgraph extraction for visualization.
- `GET /api/v1/graph/entities`: Query extracted entities and relations.

### 4. Research Gaps (Stage 4)
- `POST /api/v1/gaps/discover`: Trigger multi-signal gap discovery over corpus.
- `GET /api/v1/gaps`: Retrieve ranked candidate gaps with evidence breakdowns.
- `GET /api/v1/gaps/:id/evidence`: Detailed evidence signals and source paper provenance.

### 5. Hypotheses (Stage 5)
- `POST /api/v1/hypotheses/generate`: Generate evidence-backed hypotheses for a candidate gap.
- `GET /api/v1/hypotheses`: Retrieve saved hypotheses.
- `GET /api/v1/hypotheses/:id/export`: Export hypothesis report as PDF/Markdown/BibTeX.

---

## AI Service Internal Endpoints (`http://localhost:8000/api/v1`)

- **`GET /api/v1/health`**: Liveness probe with hardware diagnostics (CPU/GPU info).
- **`POST /api/v1/pipeline/parse-pdf`**: Parse PDF binary via PyMuPDF into structured sections.
- **`POST /api/v1/pipeline/extract-entities`**: DistilBERT entity and limitation extraction.
- **`POST /api/v1/pipeline/detect-gaps`**: Multi-signal analytical engine execution.
- **`POST /api/v1/pipeline/generate-hypothesis`**: Structured LLM synthesis with strict grounding.
