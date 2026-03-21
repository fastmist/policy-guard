import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ChallengeRecord, PendingStore } from "./types.js";

const DEFAULT_STORE: PendingStore = {
  version: 1,
  challenges: [],
};

export class PendingChallengeStore {
  constructor(private readonly filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true });
  }

  load(): PendingStore {
    try {
      const raw = readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as PendingStore;
      if (parsed?.version === 1 && Array.isArray(parsed.challenges)) {
        return parsed;
      }
      return DEFAULT_STORE;
    } catch {
      return DEFAULT_STORE;
    }
  }

  save(store: PendingStore): void {
    const temp = `${this.filePath}.tmp`;
    writeFileSync(temp, JSON.stringify(store, null, 2), "utf8");
    renameSync(temp, this.filePath);
  }

  upsertChallenge(challenge: ChallengeRecord): ChallengeRecord {
    const store = this.load();
    const existingIdx = store.challenges.findIndex((x) => x.id === challenge.id);
    if (existingIdx >= 0) {
      store.challenges[existingIdx] = challenge;
    } else {
      store.challenges.push(challenge);
    }
    this.save(store);
    return challenge;
  }

  getChallenge(id: string): ChallengeRecord | undefined {
    return this.load().challenges.find((x) => x.id === id);
  }
}
