/** Supported style expectations for the matcher. */
export type StyleExpectation = Record<string, string | number>;

/** Minimal subset of Vitest's matcher context used for error formatting. */
type MatcherContext = {
  utils?: {
    printExpected?: (value: unknown) => string;
    printReceived?: (value: unknown) => string;
  };
};

/** Standard matcher result shape returned to Vitest. */
type MatcherResult = {
  pass: boolean;
  message: () => string;
};

/**
 * Match whole-value CSS variable references, i.e. `var(--color)` or
 * `var(--color, red)`.
 */
const wholeValueCssVariablePattern = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/;

let probe: HTMLDivElement | undefined;

/**
 * Assert that an element's computed style matches the provided CSS declarations.
 *
 * This matcher is for asserting concrete CSS properties like `color` or
 * `margin-top`, not raw custom properties like `--color`.
 *
 * In jsdom, computed styles sometimes leave values as `var(--token)` instead of
 * resolving them. We follow those references so `expect(el).toHaveStyle({ color:
 * "blue" })` still works for class rules like `.color_var { color: var(--color) }`.
 */
export function toHaveStyle(this: MatcherContext, received: unknown, expected: StyleExpectation): MatcherResult {
  if (!isElementLike(received)) {
    return {
      pass: false,
      message: () => `expected an Element, received ${printValue(this, "printReceived", received)}`,
    };
  }

  probe ??= received.ownerDocument.createElement("div");

  const expectedStyles = parseExpectedStyles(this, received, expected);
  const mismatches: string[] = [];
  for (const [property, expectedValue] of expectedStyles) {
    const actualValue = canonicalizeValue(probe, property, getActualStyleValue(received, property));
    const comparableExpectedValue = canonicalizeValue(probe, property, expectedValue);
    if (actualValue !== comparableExpectedValue) {
      mismatches.push(`${property}: expected ${comparableExpectedValue}, received ${actualValue || "<empty>"}`);
    }
  }

  return {
    pass: mismatches.length === 0,
    message: () => {
      const expectedLabel = printValue(this, "printExpected", expected);
      return mismatches.length === 0
        ? `expected element not to have style ${expectedLabel}`
        : `expected element to have style ${expectedLabel}\n${mismatches.join("\n")}`;
    },
  };
}

/** Format matcher values using Vitest's printers when available. */
function printValue(ctx: MatcherContext, kind: "printExpected" | "printReceived", value: unknown): string {
  return ctx.utils?.[kind]?.(value) ?? JSON.stringify(value);
}

/** Narrow an unknown matcher input to a DOM element-like object. */
function isElementLike(value: unknown): value is {
  ownerDocument: Document;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "ownerDocument" in value &&
    Boolean((value as { ownerDocument?: Document }).ownerDocument?.defaultView)
  );
}

/** Convert camelCase property names into CSS kebab-case. */
function toKebabCase(property: string): string {
  return property.startsWith("--") ? property : property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

/**
 * Normalize the expected style input into concrete CSS property/value pairs.
 *
 * Examples:
 * - `{ backgroundColor: "#526675" }` becomes `background-color: rgb(82, 102, 117)`
 *   so it compares cleanly with `getComputedStyle(...)`.
 * - `{ marginTop: 0 }` becomes `margin-top: 0px`/`0`, matching the browser's
 *   normalized CSS string output instead of the raw JS input.
 *
 * We do this by round-tripping through a real `CSSStyleDeclaration` on a probe
 * element instead of trying to hand-normalize CSS names and values ourselves.
 */
function parseExpectedStyles(
  ctx: MatcherContext,
  el: { ownerDocument: Document },
  expected: StyleExpectation,
): Map<string, string> {
  const probe = el.ownerDocument.createElement("div");
  for (const [property, value] of Object.entries(expected)) {
    if (property.startsWith("--")) {
      throw new Error(
        `toHaveStyle does not support custom property expectations like ${printValue(ctx, "printExpected", {
          [property]: value,
        })}; assert the custom property directly instead.`,
      );
    }
    probe.style.setProperty(toKebabCase(property), String(value));
  }
  const styles = new Map<string, string>();
  for (const property of Array.from(probe.style)) {
    styles.set(property, probe.style.getPropertyValue(property).trim());
  }
  return styles;
}

/**
 * Read the current value for a CSS property from the element under test.
 *
 * We intentionally read through `getComputedStyle(...)` because the matcher is
 * asserting the final applied property value, not whether the element happens
 * to have an inline style entry.
 *
 * Examples:
 * - `<div class="df" />` with `.df { display: flex }` should compare as
 *   `display: flex`, even though `el.style.display` is empty.
 * - `<div class="black" />` with `.black { color: #353535 }` should compare as
 *   `color: rgb(53, 53, 53)`, matching the browser's computed value.
 * - `<div class="color_var" style="--color: blue" />` with
 *   `.color_var { color: var(--color) }` should compare as `color: blue`;
 *   jsdom often returns `var(--color)` here, so we resolve that indirection
 *   immediately after reading the computed value.
 */
function getActualStyleValue(el: { style?: CSSStyleDeclaration; ownerDocument: Document }, property: string): string {
  const computedStyles = el.ownerDocument.defaultView!.getComputedStyle(el as Element);
  const actualValue = computedStyles.getPropertyValue(property).trim();
  return resolveWholeValueCssVariable(actualValue, computedStyles);
}

/**
 * Canonicalize a property/value pair through CSSOM serialization so equivalent
 * forms like `rgb(...)` and `rgba(..., 1)` compare equal.
 */
function canonicalizeValue(probe: HTMLElement, property: string, value: string): string {
  probe.style.cssText = "";
  probe.style.setProperty(property, value);
  return probe.style.getPropertyValue(property).trim() || value;
}

/**
 * Resolve a whole-value `var(--token)` reference using the element's current
 * custom properties. jsdom leaves these unresolved in many computed values.
 *
 * This is intentionally a single-hop lookup for cases like
 * `.color_var { color: var(--color) }` plus `el.style.setProperty("--color", "blue")`.
 */
function resolveWholeValueCssVariable(value: string, computedStyles: CSSStyleDeclaration): string {
  const match = value.match(wholeValueCssVariablePattern);
  if (!match) {
    return value;
  }
  const [, variableName, fallbackValue] = match;
  const resolvedValue = computedStyles.getPropertyValue(variableName).trim();
  return resolvedValue || fallbackValue?.trim() || value;
}
