# PolicyGuard OpenClaw Plugin

## Overview
PolicyGuard is a deterministic safety layer that turns AI wallet actions from **direct execution** into **policy-gated, human-approved execution** on top of OpenClaw + WDK.

## Problem
In AI-agent trading/wallet workflows, the core risk is not model intelligence but uncontrolled fund operations.

Typical failure modes:
- Misinterpreted user intent triggers transfer/swap
- Prompt injection or social-engineering requests money movement
- Duplicate approvals/repeated execution
- Weak post-incident auditability

## Technical Highlights
1. **Deterministic policy boundary (LLM-independent)**
   - Funds intents default to `CHALLENGE`
   - Non-funds intents can `PASS`

2. **Challenge state machine + durable persistence**
   - Lifecycle: `PENDING -> APPROVED/REJECTED`
   - Atomic JSON persistence

3. **Idempotent approval guard**
   - Duplicate `/approve` on non-PENDING challenge is blocked

4. **Structured execution/error model**
   - Error taxonomy: `RPC | ALLOWANCE | GAS | BALANCE | TIMEOUT | UNKNOWN`
   - Deterministic next-step outputs

5. **OpenClaw + WDK integration**
   - OpenClaw tool entry (`policyguard_command`)
   - WDK execution adapter for approved funds actions
   - `txHash` returned when on-chain execution succeeds

## Quickstart

Install plugin from npm (latest):
```bash
openclaw plugins install policyguard-openclaw-plugin
```

Optional version pin:
```bash
openclaw plugins install policyguard-openclaw-plugin@0.1.1
```

Set runtime seed env:
```bash
export WDK_SEED="<your mnemonic>"
```

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

Sanity checks:
```bash
npm run build
npm test
npm run validate
```

## Tech Details

### 1) End-to-end flow (natural language -> execution)

```mermaid
flowchart TD
    U[User natural-language request] --> OC[OpenClaw tool call: policyguard_command]
    OC --> C[Command Layer\nparse /policy /approve /reject]
    C --> I[Intent Layer\nnormalize + extract entities]
    I --> P[Policy Layer\ndeterministic risk decision]
    P -->|PASS| E[Execution Adapter\nWDK / non-funds route]
    P -->|CHALLENGE| S[Challenge Store\npersist PENDING]
    S --> A[/approve challengeId/]
    A --> C
    E --> TX[On-chain execution]\n
    TX --> R[Response\ndecision + txHash/error]
    C --> R
```

What this layer flow does:
- Accept user natural language through OpenClaw tool entry
- Convert text to structured intent + policy decision
- Require explicit approval for risky funds actions
- Return auditable output (`challengeId`, `txHash`, structured errors)

### 2) Layered architecture

```mermaid
flowchart LR
    subgraph L1[Layer 1 - Command]
      C1[commands.ts\nroute commands\nmanage challenge lifecycle\nparse auto-approval policy command]
    end

    subgraph L2[Layer 2 - Intent]
      I1[intent.ts\nidentify intent\nextract amount/token/to\nnormalize buy/sell/swap/transfer]
    end

    subgraph L3[Layer 3 - Policy]
      P1[policy-engine.ts\nPASS vs CHALLENGE\nper-tx and daily-limit gate\nreason generation]
    end

    subgraph L4[Layer 4 - State]
      S1[persistence.ts\nchallenge store\nauto-policy store\ndaily spend ledger]
    end

    subgraph L5[Layer 5 - Execution]
      E1[wdk-adapter.ts\nexecute approved funds actions\nclassify failures\nreturn txHash/details]
    end

    C1 --> I1 --> P1
    P1 <--> S1
    P1 --> E1
```

What each layer contributes:
- **Command**: user-facing control surface and approval state transitions
- **Intent**: deterministic entity extraction from natural language
- **Policy**: risk decisioning and quota checks
- **State**: durable audit and quota continuity across sessions
- **Execution**: controlled WDK execution and observable output contract

---

Reference narrative: `AWARD_PITCH.md`  
Hackathon rules context: https://hcni4f4mdq79.feishu.cn/wiki/LVzIwMpmKixXeHkeQQ0c8sn8nWg
