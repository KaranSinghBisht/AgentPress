import { NextResponse } from "next/server";
import { getFinancials } from "@/lib/ledger";

export async function GET() {
  const financials = await getFinancials();
  return NextResponse.json(financials);
}
