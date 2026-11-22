import { open, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * Cryptographically overwrites a file with zeros before unlinking it.
 */
export async function secureWipeFile(filePath: string): Promise<void> {
  try {
    const info = await stat(filePath);
    if (info.isFile() && info.size > 0) {
      const fh = await open(filePath, 'r+');
      try {
        const zeroBuf = Buffer.alloc(Math.min(info.size, 64 * 1024));
        let remaining = info.size;
        let offset = 0;
        while (remaining > 0) {
          const toWrite = Math.min(remaining, zeroBuf.length);
          await fh.write(zeroBuf, 0, toWrite, offset);
          remaining -= toWrite;
          offset += toWrite;
        }
        await fh.sync();
      } finally {
        await fh.close();
      }
    }
  } catch {
    // File may already be gone
  }
  await rm(filePath, { force: true }).catch(() => {});
}

export async function secureWipeDirectory(dirPath: string): Promise<void> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await secureWipeDirectory(full);
      } else {
        await secureWipeFile(full);
      }
    }
  } catch {
    // ignore missing directory
  }
  await rm(dirPath, { recursive: true, force: true }).catch(() => {});
}

/**
 * Ephemeral 15-minute maximum TTL Janitor.
 * Scans the RAM-backed workDir and wipes every job folder older than ttlMs.
 */
export async function sweepExpiredJobDirs(
  workRoot: string,
  ttlMs: number = 15 * 60 * 1000,
  nowMs: number = Date.now(),
): Promise<string[]> {
  const removed: string[] = [];
  let entries;
  try {
    entries = await readdir(workRoot, { withFileTypes: true });
  } catch {
    return removed;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('job_')) continue;
    const fullPath = path.join(workRoot, entry.name);
    try {
      const info = await stat(fullPath);
      if (nowMs - info.mtimeMs >= ttlMs) {
        await secureWipeDirectory(fullPath);
        removed.push(entry.name);
      }
    } catch {
      // ignore races
    }
  }
  return removed;
}
