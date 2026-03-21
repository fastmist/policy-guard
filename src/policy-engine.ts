import { parseIntent, stableRequestId } from "./intent.js";
import type { PolicyEvaluation } from "./types.js";

function isAutoApproveFundsEnabled(): boolean {
  const raw = process.env.POLICYGUARD_AUTO_APPROVE_FUNDS;
  if (!raw) return false;
  return /^(1|true|yes|on)$/i.test(raw.trim());
}

export function evaluatePolicy(commandText: string): PolicyEvaluation {
  const normalized = commandText.trim().replace(/\s+/g, " ");
  const intent = parseIntent(normalized);
  const requestId = stableRequestId(normalized.toLowerCase());

  if (intent.nonFunds) {
    return {
      requestId,
      decision: "PASS",
      reason: `Non-funds intent (${intent.name}) is allowed by MVP policy.`,
      intent,
      commandText: normalized,
      createdAt: new Date().toISOString(),
    };
  }

  if (isAutoApproveFundsEnabled()) {
    return {
      requestId,
      decision: "PASS",
      reason: `Funds intent (${intent.name}) auto-approved by policy (POLICYGUARD_AUTO_APPROVE_FUNDS).`,
      intent,
      commandText: normalized,
      createdAt: new Date().toISOString(),
    };
  }

  return {
    requestId,
    decision: "CHALLENGE",
    reason: `Intent (${intent.name}) requires explicit approval in MVP policy guard.`,
    intent,
    commandText: normalized,
    createdAt: new Date().toISOString(),
  };
}
