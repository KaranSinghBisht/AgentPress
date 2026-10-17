import * as z from "zod/v4";

/** AgentPress origin. Hosted plugins may override it with a portal environment variable. */
export const BASE_URL = (process.env.AGENTPRESS_BASE_URL || "https://agentpress-ows.vercel.app").replace(/\/+$/, "");

const TIMEOUT_MS = 3_000;
/** PayBox gives each tool call 10 s; keep every call (and its retries) inside ~8.5 s. */
export const callDeadline = () => Date.now() + 8_500;

export class UpstreamError extends Error {}

async function fetchOnce(path: string, deadline: number): Promise<Response> {
  const budget = Math.min(TIMEOUT_MS, deadline - Date.now());
  if (budget < 500) throw new UpstreamError("AgentPress is slow right now. Retry in a moment.");
  return fetch(`${BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(budget),
    redirect: "error",
  });
}

/** GETs are idempotent: retry once on a network error or a 5xx, if the call budget allows. */
export async function getJson<T>(path: string, schema: z.ZodType<T>, deadline = callDeadline()): Promise<T> {
  let response: Response;
  try {
    response = await fetchOnce(path, deadline);
    if (response.status >= 500) response = await fetchOnce(path, deadline);
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    try {
      response = await fetchOnce(path, deadline);
    } catch {
      throw new UpstreamError("AgentPress did not respond. Check the plugin's network access and retry.");
    }
  }
  if (!response.ok) throw new UpstreamError(`AgentPress returned HTTP ${response.status}.`);
  const parsed = schema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new UpstreamError("AgentPress returned an unexpected response.");
  return parsed.data;
}

export function errorResult(error: unknown) {
  const text = error instanceof UpstreamError ? error.message : "AgentPress request failed. Retry explicitly.";
  return { isError: true as const, content: [{ type: "text" as const, text }] };
}

export const BEATS = ["agentic-payments", "defi", "infrastructure", "regulation", "market-signals", "bitcoin"] as const;

export const BEAT_LABELS: Record<string, string> = {
  "agentic-payments": "Agentic Payments",
  defi: "DeFi & Protocols",
  infrastructure: "Infrastructure",
  regulation: "Regulation & Policy",
  "market-signals": "Market Signals",
  bitcoin: "Bitcoin & L2s",
};

export const beatLabel = (beat: string) => BEAT_LABELS[beat] ?? beat;

export const usd = (cents: number) => (cents / 100).toFixed(2);

const editionSummary = z.object({
  id: z.string(),
  number: z.number().int(),
  title: z.string(),
  summary: z.string().nullable(),
  signalCount: z.number().int(),
  priceCents: z.number().int(),
  publishedAt: z.string(),
});

export const editionsList = z.object({ editions: z.array(editionSummary) });
export type EditionSummary = z.infer<typeof editionSummary>;

/** Resolves an edition number (or the latest edition) from the public edition list. */
export async function resolveEdition(number?: number): Promise<{ edition: EditionSummary; all: EditionSummary[] }> {
  const { editions } = await getJson("/api/editions", editionsList);
  const edition = number === undefined ? editions[0] : editions.find((e) => e.number === number);
  if (!edition) {
    const latest = editions[0]?.number;
    throw new UpstreamError(
      latest === undefined ? "AgentPress has not published an edition yet." : `Edition #${number} does not exist. The latest is #${latest}.`,
    );
  }
  return { edition, all: editions };
}
