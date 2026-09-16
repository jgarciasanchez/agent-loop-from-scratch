import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAgent } from "./runAgent.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sandboxPath = path.join(__dirname, "sandbox");

await runAgent({}, sandboxPath);
