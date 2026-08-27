import fs from "node:fs/promises";
import { getResolvedPath } from "../utils.js";
import { defineTool, parseStringField } from "./tool.js";

export const readFileTool = defineTool({
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
  parse: (input) => ({ path: parseStringField(input, "path") }),
  run: async ({ path }, sandboxPath) => {
    return fs.readFile(getResolvedPath(path, sandboxPath), "utf8");
  },
});
