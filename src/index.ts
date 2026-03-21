import { emptyPluginConfigSchema, type OpenClawPluginApi } from "openclaw/plugin-sdk";
import { resolve } from "node:path";
import { handleCommand } from "./commands.js";
import { PendingChallengeStore } from "./persistence.js";
import { WdkAdapter } from "./wdk-adapter.js";

type PluginConfig = {
  persistencePath?: string;
  /** @deprecated */
  wdkBaseUrl?: string;
  /** @deprecated */
  wdkApiKey?: string;
  /** @deprecated */
  wdkDryRun?: boolean;
  wdkSeedEnvKey?: string;
  chain?: string;
  accountIndex?: number;
  rpcUrl?: string;
  swapProtocolLabel?: string;
  swapMaxFee?: string;
};

const plugin = {
  id: "policyguard-openclaw-plugin",
  name: "PolicyGuard",
  description: "MVP policy guard plugin with deterministic PASS/CHALLENGE flow",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    const loaded = api.runtime?.config?.loadConfig?.() as unknown as { plugins?: Record<string, unknown> };
    const cfg = ((loaded?.plugins?.["policyguard-openclaw-plugin"] as PluginConfig | undefined) ?? {}) as PluginConfig;
    const persistencePath = cfg.persistencePath
      ? resolve(cfg.persistencePath)
      : resolve(process.cwd(), "data", "pending-challenges.json");

    const store = new PendingChallengeStore(persistencePath);
    const adapter = new WdkAdapter({
      baseUrl: cfg.wdkBaseUrl,
      apiKey: cfg.wdkApiKey,
      wdkDryRun: cfg.wdkDryRun,
      wdkSeedEnvKey: cfg.wdkSeedEnvKey,
      chain: cfg.chain,
      accountIndex: cfg.accountIndex,
      rpcUrl: cfg.rpcUrl,
      swapProtocolLabel: cfg.swapProtocolLabel,
      swapMaxFee: cfg.swapMaxFee,
    });

    api.registerTool({
      name: "policyguard_command",
      label: "PolicyGuard Command",
      description:
        "Run PolicyGuard slash commands. Supported: /policy <request>, /approve <id> [reason], /reject <id> [reason]",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Literal slash command input" },
        },
        required: ["command"],
      },
      async execute(_toolCallId: string, params: unknown) {
        const command =
          typeof params === "object" && params !== null && "command" in params && typeof (params as { command: unknown }).command === "string"
            ? (params as { command: string }).command
            : "";

        if (!command.trim()) {
          const output = { ok: false, error: "Missing command" };
          return { output, details: output, isError: true, content: [{ type: "text", text: JSON.stringify(output) }] };
        }

        const result = await handleCommand(command, { store, adapter });
        return {
          output: result,
          details: result,
          isError: result.ok === false,
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      },
    });

    api.logger.info?.(`[policyguard] registered with persistence=${persistencePath}`);
  },
};

export default plugin;
export { handleCommand } from "./commands.js";
export { evaluatePolicy } from "./policy-engine.js";
export { parseIntent } from "./intent.js";
