import Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlock,
  ContentBlockParam,
  Message,
  MessageParam,
} from "@anthropic-ai/sdk/resources";
import readline from "node:readline/promises";
import fs from "node:fs/promises";
import { exit, stdin as input, stdout } from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sandboxPath = path.join(__dirname, "sandbox");
const client = new Anthropic();

const tools: Anthropic.Tool[] = [
  {
    name: "read_file",
    description:
      "Reads the content of a file. Paths are resolved relative to a sandboxed directory; absolute paths and paths that escape it (e.g. via '..') are rejected.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path file" },
      },
      required: ["path"],
    },
  },
  {
    name: "list_dir",
    description:
      "Return the list of files in a specified path. Paths are resolved relative to a sandboxed directory; absolute paths and paths that escape it (e.g. via '..') are rejected.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path" },
      },
      required: ["path"],
    },
  },
];

const getResolvedPath = (inputPath: string) => {
  const resolvedPath = path.resolve(sandboxPath, inputPath);
  const relPath = path.relative(sandboxPath, resolvedPath);

  if (relPath.startsWith("..") || path.isAbsolute(relPath))
    throw new Error(
      `Error, Access is restricted just to one directory, and the user is trying to reach a file or folder outside this directory`,
    );

  return resolvedPath;
};

const toolImpls = {
  read_file: async (inputPath: string): Promise<string> => {
    return fs.readFile(getResolvedPath(inputPath), "utf8");
  },

  list_dir: async (inputPath: string): Promise<string> => {
    return (await fs.readdir(getResolvedPath(inputPath))).join("\n");
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
      max_tokens: 100,
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
        if (!(tool.name in toolImpls)) {
          throw new Error(`Unknown tool: ${tool.name}`);
        }

        const name = tool.name as keyof typeof toolImpls;
        const { path: toolPath } = tool.input as { path: string };

        console.log(`→ ${tool.name}(${JSON.stringify(tool.input)})`);
        const output = await toolImpls[name](toolPath);
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
        console.log(`← ERROR: ${errorMsg}`);
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
