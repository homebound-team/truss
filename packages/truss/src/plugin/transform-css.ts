import { parse } from "@babel/parser";
import * as t from "@babel/types";
import type { TrussMapping } from "./types";
import { resolveFullChain } from "./resolve-chain";
import { extractChain, findCssImportBinding } from "./ast-utils";
import { collectStaticStringBindings, resolveStaticString } from "./css-ts-utils";
import { camelToKebab } from "./emit-truss";

/**
 * Transform a `.css.ts` file into a plain CSS string.
 *
 * The file is expected to have the shape:
 * ```ts
 * import { Css } from "./Css";
 * export const css = {
 *   ".some-selector": Css.df.blue.$,
 *   ".other > .selector": Css.mt(2).black.$,
 *   body: `
 *     margin: 0;
 *     font-size: 14px !important;
 *   `,
 * };
 * ```
 *
 * Each key is a CSS selector (string literal), each value is either a `Css.*.$`
 * chain or a string literal / template literal containing raw CSS declarations.
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

  // Css import is optional — only needed when Css.*.$  chains are used
  const cssBindingName = findCssImportBinding(ast);

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

    const valueNode = prop.value;

    // String literal or template literal → pass through as raw CSS
    const rawCss = extractStaticStringValue(valueNode, cssBindingName);
    if (rawCss !== null) {
      rules.push(formatRawCssRule(selector, rawCss));
      continue;
    }

    // Otherwise value must be a Css.*.$  expression
    if (!t.isExpression(valueNode)) {
      rules.push(`/* [truss] unsupported: "${selector}" value is not an expression */`);
      continue;
    }

    if (!cssBindingName) {
      rules.push(`/* [truss] unsupported: "${selector}" — Css.*.$  chain requires a Css import */`);
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

/**
 * Extract a static string from a StringLiteral, a no-expression TemplateLiteral,
 * or a `Css.raw` tagged template literal (i.e. `Css.raw\`...\``).
 */
function extractStaticStringValue(node: t.Node, cssBindingName: string | null): string | null {
  if (t.isStringLiteral(node)) return node.value;
  if (t.isTemplateLiteral(node) && node.expressions.length === 0 && node.quasis.length === 1) {
    return node.quasis[0].value.cooked ?? node.quasis[0].value.raw;
  }
  // Css.raw`...` tagged template literal
  if (
    t.isTaggedTemplateExpression(node) &&
    t.isMemberExpression(node.tag) &&
    !node.tag.computed &&
    t.isIdentifier(node.tag.property, { name: "raw" }) &&
    t.isIdentifier(node.tag.object, { name: cssBindingName ?? "" }) &&
    node.quasi.expressions.length === 0 &&
    node.quasi.quasis.length === 1
  ) {
    return node.quasi.quasis[0].value.cooked ?? node.quasi.quasis[0].value.raw;
  }
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

      // Reject segments that require runtime (variable with variable args)
      if (seg.variableProps && !seg.argResolved) {
        return { error: `variable value with variable argument is not supported in .css.ts files` };
      }
      if (seg.typographyLookup) {
        return { error: `typography() with a runtime key is not supported in .css.ts files` };
      }
      if (seg.styleArrayArg) {
        return { error: `add(cssProp) is not supported in .css.ts files` };
      }
      if (seg.styleArg) {
        return { error: `style() is not supported in .css.ts files` };
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

/** Format a CSS rule block from a raw CSS string, passed through as-is. */
function formatRawCssRule(selector: string, raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return `${selector} {}`;
  // Indent each non-empty line by two spaces
  const body = trimmed
    .split("\n")
    .map((line) => `  ${line.trim()}`)
    .filter((line) => line.trim().length > 0)
    .join("\n");
  return `${selector} {\n${body}\n}`;
}

/** Format a CSS rule block. */
function formatCssRule(selector: string, declarations: Array<{ property: string; value: string }>): string {
  if (declarations.length === 0) {
    return `${selector} {}`;
  }
  const body = declarations.map((d) => `  ${d.property}: ${d.value};`).join("\n");
  return `${selector} {\n${body}\n}`;
}
