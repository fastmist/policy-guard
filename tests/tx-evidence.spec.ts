import { describe, expect, test } from "vitest";
import { buildEvidenceSkeleton, buildExplorerTxUrl, dedupeTxHashes } from "../src/tx-evidence.js";

describe("tx evidence", () => {
  test("dedupeTxHashes preserves order and removes duplicates", () => {
    expect(dedupeTxHashes(["0x1", "0x1", "0x2", "0x1"]).join(",")).toBe("0x1,0x2");
  });

  test("buildExplorerTxUrl defaults to arbitrum when chain unknown", () => {
    const url = buildExplorerTxUrl("unknown-chain", "0x" + "a".repeat(64));
    expect(url).toContain("arbiscan.io/tx/");
  });

  test("buildEvidenceSkeleton builds explorer urls", () => {
    const hash = "0x" + "b".repeat(64);
    const items = buildEvidenceSkeleton("arbitrum", [hash]);

    expect(items).toHaveLength(1);
    expect(items[0].txHash).toBe(hash);
    expect(items[0].explorerUrl).toBe(`https://arbiscan.io/tx/${hash}`);
  });
});
