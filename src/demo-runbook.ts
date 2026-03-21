export function buildDemoRunbook(input?: { mockTxHash?: string }): string {
  const mockTxHash = input?.mockTxHash ?? "0xmocktx";
  const lines = [
    "# PolicyGuard 3-Minute Demo Runbook",
    "",
    "## Objective",
    "- Show approval-gated execution for funds operations.",
    "- Flow: /policy swap -> CHALLENGE -> /approve -> txHash",
    "",
    "## Environment check",
    "- npm run wallet:check",
    "",
    "## Offline reproducible flow",
    `- POLICYGUARD_E2E_MOCK_TX_HASH=${mockTxHash} npm run e2e:swap-approval`,
  ];
  return lines.join("\n");
}

export function getDemoRunbook(): string {
  return buildDemoRunbook();
}
