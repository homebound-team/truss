import { type KeyframesConfig, type TokenDefinition, type TokenRegistry } from "src/config";
import { camelToKebab } from "src/utils";

/**
 * The CSS custom property a token names, for either form of `config.tokens`.
 *
 * I.e. `"--theme-primary"` → `"--theme-primary"`, and
 * `{ var: "--angle", syntax: "<angle>" }` → `"--angle"`.
 */
export function tokenVarName(token: TokenRegistry[string]): string {
  return typeof token === "string" ? token : token.var;
}

/** The registration half of a token, or undefined for the string form, which only names it. */
export function tokenDefinition(token: TokenRegistry[string]): TokenDefinition | undefined {
  return typeof token === "string" ? undefined : token;
}

/** Token member name → CSS custom property, i.e. `{ Angle: "--angle" }`, for both token forms. */
export function tokenVarNames(tokens: TokenRegistry | undefined): Record<string, string> {
  const names: Record<string, string> = {};
  for (const [name, token] of Object.entries(tokens ?? {})) {
    names[name] = tokenVarName(token);
  }
  return names;
}

/**
 * CSS custom property → its `@property` block, for the tokens that declare a `syntax`.
 *
 * I.e. `{ "--angle": '@property --angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }' }`.
 *
 * Throws when a non-universal syntax has no `initialValue`: the browser drops the whole `@property`
 * rule in that case, so the token would silently keep behaving as an unregistered one.
 */
export function tokenPropertyBlocks(tokens: TokenRegistry | undefined): Record<string, string> {
  const blocks: Record<string, string> = {};
  for (const [name, token] of Object.entries(tokens ?? {})) {
    const definition = tokenDefinition(token);
    if (!definition) continue;
    if (definition.syntax !== "*" && definition.initialValue === undefined) {
      throw new Error(
        `Token "${name}" has syntax ${JSON.stringify(definition.syntax)} but no initialValue. ` +
          `@property requires an initial value for every syntax except "*".`,
      );
    }
    blocks[definition.var] = propertyCssText(definition);
  }
  return blocks;
}

/** I.e. `@property --angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }`. */
export function propertyCssText(definition: TokenDefinition): string {
  const descriptors = [`syntax: ${JSON.stringify(definition.syntax)}`, `inherits: ${definition.inherits ?? false}`];
  if (definition.initialValue !== undefined) {
    descriptors.push(`initial-value: ${definition.initialValue}`);
  }
  return `@property ${definition.var} { ${descriptors.join("; ")}; }`;
}

/**
 * Keyframe name → its `@keyframes` block, i.e. `{ spin: "@keyframes spin { to { … } }" }`.
 *
 * A name declared as `null` is defined by some other stylesheet, so it maps to an empty block: the
 * plugin still accepts the name in an animation value, and writes nothing for it.
 */
export function keyframesBlocks(keyframes: KeyframesConfig | undefined): Record<string, string> {
  const blocks: Record<string, string> = {};
  for (const [name, frames] of Object.entries(keyframes ?? {})) {
    blocks[name] = frames === null ? "" : keyframesCssText(name, frames);
  }
  return blocks;
}

/**
 * I.e. `("spin", { to: { transform: "rotate(360deg)" } })` → `@keyframes spin { to { transform: rotate(360deg); } }`.
 *
 * Values are written as authored, so numbers stay unitless — a keyframe body is literal CSS, not a
 * Truss increment. The string form is a raw body and is passed through with its whitespace collapsed.
 */
export function keyframesCssText(name: string, frames: NonNullable<KeyframesConfig[string]>): string {
  if (typeof frames === "string") {
    return `@keyframes ${name} { ${frames.trim().replace(/\s+/g, " ")} }`;
  }
  const steps = Object.entries(frames).map(([selector, properties]) => {
    const declarations = Object.entries(properties)
      .filter((entry) => entry[1] !== undefined)
      .map((entry) => `${camelToKebab(entry[0])}: ${entry[1]};`)
      .join(" ");
    return `${selector} { ${declarations} }`;
  });
  return `@keyframes ${name} { ${steps.join(" ")} }`;
}
