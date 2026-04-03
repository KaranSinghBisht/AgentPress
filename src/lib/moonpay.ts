import { execSync } from "child_process";

export interface TrendingToken {
  name: string;
  symbol: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
}

export async function getTrendingTokens(chain = "ethereum", limit = 5): Promise<TrendingToken[]> {
  try {
    const raw = execSync(
      `npx moonpay token trending list --chain ${chain} --limit ${limit} --page 1 --json`,
      { timeout: 15000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    );

    // Extract JSON from output (skip any non-JSON preamble like terms notice)
    const jsonStart = raw.indexOf("{");
    if (jsonStart === -1) return [];
    const parsed = JSON.parse(raw.slice(jsonStart));

    return (parsed.items || []).map((t: Record<string, unknown>) => {
      const md = t.marketData as Record<string, unknown> | undefined;
      const priceChange = md?.priceChangePercent as Record<string, number> | undefined;
      const volume = md?.volume as Record<string, number> | undefined;
      return {
        name: t.name as string,
        symbol: t.symbol as string,
        price: (md?.price as number) ?? 0,
        priceChange24h: priceChange?.["24h"] ?? 0,
        volume24h: volume?.["24h"] ?? 0,
        marketCap: (md?.marketCap as number) ?? 0,
      };
    });
  } catch {
    return [];
  }
}

export function formatMarketSnapshotHtml(tokens: TrendingToken[]): string {
  if (tokens.length === 0) return "";

  const rows = tokens
    .map((t) => {
      const direction = t.priceChange24h >= 0 ? "+" : "";
      const color = t.priceChange24h >= 0 ? "#10B981" : "#EF4444";
      return `
        <tr style="border-bottom: 1px solid #E5E7EB;">
          <td style="padding: 8px 12px; font-weight: 600;">${t.symbol}</td>
          <td style="padding: 8px 12px;">${t.name}</td>
          <td style="padding: 8px 12px; font-family: monospace;">$${t.price < 0.01 ? t.price.toExponential(2) : t.price.toFixed(2)}</td>
          <td style="padding: 8px 12px; color: ${color}; font-family: monospace;">${direction}${(t.priceChange24h * 100).toFixed(1)}%</td>
          <td style="padding: 8px 12px; font-family: monospace;">$${(t.volume24h / 1000).toFixed(0)}K</td>
        </tr>`;
    })
    .join("");

  return `
    <div style="margin-top: 32px; border: 2px solid #222; padding: 0;">
      <div style="background: #111; color: #F4F1EC; padding: 12px 16px; font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">
        Market Snapshot — Powered by MoonPay
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="border-bottom: 2px solid #222; background: #FAFAF9;">
            <th style="padding: 8px 12px; text-align: left; font-family: monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Symbol</th>
            <th style="padding: 8px 12px; text-align: left; font-family: monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Name</th>
            <th style="padding: 8px 12px; text-align: left; font-family: monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Price</th>
            <th style="padding: 8px 12px; text-align: left; font-family: monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">24h</th>
            <th style="padding: 8px 12px; text-align: left; font-family: monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Volume</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="padding: 8px 16px; font-family: monospace; font-size: 9px; color: #999; text-transform: uppercase; letter-spacing: 1px; border-top: 1px solid #E5E7EB;">
        Data via MoonPay CLI — moonpay token trending
      </div>
    </div>`;
}

export function formatMarketSnapshotText(tokens: TrendingToken[]): string {
  if (tokens.length === 0) return "";

  const lines = tokens.map((t) => {
    const direction = t.priceChange24h >= 0 ? "+" : "";
    return `  ${t.symbol.padEnd(8)} $${t.price < 0.01 ? t.price.toExponential(2) : t.price.toFixed(2).padEnd(10)} ${direction}${(t.priceChange24h * 100).toFixed(1)}%`;
  });

  return `\nMARKET SNAPSHOT (via MoonPay)\n${"─".repeat(40)}\n${lines.join("\n")}\n`;
}
