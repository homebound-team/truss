import { readFileSync } from "fs";

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
  arbitraryCssBlocks?: ParsedArbitraryCssBlock[];
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
 */
export function parseTrussCss(cssText: string): ParsedTrussCss {
  const lines = cssText.split("\n");
  const rules: ParsedCssRule[] = [];
  const properties: ParsedPropertyDeclaration[] = [];
  const arbitraryCssBlocks: ParsedArbitraryCssBlock[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Check for rule annotation
    const ruleMatch = RULE_ANNOTATION_RE.exec(line);
    if (ruleMatch) {
      const priority = parseFloat(ruleMatch[1]);
      const className = ruleMatch[2];
      // Next non-empty line is the CSS rule
      i++;
      while (i < lines.length && lines[i].trim() === "") i++;
      if (i < lines.length) {
        rules.push({ priority, className, cssText: lines[i].trim() });
      }
      i++;
      continue;
    }

    // Check for @property annotation
    if (PROPERTY_ANNOTATION_RE.test(line)) {
      i++;
      while (i < lines.length && lines[i].trim() === "") i++;
      if (i < lines.length) {
        const propLine = lines[i].trim();
        const varMatch = PROPERTY_VAR_RE.exec(propLine);
        if (varMatch) {
          properties.push({ cssText: propLine, varName: varMatch[1] });
        }
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

/**
 * Read and parse an annotated truss.css file from disk.
 *
 * Throws if the file doesn't exist or can't be read.
 */
export function readTrussCss(filePath: string): ParsedTrussCss {
  const content = readFileSync(filePath, "utf8");
  return parseTrussCss(content);
}

/** Wrap an arbitrary CSS block in annotations so it survives later Truss merges. */
export function annotateArbitraryCssBlock(cssText: string): string {
  const trimmed = cssText.trim();
  if (trimmed.length === 0) {
    return "";
  }
  return ["/* @truss arbitrary:start */", trimmed, "/* @truss arbitrary:end */"].join("\n");
}

/**
 * Merge multiple parsed truss CSS sources into a single CSS string.
 *
 * Rules are deduplicated by class name (first occurrence wins, since
 * deterministic output means identical class names produce identical rules),
 * then sorted by priority ascending with alphabetical class name tiebreaker.
 * @property declarations are deduplicated by variable name and appended next.
 * Arbitrary CSS blocks are left opaque and appended in source order at the end.
 */
export function mergeTrussCss(sources: ParsedTrussCss[]): string {
  const seenClasses = new Set<string>();
  const allRules: ParsedCssRule[] = [];
  const seenProperties = new Set<string>();
  const allProperties: ParsedPropertyDeclaration[] = [];
  const allArbitraryCssBlocks: ParsedArbitraryCssBlock[] = [];

  for (const source of sources) {
    for (const rule of source.rules) {
      if (!seenClasses.has(rule.className)) {
        seenClasses.add(rule.className);
        allRules.push(rule);
      }
    }
    for (const prop of source.properties) {
      if (!seenProperties.has(prop.varName)) {
        seenProperties.add(prop.varName);
        allProperties.push(prop);
      }
    }
    allArbitraryCssBlocks.push(...(source.arbitraryCssBlocks ?? []));
  }

  // Sort by priority ascending, tiebreak alphabetically by class name
  allRules.sort((a, b) => {
    const diff = a.priority - b.priority;
    if (diff !== 0) return diff;
    return a.className < b.className ? -1 : a.className > b.className ? 1 : 0;
  });

  const lines: string[] = [];

  for (const rule of allRules) {
    lines.push(`/* @truss p:${rule.priority} c:${rule.className} */`);
    lines.push(rule.cssText);
  }

  for (const prop of allProperties) {
    lines.push(`/* @truss @property */`);
    lines.push(prop.cssText);
  }

  for (const block of allArbitraryCssBlocks) {
    lines.push(annotateArbitraryCssBlock(block.cssText));
  }

  return lines.join("\n");
}
