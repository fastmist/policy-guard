import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleCommand } from "../src/commands.js";
import { PendingChallengeStore } from "../src/persistence.js";
import { WdkAdapter } from "../src/wdk-adapter.js";

async function run() {
  const dir = mkdtempSync(join(tmpdir(), "policyguard-"));
  const file = join(dir, "pending.json");
  const store = new PendingChallengeStore(file);
  const adapter = new WdkAdapter({});

  const r1 = await handleCommand("/policy check my usdt balance", { store, adapter });
  if (!(r1.ok && r1.decision === "PASS")) {
    throw new Error(`Expected PASS, got ${JSON.stringify(r1)}`);
  }

  const r2 = await handleCommand("/policy transfer 100 usdt to bob", { store, adapter });
  if (!(r2.ok && r2.decision === "CHALLENGE" && typeof r2.challengeId === "string")) {
    throw new Error(`Expected CHALLENGE with id, got ${JSON.stringify(r2)}`);
  }

  const challengeId = String(r2.challengeId);
  const r3 = await handleCommand(`/approve ${challengeId} business_approved`, { store, adapter });
  if (!(r3.ok && r3.status === "APPROVED")) {
    throw new Error(`Expected APPROVED, got ${JSON.stringify(r3)}`);
  }

  const persisted = JSON.parse(readFileSync(file, "utf8")) as { challenges: Array<{ id: string; status: string }> };
  const saved = persisted.challenges.find((c) => c.id === challengeId);
  if (!saved || saved.status !== "APPROVED") {
    throw new Error(`Expected persisted APPROVED challenge, got ${JSON.stringify(saved)}`);
  }

  console.log("Validation passed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
