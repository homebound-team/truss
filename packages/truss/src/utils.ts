export function lowerCaseFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.substr(1);
}

export function quote(s: string): string {
  return `"${s}"`;
}
