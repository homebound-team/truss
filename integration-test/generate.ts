import { promises as fs } from "fs";
import { code, Code, imp, def } from "ts-poet";
import { borderColorRules } from "./border-colors";
import { borderRadiusRules } from "./border-radius";
import { borderRules } from "./borders";
import { boxShadowRules } from "./box-shadow";
import { coordinateRules } from "./coordinates";
import { aliases, increment, extras, outputPath } from "./config";
import { cursorRules } from "./cursor";
import { displayRules } from "./display";
import { flexboxRules } from "./flexbox";
import { heightRules } from "./heights";
import { outlineRules } from "./outlines";
import { positionRules } from "./position";
import { skinRules } from "./skins";
import { spacingRules } from "./spacing";
import { textAlignRules } from "./text-align";
import { textDecorationRules } from "./text-decoration";
import { typeScaleRules } from "./type-scale";
import { whitespaceRules } from "./white-space";
import { widthRules } from "./widths";
import { visibilityRules } from "./visibility";
import { makeAliases } from "./utils";

// Rules = record heights -> string[]
// Module Templates = record name --> Code
// Class templates = name --> Code

async function generate(): Promise<string> {
  const methods = [
    borderColorRules,
    borderRadiusRules,
    borderRules,
    boxShadowRules,
    coordinateRules,
    cursorRules,
    displayRules,
    flexboxRules,
    heightRules,
    outlineRules,
    positionRules,
    skinRules,
    spacingRules,
    textAlignRules,
    textDecorationRules,
    typeScaleRules,
    visibilityRules,
    whitespaceRules,
    widthRules,
    makeAliases(aliases),
  ].flat();
  return await wrap(methods).toStringWithImports();
}

async function write(): Promise<void> {
  const output = await generate();
  await fs.writeFile(outputPath, output);
}

export function wrap(methods: string[]): Code {
  const Properties = imp("Properties@csstype");
  return code`
/** Given a type X, and the user's proposed type X, only allow keys in X and nothing else. */
export type Only<X, T> = X & Record<Exclude<keyof T, keyof X>, never>;

export type ${def("Properties")} = ${Properties};

// prettier-ignore
class CssBuilder<T extends ${Properties}> {
  constructor(public rules: T, private enabled: boolean, private _important: boolean) {}

  ${methods.join("\n  ")}

  get $(): T { return maybeImportant(sortObject(this.rules), this._important); }
  
  if(t: boolean) { return new CssBuilder<T>(this.rules, t, this._important); }
  
  get else() { return new CssBuilder<T>(this.rules, !this.enabled, this._important); }

  get important() { return new CssBuilder<T>(this.rules, this.enabled, true); }

  /** Adds new properties, either a specific key/value, or a Properties object, the current css. */
  add<P extends Properties>(prop: P): CssBuilder<T & P>;
  add<K extends keyof Properties, V extends Properties[K]>(prop: K, value: V): CssBuilder<T & { [U in K]: V }>;
  add<K extends keyof Properties, V extends Properties[K]>(propOrProperties: K | Properties, value?: V): CssBuilder<any> {
    const newRules = typeof propOrProperties === "string" ?  { [propOrProperties]: value } : propOrProperties;
    const rules = this.enabled ? { ...this.rules, ...newRules } : this.rules;
    return new CssBuilder(rules as any, this.enabled, this._important);
  }

  /** Adds two properties at a time. */
  add2<
    K1 extends keyof Properties,
    V1 extends Properties[K1],
    K2 extends keyof Properties,
    V2 extends Properties[K2],
  >(prop1: K1, value1: V1, prop2: K2, value2: V2): CssBuilder<T & { [U in K1]: V1 } & { [U in K2]: V2 }> {
    const rules = this.enabled ? { ...this.rules, [prop1]: value1, [prop2]: value2 } : this.rules;
    return new CssBuilder(rules as any, this.enabled, this._important);
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
function px(inc: number | string): string {
  return typeof inc === "string" ? inc : \`\${spacing(inc)}px\`;
}

/** Converts \`inc\` into pixels. */
export function spacing(inc: number): number {
  return inc * ${increment};
}

/** An entry point for Css expressions. CssBuilder is immutable so this is safe to share. */
export const Css = new CssBuilder({}, true, false);

${extras}
  `;
}

write().then(
  () => console.log("done"),
  err => console.error(err),
);
