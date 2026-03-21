# AWARD_PITCH.md（拿奖版路演稿/评审叙事）

> 目标：让评委 3 分钟理解“问题→方案→亮点→证据→风控→可扩展”，并相信你们确实跑通了链上真实交易。

## 1. Problem（痛点）
在 AI Agent 驱动的钱包/交易场景中，**最危险的不是“模型不聪明”，而是“模型可以直接动钱”**：
- 一句话误解导致转账/换币
- Prompt 注入/社工诱导
- 误操作/重复执行
- 线上可观测性不足，无法审计与复盘

## 2. Solution（方案）
PolicyGuard：给 OpenClaw 增加 **Deterministic Policy + Human-in-the-loop 审批** 的安全护栏。
- 非资金操作：PASS（可直接执行或返回结果）
- 资金相关操作：CHALLENGE（生成 challengeId）
- `/approve <id>`：才允许执行真实 swap/交易，并输出 `txHash`
- `/reject <id>`：拒绝并持久化记录

## 3. Key Innovations（技术亮点）
1) **确定性策略引擎（Deterministic Policy Engine）**
- 不依赖 LLM 的不确定性，资金类默认强制审批

2) **可审计的挑战单持久化**
- challenge 以 JSON 原子写入（tmp+rename），可追踪状态机

3) **幂等保护（防重复扣款）**
- 同一 challenge 仅允许 `PENDING -> APPROVED` 一次迁移，重复 `/approve` 被拒绝

4) **错误分类与可观测性**
- RPC / allowance / gas / balance / timeout 分类，便于演示与故障定位

5) **WDK 本地执行（自托管）**
- seed 仅从环境变量读取，禁止配置文件明文
- swap 输出真实链上 `txHash`

## 4. Evidence（可验证证据）
- 主网实证（Arbitrum One）：
  - txHash: `0x0e623b3813b68f06db589b50444d7b3dfbdaf9310033672af555425816b4468d`
  - status: 1
  - gasUsed: 152886

## 5. Demo Script（3分钟演示脚本）
1) `/policy check my usdt balance` → PASS
2) `/policy swap 0.05 usdc to usdt` → CHALLENGE（返回 challengeId）
3) `/approve <challengeId> demo` → 返回 `txHash`
4) 打开浏览器区块浏览器，展示交易成功

## 6. Risk Controls（风控与边界）
- 资金类一律 challenge
- seed 不落盘，配置中出现 seed-like 字段直接拒绝启动
- 幂等保护避免重复执行
- 迁移告警避免旧配置静默失效

## 7. What’s Next（下一步）
- 引入更强意图解析（LLM 仅用于解释与建议，策略仍 deterministic）
- RBAC / 审计签名链
- 更丰富的 swap 参数与多协议扩展
- 演示材料自动化（tx证据聚合、截图、讲解稿）

## Sources（内部文件）
- `TODO.md`
- `DELIVERY_SPEC.md`
- `README.md`
- `REFLECTIONS.md`
- `src/policy-engine.ts` `src/commands.ts` `src/wdk-adapter.ts`

## Sources（外部）
- WDK 文档：https://docs.wallet.tether.io
- `@tetherto/wdk-protocol-swap-velora-evm` README（node_modules）

***

(评审一句话版本)
> 我们把“AI 能不能交易”变成“AI 只能提议交易，钱必须过 deterministic policy + 人审”，并且展示了真实上链 txHash。 
