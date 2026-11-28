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

/** A parsed @keyframes block extracted from an annotated truss.css file. */
export interface ParsedKeyframesBlock {
  cssText: string;
  /** The animation name, i.e. `spin`. */
  name: string;
}

/** A parsed arbitrary CSS block extracted from an annotated truss.css file. */
export interface ParsedArbitraryCssBlock {
  cssText: string;
}

/** The result of parsing an annotated truss.css file. */
export interface ParsedTrussCss {
  rules: ParsedCssRule[];
  properties: ParsedPropertyDeclaration[];
  keyframes: ParsedKeyframesBlock[];
  arbitraryCssBlocks: ParsedArbitraryCssBlock[];
}
