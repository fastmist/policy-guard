import { Contract, HDNodeWallet, JsonRpcProvider, isAddress, parseUnits } from "ethers";
import type { PolicyEvaluation, WdkExecutionResult } from "./types.js";

export type WdkAdapterConfig = {
  /** @deprecated no longer used in execution path */
  baseUrl?: string;
  /** @deprecated no longer used in execution path */
  apiKey?: string;
  /** @deprecated replaced by local WDK execution path */
  wdkDryRun?: boolean;
  wdkSeedEnvKey?: string;
  chain?: string;
  accountIndex?: number;
  rpcUrl?: string;
  swapProtocolLabel?: string;
  swapMaxFee?: string;
};

const REQUIRED_WDK_PACKAGES = [
  "@tetherto/wdk",
  "@tetherto/wdk-wallet-evm",
  "@tetherto/wdk-protocol-swap-velora-evm",
] as const;

type WdkRuntimeStatus = {
  available: boolean;
  loaded: string[];
  missing: string[];
};

type WdkRuntimeResolver = () => Promise<WdkRuntimeStatus>;

export type SwapExecutionRuntime = {
  seed?: string;
  seedEnvKey: string;
  chain?: string;
  accountIndex: number;
  rpcUrl?: string;
  swapProtocolLabel: string;
  swapMaxFee?: string;
};

export type SwapExecutionInput = {
  requestId: string;
  commandText: string;
  entities: Record<string, string | number | boolean>;
  reason?: string;
  runtime?: SwapExecutionRuntime;
};

export type SwapExecutionOutput = {
  txHash: string;
  protocol?: string;
  meta?: Record<string, unknown>;
};

export type TransferExecutionInput = {
  requestId: string;
  commandText: string;
  entities: Record<string, string | number | boolean>;
  reason?: string;
  runtime: SwapExecutionRuntime;
};

export type TransferExecutionOutput = {
  txHash: string;
  token: string;
  to: string;
  amount: string;
  amountBaseUnits: string;
  meta?: Record<string, unknown>;
};

export type TransferExecutor = (input: TransferExecutionInput) => Promise<TransferExecutionOutput>;

export type SwapExecutionErrorCategory =
  | "RPC"
  | "ALLOWANCE"
  | "GAS"
  | "BALANCE"
  | "TIMEOUT"
  | "UNKNOWN";

export type SwapExecutor = (input: SwapExecutionInput) => Promise<SwapExecutionOutput>;

type WdkSwapResponse = {
  txHash?: string;
  hash?: string;
  tx?: { hash?: string };
  [key: string]: unknown;
};

type WdkQuoteResponse = Record<string, unknown>;

type VeloraRateLike = {
  tokenTransferProxy?: string;
  contractAddress?: string;
};

type WdkSwapClient = {
  swap: (input: Record<string, unknown>) => Promise<WdkSwapResponse>;
  quoteSwap?: (input: Record<string, unknown>) => Promise<WdkQuoteResponse>;
  quote?: (input: Record<string, unknown>) => Promise<WdkQuoteResponse>;
  getQuote?: (input: Record<string, unknown>) => Promise<WdkQuoteResponse>;
};

type WdkSwapFactory = (input: SwapExecutionInput) => Promise<WdkSwapClient>;

type SwapProtocolModule = Record<string, unknown>;

type WdkConstructor = new (seed: string) => {
  registerWallet: (
    chain: string,
    WalletManager: new (seed: string, config?: Record<string, unknown>) => unknown,
    config?: Record<string, unknown>,
  ) => unknown;
  registerProtocol: (
    chain: string,
    label: string,
    Protocol: new (...args: unknown[]) => unknown,
    config?: Record<string, unknown>,
  ) => unknown;
  getAccount: (chain: string, accountIndex?: number) => Promise<{
    getAddress?: () => Promise<string>;
    getSwapProtocol?: (label: string) => {
      swap?: (options: Record<string, unknown>, config?: Record<string, unknown>) => Promise<WdkSwapResponse>;
      quoteSwap?: (options: Record<string, unknown>, config?: Record<string, unknown>) => Promise<WdkQuoteResponse>;
    };
  }>;
  dispose?: () => void;
};

type WalletManagerEvmConstructor = new (seed: string, config?: Record<string, unknown>) => unknown;
type VeloraProtocolConstructor = new (...args: unknown[]) => unknown;

type WdkBootstrapBindings = {
  WDK: WdkConstructor;
  WalletManagerEvm: WalletManagerEvmConstructor;
  VeloraProtocolEvm: VeloraProtocolConstructor;
};

type SwapProtocolLoader = () => Promise<SwapProtocolModule>;

const SWAP_FACTORY_EXPORT_CANDIDATES = [
  "createVeloraSwapClient",
  "createVeloraSwapProtocol",
  "createSwapClient",
  "createSwapProtocol",
  "createProtocolClient",
] as const;

const SWAP_DIRECT_EXPORT_CANDIDATES = [
  "swap",
  "executeSwap",
] as const;

const QUOTE_EXPORT_CANDIDATES = [
  "quoteSwap",
  "quote",
  "getQuote",
] as const;

type SwapQuoteSnapshot = {
  requestedAt: string;
  status: "ok" | "failed" | "unsupported";
  request: Record<string, unknown>;
  response?: Record<string, unknown>;
  error?: string;
};

async function detectWdkRuntime(): Promise<WdkRuntimeStatus> {
  const loaded: string[] = [];
  const missing: string[] = [];

  for (const pkg of REQUIRED_WDK_PACKAGES) {
    try {
      await import(pkg);
      loaded.push(pkg);
    } catch {
      missing.push(pkg);
    }
  }

  return {
    available: missing.length === 0,
    loaded,
    missing,
  };
}

function extractTxHash(output: WdkSwapResponse): string | undefined {
  if (typeof output.txHash === "string" && output.txHash.length > 0) {
    return output.txHash;
  }

  if (typeof output.hash === "string" && output.hash.length > 0) {
    return output.hash;
  }

  if (typeof output.tx?.hash === "string" && output.tx.hash.length > 0) {
    return output.tx.hash;
  }

  return undefined;
}

type CanonicalSwapParams = {
  amount: string;
  tokenIn: string;
  tokenOut: string;
  slippageBps?: number;
};

const TOKEN_MAP: Record<string, Record<string, { address: string; decimals: number }>> = {
  arbitrum: {
    ETH: { address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", decimals: 18 },
    WETH: { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", decimals: 18 },
    USDC: { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
    USDCE: { address: "0xFF970A61A04b1cA14834A43f5de4533eBDDB5CC8", decimals: 6 },
    USDT: { address: "0xFd086bC7CD5C481DCC9C85ebe478A1C0b69FCbb9", decimals: 6 },
    ARB: { address: "0x912CE59144191C1204E64559FE8253a0e49E6548", decimals: 18 },
    PEPE: { address: "0x25d887ce7a35172c62febfd67a1856f20faebb00", decimals: 18 },
  },
};

type ResolvedSwapRuntimeConfig = {
  wdkSeedEnvKey: string;
  chain?: string;
  accountIndex: number;
  rpcUrl?: string;
  swapProtocolLabel: string;
  swapMaxFee?: string;
};

const FORBIDDEN_SEED_CONFIG_KEYS = [
  "seed",
  "wdkSeed",
  "mnemonic",
  "wdkMnemonic",
  "privateKey",
  "wdkPrivateKey",
] as const;

const DEPRECATED_CONFIG_KEYS = ["baseUrl", "apiKey", "wdkBaseUrl", "wdkApiKey", "wdkDryRun"] as const;

function collectDeprecatedConfigWarnings(config: WdkAdapterConfig): string[] {
  const configRecord = config as Record<string, unknown>;
  const warnings: string[] = [];

  for (const key of DEPRECATED_CONFIG_KEYS) {
    const rawValue = configRecord[key];
    if (rawValue === undefined || rawValue === null) {
      continue;
    }
    if (typeof rawValue === "string" && rawValue.trim().length === 0) {
      continue;
    }

    warnings.push(`Deprecated config key "${key}" is ignored. Use local WDK runtime config (wdkSeedEnvKey/chain/accountIndex/rpcUrl/swapProtocolLabel/swapMaxFee).`);
  }

  return warnings;
}

function assertNoSeedMaterialInConfig(config: WdkAdapterConfig): void {
  const configRecord = config as Record<string, unknown>;

  for (const key of FORBIDDEN_SEED_CONFIG_KEYS) {
    const rawValue = configRecord[key];
    if (typeof rawValue === "string" && rawValue.trim().length > 0) {
      throw new Error(
        `Forbidden config key \"${key}\": seed material must come from environment variables only.`,
      );
    }
  }
}

function normalizeToken(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const token = value.trim();
  if (!token) {
    return undefined;
  }
  return token.toUpperCase();
}

function normalizeAmount(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return String(value);
  }

  if (typeof value === "string") {
    const amount = value.trim();
    if (!amount) {
      return undefined;
    }
    const asNumber = Number(amount);
    if (!Number.isFinite(asNumber) || asNumber <= 0) {
      return undefined;
    }
    return amount;
  }

  return undefined;
}

function normalizeSlippageBps(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value);
  }
  if (typeof value === "string") {
    const asNumber = Number(value.trim());
    if (Number.isFinite(asNumber)) {
      return Math.floor(asNumber);
    }
  }
  return undefined;
}

function resolveTokenOnChain(chain: string, symbolOrAddress: string): { address: string; decimals: number } {
  const normalizedChain = chain.toLowerCase();
  if (/^0x[a-fA-F0-9]{40}$/.test(symbolOrAddress)) {
    // If user gives a raw address, default decimals to 18 for MVP path.
    // Normalize to lowercase because some downstream quote APIs validate lowercase addresses.
    return { address: symbolOrAddress.toLowerCase(), decimals: 18 };
  }

  const token = TOKEN_MAP[normalizedChain]?.[symbolOrAddress.toUpperCase()];
  if (token) {
    return { ...token, address: token.address.toLowerCase() };
  }
  if (!token) {
    throw new Error(`Unsupported token symbol on ${chain}: ${symbolOrAddress}`);
  }
  return token;
}

function toBaseUnits(amount: string, decimals: number): bigint {
  const raw = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) {
    throw new Error(`Invalid decimal amount: ${amount}`);
  }
  const [intPart, fracPart = ""] = raw.split(".");
  const frac = (fracPart + "0".repeat(decimals)).slice(0, decimals);
  const normalized = (intPart + frac).replace(/^0+(?=\d)/, "");
  return BigInt(normalized);
}

function assertNonZeroBaseUnits(amount: string, decimals: number, context: string): void {
  const baseUnits = toBaseUnits(amount, decimals);
  if (baseUnits <= 0n) {
    throw new Error(`Invalid swap params: amount is too small for ${context} (baseUnits=0).`);
  }
}

export function buildSwapParams(input: SwapExecutionInput): CanonicalSwapParams {
  const entities = input.entities;
  const amount =
    normalizeAmount(entities.amount) ??
    normalizeAmount(entities.amount_in) ??
    normalizeAmount(entities.amountIn);
  const tokenIn = normalizeToken(entities.token_in) ?? normalizeToken(entities.tokenIn);
  const tokenOut = normalizeToken(entities.token_out) ?? normalizeToken(entities.tokenOut);

  if (!amount || !tokenIn || !tokenOut) {
    throw new Error(
      "Missing required swap entities: amount, token_in, token_out (or camelCase equivalents).",
    );
  }

  if (tokenIn === tokenOut) {
    throw new Error(`Invalid swap params: token_in and token_out must differ (both were ${tokenIn}).`);
  }

  const slippageBps =
    normalizeSlippageBps(entities.slippage_bps) ??
    normalizeSlippageBps(entities.slippageBps) ??
    normalizeSlippageBps(entities.slippage);

  if (slippageBps !== undefined && (slippageBps < 1 || slippageBps > 5000)) {
    throw new Error(
      `Invalid swap params: slippage_bps must be within 1..5000 (got ${slippageBps}).`,
    );
  }

  return {
    amount,
    tokenIn,
    tokenOut,
    slippageBps,
  };
}

type CanonicalTransferParams = {
  amount: string;
  token: string;
  to: string;
};

export function buildTransferParams(input: { entities: Record<string, string | number | boolean> }): CanonicalTransferParams {
  const entities = input.entities;
  const amount = normalizeAmount(entities.amount);
  const to = typeof entities.to === "string" ? entities.to.trim() : typeof entities.to_address === "string" ? entities.to_address.trim() : undefined;
  const tokenRaw =
    typeof entities.token === "string"
      ? entities.token
      : typeof entities.symbol === "string"
        ? entities.symbol
        : typeof entities.asset === "string"
          ? entities.asset
          : "ETH";
  const token = tokenRaw.trim().toUpperCase() === "U" ? "USDT" : tokenRaw.trim().toUpperCase();

  if (!amount || !to || !token) {
    throw new Error("Missing required transfer entities: amount, token (optional defaults ETH), to.");
  }

  if (!isAddress(to)) {
    throw new Error(`Invalid transfer recipient address: ${to}`);
  }

  return { amount, token, to };
}

type WdkSwapOptionsSnapshot = {
  chain: string;
  tokenIn: { symbol: string; address: string; decimals: number };
  tokenOut: { symbol: string; address: string; decimals: number };
  tokenInAmountBaseUnits: string;
  slippageBps?: number;
};

function getChainFromInput(input: SwapExecutionInput): string | undefined {
  if (input.runtime?.chain) {
    return input.runtime.chain;
  }

  const raw = input.entities.chain;
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.trim();
  }

  return undefined;
}

function tryBuildWdkSwapOptionsSnapshot(input: SwapExecutionInput): WdkSwapOptionsSnapshot | undefined {
  const chain = getChainFromInput(input);
  if (!chain) {
    return undefined;
  }

  try {
    const params = buildSwapParams(input);
    const tokenIn = resolveTokenOnChain(chain, params.tokenIn);
    const tokenOut = resolveTokenOnChain(chain, params.tokenOut);

    // Safety: avoid generating a 0-amount swap (common when amount < 1e-decimals)
    assertNonZeroBaseUnits(params.amount, tokenIn.decimals, `${params.tokenIn}(${tokenIn.decimals} decimals)`);

    const tokenInAmountBaseUnits = toBaseUnits(params.amount, tokenIn.decimals).toString();

    return {
      chain,
      tokenIn: {
        symbol: params.tokenIn,
        address: tokenIn.address,
        decimals: tokenIn.decimals,
      },
      tokenOut: {
        symbol: params.tokenOut,
        address: tokenOut.address,
        decimals: tokenOut.decimals,
      },
      tokenInAmountBaseUnits,
      slippageBps: params.slippageBps,
    };
  } catch {
    // Optional enrichment only; never block swap() wiring if token map/amount parsing can't resolve.
    return undefined;
  }
}

function makeSwapPayload(input: SwapExecutionInput): Record<string, unknown> {
  const runtime = input.runtime
    ? {
        seedEnvKey: input.runtime.seedEnvKey,
        chain: input.runtime.chain,
        accountIndex: input.runtime.accountIndex,
        rpcUrl: input.runtime.rpcUrl,
        swapProtocolLabel: input.runtime.swapProtocolLabel,
        swapMaxFee: input.runtime.swapMaxFee,
        seedConfigured: Boolean(input.runtime.seed),
      }
    : undefined;

  const swapOptionsSnapshot = tryBuildWdkSwapOptionsSnapshot(input);

  return {
    kind: "swap",
    requestId: input.requestId,
    reason: input.reason,
    commandText: input.commandText,
    entities: input.entities,
    params: buildSwapParams(input),
    runtime,
    options: swapOptionsSnapshot,
  };
}

function resolveChainId(chain?: string): number | undefined {
  const normalized = (chain ?? "").toLowerCase();
  if (normalized === "arbitrum") return 42161;
  return undefined;
}

async function resolveVeloraSpender(input: {
  chain?: string;
  tokenIn: string;
  tokenOut: string;
  tokenInAmount: string;
  tokenInDecimals: number;
  tokenOutDecimals: number;
}): Promise<string | undefined> {
  const chainId = resolveChainId(input.chain);
  if (!chainId) {
    return undefined;
  }

  const velora = (await import("@velora-dex/sdk")) as unknown as {
    constructSimpleSDK: (input: { fetch: typeof fetch; chainId: number }) => {
      swap: {
        getRate: (args: Record<string, unknown>) => Promise<VeloraRateLike>;
      };
    };
  };

  const sdk = velora.constructSimpleSDK({ fetch, chainId });
  const priceRoute = await sdk.swap.getRate({
    srcToken: input.tokenIn,
    destToken: input.tokenOut,
    amount: input.tokenInAmount,
    side: "SELL",
    srcDecimals: input.tokenInDecimals,
    destDecimals: input.tokenOutDecimals,
  });

  const spender =
    (typeof priceRoute.tokenTransferProxy === "string" && priceRoute.tokenTransferProxy) ||
    (typeof priceRoute.contractAddress === "string" && priceRoute.contractAddress) ||
    undefined;

  if (!spender) {
    return undefined;
  }

  return spender.toLowerCase();
}

function resolveSwapClient(moduleExports: SwapProtocolModule, input: SwapExecutionInput): Promise<WdkSwapClient> {
  for (const key of SWAP_FACTORY_EXPORT_CANDIDATES) {
    const candidate = moduleExports[key];
    if (typeof candidate === "function") {
      return Promise.resolve((candidate as WdkSwapFactory)(input));
    }
  }

  const defaultExport = moduleExports.default;
  if (defaultExport && typeof defaultExport === "object") {
    for (const key of SWAP_FACTORY_EXPORT_CANDIDATES) {
      const candidate = (defaultExport as Record<string, unknown>)[key];
      if (typeof candidate === "function") {
        return Promise.resolve((candidate as WdkSwapFactory)(input));
      }
    }
  }

  for (const key of SWAP_DIRECT_EXPORT_CANDIDATES) {
    const candidate = moduleExports[key];
    if (typeof candidate === "function") {
      return Promise.resolve({
        swap: (payload: Record<string, unknown>) =>
          Promise.resolve((candidate as (arg: Record<string, unknown>) => Promise<WdkSwapResponse> | WdkSwapResponse)(payload)),
      });
    }
  }

  const bindings = resolveWdkBootstrapBindings(moduleExports);
  if (bindings) {
    return bootstrapSwapClientFromWdk(bindings, input);
  }

  throw new Error(
    `No compatible WDK swap export found. Tried factories: ${SWAP_FACTORY_EXPORT_CANDIDATES.join(", ")}; direct: ${SWAP_DIRECT_EXPORT_CANDIDATES.join(", ")}`,
  );
}

function resolveWdkBootstrapBindings(moduleExports: SwapProtocolModule): WdkBootstrapBindings | undefined {
  const bindings = moduleExports.__wdkBindings;

  if (!bindings || typeof bindings !== "object") {
    return undefined;
  }

  const wdk = (bindings as Record<string, unknown>).WDK;
  const walletManager = (bindings as Record<string, unknown>).WalletManagerEvm;
  const veloraProtocol = (bindings as Record<string, unknown>).VeloraProtocolEvm;

  if (typeof wdk !== "function" || typeof walletManager !== "function" || typeof veloraProtocol !== "function") {
    return undefined;
  }

  return {
    WDK: wdk as WdkConstructor,
    WalletManagerEvm: walletManager as WalletManagerEvmConstructor,
    VeloraProtocolEvm: veloraProtocol as VeloraProtocolConstructor,
  };
}

async function bootstrapSwapClientFromWdk(
  bindings: WdkBootstrapBindings,
  input: SwapExecutionInput,
): Promise<WdkSwapClient> {
  const runtime = input.runtime;

  if (!runtime?.seed || !runtime.chain || !runtime.rpcUrl) {
    throw new Error("WDK bootstrap path requires runtime.seed, runtime.chain and runtime.rpcUrl.");
  }

  const swapParams = buildSwapParams(input);
  const tokenIn = resolveTokenOnChain(runtime.chain, swapParams.tokenIn);
  const tokenOut = resolveTokenOnChain(runtime.chain, swapParams.tokenOut);

  // Safety: don't allow a 0-baseUnits swap.
  assertNonZeroBaseUnits(swapParams.amount, tokenIn.decimals, `${swapParams.tokenIn}(${tokenIn.decimals} decimals)`);

  const tokenInAmount = toBaseUnits(swapParams.amount, tokenIn.decimals);

  const wdk = new bindings.WDK(runtime.seed);

  const walletConfig: Record<string, unknown> = {
    provider: runtime.rpcUrl,
  };

  const protocolConfig: Record<string, unknown> = {};
  if (runtime.swapMaxFee) {
    protocolConfig.swapMaxFee = runtime.swapMaxFee;
  }

  wdk.registerWallet(runtime.chain, bindings.WalletManagerEvm, walletConfig);
  wdk.registerProtocol(runtime.chain, runtime.swapProtocolLabel, bindings.VeloraProtocolEvm, protocolConfig);

  const account = await wdk.getAccount(runtime.chain, runtime.accountIndex);
  const accountAddress =
    typeof account.getAddress === "function"
      ? await account.getAddress()
      : undefined;

  if (!accountAddress) {
    throw new Error("WDK account address is unavailable.");
  }

  const protocol = account.getSwapProtocol?.(runtime.swapProtocolLabel);

  if (!protocol?.swap) {
    throw new Error(`WDK account has no swap protocol for label: ${runtime.swapProtocolLabel}`);
  }

  const swapOptions: Record<string, unknown> = {
    tokenIn: tokenIn.address,
    tokenOut: tokenOut.address,
    tokenInAmount,
    to: accountAddress,
  };

  try {
    const spender = await resolveVeloraSpender({
      chain: runtime.chain,
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      tokenInAmount: tokenInAmount.toString(),
      tokenInDecimals: tokenIn.decimals,
      tokenOutDecimals: tokenOut.decimals,
    });

    if (spender && runtime.seed && runtime.rpcUrl) {
      const path = `m/44'/60'/0'/0/${runtime.accountIndex ?? 0}`;
      const signer = HDNodeWallet.fromPhrase(runtime.seed, undefined, path).connect(new JsonRpcProvider(runtime.rpcUrl));
      const erc20 = new Contract(
        tokenIn.address,
        [
          "function allowance(address owner, address spender) view returns (uint256)",
          "function approve(address spender, uint256 amount) returns (bool)",
        ],
        signer,
      );

      const currentAllowance = (await erc20.allowance(await signer.getAddress(), spender)) as bigint;
      if (currentAllowance < tokenInAmount) {
        const approveTx = await erc20.approve(spender, tokenInAmount);
        await approveTx.wait();
      }
    }
  } catch {
    // Approve precheck is best-effort: swap path may still handle approvals internally.
  }

  const shouldFallbackToDirectVelora = (err: unknown): boolean => {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    // Fallback whenever WDK protocol path shows adapter/schema/quote incompatibility
    // or swap simulation/estimation failures that can be retried via direct Velora SDK path.
    return (
      msg.includes("validation failed") ||
      msg.includes("token not found") ||
      msg.includes("srcdecimals") ||
      msg.includes("destdecimals") ||
      msg.includes("execution reverted") ||
      msg.includes("unknown custom error") ||
      msg.includes("estimategas") ||
      msg.includes("call_exception")
    );
  };

  const directVeloraClient = async (): Promise<WdkSwapClient> => {
    const chainId = (runtime.chain ?? "").toLowerCase() === "arbitrum" ? 42161 : undefined;
    if (!chainId) {
      throw new Error(`Unsupported chain for direct Velora SDK path: ${runtime.chain}`);
    }

    const velora = (await import("@velora-dex/sdk")) as unknown as {
      constructSimpleSDK: (input: { fetch: typeof fetch; chainId: number }) => {
        swap: {
          getRate: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
          buildTx: (args: Record<string, unknown>, opts?: Record<string, unknown>) => Promise<Record<string, unknown>>;
        };
      };
    };

    const sdk = velora.constructSimpleSDK({ fetch, chainId });

    const buildPriceRoute = async () =>
      sdk.swap.getRate({
        srcToken: tokenIn.address,
        destToken: tokenOut.address,
        amount: tokenInAmount.toString(),
        side: "SELL",
        srcDecimals: tokenIn.decimals,
        destDecimals: tokenOut.decimals,
      });

    return {
      quoteSwap: protocol.quoteSwap
        ? async () => {
            const priceRoute = await buildPriceRoute();
            const srcAmount = (priceRoute as { srcAmount?: unknown }).srcAmount;
            const destAmount = (priceRoute as { destAmount?: unknown }).destAmount;
            if (typeof srcAmount !== "string" || typeof destAmount !== "string") {
              throw new Error("Velora getRate() returned unexpected shape (missing srcAmount/destAmount)." );
            }
            return {
              tokenInAmount: BigInt(srcAmount),
              tokenOutAmount: BigInt(destAmount),
            };
          }
        : undefined,
      swap: async () => {
        const priceRoute = await buildPriceRoute();
        const swapTx = await sdk.swap.buildTx(
          {
            partner: "wdk",
            srcToken: (priceRoute as { srcToken?: unknown }).srcToken,
            destToken: (priceRoute as { destToken?: unknown }).destToken,
            srcAmount: (priceRoute as { srcAmount?: unknown }).srcAmount,
            destAmount: (priceRoute as { destAmount?: unknown }).destAmount,
            userAddress: accountAddress,
            receiver: accountAddress,
            priceRoute,
          },
          { ignoreChecks: true },
        );

        const sent = await (account as unknown as { sendTransaction: (tx: unknown) => Promise<{ hash?: string }> }).sendTransaction(swapTx as unknown);
        if (!sent?.hash) {
          throw new Error("Direct Velora swap submitted, but no tx hash was returned.");
        }
        return { hash: sent.hash };
      },
    };
  };

  return {
    quoteSwap: protocol.quoteSwap
      ? async () => {
          try {
            return await protocol.quoteSwap!(swapOptions);
          } catch (err) {
            if (!shouldFallbackToDirectVelora(err)) throw err;
            const client = await directVeloraClient();
            if (!client.quoteSwap) throw err;
            return await client.quoteSwap({});
          }
        }
      : undefined,
    swap: async () => {
      try {
        return await protocol.swap!(swapOptions);
      } catch (err) {
        if (!shouldFallbackToDirectVelora(err)) throw err;
        const client = await directVeloraClient();
        return await client.swap({});
      } finally {
        wdk.dispose?.();
      }
    },
  };
}

async function collectSwapQuoteSnapshot(
  client: WdkSwapClient,
  moduleExports: SwapProtocolModule,
  payload: Record<string, unknown>,
): Promise<SwapQuoteSnapshot> {
  const requestedAt = new Date().toISOString();

  const quoteFromClient = QUOTE_EXPORT_CANDIDATES.find(
    (key) => typeof client[key] === "function",
  );

  if (quoteFromClient) {
    try {
      const quote = await (client[quoteFromClient] as (input: Record<string, unknown>) => Promise<WdkQuoteResponse>)(payload);
      return {
        requestedAt,
        status: "ok",
        request: payload,
        response: {
          provider: `client.${quoteFromClient}`,
          ...(quote ?? {}),
        },
      };
    } catch (error) {
      return {
        requestedAt,
        status: "failed",
        request: payload,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  for (const key of QUOTE_EXPORT_CANDIDATES) {
    const candidate = moduleExports[key];
    if (typeof candidate === "function") {
      try {
        const quote = await (candidate as (input: Record<string, unknown>) => Promise<WdkQuoteResponse> | WdkQuoteResponse)(payload);
        return {
          requestedAt,
          status: "ok",
          request: payload,
          response: {
            provider: `module.${key}`,
            ...(quote ?? {}),
          },
        };
      } catch (error) {
        return {
          requestedAt,
          status: "failed",
          request: payload,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  }

  return {
    requestedAt,
    status: "unsupported",
    request: payload,
    error: `No compatible quote export found. Tried: ${QUOTE_EXPORT_CANDIDATES.join(", ")}`,
  };
}

function readOptionalEnv(key: string): string | undefined {
  const value = process.env[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function classifySwapExecutionError(error: unknown): SwapExecutionErrorCategory {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

  if (/runtime\.seed|runtime\.chain|runtime\.rpcurl|missing seed env/.test(message)) {
    return "UNKNOWN";
  }

  if (/timeout|timed out|deadline exceeded|etimedout|econnaborted/.test(message)) {
    return "TIMEOUT";
  }

  if (/insufficient funds|insufficient balance|balance too low|not enough balance/.test(message)) {
    return "BALANCE";
  }

  if (/allowance|approve|permit/.test(message)) {
    return "ALLOWANCE";
  }

  if (/out of gas|intrinsic gas|max fee|max priority fee|base fee|basefee|fee cap|gas/.test(message)) {
    return "GAS";
  }

  if (/rpc|json-rpc|network error|failed to fetch|http\s*5\d\d|503|connection refused/.test(message)) {
    return "RPC";
  }

  return "UNKNOWN";
}

type SwapFailureFallback = {
  nextStep: string;
  retryAdvice?: string[];
  retryable?: boolean;
};

function buildSwapFailureFallback(errorCategory: SwapExecutionErrorCategory): SwapFailureFallback {
  if (errorCategory === "GAS") {
    return {
      nextStep: "Gas/baseFee 异常：建议等待 15-30 秒后重试；若持续失败，调高 swapMaxFee 或更换 RPC 节点。",
      retryAdvice: [
        "自动重试建议：15-30 秒后再次提交一次 approve/swap。",
        "若报错包含 baseFee/fee cap：将 swapMaxFee 上调后重试。",
        "若同一节点连续 2 次失败：切换 rpcUrl 后再试。",
      ],
      retryable: true,
    };
  }

  return {
    nextStep: "Verify WDK swap factory export + wallet/protocol client initialization against installed SDK.",
  };
}

function resolveSwapRuntimeConfig(config: WdkAdapterConfig): ResolvedSwapRuntimeConfig {
  const accountIndex = Number.isInteger(config.accountIndex) && (config.accountIndex as number) >= 0 ? (config.accountIndex as number) : 0;

  return {
    wdkSeedEnvKey: (config.wdkSeedEnvKey ?? "WDK_SEED").trim() || "WDK_SEED",
    chain: config.chain?.trim() || "arbitrum",
    accountIndex,
    rpcUrl: config.rpcUrl?.trim() || "https://arb1.arbitrum.io/rpc",
    swapProtocolLabel: config.swapProtocolLabel?.trim() || "velora",
    swapMaxFee: config.swapMaxFee?.trim() || undefined,
  };
}

export function createWdkSwapExecutor(loader: SwapProtocolLoader): SwapExecutor {
  return async (input) => {
    const moduleExports = await loader();
    const client = await resolveSwapClient(moduleExports, input);

    if (!client || typeof client.swap !== "function") {
      throw new Error("WDK swap factory resolved, but returned client has no swap() function.");
    }

    const payload = makeSwapPayload(input);
    const quoteSnapshot = await collectSwapQuoteSnapshot(client, moduleExports, payload);

    const rawOutput = await client.swap(payload);
    const txHash = extractTxHash(rawOutput);

    if (!txHash) {
      throw new Error("WDK swap() completed, but no txHash/hash was returned by SDK.");
    }

    return {
      txHash,
      protocol: "velora",
      meta: {
        source: "wdk-local-runtime",
        quoteSnapshot,
      },
    };
  };
}

const loadSwapProtocolModule: SwapProtocolLoader = async () => {
  const dynamicImport = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<SwapProtocolModule>;

  const [protocolModule, wdkModule, walletModule] = await Promise.all([
    dynamicImport("@tetherto/wdk-protocol-swap-velora-evm"),
    dynamicImport("@tetherto/wdk"),
    dynamicImport("@tetherto/wdk-wallet-evm"),
  ]);

  return {
    ...protocolModule,
    __wdkBindings: {
      WDK: wdkModule.default,
      WalletManagerEvm: walletModule.default,
      VeloraProtocolEvm: protocolModule.default,
    },
  };
};

const defaultSwapExecutor: SwapExecutor = createWdkSwapExecutor(loadSwapProtocolModule);

const defaultTransferExecutor: TransferExecutor = async (input) => {
  const params = buildTransferParams(input);
  const runtime = input.runtime;

  if (!runtime.seed) {
    throw new Error(`Missing seed env: set ${runtime.seedEnvKey} before running approve/transfer.`);
  }
  if (!runtime.chain || !runtime.rpcUrl) {
    throw new Error("Transfer runtime requires chain and rpcUrl.");
  }

  const token = resolveTokenOnChain(runtime.chain, params.token);
  const signerPath = `m/44'/60'/0'/0/${runtime.accountIndex ?? 0}`;
  const signer = HDNodeWallet.fromPhrase(runtime.seed, undefined, signerPath).connect(new JsonRpcProvider(runtime.rpcUrl));

  const meta: Record<string, unknown> = {
    chain: runtime.chain,
    accountIndex: runtime.accountIndex,
  };

  if (token.address === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") {
    const value = parseUnits(params.amount, token.decimals);
    const tx = await signer.sendTransaction({ to: params.to, value });
    if (!tx.hash) {
      throw new Error("Native transfer submitted, but no tx hash was returned.");
    }
    return {
      txHash: tx.hash,
      token: params.token,
      to: params.to,
      amount: params.amount,
      amountBaseUnits: value.toString(),
      meta,
    };
  }

  const amountBaseUnits = toBaseUnits(params.amount, token.decimals);
  const erc20 = new Contract(
    token.address,
    ["function transfer(address to, uint256 value) returns (bool)"],
    signer,
  );

  const tx = await (erc20.transfer as (to: string, value: bigint) => Promise<{ hash?: string; wait: () => Promise<unknown> }>)(params.to, amountBaseUnits);
  if (!tx?.hash) {
    throw new Error("ERC20 transfer submitted, but no tx hash was returned.");
  }
  await tx.wait();

  return {
    txHash: tx.hash,
    token: params.token,
    to: params.to,
    amount: params.amount,
    amountBaseUnits: amountBaseUnits.toString(),
    meta,
  };
};

export class WdkAdapter {
  private runtimeResolver: WdkRuntimeResolver;
  private swapExecutor: SwapExecutor;
  private transferExecutor: TransferExecutor;
  private config: ResolvedSwapRuntimeConfig;
  private deprecatedConfigWarnings: string[];

  constructor(
    config: WdkAdapterConfig = {},
    runtimeResolver: WdkRuntimeResolver = detectWdkRuntime,
    swapExecutor: SwapExecutor = defaultSwapExecutor,
    transferExecutor: TransferExecutor = defaultTransferExecutor,
  ) {
    assertNoSeedMaterialInConfig(config);
    this.runtimeResolver = runtimeResolver;
    this.swapExecutor = swapExecutor;
    this.transferExecutor = transferExecutor;
    this.config = resolveSwapRuntimeConfig(config);
    this.deprecatedConfigWarnings = collectDeprecatedConfigWarnings(config);
  }

  async executeNonFundsIntent(policy: PolicyEvaluation): Promise<WdkExecutionResult> {
    if (!policy.intent.nonFunds) {
      return {
        ok: false,
        mode: "live",
        details: { error: "Funds intent is blocked from direct execution path." },
      };
    }

    return {
      ok: true,
      mode: "live",
      details: {
        requestId: policy.requestId,
        intent: policy.intent.name,
        simulated: true,
        note: "Local non-funds execution scaffold (no remote HTTP dependency).",
      },
    };
  }

  async executeApprovedChallenge(policy: PolicyEvaluation, reason?: string): Promise<WdkExecutionResult> {
    const runtime = await this.runtimeResolver();

    if (policy.intent.name === "transfer") {
      try {
        const seed = readOptionalEnv(this.config.wdkSeedEnvKey);
        const transfer = await this.transferExecutor({
          requestId: policy.requestId,
          commandText: policy.commandText,
          entities: {
            ...policy.intent.entities,
            chain: this.config.chain ?? policy.intent.entities.chain,
            account_index: this.config.accountIndex,
            rpc_url: this.config.rpcUrl ?? policy.intent.entities.rpc_url,
          },
          reason,
          runtime: {
            seed,
            seedEnvKey: this.config.wdkSeedEnvKey,
            chain: this.config.chain,
            accountIndex: this.config.accountIndex,
            rpcUrl: this.config.rpcUrl,
            swapProtocolLabel: this.config.swapProtocolLabel,
            swapMaxFee: this.config.swapMaxFee,
          },
        });

        return {
          ok: true,
          mode: "live",
          details: {
            requestId: policy.requestId,
            approved: true,
            reason: reason ?? "",
            txHash: transfer.txHash,
            token: transfer.token,
            amount: transfer.amount,
            amountBaseUnits: transfer.amountBaseUnits,
            to: transfer.to,
            meta: {
              ...(transfer.meta ?? {}),
              config: {
                chain: this.config.chain,
                accountIndex: this.config.accountIndex,
                rpcUrl: this.config.rpcUrl,
                wdkSeedEnvKey: this.config.wdkSeedEnvKey,
                seedConfigured: Boolean(seed),
                deprecatedConfigWarnings: this.deprecatedConfigWarnings,
              },
            },
            wdkRuntime: runtime,
          },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorCategory = classifySwapExecutionError(error);
        const missingSeedRuntime = /missing seed env|runtime\.seed/i.test(errorMessage);
        return {
          ok: false,
          mode: "live",
          details: {
            requestId: policy.requestId,
            approved: true,
            reason: reason ?? "",
            error: errorMessage,
            errorCategory,
            nextStep: missingSeedRuntime
              ? `Missing seed env: set ${this.config.wdkSeedEnvKey} (or POLICYGUARD_SEED_ENV_KEY) before running approve/transfer.`
              : "Verify recipient/token/amount and ensure wallet has sufficient token + gas balance.",
            retryable: true,
            wdkRuntime: runtime,
            deprecatedConfigWarnings: this.deprecatedConfigWarnings,
          },
        };
      }
    }

    if (policy.intent.name !== "swap") {
      return {
        ok: false,
        mode: "live",
        details: {
          requestId: policy.requestId,
          approved: true,
          reason: reason ?? "",
          error: `Unsupported funds intent: ${policy.intent.name}`,
          errorCategory: "UNKNOWN",
          nextStep: "Currently supported funds intents: transfer, swap.",
          wdkRuntime: runtime,
        },
      };
    }

    if (!runtime.available) {
      return {
        ok: false,
        mode: "live",
        details: {
          requestId: policy.requestId,
          approved: true,
          reason: reason ?? "",
          error: "swap() execution blocked: required WDK runtime packages are missing.",
          errorCategory: "UNKNOWN",
          wdkRuntime: runtime,
          nextStep: "Install @tetherto/wdk, @tetherto/wdk-wallet-evm, @tetherto/wdk-protocol-swap-velora-evm",
          deprecatedConfigWarnings: this.deprecatedConfigWarnings,
        },
      };
    }

    try {
      const seed = readOptionalEnv(this.config.wdkSeedEnvKey);
      const swap = await this.swapExecutor({
        requestId: policy.requestId,
        commandText: policy.commandText,
        entities: {
          ...policy.intent.entities,
          chain: this.config.chain ?? policy.intent.entities.chain,
          account_index: this.config.accountIndex,
          rpc_url: this.config.rpcUrl ?? policy.intent.entities.rpc_url,
          swap_protocol_label: this.config.swapProtocolLabel,
          swap_max_fee: this.config.swapMaxFee ?? policy.intent.entities.swap_max_fee,
        },
        reason,
        runtime: {
          seed,
          seedEnvKey: this.config.wdkSeedEnvKey,
          chain: this.config.chain,
          accountIndex: this.config.accountIndex,
          rpcUrl: this.config.rpcUrl,
          swapProtocolLabel: this.config.swapProtocolLabel,
          swapMaxFee: this.config.swapMaxFee,
        },
      });

      return {
        ok: true,
        mode: "live",
        details: {
          requestId: policy.requestId,
          approved: true,
          reason: reason ?? "",
          txHash: swap.txHash,
          protocol: swap.protocol ?? this.config.swapProtocolLabel,
          meta: {
            ...(swap.meta ?? {}),
            config: {
              chain: this.config.chain,
              accountIndex: this.config.accountIndex,
              rpcUrl: this.config.rpcUrl,
              swapProtocolLabel: this.config.swapProtocolLabel,
              swapMaxFee: this.config.swapMaxFee,
              wdkSeedEnvKey: this.config.wdkSeedEnvKey,
              seedConfigured: Boolean(seed),
              deprecatedConfigWarnings: this.deprecatedConfigWarnings,
            },
          },
          wdkRuntime: runtime,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCategory = classifySwapExecutionError(error);
      const fallback = buildSwapFailureFallback(errorCategory);
      const missingSeedRuntime = /runtime\.seed/i.test(errorMessage);

      return {
        ok: false,
        mode: "live",
        details: {
          requestId: policy.requestId,
          approved: true,
          reason: reason ?? "",
          error: errorMessage,
          errorCategory,
          nextStep: missingSeedRuntime
            ? `Missing seed env: set ${this.config.wdkSeedEnvKey} (or POLICYGUARD_SEED_ENV_KEY) before running approve/swap.`
            : fallback.nextStep,
          retryAdvice: fallback.retryAdvice,
          retryable: fallback.retryable,
          wdkRuntime: runtime,
          deprecatedConfigWarnings: this.deprecatedConfigWarnings,
        },
      };
    }
  }
}
