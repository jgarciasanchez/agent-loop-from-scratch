import type { Message } from "@anthropic-ai/sdk/resources";
import type { TurnDecision } from "./types.js";

export const AgentResponseCheck = (res: Message): TurnDecision => {
  switch (res.stop_reason) {
    case "tool_use":
      return { kind: "continue" };
    case "pause_turn":
      return { kind: "continue" };
    case "end_turn":
    case "stop_sequence":
      return {
        kind: "done",
      };
    case "max_tokens":
      return {
        kind: "truncated",
        content: res.content,
      };
    case "refusal":
      if (!res.stop_details) throw new Error("refusal without stop_details");
      return {
        kind: "refusal",
        stopDetails: res.stop_details,
      };
    case "model_context_window_exceeded":
      return {
        kind: "error",
        which: "model_context_window_exceeded",
        content: res.content,
      };
    case null:
      return {
        kind: "error",
        which: "null",
        content: res.content,
      };
    default: {
      const exhaustive: never = res.stop_reason;
      throw new Error(`Unhandled stop_reason: ${exhaustive}`);
    }
  }
};
