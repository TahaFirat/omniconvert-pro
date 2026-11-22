export class OmniError extends Error {
  public readonly code: string;
  public readonly recoverable: boolean;

  constructor(code: string, message: string, recoverable = true) {
    super(message);
    this.name = 'OmniError';
    this.code = code;
    this.recoverable = recoverable;
  }
}

export class OfflineLockedError extends OmniError {
  constructor(detail = 'Outbound network access is physically blocked in Offline Privacy Mode.') {
    super('BLOCK_OFFLINE_LOCK', detail, true);
    this.name = 'OfflineLockedError';
  }
}

export class DrmBlockedError extends OmniError {
  constructor(formatId: string) {
    super(
      'BLOCK_DRM',
      `DRM-protected file (${formatId.toUpperCase()}) cannot be legally or technically converted.`,
      false,
    );
    this.name = 'DrmBlockedError';
  }
}

export class EncryptedFileError extends OmniError {
  constructor(formatId: string) {
    super(
      'BLOCK_ENCRYPTED',
      `Encrypted or password-protected ${formatId.toUpperCase()} requires a password before conversion.`,
      true,
    );
    this.name = 'EncryptedFileError';
  }
}

export class ZipBombError extends OmniError {
  constructor(detail: string) {
    super('SECURITY_ZIP_BOMB', detail, false);
    this.name = 'ZipBombError';
  }
}

export class UnsupportedConversionError extends OmniError {
  constructor(source: string, target: string, offlineOnly: boolean) {
    super(
      offlineOnly ? 'NO_OFFLINE_PATH' : 'NO_CONVERSION_PATH',
      `No conversion path found from ${source.toUpperCase()} to ${target.toUpperCase()}${offlineOnly ? ' in Offline-Only mode' : ''}.`,
      true,
    );
    this.name = 'UnsupportedConversionError';
  }
}

export class InsufficientCreditsError extends OmniError {
  constructor() {
    super(
      'INSUFFICIENT_CREDITS',
      'Daily free cloud trials exhausted. Add never-expiring credits or upgrade to Pro.',
      true,
    );
    this.name = 'InsufficientCreditsError';
  }
}

export class JobCancelledError extends OmniError {
  constructor(jobId: string) {
    super('JOB_CANCELLED', `Job ${jobId} was cancelled by user.`, true);
    this.name = 'JobCancelledError';
  }
}

export class CloudWorkerError extends OmniError {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 500) {
    super('CLOUD_WORKER_ERROR', message, true);
    this.name = 'CloudWorkerError';
    this.statusCode = statusCode;
  }
}
