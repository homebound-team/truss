import { readFileSync } from "fs";
import { atRulePrelude, compareRuleSortKeys, ruleSortKey } from "../css-order";
import { annotateArbitraryCssBlock, parseTrussCss } from "../truss-css";
import type { ParsedArbitraryCssBlock, ParsedCssRule, ParsedPropertyDeclaration, ParsedTrussCss } from "../truss-css";

/**
 * Read and parse an annotated truss.css file from disk.
 *
 * Throws if the file doesn't exist or can't be read.
 */
export function readTrussCss(filePath: string): ParsedTrussCss {
  const content = readFileSync(filePath, "utf8");
  return parseTrussCss(content);
}

/**
 * Merge multiple parsed truss CSS sources into a single CSS string.
 *
 * Rules are deduplicated by class name (first occurrence wins, since
 * deterministic output means identical class names produce identical rules),
 * then sorted with the same comparator emit-css uses: priority, then media-query width, then class name.
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
    allArbitraryCssBlocks.push(...source.arbitraryCssBlocks);
  }

  // Sort exactly as emit-css does, so a merged stylesheet keeps the per-file cascade order
  const decorated = allRules.map((rule) => {
    return { rule, key: ruleSortKey(rule.priority, rule.className, atRulePrelude(rule.cssText)) };
  });
  decorated.sort((a, b) => compareRuleSortKeys(a.key, b.key));

  const lines: string[] = [];

  for (const entry of decorated) {
    lines.push(`/* @truss p:${entry.rule.priority} c:${entry.rule.className} */`);
    lines.push(entry.rule.cssText);
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
