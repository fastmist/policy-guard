# REFLECTIONS.md（开发过程反思与下一步计划）

> 规则：每次开发迭代结束必须补一条记录，包含问题、根因、改进动作、下一次明确计划。

## 模板

### [YYYY-MM-DD HH:mm] 迭代标题
- 本次变更：
- 暴露问题：
- 根因分析：
- 改进动作（已执行）：
- 下一次明确计划（可执行）：
  1. 
  2. 
  3. 
- 关联文件：
- 关联测试：
- 测试结果：

---

### [2026-03-21 12:59] 阶段切换复盘：从“能跑”到“能拿奖”
- 本次变更：MVP 收口完成后，启动“拿奖导向”迭代阶段，更新 TODO/PROGRESS 目标。
- 暴露问题：仅有可运行代码不足以提高评审得分，缺少系统化叙事与演示稳定性指标。
- 根因分析：前期聚焦打通链路，文档偏工程实现，评审视角（创新、可验证价值、风险控制）沉淀不足。
- 改进动作（已执行）：
  1. 在 TODO 新增 P1.5（拿奖导向增强）工作流。
  2. 在 PROGRESS 标注阶段切换和下一步动作。
  3. 规划新增 `AWARD_PITCH.md` 与证据聚合脚本。
- 下一次明确计划（可执行）：
  1. 产出 `AWARD_PITCH.md` 初版（可直接用于路演）。
  2. 产出 demo 证据聚合脚本并接入 README。
  3. 增加失败回退演示用例，提升“稳健性”评分。
- 关联文件：`TODO.md` `PROGRESS.md` `DELIVERY_SPEC.md` `README.md`
- 关联测试：`npm run build` `npm run test` `npm run validate`
- 测试结果：build ✅ / test ✅ / validate ✅

### [2026-03-21 11:47] WDK 阻塞复盘：先装依赖，再按 README 最短路径直连
- 本次变更：重新 review 当前代码、node_modules、README 与 d.ts，确认 WDK 真实阻塞已从“SDK 不可用”收敛为“接入路径过绕 + 没先验证依赖安装状态”。
- 暴露问题：之前把 `TS2307` / `UNMET DEPENDENCY` 当成 SDK 本身不可用，导致实现上过度依赖动态探测和兼容层，没有优先按官方 README 的 direct usage 直连验证。
- 根因分析：
  1. 没先做最短闭环：`npm install` -> 检查 `node_modules` -> 读 `README` / `types` -> 最小样例；
  2. WDK 文档已经给出足够明确的直连方式：`WalletAccountEvm(seed, path, { provider })` + `new VeloraProtocolEvm(account, { swapMaxFee })` + `quoteSwap/swap`；
  3. 当前项目在“真实 wallet/protocol 初始化”前引入了太多兼容层，增加了噪音。
- 改进动作（已执行）：
  1. 已确认依赖真实可安装：`@tetherto/wdk@1.0.0-beta.6`、`@tetherto/wdk-wallet-evm@1.0.0-beta.10`、`@tetherto/wdk-protocol-swap-velora-evm@1.0.0-beta.4`；
  2. 已确认本地存在类型文件：`node_modules/@tetherto/wdk-protocol-swap-velora-evm/types/src/velora-protocol-evm.d.ts`、`node_modules/@tetherto/wdk-wallet-evm/types/src/wallet-account-evm.d.ts`；
  3. 已总结直接可执行接法：先做静态/稳定导入，优先打通 `quoteSwap`，再接 `swap()` 和 txHash。
- 下一次明确计划（可执行）：
  1. 在 `src/wdk-adapter.ts` 中直接初始化 `WalletAccountEvm` + `VeloraProtocolEvm`，去掉不必要的 export 猜测分支；
  2. 增加 Arbitrum 主网 token map（至少 USDC/USDT/WETH）和 amount -> bigint 转换；
  3. 先落 `quoteSwap` + 快照，再把 `/approve` 接到真实 `swap()` 并回填 txHash 证据。
- 关联文件：`src/wdk-adapter.ts` `node_modules/@tetherto/wdk-protocol-swap-velora-evm/README.md` `node_modules/@tetherto/wdk-protocol-swap-velora-evm/types/src/velora-protocol-evm.d.ts` `node_modules/@tetherto/wdk-wallet-evm/types/src/wallet-account-evm.d.ts`
- 关联测试：`npm run build` `npm run test`
- 测试结果：build ✅ / test ✅（18 tests）

### [2026-03-21 02:44 UTC] 清理 wdkDryRun 逻辑与配置（P0 子项落地）
- 本次变更：完成 P0 子项“移除 `wdkDryRun` 逻辑与配置”；同步更新 adapter/index/tests/scripts/README。
- 暴露问题：移除配置后 `scripts/validate.ts` 与 `scripts/e2e-swap-approval.ts` 仍引用 `dryRun`，首次构建失败。
- 根因分析：配置项清理未一次性覆盖脚本入口，存在残留调用。
- 改进动作（已执行）：
  1. 在 `src/wdk-adapter.ts` 删除 `dryRun` 分支，统一为 live scaffold 语义。
  2. 在 `src/index.ts` 删除 `wdkDryRun` 配置读取。
  3. 更新 `tests/wdk-adapter.spec.ts`、`tests/commands.swap-flow.spec.ts`、`scripts/validate.ts`、`scripts/e2e-swap-approval.ts` 以匹配新接口。
  4. 更新 `README.md` 与 `DELIVERY_SPEC.md` 描述，回填 `TODO.md` 状态。
  5. 复跑 `npm run build && npm run test && npm run validate` 全通过。
- 下一次明确计划（可执行）：
  1. 开始清理 `wdkBaseUrl/wdkApiKey` 的执行主路径，保留迁移说明。
  2. 在 `src/wdk-adapter.ts` 增加 `quoteSwap` 预估与快照结构（先离线可测）。
  3. 补 `scripts/e2e-swap-approval.ts` 的 quote/swap 离线断言。
- 关联文件：`src/wdk-adapter.ts` `src/index.ts` `tests/wdk-adapter.spec.ts` `tests/commands.swap-flow.spec.ts` `scripts/validate.ts` `scripts/e2e-swap-approval.ts` `README.md` `TODO.md` `DELIVERY_SPEC.md` `PROGRESS.md`
- 关联测试：`npm run build` `npm run test` `npm run validate`
- 测试结果：build ✅ / test ✅ / validate ✅

### [2026-03-21 02:24 UTC] 定时巡检（离线优先，真链路 deferred）
- 本次变更：执行 `policyguard_spec_maintenance_tick`；巡检并更新 TODO/REFLECTIONS/DELIVERY_SPEC/PROGRESS；复跑回归测试并写入新快照。
- 暴露问题：真链路 `txHash` 证据仍为空。
- 根因分析：测试网资金与钱包环境未就绪，真实交易联调条件不足。
- 改进动作（已执行）：
  1. 运行 `npm run build`：通过。
  2. 运行 `npm run test`：通过（4 files / 7 tests）。
  3. 运行 `npm run validate`：通过（Validation passed）。
  4. 更新 `TODO.md`：同步最近巡检时间到 02:24 UTC。
  5. 更新 `DELIVERY_SPEC.md` 与 `PROGRESS.md`：新增 02:24 UTC 测试快照与进展。
- 下一次明确计划（可执行）：
  1. 清理 `wdkDryRun` 与 HTTP 占位执行主路径。
  2. 在 `src/wdk-adapter.ts` 落地本地 quote/swap 主路径并补可离线断言。
  3. 完成 `scripts/e2e-swap-approval.ts` 离线版，资金到位后补真链路证据。
- 关联文件：`TODO.md` `REFLECTIONS.md` `DELIVERY_SPEC.md` `PROGRESS.md`
- 关联测试：`npm run build` `npm run test` `npm run validate`
- 测试结果：build ✅ / test ✅ / validate ✅
