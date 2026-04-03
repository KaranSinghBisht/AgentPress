import { NextResponse } from "next/server";
import { getFinancials } from "@/lib/ledger";

export async function GET() {
  const financials = getFinancials();
  return NextResponse.json(financials);
}
