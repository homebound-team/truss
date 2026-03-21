import { parse } from "@babel/parser";
import * as t from "@babel/types";
import type { TrussMapping } from "./types";
import { resolveFullChain } from "./resolve-chain";
import { extractChain, findCssImportBinding } from "./ast-utils";
import { collectStaticStringBindings, resolveStaticString } from "./css-ts-utils";

/**
 * Transform a `.css.ts` file into a plain CSS string.
 *
 * The file is expected to have the shape:
 * ```ts
 * import { Css } from "./Css";
 * export const css = {
 *   ".some-selector": Css.df.blue.$,
 *   ".other > .selector": Css.mt(2).black.$,
 * };
 * ```
 *
 * Each key is a CSS selector (string literal), each value is a `Css.*.$` chain.
 * The chains are resolved via the truss mapping into concrete CSS declarations.
 *
 * Returns the generated CSS string.
 */
export function transformCssTs(code: string, filename: string, mapping: TrussMapping): string {
  const ast = parse(code, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
    sourceFilename: filename,
  });

  const cssBindingName = findCssImportBinding(ast);
  if (!cssBindingName) {
    return `/* [truss] ${filename}: no Css import found */\n`;
  }

  // Find the `export const css = { ... }` expression
  const cssExport = findNamedCssExportObject(ast);
  if (!cssExport) {
    return `/* [truss] ${filename}: expected \`export const css = { ... }\` with an object literal */\n`;
  }

  const rules: string[] = [];
  const stringBindings = collectStaticStringBindings(ast);

  for (const prop of cssExport.properties) {
    if (t.isSpreadElement(prop)) {
      rules.push(`/* [truss] unsupported: spread elements in css.ts export */`);
      continue;
    }

    if (!t.isObjectProperty(prop)) {
      rules.push(`/* [truss] unsupported: non-property in css.ts export */`);
      continue;
    }

    // Key must be a string literal (the CSS selector)
    const selector = objectPropertyStringKey(prop, stringBindings);
    if (selector === null) {
      rules.push(`/* [truss] unsupported: non-string-literal key in css.ts export */`);
      continue;
    }

    // Value must be a Css.*.$  expression
    const valueNode = prop.value;
    if (!t.isExpression(valueNode)) {
      rules.push(`/* [truss] unsupported: "${selector}" value is not an expression */`);
      continue;
    }

    const cssResult = resolveCssExpression(valueNode, cssBindingName, mapping, filename);
    if ("error" in cssResult) {
      rules.push(`/* [truss] unsupported: "${selector}" — ${cssResult.error} */`);
      continue;
    }

    rules.push(formatCssRule(selector, cssResult.declarations));
  }

  return rules.join("\n\n") + "\n";
}

/** Find the object expression in `export const css = { ... }`. */
function findNamedCssExportObject(ast: t.File): t.ObjectExpression | null {
  for (const node of ast.program.body) {
    if (!t.isExportNamedDeclaration(node) || !node.declaration) continue;
    if (!t.isVariableDeclaration(node.declaration)) continue;

    for (const declarator of node.declaration.declarations) {
      if (!t.isIdentifier(declarator.id, { name: "css" })) continue;
      const value = unwrapObjectExpression(declarator.init);
      if (value) return value;
    }
  }
  return null;
}

function unwrapObjectExpression(node: t.Expression | null | undefined): t.ObjectExpression | null {
  if (!node) return null;
  if (t.isObjectExpression(node)) return node;
  if (t.isTSAsExpression(node) || t.isTSSatisfiesExpression(node)) return unwrapObjectExpression(node.expression);
  return null;
}

/** Extract a static string key from an ObjectProperty. */
function objectPropertyStringKey(prop: t.ObjectProperty, stringBindings: Map<string, string>): string | null {
  if (t.isStringLiteral(prop.key)) return prop.key.value;
  // Allow unquoted identifiers as keys too (e.g. `body: Css.df.$`)
  if (t.isIdentifier(prop.key) && !prop.computed) return prop.key.name;
  if (prop.computed) return resolveStaticString(prop.key, stringBindings);
  return null;
}

interface CssResolution {
  declarations: Array<{ property: string; value: string }>;
  error?: undefined;
}
interface CssError {
  declarations?: undefined;
  error: string;
}

/**
 * Resolve a `Css.*.$` expression node to CSS declarations.
 *
 * Validates that the chain only uses static/literal patterns (no variable args,
 * no if/else conditionals, no pseudo/media modifiers).
 */
function resolveCssExpression(
  node: t.Expression,
  cssBindingName: string,
  mapping: TrussMapping,
  filename: string,
): CssResolution | CssError {
  // The expression must end with `.$`
  if (!t.isMemberExpression(node) || node.computed || !t.isIdentifier(node.property, { name: "$" })) {
    return { error: "value must be a Css.*.$  expression" };
  }

  const chain = extractChain(node.object, cssBindingName);
  if (!chain) {
    return { error: "could not extract Css chain from expression" };
  }

  // Validate: no if/else nodes
  for (const n of chain) {
    if (n.type === "if") return { error: "if() conditionals are not supported in .css.ts files" };
    if (n.type === "else") return { error: "else is not supported in .css.ts files" };
  }

  const resolved = resolveFullChain(chain, mapping);

  // Check for errors from resolution
  if (resolved.errors.length > 0) {
    return { error: resolved.errors[0] };
  }

  // Validate: no conditionals came back
  for (const part of resolved.parts) {
    if (part.type === "conditional") {
      return { error: "conditional chains are not supported in .css.ts files" };
    }
  }

  // Collect all declarations from all unconditional parts
  const declarations: Array<{ property: string; value: string }> = [];

  for (const part of resolved.parts) {
    if (part.type !== "unconditional") continue;
    for (const seg of part.segments) {
      if (seg.error) {
        return { error: seg.error };
      }

      // Reject segments that require runtime (dynamic with variable args)
      if (seg.dynamicProps && !seg.argResolved) {
        return { error: `dynamic value with variable argument is not supported in .css.ts files` };
      }
      if (seg.typographyLookup) {
        return { error: `typography() with a runtime key is not supported in .css.ts files` };
      }
      if (seg.styleArrayArg) {
        return { error: `add(cssProp) is not supported in .css.ts files` };
      }

      // Reject segments with media query / pseudo-class / pseudo-element / when modifiers
      if (seg.mediaQuery) {
        return { error: `media query modifiers (ifSm, ifMd, etc.) are not supported in .css.ts files` };
      }
      if (seg.pseudoClass) {
        return { error: `pseudo-class modifiers (onHover, onFocus, etc.) are not supported in .css.ts files` };
      }
      if (seg.pseudoElement) {
        return { error: `pseudo-element modifiers are not supported in .css.ts files` };
      }
      if (seg.whenPseudo) {
        return { error: `when() modifiers are not supported in .css.ts files` };
      }

      // Extract CSS property/value pairs from defs
      for (const [prop, value] of Object.entries(seg.defs)) {
        if (typeof value === "string" || typeof value === "number") {
          declarations.push({ property: camelToKebab(prop), value: String(value) });
        } else {
          // Nested condition objects (shouldn't happen after our validation, but defensive)
          return { error: `unexpected nested value for property "${prop}"` };
        }
      }
    }
  }

  return { declarations };
}

/** Convert a camelCase CSS property name to kebab-case. */
export function camelToKebab(s: string): string {
  // Handle vendor prefixes like WebkitTransform → -webkit-transform
  return s.replace(/^(Webkit|Moz|Ms|O)/, (m) => `-${m.toLowerCase()}`).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/** Format a CSS rule block. */
function formatCssRule(selector: string, declarations: Array<{ property: string; value: string }>): string {
  if (declarations.length === 0) {
    return `${selector} {}`;
  }
  const body = declarations.map((d) => `  ${d.property}: ${d.value};`).join("\n");
  return `${selector} {\n${body}\n}`;
}
