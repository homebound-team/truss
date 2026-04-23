import _generate from "@babel/generator";
import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import * as t from "@babel/types";

// Babel packages are CJS today; normalize default interop across loaders.
export const generate = ((_generate as unknown as { default?: typeof _generate }).default ?? _generate) as typeof _generate;
export const traverse = ((_traverse as unknown as { default?: typeof _traverse }).default ?? _traverse) as typeof _traverse;

/** Parse a TypeScript/JSX module with the plugin's standard parser options. */
export function parseModule(code: string, filename: string): t.File {
  return parse(code, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
    sourceFilename: filename,
  }) as t.File;
}
