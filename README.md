# PolicyGuard OpenClaw Plugin

PolicyGuard is an OpenClaw security plugin that enforces a deterministic approval boundary before funds-related actions execute.

- `PASS`: safe/non-funds intent can proceed
- `CHALLENGE`: funds intent requires explicit human approval

---

## Quickstart (one command)

```bash
npx openclaw@latest plugins add /root/.openclaw/extensions/policyguard-openclaw-plugin
```

Then set plugin config + environment, and restart/reload OpenClaw runtime as needed.

---

## Why this plugin exists

In AI-agent wallets, direct execution is dangerous. PolicyGuard introduces a strict guardrail:
1. Parse intent
2. Deterministically classify risk
3. Require human approval for funds operations
4. Execute through controlled adapter path
5. Return auditable execution metadata (`txHash` when available)

---

## Core architecture

1. **Command layer** (`src/commands.ts`)
   - Handles `/policy`, `/approve`, `/reject`
   - Maintains challenge state transitions

2. **Policy layer** (`src/policy-engine.ts`)
   - Deterministic PASS/CHALLENGE logic
   - Stable request fingerprinting

3. **Intent layer** (`src/intent.ts`)
   - Extracts entities for transfer/swap flows

4. **Execution adapter** (`src/wdk-adapter.ts`)
   - Routes approved intents into execution paths
   - Normalizes failures into structured categories

5. **Persistence** (`src/persistence.ts`)
   - Durable challenge records for audit and replay analysis

---

## Technical highlights (expanded)

- Deterministic policy boundary independent from model randomness
- Idempotent challenge lifecycle to prevent duplicate execution
- Transfer + swap intent extraction with canonical parameters
- Runtime safety checks for seed handling (env-only design)
- Structured error taxonomy: `RPC | ALLOWANCE | GAS | BALANCE | TIMEOUT | UNKNOWN`
- Local execution-first architecture for controlled deployment environments

---

## Verifiable evidence model

What can be independently verified:
- Funds intents produce `CHALLENGE`
- Approval required before execution path
- Challenge state persisted to `data/pending-challenges.json`
- Successful on-chain execution returns `txHash`
- Build/test/validation pipeline passes in repo

> Demo-script section intentionally removed per current review direction.

---

## Configuration

Recommended plugin config:

```json
{
  "plugins": {
    "policyguard-openclaw-plugin": {
      "persistencePath": "./data/pending-challenges.json",
      "wdkSeedEnvKey": "WDK_SEED",
      "chain": "arbitrum",
      "accountIndex": 0,
      "rpcUrl": "https://arb1.arbitrum.io/rpc",
      "swapProtocolLabel": "velora",
      "swapMaxFee": "0.003"
    }
  }
}
```

Security constraints:
- Seed-like plaintext keys in config are rejected at startup
- Use environment variables for sensitive material only

---

## Local development

```bash
npm install
npm run build
npm test
npm run validate
```

---

## Hackathon context source

- Rules/context link provided by organizer:
  - https://hcni4f4mdq79.feishu.cn/wiki/LVzIwMpmKixXeHkeQQ0c8sn8nWg
