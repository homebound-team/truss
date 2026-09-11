export function lowerCaseFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.substr(1);
}

/** A double-quoted JS string literal for `s`, escaping quotes and backslashes, i.e. `[data-state="open"]`. */
export function quote(s: string): string {
  return JSON.stringify(s);
}

/** I.e. `"backgroundColor"` → `"background-color"`, `"WebkitTransform"` → `"-webkit-transform"`. */
export function camelToKebab(s: string): string {
  return s.replace(/^(Webkit|Moz|Ms|O)/, (m) => `-${m.toLowerCase()}`).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
