/**
 * StorageService — Stage 5
 * ========================
 * Cloud-compatible local-disk file storage abstraction.
 * Designed to be swapped for S3/GCS by changing STORAGE_DRIVER env var.
 *
 * Local layout:
 *   backend/uploads/papers/<userId>/<paperId>/<filename>
 */
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

export interface StoredFile {
  storageKey: string;  // Relative key — used to reconstruct file URL
  absolutePath: string;
  fileUrl: string;     // HTTP-accessible URL (proxied via backend)
  sizeBytes: number;
}

// Base uploads directory — relative to the backend working directory
const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads', 'papers');

export class StorageService {
  /**
   * Ensure the uploads root directory exists.
   */
  static ensureUploadDir(subDir?: string): string {
    const dir = subDir ? path.join(UPLOADS_ROOT, subDir) : UPLOADS_ROOT;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Save a multer file buffer / temp file to permanent storage.
   * @param tempPath  Path to the multer temp file (req.file.path)
   * @param paperId   Paper UUID — used to create an isolated directory
   * @param filename  Sanitised original filename
   * @returns StoredFile descriptor
   */
  static async save(
    tempPath: string,
    paperId: string,
    filename: string,
  ): Promise<StoredFile> {
    const targetDir = StorageService.ensureUploadDir(paperId);
    const safeFilename = StorageService.sanitiseFilename(filename);
    const targetPath = path.join(targetDir, safeFilename);

    // Move from temp → permanent location
    await fs.promises.rename(tempPath, targetPath).catch(async () => {
      // Cross-device move: copy + delete
      await fs.promises.copyFile(tempPath, targetPath);
      await fs.promises.unlink(tempPath).catch(() => null);
    });

    const stat = await fs.promises.stat(targetPath);
    const storageKey = path.join('papers', paperId, safeFilename).replace(/\\/g, '/');

    logger.info(`Stored file: key=${storageKey}  size=${stat.size}`);

    return {
      storageKey,
      absolutePath: targetPath,
      fileUrl: `/uploads/${storageKey}`,
      sizeBytes: stat.size,
    };
  }

  /**
   * Resolve the absolute path for a storage key.
   */
  static getAbsolutePath(storageKey: string): string {
    return path.join(UPLOADS_ROOT, '..', storageKey);
  }

  /**
   * Delete a stored file by its storage key.
   */
  static async delete(storageKey: string): Promise<void> {
    const absPath = StorageService.getAbsolutePath(storageKey);
    await fs.promises.unlink(absPath).catch((err) => {
      logger.warn(`Could not delete stored file: ${storageKey} — ${err.message}`);
    });
  }

  /**
   * Sanitise a filename: strip path traversal, allow only safe characters.
   */
  static sanitiseFilename(name: string): string {
    return path
      .basename(name)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .slice(0, 255);
  }
}
