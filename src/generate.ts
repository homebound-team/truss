import { promises as fs } from "fs";
import { Properties } from "csstype";
import { code, Code, def, imp } from "ts-poet";
import { defaultRuleFns, RuleConfig, RuleFn } from "./rules";
import { makeAliases, makeBreakpoints } from "./utils";

// Rules = record heights -> string[]
// Module Templates = record name --> Code
// Class templates = name --> Code

export type GenerateOpts = {
  /** The output path of the `Css.ts` file. */
  outputPath: string;

  /** The map of "section" to list of getters/methods, i.e. "border-colors" -> `get ml1() { ... }`. */
  methods: Record<string, string[]>;

  /** Your theme's increment, i.e. 6 or 8. */
  increment: number;

  /** Any extra chunks of code you want appended to the end of the file. */
  extras?: Array<string | Code>;

  /** Short-hand aliases like `bodyText` --> `["f12", "black"]`. */
  aliases?: Record<string, string[]>;

  /** Type aliases for Only clauses, i.e. `Margin` --> `["marginTop", ...]`. `Margin` and `Padding` are provided. */
  typeAliases?: Record<string, Array<keyof Properties>>;

  /** Breakpoints, i.e. `{ sm: 0, md: 500 }`. */
  breakpoints?: Record<string, number>;
};

export const defaultTypeAliases: Record<string, Array<keyof Properties>> = {
  Margin: ["margin", "marginTop", "marginRight", "marginBottom", "marginLeft"],
  Padding: [
    "padding",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
  ],
};

export async function generate(opts: GenerateOpts): Promise<void> {
  const { outputPath } = opts;
  const output = await generateCssBuilder(opts).toStringWithImports();
  await fs.writeFile(outputPath, output);
}

/** Give the user's config like colors/fonts/increments, generates the getters/methods from the ruleFns.
 *
 * Callers can optionally pass in their own `section -> RuleFn` `ruleFns` but we'll also default
 * to the out-of-the-box Tachyons-ish rules defined in `defaultRuleFns`.
 */
export function generateRules(
  ruleConfig: RuleConfig,
  ruleFns?: Record<string, RuleFn>
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(ruleFns || defaultRuleFns).map(([name, fn]) => [
      name,
      fn(ruleConfig),
    ])
  );
}

export function generateCssBuilder(opts: GenerateOpts): Code {
  const {
    aliases,
    methods,
    increment,
    extras,
    typeAliases,
    breakpoints,
  } = opts;

  const Properties = imp("Properties@csstype");

  const lines = Object.entries({
    ...methods,
    ...(aliases && { aliases: makeAliases(aliases) }),
  })
    .map(([name, value]) => [`// ${name}`, ...value, ""])
    .flat();

  const typeAliasCode = Object.entries({
    ...defaultTypeAliases,
    ...typeAliases,
  }).map(([name, props]) => {
    return `export type ${name} = ${props
      .map((p) => `"${p}"`)
      .join(" | ")};\n\n`;
  });

  let breakpointCode =
    breakpoints === undefined
      ? []
      : [
          "type Brand<K, T> = K & { __brand: T };",
          "type Breakpoint = Brand<string, 'Breakpoint'>;",
          ...Object.entries(makeBreakpoints(breakpoints || {})).map(
            ([name, query]) =>
              `export const ${name} = "${query}" as Breakpoint;`
          ),
        ];

  return code`
/** Given a type X, and the user's proposed type X, only allow keys in X and nothing else. */
export type Only<X, T> = X & Record<Exclude<keyof T, keyof X>, never>;

export type ${def("Properties")} = ${Properties};

// prettier-ignore
class CssBuilder<T extends ${Properties}> {
  constructor(
    public rules: T,
    private enabled: boolean,
    private _important: boolean,
    private selector: string | undefined
  ) {}

  ${lines.join("\n  ").replace(/ +\n/g, "\n")}
  get $(): T { return maybeImportant(sortObject(this.rules), this._important); }

  if(t: boolean | Breakpoint) {
    if (typeof t === "boolean") {
      return new CssBuilder<T>(this.rules, t, this._important, this.selector);
    } else {
      return new CssBuilder<T>(this.rules, this.enabled, this._important, t as string);
    }
  }

  get else() {
    if (this.selector !== undefined) {
      throw new Error("else is not supported with if(selector)");
    }
    return new CssBuilder<T>(this.rules, !this.enabled, this._important, this.selector);
  }

  get important() { return new CssBuilder<T>(this.rules, this.enabled, true, this.selector); }

  /** Adds new properties, either a specific key/value, or a Properties object, the current css. */
  add<P extends Properties>(prop: P): CssBuilder<T & P>;
  add<K extends keyof Properties, V extends Properties[K]>(prop: K, value: V): CssBuilder<T & { [U in K]: V }>;
  add<K extends keyof Properties, V extends Properties[K]>(propOrProperties: K | Properties, value?: V): CssBuilder<any> {
    const newRules = typeof propOrProperties === "string" ?  { [propOrProperties]: value } : propOrProperties;
    const rules = this.selector
      ? { ...this.rules, [this.selector]: { ...(this.rules as any)[this.selector], ...newRules } }
      : this.enabled ? { ...this.rules, ...newRules } : this.rules;
    return new CssBuilder(rules as any, this.enabled, this._important, this.selector);
  }
}

/** Emotion treats the same rules, ordered differently as different classes, but naively they can be the same. */
function sortObject<T extends object>(obj: T): T {
  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key as keyof T] = obj[key as keyof T];
      return acc;
    }, ({} as any) as T) as T;
}

/** Conditionally adds \`important!\` to everything. */
function maybeImportant<T extends object>(obj: T, important: boolean): T {
  if (important) {
    Object.keys(obj).forEach(key => {
      (obj as any)[key] = \`\${(obj as any)[key]} !important\`;
    });
  }
  return obj;
}

/** Converts \`inc\` into pixels value with a \`px\` suffix. */
export function maybeInc(inc: number | string): string {
  return typeof inc === "string" ? inc : \`\${increment(inc)}px\`;
}

/** Converts \`inc\` into pixels. */
export function increment(inc: number): number {
  return inc * ${increment};
}

/** Convert \`pixels\` to a \`px\` units string so it's not ambiguous. */
export function px(pixels: number): string {
  return \`\${pixels}px\`;
}

/** An entry point for Css expressions. CssBuilder is immutable so this is safe to share. */
export const Css = new CssBuilder({}, true, false, undefined);

${typeAliasCode}

${breakpointCode}

${extras || ""}
  `;
}
