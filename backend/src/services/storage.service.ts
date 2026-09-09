/**
 * StorageService — Stage 20
 * =========================
 * Pluggable cloud object storage abstraction.
 * Delegates to LocalStorageDriver or S3StorageDriver based on STORAGE_DRIVER env variable.
 */
import { config } from '../config';
import { IStorageDriver, StoredFile } from './storage/IStorageDriver';
import { LocalStorageDriver } from './storage/LocalStorageDriver';
import { S3StorageDriver } from './storage/S3StorageDriver';
import { logger } from '../utils/logger';

export { StoredFile, IStorageDriver };

function createDriver(): IStorageDriver {
  if (config.STORAGE_DRIVER === 's3') {
    logger.info(`Initializing S3StorageDriver: bucket=${config.STORAGE_BUCKET} region=${config.STORAGE_REGION || 'us-east-1'}`);
    return new S3StorageDriver({
      bucket: config.STORAGE_BUCKET,
      region: config.STORAGE_REGION,
      endpoint: config.STORAGE_ENDPOINT,
      accessKey: config.STORAGE_ACCESS_KEY,
      secretKey: config.STORAGE_SECRET_KEY,
      forcePathStyle: config.STORAGE_FORCE_PATH_STYLE,
    });
  }

  logger.info('Initializing LocalStorageDriver (disk-backed storage)');
  return new LocalStorageDriver();
}

let activeDriver: IStorageDriver = createDriver();

export class StorageService {
  /**
   * Return the active storage driver instance.
   */
  static getDriver(): IStorageDriver {
    return activeDriver;
  }

  /**
   * Save a temporary upload file to permanent object storage.
   */
  static async save(
    tempPath: string,
    paperId: string,
    filename: string,
  ): Promise<StoredFile> {
    return activeDriver.save(tempPath, paperId, filename);
  }

  /**
   * Resolve the absolute path (or cache path) for a storage key.
   */
  static getAbsolutePath(storageKey: string): string {
    return activeDriver.getAbsolutePath(storageKey);
  }

  /**
   * Reconstruct public / accessible file URL for a storage key.
   */
  static getUrl(storageKey: string): string {
    return activeDriver.getUrl(storageKey);
  }

  /**
   * Delete a stored file by key.
   */
  static async delete(storageKey: string): Promise<void> {
    return activeDriver.delete(storageKey);
  }

  /**
   * Check if a stored file exists.
   */
  static async exists(storageKey: string): Promise<boolean> {
    return activeDriver.exists(storageKey);
  }

  /**
   * Read raw file buffer.
   */
  static async getBuffer(storageKey: string): Promise<Buffer> {
    return activeDriver.getBuffer(storageKey);
  }

  /**
   * Sanitise a filename: strip path traversal, allow only safe characters.
   */
  static sanitiseFilename(name: string): string {
    return LocalStorageDriver.sanitiseFilename(name);
  }
}
