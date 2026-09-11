import type { ParsedTrussCss } from "../truss-css";
import type { TrussMapping } from "./types";

/**
 * Writes the `@property` and `@keyframes` blocks that `config.tokens` and `config.keyframes` declare.
 *
 * The rule for whether a configured at-rule prunes:
 *
 * > Truss prunes a configured at-rule when pruning pays for itself: the block has to be big enough
 * > to matter, and the usage the build cannot resolve statically has to be rare enough that the
 * > conservative fallback does not fire constantly.
 *
 * Keyframe bodies are unbounded, and only an `animation` value built at runtime hides a name, so
 * keyframes prune. An `@property` block is one line, and any non-px runtime value could be a token,
 * so pruning registrations would usually be a no-op — registration is unconditional. Neither at-rule
 * is unknowable; each function below says why its half comes out the way it does.
 */

/** I.e. `animation: spin 0.8s linear infinite` and `animation-name: spin, pulse` → the whole value. */
const ANIMATION_VALUE_RE = /\banimation(?:-name)?\s*:\s*([^;}]+)/g;

/**
 * Add the configured `@keyframes` blocks this CSS still names, so a keyframe prunes with the rules
 * that animate it: deleting the last rule that names it deletes the block.
 *
 * Names are read out of the emitted CSS text rather than out of the resolved chains, because an
 * animation reaches the stylesheet from several directions — a `Css.animation` value, a
 * `Css.add("animationName", …)`, and raw `Css.raw` blocks in a `.css.ts`.
 *
 * A name can still hide: `Css.animation(motion)` compiles to `animation: var(--animation)` and leaves
 * the name in the JS bundle. That is detectable and unusual — only an `animation` value does it — so
 * it falls back to keeping every configured block.
 */
export function applyReferencedKeyframes(css: ParsedTrussCss, mapping: TrussMapping): void {
  const configured = mapping.keyframes ?? {};
  if (Object.keys(configured).length === 0) return;

  const cssTexts = [...css.rules.map((rule) => rule.cssText), ...css.arbitraryCssBlocks.map((block) => block.cssText)];
  const alreadyEmitted = new Set(css.keyframes.map((block) => block.name));
  for (const name of referencedKeyframes(cssTexts, Object.keys(configured))) {
    // An empty block is a name another stylesheet defines; Truss only accepts it, never writes it.
    if (alreadyEmitted.has(name) || configured[name].length === 0) continue;
    css.keyframes.push({ name, cssText: configured[name] });
  }
}

/**
 * Add the `@property` block of every registered token, once, to the whole stylesheet.
 *
 * Registration does not prune, and not because the usage cannot be seen. `Css.bc(Tokens.Angle)`
 * resolves to `Tokens.Angle` during chain resolution, so `collectAtomicRules` could hand the emitter
 * a set of referenced tokens the way it already hands it `needsMaybeCssVar`. Pruning is skipped
 * because it would not pay for itself. `maybeCssVar` exists so a `--token` can flow through a
 * runtime value, i.e. `Css.color(c)`, so any non-px runtime argument might be a token and would have
 * to fall back to keeping every registration — a fallback that fires for a great many real apps.
 * The saving would be one fixed line per unused token, and only the object form of `tokens` writes
 * one at all, so the cost of being wrong (a dropped registration silently stops an animation)
 * outweighs it.
 *
 * A registered token replaces the `syntax: "*"` block Truss writes for its own runtime variables, at
 * that block's position, so the typed form wins no matter which source the merge saw first. The
 * replacement is a new entry rather than an edit, because a merged stylesheet shares its declaration
 * objects with the cached library CSS they came from.
 */
export function applyRegisteredProperties(css: ParsedTrussCss, mapping: TrussMapping): void {
  const pending = new Map(Object.entries(mapping.properties ?? {}));
  if (pending.size === 0) return;

  for (let i = 0; i < css.properties.length; i++) {
    const varName = css.properties[i].varName;
    const cssText = pending.get(varName);
    if (cssText === undefined) continue;
    css.properties[i] = { varName, cssText };
    pending.delete(varName);
  }
  for (const [varName, cssText] of pending) {
    css.properties.push({ varName, cssText });
  }
}

/**
 * The configured keyframe names that some `animation` or `animation-name` declaration uses.
 *
 * An animation value built at runtime, i.e. `Css.animation(duration)`, reaches the stylesheet as
 * `animation: var(--animation)` and hides its name, so every configured keyframe is kept rather than
 * pruning one the browser will ask for. Literal values still prune exactly.
 */
function referencedKeyframes(cssTexts: string[], names: string[]): string[] {
  if (names.length === 0) return [];
  const referenced = new Set<string>();
  for (const cssText of cssTexts) {
    for (const match of cssText.matchAll(ANIMATION_VALUE_RE)) {
      if (match[1].includes("var(")) return names;
      for (const token of match[1].trim().split(/[\s,]+/)) referenced.add(token);
    }
  }
  return names.filter((name) => referenced.has(name));
}
