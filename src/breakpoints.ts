/**
 * Turns a high-level `{ sm: 0, md: 200 }` breakpoint config into a continuous set of media queries.
 *
 * Note that these are not utility methods directly, but are used to generate the breakpoint
 * selectors that we pass to CSS-in-JS frameworks.
 */
export function makeBreakpoints(
  breakpoints: Record<string, number>
): Record<string, string> {
  const r: Record<string, string> = {
    print: "@media print",
  };
  const bps = Object.keys(breakpoints);
  Object.entries(breakpoints).forEach(([bp, px], i) => {
    const isFirst = i === 0;
    const isLast = i === bps.length - 1;
    // Calc this breakpoint's min/max, which is its px --> the next bp's px - 1
    const min = !isFirst ? `${px}px` : "0";
    const max = !isLast ? `${breakpoints[bps[i + 1]] - 1}px` : "0";

    // Make a rule for exactly this breakpoint, i.e. "just sm" or "just md".
    if (isFirst) {
      // Don't bother with min-width on the smallest bp
      r[bp] = `@media screen and (max-width:${max})`;
    } else if (isLast) {
      // Don't bother with max-width on the largest bp
      r[bp] = `@media screen and (min-width:${min})`;
    } else {
      r[bp] = `@media screen and (min-width:${min}) and (max-width:${max})`;
    }

    // Make combinations of neighbors, i.e. smOrMd or mdOrLg. We could go further, like smOrMdOrLg, but that seems excessive.
    if (!isFirst) {
      const isSecond = i === 1;
      const prevBp = bps[i - 1];
      const name = `${prevBp}Or${capitalize(bp)}`;
      let rule = "@media screen";
      // If we're the `firstOrSecond` combination, we can skip min-width.
      if (!isSecond) {
        const prevMin = breakpoints[bps[i - 1]];
        rule += ` and (min-width:${prevMin}px)`;
      }
      // If we're the `secondToLastOrLast` combination, we can skip max-width.
      if (!isLast) {
        rule += ` and (max-width:${max})`;
      }
      r[name] = rule;
    }

    // Make up/down variants for any "middle" breakpoints, i.e. `smUp` is "everything" and
    // `smDown` is "just sm", so skip both of those, and same for largest `lgUp`/`lgDown` bp.
    if (!isFirst && !isLast) {
      r[`${bp}AndUp`] = `@media screen and (min-width:${min})`;
      r[`${bp}AndDown`] = `@media screen and (max-width:${max})`;
    }
  });
  return r;
}

function capitalize(s: string): string {
  return `${s[0].toUpperCase()}${s.substring(1)}`;
}
