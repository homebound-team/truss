/** A parsed CSS rule extracted from an annotated truss.css file. */
export interface ParsedCssRule {
  priority: number;
  className: string;
  cssText: string;
}

/** A parsed @property declaration extracted from an annotated truss.css file. */
export interface ParsedPropertyDeclaration {
  cssText: string;
  /** The variable name, i.e. `--marginTop`. */
  varName: string;
}

/** A parsed arbitrary CSS block extracted from an annotated truss.css file. */
export interface ParsedArbitraryCssBlock {
  cssText: string;
}

/** The result of parsing an annotated truss.css file. */
export interface ParsedTrussCss {
  rules: ParsedCssRule[];
  properties: ParsedPropertyDeclaration[];
  arbitraryCssBlocks: ParsedArbitraryCssBlock[];
}

/** Regex matching `/* @truss p:<priority> c:<className> *\/` annotations. */
const RULE_ANNOTATION_RE = /^\/\* @truss p:([\d.]+) c:(\S+) \*\/$/;

/** Regex matching `/* @truss @property *\/` annotations. */
const PROPERTY_ANNOTATION_RE = /^\/\* @truss @property \*\/$/;

/** Regex matching the start of an annotated arbitrary CSS block. */
const ARBITRARY_START_RE = /^\/\* @truss arbitrary:start \*\/$/;

/** Regex matching the end of an annotated arbitrary CSS block. */
const ARBITRARY_END_RE = /^\/\* @truss arbitrary:end \*\/$/;

/** Regex to extract the variable name from `@property --foo { ... }`. */
const PROPERTY_VAR_RE = /^@property\s+(--\S+)/;

/**
 * Parse an annotated truss.css file into rules, @property declarations,
 * and arbitrary CSS blocks.
 *
 * The file must contain `/* @truss p:<priority> c:<className> *\/` comments
 * before each CSS rule, and `/* @truss @property *\/` before each @property declaration.
 * Unannotated lines are ignored.
 */
export function parseTrussCss(cssText: string): ParsedTrussCss {
  const lines = cssText.split("\n");
  const rules: ParsedCssRule[] = [];
  const properties: ParsedPropertyDeclaration[] = [];
  const arbitraryCssBlocks: ParsedArbitraryCssBlock[] = [];

  let i = 0;

  /** Advance past the current annotation line and any blank lines to the annotated content line. */
  function takeAnnotatedLine(): string | null {
    i++;
    while (i < lines.length && lines[i].trim() === "") i++;
    return i < lines.length ? lines[i].trim() : null;
  }

  while (i < lines.length) {
    const line = lines[i].trim();

    // Check for rule annotation
    const ruleMatch = RULE_ANNOTATION_RE.exec(line);
    if (ruleMatch) {
      const cssText = takeAnnotatedLine();
      if (cssText !== null) {
        rules.push({ priority: parseFloat(ruleMatch[1]), className: ruleMatch[2], cssText });
      }
      i++;
      continue;
    }

    // Check for @property annotation
    if (PROPERTY_ANNOTATION_RE.test(line)) {
      const propLine = takeAnnotatedLine();
      const varMatch = propLine === null ? null : PROPERTY_VAR_RE.exec(propLine);
      if (propLine !== null && varMatch) {
        properties.push({ cssText: propLine, varName: varMatch[1] });
      }
      i++;
      continue;
    }

    if (ARBITRARY_START_RE.test(line)) {
      i++;
      const blockLines: string[] = [];
      while (i < lines.length && !ARBITRARY_END_RE.test(lines[i].trim())) {
        blockLines.push(lines[i]);
        i++;
      }
      const blockText = blockLines.join("\n").trim();
      if (blockText.length > 0) {
        arbitraryCssBlocks.push({ cssText: blockText });
      }
      if (i < lines.length && ARBITRARY_END_RE.test(lines[i].trim())) {
        i++;
      }
      continue;
    }

    i++;
  }

  return { rules, properties, arbitraryCssBlocks };
}

/** Wrap an arbitrary CSS block in annotations so it survives later Truss merges. */
export function annotateArbitraryCssBlock(cssText: string): string {
  const trimmed = cssText.trim();
  if (trimmed.length === 0) {
    return "";
  }
  return ["/* @truss arbitrary:start */", trimmed, "/* @truss arbitrary:end */"].join("\n");
}
