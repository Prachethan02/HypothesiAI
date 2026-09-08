# HypothesiAI Architecture Blueprint

## System Vision
HypothesiAI is an AI-assisted research-gap discovery and hypothesis-generation platform designed to help researchers uncover non-obvious white spaces in scientific literature, validate candidate research gaps across multiple empirical signals, and formulate evidence-grounded research hypotheses.

---

## Architectural Principles
1. **Decoupled Polyglot Architecture**:
   - **Frontend**: React + Vite + TypeScript (responsive single-page application).
   - **Backend Gateway**: Node.js + Express + TypeScript (API gateway, storage manager, orchestrator, authentication-ready).
   - **AI Service**: Python + FastAPI (modular analytical and NLP processing engine).
   - **Relational Storage**: PostgreSQL (Supabase compatible) for transactional and entity storage.
   - **Graph Database**: Neo4j for research ontology, entity relationships, and topological graph queries.
   - **Object Storage**: S3/Supabase Storage compatible for raw PDF persistence.

2. **Multi-Signal Research Gap Detection (Core Algorithmic Tenet)**:
   - **No Single-Algorithm Assumption**: A research gap cannot be asserted by a single metric.
   - **Fused Signals**:
     1. *Semantic Limitation Clustering*: DistilBERT + MiniLM + BERTopic + HDBSCAN clustering recurring open limitations and future-work sections across papers.
     2. *Pattern Absence / Rarity Mining*: FP-Growth / Apriori identifying combinations of problems, datasets, and methods that are statistically underexplored despite high relevance.
     3. *Contradiction / Conflict Detection*: Cross-Encoder NLI identifying opposing findings or irreproducible claims across literature.
     4. *Method Maturity / Momentum*: Temporal tracking of technique adoption vs. plateaus.

3. **Strict LLM Grounding & Non-Primary Role**:
   - The LLM is **never** the primary research gap detector.
   - Candidate gaps and their source-grounded evidence bundles are computed deterministically by the analytical pipeline.
   - The LLM synthesizes actionable, scientifically rigorous hypotheses, methodologies, and expected outcomes strictly based on the provided evidence bundle.
   - All generated statements retain provenance back to specific papers, pages, and section IDs.

---

## Communication Architecture

```
[ Browser / Frontend Client ]
           │
           │  HTTPS / JSON (REST)
           ▼
[ Node.js + Express API Gateway (Port 5000) ]
     │               │                 │
     │ Postgres      │ Bolt Protocol   │ Internal HTTP / REST
     ▼               ▼                 ▼
[ PostgreSQL /   [ Neo4j Graph DB   [ Python FastAPI AI Engine
  Supabase ]       (Port 7687) ]      (Port 8000) ]
                                            │
                                            ├─ PyMuPDF (PDF Parser)
                                            ├─ DistilBERT (Extraction)
                                            ├─ MiniLM (Dense Embeddings)
                                            ├─ BERTopic + HDBSCAN (Limitation Clusters)
                                            ├─ FP-Growth (Pattern Mining)
                                            ├─ Cross-Encoder NLI (Contradiction)
                                            └─ LLM Integration (Hypothesis Synthesis)
```

---

## Modularity & Extensibility
Every AI pipeline step is isolated inside `ai-service/app/pipeline/` behind distinct interfaces so that algorithms can be enhanced, benchmarked, or scaled independently without altering the API Gateway or Frontend UI.
