import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { recordLedgerEntry } from "@/lib/ledger";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-editor-key");
  if (apiKey !== process.env.EDITOR_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();

  const edition = await db
    .select()
    .from(schema.editions)
    .orderBy(sql`${schema.editions.number} DESC`)
    .limit(1)
    .get();

  if (!edition) {
    return NextResponse.json(
      { error: "No editions to publish. Run /api/editor/compile first." },
      { status: 400 }
    );
  }

  // Idempotency: if already emailed, return cached result without re-sending
  if (edition.emailedAt) {
    return NextResponse.json({
      message: `Edition #${edition.number} already published`,
      emailsSent: 0,
      subscriberCount: 0,
      estimatedRevenueCents: edition.revenueCents,
      alreadyPublished: true,
      edition: {
        id: edition.id,
        number: edition.number,
        title: edition.title,
        signalCount: edition.signalCount,
        url: `/editions/${edition.id}`,
      },
    });
  }

  // Record publication event in ledger
  await recordLedgerEntry({
    type: "expense",
    amountCents: 0,
    description: `Published Edition #${edition.number} — ${edition.signalCount} signals distributed`,
    editionId: edition.id,
  });

  // Refresh revenue estimate based on current subscriber count
  const subCount =
    (await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.subscribers)
      .where(eq(schema.subscribers.active, 1))
      .get())?.count ?? 0;

  const estimatedRevenueCents = subCount * edition.priceCents;

  // Update revenue estimate
  if (edition.revenueCents !== estimatedRevenueCents) {
    await db.update(schema.editions)
      .set({ revenueCents: estimatedRevenueCents })
      .where(eq(schema.editions.id, edition.id))
      .run();
  }

  // Send notification emails to active subscribers
  let emailsSent = 0;
  const emailErrors: string[] = [];

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const subscribers = await db
      .select()
      .from(schema.subscribers)
      .where(eq(schema.subscribers.active, 1))
      .all();

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    for (const sub of subscribers) {
      try {
        await resend.emails.send({
          from: "AgentPress <onboarding@resend.dev>",
          to: sub.email,
          subject: `AgentPress #${edition.number}: ${edition.title}`,
          html: `
            <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #111;">
              <h1 style="font-size: 24px; border-bottom: 2px solid #E85D04; padding-bottom: 12px;">
                Agent<span style="color: #E85D04; font-style: italic;">Press</span>
              </h1>
              <h2 style="font-size: 20px; margin-top: 24px;">${edition.title}</h2>
              ${edition.summary ? `<p style="color: #666; font-style: italic;">${edition.summary}</p>` : ""}
              <p style="margin-top: 16px;">${edition.signalCount} signals curated by our autonomous editor.</p>
              <a href="${baseUrl}/editions/${edition.id}"
                 style="display: inline-block; background: #111; color: #F4F1EC; padding: 12px 24px; text-decoration: none; font-family: monospace; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin-top: 16px;">
                Read Edition &rarr;
              </a>
              <p style="margin-top: 32px; font-size: 12px; color: #999; font-family: monospace; text-transform: uppercase; letter-spacing: 1px;">
                Powered by OWS + x402 micropayments
              </p>
            </div>
          `,
        });
        emailsSent++;
      } catch (err) {
        emailErrors.push(`${sub.email}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }
  }

  // Mark as emailed only after delivery completes (not before)
  // This ensures retries work if the request crashes mid-send
  if (emailsSent > 0) {
    await db.update(schema.editions)
      .set({ emailedAt: new Date().toISOString() })
      .where(eq(schema.editions.id, edition.id))
      .run();
  }

  return NextResponse.json({
    message: `Edition #${edition.number} published`,
    emailsSent,
    subscriberCount: subCount,
    estimatedRevenueCents,
    ...(emailErrors.length > 0 ? { emailErrors } : {}),
    edition: {
      id: edition.id,
      number: edition.number,
      title: edition.title,
      signalCount: edition.signalCount,
      url: `/editions/${edition.id}`,
    },
  });
}
