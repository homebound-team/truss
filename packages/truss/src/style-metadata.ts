/** Metadata key that carries a marker class through Truss style hashes. */
export const TRUSS_MARKER_KEY = "__marker";

/** Prefix for style-hash entries that append raw class names at runtime. */
export const TRUSS_CUSTOM_CLASS_PREFIX = "className_";

/** Prefix for style-hash entries that append raw inline styles at runtime. */
export const TRUSS_INLINE_STYLE_PREFIX = "style_";

/** Generated Css expressions include this brand marker in runtime-only paths. */
export const TRUSS_CSS_MARKER_KEY = "$css";
