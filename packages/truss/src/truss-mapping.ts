/**
 * The shape of the Css.json mapping file consumed by the Vite plugin.
 *
 * The generator writes it and the plugin reads it, so both import it from here.
 */
export interface TrussMapping {
  increment: number;
  breakpoints?: Record<string, string>;
  typography?: string[];
  /** Token member name → CSS variable (from `config.tokens`), for `setVar` key resolution. */
  tokens?: Record<string, string>;
  /** CSS variable → its `@property` block, for the tokens `config.tokens` registers with a `syntax`. */
  properties?: Record<string, string>;
  /** Keyframe name → its `@keyframes` block (from `config.keyframes`). */
  keyframes?: Record<string, string>;
  abbreviations: Record<string, TrussMappingEntry>;
}

/**
 * A single abbreviation entry from `Css.json`.
 *
 * Each `kind` describes how the transformer should resolve that abbreviation.
 */
export type TrussMappingEntry =
  /** I.e. `{ "kind": "static", "defs": { "display": "flex" } }` for `Css.df.$`. */
  | { kind: "static"; defs: Record<string, unknown> }
  /** I.e. `{ "kind": "variable", "props": ["marginTop"], "incremented": true }` for `Css.mt(v).$`. */
  | { kind: "variable"; props: string[]; incremented: boolean; extraDefs?: Record<string, unknown> }
  /** I.e. `{ "kind": "delegate", "target": "mt" }` for `Css.mtPx(v).$`. */
  | { kind: "delegate"; target: string }
  /** I.e. `{ "kind": "alias", "chain": ["f14", "black"] }` for `Css.bodyText.$`. */
  | { kind: "alias"; chain: string[] }
  /** I.e. `{ "kind": "keyframe", "name": "sweep" }` for `Css.sweep("1.6s linear infinite").$`. */
  | { kind: "keyframe"; name: string };
