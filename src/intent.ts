import { createHash } from "node:crypto";
import type { ParsedIntent } from "./types.js";

const NON_FUNDS_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "check_balance", re: /\b(balance|holding|portfolio|asset)\b/i },
  { name: "view_price", re: /\b(price|quote|market)\b/i },
  { name: "view_history", re: /\b(history|record|transactions?)\b/i },
  { name: "address_lookup", re: /\b(address|account|wallet)\b/i },
];

const FUNDS_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "transfer", re: /\b(transfer|send|withdraw)\b/i },
  { name: "swap", re: /\b(swap|exchange|buy|sell)\b/i },
  { name: "bridge", re: /\b(bridge)\b/i },
  { name: "approve", re: /\b(approve|allowance)\b/i },
];

function normalizeAmountWithUSuffix(raw: string): string {
  return raw.replace(/u$/i, "");
}

function extractSwapEntities(input: string): Record<string, string | number | boolean> {
  const canonical = input.match(/(?:swap|exchange)\s+([0-9]+(?:\.[0-9]+)?)([a-zA-Z]*)\s+([a-zA-Z0-9_]+)\s+(?:to|for)\s+([a-zA-Z0-9_]+)/i);
  if (canonical) {
    const mergedAmount = `${canonical[1]}${canonical[2] ?? ""}`;
    return {
      amount: normalizeAmountWithUSuffix(mergedAmount),
      token_in: canonical[3].toUpperCase(),
      token_out: canonical[4].toUpperCase(),
    };
  }

  const buySell = input.match(/(?:buy|sell)\s+([0-9]+(?:\.[0-9]+)?)([a-zA-Z]*)\s+([a-zA-Z0-9_]+)/i);
  if (buySell) {
    const mergedAmount = `${buySell[1]}${buySell[2] ?? ""}`;
    return {
      amount: normalizeAmountWithUSuffix(mergedAmount),
      token_in: buySell[3].toUpperCase(),
      token_out: "USDT",
    };
  }

  return {};
}

function normalizeTransferToken(raw?: string): string {
  const token = (raw ?? "ETH").trim().toUpperCase();
  if (token === "U") return "USDT";
  return token;
}

function extractTransferEntities(input: string): Record<string, string | number | boolean> {
  const compact = input.match(/(?:transfer|send|withdraw)\s+([0-9]+(?:\.[0-9]+)?)([a-zA-Z]+)?\s+to\s+(0x[a-fA-F0-9]{40})/i);
  if (compact) {
    return {
      amount: compact[1],
      token: normalizeTransferToken(compact[2]),
      to: compact[3],
    };
  }

  const spaced = input.match(/(?:transfer|send|withdraw)\s+([0-9]+(?:\.[0-9]+)?)\s+([a-zA-Z0-9_]+)?\s*(?:to)\s*(0x[a-fA-F0-9]{40})/i);
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
