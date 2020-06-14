export type RuleFn = (config: RuleConfig) => string[];

export interface RuleConfig {
  /** A map from human name to color value, i.e. `black` -> `#000000`. */
  palette: Record<string, string>;

  /** A map from human name to font size, i.e. `f12` -> `12px`. */
  fonts: Record<string, string>;

  /** The number of increments to generate for rules like `mt1`, `mt2`, etc. */
  numberOfIncrements: number;
}
