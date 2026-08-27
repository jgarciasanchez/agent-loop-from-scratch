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
import { toolSchemas, toolsByName } from "./tools/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sandboxPath = path.join(__dirname, "sandbox");
const client = new Anthropic();

type AgentConfig = {
  toolIterationLimit?: number;
  toolWarnAtIteration?: { at: number } | false;
  cycleIterationLimit?: number;
  cycleWarnAtIteration?: { at: number } | false; 
  maxTokens?: number;
  model?: Anthropic.Model;
};

const DEFAULT_CONFIG = {
  toolIterationLimit: 15,
  toolWarnAtIteration: false,
  cycleIterationLimit: 15,
  cycleWarnAtIteration: false,
  maxTokens: 1800,
  model: "claude-haiku-4-5",
} satisfies Required<AgentConfig>;

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
    await agentTurn(messages, userConfig);
  }
};

const agentTurn = async (messages: MessageParam[], userConfig: AgentConfig) => {
  const cfg = { ...DEFAULT_CONFIG, userConfig };
  let iterationCount = 0;

  while (true) {
    if (iterationCount === cfg.toolIterationLimit) {
      console.log("Max number of iterations reached!!");
      return;
    } else if ( cfg.cycleWarnAtIteration && iterationCount >= cfg.cycleWarnAtIteration) {
      console.warn(
        `About to reach max amount of iteration: ${cfg.toolIterationLimit - cfg.cycleWarnAtIteration}%`,
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

    if (responseCheck(response) !== "continue") return response;

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
    // console.log(messages);
  }
};

const responseCheck = (res: Message) => {
  switch (res.stop_reason) {
    case "tool_use":
      return "continue";
    case "pause_turn":
      return "continue";
    case "end_turn":
    case "stop_sequence":
      return "done";
    case "max_tokens":
    case "refusal":
    case "model_context_window_exceeded":
      return "error";
    case null:
      return "error";
    default: {
      const exhaustive: never = res.stop_reason;
      throw new Error(`Unhandled stop_reason: ${exhaustive}`);
    }
  }
};

const getPercentage = (current: number, max: number): number => {
  return current / max;
};

await runAgent({});
