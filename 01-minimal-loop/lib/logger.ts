import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logFilePath = path.join(__dirname, "..", "agent.log");
const divider =
  "-----------------------------------------------------------------------------------------------------------------------------------------";

export const logToFile = (message: string): void => {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logFilePath, `[${timestamp}] ${message}\n${divider}\n`);
};
