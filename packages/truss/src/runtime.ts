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
export type TrussStyleHash = Record<string, TrussStyleValue>;

const shouldValidateTrussStyleValues = resolveShouldValidateTrussStyleValues();

/** Merge one or more Truss style hashes into `{ className, style?, data-truss-src? }`. */
export function trussProps(
  ...hashes: ReadonlyArray<TrussStyleHash | false | null | undefined>
): Record<string, unknown> {
  const merged: Record<string, TrussStyleValue> = {};

  for (const hash of hashes) {
    if (!hash || typeof hash !== "object") continue;
    Object.assign(merged, hash);
  }

  const classNames: string[] = [];
  const inlineStyle: Record<string, string> = {};
  const debugSources: string[] = [];

  for (const [key, value] of Object.entries(merged)) {
    if (shouldValidateTrussStyleValues) assertValidTrussStyleValue(key, value);

    // __marker is a special key — its value is a marker class name, not a CSS property
    if (key === "__marker") {
      if (typeof value === "string") {
        classNames.push(value);
      }
      continue;
    }

    if (typeof value === "string") {
      // I.e. "df" or "black blue_h"
      classNames.push(value);
      continue;
    }

    // Tuple: [classNames, varsOrDebug?, maybeDebug?]
    classNames.push(value[0]);

    for (let i = 1; i < value.length; i++) {
      const el = value[i];
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

  if (debugSources.length > 0) {
    props["data-truss-src"] = [...new Set(debugSources)].join("; ");
  }

  return props;
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
  if (typeof document === "undefined") return;

  const id = "data-truss";
  let style = document.querySelector(`style[${id}]`) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.setAttribute(id, "");
    document.head.appendChild(style);
  }

  // Append if not already present (dedupe across HMR re-executions)
  if (!style.textContent?.includes(cssText)) {
    style.textContent = (style.textContent ?? "") + cssText;
  }
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
  if (typeof viteEnv?.DEV === "boolean") {
    return viteEnv.DEV;
  }
  if (typeof viteEnv?.PROD === "boolean") {
    return !viteEnv.PROD;
  }
  return false;
}
