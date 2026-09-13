import { type WebEntry } from "src/methods";

/**
 * Fails the build when two sections generate the same method name.
 *
 * Both methods land on `CssBuilder`, so `tsc` rejects the generated `Css.ts` with "Duplicate
 * identifier" and "Duplicate function implementation". `vite build` does not typecheck, so
 * without this check the broken file ships to any project that does not run `tsc` in CI.
 *
 * `entries` is what the method helpers collected while the sections ran, so each one already
 * knows the method name, the section it came from, and the config entry that spells it. A
 * section a custom section replaced never runs, so its methods are not in `entries` at all.
 *
 * I.e. `palette: { Bg: "var(--bg)" }` makes `get bg()` in `skins`, and the built-in `background`
 * section makes `bg(value)`, so we report ``duplicate method `bg` ``.
 */
export function checkForDuplicateMethods(entries: WebEntry[]): void {
  const owners = new Map<string, WebEntry>();
  const errors: string[] = [];

  for (const entry of entries) {
    // Some entries only give a mapping delegate a target, i.e. `sq` for `sqPx`, and cannot clash.
    if (entry.mappingOnly) continue;
    const owner = owners.get(entry.abbr);
    if (owner === undefined) {
      owners.set(entry.abbr, entry);
    } else {
      errors.push(duplicateMessage(entry.abbr, owner, entry));
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
function duplicateMessage(abbr: string, first: WebEntry, second: WebEntry): string {
  const [a, b] = fromConfig(second) && !fromConfig(first) ? [second, first] : [first, second];
  return `[truss] duplicate method \`${abbr}\`: ${describe(a)} and ${describe(b)} both generate it. ${fix(a, b)}`;
}

/** Whether the user's own config makes this method, i.e. it is theirs to rename. */
function fromConfig(entry: WebEntry): boolean {
  return entry.namedAfter !== undefined || entry.section.custom;
}

/** I.e. "palette entry `Bg`", "the alias `bodyText`", or "the `background` section". */
function describe(entry: WebEntry): string {
  if (!entry.namedAfter) return `the \`${entry.section.name}\` section`;
  const noun = entry.namedAfter.kind === "palette" ? "palette entry" : `the ${entry.namedAfter.kind}`;
  return `${noun} \`${entry.namedAfter.name}\``;
}

/** Tells the user what to change, which is only ever a source their own config spells. */
function fix(a: WebEntry, b: WebEntry): string {
  if (fromConfig(a) && fromConfig(b)) return "Rename one of them.";
  if (!fromConfig(a)) return `Override the \`${a.section.name}\` or \`${b.section.name}\` section.`;
  const target = a.namedAfter
    ? `the ${a.namedAfter.kind === "palette" ? "palette entry" : a.namedAfter.kind}`
    : `the method in your \`${a.section.name}\` section`;
  return `Rename ${target}, or override the \`${b.section.name}\` section.`;
}
