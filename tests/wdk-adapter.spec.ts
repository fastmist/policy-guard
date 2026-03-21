import { describe, expect, test } from "vitest";
import {
  buildSwapParams,
  classifySwapExecutionError,
  createWdkSwapExecutor,
  WdkAdapter,
} from "../src/wdk-adapter.js";
import type { PolicyEvaluation } from "../src/types.js";

const basePolicy: PolicyEvaluation = {
  requestId: "r1",
  decision: "PASS",
  reason: "non-funds",
  intent: { name: "check_balance", confidence: 0.9, nonFunds: true, entities: {} },
  commandText: "check balance",
  createdAt: new Date().toISOString(),
};

describe("wdk adapter scaffold", () => {
  test("returns local live scaffold success for non-funds", async () => {
    const adapter = new WdkAdapter({});
    const out = await adapter.executeNonFundsIntent(basePolicy);
    expect(out.ok).toBe(true);
    expect(out.mode).toBe("live");
    expect(out.details.simulated).toBe(true);
  });

  test("returns blocked for funds in non-funds path", async () => {
    const adapter = new WdkAdapter({});
    const out = await adapter.executeNonFundsIntent({
      ...basePolicy,
      intent: { ...basePolicy.intent, name: "swap", nonFunds: false },
      decision: "CHALLENGE",
    });
    expect(out.ok).toBe(false);
  });

  test("rejects seed-like secrets from config object", () => {
    expect(() =>
      new WdkAdapter({
        wdkSeedEnvKey: "WDK_SEED",
        // simulate legacy/misconfigured file-based seed material
        wdkSeed: "seed phrase from config",
      } as any),
    ).toThrow("Forbidden config key \"wdkSeed\"");
  });

  test("approved swap returns runtime-missing error when dependencies are unavailable", async () => {
    const adapter = new WdkAdapter(
      { baseUrl: "https://example.invalid", apiKey: "legacy-token" },
      async () => ({
        available: false,
        loaded: ["@tetherto/wdk"],
        missing: ["@tetherto/wdk-wallet-evm", "@tetherto/wdk-protocol-swap-velora-evm"],
      }),
    );

    const out = await adapter.executeApprovedChallenge({
      ...basePolicy,
      decision: "CHALLENGE",
      intent: { ...basePolicy.intent, name: "swap", nonFunds: false },
      commandText: "swap 1 usdt to usdc",
    });

    expect(out.ok).toBe(false);
    expect(out.endpoint).toBeUndefined();
    expect(out.details.error).toContain("blocked");
    expect(out.details.errorCategory).toBe("UNKNOWN");
    expect(out.details.wdkRuntime).toEqual({
      available: false,
      loaded: ["@tetherto/wdk"],
      missing: ["@tetherto/wdk-wallet-evm", "@tetherto/wdk-protocol-swap-velora-evm"],
    });
    expect(out.details.deprecatedConfigWarnings).toEqual([
      expect.stringContaining("baseUrl"),
      expect.stringContaining("apiKey"),
    ]);
  });

  test("approved swap uses swap executor and returns txHash", async () => {
    const adapter = new WdkAdapter(
      {
        baseUrl: "https://legacy.example",
        apiKey: "legacy-key",
        wdkDryRun: true,
        chain: "arbitrum",
        accountIndex: 2,
        rpcUrl: "https://arb.example",
        swapProtocolLabel: "velora",
        swapMaxFee: "0.003",
        wdkSeedEnvKey: "__TEST_WDK_SEED__",
      },
      async () => ({
        available: true,
        loaded: [
          "@tetherto/wdk",
          "@tetherto/wdk-wallet-evm",
          "@tetherto/wdk-protocol-swap-velora-evm",
        ],
        missing: [],
      }),
      async (input) => {
        expect(input.requestId).toBe("r1");
        expect(input.commandText).toBe("swap 1 usdt to usdc");
        expect(input.entities.chain).toBe("arbitrum");
        expect(input.entities.account_index).toBe(2);
        expect(input.entities.rpc_url).toBe("https://arb.example");
        expect(input.entities.swap_protocol_label).toBe("velora");
        expect(input.entities.swap_max_fee).toBe("0.003");
        expect(input.runtime).toMatchObject({
          seedEnvKey: "__TEST_WDK_SEED__",
          chain: "arbitrum",
          accountIndex: 2,
          rpcUrl: "https://arb.example",
          swapProtocolLabel: "velora",
          swapMaxFee: "0.003",
        });
        return {
          txHash: "0xabc123",
          protocol: "velora",
          meta: { amountIn: "1", tokenIn: "USDT", tokenOut: "USDC" },
        };
      },
    );

    const out = await adapter.executeApprovedChallenge({
      ...basePolicy,
      decision: "CHALLENGE",
      intent: { ...basePolicy.intent, name: "swap", nonFunds: false },
      commandText: "swap 1 usdt to usdc",
    });

    expect(out.ok).toBe(true);
    expect(out.details.txHash).toBe("0xabc123");
    expect(out.details.protocol).toBe("velora");
    expect(out.details.meta.config).toMatchObject({
      chain: "arbitrum",
      accountIndex: 2,
      rpcUrl: "https://arb.example",
      swapProtocolLabel: "velora",
      swapMaxFee: "0.003",
      wdkSeedEnvKey: "__TEST_WDK_SEED__",
      seedConfigured: false,
      deprecatedConfigWarnings: [
        expect.stringContaining("baseUrl"),
        expect.stringContaining("apiKey"),
        expect.stringContaining("wdkDryRun"),
      ],
    });
  });

  test("createWdkSwapExecutor calls compatible WDK factory export and normalizes txHash", async () => {
    const executor = createWdkSwapExecutor(async () => ({
      createVeloraSwapClient: async () => ({
        swap: async () => ({ hash: "0xfeedbeef" }),
      }),
    }));

    const out = await executor({
      requestId: "r2",
      commandText: "swap 3 usdt to usdc",
      entities: { amount: 3, token_in: "USDT", token_out: "USDC" },
    });

    expect(out.txHash).toBe("0xfeedbeef");
    expect(out.protocol).toBe("velora");
    expect(out.meta?.source).toBe("wdk-local-runtime");
  });

  test("createWdkSwapExecutor passes normalized params payload to SDK swap()", async () => {
    let capturedPayload: Record<string, unknown> | undefined;

    const executor = createWdkSwapExecutor(async () => ({
      createVeloraSwapClient: async () => ({
        swap: async (payload: Record<string, unknown>) => {
          capturedPayload = payload;
          return { txHash: "0xabc999" };
        },
      }),
    }));

    const out = await executor({
      requestId: "r5",
      commandText: "swap 2.5 usdt to usdc",
      entities: {
        amount: "2.5",
        token_in: "usdt",
        token_out: "usdc",
        slippage_bps: "30",
        chain: "arbitrum",
      },
    });

    expect(out.txHash).toBe("0xabc999");
    expect(capturedPayload).toMatchObject({
      kind: "swap",
      requestId: "r5",
      params: {
        amount: "2.5",
        tokenIn: "USDT",
        tokenOut: "USDC",
        slippageBps: 30,
      },
      options: {
        chain: "arbitrum",
        tokenIn: {
          symbol: "USDT",
          address: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
          decimals: 6,
        },
        tokenOut: {
          symbol: "USDC",
          address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
          decimals: 6,
        },
        tokenInAmountBaseUnits: "2500000",
        slippageBps: 30,
      },
    });
  });

  test("createWdkSwapExecutor performs quoteSwap before swap and records snapshot", async () => {
    const calls: string[] = [];

    const executor = createWdkSwapExecutor(async () => ({
      createVeloraSwapClient: async () => ({
        quoteSwap: async () => {
          calls.push("quoteSwap");
          return { expectedAmountOut: "99.5", feeUsd: "0.2" };
        },
        swap: async () => {
          calls.push("swap");
          return { txHash: "0xquote123" };
        },
      }),
    }));

    const out = await executor({
      requestId: "r5q",
      commandText: "swap 100 usdt to usdc",
      entities: { amount: "100", token_in: "usdt", token_out: "usdc" },
    });

    expect(out.txHash).toBe("0xquote123");
    expect(calls).toEqual(["quoteSwap", "swap"]);
    expect(out.meta?.quoteSnapshot).toMatchObject({
      status: "ok",
      response: {
        provider: "client.quoteSwap",
        expectedAmountOut: "99.5",
        feeUsd: "0.2",
      },
    });
  });

  test("createWdkSwapExecutor supports direct swap export and includes runtime snapshot in payload", async () => {
    let capturedPayload: Record<string, unknown> | undefined;

    const executor = createWdkSwapExecutor(async () => ({
      swap: async (payload: Record<string, unknown>) => {
        capturedPayload = payload;
        return { tx: { hash: "0x1234" } };
      },
    }));

    const out = await executor({
      requestId: "r7",
      commandText: "swap 5 usdt to usdc",
      entities: { amount: "5", token_in: "usdt", token_out: "usdc" },
      runtime: {
        seed: "test seed phrase",
        seedEnvKey: "WDK_SEED",
        chain: "arbitrum",
        accountIndex: 1,
        rpcUrl: "https://arb.example",
        swapProtocolLabel: "velora",
      },
    });

    expect(out.txHash).toBe("0x1234");
    expect(capturedPayload).toMatchObject({
      runtime: {
        seedEnvKey: "WDK_SEED",
        chain: "arbitrum",
        accountIndex: 1,
        rpcUrl: "https://arb.example",
        swapProtocolLabel: "velora",
        seedConfigured: true,
      },
      options: {
        chain: "arbitrum",
        tokenIn: {
          symbol: "USDT",
          address: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
          decimals: 6,
        },
        tokenOut: {
          symbol: "USDC",
          address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
          decimals: 6,
        },
        tokenInAmountBaseUnits: "5000000",
      },
    });
    expect(JSON.stringify(capturedPayload)).not.toContain("test seed phrase");
  });

  test("buildSwapParams throws when required swap entities are missing", () => {
    expect(() =>
      buildSwapParams({
        requestId: "r6",
        commandText: "swap",
        entities: { token_in: "USDT" },
      }),
    ).toThrow("Missing required swap entities");
  });

  test("buildSwapParams rejects token_in == token_out", () => {
    expect(() =>
      buildSwapParams({
        requestId: "r_same",
        commandText: "swap 1 usdt to usdt",
        entities: { amount: 1, token_in: "USDT", token_out: "USDT" },
      }),
    ).toThrow("token_in and token_out must differ");
  });

  test("buildSwapParams enforces slippage_bps range", () => {
    expect(() =>
      buildSwapParams({
        requestId: "r_slip",
        commandText: "swap 1 usdt to usdc",
        entities: { amount: 1, token_in: "USDT", token_out: "USDC", slippage_bps: 0 },
      }),
    ).toThrow("slippage_bps must be within 1..5000");

    expect(() =>
      buildSwapParams({
        requestId: "r_slip2",
        commandText: "swap 1 usdt to usdc",
        entities: { amount: 1, token_in: "USDT", token_out: "USDC", slippage_bps: 6000 },
      }),
    ).toThrow("slippage_bps must be within 1..5000");
  });

  test("createWdkSwapExecutor can bootstrap swap client from WDK + wallet + protocol constructors", async () => {
    const calls: string[] = [];

    class FakeWdk {
      constructor(private readonly seed: string) {}

      registerWallet(chain: string, _walletManager: unknown, config: Record<string, unknown>) {
        calls.push(`registerWallet:${chain}:${String(config.provider)}`);
        return this;
      }

      registerProtocol(chain: string, label: string) {
        calls.push(`registerProtocol:${chain}:${label}`);
        return this;
      }

      async getAccount(chain: string, accountIndex = 0) {
        calls.push(`getAccount:${chain}:${accountIndex}:${this.seed}`);
        return {
          getAddress: async () => "0xReceiver",
          getSwapProtocol: () => ({
            quoteSwap: async (options: Record<string, unknown>) => {
              calls.push(`quoteSwap:${String(options.tokenIn)}:${String(options.tokenOut)}:${String(options.tokenInAmount)}`);
              return { fee: "10" };
            },
            swap: async (options: Record<string, unknown>) => {
              calls.push(`swap:${String(options.to)}`);
              return { hash: "0xwdkboot" };
            },
          }),
        };
      }

      dispose() {
        calls.push("dispose");
      }
    }

    const executor = createWdkSwapExecutor(async () => ({
      __wdkBindings: {
        WDK: FakeWdk,
        WalletManagerEvm: class FakeWalletManagerEvm {},
        VeloraProtocolEvm: class FakeVeloraProtocolEvm {},
      },
    }));

    const out = await executor({
      requestId: "r3",
      commandText: "swap 3 usdt to usdc",
      entities: { amount: 3, token_in: "USDT", token_out: "USDC" },
      runtime: {
        seed: "seed words",
        seedEnvKey: "WDK_SEED",
        chain: "arbitrum",
        accountIndex: 7,
        rpcUrl: "https://arb.example",
        swapProtocolLabel: "velora",
      },
    });

    expect(out.txHash).toBe("0xwdkboot");
    expect(calls).toEqual([
      "registerWallet:arbitrum:https://arb.example",
      "registerProtocol:arbitrum:velora",
      "getAccount:arbitrum:7:seed words",
      "quoteSwap:0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9:0xaf88d065e77c8cc2239327c5edb3a432268e5831:3000000",
      "swap:0xReceiver",
      "dispose",
    ]);
  });

  test("createWdkSwapExecutor throws clear error when no known factory export is available", async () => {
    const executor = createWdkSwapExecutor(async () => ({ notAFactory: true }));

    await expect(
      executor({
        requestId: "r3",
        commandText: "swap 3 usdt to usdc",
        entities: { amount: 3, token_in: "USDT", token_out: "USDC" },
      }),
    ).rejects.toThrow("No compatible WDK swap export found");
  });

  test("approved swap failure includes errorCategory", async () => {
    const adapter = new WdkAdapter(
      { wdkSeedEnvKey: "WDK_SEED" },
      async () => ({
        available: true,
        loaded: [
          "@tetherto/wdk",
          "@tetherto/wdk-wallet-evm",
          "@tetherto/wdk-protocol-swap-velora-evm",
        ],
        missing: [],
      }),
      async () => {
        throw new Error("insufficient funds for gas * price + value");
      },
    );

    const out = await adapter.executeApprovedChallenge({
      ...basePolicy,
      decision: "CHALLENGE",
      intent: { ...basePolicy.intent, name: "swap", nonFunds: false },
      commandText: "swap 1 usdt to usdc",
    });

    expect(out.ok).toBe(false);
    expect(out.details.errorCategory).toBe("BALANCE");
  });

  test("approved swap gas/baseFee failure returns retry advice", async () => {
    const adapter = new WdkAdapter(
      { wdkSeedEnvKey: "WDK_SEED" },
      async () => ({
        available: true,
        loaded: [
          "@tetherto/wdk",
          "@tetherto/wdk-wallet-evm",
          "@tetherto/wdk-protocol-swap-velora-evm",
        ],
        missing: [],
      }),
      async () => {
        throw new Error("max fee per gas less than block base fee");
      },
    );

    const out = await adapter.executeApprovedChallenge({
      ...basePolicy,
      decision: "CHALLENGE",
      intent: { ...basePolicy.intent, name: "swap", nonFunds: false },
      commandText: "swap 1 usdt to usdc",
    });

    expect(out.ok).toBe(false);
    expect(out.details.errorCategory).toBe("GAS");
    expect(out.details.retryable).toBe(true);
    expect(out.details.nextStep).toContain("Gas/baseFee 异常");
    expect(out.details.retryAdvice).toEqual(expect.arrayContaining([expect.stringContaining("swapMaxFee")]));
  });

  test("classifySwapExecutionError maps common swap failures", () => {
    expect(classifySwapExecutionError(new Error("JSON-RPC 503 service unavailable"))).toBe("RPC");
    expect(classifySwapExecutionError(new Error("allowance too low, need approve"))).toBe("ALLOWANCE");
    expect(classifySwapExecutionError(new Error("intrinsic gas too low"))).toBe("GAS");
    expect(classifySwapExecutionError(new Error("max fee per gas less than block base fee"))).toBe("GAS");
    expect(classifySwapExecutionError(new Error("request timed out after 30s"))).toBe("TIMEOUT");
    expect(classifySwapExecutionError(new Error("something unexpected"))).toBe("UNKNOWN");
  });
});
