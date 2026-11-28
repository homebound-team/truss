import type { GeneratedSection, MethodDefinition, MethodSection } from "./methods";

/** A method and the section the generator called to get it. */
interface PlacedMethod {
  method: MethodDefinition;
  section: MethodSection;
}

/**
 * Fails the build when two sections generate the same method name.
 *
 * Both methods land on `CssBuilder`, so `tsc` rejects the generated `Css.ts` with "Duplicate
 * identifier" and "Duplicate function implementation". `vite build` does not typecheck, so
 * without this check the broken file ships to any project that does not run `tsc` in CI.
 *
 * `sections` is what the section functions returned, so each method already knows its name and
 * the config entry that spells it, and each section knows its own name.
 *
 * I.e. `palette: { Bg: "var(--bg)" }` makes `get bg()` in `skins`, and the built-in `background`
 * section makes `bg(value)`, so we report ``duplicate method `bg` ``.
 */
export function checkForDuplicateMethods(sections: GeneratedSection[]): void {
  const owners = new Map<string, PlacedMethod>();
  const errors: string[] = [];

  for (const generated of sections) {
    for (const method of generated.methods) {
      const placed = { method, section: generated.section };
      const owner = owners.get(method.abbr);
      if (owner === undefined) {
        owners.set(method.abbr, placed);
      } else {
        errors.push(duplicateMessage(method.abbr, owner, placed));
      }
    }
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));
}

/**
 * The error for one duplicate: the method, both sources, and the fix.
 *
 * The source the user configured is named first, because that is the one they recognize, i.e.
 * "palette entry `Bg` and the `background` section both generate it".
 */
function duplicateMessage(abbr: string, first: PlacedMethod, second: PlacedMethod): string {
  const [a, b] = fromConfig(second) && !fromConfig(first) ? [second, first] : [first, second];
  return `[truss] duplicate method \`${abbr}\`: ${describe(a)} and ${describe(b)} both generate it. ${fix(a, b)}`;
}

/** Whether the user's own config makes this method, i.e. it is theirs to rename. */
function fromConfig(placed: PlacedMethod): boolean {
  return placed.method.namedAfter !== undefined || placed.section.custom;
}

/** I.e. "palette entry `Bg`", "the alias `bodyText`", or "the `background` section". */
function describe(placed: PlacedMethod): string {
  const namedAfter = placed.method.namedAfter;
  if (!namedAfter) return `the \`${placed.section.name}\` section`;
  const noun = namedAfter.kind === "palette" ? "palette entry" : `the ${namedAfter.kind}`;
  return `${noun} \`${namedAfter.name}\``;
}

/** Tells the user what to change, which is only ever a source their own config spells. */
function fix(a: PlacedMethod, b: PlacedMethod): string {
  if (fromConfig(a) && fromConfig(b)) return "Rename one of them.";
  if (!fromConfig(a)) return `Override the \`${a.section.name}\` or \`${b.section.name}\` section.`;
  const namedAfter = a.method.namedAfter;
  const target = namedAfter
    ? `the ${namedAfter.kind === "palette" ? "palette entry" : namedAfter.kind}`
    : `the method in your \`${a.section.name}\` section`;
  return `Rename ${target}, or override the \`${b.section.name}\` section.`;
}
