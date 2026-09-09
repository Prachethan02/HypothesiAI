/**
 * PapersController — Stage 5
 * ==========================
 * Handles HTTP request/response for paper ingestion.
 * Business logic lives in PapersService and StorageService.
 */
import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { PapersService } from '../services/papers.service';
import { StorageService } from '../services/storage.service';
import { EmbeddingsService } from '../services/embeddings.service';
import { ResolutionService } from '../services/resolution.service';
import { CorpusService } from '../services/corpus.service';
import { logger } from '../utils/logger';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const ALLOWED_MIME_TYPES = ['application/pdf'];
const ALLOWED_EXTENSIONS = ['.pdf'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validateUploadedFile(file: Express.Multer.File): string | null {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return `Invalid file type: ${file.mimetype}. Only PDF files are accepted.`;
  }
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `Invalid file extension: ${ext}. Only .pdf files are accepted.`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File too large: ${file.size} bytes. Maximum is ${MAX_FILE_SIZE_BYTES} bytes (50 MB).`;
  }
  if (file.size < 5) {
    return 'File too small: corrupted or empty PDF document.';
  }

  // Verify binary signature magic bytes (%PDF-) to prevent disguised executable/script execution
  try {
    const buffer = Buffer.alloc(5);
    const fd = fs.openSync(file.path, 'r');
    fs.readSync(fd, buffer, 0, 5, 0);
    fs.closeSync(fd);
    if (buffer.toString('utf-8') !== '%PDF-') {
      return 'Invalid PDF signature: file header does not match PDF binary specification.';
    }
  } catch (err: any) {
    return `Could not verify file binary signature: ${err.message}`;
  }

  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ─── Controller actions ───────────────────────────────────────────────────────

/**
 * POST /api/v1/papers
 * Upload a PDF and trigger async processing.
 */
export async function uploadPaper(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // 1. Check file presence
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: { message: 'No file uploaded. Include a PDF file in the "file" field.', statusCode: 400 },
      });
      return;
    }

    // 2. Validate the file
    const validationError = validateUploadedFile(req.file);
    if (validationError) {
      // Remove the temp file
      await StorageService.delete(req.file.path).catch(() => null);
      res.status(422).json({
        success: false,
        error: { message: validationError, statusCode: 422 },
      });
      return;
    }

    // 3. Derive a title from the filename or body field
    const title: string =
      (req.body?.title as string | undefined)?.trim() ||
      path.basename(req.file.originalname, path.extname(req.file.originalname)).replace(/_/g, ' ');

    // 4. Create the paper record (status='uploaded')
    const userId = (req as any).user?.id as string | undefined;
    const paper = await PapersService.createPaper({
      userId,
      title,
      originalFilename: req.file.originalname,
      storageKey: '', // placeholder — filled after save
      fileUrl: '',
      fileSizeBytes: req.file.size,
      mimeType: req.file.mimetype,
    });

    // 5. Persist file to storage
    const stored = await StorageService.save(
      req.file.path,
      paper.id,
      req.file.originalname,
    );

    // Update paper record with real storage key
    await PapersService.updateStatus(paper.id, 'uploaded');
    // Patch in-memory record too (DB update happens via service internal logic)
    paper.storage_key = stored.storageKey;
    paper.file_url = stored.fileUrl;

    logger.info(
      `Paper uploaded: id=${paper.id}  title="${title}"  size=${formatBytes(req.file.size)}`,
    );

    // 6. Respond immediately with status='uploaded'
    res.status(201).json({
      success: true,
      data: { ...paper, storage_key: stored.storageKey, file_url: stored.fileUrl },
    });

    // 7. Trigger AI processing AFTER responding (non-blocking)
    setImmediate(async () => {
      try {
        await PapersService.updateStatus(paper.id, 'processing');
        logger.info(`Calling AI service for paper_id=${paper.id}`);

        const result = await PapersService.triggerProcessing(
          paper.id,
          stored.absolutePath,
          req.file!.originalname,
        );

        // Store the extracted sections
        await PapersService.storeSections(paper.id, result.segments);

        // Stage 6: Extract structured research information from sections
        try {
          logger.info(`Extracting structured research entities for paper_id=${paper.id}`);
          const extractedEntities = await PapersService.triggerExtraction(paper.id);
          logger.info(`Extracted ${extractedEntities.length} entities for paper_id=${paper.id}`);

          // Stage 7: Generate semantic embeddings for extracted entities and statements
          if (extractedEntities.length > 0) {
            try {
              logger.info(`Generating semantic embeddings for paper_id=${paper.id}`);
              await EmbeddingsService.embedPaperEntities(paper.id);
            } catch (embErr: any) {
              logger.warn(`Embedding generation non-fatal warning for paper_id=${paper.id}: ${embErr.message}`);
            }
          }
        } catch (extractErr: any) {
          logger.warn(`Entity extraction non-fatal warning for paper_id=${paper.id}: ${extractErr.message}`);
        }

        await PapersService.updateStatus(paper.id, 'parsed', {
          totalPages: result.total_pages,
        });

        logger.info(
          `AI processing complete: paper_id=${paper.id}  segments=${result.total_segments}  pages=${result.total_pages}`,
        );
      } catch (err: any) {
        const message = err?.response?.data?.detail?.message ?? err.message ?? 'AI service error';
        logger.error(`AI processing failed for paper_id=${paper.id}: ${message}`);
        await PapersService.updateStatus(paper.id, 'failed', {
          errorMessage: message,
        });
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/papers/batch
 * Batch upload up to 50 PDFs in one operation, optionally linking to a corpus.
 */
export async function uploadBatchPapers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const files = (req.files as Express.Multer.File[]) || [];
    if (!files || files.length === 0) {
      res.status(400).json({
        success: false,
        error: { message: 'No files uploaded. Provide at least one PDF in the "files" field.', statusCode: 400 },
      });
      return;
    }

    const corpusId = (req.body?.corpus_id as string | undefined)?.trim();
    const userId = (req as any).user?.userId || (req as any).user?.id;

    const uploadedPapers: any[] = [];
    const errors: Array<{ filename: string; error: string; message: string }> = [];

    for (const file of files) {
      const valErr = validateUploadedFile(file);
      if (valErr) {
        await StorageService.delete(file.path).catch(() => null);
        errors.push({ filename: file.originalname, error: valErr, message: valErr });
        continue;
      }

      try {
        const title = path.basename(file.originalname, path.extname(file.originalname)).replace(/_/g, ' ');
        const paper = await PapersService.createPaper({
          userId,
          title,
          originalFilename: file.originalname,
          storageKey: '',
          fileUrl: '',
          fileSizeBytes: file.size,
          mimeType: file.mimetype,
        });

        const stored = await StorageService.save(file.path, paper.id, file.originalname);
        await PapersService.updateStatus(paper.id, 'uploaded');
        paper.storage_key = stored.storageKey;
        paper.file_url = stored.fileUrl;

        // If corpus_id is specified, link paper to the corpus
        if (corpusId) {
          await CorpusService.addPaperToCorpus(corpusId, paper.id, 'upload').catch((err) => {
            logger.warn(`Failed to link paper ${paper.id} to corpus ${corpusId}: ${err.message}`);
          });
        }

        uploadedPapers.push({
          id: paper.id,
          title: paper.title,
          status: 'uploaded',
          file_size_bytes: paper.file_size_bytes,
          original_filename: file.originalname,
        });

        // Trigger AI extraction in background
        setImmediate(async () => {
          try {
            await PapersService.updateStatus(paper.id, 'processing');
            const result = await PapersService.triggerProcessing(paper.id, stored.absolutePath, file.originalname);
            await PapersService.storeSections(paper.id, result.segments);
            try {
              const entities = await PapersService.triggerExtraction(paper.id);
              if (entities.length > 0) {
                await EmbeddingsService.embedPaperEntities(paper.id).catch(() => null);
              }
            } catch (e: any) {
              logger.warn(`Entity extraction warning for ${paper.id}: ${e.message}`);
            }
            await PapersService.updateStatus(paper.id, 'parsed', { totalPages: result.total_pages });
          } catch (procErr: any) {
            logger.error(`Batch processing failed for paper ${paper.id}: ${procErr.message}`);
            await PapersService.updateStatus(paper.id, 'failed', { errorMessage: procErr.message });
          }
        });
      } catch (err: any) {
        const errMsg = err.message || 'Storage error';
        errors.push({ filename: file.originalname, error: errMsg, message: errMsg });
      }
    }

    res.status(201).json({
      success: true,
      data: {
        summary: {
          total: files.length,
          succeeded: uploadedPapers.length,
          failed: errors.length,
        },
        total_uploaded: uploadedPapers.length,
        total_failed: errors.length,
        corpus_id: corpusId ?? null,
        uploaded: uploadedPapers,
        papers: uploadedPapers,
        errors,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/papers
 * List all papers for the authenticated user.
 */
export async function listPapers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req as any).user?.id as string | undefined;
    const papers = await PapersService.listPapers(userId);
    res.json({ success: true, data: papers, total: papers.length });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/papers/:id
 * Get paper details by ID.
 */
export async function getPaper(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string;
    const paper = await PapersService.getPaperById(id);
    if (!paper) {
      res.status(404).json({
        success: false,
        error: { message: `Paper not found: ${id}`, statusCode: 404 },
      });
      return;
    }
    res.json({ success: true, data: paper });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/papers/:id/sections
 * Get extracted sections for a paper.
 */
export async function getPaperSections(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string;
    const sections = await PapersService.getSectionsByPaperId(id);
    res.json({ success: true, data: sections, total: sections.length });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/papers/:id/status
 * Internal status callback — used by AI service or admin tools.
 */
export async function updatePaperStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string;
    const { status, totalPages, errorMessage } = req.body as {
      status: string;
      totalPages?: number;
      errorMessage?: string;
    };

    const allowed = ['uploaded', 'processing', 'parsed', 'indexed', 'failed'];
    if (!allowed.includes(status)) {
      res.status(400).json({
        success: false,
        error: { message: `Invalid status: ${status}. Must be one of: ${allowed.join(', ')}` },
      });
      return;
    }

    await PapersService.updateStatus(id, status as any, {
      totalPages,
      errorMessage,
    });
    res.json({ success: true, data: { id, status } });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/papers/:id/entities
 * Get extracted research entities for a paper.
 */
export async function getPaperEntities(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string;
    const entities = await PapersService.getEntitiesByPaperId(id);
    res.json({ success: true, data: entities, total: entities.length });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/papers/:id/extract
 * Manually trigger or re-run structured information extraction for a paper.
 */
export async function extractPaperEntities(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string;
    const entities = await PapersService.triggerExtraction(id);
    res.json({ success: true, data: entities, total: entities.length });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/papers/:id/embed
 * Generate semantic embeddings for all extracted entities/claims of a paper.
 */
export async function embedPaperEntities(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string;
    const result = await EmbeddingsService.embedPaperEntities(id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/papers/:id/resolve
 * Normalize and cluster all extracted entities into canonical concepts (Stage 8).
 */
export async function resolvePaperEntitiesRoute(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string;
    const { config: resolutionConfig } = req.body ?? {};
    const result = await ResolutionService.resolvePaperEntities(id, resolutionConfig);
    res.json({ success: true, paper_id: id, ...result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/papers/:id/resolution-audit
 * Retrieve the entity resolution audit trail for a paper (Stage 8).
 */
export async function getResolutionAuditRoute(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string;
    const decisions = await PapersService.getResolutionDecisions(id);
    res.json({ success: true, paper_id: id, count: decisions.length, decisions });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/papers/:id/analysis
 * Stage 19: Get comprehensive detailed paper analysis with 4-point traceability.
 */
export async function getDetailedPaperAnalysisRoute(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string;
    const analysis = await PapersService.getDetailedPaperAnalysis(id);
    if (!analysis) {
      res.status(404).json({
        success: false,
        error: { message: `Paper not found: ${id}`, statusCode: 404 },
      });
      return;
    }
    res.json({ success: true, data: analysis });
  } catch (err) {
    next(err);
  }
}

