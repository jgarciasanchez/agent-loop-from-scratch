import fs from "node:fs/promises";
import { getResolvedPath } from "../utils.js";
import { defineTool, parseStringField } from "./tool.js";

export const listDirTool = defineTool({
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
  parse: (input) => ({ path: parseStringField(input, "path") }),
  run: async ({ path }, sandboxPath) => {
    return (await fs.readdir(getResolvedPath(path, sandboxPath))).join("\n");
  },
});
