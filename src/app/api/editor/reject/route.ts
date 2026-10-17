import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { getDb, schema } from "@/lib/db";
import { verifyEditorAuth } from "@/lib/editor-auth";

const rejection = z.object({ signal_id: z.uuid(), reason: z.string().trim().min(3).max(300) }).strict();

/** Editor takedown: pulls a filed signal off the wire and out of future editions. */
export async function POST(req: NextRequest) {
  const auth = await verifyEditorAuth(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
  }
  const parsed = rejection.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Body must be {signal_id, reason}" }, { status: 400 });
  }
  const db = await getDb();
  await db
    .update(schema.signals)
    .set({ status: "rejected", editorFeedback: `Rejected by editor: ${parsed.data.reason}`, updatedAt: new Date().toISOString() })
    .where(eq(schema.signals.id, parsed.data.signal_id))
    .run();
  return NextResponse.json({ signal_id: parsed.data.signal_id, status: "rejected" });
}
