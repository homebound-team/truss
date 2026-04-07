import { useInsertionEffect } from "react";

/** A compact source label for a Truss CSS expression, used in debug mode. */
export class TrussDebugInfo {
  /** I.e. `"FileName.tsx:line"` */
  readonly src: string;

  constructor(src: string) {
    this.src = src;
  }
}

/**
 * Space-separated atomic class names, or a variable tuple with class names + CSS variable map.
 *
 * In debug mode, the transform appends a TrussDebugInfo as an extra tuple element:
 * - static with debug: `[classNames, debugInfo]`
 * - variable with debug: `[classNames, vars, debugInfo]`
 */
export type TrussStyleValue =
  | string
  | [classNames: string, vars: Record<string, string>]
  | [classNames: string, debugInfo: TrussDebugInfo]
  | [classNames: string, vars: Record<string, string>, debugInfo: TrussDebugInfo];

/** A property-keyed style hash where each key owns one logical CSS property. */
export type TrussCustomClassNameValue = string | ReadonlyArray<string | false | null | undefined>;
export type RuntimeStyleDeclarationValue = string | number | null | undefined;
export type TrussInlineStyleValue = Record<string, RuntimeStyleDeclarationValue> | false | null | undefined;
export type TrussStyleHash = Record<string, TrussStyleValue | TrussCustomClassNameValue | TrussInlineStyleValue>;
export type RuntimeStyleDeclarations = Record<string, RuntimeStyleDeclarationValue | Record<string, unknown>>;
export type RuntimeStyleCss = Record<string, RuntimeStyleDeclarations | string>;

const shouldValidateTrussStyleValues = resolveShouldValidateTrussStyleValues();
const shouldEmitTrussSrcAttribute = resolveShouldEmitTrussSrcAttribute();
const TRUSS_CSS_CHUNKS = "__trussCssChunks__";
let trussStyleElement: TrussStyleElement | null = null;

/** Merge one or more Truss style hashes into `{ className, style?, data-truss-src? }`. */
export function trussProps(
  ...hashes: ReadonlyArray<TrussStyleHash | false | null | undefined>
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};

  for (const hash of hashes) {
    if (!hash || typeof hash !== "object") continue;
    Object.assign(merged, hash);
  }

  const classNames: string[] = [];
  const inlineStyle: Record<string, unknown> = {};
  const debugSources: string[] = [];

  for (const [key, value] of Object.entries(merged)) {
    // $css is the Css expression marker — skip it
    if (key === "$css") continue;

    // __marker is a special key — its value is a marker class name, not a CSS property
    if (key === "__marker") {
      if (typeof value === "string") {
        classNames.push(value);
      }
      continue;
    }

    if (key.startsWith("className_")) {
      // I.e. plugin-emitted raw class names that should flow straight into the final prop.
      appendCustomClassNames(classNames, value);
      continue;
    }

    if (key.startsWith("style_")) {
      appendInlineStyles(inlineStyle, value);
      continue;
    }

    if (shouldValidateTrussStyleValues) assertValidTrussStyleValue(key, value);
    const trussValue = value as TrussStyleValue;

    if (typeof trussValue === "string") {
      // I.e. "df" or "black blue_h"
      classNames.push(trussValue);
      continue;
    }

    // Tuple: [classNames, varsOrDebug?, maybeDebug?]
    classNames.push(trussValue[0]);

    for (let i = 1; i < trussValue.length; i++) {
      const el = trussValue[i];
      if (el instanceof TrussDebugInfo) {
        debugSources.push(el.src);
      } else if (typeof el === "object" && el !== null) {
        Object.assign(inlineStyle, el);
      }
    }
  }

  const props: Record<string, unknown> = {
    className: classNames.join(" "),
  };

  if (Object.keys(inlineStyle).length > 0) {
    props.style = inlineStyle;
  }

  if (shouldEmitTrussSrcAttribute && debugSources.length > 0) {
    props["data-truss-src"] = [...new Set(debugSources)].join("; ");
  }

  return props;
}

function appendCustomClassNames(classNames: string[], value: unknown): void {
  if (typeof value === "string") {
    // I.e. `className_button: "button"`
    classNames.push(value);
    return;
  }

  if (!Array.isArray(value)) return;
  for (const entry of value) {
    if (typeof entry === "string") {
      // I.e. `className_button: ["button", cond && "selected"]`
      classNames.push(entry);
    }
  }
}

function appendInlineStyles(inlineStyle: Record<string, unknown>, value: unknown): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined || entry === null) {
      continue;
    }
    if (typeof entry === "string" || typeof entry === "number") {
      inlineStyle[key] = entry;
    }
  }
}

/** Merge explicit className/style with Truss style hashes. */
export function mergeProps(
  explicitClassName: string | undefined,
  explicitStyle: Record<string, unknown> | undefined,
  ...hashes: ReadonlyArray<TrussStyleHash | false | null | undefined>
): Record<string, unknown> {
  const result = trussProps(...hashes);

  if (explicitClassName) {
    result.className = `${explicitClassName} ${result.className ?? ""}`.trim();
  }

  if (explicitStyle) {
    result.style = { ...explicitStyle, ...(result.style as Record<string, unknown> | undefined) };
  }

  return result;
}

/**
 * Inject CSS text into the document for jsdom/test environments.
 *
 * In browser dev mode, CSS is served via the Vite virtual endpoint instead.
 */
export function __injectTrussCSS(cssText: string): void {
  if (typeof document === "undefined" || cssText.length === 0) return;

  const style = getOrCreateTrussStyleElement();

  // Track exact injected chunks on the style node so repeated execution of the
  // test bootstrap or transformed modules does not append duplicate CSS text.
  const injectedChunks = (style[TRUSS_CSS_CHUNKS] ??= new Set<string>());
  if (injectedChunks.has(cssText) || style.textContent?.includes(cssText)) {
    injectedChunks.add(cssText);
    return;
  }

  injectedChunks.add(cssText);
  style.textContent = (style.textContent ?? "") + cssText;
}

export interface RuntimeStyleProps {
  css: RuntimeStyleCss;
}

/**
 * Inject dynamic or selector-based CSS at runtime into a transient `<style>` tag.
 *
 * This is the runtime counterpart to `.css.ts` files:
 * - use `.css.ts` for static/global arbitrary selectors that should be baked into the build output
 * - use `RuntimeStyle` for selectors that depend on runtime values or should only exist while a component is mounted
 *
 * Example with a flat `Css` expression:
 * ```tsx
 * <RuntimeStyle
 *   css={{
 *     ".preview a": Css.blue.$,
 *   }}
 * />
 * ```
 *
 * Example with raw CSS via `Css.raw`:
 * ```tsx
 * <RuntimeStyle
 *   css={{
 *     ".preview code": Css.raw`
 *       font-variant-ligatures: none;
 *       text-decoration: underline;
 *     `,
 *   }}
 * />
 * ```
 *
 * The injected `<style>` element is appended on mount and removed on unmount.
 *
 * Note: Only flat `Css.*.$` expressions are supported here; selector/marker helpers like
 * `onHover`, `when`, `ifSm`, `ifContainer`, `element`, `className()`, and `style()` are rejected
 * at runtime.
 */
export function RuntimeStyle(props: RuntimeStyleProps): null {
  useRuntimeStyle(props.css);
  return null;
}

/**
 * Hook that injects dynamic or selector-based CSS at runtime into a transient `<style>` tag.
 *
 * This is the hook counterpart to the `RuntimeStyle` component and `.css.ts` files:
 * - use `.css.ts` for static/global arbitrary selectors baked into the build output
 * - use `useRuntimeStyle` when you need the same thing from a hook instead of a component
 *
 * Example with a flat `Css` expression:
 * ```ts
 * useRuntimeStyle({ "body": Css.mbPx(dynamicValue).$ });
 * ```
 *
 * Example with raw CSS via `Css.raw`:
 * ```ts
 * useRuntimeStyle({ ".preview code": Css.raw`font-variant-ligatures: none;` });
 * ```
 *
 * The injected `<style>` element is appended on mount and removed on unmount.
 *
 * Note: Only flat `Css.*.$` expressions are supported here; selector/marker helpers like
 * `onHover`, `when`, `ifSm`, `ifContainer`, `element`, `className()`, and `style()` are rejected
 * at runtime.
 */
export function useRuntimeStyle(css: RuntimeStyleCss): void {
  const cssText = buildRuntimeStyleCssText(css);
  useInsertionEffect(() => {
    if (typeof document === "undefined" || cssText.length === 0) return;
    const style = document.createElement("style");
    style.setAttribute("data-truss-runtime-style", "");
    style.textContent = cssText;
    document.head.appendChild(style);
    return () => style.remove();
  }, [cssText]);
}

/** Serialize RuntimeStyle rules into CSS text for a transient `<style>` tag. */
function buildRuntimeStyleCssText(css: RuntimeStyleCss): string {
  const rules: string[] = [];
  for (const [selector, value] of Object.entries(css)) {
    if (typeof value === "string") {
      rules.push(formatRawRuntimeStyleRule(selector, value));
    } else {
      rules.push(formatRuntimeStyleRule(selector, value));
    }
  }
  return rules.join("\n\n");
}

function formatRawRuntimeStyleRule(selector: string, raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return `${selector} {}`;
  const body = trimmed
    .split("\n")
    .map((line) => `  ${line.trim()}`)
    .filter((line) => line.trim().length > 0)
    .join("\n");
  return `${selector} {\n${body}\n}`;
}

function formatRuntimeStyleRule(selector: string, declarations: RuntimeStyleDeclarations): string {
  const lines: string[] = [];
  for (const [property, value] of Object.entries(declarations)) {
    if (property === "$css") continue;
    if (value === undefined || value === null) continue;
    if (typeof value !== "string" && typeof value !== "number") {
      throw new Error(runtimeStyleUnsupportedValueMessage(selector, property));
    }
    lines.push(`  ${camelToKebabRuntime(property)}: ${String(value)};`);
  }
  if (lines.length === 0) return `${selector} {}`;
  return `${selector} {\n${lines.join("\n")}\n}`;
}

function runtimeStyleUnsupportedValueMessage(selector: string, property: string): string {
  return `RuntimeStyle selector \`${selector}\` has an unsupported nested value for \`${property}\`. Only flat Css expressions can be used here; selector/marker/className helpers like onHover, when, ifSm, ifContainer, element, className(), and style() are not supported.`;
}

function camelToKebabRuntime(property: string): string {
  return property
    .replace(/^(Webkit|Moz|Ms|O)/, function prefixToCss(prefix) {
      return `-${prefix.toLowerCase()}`;
    })
    .replace(/[A-Z]/g, function upperToCss(letter) {
      return `-${letter.toLowerCase()}`;
    });
}

/** Fail fast when `trussProps` receives a non-Truss style value. */
function assertValidTrussStyleValue(key: string, value: unknown): asserts value is TrussStyleValue {
  if (typeof value === "string") return;
  if (Array.isArray(value) && typeof value[0] === "string") {
    for (let i = 1; i < value.length; i++) {
      const el = value[i];
      if (el instanceof TrussDebugInfo) continue;
      if (typeof el === "object" && el !== null && !Array.isArray(el)) continue;
      throw new TypeError(invalidTrussStyleValueMessage(key));
    }
    return;
  }
  throw new TypeError(invalidTrussStyleValueMessage(key));
}

function invalidTrussStyleValueMessage(key: string): string {
  return `Invalid Truss style value for \`${key}\`. trussProps only accepts generated Truss style hashes; use mergeProps for explicit className/style merging.`;
}

/** Enable validation in dev/test environments, but skip it in production. */
function resolveShouldValidateTrussStyleValues(): boolean {
  if (typeof process !== "undefined" && typeof process.env.NODE_ENV === "string") {
    return process.env.NODE_ENV !== "production";
  }
  const viteEnv = (import.meta as ImportMeta & { env?: { DEV?: boolean; PROD?: boolean } }).env;
  if (typeof viteEnv?.DEV === "boolean") return viteEnv.DEV;
  if (typeof viteEnv?.PROD === "boolean") return !viteEnv.PROD;
  return false;
}

/** Omit unstable source labels from rendered props during Vitest runs. */
function resolveShouldEmitTrussSrcAttribute(): boolean {
  if (typeof process !== "undefined" && typeof process.env.VITEST === "string") {
    return false;
  }
  return true;
}

function getOrCreateTrussStyleElement(): TrussStyleElement {
  const id = "data-truss";
  if (trussStyleElement?.ownerDocument === document && trussStyleElement.isConnected) {
    return trussStyleElement;
  }

  const style = (document.querySelector(`style[${id}]`) as TrussStyleElement | null) ?? document.createElement("style");
  if (!style.isConnected) {
    style.setAttribute(id, "");
    document.head.appendChild(style);
  }
  trussStyleElement = style;
  return trussStyleElement;
}

type TrussStyleElement = HTMLStyleElement & {
  [TRUSS_CSS_CHUNKS]?: Set<string>;
};
