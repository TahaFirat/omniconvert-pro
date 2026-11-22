import { OfflineLockedError } from '../../core/errors';

/**
 * Physical Network Guard for OmniConvert Pro.
 * When offlineOnlyMode === true and no per-job override is granted,
 * EVERY outbound cloud request is rejected BEFORE touching fetch/XHR.
 */
export class NetworkGuard {
  private offlineLocked = false;

  public setOfflineLocked(locked: boolean): void {
    this.offlineLocked = locked;
  }

  public isOfflineLocked(): boolean {
    return this.offlineLocked;
  }

  public assertAllowed(allowSingleJobOverride = false): void {
    if (this.offlineLocked && !allowSingleJobOverride) {
      throw new OfflineLockedError();
    }
  }

  public async guardedFetch(
    input: RequestInfo | URL,
    init: RequestInit | undefined,
    allowSingleJobOverride = false,
  ): Promise<Response> {
    this.assertAllowed(allowSingleJobOverride);
    return fetch(input, init);
  }
}

export const networkGuard = new NetworkGuard();
