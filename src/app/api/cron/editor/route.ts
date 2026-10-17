import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { currentSignal } from "@/lib/era";
import { POST as review } from "../../editor/review/route";
import { POST as compile } from "../../editor/compile/route";

export const maxDuration = 300;

const MIN_STORIES = 3;

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Herald's daily run (Vercel cron): verify + score the wire, then compile when enough stories qualify. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization") ?? "";
  if (!secret || !timingSafeEqual(digest(given), digest(`Bearer ${secret}`))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const editorRequest = (path: string) =>
    new NextRequest(new URL(path, req.url), {
      method: "POST",
      headers: { "x-editor-key": process.env.EDITOR_API_KEY ?? "" },
    });

  const reviewed: unknown = await (await review(editorRequest("/api/editor/review"))).json();

  const db = await getDb();
  const ready =
    (
      await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(schema.signals)
        .where(and(eq(schema.signals.status, "included"), currentSignal))
        .get()
    )?.count ?? 0;

  if (Number(ready) < MIN_STORIES) {
    return NextResponse.json({ reviewed, compiled: null, note: `Waiting for ${MIN_STORIES} verified stories (have ${ready}).` });
  }
  const compiled: unknown = await (await compile(editorRequest("/api/editor/compile"))).json();
  return NextResponse.json({ reviewed, compiled });
}
