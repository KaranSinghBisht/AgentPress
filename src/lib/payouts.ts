import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const USDC_ABI = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
]);

interface PayoutResult {
  address: string;
  amountCents: number;
  txHash: string | null;
  error?: string;
}

export async function executePayouts(
  payouts: { address: string; amountCents: number }[],
): Promise<PayoutResult[]> {
  const privateKey = process.env.TREASURY_PRIVATE_KEY;
  if (!privateKey) {
    return payouts.map((p) => ({
      ...p,
      txHash: null,
      error: "TREASURY_PRIVATE_KEY not configured",
    }));
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http("https://sepolia.base.org"),
  });
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http("https://sepolia.base.org"),
  });

  const results: PayoutResult[] = [];

  for (const payout of payouts) {
    if (!payout.address || payout.amountCents <= 0) {
      results.push({ ...payout, txHash: null, error: "Invalid address or amount" });
      continue;
    }

    try {
      // Convert cents to USDC units (6 decimals): 1 cent = 10000 units
      const amount = BigInt(payout.amountCents) * BigInt(10000);

      const txHash = await walletClient.writeContract({
        address: USDC_BASE_SEPOLIA,
        abi: USDC_ABI,
        functionName: "transfer",
        args: [payout.address as `0x${string}`, amount],
      });

      // Wait for confirmation
      await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 30_000 });

      results.push({ ...payout, txHash });
    } catch (err) {
      results.push({
        ...payout,
        txHash: null,
        error: err instanceof Error ? err.message : "Transaction failed",
      });
    }
  }

  return results;
}
