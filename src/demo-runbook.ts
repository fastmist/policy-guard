export function getDemoRunbook(): string {
  const lines = [
    "# PolicyGuard Demo Runbook",
    "",
    "## Objective (30s)",
    "- Show approval-gated execution for funds operations.",
    "- Flow: /policy swap -> CHALLENGE -> /approve -> txHash.",
    "",
    "## Environment Check (30s)",
    "- Verify plugin is loaded and challenge persistence is writable.",
    "- Verify runtime dependencies are available.",
    "",
    "## Main Flow (60s)",
    "- Trigger challenge with /policy swap ...",
    "- Approve once with /approve <challengeId> ...",
    "- Confirm execution output includes txHash.",
    "",
    "## Key Talking Points (40s)",
    "1. Funds intents are challenge-first by deterministic policy.",
    "2. Idempotency blocks duplicate approval execution.",
    "3. Success output is auditable through txHash.",
  ];

  return lines.join("\n");
}
