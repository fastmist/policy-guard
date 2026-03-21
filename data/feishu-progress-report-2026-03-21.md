当前结论：MVP 已完成并有主网真实交易证据；项目进入“拿奖迭代”阶段。

## 一、项目阶段进度

### 1) 已完成（MVP 收口）
- 本地 WDK 执行链路已接通（非 server-side executor）
- `/policy -> CHALLENGE -> /approve` 审批链路已打通
- `/approve` 成功返回顶层 `txHash`
- 关键安全能力已落地：
  - 幂等保护（同一 challenge 不重复执行）
  - 参数校验（tokenIn!=tokenOut、slippage 范围）
  - 错误分类（RPC/allowance/gas/balance/timeout）

### 2) 主网实证（Arbitrum One）
- txHash: `0x0e623b3813b68f06db589b50444d7b3dfbdaf9310033672af555425816b4468d`
- status: `1`（success）
- gasUsed: `152886`

### 3) 进入“拿奖迭代”
- 已新增 demo runbook、交易证据聚合脚本、失败回退建议
- 当前剩余高优先事项：
  1. 完成 `AWARD_PITCH.md`
  2. 将 Demo Runbook 升级为“录制视频专用线上真链路版本”

## 二、最新测试结果（刚复测）
- 命令：`npm test --silent`
- 结果：`6 files / 28 tests passed`

覆盖文件：
- `tests/wdk-adapter.spec.ts`（17）
- `tests/commands.swap-flow.spec.ts`（3）
- `tests/persistence.state.spec.ts`（2）
- `tests/tx-evidence.spec.ts`（3）
- `tests/demo-runbook.spec.ts`（1）
- `tests/intent.swap.spec.ts`（2）

## 三、Demo Runbook（视频录制）强制要求
- 必须线上真实上链 swap，不可仅 mock。
- 录制脚本必须包含：
  1. `/policy swap 0.05 usdc to usdt` 触发 CHALLENGE
  2. `/approve <challengeId> demo` 执行交易
  3. 返回真实 `txHash`
  4. 打开 explorer 展示交易成功（status=1）

不合格情况：
- 仅跑 `POLICYGUARD_E2E_MOCK_TX_HASH`
- 没有真实链上 txHash
- 只展示离线脚本输出，不展示链上结果

## 四、来源
- `TODO.md`
- `PROGRESS.md`
- `DELIVERY_SPEC.md`
- `README.md`
- `tests/*.spec.ts`
- 本次复测命令输出：`npm test --silent`
