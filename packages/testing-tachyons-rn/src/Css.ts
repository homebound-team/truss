import { Properties as Properties1 } from "csstype";

// This file is auto-generated by truss: https://github.com/homebound-team/truss.
// See your project's `truss-config.ts` to make configuration changes (fonts, increments, etc).

/** Given a type X, and the user's proposed type T, only allow keys in X and nothing else. */
export type Only<X, T> = X & Record<Exclude<keyof T, keyof X>, never>;

export type Properties = Properties1<string | 0, string>;

export type Typography = "f24" | "f18" | "f16" | "f14" | "f12" | "f10";

type Opts<T> = { rules: T; enabled: boolean; important: boolean; selector: string | undefined };

class CssBuilder<T extends Properties> {
  constructor(private opts: Opts<T>) {}

  private get rules(): T {
    return this.opts.rules;
  }
  private get enabled(): boolean {
    return this.opts.enabled;
  }
  private get selector(): string | undefined {
    return this.opts.selector;
  }
  private newCss(opts: Partial<Opts<T>>): CssBuilder<T> {
    return new CssBuilder({ ...this.opts, ...opts });
  }

  // spacing
  /** Sets `marginTop: "0px"`. */
  get mt0() {
    return this.add("marginTop", "0px");
  }
  /** Sets `marginTop: "8px"`. */
  get mt1() {
    return this.add("marginTop", "8px");
  }
  /** Sets `marginTop: "16px"`. */
  get mt2() {
    return this.add("marginTop", "16px");
  }
  /** Sets `marginTop: "24px"`. */
  get mt3() {
    return this.add("marginTop", "24px");
  }
  /** Sets `marginTop: "32px"`. */
  get mt4() {
    return this.add("marginTop", "32px");
  }
  /** Sets `marginTop: "auto"`. */
  get mta() {
    return this.add("marginTop", "auto");
  }
  /** Sets `marginTop: "v"`. */
  mt(v: number | string) {
    return this.add("marginTop", maybeInc(v));
  }
  /** Sets `marginTop: px`. */
  mtPx(px: number) {
    return this.add("marginTop", `${px}px`);
  }
  /** Sets `marginRight: "0px"`. */
  get mr0() {
    return this.add("marginRight", "0px");
  }
  /** Sets `marginRight: "8px"`. */
  get mr1() {
    return this.add("marginRight", "8px");
  }
  /** Sets `marginRight: "16px"`. */
  get mr2() {
    return this.add("marginRight", "16px");
  }
  /** Sets `marginRight: "24px"`. */
  get mr3() {
    return this.add("marginRight", "24px");
  }
  /** Sets `marginRight: "32px"`. */
  get mr4() {
    return this.add("marginRight", "32px");
  }
  /** Sets `marginRight: "auto"`. */
  get mra() {
    return this.add("marginRight", "auto");
  }
  /** Sets `marginRight: "v"`. */
  mr(v: number | string) {
    return this.add("marginRight", maybeInc(v));
  }
  /** Sets `marginRight: px`. */
  mrPx(px: number) {
    return this.add("marginRight", `${px}px`);
  }
  /** Sets `marginBottom: "0px"`. */
  get mb0() {
    return this.add("marginBottom", "0px");
  }
  /** Sets `marginBottom: "8px"`. */
  get mb1() {
    return this.add("marginBottom", "8px");
  }
  /** Sets `marginBottom: "16px"`. */
  get mb2() {
    return this.add("marginBottom", "16px");
  }
  /** Sets `marginBottom: "24px"`. */
  get mb3() {
    return this.add("marginBottom", "24px");
  }
  /** Sets `marginBottom: "32px"`. */
  get mb4() {
    return this.add("marginBottom", "32px");
  }
  /** Sets `marginBottom: "auto"`. */
  get mba() {
    return this.add("marginBottom", "auto");
  }
  /** Sets `marginBottom: "v"`. */
  mb(v: number | string) {
    return this.add("marginBottom", maybeInc(v));
  }
  /** Sets `marginBottom: px`. */
  mbPx(px: number) {
    return this.add("marginBottom", `${px}px`);
  }
  /** Sets `marginLeft: "0px"`. */
  get ml0() {
    return this.add("marginLeft", "0px");
  }
  /** Sets `marginLeft: "8px"`. */
  get ml1() {
    return this.add("marginLeft", "8px");
  }
  /** Sets `marginLeft: "16px"`. */
  get ml2() {
    return this.add("marginLeft", "16px");
  }
  /** Sets `marginLeft: "24px"`. */
  get ml3() {
    return this.add("marginLeft", "24px");
  }
  /** Sets `marginLeft: "32px"`. */
  get ml4() {
    return this.add("marginLeft", "32px");
  }
  /** Sets `marginLeft: "auto"`. */
  get mla() {
    return this.add("marginLeft", "auto");
  }
  /** Sets `marginLeft: "v"`. */
  ml(v: number | string) {
    return this.add("marginLeft", maybeInc(v));
  }
  /** Sets `marginLeft: px`. */
  mlPx(px: number) {
    return this.add("marginLeft", `${px}px`);
  }
  /** Sets `marginLeft: "0px"; marginRight: "0px"`. */
  get mx0() {
    return this.add("marginLeft", "0px").add("marginRight", "0px");
  }
  /** Sets `marginLeft: "8px"; marginRight: "8px"`. */
  get mx1() {
    return this.add("marginLeft", "8px").add("marginRight", "8px");
  }
  /** Sets `marginLeft: "16px"; marginRight: "16px"`. */
  get mx2() {
    return this.add("marginLeft", "16px").add("marginRight", "16px");
  }
  /** Sets `marginLeft: "24px"; marginRight: "24px"`. */
  get mx3() {
    return this.add("marginLeft", "24px").add("marginRight", "24px");
  }
  /** Sets `marginLeft: "32px"; marginRight: "32px"`. */
  get mx4() {
    return this.add("marginLeft", "32px").add("marginRight", "32px");
  }
  /** Sets `marginLeft: "auto"; marginRight: "auto"`. */
  get mxa() {
    return this.add("marginLeft", "auto").add("marginRight", "auto");
  }
  /** Sets `marginLeft: "v"; marginRight: "v"`. */
  mx(v: number | string) {
    return this.add("marginLeft", maybeInc(v)).add("marginRight", maybeInc(v));
  }
  /** Sets `marginLeft: px; marginRight: px`. */
  mxPx(px: number) {
    return this.add("marginLeft", `${px}px`).add("marginRight", `${px}px`);
  }
  /** Sets `marginTop: "0px"; marginBottom: "0px"`. */
  get my0() {
    return this.add("marginTop", "0px").add("marginBottom", "0px");
  }
  /** Sets `marginTop: "8px"; marginBottom: "8px"`. */
  get my1() {
    return this.add("marginTop", "8px").add("marginBottom", "8px");
  }
  /** Sets `marginTop: "16px"; marginBottom: "16px"`. */
  get my2() {
    return this.add("marginTop", "16px").add("marginBottom", "16px");
  }
  /** Sets `marginTop: "24px"; marginBottom: "24px"`. */
  get my3() {
    return this.add("marginTop", "24px").add("marginBottom", "24px");
  }
  /** Sets `marginTop: "32px"; marginBottom: "32px"`. */
  get my4() {
    return this.add("marginTop", "32px").add("marginBottom", "32px");
  }
  /** Sets `marginTop: "auto"; marginBottom: "auto"`. */
  get mya() {
    return this.add("marginTop", "auto").add("marginBottom", "auto");
  }
  /** Sets `marginTop: "v"; marginBottom: "v"`. */
  my(v: number | string) {
    return this.add("marginTop", maybeInc(v)).add("marginBottom", maybeInc(v));
  }
  /** Sets `marginTop: px; marginBottom: px`. */
  myPx(px: number) {
    return this.add("marginTop", `${px}px`).add("marginBottom", `${px}px`);
  }
  /** Sets `marginTop: "0px"; marginBottom: "0px"; marginRight: "0px"; marginLeft: "0px"`. */
  get m0() {
    return this.add("marginTop", "0px").add("marginBottom", "0px").add("marginRight", "0px").add("marginLeft", "0px");
  }
  /** Sets `marginTop: "8px"; marginBottom: "8px"; marginRight: "8px"; marginLeft: "8px"`. */
  get m1() {
    return this.add("marginTop", "8px").add("marginBottom", "8px").add("marginRight", "8px").add("marginLeft", "8px");
  }
  /** Sets `marginTop: "16px"; marginBottom: "16px"; marginRight: "16px"; marginLeft: "16px"`. */
  get m2() {
    return this.add("marginTop", "16px").add("marginBottom", "16px").add("marginRight", "16px").add(
      "marginLeft",
      "16px",
    );
  }
  /** Sets `marginTop: "24px"; marginBottom: "24px"; marginRight: "24px"; marginLeft: "24px"`. */
  get m3() {
    return this.add("marginTop", "24px").add("marginBottom", "24px").add("marginRight", "24px").add(
      "marginLeft",
      "24px",
    );
  }
  /** Sets `marginTop: "32px"; marginBottom: "32px"; marginRight: "32px"; marginLeft: "32px"`. */
  get m4() {
    return this.add("marginTop", "32px").add("marginBottom", "32px").add("marginRight", "32px").add(
      "marginLeft",
      "32px",
    );
  }
  /** Sets `marginTop: "auto"; marginBottom: "auto"; marginRight: "auto"; marginLeft: "auto"`. */
  get ma() {
    return this.add("marginTop", "auto").add("marginBottom", "auto").add("marginRight", "auto").add(
      "marginLeft",
      "auto",
    );
  }
  /** Sets `marginTop: "v"; marginBottom: "v"; marginRight: "v"; marginLeft: "v"`. */
  m(v: number | string) {
    return this.add("marginTop", maybeInc(v)).add("marginBottom", maybeInc(v)).add("marginRight", maybeInc(v)).add(
      "marginLeft",
      maybeInc(v),
    );
  }
  /** Sets `marginTop: px; marginBottom: px; marginRight: px; marginLeft: px`. */
  mPx(px: number) {
    return this.add("marginTop", `${px}px`).add("marginBottom", `${px}px`).add("marginRight", `${px}px`).add(
      "marginLeft",
      `${px}px`,
    );
  }
  /** Sets `paddingTop: "0px"`. */
  get pt0() {
    return this.add("paddingTop", "0px");
  }
  /** Sets `paddingTop: "8px"`. */
  get pt1() {
    return this.add("paddingTop", "8px");
  }
  /** Sets `paddingTop: "16px"`. */
  get pt2() {
    return this.add("paddingTop", "16px");
  }
  /** Sets `paddingTop: "24px"`. */
  get pt3() {
    return this.add("paddingTop", "24px");
  }
  /** Sets `paddingTop: "32px"`. */
  get pt4() {
    return this.add("paddingTop", "32px");
  }
  /** Sets `paddingTop: "v"`. */
  pt(v: number | string) {
    return this.add("paddingTop", maybeInc(v));
  }
  /** Sets `paddingTop: px`. */
  ptPx(px: number) {
    return this.add("paddingTop", `${px}px`);
  }
  /** Sets `paddingRight: "0px"`. */
  get pr0() {
    return this.add("paddingRight", "0px");
  }
  /** Sets `paddingRight: "8px"`. */
  get pr1() {
    return this.add("paddingRight", "8px");
  }
  /** Sets `paddingRight: "16px"`. */
  get pr2() {
    return this.add("paddingRight", "16px");
  }
  /** Sets `paddingRight: "24px"`. */
  get pr3() {
    return this.add("paddingRight", "24px");
  }
  /** Sets `paddingRight: "32px"`. */
  get pr4() {
    return this.add("paddingRight", "32px");
  }
  /** Sets `paddingRight: "v"`. */
  pr(v: number | string) {
    return this.add("paddingRight", maybeInc(v));
  }
  /** Sets `paddingRight: px`. */
  prPx(px: number) {
    return this.add("paddingRight", `${px}px`);
  }
  /** Sets `paddingBottom: "0px"`. */
  get pb0() {
    return this.add("paddingBottom", "0px");
  }
  /** Sets `paddingBottom: "8px"`. */
  get pb1() {
    return this.add("paddingBottom", "8px");
  }
  /** Sets `paddingBottom: "16px"`. */
  get pb2() {
    return this.add("paddingBottom", "16px");
  }
  /** Sets `paddingBottom: "24px"`. */
  get pb3() {
    return this.add("paddingBottom", "24px");
  }
  /** Sets `paddingBottom: "32px"`. */
  get pb4() {
    return this.add("paddingBottom", "32px");
  }
  /** Sets `paddingBottom: "v"`. */
  pb(v: number | string) {
    return this.add("paddingBottom", maybeInc(v));
  }
  /** Sets `paddingBottom: px`. */
  pbPx(px: number) {
    return this.add("paddingBottom", `${px}px`);
  }
  /** Sets `paddingLeft: "0px"`. */
  get pl0() {
    return this.add("paddingLeft", "0px");
  }
  /** Sets `paddingLeft: "8px"`. */
  get pl1() {
    return this.add("paddingLeft", "8px");
  }
  /** Sets `paddingLeft: "16px"`. */
  get pl2() {
    return this.add("paddingLeft", "16px");
  }
  /** Sets `paddingLeft: "24px"`. */
  get pl3() {
    return this.add("paddingLeft", "24px");
  }
  /** Sets `paddingLeft: "32px"`. */
  get pl4() {
    return this.add("paddingLeft", "32px");
  }
  /** Sets `paddingLeft: "v"`. */
  pl(v: number | string) {
    return this.add("paddingLeft", maybeInc(v));
  }
  /** Sets `paddingLeft: px`. */
  plPx(px: number) {
    return this.add("paddingLeft", `${px}px`);
  }
  /** Sets `paddingLeft: "0px"; paddingRight: "0px"`. */
  get px0() {
    return this.add("paddingLeft", "0px").add("paddingRight", "0px");
  }
  /** Sets `paddingLeft: "8px"; paddingRight: "8px"`. */
  get px1() {
    return this.add("paddingLeft", "8px").add("paddingRight", "8px");
  }
  /** Sets `paddingLeft: "16px"; paddingRight: "16px"`. */
  get px2() {
    return this.add("paddingLeft", "16px").add("paddingRight", "16px");
  }
  /** Sets `paddingLeft: "24px"; paddingRight: "24px"`. */
  get px3() {
    return this.add("paddingLeft", "24px").add("paddingRight", "24px");
  }
  /** Sets `paddingLeft: "32px"; paddingRight: "32px"`. */
  get px4() {
    return this.add("paddingLeft", "32px").add("paddingRight", "32px");
  }
  /** Sets `paddingLeft: "v"; paddingRight: "v"`. */
  px(v: number | string) {
    return this.add("paddingLeft", maybeInc(v)).add("paddingRight", maybeInc(v));
  }
  /** Sets `paddingLeft: px; paddingRight: px`. */
  pxPx(px: number) {
    return this.add("paddingLeft", `${px}px`).add("paddingRight", `${px}px`);
  }
  /** Sets `paddingTop: "0px"; paddingBottom: "0px"`. */
  get py0() {
    return this.add("paddingTop", "0px").add("paddingBottom", "0px");
  }
  /** Sets `paddingTop: "8px"; paddingBottom: "8px"`. */
  get py1() {
    return this.add("paddingTop", "8px").add("paddingBottom", "8px");
  }
  /** Sets `paddingTop: "16px"; paddingBottom: "16px"`. */
  get py2() {
    return this.add("paddingTop", "16px").add("paddingBottom", "16px");
  }
  /** Sets `paddingTop: "24px"; paddingBottom: "24px"`. */
  get py3() {
    return this.add("paddingTop", "24px").add("paddingBottom", "24px");
  }
  /** Sets `paddingTop: "32px"; paddingBottom: "32px"`. */
  get py4() {
    return this.add("paddingTop", "32px").add("paddingBottom", "32px");
  }
  /** Sets `paddingTop: "v"; paddingBottom: "v"`. */
  py(v: number | string) {
    return this.add("paddingTop", maybeInc(v)).add("paddingBottom", maybeInc(v));
  }
  /** Sets `paddingTop: px; paddingBottom: px`. */
  pyPx(px: number) {
    return this.add("paddingTop", `${px}px`).add("paddingBottom", `${px}px`);
  }
  /** Sets `paddingTop: "0px"; paddingBottom: "0px"; paddingRight: "0px"; paddingLeft: "0px"`. */
  get p0() {
    return this.add("paddingTop", "0px").add("paddingBottom", "0px").add("paddingRight", "0px").add(
      "paddingLeft",
      "0px",
    );
  }
  /** Sets `paddingTop: "8px"; paddingBottom: "8px"; paddingRight: "8px"; paddingLeft: "8px"`. */
  get p1() {
    return this.add("paddingTop", "8px").add("paddingBottom", "8px").add("paddingRight", "8px").add(
      "paddingLeft",
      "8px",
    );
  }
  /** Sets `paddingTop: "16px"; paddingBottom: "16px"; paddingRight: "16px"; paddingLeft: "16px"`. */
  get p2() {
    return this.add("paddingTop", "16px").add("paddingBottom", "16px").add("paddingRight", "16px").add(
      "paddingLeft",
      "16px",
    );
  }
  /** Sets `paddingTop: "24px"; paddingBottom: "24px"; paddingRight: "24px"; paddingLeft: "24px"`. */
  get p3() {
    return this.add("paddingTop", "24px").add("paddingBottom", "24px").add("paddingRight", "24px").add(
      "paddingLeft",
      "24px",
    );
  }
  /** Sets `paddingTop: "32px"; paddingBottom: "32px"; paddingRight: "32px"; paddingLeft: "32px"`. */
  get p4() {
    return this.add("paddingTop", "32px").add("paddingBottom", "32px").add("paddingRight", "32px").add(
      "paddingLeft",
      "32px",
    );
  }
  /** Sets `paddingTop: "v"; paddingBottom: "v"; paddingRight: "v"; paddingLeft: "v"`. */
  p(v: number | string) {
    return this.add("paddingTop", maybeInc(v)).add("paddingBottom", maybeInc(v)).add("paddingRight", maybeInc(v)).add(
      "paddingLeft",
      maybeInc(v),
    );
  }
  /** Sets `paddingTop: px; paddingBottom: px; paddingRight: px; paddingLeft: px`. */
  pPx(px: number) {
    return this.add("paddingTop", `${px}px`).add("paddingBottom", `${px}px`).add("paddingRight", `${px}px`).add(
      "paddingLeft",
      `${px}px`,
    );
  }

  // customStuff
  /** Sets `color: "#000000"`. */
  get foo() {
    return this.add("color", "#000000");
  }

  // vars
  get darkMode() {
    return this.add("--primary" as any, "#000000");
  }

  // aliases

  get $(): T {
    return maybeImportant(sortObject(this.rules), this.opts.important);
  }

  if(bp: Breakpoint): CssBuilder<T>;
  if(cond: boolean): CssBuilder<T>;
  if(attr: string, value: boolean | string): CssBuilder<T>;
  if(arg: boolean | Breakpoint | string, value?: boolean | string): CssBuilder<T> {
    if (value !== undefined) {
      return this.newCss({ selector: `[${arg}='${value}']` });
    } else if (typeof arg === "boolean") {
      return this.newCss({ enabled: arg });
    } else {
      return this.newCss({ selector: Breakpoints[arg as Breakpoint] });
    }
  }

  get onHover() {
    return this.newCss({ selector: ":hover" });
  }

  ifContainer(props: ContainerProps) {
    return this.newCss({ selector: Container(props) });
  }

  get ifPrint() {
    return this.newCss({ selector: "@media print" });
  }
  get ifSm() {
    return this.newCss({ selector: "@media screen and (max-width:599px)" });
  }
  get ifMd() {
    return this.newCss({ selector: "@media screen and (min-width:600px) and (max-width:959px)" });
  }
  get ifSmOrMd() {
    return this.newCss({ selector: "@media screen and (max-width:959px)" });
  }
  get ifMdAndUp() {
    return this.newCss({ selector: "@media screen and (min-width:600px)" });
  }
  get ifMdAndDown() {
    return this.newCss({ selector: "@media screen and (max-width:959px)" });
  }
  get ifLg() {
    return this.newCss({ selector: "@media screen and (min-width:960px)" });
  }
  get ifMdOrLg() {
    return this.newCss({ selector: "@media screen and (min-width:600px)" });
  }

  get else() {
    if (this.selector !== undefined) {
      if (this.selector.includes("not")) {
        throw new Error("else was already called");
      } else {
        return this.newCss({ selector: this.selector.replace("@media", "@media not") });
      }
    }
    return this.newCss({ enabled: !this.enabled });
  }

  get important() {
    return this.newCss({ important: true });
  }

  /** Adds new properties, either a specific key/value or a Properties object, to the current css. */
  add<P extends Properties>(props: P): CssBuilder<T & P>;
  add<K extends keyof Properties>(prop: K, value: Properties[K]): CssBuilder<T & { [U in K]: Properties[K] }>;
  add<K extends keyof Properties>(propOrProperties: K | Properties, value?: Properties[K]): CssBuilder<any> {
    if (!this.enabled) {
      return this;
    }
    const newRules = typeof propOrProperties === "string" ? { [propOrProperties]: value } : propOrProperties;
    const rules = this.selector
      ? { ...this.rules, [this.selector]: { ...(this.rules as any)[this.selector], ...newRules } }
      : { ...this.rules, ...newRules };
    return this.newCss({ rules: rules as any });
  }

  /** Adds new properties, either a specific key/value or a Properties object, to a nested selector. */
  addIn<P extends Properties>(selector: string, props: P | undefined): CssBuilder<T & P>;
  addIn<K extends keyof Properties>(
    selector: string,
    prop: K,
    value: Properties[K],
  ): CssBuilder<T & { [U in K]: Properties[K] }>;
  addIn<K extends keyof Properties>(
    selector: string,
    propOrProperties: K | Properties,
    value?: Properties[K],
  ): CssBuilder<any> {
    const newRules = typeof propOrProperties === "string" ? { [propOrProperties]: value } : propOrProperties;
    if (!this.enabled) {
      return this;
    }
    if (newRules === undefined) {
      return this;
    }
    const rules = { ...this.rules, [selector]: { ...(this.rules as any)[selector], ...newRules } };
    return this.newCss({ rules: rules as any });
  }
}

/** Emotion treats the same rules, ordered differently as different classes, but naively they can be the same. */
function sortObject<T extends object>(obj: T): T {
  return Object.keys(obj).sort().reduce((acc, key) => {
    acc[key as keyof T] = obj[key as keyof T];
    return acc;
  }, ({} as any) as T) as T;
}

/** Conditionally adds `important!` to everything. */
function maybeImportant<T extends object>(obj: T, important: boolean): T {
  if (important) {
    Object.keys(obj).forEach((key) => {
      (obj as any)[key] = `${(obj as any)[key]} !important`;
    });
  }
  return obj;
}

/** Converts `inc` into pixels value with a `px` suffix. */
export function maybeInc(inc: number | string): string {
  return typeof inc === "string" ? inc : `${increment(inc)}px`;
}

/** Converts `inc` into pixels. */
export function increment(inc: number): number {
  return inc * 8;
}

/** Convert `pixels` to a `px` units string so it's not ambiguous. */
export function px(pixels: number): string {
  return `${pixels}px`;
}

export enum Palette {
  Black = "#353535",
  MidGray = "#888888",
  LightGray = "#cecece",
  White = "#fcfcfa",
  Blue = "#526675",
  Primary = "var(--primary)",
}

/** A shortcut for defining Xss types. */
export type Xss<P extends keyof Properties> = Pick<Properties, P>;

/** An entry point for Css expressions. CssBuilder is immutable so this is safe to share. */
export const Css = new CssBuilder({ rules: {}, enabled: true, important: false, selector: undefined });

export type Margin = "margin" | "marginTop" | "marginRight" | "marginBottom" | "marginLeft";

export type Padding = "padding" | "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft";

export type Breakpoint = "print" | "sm" | "md" | "smOrMd" | "mdAndUp" | "mdAndDown" | "lg" | "mdOrLg";
export enum Breakpoints {
  print = "@media print",
  sm = "@media screen and (max-width:599px)",
  md = "@media screen and (min-width:600px) and (max-width:959px)",
  smOrMd = "@media screen and (max-width:959px)",
  mdAndUp = "@media screen and (min-width:600px)",
  mdAndDown = "@media screen and (max-width:959px)",
  lg = "@media screen and (min-width:960px)",
  mdOrLg = "@media screen and (min-width:600px)",
}

/**
 * Utility to help write `@container` queries
 *
 * @param name - The name of the container.
 * @param lt - The maximum width of the container inclusive.
 * @param gt - The minimum width of the container exclusive.
 */
type ContainerProps = { name?: string } & ({ lt: number } | { gt: number } | { lt: number; gt: number });
export function Container(props: ContainerProps) {
  const { name = "" } = props;
  const lt = "lt" in props ? props.lt : undefined;
  const gt = "gt" in props ? props.gt : undefined;

  const ltQuery = lt !== undefined ? `(max-width: ${lt}px)` : "";
  const gtQuery = gt !== undefined ? `(min-width: ${gt + 1}px)` : "";
  const query = [ltQuery, gtQuery].filter(Boolean).join(" and ");

  return `@container ${name} ${query}`;
}

export type CustomType = number;