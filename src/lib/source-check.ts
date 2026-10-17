const TIMEOUT_MS = 4_000;

async function resolves(url: string): Promise<boolean> {
  const attempt = async (method: "HEAD" | "GET") => {
    const response = await fetch(url, {
      method,
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "AgentPress-Herald/1.0 (+https://agentpress-ows.vercel.app)" },
    });
    return response.status;
  };
  try {
    let status = await attempt("HEAD");
    // Some sites reject HEAD or bot HEAD requests; confirm with GET before failing.
    if (status === 403 || status === 405 || status >= 500) status = await attempt("GET");
    return status < 400;
  } catch {
    return false;
  }
}

/** Returns only the sources that currently resolve (HTTP < 400). Herald scores those alone. */
export async function liveSources(urls: string[]): Promise<string[]> {
  const checks = await Promise.all(urls.map(async (url) => ((await resolves(url)) ? url : null)));
  return checks.filter((url): url is string => url !== null);
}
