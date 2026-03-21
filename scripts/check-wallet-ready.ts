import { JsonRpcProvider, formatEther } from "ethers";

const address = process.env.POLICYGUARD_TEST_WALLET ?? "0x3859b348F70104f957462Ac9B9e2505664Cf2E6C";
const rpcUrl = process.env.POLICYGUARD_RPC_URL ?? "https://arb1.arbitrum.io/rpc";
async function run() {
  const provider = new JsonRpcProvider(rpcUrl);
  const wei = await provider.getBalance(address);
  const eth = Number(formatEther(wei));

  const result = {
    ok: eth > 0,
    network: "arbitrum-one",
    address,
    balanceEth: eth,
    next: eth > 0 ? "wallet has gas balance" : "wallet has zero gas balance",
  };

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) process.exit(2);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
