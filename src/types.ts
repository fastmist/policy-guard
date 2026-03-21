export type PolicyDecision = "PASS" | "CHALLENGE";

export type ParsedIntent = {
  name: string;
  confidence: number;
  nonFunds: boolean;
  entities: Record<string, string | number | boolean>;
};

export type PolicyEvaluation = {
  requestId: string;
  decision: PolicyDecision;
  reason: string;
  intent: ParsedIntent;
  commandText: string;
  createdAt: string;
};

export type ChallengeStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ChallengeRecord = {
  id: string;
  status: ChallengeStatus;
  createdAt: string;
  updatedAt: string;
  reason?: string;
  evaluatorReason: string;
  policy: PolicyEvaluation;
};

export type AutoApprovalPolicy = {
  maxAutoPerTx: number;
  maxAutoPerDay: number;
  enabled: boolean;
  updatedAt: string;
};

export type PendingStore = {
  version: 1;
  challenges: ChallengeRecord[];
  autoApprovalPolicy?: AutoApprovalPolicy;
  dailySpent?: {
    date: string;
    amount: number;
  };
};

export type WdkExecutionResult = {
  ok: boolean;
  mode: "live";
  endpoint?: string;
  details: Record<string, unknown>;
};
