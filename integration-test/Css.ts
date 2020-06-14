import { Properties as Properties1 } from "csstype";

/** Given a type X, and the user's proposed type X, only allow keys in X and nothing else. */
export type Only<X, T> = X & Record<Exclude<keyof T, keyof X>, never>;

export type Properties = Properties1;

// prettier-ignore
class CssBuilder<T extends Properties1> {
  constructor(public rules: T, private enabled: boolean, private _important: boolean) {}

  // borderColorRules
  get bBlack() { return this.add("borderColor", "#353535"); }
  get bMidGray() { return this.add("borderColor", "#888888"); }
  get bLightGray() { return this.add("borderColor", "#cecece"); }
  get bWhite() { return this.add("borderColor", "#fcfcfa"); }
  get bBlue() { return this.add("borderColor", "#526675"); }

  // borderRadiusRules
  get br0() { return this.add("borderRadius", "0"); }
  get br1() { return this.add("borderRadius", ".125rem"); }
  get br2() { return this.add("borderRadius", ".25rem"); }
  get br3() { return this.add("borderRadius", ".5rem"); }
  get br4() { return this.add("borderRadius", "1rem"); }
  get br100() { return this.add("borderRadius", "100%"); }
  get brPill() { return this.add("borderRadius", "9999px"); }

  // borderRules
  get ba() { return this.add2("borderStyle", "solid", "borderWidth", "1px"); }
  get bt() { return this.add2("borderTopStyle", "solid", "borderTopWidth", "1px"); }
  get br() { return this.add2("borderRightStyle", "solid", "borderRightWidth", "1px"); }
  get bb() { return this.add2("borderBottomStyle", "solid", "borderBottomWidth", "1px"); }
  get bl() { return this.add2("borderLeftStyle", "solid", "borderLeftWidth", "1px"); }
  get bn() { return this.add2("borderStyle", "none", "borderWidth", "0"); }

  // boxShadowRules
  get shadowNone() { return this.add("boxShadow", "none") }

  // coordinateRules
  get top0() { return this.top(0); }
  get top1() { return this.top(1); }
  get top2() { return this.top(2); }
  get top3() { return this.top(3); }
  get top4() { return this.top(4); }
  top(inc: number | string) { return this.add("top", px(inc)); }
  get right0() { return this.right(0); }
  get right1() { return this.right(1); }
  get right2() { return this.right(2); }
  get right3() { return this.right(3); }
  get right4() { return this.right(4); }
  right(inc: number | string) { return this.add("right", px(inc)); }
  get bottom0() { return this.bottom(0); }
  get bottom1() { return this.bottom(1); }
  get bottom2() { return this.bottom(2); }
  get bottom3() { return this.bottom(3); }
  get bottom4() { return this.bottom(4); }
  bottom(inc: number | string) { return this.add("bottom", px(inc)); }
  get left0() { return this.left(0); }
  get left1() { return this.left(1); }
  get left2() { return this.left(2); }
  get left3() { return this.left(3); }
  get left4() { return this.left(4); }
  left(inc: number | string) { return this.add("left", px(inc)); }

  // cursorRules
  get cursorPointer() { return this.add("cursor", "pointer") }

  // displayRules
  get dn() { return this.add("display", "none"); }
  get db() { return this.add("display", "block"); }
  get dib() { return this.add("display", "inlineBlock"); }
  get dit() { return this.add("display", "inlineTable"); }
  get dt() { return this.add("display", "table"); }
  get dtc() { return this.add("display", "tableCell"); }
  get dtRow() { return this.add("display", "tableRow"); }
  get dtColumn() { return this.add("display", "tableColumn"); }
  get dtColumnGroup() { return this.add("display", "tableColumnGroup"); }
  get dg() { return this.add("display", "grid"); }

  // flexboxRules
  get justifyStart() { return this.add("justifyContent", "flex-start"); }
  get justifyEnd() { return this.add("justifyContent", "flex-end"); }
  get justifyCenter() { return this.add("justifyContent", "center"); }
  get justifyBetween() { return this.add("justifyContent", "space-between"); }
  get justifyAround() { return this.add("justifyContent", "space-around"); }
  justify(value: Properties["justifyContent"]) { return this.add("justifyContent", value); }
  get flex() { return this.add("display", "flex"); }
  get inlineFlex() { return this.add("display", "inline-flex"); }
  get flexNone() { return this.add("display", "none"); }
  display(value: Properties["display"]) { return this.add("display", value); }
  get selfStart() { return this.add("alignSelf", "flex-start"); }
  get selfEnd() { return this.add("alignSelf", "flex-end"); }
  get selfCenter() { return this.add("alignSelf", "center"); }
  get selfBaseline() { return this.add("alignSelf", "baseline"); }
  get selfStretch() { return this.add("alignSelf", "stretch"); }
  self(value: Properties["alignSelf"]) { return this.add("alignSelf", value); }
  get itemsStart() { return this.add("alignItems", "flex-start"); }
  get itemsEnd() { return this.add("alignItems", "flex-end"); }
  get itemsCenter() { return this.add("alignItems", "center"); }
  get itemsBaseline() { return this.add("alignItems", "baseline"); }
  get itemsStretch() { return this.add("alignItems", "stretch"); }
  items(value: Properties["alignItems"]) { return this.add("alignItems", value); }

  // heightRules
  get h25() { return this.add("height", "25%"); }
  get h50() { return this.add("height", "50%"); }
  get h75() { return this.add("height", "75%"); }
  get h100() { return this.add("height", "100%"); }
  get h0() { return this.h(0); }
  get h1() { return this.h(1); }
  get h2() { return this.h(2); }
  get h3() { return this.h(3); }
  get h4() { return this.h(4); }
  h(inc: number | string) { return this.add("height", px(inc)); }

  // outlineRules
  get outline() { return this.add("outline", "1px solid"); }
  get outlineTransparent() { return this.add("outline", "1px solid transparent"); }
  get outline0() { return this.add("outline", "0"); }

  // positionRules
  get absolute() { return this.add("position", "absolute"); }
  get fixed() { return this.add("position", "fixed"); }
  get static() { return this.add("position", "static"); }
  get relative() { return this.add("position", "relative"); }
  get sticky() { return this.add("position", "sticky"); }

  // skinRules
  get black() { return this.add("color", "#353535"); }
  get midGray() { return this.add("color", "#888888"); }
  get lightGray() { return this.add("color", "#cecece"); }
  get white() { return this.add("color", "#fcfcfa"); }
  get blue() { return this.add("color", "#526675"); }
  color(value: string) { return this.add("color", value); }
  get bgBlack() { return this.add("backgroundColor", "#353535"); }
  get bgMidGray() { return this.add("backgroundColor", "#888888"); }
  get bgLightGray() { return this.add("backgroundColor", "#cecece"); }
  get bgWhite() { return this.add("backgroundColor", "#fcfcfa"); }
  get bgBlue() { return this.add("backgroundColor", "#526675"); }
  bgColor(value: string) { return this.add("backgroundColor", value); }

  // spacingRules
  get mt0() { return this.mt(0); }
  get mt1() { return this.mt(1); }
  get mt2() { return this.mt(2); }
  get mt3() { return this.mt(3); }
  get mt4() { return this.mt(4); }
  mt(inc: number | string) { return this.add("marginTop", px(inc)); }
  get mr0() { return this.mr(0); }
  get mr1() { return this.mr(1); }
  get mr2() { return this.mr(2); }
  get mr3() { return this.mr(3); }
  get mr4() { return this.mr(4); }
  mr(inc: number | string) { return this.add("marginRight", px(inc)); }
  get mb0() { return this.mb(0); }
  get mb1() { return this.mb(1); }
  get mb2() { return this.mb(2); }
  get mb3() { return this.mb(3); }
  get mb4() { return this.mb(4); }
  mb(inc: number | string) { return this.add("marginBottom", px(inc)); }
  get ml0() { return this.ml(0); }
  get ml1() { return this.ml(1); }
  get ml2() { return this.ml(2); }
  get ml3() { return this.ml(3); }
  get ml4() { return this.ml(4); }
  ml(inc: number | string) { return this.add("marginLeft", px(inc)); }
  get mx0() { return this.mx(0); }
  get mx1() { return this.mx(1); }
  get mx2() { return this.mx(2); }
  get mx3() { return this.mx(3); }
  get mx4() { return this.mx(4); }
  mx(inc: number | string) { return this.ml(inc).mr(inc); }
  get my0() { return this.my(0); }
  get my1() { return this.my(1); }
  get my2() { return this.my(2); }
  get my3() { return this.my(3); }
  get my4() { return this.my(4); }
  my(inc: number | string) { return this.mt(inc).mb(inc); }
  get m0() { return this.m(0); }
  get m1() { return this.m(1); }
  get m2() { return this.m(2); }
  get m3() { return this.m(3); }
  get m4() { return this.m(4); }
  m(inc: number | string) { return this.mt(inc).mb(inc).mr(inc).ml(inc); }
  get pt0() { return this.pt(0); }
  get pt1() { return this.pt(1); }
  get pt2() { return this.pt(2); }
  get pt3() { return this.pt(3); }
  get pt4() { return this.pt(4); }
  pt(inc: number | string) { return this.add("paddingTop", px(inc)); }
  get pr0() { return this.pr(0); }
  get pr1() { return this.pr(1); }
  get pr2() { return this.pr(2); }
  get pr3() { return this.pr(3); }
  get pr4() { return this.pr(4); }
  pr(inc: number | string) { return this.add("paddingRight", px(inc)); }
  get pb0() { return this.pb(0); }
  get pb1() { return this.pb(1); }
  get pb2() { return this.pb(2); }
  get pb3() { return this.pb(3); }
  get pb4() { return this.pb(4); }
  pb(inc: number | string) { return this.add("paddingBottom", px(inc)); }
  get pl0() { return this.pl(0); }
  get pl1() { return this.pl(1); }
  get pl2() { return this.pl(2); }
  get pl3() { return this.pl(3); }
  get pl4() { return this.pl(4); }
  pl(inc: number | string) { return this.add("paddingLeft", px(inc)); }
  get px0() { return this.px(0); }
  get px1() { return this.px(1); }
  get px2() { return this.px(2); }
  get px3() { return this.px(3); }
  get px4() { return this.px(4); }
  px(inc: number | string) { return this.pl(inc).pr(inc); }
  get py0() { return this.py(0); }
  get py1() { return this.py(1); }
  get py2() { return this.py(2); }
  get py3() { return this.py(3); }
  get py4() { return this.py(4); }
  py(inc: number | string) { return this.pt(inc).pb(inc); }
  get p0() { return this.p(0); }
  get p1() { return this.p(1); }
  get p2() { return this.p(2); }
  get p3() { return this.p(3); }
  get p4() { return this.p(4); }
  p(inc: number | string) { return this.pt(inc).pb(inc).pr(inc).pl(inc); }

  // textAlignRules
  get tl() { return this.add("textAlign", "left"); }
  get tc() { return this.add("textAlign", "center"); }
  get tr() { return this.add("textAlign", "right"); }
  get tj() { return this.add("textAlign", "justify"); }

  // textDecorationRules
  get noUnderline() { return this.add("textDecoration", "none"); }
  get strike() { return this.add("textDecoration", "line-through"); }
  get underline() { return this.add("textDecoration", "underline"); }

  // typeScaleRules
  get f24() { return this.add("fontSize", "24px"); }
  get f18() { return this.add("fontSize", "18px"); }
  get f16() { return this.add("fontSize", "16px"); }
  get f14() { return this.add("fontSize", "14px"); }
  get f12() { return this.add("fontSize", "12px"); }
  get f10() { return this.add("fontSize", "10px"); }

  // whitespaceRules
  get nowrap() { return this.add("whiteSpace", "nowrap"); }
  get pre() { return this.add("whiteSpace", "pre"); }
  get wsNormal() { return this.add("whiteSpace", "normal"); }

  // widthRules
  get w25() { return this.add("width", "25%"); }
  get w50() { return this.add("width", "50%"); }
  get w75() { return this.add("width", "75%"); }
  get w100() { return this.add("width", "100%"); }
  get w0() { return this.w(0); }
  get w1() { return this.w(1); }
  get w2() { return this.w(2); }
  get w3() { return this.w(3); }
  get w4() { return this.w(4); }
  w(inc: number | string) { return this.add("width", px(inc)); }

  // visibilityRules
  get visible() { return this.add("visibility", "visible"); }
  get invisible() { return this.add("visibility", "hidden"); }

  // aliases
  get bodyText() { return this.f14.black; }
  
  get $(): T { return maybeImportant(sortObject(this.rules), this._important); }
  
  if(t: boolean) { return new CssBuilder<T>(this.rules, t, this._important); }
  
  get else() { return new CssBuilder<T>(this.rules, !this.enabled, this._important); }

  get important() { return new CssBuilder<T>(this.rules, this.enabled, true); }

  /** Adds new properties, either a specific key/value, or a Properties object, the current css. */
  add<P extends Properties>(prop: P): CssBuilder<T & P>;
  add<K extends keyof Properties, V extends Properties[K]>(prop: K, value: V): CssBuilder<T & { [U in K]: V }>;
  add<K extends keyof Properties, V extends Properties[K]>(propOrProperties: K | Properties, value?: V): CssBuilder<any> {
    const newRules = typeof propOrProperties === "string" ?  { [propOrProperties]: value } : propOrProperties;
    const rules = this.enabled ? { ...this.rules, ...newRules } : this.rules;
    return new CssBuilder(rules as any, this.enabled, this._important);
  }

  /** Adds two properties at a time. */
  add2<
    K1 extends keyof Properties,
    V1 extends Properties[K1],
    K2 extends keyof Properties,
    V2 extends Properties[K2],
  >(prop1: K1, value1: V1, prop2: K2, value2: V2): CssBuilder<T & { [U in K1]: V1 } & { [U in K2]: V2 }> {
    const rules = this.enabled ? { ...this.rules, [prop1]: value1, [prop2]: value2 } : this.rules;
    return new CssBuilder(rules as any, this.enabled, this._important);
  }
}

/** Emotion treats the same rules, ordered differently as different classes, but naively they can be the same. */
function sortObject<T extends object>(obj: T): T {
  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
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
function px(inc: number | string): string {
  return typeof inc === "string" ? inc : `${spacing(inc)}px`;
}

/** Converts `inc` into pixels. */
export function spacing(inc: number): number {
  return inc * 8;
}

/** An entry point for Css expressions. CssBuilder is immutable so this is safe to share. */
export const Css = new CssBuilder({}, true, false);

export type Margin =
  | "margin"
  | "marginTop"
  | "marginRight"
  | "marginBottom"
  | "marginLeft";

export type Padding =
  | "padding"
  | "paddingTop"
  | "paddingRight"
  | "paddingBottom"
  | "paddingLeft";

export type CustomType = number;
