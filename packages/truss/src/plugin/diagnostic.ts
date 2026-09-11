import { type Node } from "@babel/types";

/** A compiler diagnostic with the source location used by build tools. */
export class Diagnostic extends Error {
  id: string;
  loc?: { file: string; line: number; column: number };

  constructor(message: string, filename: string, node: Node) {
    const start = node.loc?.start;
    const location = start ? `${filename}:${start.line}:${start.column + 1}` : filename;
    super(`${location}: ${message}`);
    this.id = filename;
    this.loc = start ? { file: filename, line: start.line, column: start.column } : undefined;
  }
}
