/**
 * Papers routes — Stage 5
 * =======================
 * Mounts multer multipart middleware for PDF uploads.
 */
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import { requireAuth } from '../middleware/auth.middleware';
import {
  uploadPaper,
  uploadBatchPapers,
  listPapers,
  getPaper,
  getPaperSections,
  updatePaperStatus,
  getPaperEntities,
  extractPaperEntities,
  embedPaperEntities,
  resolvePaperEntitiesRoute,
  getResolutionAuditRoute,
  getDetailedPaperAnalysisRoute,
} from '../controllers/papers.controller';

export const papersRouter = Router();

// ─── Multer configuration ──────────────────────────────────────────────────────

// Store uploads in OS temp dir — StorageService moves them to permanent location
const upload = multer({
  dest: path.join(os.tmpdir(), 'hypothesiai_uploads'),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB hard limit at transport layer
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['application/pdf', 'application/x-pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimes.includes(file.mimetype) && ext === '.pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only valid PDF files (.pdf) are accepted'));
    }
  },
});

// Multi-file batch upload (up to 50 PDFs per batch for research corpora)
const batchUpload = multer({
  dest: path.join(os.tmpdir(), 'hypothesiai_uploads'),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB limit per file
    files: 50,
  },
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/v1/papers — single PDF upload & ingest
papersRouter.post('/', requireAuth, upload.single('file'), uploadPaper);

// POST /api/v1/papers/batch — batch upload up to 50 PDFs to corpus
papersRouter.post('/batch', requireAuth, batchUpload.array('files', 50), uploadBatchPapers);

// GET /api/v1/papers — list all papers for authenticated user
papersRouter.get('/', requireAuth, listPapers);

// GET /api/v1/papers/:id — paper detail
papersRouter.get('/:id', requireAuth, getPaper);

// GET /api/v1/papers/:id/sections — extracted sections
papersRouter.get('/:id/sections', requireAuth, getPaperSections);

// GET /api/v1/papers/:id/analysis — detailed paper analysis with 4-point traceability (Stage 19)
papersRouter.get('/:id/analysis', requireAuth, getDetailedPaperAnalysisRoute);

// GET /api/v1/papers/:id/entities — extracted entities & claims (Stage 6)
papersRouter.get('/:id/entities', requireAuth, getPaperEntities);

// POST /api/v1/papers/:id/extract — trigger structured extraction (Stage 6)
papersRouter.post('/:id/extract', requireAuth, extractPaperEntities);

// POST /api/v1/papers/:id/embed — generate semantic embeddings (Stage 7)
papersRouter.post('/:id/embed', requireAuth, embedPaperEntities);

// POST /api/v1/papers/:id/resolve — run entity normalization & resolution (Stage 8)
papersRouter.post('/:id/resolve', requireAuth, resolvePaperEntitiesRoute);

// GET /api/v1/papers/:id/resolution-audit — retrieve resolution audit trail (Stage 8)
papersRouter.get('/:id/resolution-audit', requireAuth, getResolutionAuditRoute);

// PATCH /api/v1/papers/:id/status — internal status update
papersRouter.patch('/:id/status', requireAuth, updatePaperStatus);

