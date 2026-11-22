export interface DeviceQuota {
  isPro: boolean;
  credits: number;
  dailyTrialsUsed: number;
  dailyTrialsDate: string;
}

export interface Reservation {
  deviceId: string;
  mode: 'pro' | 'daily_trial' | 'credit';
  creditsCharged: number;
  settled: boolean;
}

const FREE_DAILY_LIMIT = 3;
const FREE_MAX_BYTES = 25 * 1024 * 1024;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Atomic Credit & Trial Ledger for Tier 3 Cloud Worker.
 * Deducts atomically before dispatching, and refunds automatically on any conversion failure.
 */
export class CreditLedger {
  private readonly devices = new Map<string, DeviceQuota>();

  public getOrCreate(deviceId: string): DeviceQuota {
    const today = todayIso();
    let entry = this.devices.get(deviceId);
    if (!entry) {
      entry = { isPro: false, credits: 0, dailyTrialsUsed: 0, dailyTrialsDate: today };
      this.devices.set(deviceId, entry);
    } else if (entry.dailyTrialsDate !== today) {
      entry.dailyTrialsUsed = 0;
      entry.dailyTrialsDate = today;
    }
    return entry;
  }

  public grantCredits(deviceId: string, amount: number): DeviceQuota {
    const entry = this.getOrCreate(deviceId);
    entry.credits += amount;
    return { ...entry };
  }

  public setPro(deviceId: string, isPro: boolean): DeviceQuota {
    const entry = this.getOrCreate(deviceId);
    entry.isPro = isPro;
    return { ...entry };
  }

  public reserve(deviceId: string, fileSizeBytes: number): Reservation {
    const entry = this.getOrCreate(deviceId);
    if (entry.isPro) {
      return { deviceId, mode: 'pro', creditsCharged: 0, settled: false };
    }
    if (entry.dailyTrialsUsed < FREE_DAILY_LIMIT && fileSizeBytes <= FREE_MAX_BYTES) {
      entry.dailyTrialsUsed += 1;
      return { deviceId, mode: 'daily_trial', creditsCharged: 0, settled: false };
    }
    if (entry.credits >= 1) {
      entry.credits -= 1;
      return { deviceId, mode: 'credit', creditsCharged: 1, settled: false };
    }
    throw new Error('INSUFFICIENT_CREDITS');
  }

  public commit(reservation: Reservation): void {
    reservation.settled = true;
  }

  public refund(reservation: Reservation): void {
    if (reservation.settled) return;
    reservation.settled = true;
    const entry = this.getOrCreate(reservation.deviceId);
    if (reservation.mode === 'credit') {
      entry.credits += reservation.creditsCharged;
    } else if (reservation.mode === 'daily_trial') {
      entry.dailyTrialsUsed = Math.max(0, entry.dailyTrialsUsed - 1);
    }
  }
}
