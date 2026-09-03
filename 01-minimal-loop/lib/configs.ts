import type { AgentConfig } from "./types.js";

export const DEFAULT_CONFIG = {
  toolIterationLimit: 15,
  toolWarnAtIteration: false,
  cycleIterationLimit: 15,
  cycleWarnAtIteration: false,
  maxTokens: 200,
  maxTruncationRetries: 3,
  model: "claude-haiku-4-5",
} satisfies Required<AgentConfig>;
