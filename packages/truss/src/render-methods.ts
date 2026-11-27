import type { UtilityMethod } from "src/config";
import type { MethodDefinition } from "src/methods";

/**
 * Writes the `CssBuilder` member for one utility method, as a line of TypeScript.
 *
 * The web and React Native builders both use this, so each method is written one way. A string is
 * a method a custom section wrote by hand, and is written as-is.
 *
 * I.e. `{ abbr: "df", entry: { kind: "static", defs: { display: "flex" } } }` is written as
 * `/** Sets \`display: "flex"\`. *\/ get df() { return this.add("display", "flex"); }`.
 */
export function renderMethod(method: UtilityMethod): string {
  if (typeof method === "string") return method;
  const abbr = method.abbr;
  const entry = method.entry;
  switch (entry.kind) {
    case "static":
      return method.source?.kind === "cssVariables"
        ? cssVariablesSource(abbr, entry.defs)
        : `${comment(entry.defs)} get ${abbr}() { return this${addAll(entry.defs)}; }`;
    case "variable":
      return entry.incremented ? incrementedSource(abbr, entry.props) : paramSource(abbr, entry.props, entry.extraDefs);
    case "delegate":
      return pxSource(method, entry.target);
    case "alias":
      return `get ${abbr}() { return this${entry.chain.map((v) => `.${v}`).join("")}; }`;
    case "keyframe":
      return `/** Sets \`animation: ${entry.name} value\`. */\n ${abbr}(value: string) { return this.add("animation", \`${entry.name} \${value}\`); }`;
  }
}

/** The doc comment for a method, i.e. `/** Sets \`marginTop: "8px"\`. *\/`, where `value`/`px`/`inc` stay bare. */
export function comment(defs: object): string {
  const paramNames = ["value", "px", "inc"];
  const values = Object.entries(defs)
    .map(([prop, value]) => `${prop}: ${paramNames.includes(value) ? value : maybeWrap(value)}`)
    .join("; ");
  return `/** Sets \`${values}\`. */\n`;
}

/** I.e. `get dark() { return this.add("--primary" as any, "white"); }`, since csstype has no custom properties. */
function cssVariablesSource(abbr: string, defs: Record<string, unknown>): string {
  return `get ${abbr}() { return this${Object.entries(defs)
    .map(([prop, value]) => `.add("${prop}" as any, ${JSON.stringify(value)})`)
    .join("")}; }`;
}

/** I.e. `bgColor(value: Properties["backgroundColor"]) { return this.add("backgroundColor", value); }`. */
function paramSource(abbr: string, props: string[], extraDefs: Record<string, unknown> | undefined): string {
  // Only `newParamMethod` writes one, and it always has a single prop
  const prop = props[0];
  return `${comment({ [prop]: "value" })} ${abbr}(value: Properties["${prop}"]) { return this.add("${prop}", value)${addAll(extraDefs ?? {})}; }`;
}

/** I.e. `mt(v: number | string) { return this.add("marginTop", maybeInc(v)); }`. */
function incrementedSource(abbr: string, props: string[]): string {
  // `v` is not one of `comment`'s bare param names, so the comment quotes it, i.e. `marginTop: "v"`
  const valueComment = comment(Object.fromEntries(props.map((p) => [p, "v"])));
  return `${valueComment} ${abbr}(v: number | string) { return this.${props.map((p) => `add("${p}", maybeInc(v))`).join(".")}; }`;
}

/**
 * I.e. `mhPx(px: number) { return this.mh(...); }`, or `mtPx(px: number) { return this.add("marginTop", ...); }`.
 *
 * A `delegate` entry only names its target, so the props and the choice between the two come from
 * the method's `px` source.
 */
function pxSource(method: MethodDefinition, target: string): string {
  const source = method.source;
  if (source?.kind !== "px") throw new Error(`Cannot write "${method.abbr}": a delegate needs a "px" source.`);
  const pxComment = comment(Object.fromEntries(source.props.map((p) => [p, "px"])));
  const body = source.callsTarget
    ? `this.${target}(\`\${px}px\`)`
    : `this.${source.props.map((p) => `add("${p}", \`\${px}px\`)`).join(".")}`;
  return `${pxComment} ${method.abbr}(px: number) { return ${body}; }`;
}

/** I.e. `.add("display", "flex").add("order", 1)`. */
function addAll(defs: Record<string, unknown>): string {
  return Object.entries(defs)
    .map(([prop, value]) => `.add("${prop}", ${maybeWrap(value)})`)
    .join("");
}

/** Keeps numbers as literals, and emits anything else as an escaped double-quoted string literal. */
function maybeWrap(value: unknown): string {
  return typeof value === "number" ? String(value) : JSON.stringify(String(value));
}
