import readline from "node:readline/promises";
import { exit, stdin as input, stdout } from "node:process";
import type { MessageParam } from "@anthropic-ai/sdk/resources";
import type { AgentConfig } from "./lib/types.js";
import { agentTurn } from "./agentTurn.js";
import { logToFile } from "./lib/logger.js";

export const runAgent = async (
  userConfig: AgentConfig,
  sandboxPath: string,
) => {
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
    logToFile(`agentResponse: ${JSON.stringify(agentResponse)}`);
    if (agentResponse.kind !== "done") {
      //logic for how im going to handle different cases
    }
  }
};
