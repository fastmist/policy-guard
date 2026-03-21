# Tether WDK Hackathon Rules (Repo Reference)

## Official Source
- Feishu Wiki (official): https://hcni4f4mdq79.feishu.cn/wiki/LVzIwMpmKixXeHkeQQ0c8sn8nWg

## Why this file exists
This repository keeps a local rules reference so reviewers and contributors can align implementation and delivery artifacts with hackathon expectations.

## Current status
- Official page is access-controlled.
- Full text mirror is pending owner-side permission sync.
- Until full sync is available, this repo follows the practical judging alignment below.

## Practical judging alignment used in this repo
1. **Problem clarity**
   - Clearly define the real-world risk/pain point.
2. **Solution design quality**
   - Deterministic architecture, safety boundaries, and approval flow.
3. **Technical implementation quality**
   - Code structure, execution reliability, tests, and reproducibility.
4. **Demo credibility / evidence quality**
   - Verifiable outputs (`challengeId`, `txHash`, logs, state transitions).
5. **Security and risk controls**
   - Default-deny for high-risk operations, idempotency, and sensitive config handling.

## Evidence mapping in this repo
- Narrative and judge pitch: `doc/AWARD_PITCH.md`
- Delivery and verification scope: `doc/DELIVERY_SPEC.md`
- Progress and iteration records: `doc/PROGRESS.md`, `doc/REFLECTIONS.md`
- Main implementation docs: `README.md`

## TODO (when rule access is available)
- Replace this summary with a line-by-line official rules mirror.
- Add a strict rubric table: `official item -> evidence file -> command/log proof`.
