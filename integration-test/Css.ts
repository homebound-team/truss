import { Properties as Properties1 } from "csstype";

// This file is auto-generated by truss: https://github.com/homebound-team/truss.

/** Given a type X, and the user's proposed type T, only allow keys in X and nothing else. */
export type Only<X, T> = X & Record<Exclude<keyof T, keyof X>, never>;

export type Properties = Properties1;

type Opts<T> = {
  rules: T;
  enabled: boolean;
  important: boolean;
  selector: string | undefined;
};

// prettier-ignore
class CssBuilder<T extends Properties1> {
  constructor(private opts: Opts<T>) {}

  private get rules(): T { return this.opts.rules };
  private get enabled(): boolean { return this.opts.enabled };
  private get selector(): string | undefined { return this.opts.selector };
  private newCss(opts: Partial<Opts<T>>): CssBuilder<T> {
    return new CssBuilder({ ...this.opts, ...opts });
  }

  // borderColorRules
  get bBlack() { return this.add("borderColor", "#353535"); }
  get bMidGray() { return this.add("borderColor", "#888888"); }
  get bLightGray() { return this.add("borderColor", "#cecece"); }
  get bWhite() { return this.add("borderColor", "#fcfcfa"); }
  get bBlue() { return this.add("borderColor", "#526675"); }
  get bPrimary() { return this.add("borderColor", "var(--primary)"); }

  // borderRadiusRules
  get br0() { return this.add("borderRadius", "0"); }
  get br1() { return this.add("borderRadius", ".125rem"); }
  get br2() { return this.add("borderRadius", ".25rem"); }
  get br3() { return this.add("borderRadius", ".5rem"); }
  get br4() { return this.add("borderRadius", "1rem"); }
  get br100() { return this.add("borderRadius", "100%"); }
  get brPill() { return this.add("borderRadius", "9999px"); }

  // borderRules
  get ba() { return this.add("borderStyle", "solid").add("borderWidth", "1px"); }
  get bt() { return this.add("borderTopStyle", "solid").add("borderTopWidth", "1px"); }
  get br() { return this.add("borderRightStyle", "solid").add("borderRightWidth", "1px"); }
  get bb() { return this.add("borderBottomStyle", "solid").add("borderBottomWidth", "1px"); }
  get bl() { return this.add("borderLeftStyle", "solid").add("borderLeftWidth", "1px"); }
  get bn() { return this.add("borderStyle", "none").add("borderWidth", "0"); }

  // borderStyleRules
  get bsDashed() { return this.add("borderStyle", "dashed"); }
  get bsDotted() { return this.add("borderStyle", "dotted"); }
  get bsNone() { return this.add("borderStyle", "none"); }
  get bsSolid() { return this.add("borderStyle", "solid"); }

  // borderWidthRules
  get bw1() { return this.add("borderWidth", "1px"); }
  get bw2() { return this.add("borderWidth", "2px"); }
  bw(value: Properties["borderWidth"]) { return this.add("borderWidth", value); }

  // boxShadowRules
  get shadowNone() { return this.add("boxShadow", "none"); }

  // coordinateRules
  get top0() { return this.top(0); }
  get top1() { return this.top(1); }
  get top2() { return this.top(2); }
  get top3() { return this.top(3); }
  get top4() { return this.top(4); }
  top(inc: number | string) { return this.add("top", maybeInc(inc)); }
  topPx(px: number) { return this.add("top", `${px}px`); }
  get right0() { return this.right(0); }
  get right1() { return this.right(1); }
  get right2() { return this.right(2); }
  get right3() { return this.right(3); }
  get right4() { return this.right(4); }
  right(inc: number | string) { return this.add("right", maybeInc(inc)); }
  rightPx(px: number) { return this.add("right", `${px}px`); }
  get bottom0() { return this.bottom(0); }
  get bottom1() { return this.bottom(1); }
  get bottom2() { return this.bottom(2); }
  get bottom3() { return this.bottom(3); }
  get bottom4() { return this.bottom(4); }
  bottom(inc: number | string) { return this.add("bottom", maybeInc(inc)); }
  bottomPx(px: number) { return this.add("bottom", `${px}px`); }
  get left0() { return this.left(0); }
  get left1() { return this.left(1); }
  get left2() { return this.left(2); }
  get left3() { return this.left(3); }
  get left4() { return this.left(4); }
  left(inc: number | string) { return this.add("left", maybeInc(inc)); }
  leftPx(px: number) { return this.add("left", `${px}px`); }

  // cursorRules
  get cursorPointer() { return this.add("cursor", "pointer"); }

  // displayRules
  get dn() { return this.add("display", "none"); }
  get db() { return this.add("display", "block"); }
  get dib() { return this.add("display", "inline-block"); }
  get dit() { return this.add("display", "inline-table"); }
  get dt() { return this.add("display", "table"); }
  get dtc() { return this.add("display", "table-cell"); }
  get dtRow() { return this.add("display", "table-row"); }
  get dtColumn() { return this.add("display", "table-column"); }
  get dtColumnGroup() { return this.add("display", "table-column-group"); }
  get dg() { return this.add("display", "grid"); }
  get df() { return this.add("display", "flex"); }
  get dif() { return this.add("display", "inline-flex"); }
  display(value: Properties["display"]) { return this.add("display", value); }

  // flexboxRules
  get justifyStart() { return this.add("justifyContent", "flex-start"); }
  get justifyEnd() { return this.add("justifyContent", "flex-end"); }
  get justifyCenter() { return this.add("justifyContent", "center"); }
  get justifyBetween() { return this.add("justifyContent", "space-between"); }
  get justifyAround() { return this.add("justifyContent", "space-around"); }
  get justifyEvenly() { return this.add("justifyContent", "space-evenly"); }
  justify(value: Properties["justifyContent"]) { return this.add("justifyContent", value); }
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
  get fb1() { return this.add("flexBasis", "100%"); }
  get fb2() { return this.add("flexBasis", "50%"); }
  get fb3() { return this.add("flexBasis", "33.333333%"); }
  get fb4() { return this.add("flexBasis", "25%"); }
  get fb5() { return this.add("flexBasis", "20%"); }
  get fb6() { return this.add("flexBasis", "16.666666%"); }
  get fb7() { return this.add("flexBasis", "14.285714%"); }
  get fb0() { return this.add("flexBasis", "12.5%"); }
  fb(value: Properties["flexBasis"]) { return this.add("flexBasis", value); }
  get flexAuto() { return this.add("flex", "auto"); }
  get flexNone() { return this.add("flex", "none"); }
  flex(value: Properties["flex"]) { return this.add("flex", value); }
  get fg0() { return this.add("flexGrow", 0); }
  get fg1() { return this.add("flexGrow", 1); }
  flexGrow(value: Properties["flexGrow"]) { return this.add("flexGrow", value); }
  get fs0() { return this.add("flexShrink", 0); }
  get fs1() { return this.add("flexShrink", 1); }
  flexShrink(value: Properties["flexShrink"]) { return this.add("flexShrink", value); }
  get flexRow() { return this.add("flexDirection", "row"); }
  get flexRowReverse() { return this.add("flexDirection", "row-reverse"); }
  get flexColumn() { return this.add("flexDirection", "column"); }
  get flexColumnReverse() { return this.add("flexDirection", "column-reverse"); }
  flexDirection(value: Properties["flexDirection"]) { return this.add("flexDirection", value); }

  // floatRules
  get fl() { return this.add("float", "left"); }
  get fn() { return this.add("float", "none"); }
  get fr() { return this.add("float", "right"); }

  // fontWeightRules
  get normal() { return this.add("fontWeight", "normal"); }
  get b() { return this.add("fontWeight", "bold"); }
  get fw1() { return this.add("fontWeight", 100); }
  get fw2() { return this.add("fontWeight", 200); }
  get fw3() { return this.add("fontWeight", 300); }
  get fw4() { return this.add("fontWeight", 400); }
  get fw5() { return this.add("fontWeight", 500); }
  get fw6() { return this.add("fontWeight", 600); }
  get fw7() { return this.add("fontWeight", 700); }
  get fw8() { return this.add("fontWeight", 800); }
  get fw9() { return this.add("fontWeight", 900); }

  // heightRules
  get h0() { return this.h(0); }
  get h1() { return this.h(1); }
  get h2() { return this.h(2); }
  get h3() { return this.h(3); }
  get h4() { return this.h(4); }
  h(inc: number | string) { return this.add("height", maybeInc(inc)); }
  hPx(px: number) { return this.add("height", `${px}px`); }
  get h25() { return this.add("height", "25%"); }
  get h50() { return this.add("height", "50%"); }
  get h75() { return this.add("height", "75%"); }
  get h100() { return this.add("height", "100%"); }
  get vh25() { return this.add("height", "25vh"); }
  get vh50() { return this.add("height", "50vh"); }
  get vh75() { return this.add("height", "75vh"); }
  get vh100() { return this.add("height", "100vh"); }
  get mh0() { return this.add("minHeight", 0); }
  get mh25() { return this.add("minHeight", "25%"); }
  get mh50() { return this.add("minHeight", "50%"); }
  get mh75() { return this.add("minHeight", "75%"); }
  get mh100() { return this.add("minHeight", "100%"); }
  get mvh100() { return this.add("minHeight", "100vh"); }
  mh(value: Properties["minHeight"]) { return this.add("minHeight", value); }
  get maxh0() { return this.add("maxHeight", "0"); }
  get maxh25() { return this.add("maxHeight", "25%"); }
  get maxh50() { return this.add("maxHeight", "50%"); }
  get maxh75() { return this.add("maxHeight", "75%"); }
  get maxh100() { return this.add("maxHeight", "100%"); }
  maxh(value: Properties["maxHeight"]) { return this.add("maxHeight", value); }

  // outlineRules
  get outline() { return this.add("outline", "1px solid"); }
  get outlineTransparent() { return this.add("outline", "1px solid transparent"); }
  get outline0() { return this.add("outline", "0"); }

  // objectFitRules
  get objectContain() { return this.add("objectFit", "contain"); }
  get objectCover() { return this.add("objectFit", "cover"); }
  get objectFill() { return this.add("objectFit", "fill"); }
  get objectNone() { return this.add("objectFit", "none"); }
  get objectScaleDown() { return this.add("objectFit", "scale-down"); }
  objectFit(value: Properties["objectFit"]) { return this.add("objectFit", value); }

  // overflowRules
  get overflowVisible() { return this.add("overflow", "visible"); }
  get overflowHidden() { return this.add("overflow", "hidden"); }
  get overflowScroll() { return this.add("overflow", "scroll"); }
  get overflowAuto() { return this.add("overflow", "auto"); }
  overflow(value: Properties["overflow"]) { return this.add("overflow", value); }
  get overflowYVisible() { return this.add("overflowY", "visible"); }
  get overflowYHidden() { return this.add("overflowY", "hidden"); }
  get overflowYScroll() { return this.add("overflowY", "scroll"); }
  get overflowYAuto() { return this.add("overflowY", "auto"); }
  overflowY(value: Properties["overflowY"]) { return this.add("overflowY", value); }
  get overflowXVisible() { return this.add("overflowX", "visible"); }
  get overflowXHidden() { return this.add("overflowX", "hidden"); }
  get overflowXScroll() { return this.add("overflowX", "scroll"); }
  get overflowXAuto() { return this.add("overflowX", "auto"); }
  overflowX(value: Properties["overflowX"]) { return this.add("overflowX", value); }

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
  get primary() { return this.add("color", "var(--primary)"); }
  color(value: string) { return this.add("color", value); }
  get bgBlack() { return this.add("backgroundColor", "#353535"); }
  get bgMidGray() { return this.add("backgroundColor", "#888888"); }
  get bgLightGray() { return this.add("backgroundColor", "#cecece"); }
  get bgWhite() { return this.add("backgroundColor", "#fcfcfa"); }
  get bgBlue() { return this.add("backgroundColor", "#526675"); }
  get bgPrimary() { return this.add("backgroundColor", "var(--primary)"); }
  bgColor(value: string) { return this.add("backgroundColor", value); }
  fill(value: string) { return this.add("fill", value); }

  // spacingRules
  get mt0() { return this.mt(0); }
  get mt1() { return this.mt(1); }
  get mt2() { return this.mt(2); }
  get mt3() { return this.mt(3); }
  get mt4() { return this.mt(4); }
  mt(inc: number | string) { return this.add("marginTop", maybeInc(inc)); }
  mtPx(px: number) { return this.add("marginTop", `${px}px`); }
  get mr0() { return this.mr(0); }
  get mr1() { return this.mr(1); }
  get mr2() { return this.mr(2); }
  get mr3() { return this.mr(3); }
  get mr4() { return this.mr(4); }
  mr(inc: number | string) { return this.add("marginRight", maybeInc(inc)); }
  mrPx(px: number) { return this.add("marginRight", `${px}px`); }
  get mb0() { return this.mb(0); }
  get mb1() { return this.mb(1); }
  get mb2() { return this.mb(2); }
  get mb3() { return this.mb(3); }
  get mb4() { return this.mb(4); }
  mb(inc: number | string) { return this.add("marginBottom", maybeInc(inc)); }
  mbPx(px: number) { return this.add("marginBottom", `${px}px`); }
  get ml0() { return this.ml(0); }
  get ml1() { return this.ml(1); }
  get ml2() { return this.ml(2); }
  get ml3() { return this.ml(3); }
  get ml4() { return this.ml(4); }
  ml(inc: number | string) { return this.add("marginLeft", maybeInc(inc)); }
  mlPx(px: number) { return this.add("marginLeft", `${px}px`); }
  get mx0() { return this.mx(0); }
  get mx1() { return this.mx(1); }
  get mx2() { return this.mx(2); }
  get mx3() { return this.mx(3); }
  get mx4() { return this.mx(4); }
  mx(inc: number | string) { return this.ml(inc).mr(inc); }
  mxPx(px: number) { return this.mlPx(px).mrPx(px); }
  get my0() { return this.my(0); }
  get my1() { return this.my(1); }
  get my2() { return this.my(2); }
  get my3() { return this.my(3); }
  get my4() { return this.my(4); }
  my(inc: number | string) { return this.mt(inc).mb(inc); }
  myPx(px: number) { return this.mtPx(px).mbPx(px); }
  get m0() { return this.m(0); }
  get m1() { return this.m(1); }
  get m2() { return this.m(2); }
  get m3() { return this.m(3); }
  get m4() { return this.m(4); }
  m(inc: number | string) { return this.mt(inc).mb(inc).mr(inc).ml(inc); }
  mPx(px: number) { return this.mtPx(px).mbPx(px).mrPx(px).mlPx(px); }
  get pt0() { return this.pt(0); }
  get pt1() { return this.pt(1); }
  get pt2() { return this.pt(2); }
  get pt3() { return this.pt(3); }
  get pt4() { return this.pt(4); }
  pt(inc: number | string) { return this.add("paddingTop", maybeInc(inc)); }
  ptPx(px: number) { return this.add("paddingTop", `${px}px`); }
  get pr0() { return this.pr(0); }
  get pr1() { return this.pr(1); }
  get pr2() { return this.pr(2); }
  get pr3() { return this.pr(3); }
  get pr4() { return this.pr(4); }
  pr(inc: number | string) { return this.add("paddingRight", maybeInc(inc)); }
  prPx(px: number) { return this.add("paddingRight", `${px}px`); }
  get pb0() { return this.pb(0); }
  get pb1() { return this.pb(1); }
  get pb2() { return this.pb(2); }
  get pb3() { return this.pb(3); }
  get pb4() { return this.pb(4); }
  pb(inc: number | string) { return this.add("paddingBottom", maybeInc(inc)); }
  pbPx(px: number) { return this.add("paddingBottom", `${px}px`); }
  get pl0() { return this.pl(0); }
  get pl1() { return this.pl(1); }
  get pl2() { return this.pl(2); }
  get pl3() { return this.pl(3); }
  get pl4() { return this.pl(4); }
  pl(inc: number | string) { return this.add("paddingLeft", maybeInc(inc)); }
  plPx(px: number) { return this.add("paddingLeft", `${px}px`); }
  get px0() { return this.px(0); }
  get px1() { return this.px(1); }
  get px2() { return this.px(2); }
  get px3() { return this.px(3); }
  get px4() { return this.px(4); }
  px(inc: number | string) { return this.pl(inc).pr(inc); }
  pxPx(px: number) { return this.plPx(px).prPx(px); }
  get py0() { return this.py(0); }
  get py1() { return this.py(1); }
  get py2() { return this.py(2); }
  get py3() { return this.py(3); }
  get py4() { return this.py(4); }
  py(inc: number | string) { return this.pt(inc).pb(inc); }
  pyPx(px: number) { return this.ptPx(px).pbPx(px); }
  get p0() { return this.p(0); }
  get p1() { return this.p(1); }
  get p2() { return this.p(2); }
  get p3() { return this.p(3); }
  get p4() { return this.p(4); }
  p(inc: number | string) { return this.pt(inc).pb(inc).pr(inc).pl(inc); }
  pPx(px: number) { return this.ptPx(px).pbPx(px).prPx(px).plPx(px); }

  // textAlignRules
  get tl() { return this.add("textAlign", "left"); }
  get tc() { return this.add("textAlign", "center"); }
  get tr() { return this.add("textAlign", "right"); }
  get tj() { return this.add("textAlign", "justify"); }

  // textDecorationRules
  get noUnderline() { return this.add("textDecoration", "none"); }
  get strike() { return this.add("textDecoration", "line-through"); }
  get underline() { return this.add("textDecoration", "underline"); }

  // textTransformRules
  get ttc() { return this.add("textTransform", "capitalize"); }
  get ttl() { return this.add("textTransform", "lowercase"); }
  get ttu() { return this.add("textTransform", "uppercase"); }
  get ttn() { return this.add("textTransform", "none"); }

  // typeScaleRules
  get f24() { return this.add("fontSize", "24px"); }
  get f18() { return this.add("fontSize", "18px"); }
  get f16() { return this.add("fontSize", "16px"); }
  get f14() { return this.add("fontSize", "14px"); }
  get f12() { return this.add("fontSize", "12px"); }
  get f10() { return this.add("fontSize", "10px").add("fontWeight", 500); }

  // typographyRules
  get measure() { return this.add("maxWidth", "30em"); }
  get measureWide() { return this.add("maxWidth", "34em"); }
  get measureNarrow() { return this.add("maxWidth", "20em"); }
  get indent() { return this.add("textIndent", "1em").add("marginTop", 0).add("marginBottom", 0); }
  get smallCaps() { return this.add("fontVariant", "small-caps"); }
  get truncate() { return this.add("whiteSpace", "nowrap").add("overflow", "hidden").add("textOverflow", "ellipsis"); }

  // userSelectRules
  get selectNone() { return this.add("userSelect", "none"); }
  get selectText() { return this.add("userSelect", "text"); }
  get selectAll() { return this.add("userSelect", "all"); }
  get selectAuto() { return this.add("userSelect", "auto"); }

  // verticalAlignRules
  get vBase() { return this.add("verticalAlign", "baseline"); }
  get vMid() { return this.add("verticalAlign", "middle"); }
  get vTop() { return this.add("verticalAlign", "top"); }
  get vBottom() { return this.add("verticalAlign", "bottom"); }

  // visibilityRules
  get visible() { return this.add("visibility", "visible"); }
  get invisible() { return this.add("visibility", "hidden"); }

  // whitespaceRules
  get nowrap() { return this.add("whiteSpace", "nowrap"); }
  get pre() { return this.add("whiteSpace", "pre"); }
  get wsNormal() { return this.add("whiteSpace", "normal"); }

  // widthRules
  get w25() { return this.add("width", "25%"); }
  get w50() { return this.add("width", "50%"); }
  get w75() { return this.add("width", "75%"); }
  get w100() { return this.add("width", "100%"); }
  get mw0() { return this.add("minWidth", 0); }
  get mw25() { return this.add("minWidth", "25%"); }
  get mw50() { return this.add("minWidth", "50%"); }
  get mw75() { return this.add("minWidth", "75%"); }
  get mw100() { return this.add("minWidth", "100%"); }
  mw(value: Properties["minWidth"]) { return this.add("minWidth", value); }
  get maxw0() { return this.add("maxWidth", "0"); }
  get maxw25() { return this.add("maxWidth", "25%"); }
  get maxw50() { return this.add("maxWidth", "50%"); }
  get maxw75() { return this.add("maxWidth", "75%"); }
  get maxw100() { return this.add("maxWidth", "100%"); }
  maxw(value: Properties["maxWidth"]) { return this.add("maxWidth", value); }
  get w0() { return this.w(0); }
  get w1() { return this.w(1); }
  get w2() { return this.w(2); }
  get w3() { return this.w(3); }
  get w4() { return this.w(4); }
  w(inc: number | string) { return this.add("width", maybeInc(inc)); }
  wPx(px: number) { return this.add("width", `${px}px`); }

  // zIndexRules
  get z0() { return this.add("zIndex", 0); }
  get z1() { return this.add("zIndex", 1); }
  get z2() { return this.add("zIndex", 2); }
  get z3() { return this.add("zIndex", 3); }
  get z4() { return this.add("zIndex", 4); }
  get z5() { return this.add("zIndex", 5); }
  get z999() { return this.add("zIndex", 999); }
  get z9999() { return this.add("zIndex", 9999); }
  get zInherit() { return this.add("zIndex", "inherit"); }
  get zInitial() { return this.add("zIndex", "initial"); }
  get zUnset() { return this.add("zIndex", "unset"); }
  z(value: Properties["zIndex"]) { return this.add("zIndex", value); }

  // customStuff
  get foo() { return this.add("color", "#000000"); }

  // vars
  get setVars() { return this.add("--primary" as any, "#000000"); }
  get var() { return this.add("color", "var(--primary)"); }

  // aliases
  get bodyText() { return this.f14.black; }
  
  get $(): T { return maybeImportant(sortObject(this.rules), this.opts.important); }

  if(t: boolean | Breakpoint) {
    if (typeof t === "boolean") {
      return this.newCss({ enabled: t });
    } else {
      return this.newCss({ selector: t as string });
    }
  }

  get else() {
    if (this.selector !== undefined) {
      throw new Error("else is not supported with if(selector)");
    }
    return this.newCss({ enabled: !this.enabled });
  }

  get important() { return this.newCss({ important: true }); }

  /** Adds new properties, either a specific key/value or a Properties object, to the current css. */
  add<P extends Properties>(props: P): CssBuilder<T & P>;
  add<K extends keyof Properties>(prop: K, value: Properties[K]): CssBuilder<T & { [U in K]: Properties[K] }>;
  add<K extends keyof Properties>(propOrProperties: K | Properties, value?: Properties[K]): CssBuilder<any> {
    const newRules = typeof propOrProperties === "string" ?  { [propOrProperties]: value } : propOrProperties;
    const rules = this.selector
      ? { ...this.rules, [this.selector]: { ...(this.rules as any)[this.selector], ...newRules } }
      : this.enabled ? { ...this.rules, ...newRules } : this.rules;
    return this.newCss({ rules: rules as any });
  }

  /** Adds new properties, either a specific key/value or a Properties object, to a nested selector. */
  addIn<P extends Properties>(selector: string, props: P): CssBuilder<T & P>;
  addIn<K extends keyof Properties>(selector: string, prop: K, value: Properties[K]): CssBuilder<T & { [U in K]: Properties[K] }>;
  addIn<K extends keyof Properties>(selector: string, propOrProperties: K | Properties, value?: Properties[K]): CssBuilder<any> {
    const newRules = typeof propOrProperties === "string" ?  { [propOrProperties]: value } : propOrProperties;
    const rules = { ...this.rules, [selector]: { ...(this.rules as any)[selector], ...newRules } };
    return this.newCss({ rules: rules as any });
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
export const Css = new CssBuilder({
  rules: {},
  enabled: true,
  important: false,
  selector: undefined,
});

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

type Brand<K, T> = K & { __brand: T };
type Breakpoint = Brand<string, "Breakpoint">;
export const sm = "@media screen and (max-width:599px)" as Breakpoint;
export const md = "@media screen and (min-width:600px) and (max-width:959px)" as Breakpoint;
export const smOrMd = "@media screen and (max-width:959px)" as Breakpoint;
export const mdAndUp = "@media screen and (min-width:600px)" as Breakpoint;
export const mdAndDown = "@media screen and (max-width:959px)" as Breakpoint;
export const lg = "@media screen and (min-width:960px)" as Breakpoint;
export const mdOrLg = "@media screen and (min-width:600px)" as Breakpoint;

export type CustomType = number;
