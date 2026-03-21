# DELIVERY_SPEC.md

## Scope
PolicyGuard OpenClaw plugin for deterministic policy gating before funds execution.

## Delivered modules
- Command routing: `src/commands.ts`
- Policy engine: `src/policy-engine.ts`
- Intent parsing: `src/intent.ts`
- Persistence: `src/persistence.ts`
- Execution adapter: `src/wdk-adapter.ts`

## Required quality gates
- `npm run build`
- `npm test`
- `npm run validate`

## Acceptance criteria
1. Funds intent returns `CHALLENGE`.
2. Approved challenge routes to execution adapter.
3. Duplicate approve is idempotently blocked.
4. Persistence file reflects challenge state transitions.
5. Error outputs include category and actionable next-step data.

## Evidence format
- command text
- challengeId/requestId
- decision
- execution details (`txHash` when available)
- timestamp and runtime context summary
