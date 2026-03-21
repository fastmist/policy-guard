# PolicyGuard OpenClaw Plugin (MVP)

PolicyGuard 是一个 OpenClaw 插件 MVP，用于在执行 WDK 意图前做 deterministic 策略判定：

- `PASS`: 允许直接执行（仅 non-funds intents）
- `CHALLENGE`: 进入待审批队列，等待 `/approve` 或 `/reject`

## MVP 功能

- OpenClaw 插件 npm package（`policyguard-openclaw-plugin`）
- 支持命令：
  - `/policy <request>`
  - `/approve <id> [reason]`
  - `/reject <id> [reason]`
- Deterministic policy engine（基于规则+标准化输入+稳定 requestId）
- JSON 文件持久化 pending challenges
- WDK adapter scaffold：
  - 有真实 HTTP 调用路径（`baseUrl` 配置后走 live request）
  - 默认走本地 live scaffold（不再使用 dry-run 开关）
  - 没配置 endpoint 时记录审批并返回明确提示
- 自然语言 intent 解析 hooks（MVP 仅放行 non-funds 意图）
- 最小验证脚本

## 项目结构

```text
policyguard-openclaw-plugin/
├─ src/
│  ├─ index.ts
│  ├─ commands.ts
│  ├─ policy-engine.ts
│  ├─ intent.ts
│  ├─ persistence.ts
│  ├─ wdk-adapter.ts
│  └─ types.ts
├─ scripts/
│  └─ validate.ts
├─ data/
├─ openclaw.plugin.json
├─ package.json
├─ tsconfig.json
├─ TODO.md
└─ README.md
```

## 安装与构建

```bash
cd /root/.openclaw/workspace/projects/tether-wdk-hackathon-2026/policyguard-openclaw-plugin
npm install
npm run build
```

## 验证

```bash
npm run validate
```

预期输出：`Validation passed.`

### E2E（离线可复现）

```bash
POLICYGUARD_E2E_MOCK_TX_HASH=0xe2e123 npm run e2e:swap-approval
```

- 默认模式为 live；设置 `POLICYGUARD_E2E_MOCK_TX_HASH` 后走离线 mock 执行器。
- 该脚本会实际跑 `/policy swap ...` + `/approve ...`，并校验返回 `txHash`。

### 3 分钟评审 Demo Runbook

```bash
npm run demo:runbook
```

- 会输出标准化讲解顺序：环境检查 → 离线可复现全链路 → 评审口播重点 → 问答兜底。
- 可通过 `POLICYGUARD_DEMO_MOCK_TX_HASH` 覆盖脚本中的演示 `txHash`。

### 真实交易证据聚合（离线可跑；有 RPC 时可拉 receipt）

```bash
POLICYGUARD_TX_HASHES=0x0e623b... npm run tx:evidence
```

- 输入：`POLICYGUARD_TX_HASHES`（逗号/空格分隔的 txHash 列表）
- 输出：默认写入 `./data/tx-evidence.md`（可用 `POLICYGUARD_EVIDENCE_OUT` 覆盖）
- RPC：默认 `POLICYGUARD_RPC_URL`，否则使用 Arbitrum 公共 RPC

## OpenClaw 集成（MVP）

本插件通过 `policyguard_command` tool 接收 slash command 文本，格式如下：

```json
{
  "command": "/policy transfer 100 usdt to alice"
}
```

工具内部会分发到：
- `/policy`
- `/approve`
- `/reject`

> 说明：MVP 阶段先通过 tool 对 slash 字符串做统一处理，后续可在 channel inbound 层做原生命令拦截并直接转发到同一 handler。

## 配置项

在插件配置中可用：

- `persistencePath`：pending challenge JSON 路径（默认 `./data/pending-challenges.json`）
- `wdkSeedEnvKey`：助记词环境变量名（默认 `WDK_SEED`，仅读取环境变量，不读配置里的明文 seed）
  - 安全约束：若配置里出现 `seed` / `wdkSeed` / `mnemonic` / `wdkMnemonic` / `privateKey` / `wdkPrivateKey` 任一明文字段，插件会在启动时直接报错拒绝加载。
- `chain`：默认链标识（如 `arbitrum`）
- `accountIndex`：默认账户索引（默认 `0`）
- `rpcUrl`：可选默认 RPC 地址
- `swapProtocolLabel`：swap 协议标签（默认 `velora`）
- `swapMaxFee`：可选最大手续费配置（字符串，透传给执行层）

迁移说明（`wdkDryRun` 废弃）：
- `wdkDryRun` / `wdkBaseUrl` / `wdkApiKey` 均已从执行主路径移除，不再影响执行行为。
- 若配置中仍保留上述字段，插件会在执行结果里返回 `deprecatedConfigWarnings` 提示（字段会被忽略）。
- 新执行路径统一使用本地 WDK 运行时配置：
  - `wdkSeedEnvKey`
  - `chain`
  - `accountIndex`
  - `rpcUrl`
  - `swapProtocolLabel`
  - `swapMaxFee`

示例（推荐配置）：

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

## Demo 流程

1. 提交请求：
   - `/policy check my usdt balance` → PASS + live non-funds scaffold 执行
2. 高风险请求：
   - `/policy swap 0.05 usdc to usdt` → CHALLENGE（返回 challengeId）
3. 审批：
   - `/approve <challengeId> ops-approved`（成功时返回 `txHash`）
4. 拒绝：
   - `/reject <challengeId> policy-violation`

## 主网实证（MVP 验证）

- Network: Arbitrum One
- txHash: `0x0e623b3813b68f06db589b50444d7b3dfbdaf9310033672af555425816b4468d`
- Status: success (`status=1`)
- Gas used: `152886`

## Security Boundary（MVP）

- **默认最小权限**：仅 non-funds intents 允许 PASS。
- 资金相关/未知意图一律 CHALLENGE。
- `/approve` 才能触发 challenge 后续执行路径。
- 持久化仅存审批上下文，不存私钥。
- `/approve` 当前只记录审批并走本地适配层占位，不再依赖远端 HTTP 回调。

## 已知限制 / 后续增强

- intent parsing 目前是规则匹配，未接 LLM 语义解析。
- challenge store 目前是单文件 JSON，未做并发锁（适合单进程 MVP）。
- 还未接入 channel 原生 slash command 拦截（当前通过 tool 入口统一处理）。
- 未实现 RBAC（谁可以 approve/reject）与审计签名。
