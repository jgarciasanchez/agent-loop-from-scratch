import type Anthropic from "@anthropic-ai/sdk";

export type ToolDef<TInput> = {
  name: string;
  description: string;
  input_schema: Anthropic.Tool["input_schema"];
  parse: (input: unknown) => TInput;
  run: (input: TInput, sandboxPath: string) => Promise<string>;
};

export const defineTool = <TInput>(def: ToolDef<TInput>): ToolDef<TInput> =>
  def;

export const parseStringField = (input: unknown, field: string): string => {
  if (typeof input !== "object" || input === null || !(field in input)) {
    throw new Error(
      `Invalid tool input: expected an object with a "${field}" field`,
    );
  }

  const value = (input as Record<string, unknown>)[field];
  if (typeof value !== "string") {
    throw new Error(`Invalid tool input: "${field}" must be a string`);
  }

  return value;
};
