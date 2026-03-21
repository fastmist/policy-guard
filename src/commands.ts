import { evaluatePolicy } from "./policy-engine.js";
import { PendingChallengeStore } from "./persistence.js";
import { WdkAdapter } from "./wdk-adapter.js";
import type { ChallengeRecord, PolicyEvaluation } from "./types.js";

export type CommandContext = {
  store: PendingChallengeStore;
  adapter: WdkAdapter;
};

function challengeFromPolicy(policy: PolicyEvaluation): ChallengeRecord {
  const now = new Date().toISOString();
  return {
    id: policy.requestId,
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
    evaluatorReason: policy.reason,
    policy,
  };
}

export function parseCommandText(input: string): { command: string; args: string[] } {
  const parts = input.trim().split(/\s+/).filter(Boolean);
  const command = parts.shift() ?? "";
  return { command, args: parts };
}

function parseAutoApprovalPolicyRequest(text: string): { maxAutoPerTx: number; maxAutoPerDay: number } | null {
  const normalized = text.toLowerCase();
  if (!/(authorize|allow|without confirmation|auto approve|免确认|授权)/i.test(normalized)) {
    return null;
  }

  const txMatch = normalized.match(/(?:single|per\s*tx|单笔)\s*(?:<=|<|=|限额)?\s*([0-9]+(?:\.[0-9]+)?)\s*u?/i);
  const dayMatch = normalized.match(/(?:daily|per\s*day|单日)\s*(?:<=|<|=|限额)?\s*([0-9]+(?:\.[0-9]+)?)\s*u?/i);

  const maxAutoPerTx = txMatch ? Number(txMatch[1]) : NaN;
  const maxAutoPerDay = dayMatch ? Number(dayMatch[1]) : NaN;

  if (!Number.isFinite(maxAutoPerTx) || !Number.isFinite(maxAutoPerDay)) {
    return null;
  }

  return { maxAutoPerTx, maxAutoPerDay };
}

export async function handleCommand(input: string, ctx: CommandContext): Promise<Record<string, unknown>> {
  const { command, args } = parseCommandText(input);

  if (command === "/policy") {
    const requestText = args.join(" ");
    if (!requestText) {
      return { ok: false, error: "Usage: /policy <request text>" };
    }

    const policyRequest = parseAutoApprovalPolicyRequest(requestText);
    if (policyRequest) {
      const applied = ctx.store.setAutoApprovalPolicy(policyRequest);
      return {
        ok: true,
        decision: "PASS",
        message: "Auto-approval policy updated.",
        autoApprovalPolicy: applied,
      };
    }

    const autoApprovalPolicy = ctx.store.getAutoApprovalPolicy();
    const dailySpent = ctx.store.getDailySpent();
    const policy = evaluatePolicy(requestText, { autoApprovalPolicy, dailySpent });
    if (policy.decision === "PASS") {
      const exec = policy.intent.nonFunds
        ? await ctx.adapter.executeNonFundsIntent(policy)
        : await ctx.adapter.executeApprovedChallenge(policy, "auto-approved-by-policy-pass");

      if (!policy.intent.nonFunds && exec.ok) {
        const rawAmount = policy.intent.entities.amount;
        const amount =
          typeof rawAmount === "number"
            ? rawAmount
            : typeof rawAmount === "string"
              ? Number(rawAmount.replace(/u$/i, ""))
              : NaN;
        if (Number.isFinite(amount) && amount > 0) {
          ctx.store.addDailySpent(amount);
        }
      }

      const txHash =
        exec.ok && typeof exec.details?.txHash === "string" && exec.details.txHash.length > 0
          ? exec.details.txHash
          : undefined;
      return { ok: true, decision: "PASS", policy, execution: exec, ...(txHash ? { txHash } : {}) };
    }

    const challenge = challengeFromPolicy(policy);
    ctx.store.upsertChallenge(challenge);
    return {
      ok: true,
      decision: "CHALLENGE",
      challengeId: challenge.id,
      message: `Challenge created. Use /approve ${challenge.id} [reason] or /reject ${challenge.id} [reason].`,
      policy,
    };
  }

  if (command === "/approve") {
    const [id, ...reasonParts] = args;
    if (!id) {
      return { ok: false, error: "Usage: /approve <id> [reason]" };
    }
    const challenge = ctx.store.getChallenge(id);
    if (!challenge) {
      return { ok: false, error: `Challenge ${id} not found.` };
    }

    if (challenge.status !== "PENDING") {
      return {
        ok: false,
        error: `Challenge ${id} is already ${challenge.status}. Duplicate /approve is blocked for idempotency.`,
        challengeId: id,
        status: challenge.status,
      };
    }

    challenge.status = "APPROVED";
    challenge.reason = reasonParts.join(" ") || undefined;
    challenge.updatedAt = new Date().toISOString();
    ctx.store.upsertChallenge(challenge);

    const exec = await ctx.adapter.executeApprovedChallenge(challenge.policy, challenge.reason);
    const txHash =
      exec.ok && typeof exec.details?.txHash === "string" && exec.details.txHash.length > 0
        ? exec.details.txHash
        : undefined;

    return {
      ok: true,
      challengeId: id,
      status: challenge.status,
      execution: exec,
      ...(txHash ? { txHash } : {}),
    };
  }

  if (command === "/reject") {
    const [id, ...reasonParts] = args;
    if (!id) {
      return { ok: false, error: "Usage: /reject <id> [reason]" };
    }
    const challenge = ctx.store.getChallenge(id);
    if (!challenge) {
      return { ok: false, error: `Challenge ${id} not found.` };
    }

    challenge.status = "REJECTED";
    challenge.reason = reasonParts.join(" ") || undefined;
    challenge.updatedAt = new Date().toISOString();
    ctx.store.upsertChallenge(challenge);

    return { ok: true, challengeId: id, status: challenge.status };
  }

  return {
    ok: false,
    error: "Unknown command. Supported: /policy, /approve <id> [reason], /reject <id> [reason]",
  };
}
