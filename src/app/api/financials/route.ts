import { NextResponse } from "next/server";
import { getFinancials } from "@/lib/ledger";
import { getPaymentRevenue } from "@/lib/payments";

export async function GET() {
  const [financials, payments] = await Promise.all([
    getFinancials(),
    getPaymentRevenue(),
  ]);

  return NextResponse.json({
    ...financials,
    paymentRevenueCents: payments.totalCents,
    paymentCount: payments.count,
  });
}
