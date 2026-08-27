import Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlock,
  ContentBlockParam,
  Message,
  MessageParam,
} from "@anthropic-ai/sdk/resources";
import readline from "node:readline/promises";
import { exit, stdin as input, stdout } from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toolSchemas, toolsByName } from "./agentTools/index.js";
import type { AgentConfig, TurnDecision, TurnResult } from "./lib/types.js";
import { DEFAULT_CONFIG } from "./lib/configs.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sandboxPath = path.join(__dirname, "sandbox");
const client = new Anthropic();

const runAgent = async (userConfig: AgentConfig) => {
  const rl = readline.createInterface({ input, output: stdout });
  const messages: MessageParam[] = [];

  while (true) {
    const newUserMsg = await rl.question(
      messages.length === 0 ? "En que te puedo ayudar?" : "-",
    );
    if (
      newUserMsg.toLowerCase() === "close" ||
      newUserMsg.toLowerCase() === "exit"
    ) {
      rl.close();
      exit();
    }
    messages.push({ role: "user", content: newUserMsg });
    const agentResponse = await agentTurn(messages, userConfig);
    if (agentResponse.kind !== "done") {
      //logic for how im going to handle different cases
    }
  }
};

const agentTurn = async (
  messages: MessageParam[],
  userConfig: AgentConfig,
): Promise<TurnResult> => {
  const cfg = { ...DEFAULT_CONFIG, ...userConfig };
  let iterationCount = 0;

  while (true) {
    if (iterationCount === cfg.toolIterationLimit) {
      console.log("Max number of iterations reached!!");
      return {
        kind: "limit",
        which: "tool_iterations",
        at: iterationCount,
      };
    } else if (
      cfg.cycleWarnAtIteration &&
      iterationCount >= cfg.cycleWarnAtIteration.at
    ) {
      console.warn(
        `About to reach max amount of iteration: ${cfg.cycleIterationLimit - cfg.cycleWarnAtIteration.at}%`,
      );
    }

    const response: Message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2000,
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

    messages.push({ role: "assistant", content: response.content });

    const responseCheck: TurnDecision = AgentResponseCheck(response);

    if (responseCheck.kind !== "continue") return responseCheck;

    const toolUses = response.content.filter(
      (x: ContentBlock): x is Anthropic.ToolUseBlock => x.type === "tool_use",
    );

    const toolResponses: Array<ContentBlockParam> = [];

    for (const tool of toolUses) {
      try {
        const toolDef = toolsByName.get(tool.name);
        if (!toolDef) {
          throw new Error(`Unknown tool: ${tool.name}`);
        }

        const parsedInput = toolDef.parse(tool.input);

        console.log(`→ ${tool.name}(${JSON.stringify(tool.input)})`);
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
        console.error(`← ERROR: ${errorMsg}`);
        toolResponses.push({
          type: "tool_result",
          tool_use_id: tool.id,
          is_error: true,
          content: errorMsg,
        });
      }
    }

    messages.push({
      role: "user",
      content: toolResponses,
    });
    iterationCount++;
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

await runAgent({});
