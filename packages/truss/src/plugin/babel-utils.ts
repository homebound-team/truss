import generate from "@babel/generator";
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";

export { generate, traverse };

/** Parse a TypeScript/JSX module with the plugin's standard parser options. */
export function parseModule(code: string, filename: string): t.File {
  return parse(code, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
    sourceFilename: filename,
  }) as t.File;
}
