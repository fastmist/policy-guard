# AGENTS.md

## Project

This repo is the implementation workspace for the PolicyGuard OpenClaw plugin in the Tether WDK hackathon project.

Primary goal:
- turn the plugin from document-heavy scaffolding into a working, testable implementation
- reduce `TODO.md` with real code and test progress
- keep delivery evidence honest: only claim work that is visible in code, tests, scripts, or artifacts

Core files:
- `src/` implementation
- `tests/` regression and behavior coverage
- `scripts/` validation and e2e helpers
- `TODO.md` prioritized task list
- `PROGRESS.md` current state summary
- `REFLECTIONS.md` lessons learned
- `DELIVERY_SPEC.md` delivery evidence and snapshots

## Cron Context

This repo is driven by cron job `6b8e2fcd-1ccb-4ac8-b8dc-118cdcaf4779` (`policyguard-implementation-pusher-5m`).

The cron job has previously timed out when the agent did one or more of these:
- repeated whole-repo document巡检 instead of implementing the next TODO
- reran `build/test/validate` every round even when only one small area changed
- appended duplicate snapshots to `PROGRESS.md`, `REFLECTIONS.md`, and `DELIVERY_SPEC.md`
- tried to do multiple TODO items in one turn

For this cron job, optimize for small, real, shippable progress per run.

## Required Working Rules

1. Read `TODO.md` first.
2. Pick exactly one top-most actionable P0/P1 item that can move forward offline.
3. Produce at least one real code or test change.
4. Update docs only if they are directly changed by that implementation.
5. Run only the smallest relevant verification for the touched area.
6. If blocked, leave a useful implementation artifact:
   - a failing or targeted test
   - an adapter/interface scaffold
   - a TODO split with concrete next step
7. Report only real progress. If there is no code/test diff, say `NO_REAL_PROGRESS`.
8. If you cannot resolve one issue, read official docs, and relative repos.

## What Not To Do

- Do not spend the whole run re-reading and rewriting status docs.
- Do not repeat the same validation snapshot unless the result materially changed.
- Do not treat missing testnet funds or wallet runtime as a reason to stop all offline work.
- Do not claim background execution or future completion without a visible artifact.
- Do not broaden scope beyond the chosen TODO.

## Current Technical Reality

Known active theme in this repo:
- WDK local execution integration is being replaced over earlier placeholder or remote-style execution paths.

Known recurring constraints:
- true onchain `txHash` evidence may be deferred if wallet/runtime/funds are unavailable
- deferred onchain validation is not a blocker for offline adapter, test, typing, payload-shaping, and idempotency work
- seed material must stay in environment variables, never in committed config

## Preferred Progress Pattern

Good cron run:
- choose one TODO sub-item
- modify `src/` and/or `tests/`
- run one focused test file or one small command
- update only the directly relevant TODO/doc lines
- report: chosen TODO, changed files, validation command, remaining blocker

Bad cron run:
- reread everything
- rerun all checks
- refresh all docs
- produce no code/test diff
- still claim progress

## Before Finishing

Check these before you stop:
- Is there a real diff in code or tests?
- Did verification match the touched area?
- Did you avoid duplicate evidence updates?
- Did you leave the next agent a concrete unblock path?

