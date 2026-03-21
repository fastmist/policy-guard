export interface DemoRunbookOptions {
  mockTxHash?: string;
}

export function buildDemoRunbook(options: DemoRunbookOptions = {}): string {
  const mockTxHash = options.mockTxHash ?? "0xdemo123";

  return [
    "# PolicyGuard 3-Minute Demo Runbook",
    "",
    "## 0) 目标（30秒）",
    "- 证明 PolicyGuard 能把 swap 请求从 `CHALLENGE` 安全推进到 `/approve` 后的可审计执行结果。",
    "- 演示路径：`/policy swap -> CHALLENGE -> /approve -> txHash`。",
    "",
    "## 1) 环境检查（30秒）",
    "```bash",
    "npm run wallet:check",
    "```",
    "",
    "## 2) 离线可复现主链路（60秒）",
    "```bash",
    `POLICYGUARD_E2E_MOCK_TX_HASH=${mockTxHash} npm run e2e:swap-approval`,
    "```",
    "- 预期：输出 challenge 创建成功 + `/approve` 成功 + `txHash`。",
    "",
    "## 3) 关键口播（40秒）",
    "1. `/policy` 对资金类请求默认返回 `CHALLENGE`，阻断直通执行。",
    "2. `/approve` 仅允许 `PENDING -> APPROVED` 一次迁移，重复审批会被幂等保护拦截。",
    "3. 成功执行后返回 `txHash`，可进入链上浏览器追溯。",
    "",
    "## 4) 评审问答兜底（20秒）",
    "- 如果现场网络不稳，直接用离线 mock txHash 跑通全链路。",
    "- 如果要求真链路，切到真实 seed + RPC 环境复跑 `npm run e2e:swap-approval`。",
  ].join("\n");
}
