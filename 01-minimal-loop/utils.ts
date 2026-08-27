import path from "node:path";

export const getResolvedPath = (inputPath: string, sandboxPath: string) => {
  const resolvedPath = path.resolve(sandboxPath, inputPath);
  const relPath = path.relative(sandboxPath, resolvedPath);

  if (relPath.startsWith("..") || path.isAbsolute(relPath))
    throw new Error(
      `Error, Access is restricted just to one directory, and the user is trying to reach a file or folder outside this directory`,
    );

  return resolvedPath;
};
