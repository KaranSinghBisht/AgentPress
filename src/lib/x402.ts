import { withX402, x402ResourceServer, type RouteConfig } from "@x402/next";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { NextRequest, NextResponse } from "next/server";
import { EDITION_PRICE_CENTS } from "./constants";

const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || "";
const NETWORK = "eip155:84532"; // Base Sepolia
const FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator";

let server: x402ResourceServer | null = null;

export { TREASURY_ADDRESS, NETWORK, FACILITATOR_URL };

function getX402Server(): x402ResourceServer {
  if (!server) {
    const facilitatorClient = new HTTPFacilitatorClient({
      url: FACILITATOR_URL,
    });
    server = new x402ResourceServer(facilitatorClient).register(
      NETWORK,
      new ExactEvmScheme()
    );
  }

  return server;
}

function createRouteConfig(description: string): RouteConfig {
  return {
    accepts: {
      scheme: "exact",
      price: `$${(EDITION_PRICE_CENTS / 100).toFixed(2)}`,
      network: NETWORK,
      payTo: TREASURY_ADDRESS,
    },
    description,
    mimeType: "application/json",
  };
}

export function withEditionPaywall<T = unknown>(
  handler: (req: NextRequest) => Promise<NextResponse<T>>,
  description: string
) {
  if (!TREASURY_ADDRESS) {
    return handler;
  }

  return withX402(handler, createRouteConfig(description), getX402Server());
}
