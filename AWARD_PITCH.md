# AWARD_PITCH.md (Judge Narrative, 3-Minute Version)

Goal: make judges understand **Problem → Solution → Technical Highlights → Verifiable Evidence → Risk Controls → Extensibility** in under 3 minutes, and trust that real on-chain execution is possible.

## 1) Problem
In AI-agent wallets, the biggest risk is not model quality—it is direct fund movement without deterministic guardrails.

Common failure modes:
- Misunderstood user intent triggers a transfer/swap
- Prompt injection or social engineering requests money movement
- Duplicate approvals / repeated execution
- Weak auditability after incidents

## 2) Solution
**PolicyGuard** adds a deterministic security layer to OpenClaw:
- Non-funds intents → `PASS`
- Funds intents (transfer/swap/bridge/approve) → `CHALLENGE`
- `/approve <challengeId>` is required before execution
- `/reject <challengeId>` terminates the request with persistent audit state

## 3) Technical Highlights (Expanded)
1. **Deterministic Policy Engine (LLM-independent decision boundary)**
   - Hard, predictable PASS/CHALLENGE logic for funds operations
   - Stable request fingerprint (`requestId`) for idempotency and traceability

2. **Challenge State Machine + Durable Persistence**
   - Atomic JSON writes (tmp + rename)
   - Explicit lifecycle: `PENDING -> APPROVED/REJECTED`

3. **Strong Idempotency Safety**
   - Duplicate `/approve` on non-PENDING challenge is blocked
   - Prevents accidental double execution

4. **Execution Adapter with Structured Error Taxonomy**
   - Categorizes failures into RPC / ALLOWANCE / GAS / BALANCE / TIMEOUT / UNKNOWN
   - Returns deterministic next-step guidance for operations

5. **Local WDK Execution Path (Self-hosted control)**
   - Seed loaded from env var only (never plaintext config)
   - Real execution path returns `txHash` when successfully sent

6. **Security-by-Construction Config Validation**
   - Hard-fails startup if seed-like plaintext keys appear in config
   - Prevents silent insecure deployments

7. **Tested Command Flow Under CI-like Checks**
   - Build + unit tests + validation script
   - Transfer and swap parsing/execution paths covered by tests

## 4) Verifiable Evidence (What judges can verify)
- Deterministic challenge generation for funds intents
- Approval-gated execution path
- Structured execution output with `txHash` (when on-chain execution succeeds)
- Persistent challenge records in `data/pending-challenges.json`

## 5) Risk Controls
- Funds intents default to challenge, never auto-execute by default
- Seed material is not persisted in repo config
- Idempotent approval flow blocks duplicate fund operations
- Error classification improves incident handling and postmortems

## 6) Extensibility
- Add RBAC for approvers and policy scopes
- Add signature-backed audit trail
- Expand protocol modules (additional swap/bridge providers)
- Add richer intent extraction while keeping deterministic policy enforcement

## External Rule / Context Reference
- Hackathon rules context (provided by organizer):
  - https://hcni4f4mdq79.feishu.cn/wiki/LVzIwMpmKixXeHkeQQ0c8sn8nWg

## One-line pitch
> PolicyGuard turns “AI can move money” into “AI can propose, policy must challenge, humans must approve”—with verifiable execution artifacts and production-grade safety boundaries.
