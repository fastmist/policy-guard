import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { AutoApprovalPolicy, ChallengeRecord, PendingStore } from "./types.js";

function createDefaultStore(): PendingStore {
  return {
    version: 1,
    challenges: [],
  };
}

function utcDateKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export class PendingChallengeStore {
  constructor(private readonly filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true });
  }

  load(): PendingStore {
    try {
      const raw = readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as PendingStore;
      if (parsed?.version === 1 && Array.isArray(parsed.challenges)) {
        parsed.challenges = parsed.challenges.map((challenge) => ({
          ...challenge,
          requestId: challenge.requestId ?? challenge.policy?.requestId ?? challenge.id,
        }));
        return parsed;
      }
      return createDefaultStore();
    } catch {
      return createDefaultStore();
    }
  }

  save(store: PendingStore): void {
    const temp = `${this.filePath}.tmp`;
    writeFileSync(temp, JSON.stringify(store, null, 2), "utf8");
    renameSync(temp, this.filePath);
  }

  upsertChallenge(challenge: ChallengeRecord): ChallengeRecord {
    const store = this.load();
    const normalized: ChallengeRecord = {
      ...challenge,
      requestId: challenge.requestId || challenge.policy.requestId,
    };
    const existingIdx = store.challenges.findIndex((x) => x.id === challenge.id);
    if (existingIdx >= 0) {
      store.challenges[existingIdx] = normalized;
    } else {
      store.challenges.push(normalized);
    }
    this.save(store);
    return normalized;
  }

  getChallenge(id: string): ChallengeRecord | undefined {
    return this.load().challenges.find((x) => x.id === id);
  }

  setAutoApprovalPolicy(policy: { maxAutoPerTx: number; maxAutoPerDay: number; enabled?: boolean }): AutoApprovalPolicy {
    const store = this.load();
    const next: AutoApprovalPolicy = {
      maxAutoPerTx: policy.maxAutoPerTx,
      maxAutoPerDay: policy.maxAutoPerDay,
      enabled: policy.enabled ?? true,
      updatedAt: new Date().toISOString(),
    };
    store.autoApprovalPolicy = next;
    this.save(store);
    return next;
  }

  getAutoApprovalPolicy(): AutoApprovalPolicy | undefined {
    return this.load().autoApprovalPolicy;
  }

  getDailySpent(date = utcDateKey()): number {
    const store = this.load();
    if (!store.dailySpent || store.dailySpent.date !== date) {
      return 0;
    }
    return store.dailySpent.amount;
  }

  addDailySpent(amount: number, date = utcDateKey()): number {
    const store = this.load();
    if (!store.dailySpent || store.dailySpent.date !== date) {
      store.dailySpent = { date, amount: 0 };
    }
    store.dailySpent.amount += amount;
    this.save(store);
    return store.dailySpent.amount;
  }
}
