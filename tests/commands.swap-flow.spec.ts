import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleCommand } from "../src/commands.js";
import { PendingChallengeStore } from "../src/persistence.js";
import { WdkAdapter } from "../src/wdk-adapter.js";
import type { SwapExecutionInput } from "../src/wdk-adapter.js";

function makeAutoPassAdapter() {
  return new WdkAdapter(
    { wdkSeedEnvKey: "__TEST_WDK_SEED__" },
    async () => ({
      available: true,
      loaded: [
        "@tetherto/wdk",
        "@tetherto/wdk-wallet-evm",
        "@tetherto/wdk-protocol-swap-velora-evm",
      ],
      missing: [],
    }),
    async (_input: SwapExecutionInput) => ({
      txHash: "0xautopass123",
      protocol: "velora",
      meta: { source: "test-auto-pass" },
    }),
  );
}

describe("commands swap flow", () => {
  afterEach(() => {
    delete process.env.POLICYGUARD_AUTO_APPROVE_FUNDS;
  });

  test("policy swap => challenge => approve", async () => {
    const dir = mkdtempSync(join(tmpdir(), "policyguard-test-"));
    const store = new PendingChallengeStore(join(dir, "pending.json"));
    const adapter = new WdkAdapter({});

    const c = await handleCommand("/policy swap 1 usdt to usdc", { store, adapter });
    expect(c.ok).toBe(true);
    expect(c.decision).toBe("CHALLENGE");

    const id = String(c.challengeId);
    const a = await handleCommand(`/approve ${id} ok`, { store, adapter });
    expect(a.ok).toBe(true);
    expect(a.status).toBe("APPROVED");
  });

  test("duplicate /approve on same challenge is blocked", async () => {
    const dir = mkdtempSync(join(tmpdir(), "policyguard-test-"));
    const store = new PendingChallengeStore(join(dir, "pending.json"));
    const adapter = new WdkAdapter({});

    const c = await handleCommand("/policy swap 1 usdt to usdc", { store, adapter });
    const id = String(c.challengeId);

    const first = await handleCommand(`/approve ${id} first`, { store, adapter });
    expect(first.ok).toBe(true);
    expect(first.status).toBe("APPROVED");

    const second = await handleCommand(`/approve ${id} second`, { store, adapter });
    expect(second.ok).toBe(false);
    expect(String(second.error)).toContain("Duplicate /approve is blocked for idempotency");
    expect(second.status).toBe("APPROVED");
  });

  test("policy PASS for funds auto-executes approve path and returns txHash", async () => {
    process.env.POLICYGUARD_AUTO_APPROVE_FUNDS = "true";

    const dir = mkdtempSync(join(tmpdir(), "policyguard-test-"));
    const store = new PendingChallengeStore(join(dir, "pending.json"));

    const adapter = new WdkAdapter(
      { wdkSeedEnvKey: "__TEST_WDK_SEED__" },
      async () => ({
        available: true,
        loaded: [
          "@tetherto/wdk",
          "@tetherto/wdk-wallet-evm",
          "@tetherto/wdk-protocol-swap-velora-evm",
        ],
        missing: [],
      }),
      async (_input: SwapExecutionInput) => ({
        txHash: "0xautopass123",
        protocol: "velora",
        meta: { source: "test-auto-pass" },
      }),
    );

    const out = await handleCommand("/policy swap 1 usdt to usdc", { store, adapter });
    expect(out.ok).toBe(true);
    expect(out.decision).toBe("PASS");
    expect(out.execution?.ok).toBe(true);
    expect(out.txHash).toBe("0xautopass123");
    expect(out.execution?.details?.txHash).toBe("0xautopass123");
  });

  test("approve returns top-level txHash when swap executes successfully", async () => {
    const dir = mkdtempSync(join(tmpdir(), "policyguard-test-"));
    const store = new PendingChallengeStore(join(dir, "pending.json"));

    const adapter = new WdkAdapter(
      { wdkSeedEnvKey: "__TEST_WDK_SEED__" },
      async () => ({
        available: true,
        loaded: [
          "@tetherto/wdk",
          "@tetherto/wdk-wallet-evm",
          "@tetherto/wdk-protocol-swap-velora-evm",
        ],
        missing: [],
      }),
      async (_input: SwapExecutionInput) => ({
        txHash: "0xapprove123",
        protocol: "velora",
        meta: { source: "test" },
      }),
    );

    const c = await handleCommand("/policy swap 1 usdt to usdc", { store, adapter });
    const id = String(c.challengeId);

    const out = await handleCommand(`/approve ${id} ok`, { store, adapter });
    expect(out.ok).toBe(true);
    expect(out.status).toBe("APPROVED");
    expect(out.txHash).toBe("0xapprove123");
    expect(out.execution?.details?.txHash).toBe("0xapprove123");
  });

  test("policy authorization enables auto-pass for <=1U and daily <=10U", async () => {
    const dir = mkdtempSync(join(tmpdir(), "policyguard-test-"));
    const store = new PendingChallengeStore(join(dir, "pending.json"));
    const adapter = makeAutoPassAdapter();

    const auth = await handleCommand(
      "/policy authorize single <=1U without confirmation and daily <=10U",
      { store, adapter },
    );
    expect(auth.ok).toBe(true);
    expect(auth.decision).toBe("PASS");

    const smallBuy = await handleCommand("/policy buy 0.8U USDC", { store, adapter });
    expect(smallBuy.decision).toBe("PASS");

    const bigBuy = await handleCommand("/policy buy 100U USDC", { store, adapter });
    expect(bigBuy.decision).toBe("CHALLENGE");
  });

  test("daily limit is enforced after cumulative auto-pass", async () => {
    const dir = mkdtempSync(join(tmpdir(), "policyguard-test-"));
    const store = new PendingChallengeStore(join(dir, "pending.json"));
    const adapter = makeAutoPassAdapter();

    await handleCommand("/policy authorize single <=1U without confirmation and daily <=10U", { store, adapter });

    for (let i = 0; i < 10; i += 1) {
      const out = await handleCommand("/policy buy 1U USDC", { store, adapter });
      expect(out.decision).toBe("PASS");
    }

    const overLimit = await handleCommand("/policy buy 0.5U USDC", { store, adapter });
    expect(overLimit.decision).toBe("CHALLENGE");
  });

  test("same /policy text twice creates two different challenge instances", async () => {
    const dir = mkdtempSync(join(tmpdir(), "policyguard-test-"));
    const store = new PendingChallengeStore(join(dir, "pending.json"));
    const adapter = new WdkAdapter({});

    const first = await handleCommand("/policy swap 1 usdt to usdc", { store, adapter });
    const firstId = String(first.challengeId);
    expect(first.decision).toBe("CHALLENGE");

    const approveFirst = await handleCommand(`/approve ${firstId} first approval`, { store, adapter });
    expect(approveFirst.ok).toBe(true);
    expect(store.getChallenge(firstId)?.status).toBe("APPROVED");

    const second = await handleCommand("/policy swap 1 usdt to usdc", { store, adapter });
    const secondId = String(second.challengeId);
    expect(second.decision).toBe("CHALLENGE");
    expect(secondId).not.toBe(firstId);

    expect(store.getChallenge(firstId)?.status).toBe("APPROVED");
    expect(store.getChallenge(secondId)?.status).toBe("PENDING");
  });
});
