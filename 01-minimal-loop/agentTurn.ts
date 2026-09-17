import Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlock,
  ContentBlockParam,
  Message,
  MessageParam,
} from "@anthropic-ai/sdk/resources";
import { toolSchemas, toolsByName } from "./agentTools/index.js";
import type { AgentConfig, TurnResult } from "./lib/types.js";
import { DEFAULT_CONFIG } from "./lib/configs.js";
import { AgentResponseCheck } from "./lib/agentResponseCheck.js";
import { logToFile } from "./lib/logger.js";

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

    // console.log("messages", JSON.stringify(messages, null, 2));
    // console.log("stringify", JSON.stringify(response, null, 2));

    console.log(
      response.content
        .filter(
          (x: ContentBlock): x is Anthropic.TextBlock => x.type === "text",
        )
        .map((x) => x.text)
        .join("\n"),
    );

    logToFile(
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

    logToFile(JSON.stringify(messages));

    const responseCheck = AgentResponseCheck(response);
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

    // console.log("toolUses", toolUses);

    for (const [toolIndex, tool] of toolUses.entries()) {
      logToFile(
        `IterationCount: ${iterationCount} cfgVal: ${cfg.toolIterationLimit} `,
      );

      if (iterationCount === cfg.toolIterationLimit) {
        console.log("Max number of iterations reached!!");

        for (const remaining of toolUses.slice(toolIndex)) {
          toolResponses.push({
            type: "tool_result",
            tool_use_id: remaining.id,
            is_error: true,
            content:
              "Aborted: max tool iterations reached. Tools are going to be disabled",
          });
        }
        break;
      } else if (
        cfg.toolWarnAtIteration &&
        iterationCount >= cfg.toolWarnAtIteration.at
      ) {
        console.warn(
          `About to reach max amount of iteration: ${Math.round((iterationCount / cfg.toolIterationLimit) * 100)}%`,
        );
      } else {
        try {
          const toolDef = toolsByName.get(tool.name);
          if (!toolDef) {
            throw new Error(`Unknown tool: ${tool.name}`);
          }

          const parsedInput = toolDef.parse(tool.input);
          // console.log(`→ ${tool.name}(${JSON.stringify(tool.input)})`);
          const output = await toolDef.run(parsedInput, sandboxPath);
          logToFile(
            `← ${output.length} chars: ${output.slice(0, 80).replace(/\n/g, "\\n")}${output.length > 80 ? "…" : ""}`,
          );

          toolResponses.push({
            type: "tool_result",
            tool_use_id: tool.id,
            content: output,
          });
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
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
    }

    // console.log("toolResponses", toolResponses);

    if (toolResponses.length !== 0) {
      messages.push({
        role: "user",
        content: toolResponses,
      });
    }
    cycleCount++;
  }
};
