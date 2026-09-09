import type {
  ContentBlockParam,
  MessageParam,
} from "@anthropic-ai/sdk/resources";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { agentTurn } from "./agent.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sandboxPath = path.join(__dirname, "sandbox");

const messages: MessageParam[] = [];

type ChatEvent =
  | { role: string; type: "text"; text: string }
  | { role: string; type: "tool_use"; name: string; input: unknown }
  | { role: string; type: "tool_result"; content: string; isError: boolean };

const toEvents = (slice: MessageParam[]): ChatEvent[] => {
  const events: ChatEvent[] = [];
  for (const msg of slice) {
    if (!Array.isArray(msg.content)) continue;
    for (const block of msg.content as ContentBlockParam[]) {
      if (block.type === "text") {
        events.push({ role: msg.role, type: "text", text: block.text });
      } else if (block.type === "tool_use") {
        events.push({
          role: msg.role,
          type: "tool_use",
          name: block.name,
          input: block.input,
        });
      } else if (block.type === "tool_result") {
        events.push({
          role: msg.role,
          type: "tool_result",
          content:
            typeof block.content === "string"
              ? block.content
              : JSON.stringify(block.content),
          isError: block.is_error ?? false,
        });
      }
    }
  }
  return events;
};

const readBody = (req: http.IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });

const sendJson = (res: http.ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/api/messages") {
    sendJson(res, 200, { events: toEvents(messages) });
    return;
  }

  if (req.method === "POST" && req.url === "/api/chat") {
    try {
      const body = await readBody(req);
      const { message } = JSON.parse(body) as { message?: unknown };
      if (typeof message !== "string" || !message.trim()) {
        sendJson(res, 400, { error: "message is required" });
        return;
      }

      const turnStart = messages.length;
      messages.push({ role: "user", content: message });
      const result = await agentTurn(messages, {}, sandboxPath);

      sendJson(res, 200, {
        result,
        events: toEvents(messages.slice(turnStart)),
      });
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  sendJson(res, 404, { error: "not found" });
});

const port = Number(process.env.PORT ?? 3001);
server.listen(port, () => {
  console.log(`Agent server listening on http://localhost:${port}`);
});
