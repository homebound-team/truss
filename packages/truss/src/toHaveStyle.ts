/** Supported style expectations for the matcher. */
export type StyleExpectation = string | Record<string, string | number>;

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
 * Assert that an element's computed style matches the provided CSS declarations.
 *
 * Static class-based styles are read via `getComputedStyle`, while CSS custom
 * properties are read directly from the element's inline style because jsdom
 * does not resolve them through computed styles.
 */
export function toHaveStyle(this: MatcherContext, received: unknown, expected: StyleExpectation): MatcherResult {
  if (!isElementLike(received)) {
    return {
      pass: false,
      message: () => `expected an Element, received ${printValue(this, "printReceived", received)}`,
    };
  }

  const expectedStyles = parseExpectedStyles(received, expected);
  const mismatches: string[] = [];

  for (const [property, expectedValue] of expectedStyles) {
    const actualValue = getActualStyleValue(received, property);
    if (actualValue !== expectedValue) {
      mismatches.push(`${property}: expected ${expectedValue}, received ${actualValue || "<empty>"}`);
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
  style?: CSSStyleDeclaration;
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

/** Normalize the expected style input into concrete CSS property/value pairs. */
function parseExpectedStyles(el: { ownerDocument: Document }, expected: StyleExpectation): Map<string, string> {
  const probe = el.ownerDocument.createElement("div");
  const styles = new Map<string, string>();

  if (typeof expected === "string") {
    probe.setAttribute("style", expected);
  } else {
    for (const [property, value] of Object.entries(expected)) {
      probe.style.setProperty(toKebabCase(property), String(value));
    }
  }

  for (const property of Array.from(probe.style)) {
    styles.set(property, probe.style.getPropertyValue(property).trim());
  }

  return styles;
}

/** Read the current value for a CSS property from the element under test. */
function getActualStyleValue(el: { style?: CSSStyleDeclaration; ownerDocument: Document }, property: string): string {
  if (property.startsWith("--")) {
    return el.style?.getPropertyValue(property).trim() ?? "";
  }

  return el.ownerDocument.defaultView!.getComputedStyle(el as Element).getPropertyValue(property).trim();
}
