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

  /** The app's palette, i.e. logical color name to hex. */
  palette: Record<string, string>;

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
    palette,
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
// This file is auto-generated by truss: https://github.com/homebound-team/truss.

/** Given a type X, and the user's proposed type T, only allow keys in X and nothing else. */
export type Only<X, T> = X & Record<Exclude<keyof T, keyof X>, never>;

export type ${def("Properties")} = ${Properties};

type Opts<T> = {
  rules: T,
  enabled: boolean,
  important: boolean,
  selector: string | undefined
};

// prettier-ignore
class CssBuilder<T extends ${Properties}> {
  constructor(private opts: Opts<T>) {}

  private get rules(): T { return this.opts.rules };
  private get enabled(): boolean { return this.opts.enabled };
  private get selector(): string | undefined { return this.opts.selector };
  private newCss(opts: Partial<Opts<T>>): CssBuilder<T> {
    return new CssBuilder({ ...this.opts, ...opts });
  }

  ${lines.join("\n  ").replace(/ +\n/g, "\n")}
  get $(): T { return maybeImportant(sortObject(this.rules), this.opts.important); }

  if(t: boolean | Breakpoint) {
    if (typeof t === "boolean") {
      return this.newCss({ enabled: t });
    } else {
      return this.newCss({ selector: t as string });
    }
  }

  get else() {
    if (this.selector !== undefined) {
      throw new Error("else is not supported with if(selector)");
    }
    return this.newCss({ enabled: !this.enabled });
  }

  get important() { return this.newCss({ important: true }); }

  /** Adds new properties, either a specific key/value or a Properties object, to the current css. */
  add<P extends Properties>(props: P): CssBuilder<T & P>;
  add<K extends keyof Properties>(prop: K, value: Properties[K]): CssBuilder<T & { [U in K]: Properties[K] }>;
  add<K extends keyof Properties>(propOrProperties: K | Properties, value?: Properties[K]): CssBuilder<any> {
    const newRules = typeof propOrProperties === "string" ?  { [propOrProperties]: value } : propOrProperties;
    const rules = this.selector
      ? { ...this.rules, [this.selector]: { ...(this.rules as any)[this.selector], ...newRules } }
      : this.enabled ? { ...this.rules, ...newRules } : this.rules;
    return this.newCss({ rules: rules as any });
  }

  /** Adds new properties, either a specific key/value or a Properties object, to a nested selector. */
  addIn<P extends Properties>(selector: string, props: P): CssBuilder<T & P>;
  addIn<K extends keyof Properties>(selector: string, prop: K, value: Properties[K]): CssBuilder<T & { [U in K]: Properties[K] }>;
  addIn<K extends keyof Properties>(selector: string, propOrProperties: K | Properties, value?: Properties[K]): CssBuilder<any> {
    const newRules = typeof propOrProperties === "string" ?  { [propOrProperties]: value } : propOrProperties;
    const rules = { ...this.rules, [selector]: { ...(this.rules as any)[selector], ...newRules } };
    return this.newCss({ rules: rules as any });
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

export const Palette = {
  ${Object.entries(palette).map(([name, value]) => {
    return `${name}: "${value}",`;
  })}
}

/** A shortcut for defining Xss types. */
export type Xss<P extends keyof Properties> = Pick<Properties, P>;

/** An entry point for Css expressions. CssBuilder is immutable so this is safe to share. */
export const Css = new CssBuilder({ rules: {}, enabled: true, important: false, selector: undefined });

${typeAliasCode}

${breakpointCode}

${extras || ""}
  `;
}
