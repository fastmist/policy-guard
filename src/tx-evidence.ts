export type SupportedChain =
  | "arbitrum"
  | "arbitrum-one"
  | "ethereum"
  | "mainnet"
  | "sepolia";

export type TxEvidenceItem = {
  txHash: string;
  chain: string;
  explorerUrl: string;
  fetchedAt?: string;
  receipt?: {
    status?: number;
    blockNumber?: number;
    gasUsed?: string;
    effectiveGasPrice?: string;
    from?: string;
    to?: string;
  };
  error?: string;
};

const EXPLORER_TX_BASE: Record<string, string> = {
  arbitrum: "https://arbiscan.io/tx/",
  "arbitrum-one": "https://arbiscan.io/tx/",
  ethereum: "https://etherscan.io/tx/",
  mainnet: "https://etherscan.io/tx/",
  sepolia: "https://sepolia.etherscan.io/tx/",
};

export function isTxHash(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value.trim());
}

export function buildExplorerTxUrl(chain: string, txHash: string): string {
  const base = EXPLORER_TX_BASE[chain.toLowerCase()] ?? EXPLORER_TX_BASE.arbitrum;
  return `${base}${txHash}`;
}

export function normalizeChain(chain: string | undefined): string {
  const raw = (chain ?? "arbitrum").trim();
  return raw.length > 0 ? raw.toLowerCase() : "arbitrum";
}

export function dedupeTxHashes(txHashes: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const hash of txHashes) {
    const normalized = hash.trim();
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

export function buildEvidenceSkeleton(chain: string, txHashes: string[]): TxEvidenceItem[] {
  const normalizedChain = normalizeChain(chain);
  return dedupeTxHashes(txHashes).map((txHash) => ({
    txHash,
    chain: normalizedChain,
    explorerUrl: buildExplorerTxUrl(normalizedChain, txHash),
  }));
}

export type FetchReceiptsOptions = {
  rpcUrl: string;
  timeoutMs?: number;
};

export async function fetchReceipts(
  items: TxEvidenceItem[],
  options: FetchReceiptsOptions,
): Promise<TxEvidenceItem[]> {
  const { rpcUrl, timeoutMs = 12_000 } = options;

  const { JsonRpcProvider } = await import("ethers");
  const provider = new JsonRpcProvider(rpcUrl);

  const withTimeout = async <T>(promise: Promise<T>): Promise<T> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // ethers v6 provider methods accept { signal } in fetchJson, but not everywhere.
      // This timeout is best-effort; still useful for our simple diagnostic fetch.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (await Promise.race([promise, new Promise<T>((_, reject) => {
        controller.signal.addEventListener("abort", () => reject(new Error("timeout")));
      })])) as any;
    } finally {
      clearTimeout(timer);
    }
  };

  const fetchedAt = new Date().toISOString();
  const out: TxEvidenceItem[] = [];

  for (const item of items) {
    if (!isTxHash(item.txHash)) {
      out.push({ ...item, fetchedAt, error: "invalid txHash" });
      continue;
    }

    try {
      const receipt = await withTimeout(provider.getTransactionReceipt(item.txHash));
      if (!receipt) {
        out.push({ ...item, fetchedAt, error: "receipt not found" });
        continue;
      }

      out.push({
        ...item,
        fetchedAt,
        receipt: {
          status: typeof receipt.status === "number" ? receipt.status : undefined,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed?.toString?.(),
          effectiveGasPrice: (receipt as unknown as { effectiveGasPrice?: { toString: () => string } }).effectiveGasPrice?.toString?.(),
          from: receipt.from,
          to: receipt.to ?? undefined,
        },
      });
    } catch (error) {
      out.push({
        ...item,
        fetchedAt,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return out;
}

export function renderEvidenceMarkdown(items: TxEvidenceItem[]): string {
  const lines: string[] = [];
  lines.push("# PolicyGuard Tx Evidence");
  lines.push("");

  for (const item of items) {
    const status = item.receipt?.status;
    const statusText = typeof status === "number" ? (status === 1 ? "success" : "failed") : "unknown";

    lines.push(`- txHash: \`${item.txHash}\``);
    lines.push(`  - chain: ${item.chain}`);
    lines.push(`  - explorer: ${item.explorerUrl}`);
    lines.push(`  - status: ${statusText}`);

    if (item.receipt?.blockNumber !== undefined) {
      lines.push(`  - blockNumber: ${item.receipt.blockNumber}`);
    }

    if (item.receipt?.from) {
      lines.push(`  - from: ${item.receipt.from}`);
    }

    if (item.receipt?.to) {
      lines.push(`  - to: ${item.receipt.to}`);
    }

    if (item.receipt?.gasUsed) {
      lines.push(`  - gasUsed: ${item.receipt.gasUsed}`);
    }

    if (item.receipt?.effectiveGasPrice) {
      lines.push(`  - effectiveGasPrice: ${item.receipt.effectiveGasPrice}`);
    }

    if (item.error) {
      lines.push(`  - error: ${item.error}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}
