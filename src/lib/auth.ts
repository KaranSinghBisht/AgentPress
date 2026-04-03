import { verifyMessage } from "viem";
import { createHash } from "crypto";
import { NextRequest } from "next/server";

// In-memory nonce replay window (10 minutes)
const usedNonces = new Map<string, number>();

// Clean expired nonces every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [nonce, ts] of usedNonces) {
    if (ts < cutoff) usedNonces.delete(nonce);
  }
}, 5 * 60 * 1000);

export interface AuthResult {
  valid: boolean;
  accountId?: string;
  chainId?: string;
  address?: string;
  error?: string;
}

function parseCAIP10(accountId: string): {
  chainId: string;
  address: string;
} | null {
  // CAIP-10: "eip155:1:0xABC..." or "eip155:84532:0xABC..."
  const parts = accountId.split(":");
  if (parts.length < 3) return null;
  const chainId = `${parts[0]}:${parts[1]}`;
  const address = parts.slice(2).join(":");
  return { chainId, address };
}

export async function verifyOWSSignature(
  req: NextRequest,
  body?: string
): Promise<AuthResult> {
  const accountId = req.headers.get("x-ap-account-id");
  const signature = req.headers.get("x-ap-signature");
  const timestamp = req.headers.get("x-ap-timestamp");
  const nonce = req.headers.get("x-ap-nonce");
  const bodyHash = req.headers.get("x-ap-body-sha256");

  if (!accountId || !signature || !timestamp || !nonce) {
    return { valid: false, error: "Missing auth headers" };
  }

  // Check timestamp within 5 minutes
  const ts = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) {
    return { valid: false, error: "Timestamp expired" };
  }

  // Check nonce replay
  if (usedNonces.has(nonce)) {
    return { valid: false, error: "Nonce already used" };
  }
  usedNonces.set(nonce, Date.now());

  // Parse CAIP-10 account ID
  const parsed = parseCAIP10(accountId);
  if (!parsed) {
    return { valid: false, error: "Invalid CAIP-10 account ID" };
  }

  // Only support EVM chains for now
  if (!parsed.chainId.startsWith("eip155:")) {
    return { valid: false, error: "Only EVM chains supported" };
  }

  // Verify body hash if provided
  if (body !== undefined) {
    const expectedHash = createHash("sha256").update(body).digest("hex");
    if (bodyHash && bodyHash !== expectedHash) {
      return { valid: false, error: "Body hash mismatch" };
    }
  }

  // Reconstruct message
  const method = req.method;
  const path = new URL(req.url).pathname;
  const computedBodyHash =
    bodyHash ||
    createHash("sha256")
      .update(body || "")
      .digest("hex");
  const message = `${method}\n${path}\n${timestamp}\n${nonce}\n${computedBodyHash}`;

  // Verify with viem
  try {
    const hexSig = signature.startsWith("0x")
      ? signature
      : `0x${signature}`;
    const isValid = await verifyMessage({
      address: parsed.address as `0x${string}`,
      message,
      signature: hexSig as `0x${string}`,
    });

    if (!isValid) {
      return { valid: false, error: "Invalid signature" };
    }

    return {
      valid: true,
      accountId,
      chainId: parsed.chainId,
      address: parsed.address,
    };
  } catch {
    return { valid: false, error: "Signature verification failed" };
  }
}
