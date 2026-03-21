import { createHash } from "node:crypto";
import type { ParsedIntent } from "./types.js";

const NON_FUNDS_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "check_balance", re: /\b(balance|余额|持仓|资产)\b/i },
  { name: "view_price", re: /\b(price|报价|价格|行情)\b/i },
  { name: "view_history", re: /\b(history|记录|历史|交易记录)\b/i },
  { name: "address_lookup", re: /\b(address|地址|账户)\b/i },
];

const FUNDS_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "transfer", re: /\b(transfer|send|withdraw|转账|提现)\b/i },
  { name: "swap", re: /\b(swap|兑换|换币)\b/i },
  { name: "bridge", re: /\b(bridge|跨链)\b/i },
  { name: "approve", re: /\b(approve|授权)\b/i },
];

function extractSwapEntities(input: string): Record<string, string | number | boolean> {
  // Examples:
  // "swap 1 usdc to usdt"
  // "swap 0.1 weth for usdc"
  const m = input.match(/swap\s+([0-9]+(?:\.[0-9]+)?)\s+([a-zA-Z0-9_]+)\s+(?:to|for)\s+([a-zA-Z0-9_]+)/i);
  if (!m) return {};
  return {
    amount: m[1],
    token_in: m[2].toUpperCase(),
    token_out: m[3].toUpperCase(),
  };
}

function normalizeTransferToken(raw?: string): string {
  const token = (raw ?? "ETH").trim().toUpperCase();
  if (token === "U") return "USDT";
  return token;
}

function extractTransferEntities(input: string): Record<string, string | number | boolean> {
  // Examples:
  // "transfer 1U to 0x..."
  // "transfer 1 usdt to 0x..."
  // "send 0.02 eth to 0x..."
  const compact = input.match(/(?:transfer|send|withdraw|转账|提现)\s+([0-9]+(?:\.[0-9]+)?)([a-zA-Z]+)?\s+to\s+(0x[a-fA-F0-9]{40})/i);
  if (compact) {
    return {
      amount: compact[1],
      token: normalizeTransferToken(compact[2]),
      to: compact[3],
    };
  }

  const spaced = input.match(/(?:transfer|send|withdraw|转账|提现)\s+([0-9]+(?:\.[0-9]+)?)\s+([a-zA-Z0-9_]+)?\s*(?:to|给)\s*(0x[a-fA-F0-9]{40})/i);
  if (spaced) {
    return {
      amount: spaced[1],
      token: normalizeTransferToken(spaced[2]),
      to: spaced[3],
    };
  }

  return {};
}

export function parseIntent(commandText: string): ParsedIntent {
  const trimmed = commandText.trim();

  const funds = FUNDS_PATTERNS.find((p) => p.re.test(trimmed));
  if (funds) {
    return {
      name: funds.name,
      confidence: 0.95,
      nonFunds: false,
      entities:
        funds.name === "swap"
          ? extractSwapEntities(trimmed)
          : funds.name === "transfer"
            ? extractTransferEntities(trimmed)
            : {},
    };
  }

  const nonFunds = NON_FUNDS_PATTERNS.find((p) => p.re.test(trimmed));
  if (nonFunds) {
    return {
      name: nonFunds.name,
      confidence: 0.9,
      nonFunds: true,
      entities: {},
    };
  }

  return {
    name: "unknown",
    confidence: 0.2,
    nonFunds: false,
    entities: {},
  };
}

export function stableRequestId(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}
