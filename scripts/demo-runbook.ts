import { buildDemoRunbook } from "../src/demo-runbook.js";

const mockTxHash = process.env.POLICYGUARD_DEMO_MOCK_TX_HASH;
console.log(buildDemoRunbook({ mockTxHash }));
