import { fetch as crossFetch } from "cross-fetch";

const READ_ONLY = /^\s*(select|pragma|with)\b/i;

/** The libsql HTTP client hands its custom fetch a single cross-fetch Request. */
interface PipelineRequest {
  clone(): PipelineRequest;
  text(): Promise<string>;
}

/** True when every statement in a Turso (Hrana) pipeline body is a read. */
function isReadOnlyPipeline(body: string): boolean {
  try {
    const pipeline = JSON.parse(body) as { requests?: Array<{ type?: string; stmt?: { sql?: string } }> };
    const statements = (pipeline.requests ?? []).filter((r) => r.type === "execute");
    return statements.length > 0 && statements.every((r) => READ_ONLY.test(r.stmt?.sql ?? ""));
  } catch {
    return false;
  }
}

/**
 * Turso's HTTP endpoint occasionally resets an idle keep-alive socket (ECONNRESET).
 * Retry such failures once, and only for read-only pipelines, so no write can apply twice.
 */
export async function resilientFetch(request: PipelineRequest): Promise<Response> {
  const body = await request.clone().text().catch(() => "");
  const retry = isReadOnlyPipeline(body) ? request.clone() : null;
  try {
    return await crossFetch(request as unknown as Request);
  } catch (error) {
    if (!retry) throw error;
    console.error("Turso request failed; retrying read once:", error instanceof Error ? error.message : error);
    return crossFetch(retry as unknown as Request);
  }
}
