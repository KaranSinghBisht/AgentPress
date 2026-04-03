import { validateEnv } from "@/lib/env";

export function register() {
  const { warnings } = validateEnv();
  for (const w of warnings) {
    console.warn(`[AgentPress] ${w}`);
  }
}
