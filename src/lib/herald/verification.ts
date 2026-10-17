import * as z from "zod";

export const VERDICTS = ["supported", "partially_supported", "unsupported", "unchecked"] as const;
export type Verdict = (typeof VERDICTS)[number];

/** Herald's fact-check of one signal, stored as JSON in signals.verification. */
export interface Verification {
  verdict: Verdict;
  confidence: number;
  notes: string;
  world_query: string | null;
  tokens: string[];
  model: string | null;
  checked_at: string;
  cost_atomic: string | null;
  payment_tx: string | null;
}

/** What paying readers see: the verdict and Herald's reasoning, not costs or act-on hints. */
export type PublicVerification = Pick<
  Verification,
  "verdict" | "confidence" | "notes" | "model" | "checked_at"
>;

export interface PaidCall {
  model: string | null;
  cost_atomic: string | null;
  payment_tx: string | null;
}

const NO_CALL: PaidCall = { model: null, cost_atomic: null, payment_tx: null };

/** A verification that carries no judgement, only why Herald could not check the story. */
export function uncheckedVerification(reason: string, paid: PaidCall = NO_CALL): Verification {
  return {
    verdict: "unchecked",
    confidence: 0,
    notes: reason.slice(0, 280),
    world_query: null,
    tokens: [],
    ...paid,
    checked_at: new Date().toISOString(),
  };
}

const storedSchema = z.object({
  verdict: z.enum(VERDICTS),
  confidence: z.number(),
  notes: z.string(),
  model: z.string().nullable(),
  checked_at: z.string(),
});

/** Parses signals.verification; anything missing or malformed reads as "no verification". */
export function readVerification(raw: string | null | undefined): PublicVerification | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    console.error("Stored Herald verification is not valid JSON:", error instanceof Error ? error.message : error);
    return null;
  }
  const parsed = storedSchema.safeParse(value);
  if (!parsed.success) {
    console.error("Stored Herald verification has an unexpected shape; ignoring it.");
    return null;
  }
  return parsed.data;
}
