import { UnsupportedPatternError } from "./chain-nodes";
import type { TrussMapping } from "./types";
import { closestName } from "./unknown-abbreviation";

/**
 * Every keyword the `animation` shorthand accepts besides the animation name.
 *
 * The set is closed by the CSS grammar, so checking against it is exact rather than a heuristic:
 * anything left over in an `animation` value is a `<custom-ident>`, which can only be a keyframe name.
 */
const ANIMATION_KEYWORDS = new Set([
  // CSS-wide
  "inherit",
  "initial",
  "unset",
  "revert",
  "revert-layer",
  // <single-animation-iteration-count>, <single-animation-name>, <single-animation-fill-mode>
  "infinite",
  "none",
  "forwards",
  "backwards",
  "both",
  // <single-animation-direction>
  "normal",
  "reverse",
  "alternate",
  "alternate-reverse",
  // <single-animation-play-state>
  "running",
  "paused",
  // <easing-function>
  "linear",
  "ease",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "step-start",
  "step-end",
  // <single-animation-timeline>
  "auto",
]);

/** I.e. `1s`, `0.8s`, `100ms`, `3`, `.5` — a time or an iteration count, never a name. */
const NUMERIC_TOKEN_RE = /^[+-]?(\d+\.?\d*|\.\d+)(m?s)?$/;

/**
 * Reject an `animation` or `animation-name` value that names a keyframe `config.keyframes` does not
 * declare, the same way a mistyped abbreviation is rejected.
 *
 * I.e. `Css.animation("spinn 1s linear infinite")` with `spin` configured fails the build with
 * `Unknown keyframes "spinn". Did you mean "spin"?`.
 *
 * The check runs only once a project declares keyframes in config, so a project that has not adopted
 * the feature keeps its raw `@keyframes` blocks working. Once it has, every animation name must come
 * from config — a body the typed form cannot express goes in as a `keyframes` string instead of a raw
 * block, so there is still one registry of names.
 *
 * A value is skipped when it interpolates a runtime expression, since the name is not knowable.
 */
export function validateAnimationValue(props: string[], value: string, mapping: TrussMapping): void {
  const configured = mapping.keyframes;
  if (!configured || Object.keys(configured).length === 0) return;
  if (!props.some((prop) => ANIMATION_PROPERTIES.has(prop))) return;
  if (value.includes("var(")) return;

  for (const rawToken of value.trim().split(/[\s,]+/)) {
    // A name may also be written as a string, i.e. `animation-name: "spin"`.
    const token = rawToken.replace(/^["']|["']$/g, "");
    if (token.length === 0) continue;
    // Functions (`steps(4)`), dashed idents (`--my-timeline`), times, and counts are never names.
    if (token.includes("(") || token.includes(")") || token.startsWith("--")) continue;
    if (NUMERIC_TOKEN_RE.test(token)) continue;
    if (ANIMATION_KEYWORDS.has(token.toLowerCase())) continue;
    if (Object.hasOwn(configured, token)) continue;
    throw new UnknownKeyframesError(token, Object.keys(configured));
  }
}

/** The properties whose value can name a keyframe, in both the camelCase and CSS spellings. */
const ANIMATION_PROPERTIES = new Set(["animation", "animationName", "animation-name"]);

/** An animation name that is absent from `config.keyframes`. */
export class UnknownKeyframesError extends UnsupportedPatternError {
  constructor(name: string, candidates: string[]) {
    const suggestion = closestName(name, candidates);
    super(
      `Unknown keyframes "${name}" - add it to config.keyframes${suggestion ? `. Did you mean "${suggestion}"?` : ""}`,
    );
  }
}
