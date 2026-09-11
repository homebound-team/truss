import { UnsupportedPatternError } from "./chain-nodes";

/** An entry name that is absent from the configured abbreviation mapping. */
export class UnknownAbbreviationError extends UnsupportedPatternError {
  constructor(abbreviation: string, candidates: string[]) {
    const suggestion = closestAbbreviation(abbreviation, candidates);
    super(`Unknown abbreviation "${abbreviation}"${suggestion ? `. Did you mean "${suggestion}"?` : ""}`);
  }
}

/**
 * Find the nearest mapping key within two insertions, deletions, or substitutions.
 * Each row stores exact Levenshtein distances for prefixes of one candidate.
 * I.e. abbreviation "acent" and candidate "accent" finish with distance 1.
 * Equal distances keep the first mapping key; unrelated names yield no suggestion.
 */
function closestAbbreviation(abbreviation: string, candidates: string[]): string | undefined {
  let closest: string | undefined;
  let bestDistance = 3;
  for (const candidate of candidates) {
    if (Math.abs(candidate.length - abbreviation.length) >= bestDistance) continue;
    let previous = Array.from({ length: candidate.length + 1 }, (_, index) => index);
    for (let i = 1; i <= abbreviation.length; i++) {
      const current = [i];
      for (let j = 1; j <= candidate.length; j++) {
        current[j] = Math.min(
          current[j - 1] + 1,
          previous[j] + 1,
          previous[j - 1] + (abbreviation[i - 1] === candidate[j - 1] ? 0 : 1),
        );
      }
      previous = current;
    }
    const distance = previous[candidate.length];
    if (distance < bestDistance) {
      closest = candidate;
      bestDistance = distance;
    }
  }
  return closest;
}
