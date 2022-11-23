import { Properties } from "csstype";
import { promises as fs } from "fs";
import { code, Code, def, imp } from "ts-poet";
import { makeBreakpoints } from "src/breakpoints";
import { Config, SectionName, Sections, UtilityMethod } from "src/config";
import { newAliasesMethods } from "src/methods";
import { defaultSections } from "src/sections/tachyons";
import { quote } from "src/utils";
import { pascalCase } from "change-case";

export const defaultTypeAliases: Record<string, Array<keyof Properties>> = {
  Margin: ["margin", "marginTop", "marginRight", "marginBottom", "marginLeft"],
  Padding: ["padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft"],
};

export async function generate(config: Config): Promise<void> {
  const { outputPath } = config;
  const output = generateCssBuilder(config).toString();
  await fs.writeFile(outputPath, output);
}

function generateCssBuilder(config: Config): Code {
  const {
    aliases,
    fonts,
    increment,
    extras,
    typeAliases,
    breakpoints = {},
    palette,
    defaultMethods = "tachyons",
    sections: customSections,
  } = config;

  // Combine our out-of-the-box utility methods with any custom ones
  const sections: Record<string, string[]> = {
    // We only ship with tachyons methods currently
    ...(defaultMethods === "tachyons" ? generateMethods(config, defaultSections) : {}),
    ...(customSections ? generateMethods(config, customSections) : {}),
    ...(aliases && { aliases: newAliasesMethods(aliases) }),
  };

  const Properties = imp("Properties@csstype");

  const lines = Object.entries(sections)
    .map(([name, value]) => [`// ${name}`, ...value, ""])
    .flat();

  const typeAliasCode = Object.entries({
    ...defaultTypeAliases,
    ...typeAliases,
  }).map(([name, props]) => {
    return `export type ${name} = ${props.map(quote).join(" | ")};\n\n`;
  });

  const typographyType = code`
    export type ${def("Typography")} = ${Object.keys(fonts).map(quote).join(" | ")};
  `;

  const genBreakpoints = makeBreakpoints(breakpoints);

  const breakpointCode = [
    `export type Breakpoint = ${Object.keys(genBreakpoints).map(quote).join(" | ")};`,
    `export enum Breakpoints {
       ${Object.entries(genBreakpoints).map(([name, value]) => `${name} = "${value}"`)}
    };`,
  ];

  const breakpointIfs = Object.entries(genBreakpoints).map(([name, value]) => {
    return code`
      get if${pascalCase(name)}() {
        return this.newCss({ selector: ${quote(value)} });
      }`;
  });

  return code`
// This file is auto-generated by truss: https://github.com/homebound-team/truss.
// See your project's \`truss-config.ts\` to make configuration changes (fonts, increments, etc).

/** Given a type X, and the user's proposed type T, only allow keys in X and nothing else. */
export type Only<X, T> = X & Record<Exclude<keyof T, keyof X>, never>;

export type ${def("Properties")} = ${Properties}<string | 0, string>;

${typographyType}

type Opts<T> = {
  rules: T,
  enabled: boolean,
  important: boolean,
  selector: string | undefined
};

// dprint-ignore
class CssBuilder<T extends Properties> {
  constructor(private opts: Opts<T>) {}

  private get rules(): T { return this.opts.rules };
  private get enabled(): boolean { return this.opts.enabled };
  private get selector(): string | undefined { return this.opts.selector };
  private newCss(opts: Partial<Opts<T>>): CssBuilder<T> {
    return new CssBuilder({ ...this.opts, ...opts });
  }

  ${lines.join("\n  ").replace(/ +\n/g, "\n")}
  get $(): T { return maybeImportant(sortObject(this.rules), this.opts.important); }

  if(bp: Breakpoint): CssBuilder<T>;
  if(cond: boolean): CssBuilder<T>;
  if(arg: boolean | Breakpoint): CssBuilder<T> {
    if (typeof arg === "boolean") {
      return this.newCss({ enabled: arg });
    } else {
      return this.newCss({ selector: Breakpoints[arg] });
    }
  }

  get onHover() {
    return this.newCss({ selector: ":hover" });
  }
  
  ${breakpointIfs}

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
  addIn<P extends Properties>(selector: string, props: P | undefined): CssBuilder<T & P>;
  addIn<K extends keyof Properties>(selector: string, prop: K, value: Properties[K]): CssBuilder<T & { [U in K]: Properties[K] }>;
  addIn<K extends keyof Properties>(selector: string, propOrProperties: K | Properties, value?: Properties[K]): CssBuilder<any> {
    const newRules = typeof propOrProperties === "string" ?  { [propOrProperties]: value } : propOrProperties;
    if (newRules === undefined) {
      return this;
    }
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

export enum Palette {
  ${Object.entries(palette).map(([name, value]) => {
    return `${name} = "${value}",`;
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

/** Invokes all of the `MethodFns` to create actual `UtilityMethod`s. */
function generateMethods(config: Config, methodFns: Sections): Record<SectionName, UtilityMethod[]> {
  return Object.fromEntries(Object.entries(methodFns).map(([name, fn]) => [name, fn(config)]));
}
