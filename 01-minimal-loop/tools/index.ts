import type Anthropic from "@anthropic-ai/sdk";
import { listDirTool } from "./list-dir.js";
import { readFileTool } from "./read-file.js";
import type { ToolDef } from "./tool.js";

// Adding a tool = adding one entry here. Nothing else to keep in sync.
const tools: ToolDef<any>[] = [readFileTool, listDirTool];

export const toolSchemas: Anthropic.Tool[] = tools.map(
  ({ name, description, input_schema }) => ({ name, description, input_schema }),
);

export const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
