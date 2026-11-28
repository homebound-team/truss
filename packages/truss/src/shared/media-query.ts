/** Return the complementary query used by `Css.*.else` media branches. */
export function invertMediaQuery(query: string): string {
  const screenPrefix = "@media screen and ";
  if (query.startsWith(screenPrefix)) {
    const conditions = query.slice(screenPrefix.length).trim();
    const rangeMatch = conditions.match(/^\(min-width: (\d+)px\) and \(max-width: (\d+)px\)$/);
    if (rangeMatch) {
      const min = Number(rangeMatch[1]);
      const max = Number(rangeMatch[2]);
      return `@media screen and (max-width: ${min - 1}px), screen and (min-width: ${max + 1}px)`;
    }
    const minMatch = conditions.match(/^\(min-width: (\d+)px\)$/);
    if (minMatch) {
      return `@media screen and (max-width: ${Number(minMatch[1]) - 1}px)`;
    }
    const maxMatch = conditions.match(/^\(max-width: (\d+)px\)$/);
    if (maxMatch) {
      return `@media screen and (min-width: ${Number(maxMatch[1]) + 1}px)`;
    }
  }
  return query.replace("@media", "@media not");
}
