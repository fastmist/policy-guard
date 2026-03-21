# DELIVERY_SPEC.md（交付功能与测试映射）

## 阶段状态
- 当前阶段：MVP Completed ✅
- 下一阶段：Award Iteration 🚀（目标：提高评审说服力与演示稳定性）

## 目标
沉淀“功能 -> 对应代码 -> 对应测试 -> 测试结果”的可追踪交付标准，强调测试维护与持续优化。

## 功能清单（持续更新）

| 功能 | 代码路径 | 测试路径 | 当前结果 |
|---|---|---|---|
| 命令路由 `/policy /approve /reject` | `src/commands.ts` | `scripts/validate.ts`（当前） | ✅ Validation passed |
| 策略判定 PASS/CHALLENGE | `src/policy-engine.ts` | `scripts/validate.ts`（当前） | ✅ Validation passed |
| Challenge 持久化 | `src/persistence.ts` | `scripts/validate.ts`（当前） | ✅ Validation passed |
| WDK 适配器行为（live scaffold，无 dry-run 配置） | `src/wdk-adapter.ts` | `tests/wdk-adapter.spec.ts` | ✅ 通过 |
| 审批命令链路（swap challenge -> approve） | `src/commands.ts` + `src/wdk-adapter.ts` | `tests/commands.swap-flow.spec.ts` | ✅ 通过 |
| 持久化状态机（upsert/read/update） | `src/persistence.ts` + `src/commands.ts` | `tests/persistence.state.spec.ts` | ✅ 通过 |

## 测试维护标准
1. 每个新增功能必须同 PR 提交测试。
2. bug 修复必须新增回归测试。
3. `build/test/validate` 结果必须写入本文件“测试结果快照”。
4. 无测试的功能不标记为“已交付”。

## 真链路测试策略（2026-03-21）
- 当测试网资金/钱包环境不足时，真链路联调不作为硬阻塞。
- 真实交易验证（`/approve` 输出真实 `txHash`）状态标记为 **deferred**，待资金后执行。
- 当前交付重点：离线代码改造、单元/集成测试覆盖、文档一致性维护。

## 测试结果快照
- 2026-03-21 04:12 UTC（mainnet real swap evidence）:
  - network: Arbitrum One
  - txHash: `0x0e623b3813b68f06db589b50444d7b3dfbdaf9310033672af555425816b4468d`
  - status: ✅ success (`status=1`)
  - gasUsed: `152886`
- 2026-03-21 02:44 UTC（policyguard_spec_maintenance_tick）:
  - `npm run build`: ✅
  - `npm run test`: ✅（4 files / 7 tests passed）
  - `npm run validate`: ✅（Validation passed）
- 2026-03-21 02:24 UTC（policyguard_spec_maintenance_tick）:
  - `npm run build`: ✅
  - `npm run test`: ✅（4 files / 7 tests passed）
  - `npm run validate`: ✅（Validation passed）
- 2026-03-21 02:20 UTC（policyguard_spec_maintenance_tick）:
  - `npm run build`: ✅
  - `npm run test`: ✅（4 files / 7 tests passed）
  - `npm run validate`: ✅（Validation passed）
- 2026-03-21 02:14 UTC（policyguard_spec_maintenance_tick）:
  - `npm run build`: ✅
  - `npm run test`: ✅（4 files / 7 tests passed）
  - `npm run validate`: ✅（Validation passed）
- 2026-03-21 01:59 UTC（policyguard_spec_maintenance_tick）:
  - `npm run build`: ✅
  - `npm run test`: ✅（4 files / 7 tests passed）
  - `npm run validate`: ✅（Validation passed）
- 2026-03-21 01:54 UTC（policyguard_spec_maintenance_tick）:
  - `npm run build`: ✅
  - `npm run test`: ✅（4 files / 7 tests passed）
  - `npm run validate`: ✅（Validation passed）
- 2026-03-21 01:49 UTC（policyguard_spec_maintenance_tick）:
  - `npm run build`: ✅
  - `npm run test`: ✅（4 files / 7 tests passed）
  - `npm run validate`: ✅（Validation passed）
- 2026-03-21 01:44 UTC（policyguard_spec_maintenance_tick）:
  - `npm run build`: ✅
  - `npm run test`: ✅（4 files / 7 tests passed）
  - `npm run validate`: ✅（Validation passed）
- 2026-03-21 01:40 UTC（policyguard_spec_maintenance_tick）:
  - `npm run build`: ✅
  - `npm run test`: ✅（4 files / 7 tests passed）
  - `npm run validate`: ✅（Validation passed）
- 2026-03-21 01:34 UTC（policyguard_spec_maintenance_tick）:
  - `npm run build`: ✅
  - `npm run test`: ✅（4 files / 7 tests passed）
  - `npm run validate`: ✅（Validation passed）
- 2026-03-21 01:30 UTC（policyguard_spec_maintenance_tick）:
  - `npm run build`: ✅
  - `npm run test`: ✅（4 files / 7 tests passed）
  - `npm run validate`: ✅（Validation passed）
- 2026-03-21 01:25 UTC（policyguard_spec_maintenance_tick）:
  - `npm run build`: ✅
  - `npm run test`: ✅（4 files / 7 tests passed）
  - `npm run validate`: ✅（Validation passed）
- 2026-03-21 01:20 UTC（policyguard_spec_maintenance_tick）:
  - `npm run build`: ✅
  - `npm run test`: ✅（4 files / 7 tests passed）
  - `npm run validate`: ✅（Validation passed）
- 2026-03-21 01:17 UTC（manual hotfix）:
  - `npm run test`: ✅（4 files / 7 tests passed）
  - `npm run build`: ✅
  - `npm run validate`: ✅（Validation passed）
- 2026-03-21 01:15 UTC（policyguard_spec_maintenance_tick）:
  - `npm run build`: ✅
  - `npm run validate`: ✅（Validation passed）
  - `npm run test`: ❌（Missing script: "test"）
- 2026-03-21 01:10 UTC（policyguard_spec_maintenance_tick）:
  - `npm run build`: ✅
  - `npm run validate`: ✅（Validation passed）
  - `npm run test`: ❌（Missing script: "test"）
- 2026-03-21 00:55 UTC（policyguard_spec_maintenance_tick）:
  - `npm run build`: ✅
  - `npm run validate`: ✅（Validation passed）
  - `npm run test`: ❌（Missing script: "test"）
- 2026-03-21 00:50 UTC（policyguard_spec_maintenance_tick）:
  - `npm run build`: ✅
  - `npm run validate`: ✅（Validation passed）
  - `npm run test`: ❌（Missing script: "test"）
- 2026-03-21 00:45 UTC（policyguard_spec_maintenance_tick）:
  - `npm run build`: ✅
  - `npm run validate`: ✅（Validation passed）
  - `npm run test`: ❌（Missing script: "test"）
- 2026-03-21 00:41 UTC（policyguard_spec_maintenance_tick）:
  - `npm run build`: ✅
  - `npm run validate`: ✅（Validation passed）
  - `npm run test`: ❌（Missing script: "test"）
- 2026-03-21 00:24 UTC（policyguard_spec_maintenance_tick）:
  - `npm run build`: ✅
  - `npm run validate`: ✅（Validation passed）
  - `npm run test`: ❌（Missing script: "test"）
- 2026-03-21 00:20 UTC（policyguard_spec_maintenance_tick）:
  - `npm run build`: ✅
  - `npm run validate`: ✅（Validation passed）
  - `npm run test`: ❌（Missing script: "test"）
- 2026-03-21 00:15 UTC（policyguard_spec_maintenance_tick）:
  - `npm run build`: ✅
  - `npm run validate`: ✅（Validation passed）
  - `npm run test`: ❌（Missing script: "test"）
- 2026-03-21 00:10 UTC（policyguard_spec_maintenance_tick）:
  - `npm run build`: ✅
  - `npm run validate`: ✅（Validation passed）
  - `npm run test`: ❌（Missing script: "test"）
- 2026-03-21 00:05 UTC（policyguard_spec_maintenance_tick）:
  - `npm run build`: ✅
  - `npm run validate`: ✅（Validation passed）
  - `npm run test`: ❌（Missing script: "test"）

## 强制规则（enforce）
1. `Current result` 只能来自已执行命令结果；禁止主观填“已完成”。
2. 对于“待补测试”功能，`Current result` 必须保持 ⏳，直到对应测试文件存在且 `npm run test` 覆盖通过。
3. 每次迭代至少更新一次“测试结果快照”（含时间 + 命令 + 结果）。
4. DoD 的 `npm run test` 未通过（或脚本缺失）时，整体验收不得标记完成。
