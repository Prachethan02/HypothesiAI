# HypothesiAI Environment Variables Reference

| Variable | Service | Required | Default | Description |
|---|---|---|---|---|
| `PORT` | Backend | No | `5000` | Port for Express API server |
| `NODE_ENV` | Backend | No | `development` | Runtime mode (`development`, `production`, `test`) |
| `API_PREFIX` | Backend | No | `/api/v1` | Base route prefix |
| `CORS_ORIGIN` | Backend | No | `http://localhost:5173` | Allowed frontend origin for CORS |
| `DATABASE_URL` | Backend | Yes | - | PostgreSQL connection URI |
| `SUPABASE_URL` | Backend | Optional | - | Supabase project URL (if using Supabase) |
| `SUPABASE_ANON_KEY` | Backend | Optional | - | Supabase anon key |
| `NEO4J_URI` | Backend | Yes | `bolt://localhost:7687` | Neo4j Bolt connection URI |
| `NEO4J_USER` | Backend | Yes | `neo4j` | Neo4j username |
| `NEO4J_PASSWORD` | Backend | Yes | `hypothesiai_secret` | Neo4j password |
| `AI_SERVICE_URL` | Backend | Yes | `http://localhost:8000` | Internal URL to reach Python AI service |
| `STORAGE_DRIVER` | Backend | No | `local` | Storage driver (`local` or `s3`) |
| `STORAGE_BUCKET` | Backend | No | `hypothesiai-papers` | S3 bucket name |
| `JWT_SECRET` | Backend | Yes | - | Secret key for JWT signing |
| `AI_SERVICE_HOST` | AI Service | No | `0.0.0.0` | Host binding for Uvicorn |
| `AI_SERVICE_PORT` | AI Service | No | `8000` | Port for Uvicorn server |
| `AI_SERVICE_ENV` | AI Service | No | `development` | AI service runtime environment |
| `VITE_API_BASE_URL`| Frontend | Yes | `http://localhost:5000/api/v1` | URL for the frontend to reach backend API |
