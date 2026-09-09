import Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlock,
  ContentBlockParam,
  Message,
  MessageParam,
} from "@anthropic-ai/sdk/resources";
import { toolSchemas, toolsByName } from "./agentTools/index.js";
import type { AgentConfig, TurnDecision, TurnResult } from "./lib/types.js";
import { DEFAULT_CONFIG } from "./lib/configs.js";

const client = new Anthropic();

export const agentTurn = async (
  messages: MessageParam[],
  userConfig: AgentConfig,
  sandboxPath: string,
): Promise<TurnResult> => {
  const cfg = { ...DEFAULT_CONFIG, ...userConfig };
  let iterationCount = 0;
  let truncationCount = 0;
  let cycleCount = 0;

  while (true) {
    if (cycleCount === cfg.cycleIterationLimit) {
      console.log("Max number of cycles reached!!");

      return {
        kind: "limit",
        which: "cycles",
        at: cycleCount,
      };
    } else if (
      cfg.cycleWarnAtIteration &&
      cycleCount >= cfg.cycleWarnAtIteration.at
    ) {
      console.warn(
        `About to reach max amount of cycles: ${Math.round((cycleCount / cfg.cycleIterationLimit) * 100)}%`,
      );
    }

    const response: Message = await client.messages.create({
      model: cfg.model,
      max_tokens: cfg.maxTokens,
      tools: toolSchemas,
      messages: messages,
    });

    console.log(
      response.content
        .filter(
          (x: ContentBlock): x is Anthropic.TextBlock => x.type === "text",
        )
        .map((x) => x.text)
        .join("\n"),
    );

    console.log(
      `[tokens] input=${response.usage.input_tokens} output=${response.usage.output_tokens} cache_read=${response.usage.cache_read_input_tokens ?? 0} cache_creation=${response.usage.cache_creation_input_tokens ?? 0}`,
    );

    const lastMessage = messages.at(-1);

    if (
      lastMessage &&
      lastMessage.role === "assistant" &&
      Array.isArray(lastMessage.content)
    ) {
      lastMessage.content.push(...response.content);
    } else messages.push({ role: "assistant", content: response.content });

    const responseCheck: TurnDecision = AgentResponseCheck(response);
    const isTruncated = responseCheck.kind === "truncated";

    const toolUses = response.content.filter(
      (x: ContentBlock): x is Anthropic.ToolUseBlock => x.type === "tool_use",
    );

    if (isTruncated) {
      truncationCount++;
      if (truncationCount >= cfg.maxTruncationRetries) {
        if (toolUses.length !== 0) {
          messages.push({
            role: "user",
            content: toolUses.map((tool) => ({
              type: "tool_result",
              tool_use_id: tool.id,
              is_error: true,
              content: "Aborted: max truncation retries reached.",
            })),
          });
        }
        return {
          kind: "limit",
          which: "max_tokens_retries",
          at: truncationCount,
        };
      }
    } else truncationCount = 0;

    if (responseCheck.kind !== "continue" && !isTruncated) return responseCheck;

    const toolResponses: Array<ContentBlockParam> = [];

    for (const [toolIndex, tool] of toolUses.entries()) {
      if (iterationCount === cfg.toolIterationLimit) {
        console.log("Max number of iterations reached!!");
        for (const remaining of toolUses.slice(toolIndex)) {
          toolResponses.push({
            type: "tool_result",
            tool_use_id: remaining.id,
            is_error: true,
            content: "Aborted: max tool iterations reached.",
          });
        }
        messages.push({ role: "user", content: toolResponses });
        return {
          kind: "limit",
          which: "tool_iterations",
          at: iterationCount,
        };
      } else if (
        cfg.toolWarnAtIteration &&
        iterationCount >= cfg.toolWarnAtIteration.at
      ) {
        console.warn(
          `About to reach max amount of iteration: ${Math.round((iterationCount / cfg.toolIterationLimit) * 100)}%`,
        );
      }

      try {
        const toolDef = toolsByName.get(tool.name);
        if (!toolDef) {
          throw new Error(`Unknown tool: ${tool.name}`);
        }

        const parsedInput = toolDef.parse(tool.input);
        const output = await toolDef.run(parsedInput, sandboxPath);
        console.log(
          `← ${output.length} chars: ${output.slice(0, 80).replace(/\n/g, "\\n")}${output.length > 80 ? "…" : ""}`,
        );

        toolResponses.push({
          type: "tool_result",
          tool_use_id: tool.id,
          content: output,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(
          `← ERROR: ${errorMsg}. ${isTruncated ? "Input truncated reason: Max-tokens" : ""}`,
        );
        toolResponses.push({
          type: "tool_result",
          tool_use_id: tool.id,
          is_error: true,
          content: `${errorMsg}. ${isTruncated ? "Input truncated reason: Max-tokens" : ""}`,
        });
      }
      iterationCount++;
    }

    if (toolResponses.length !== 0) {
      messages.push({
        role: "user",
        content: toolResponses,
      });
    }
    cycleCount++;
  }
};

const AgentResponseCheck = (res: Message): TurnDecision => {
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
