import { x402Client } from "@x402/core/client";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { PaymentRequirements } from "@x402/core/types";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { FACILITATOR_URL, NETWORK } from "./x402";

const MAINNET = NETWORK === "eip155:8453";
const USDC = MAINNET
  ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  : "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const USDC_DOMAIN = MAINNET ? { name: "USD Coin", version: "2" } : { name: "USDC", version: "2" };

export interface PayoutTarget {
  ledgerId: string;
  address: string;
  amountCents: number;
}

export interface PayoutResult extends PayoutTarget {
  txHash: string | null;
  error?: string;
}

function payoutRequirements(target: PayoutTarget): PaymentRequirements {
  return {
    scheme: "exact",
    network: NETWORK,
    asset: USDC,
    amount: (BigInt(target.amountCents) * BigInt(10_000)).toString(), // cents -> 6-dp USDC
    payTo: target.address,
    maxTimeoutSeconds: 300,
    extra: USDC_DOMAIN,
  };
}

async function payOne(
  client: x402Client,
  facilitator: HTTPFacilitatorClient,
  target: PayoutTarget,
): Promise<PayoutResult> {
  const requirements = payoutRequirements(target);
  try {
    const payload = await client.createPaymentPayload({
      x402Version: 2,
      resource: {
        url: `https://agentpress-ows.vercel.app/api/payouts/${target.ledgerId}`,
        description: "AgentPress reporter payout: 80% of an edition read, split across its stories",
        mimeType: "application/json",
      },
      accepts: [requirements],
    });
    const verified = await facilitator.verify(payload, requirements);
    if (!verified.isValid) {
      return { ...target, txHash: null, error: verified.invalidReason ?? "payout authorization rejected" };
    }
    const settled = await facilitator.settle(payload, requirements);
    return settled.success
      ? { ...target, txHash: settled.transaction }
      : { ...target, txHash: null, error: settled.errorReason ?? "settlement failed" };
  } catch (err) {
    return { ...target, txHash: null, error: err instanceof Error ? err.message : "payout failed" };
  }
}

/**
 * Pays each reporter's share as an x402 "exact" USDC authorization signed by the newsroom
 * wallet and settled by the x402 facilitator, which submits it on-chain and pays the gas.
 * The newsroom never needs ETH; every money flow in AgentPress is an x402 payment.
 */
export async function executePayouts(payouts: PayoutTarget[]): Promise<PayoutResult[]> {
  const privateKey = process.env.TREASURY_PRIVATE_KEY;
  if (!privateKey) {
    return payouts.map((p) => ({ ...p, txHash: null, error: "TREASURY_PRIVATE_KEY not configured" }));
  }
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const client = registerExactEvmScheme(new x402Client(), { signer: account, networks: [NETWORK] });
  const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });

  return Promise.all(
    payouts.map((target) => {
      const payable = isAddress(target.address) && target.amountCents > 0;
      if (!payable || target.address.toLowerCase() === account.address.toLowerCase()) {
        return { ...target, txHash: null, error: "Not payable (invalid, zero or newsroom address)" };
      }
      return payOne(client, facilitator, target);
    }),
  );
}
