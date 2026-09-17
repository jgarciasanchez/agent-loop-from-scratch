import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logFilesPath = path.join(__dirname, "..", '/logs');
const divider =
  "-----------------------------------------------------------------------------------------------------------------------------------------";

export const logToFile = (message: string, newLog = false): void => {
  const timestamp = new Date().toISOString();
  if (newLog) {
    const newLogName = path.join(logFilesPath, timestamp);
    console.log(newLogName);
    
    fs.writeFileSync(newLogName, `[${timestamp}] ${message}\n${divider}\n`);
  } else {
    const lastLog = fs.readdirSync(logFilesPath).sort().at(-1);
    if (!lastLog) {
      throw new Error(`No log file found in ${logFilesPath} to append to.`);
    }
    fs.appendFileSync(
      path.join(logFilesPath, lastLog),
      `[${timestamp}] ${message}\n${divider}\n`,
    );
  }
};
