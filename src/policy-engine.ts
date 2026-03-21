import { parseIntent, stableRequestId } from "./intent.js";
import type { AutoApprovalPolicy, PolicyEvaluation } from "./types.js";

function isAutoApproveFundsEnabled(): boolean {
  const raw = process.env.POLICYGUARD_AUTO_APPROVE_FUNDS;
  if (!raw) return false;
  return /^(1|true|yes|on)$/i.test(raw.trim());
}

function extractAmountForRiskGate(intent: ReturnType<typeof parseIntent>): number | undefined {
  const raw = intent.entities.amount;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw === "string") {
    const normalized = raw.trim().replace(/u$/i, "");
    const num = Number(normalized);
    return Number.isFinite(num) ? num : undefined;
  }
  return undefined;
}

export function evaluatePolicy(
  commandText: string,
  options?: { autoApprovalPolicy?: AutoApprovalPolicy; dailySpent?: number },
): PolicyEvaluation {
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

  if (options?.autoApprovalPolicy?.enabled) {
    const amount = extractAmountForRiskGate(intent);
    const dailySpent = options.dailySpent ?? 0;
    if (
      amount !== undefined &&
      amount <= options.autoApprovalPolicy.maxAutoPerTx &&
      dailySpent + amount <= options.autoApprovalPolicy.maxAutoPerDay
    ) {
      return {
        requestId,
        decision: "PASS",
        reason: `Funds intent (${intent.name}) auto-approved under policy: per-tx<=${options.autoApprovalPolicy.maxAutoPerTx}, daily<=${options.autoApprovalPolicy.maxAutoPerDay}.`,
        intent,
        commandText: normalized,
        createdAt: new Date().toISOString(),
      };
    }
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
