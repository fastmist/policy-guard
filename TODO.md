# TODO - PolicyGuard OpenClaw Plugin（WDK 本地执行版）

## 新阶段目标（2026-03-21）
- 目标从“完成 MVP”切换到“比赛可拿奖版本（Demo + 可靠性 + 评审叙事）”。
- 迭代方向：
  1. 提升真实链路稳定性（不同交易对与失败回退策略）
  2. 强化可演示性（一键 demo 脚本 + 标准讲解稿 + 截图/tx 证据）
  3. 提升安全与审计说服力（幂等、错误分类、配置防误用、执行日志）
  4. 完善评审材料（README、DELIVERY_SPEC、演示视频脚本）

## 策略调整（2026-03-21）
- 每次提交后思考是否有新的todo，添加新的todo到这个文件
- 真链路资金/钱包环境不足时，**不作为硬阻塞**。
- 真链路测试（真实 `txHash` 产出、测试网联调）统一标记为 **deferred（待资金后执行）**。
- 当前迭代优先：离线可完成的代码改造、测试覆盖、文档完善。
- 最近巡检：2026-03-21 02:44 UTC（build/test/validate 均通过）。

```
资金状态（Arbitrum One）
地址：0x3859b348F70104f957462Ac9B9e2505664Cf2E6C
ETH：0.002317012156948849
USDC：1.0
```

## P0（必须完成）
- [x] 移除 `wdkDryRun` 逻辑与配置
- [x] 移除 `wdkBaseUrl/wdkApiKey` 的执行主路径（仅保留迁移说明）
- [x] 在 `src/wdk-adapter.ts` 接入 WDK 本地执行：
  - [x] `@tetherto/wdk`
  - [x] `@tetherto/wdk-wallet-evm`
  - [x] `@tetherto/wdk-protocol-swap-velora-evm`
  - [x] `swap` 执行入口骨架（`SwapExecutor` 注入、`txHash` 返回面、失败分层）
  - [x] `swap()` 真正调用链路（已接入 WDK + wallet + velora protocol constructor 启动路径：`WDK.registerWallet/registerProtocol/getAccount/getSwapProtocol(...).swap()`）
    - [x] 已落地兼容适配层骨架：`createWdkSwapExecutor`（支持多候选 factory export、`swap()` 调用与 `txHash/hash` 归一化）
    - [x] 已补齐 `swap` 入参规范化：`buildSwapParams`（统一 amount/token/slippage 字段并注入 `payload.params`，为后续 SDK 实参对接做准备）
    - [x] 已扩展兼容适配：支持 `default export` factory 与 `swap/executeSwap` 直出函数；`runtime` 快照随 payload 下发（不泄露 seed 明文）
    - [x] 已补齐 constructor fallback：当协议包无可用 factory/direct export 时，自动走 `__wdkBindings` 引导的 WDK 实例化直连路径
- [x] `/approve` 后执行真实 `swap()`，返回 `txHash`（`handleCommand` 在成功时回传顶层 `txHash`，并保留 `execution.details.txHash`）
- [x] 增加 `quoteSwap` 预估流程并记录快照（`createWdkSwapExecutor` 在 `swap()` 前尝试调用 `quoteSwap/quote/getQuote`，并将结果写入 `meta.quoteSnapshot`）

## P1（安全与可维护）
- [x] swap 参数安全校验（tokenIn!=tokenOut、slippageBps 合理范围、对已知 token+decimals 防止 amount 过小导致 baseUnits=0）
- [x] 新增迁移文档：`wdkDryRun` 废弃说明与配置示例（避免旧配置误用）
- [x] 新增配置：`wdkSeedEnvKey`、`chain`、`accountIndex`、`rpcUrl`、`swapProtocolLabel`、`swapMaxFee`
- [x] seed 仅从环境变量读取，禁止写入配置文件（已在 `WdkAdapter` 构造时拦截 `seed/wdkSeed/mnemonic/privateKey` 等明文配置键）
- [x] 增加幂等保护：同一 challenge 禁止重复执行交易（`/approve` 仅允许 `PENDING` -> `APPROVED` 一次迁移）
- [x] 错误分类：RPC / allowance / gas / balance / timeout

## P1.5（拿奖导向增强）
- [ ] Demo Runbook 升级为“录制视频专用线上真链路版本”（必须 `/policy swap ... -> /approve -> 真实 txHash` 全程演示，禁止仅 mock）
- [x] 增加“评审可读”Demo Runbook（3 分钟内演示路径，`npm run demo:runbook`）
- [x] 增加失败回退演示：gas/baseFee 异常时自动提示和重试建议（`executeApprovedChallenge` 失败详情新增 `retryable/retryAdvice`，并针对 gas/baseFee 返回分层 nextStep）
- [x] 增加真实交易证据聚合脚本（自动输出 txHash + explorer 链接 + 关键指标）
- [ ] 补 `AWARD_PITCH.md`（问题、方案、创新点、技术亮点、验证数据、风险控制）

## P2（测试体系）
- [x] 新增解析测试：`tests/intent.swap.spec.ts`
- [x] 新增适配器测试：`tests/wdk-adapter.spec.ts`
- [x] 新增命令流测试：`tests/commands.swap-flow.spec.ts`
- [x] 新增持久化状态机测试：`tests/persistence.state.spec.ts`
- [x] 新增 E2E 脚本：`scripts/e2e-swap-approval.ts`（支持 `POLICYGUARD_E2E_MOCK_TX_HASH` 离线 mock，验证 `/policy -> /approve -> txHash` 全链路）
- [x] 增加测试运行脚本：`npm run test`（已接入 Vitest）
- [x] 在 `DELIVERY_SPEC.md` 维护“功能→测试→结果”逐项状态（每次迭代必更）

## 验收标准（Definition of Done）
- [x] `npm run build` 通过
- [x] `npm run test` 通过
- [x] `npm run validate` 通过
- [x] 演示可输出真实 `txHash`（Arbitrum One 实测成功：`0x0e623b3813b68f06db589b50444d7b3dfbdaf9310033672af555425816b4468d`，status=1，gasUsed=152886）
- [x] README 与交付文档更新完成
