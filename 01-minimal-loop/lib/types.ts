import type Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlock,
  RefusalStopDetails,
} from "@anthropic-ai/sdk/resources";

export type TurnResult =
  | { kind: "done" }
  | {
      kind: "limit";
      which: "tool_iterations" | "tool_calls" | "max_tokens_retries" | "cycles";
      at: number;
    }
  | {
      kind: "refusal";
      stopDetails: RefusalStopDetails;
    }
  | {
      kind: "error";
      which: "model_context_window_exceeded" | "null";
      content: ContentBlock[];
    };

export type TurnDecision =
  | { kind: "continue" }
  | {
      kind: "truncated";
      content: ContentBlock[];
    }
  | TurnResult;

export type AgentConfig = {
  toolIterationLimit?: number;
  toolWarnAtIteration?: { at: number } | false;
  cycleIterationLimit?: number;
  cycleWarnAtIteration?: { at: number } | false;
  maxTokens?: number;
  maxTruncationRetries?: number;
  model?: Anthropic.Model;
};
