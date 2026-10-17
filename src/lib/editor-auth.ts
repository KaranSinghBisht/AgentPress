import { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";

const digest = (value: string) => createHash("sha256").update(value).digest();
import { verifyOWSSignature } from "./auth";

/**
 * Verify editor access via API key OR OWS wallet signature from the treasury.
 * Supports both auth methods so the editor agent can use its OWS wallet identity.
 */
export async function verifyEditorAuth(req: NextRequest): Promise<{
  authorized: boolean;
  method: "api-key" | "ows-wallet" | null;
  error?: string;
}> {
  // Method 1: API key (backwards-compatible)
  // Env values can carry a trailing newline from how they were set; compare trimmed.
  const apiKey = req.headers.get("x-editor-key")?.trim();
  const expected = process.env.EDITOR_API_KEY?.trim();
  if (apiKey && expected && timingSafeEqual(digest(apiKey), digest(expected))) {
    return { authorized: true, method: "api-key" };
  }

  // Method 2: OWS wallet signature from the treasury wallet
  const hasOWSHeaders = req.headers.get("x-ap-account-id") && req.headers.get("x-ap-signature");
  if (hasOWSHeaders) {
    // Read a clone so the route handler can still parse the body.
    const body = req.method === "POST" ? await req.clone().text() : undefined;
    const result = await verifyOWSSignature(req, body);

    if (!result.valid) {
      return { authorized: false, method: null, error: result.error };
    }

    // Verify the signer is the treasury wallet
    const treasuryAddress = process.env.TREASURY_ADDRESS;
    if (treasuryAddress && result.address?.toLowerCase() === treasuryAddress.toLowerCase()) {
      return { authorized: true, method: "ows-wallet" };
    }

    // Also accept the configured editor wallet
    const editorWallet = process.env.EDITOR_WALLET_ADDRESS;
    if (editorWallet && result.address?.toLowerCase() === editorWallet.toLowerCase()) {
      return { authorized: true, method: "ows-wallet" };
    }

    return { authorized: false, method: null, error: "Signer is not an authorized editor wallet" };
  }

  return { authorized: false, method: null, error: "Missing auth: provide x-editor-key or OWS signature" };
}
