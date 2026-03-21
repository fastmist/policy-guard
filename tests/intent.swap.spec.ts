import { describe, expect, test } from "vitest";
import { parseIntent } from "../src/intent.js";

describe("intent swap parsing", () => {
  test("detects swap as funds intent", () => {
    const intent = parseIntent("swap 100 usdt to eth");
    expect(intent.name).toBe("swap");
    expect(intent.nonFunds).toBe(false);
  });

  test("keeps non-funds intent as PASS candidate", () => {
    const intent = parseIntent("check my balance");
    expect(intent.name).toBe("check_balance");
    expect(intent.nonFunds).toBe(true);
  });
});
