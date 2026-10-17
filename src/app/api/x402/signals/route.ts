import { NextResponse } from "next/server";
import { withSettledPayment } from "@/lib/x402";
import { FILING_FEE_CENTS } from "@/lib/constants";
import { recordLedgerEntry } from "@/lib/ledger";
import {
  fileSignal,
  signalFilingSchema,
  upsertReporter,
  type SignalFiling,
} from "@/lib/signal-filing";

/**
 * File a signal by paying a $0.01 x402 filing fee. No account, no API key:
 * the paying wallet becomes the reporter's identity and payout address.
 */
export const POST = withSettledPayment<SignalFiling>(
  {
    price: `$${(FILING_FEE_CENTS / 100).toFixed(2)}`,
    description: "File a news signal with the AgentPress editor; the paying wallet earns revenue share if it is published",
    guard: async (req) => {
      const raw: unknown = await req
        .clone()
        .json()
        .catch(() => null);
      const parsed = signalFilingSchema.safeParse(raw);
      if (!parsed.success) {
        return {
          reject: NextResponse.json(
            {
              error: "Invalid signal. Nothing was charged.",
              issues: parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`),
            },
            { status: 400 },
          ),
        };
      }
      return { data: parsed.data };
    },
  },
  async (_req, payment, filing) => {
    const reporter = await upsertReporter(payment.network, payment.payer, filing.reporter_name);
    const filed = await fileSignal(reporter, filing);
    await recordLedgerEntry({
      type: "revenue",
      amountCents: FILING_FEE_CENTS,
      description: "x402 signal filing fee",
      fromAddress: payment.payer,
      txHash: payment.transaction,
    }).catch((error: unknown) => console.error("filing fee ledger write failed:", error));

    return NextResponse.json(
      {
        signal: { id: filed.id, status: "submitted", beat: filed.beat },
        editor_preview: {
          score: filed.previewScore,
          breakdown: filed.breakdown,
          tips: filed.tips,
          note: "Herald re-scores all pending signals at the next edition; the top 10 are published.",
        },
        reporter: { name: reporter.name, address: reporter.address, account_id: reporter.accountId },
        receipt: {
          paid_usd: (FILING_FEE_CENTS / 100).toFixed(2),
          transaction: payment.transaction,
          network: payment.network,
        },
      },
      { status: 201 },
    );
  },
);
