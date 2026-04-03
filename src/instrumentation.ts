import { validateEnv } from "@/lib/env";

export function register() {
  try {
    const { warnings } = validateEnv();
    for (const w of warnings) {
      console.warn(`[AgentPress] ${w}`);
    }
  } catch (err) {
    // Log but don't crash — allows build to succeed on Vercel
    console.error(`[AgentPress] Env validation: ${err instanceof Error ? err.message : err}`);
  }
}
