import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  buildEvidenceSkeleton,
  fetchReceipts,
  normalizeChain,
  renderEvidenceMarkdown,
} from "../src/tx-evidence.js";

function readEnvList(key: string): string[] {
  const raw = process.env[key];
  if (!raw) return [];
  return raw
    .split(/[\s,]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

async function run() {
  const chain = normalizeChain(process.env.POLICYGUARD_CHAIN ?? "arbitrum");

  const txHashes = readEnvList("POLICYGUARD_TX_HASHES");
  if (txHashes.length === 0) {
    throw new Error(
      "Missing POLICYGUARD_TX_HASHES env var. Example: POLICYGUARD_TX_HASHES=0xabc...,0xdef...",
    );
  }

  const rpcUrl = process.env.POLICYGUARD_RPC_URL ?? "https://arb1.arbitrum.io/rpc";

  const skeleton = buildEvidenceSkeleton(chain, txHashes);
  const withReceipts = await fetchReceipts(skeleton, { rpcUrl });

  const markdown = renderEvidenceMarkdown(withReceipts);
  const outputPath = process.env.POLICYGUARD_EVIDENCE_OUT ?? "./data/tx-evidence.md";

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, markdown, "utf8");

  console.log(JSON.stringify({ ok: true, chain, count: withReceipts.length, outputPath }, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
