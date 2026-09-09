import type { MessageParam } from "@anthropic-ai/sdk/resources";
import readline from "node:readline/promises";
import { exit, stdin as input, stdout } from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { agentTurn } from "./agent.js";
import type { AgentConfig } from "./lib/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sandboxPath = path.join(__dirname, "sandbox");

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
    const agentResponse = await agentTurn(messages, userConfig, sandboxPath);
    if (agentResponse.kind !== "done") {
      //logic for how im going to handle different cases
    }
  }
};

await runAgent({});
