import Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlock,
  ContentBlockParam,
  Message,
  MessageParam,
} from "@anthropic-ai/sdk/resources";
import readline from "node:readline/promises";
import { exit, stdin as input, stdout } from "node:process";

const client = new Anthropic();

const tools: Anthropic.Tool[] = [
  {
    name: "read_file",
    description: "Reads the content of a file",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path file" },
      },
      required: ["path"],
    },
  },
  {
    name: "check_file",
    description: "Check for the existence of a file",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path file" },
      },
      required: ["path"],
    },
  },
];

const toolImpls = {
  read_file: async (path: string): Promise<string> => {
    if (path === "index.ts") {
      return "lorem ipsum";
    }
    return "error";
  },

  check_file: async (path: string): Promise<string> => {
    if (path === "index.ts") {
      return "true";
    }
    return "false";
  },
};

const runAgent = async () => {
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
    await agentTurn(messages);
  }
};

const agentTurn = async (messages: MessageParam[]) => {
  while (true) {
    const response: Message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      tools,
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

    messages.push({ role: "assistant", content: response.content });

    if (responseCheck(response) !== "continue") return response;

    const toolUses = response.content.filter(
      (x: ContentBlock): x is Anthropic.ToolUseBlock => x.type === "tool_use",
    );

    const toolResponses: Array<ContentBlockParam> = [];

    for (const tool of toolUses) {
      try {
        if (!(tool.name in toolImpls)) {
          throw new Error(`Unknown tool: ${tool.name}`);
        }

        const name = tool.name as keyof typeof toolImpls;
        const { path } = tool.input as { path: string };
        const output = await toolImpls[name](path);

        toolResponses.push({
          type: "tool_result",
          tool_use_id: tool.id,
          content: output,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
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

await runAgent();
