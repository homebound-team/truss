export function hasCssDeclaration(el: HTMLElement, property: string, opts: { hover: boolean }): boolean {
  return getCssRulesForElement(el).some((rule) => {
    const isHoverRule = rule.selectorText.includes(":hover");
    if (opts.hover !== isHoverRule) return false;
    return rule.style.getPropertyValue(property).trim().length > 0;
  });
}

function getCssRulesForElement(el: HTMLElement): CSSStyleRule[] {
  const classes = el.className.split(/\s+/).filter(Boolean);
  const rules: CSSStyleRule[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      collectStyleRules(sheet.cssRules, rules);
    } catch {
      // Ignore stylesheets that are not readable in jsdom.
    }
  }
  return rules.filter((rule) => classes.some((className) => rule.selectorText.includes(`.${className}`)));
}

function collectStyleRules(ruleList: CSSRuleList, out: CSSStyleRule[]): void {
  for (const rule of Array.from(ruleList)) {
    if (rule.type === CSSRule.STYLE_RULE) {
      out.push(rule as CSSStyleRule);
      continue;
    }
    if ("cssRules" in rule) {
      collectStyleRules((rule as CSSGroupingRule).cssRules, out);
    }
  }
}
