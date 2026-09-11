import { readFileSync } from "fs";
import { atRulePrelude, compareRuleSortKeys, ruleSortKey } from "../css-order";
import { parseTrussCss, serializeTrussCss } from "./truss-css";
import type {
  ParsedArbitraryCssBlock,
  ParsedCssRule,
  ParsedKeyframesBlock,
  ParsedPropertyDeclaration,
  ParsedTrussCss,
} from "../truss-css";

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
 * Merge multiple parsed truss CSS sources into structured CSS.
 *
 * Rules are deduplicated by class name (first occurrence wins, since
 * deterministic output means identical class names produce identical rules),
 * then sorted with the same comparator emit-css uses: priority, then media-query width, then class name.
 * @property declarations are deduplicated by variable name and appended next, then @keyframes
 * blocks by animation name. Arbitrary CSS blocks are left opaque and appended in source order at
 * the end.
 */
export function mergeTrussCssData(sources: ParsedTrussCss[]): ParsedTrussCss {
  const seenClasses = new Set<string>();
  const allRules: ParsedCssRule[] = [];
  const seenProperties = new Set<string>();
  const allProperties: ParsedPropertyDeclaration[] = [];
  const seenKeyframes = new Set<string>();
  const allKeyframes: ParsedKeyframesBlock[] = [];
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
    for (const block of source.keyframes) {
      if (!seenKeyframes.has(block.name)) {
        seenKeyframes.add(block.name);
        allKeyframes.push(block);
      }
    }
    allArbitraryCssBlocks.push(...source.arbitraryCssBlocks);
  }

  // Sort exactly as emit-css does, so a merged stylesheet keeps the per-file cascade order
  const decorated = allRules.map((rule) => {
    return { rule, key: ruleSortKey(rule.priority, rule.className, atRulePrelude(rule.cssText)) };
  });
  decorated.sort((a, b) => compareRuleSortKeys(a.key, b.key));

  return {
    rules: decorated.map((entry) => entry.rule),
    properties: allProperties,
    keyframes: allKeyframes,
    arbitraryCssBlocks: allArbitraryCssBlocks,
  };
}

/** Merge and serialize annotated Truss CSS with the first source winning duplicate names. */
export function mergeTrussCss(sources: ParsedTrussCss[]): string {
  return serializeTrussCss(mergeTrussCssData(sources));
}
