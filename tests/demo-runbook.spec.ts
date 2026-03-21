import { describe, expect, test } from "vitest";
import { buildDemoRunbook } from "../src/demo-runbook.js";

describe("demo runbook", () => {
  test("contains 3-minute flow and e2e command", () => {
    const output = buildDemoRunbook({ mockTxHash: "0xabc123" });

    expect(output).toContain("PolicyGuard 3-Minute Demo Runbook");
    expect(output).toContain("npm run wallet:check");
    expect(output).toContain("POLICYGUARD_E2E_MOCK_TX_HASH=0xabc123 npm run e2e:swap-approval");
    expect(output).toContain("/policy swap -> CHALLENGE -> /approve -> txHash");
  });
});
