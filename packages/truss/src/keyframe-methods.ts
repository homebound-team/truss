import { camelCase, pascalCase } from "change-case";
import { makeBreakpoints } from "src/breakpoints";
import { type Config, type UtilityMethod } from "src/config";
import { newKeyframeMethod } from "src/methods";
import { TRUSS_PSEUDO_METHODS } from "src/pseudo-selectors";

/**
 * A `Css.<keyframe>(value)` method for every `config.keyframes` entry, i.e.
 * `Css.sweep("1.6s linear infinite")` instead of ``Css.animation(`${Keyframes.Sweep} 1.6s linear infinite`)``.
 *
 * The method only puts the name in front of the value, so the rest of the animation shorthand is
 * written as usual, and two animations still go through `Css.animation`, which takes the whole value.
 *
 * `taken` is every abbreviation the other sections already generated; see `keyframeAbbreviation`.
 */
export function newKeyframesMethods(config: Config, taken: Set<string>): UtilityMethod[] {
  const names = Object.keys(config.keyframes ?? {});
  if (names.length === 0) return [];
  const used = new Set([...taken, ...reservedMethodNames(config)]);
  return names.map((name) => {
    const abbr = keyframeAbbreviation(name, used);
    used.add(abbr);
    return newKeyframeMethod(abbr, name);
  });
}

/**
 * The method name for a keyframe: its camelCase name, or `animate<Name>` when that name is taken.
 *
 * I.e. `sweep` → `sweep` and `fade-in` → `fadeIn`, but a keyframe named `pre` → `animatePre`,
 * because `Css.pre` already sets `white-space: pre`. Keyframe names are the project's own, so the
 * fallback keeps a new keyframe from quietly replacing a utility method or an alias.
 *
 * Both names being taken needs a rename, since there is no third name to fall back on.
 */
function keyframeAbbreviation(name: string, used: Set<string>): string {
  const camel = camelCase(name);
  if (!used.has(camel)) return camel;
  const prefixed = `animate${pascalCase(name)}`;
  if (!used.has(prefixed)) return prefixed;
  throw new Error(
    `Keyframes "${name}" cannot have a Css method: "${camel}" and "${prefixed}" are both already taken. ` +
      `Rename the keyframe.`,
  );
}

/**
 * The `CssBuilder` members a keyframe method must not shadow: the chain builtins, the pseudo-class
 * getters, and the breakpoint getters, i.e. `ifSm`.
 */
function reservedMethodNames(config: Config): string[] {
  return [
    ...BUILDER_METHODS,
    ...Object.keys(TRUSS_PSEUDO_METHODS),
    ...Object.keys(makeBreakpoints(config.breakpoints ?? {})).map((name) => `if${pascalCase(name)}`),
  ];
}

/** The non-abbreviation members of the generated `CssBuilder`. */
const BUILDER_METHODS = [
  "$",
  "add",
  "className",
  "element",
  "else",
  "end",
  "if",
  "ifContainer",
  "ifPrint",
  "marker",
  "markerOf",
  "newCss",
  "newMarker",
  "props",
  "raw",
  "setVar",
  "style",
  "typography",
  "when",
  "with",
];
