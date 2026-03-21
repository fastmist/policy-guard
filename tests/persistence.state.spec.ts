import { describe, expect, test } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PendingChallengeStore } from "../src/persistence.js";
import type { ChallengeRecord } from "../src/types.js";

function sampleChallenge(id: string): ChallengeRecord {
  return {
    id,
    status: "PENDING",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    evaluatorReason: "need approval",
    policy: {
      requestId: id,
      decision: "CHALLENGE",
      reason: "funds",
      intent: { name: "swap", confidence: 0.95, nonFunds: false, entities: {} },
      commandText: "swap 1 usdt to usdc",
      createdAt: new Date().toISOString(),
    },
  };
}

describe("persistence state", () => {
  test("upsert + read challenge", () => {
    const dir = mkdtempSync(join(tmpdir(), "policyguard-test-"));
    const store = new PendingChallengeStore(join(dir, "pending.json"));

    store.upsertChallenge(sampleChallenge("abc123"));
    const got = store.getChallenge("abc123");

    expect(got).toBeDefined();
    expect(got?.status).toBe("PENDING");
  });

  test("updates existing challenge", () => {
    const dir = mkdtempSync(join(tmpdir(), "policyguard-test-"));
    const store = new PendingChallengeStore(join(dir, "pending.json"));

    const c = sampleChallenge("same-id");
    store.upsertChallenge(c);
    c.status = "APPROVED";
    store.upsertChallenge(c);

    expect(store.getChallenge("same-id")?.status).toBe("APPROVED");
  });
});
