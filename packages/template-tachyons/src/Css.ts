import { Properties as Properties1 } from "csstype";

// This file is auto-generated by truss: https://github.com/homebound-team/truss.

/** Given a type X, and the user's proposed type T, only allow keys in X and nothing else. */
export type Only<X, T> = X & Record<Exclude<keyof T, keyof X>, never>;

export type Properties = Properties1;

export type Typography = "f10" | "f12" | "f14" | "f24" | "tiny";

type Opts<T> = { rules: T; enabled: boolean; important: boolean; selector: string | undefined };

// prettier-ignore
class CssBuilder<T extends Properties1> {
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

  // border
  get ba() {
    return this.add("borderStyle", "solid").add("borderWidth", "1px");
  }
  get bt() {
    return this.add("borderTopStyle", "solid").add("borderTopWidth", "1px");
  }
  get br() {
    return this.add("borderRightStyle", "solid").add("borderRightWidth", "1px");
  }
  get bb() {
    return this.add("borderBottomStyle", "solid").add("borderBottomWidth", "1px");
  }
  get bl() {
    return this.add("borderLeftStyle", "solid").add("borderLeftWidth", "1px");
  }
  get bn() {
    return this.add("borderStyle", "none").add("borderWidth", "0");
  }

  // borderColor
  get bBlack() {
    return this.add("borderColor", "#353535");
  }
  get bMidGray() {
    return this.add("borderColor", "#888888");
  }
  get bLightGray() {
    return this.add("borderColor", "#cecece");
  }
  get bWhite() {
    return this.add("borderColor", "#fcfcfa");
  }
  get bBlue() {
    return this.add("borderColor", "#526675");
  }
  get bBlueFaded() {
    return this.add("borderColor", "rgba(82, 102, 117, 0.3)");
  }
  get bHollow() {
    return this.add("borderColor", "rgba(0, 0, 0, 0)");
  }
  bc(value: Properties["borderColor"]) {
    return this.add("borderColor", value);
  }

  // borderRadius
  get br0() {
    return this.add("borderRadius", "0");
  }
  get br1() {
    return this.add("borderRadius", ".125rem");
  }
  get br2() {
    return this.add("borderRadius", ".25rem");
  }
  get br3() {
    return this.add("borderRadius", ".5rem");
  }
  get br4() {
    return this.add("borderRadius", "1rem");
  }
  get br100() {
    return this.add("borderRadius", "100%");
  }
  get brPill() {
    return this.add("borderRadius", "9999px");
  }
  borderRadius(value: Properties["borderRadius"]) {
    return this.add("borderRadius", value);
  }

  // borderStyle
  get bsDashed() {
    return this.add("borderStyle", "dashed");
  }
  get bsDotted() {
    return this.add("borderStyle", "dotted");
  }
  get bsNone() {
    return this.add("borderStyle", "none");
  }
  get bsSolid() {
    return this.add("borderStyle", "solid");
  }
  bs(value: Properties["borderStyle"]) {
    return this.add("borderStyle", value);
  }

  // borderWidth
  get bw1() {
    return this.add("borderWidth", "1px");
  }
  get bw2() {
    return this.add("borderWidth", "2px");
  }
  bw(value: Properties["borderWidth"]) {
    return this.add("borderWidth", value);
  }

  // boxShadow
  get shadowNone() {
    return this.add("boxShadow", "none");
  }

  // coordinates
  get top0() {
    return this.top(0);
  }
  get top1() {
    return this.top(1);
  }
  get top2() {
    return this.top(2);
  }
  get top3() {
    return this.top(3);
  }
  get top4() {
    return this.top(4);
  }
  get top5() {
    return this.top(5);
  }
  get top6() {
    return this.top(6);
  }
  get top7() {
    return this.top(7);
  }
  top(inc: number | string) {
    return this.add("top", maybeInc(inc));
  }
  topPx(px: number) {
    return this.top(`${px}px`);
  }
  get right0() {
    return this.right(0);
  }
  get right1() {
    return this.right(1);
  }
  get right2() {
    return this.right(2);
  }
  get right3() {
    return this.right(3);
  }
  get right4() {
    return this.right(4);
  }
  get right5() {
    return this.right(5);
  }
  get right6() {
    return this.right(6);
  }
  get right7() {
    return this.right(7);
  }
  right(inc: number | string) {
    return this.add("right", maybeInc(inc));
  }
  rightPx(px: number) {
    return this.right(`${px}px`);
  }
  get bottom0() {
    return this.bottom(0);
  }
  get bottom1() {
    return this.bottom(1);
  }
  get bottom2() {
    return this.bottom(2);
  }
  get bottom3() {
    return this.bottom(3);
  }
  get bottom4() {
    return this.bottom(4);
  }
  get bottom5() {
    return this.bottom(5);
  }
  get bottom6() {
    return this.bottom(6);
  }
  get bottom7() {
    return this.bottom(7);
  }
  bottom(inc: number | string) {
    return this.add("bottom", maybeInc(inc));
  }
  bottomPx(px: number) {
    return this.bottom(`${px}px`);
  }
  get left0() {
    return this.left(0);
  }
  get left1() {
    return this.left(1);
  }
  get left2() {
    return this.left(2);
  }
  get left3() {
    return this.left(3);
  }
  get left4() {
    return this.left(4);
  }
  get left5() {
    return this.left(5);
  }
  get left6() {
    return this.left(6);
  }
  get left7() {
    return this.left(7);
  }
  left(inc: number | string) {
    return this.add("left", maybeInc(inc));
  }
  leftPx(px: number) {
    return this.left(`${px}px`);
  }

  // cursor
  get cursorPointer() {
    return this.add("cursor", "pointer");
  }
  get cursorNotAllowed() {
    return this.add("cursor", "not-allowed");
  }
  cursor(value: Properties["cursor"]) {
    return this.add("cursor", value);
  }

  // display
  get dn() {
    return this.add("display", "none");
  }
  get db() {
    return this.add("display", "block");
  }
  get dib() {
    return this.add("display", "inline-block");
  }
  get dit() {
    return this.add("display", "inline-table");
  }
  get dt() {
    return this.add("display", "table");
  }
  get dtc() {
    return this.add("display", "table-cell");
  }
  get dtRow() {
    return this.add("display", "table-row");
  }
  get dtColumn() {
    return this.add("display", "table-column");
  }
  get dtColumnGroup() {
    return this.add("display", "table-column-group");
  }
  get dg() {
    return this.add("display", "grid");
  }
  get dig() {
    return this.add("display", "inline-grid");
  }
  get df() {
    return this.add("display", "flex");
  }
  get dif() {
    return this.add("display", "inline-flex");
  }
  display(value: Properties["display"]) {
    return this.add("display", value);
  }

  // flexbox
  get fi() {
    return this.add("flex", "initial");
  }
  get fa() {
    return this.add("flex", "auto");
  }
  get fn() {
    return this.add("flex", "none");
  }
  get f1() {
    return this.add("flex", "1");
  }
  get f2() {
    return this.add("flex", "2");
  }
  get f3() {
    return this.add("flex", "3");
  }
  get f4() {
    return this.add("flex", "4");
  }
  get f5() {
    return this.add("flex", "5");
  }
  f(value: Properties["flex"]) {
    return this.add("flex", value);
  }
  get jcfs() {
    return this.add("justifyContent", "flex-start");
  }
  get jcfe() {
    return this.add("justifyContent", "flex-end");
  }
  get jcc() {
    return this.add("justifyContent", "center");
  }
  get jcsb() {
    return this.add("justifyContent", "space-between");
  }
  get jcsa() {
    return this.add("justifyContent", "space-around");
  }
  get jcse() {
    return this.add("justifyContent", "space-evenly");
  }
  jc(value: Properties["justifyContent"]) {
    return this.add("justifyContent", value);
  }
  get jifs() {
    return this.add("justifyItems", "flex-start");
  }
  get jife() {
    return this.add("justifyItems", "flex-end");
  }
  get jic() {
    return this.add("justifyItems", "center");
  }
  get jisb() {
    return this.add("justifyItems", "space-between");
  }
  get jisa() {
    return this.add("justifyItems", "space-around");
  }
  get jise() {
    return this.add("justifyItems", "space-evenly");
  }
  ji(value: Properties["justifyItems"]) {
    return this.add("justifyItems", value);
  }
  get asfs() {
    return this.add("alignSelf", "flex-start");
  }
  get asfe() {
    return this.add("alignSelf", "flex-end");
  }
  get asc() {
    return this.add("alignSelf", "center");
  }
  get asb() {
    return this.add("alignSelf", "baseline");
  }
  get asStretch() {
    return this.add("alignSelf", "stretch");
  }
  as(value: Properties["alignSelf"]) {
    return this.add("alignSelf", value);
  }
  get aifs() {
    return this.add("alignItems", "flex-start");
  }
  get aife() {
    return this.add("alignItems", "flex-end");
  }
  get aic() {
    return this.add("alignItems", "center");
  }
  get aib() {
    return this.add("alignItems", "baseline");
  }
  get ais() {
    return this.add("alignItems", "stretch");
  }
  ai(value: Properties["alignItems"]) {
    return this.add("alignItems", value);
  }
  get fb1() {
    return this.add("flexBasis", "100%");
  }
  get fb2() {
    return this.add("flexBasis", "50%");
  }
  get fb3() {
    return this.add("flexBasis", "33.333333%");
  }
  get fb4() {
    return this.add("flexBasis", "25%");
  }
  get fb5() {
    return this.add("flexBasis", "20%");
  }
  get fb6() {
    return this.add("flexBasis", "16.666666%");
  }
  get fb7() {
    return this.add("flexBasis", "14.285714%");
  }
  get fb0() {
    return this.add("flexBasis", "12.5%");
  }
  fb(value: Properties["flexBasis"]) {
    return this.add("flexBasis", value);
  }
  get flexAuto() {
    return this.add("flex", "auto");
  }
  get flexNone() {
    return this.add("flex", "none");
  }
  flex(value: Properties["flex"]) {
    return this.add("flex", value);
  }
  get fg0() {
    return this.add("flexGrow", 0);
  }
  get fg1() {
    return this.add("flexGrow", 1);
  }
  flexGrow(value: Properties["flexGrow"]) {
    return this.add("flexGrow", value);
  }
  get fs0() {
    return this.add("flexShrink", 0);
  }
  get fs1() {
    return this.add("flexShrink", 1);
  }
  flexShrink(value: Properties["flexShrink"]) {
    return this.add("flexShrink", value);
  }
  get fdr() {
    return this.add("flexDirection", "row");
  }
  get fdrr() {
    return this.add("flexDirection", "row-reverse");
  }
  get fdc() {
    return this.add("flexDirection", "column");
  }
  get fdcr() {
    return this.add("flexDirection", "column-reverse");
  }
  fd(value: Properties["flexDirection"]) {
    return this.add("flexDirection", value);
  }

  // float
  get fl() {
    return this.add("float", "left");
  }
  get fr() {
    return this.add("float", "right");
  }
  float(value: Properties["float"]) {
    return this.add("float", value);
  }

  // fontWeight
  get normal() {
    return this.add("fontWeight", "normal");
  }
  get b() {
    return this.add("fontWeight", "bold");
  }
  get fw1() {
    return this.add("fontWeight", 100);
  }
  get fw2() {
    return this.add("fontWeight", 200);
  }
  get fw3() {
    return this.add("fontWeight", 300);
  }
  get fw4() {
    return this.add("fontWeight", 400);
  }
  get fw5() {
    return this.add("fontWeight", 500);
  }
  get fw6() {
    return this.add("fontWeight", 600);
  }
  get fw7() {
    return this.add("fontWeight", 700);
  }
  get fw8() {
    return this.add("fontWeight", 800);
  }
  get fw9() {
    return this.add("fontWeight", 900);
  }
  fw(value: Properties["fontWeight"]) {
    return this.add("fontWeight", value);
  }

  // grid
  gtc(value: Properties["gridTemplateColumns"]) {
    return this.add("gridTemplateColumns", value);
  }
  gtr(value: Properties["gridTemplateRows"]) {
    return this.add("gridTemplateRows", value);
  }
  gr(value: Properties["gridRow"]) {
    return this.add("gridRow", value);
  }
  gc(value: Properties["gridColumn"]) {
    return this.add("gridColumn", value);
  }
  get gap0() {
    return this.gap(0);
  }
  get gap1() {
    return this.gap(1);
  }
  get gap2() {
    return this.gap(2);
  }
  get gap3() {
    return this.gap(3);
  }
  get gap4() {
    return this.gap(4);
  }
  get gap5() {
    return this.gap(5);
  }
  get gap6() {
    return this.gap(6);
  }
  get gap7() {
    return this.gap(7);
  }
  gap(inc: number | string) {
    return this.add("gap", maybeInc(inc));
  }
  gapPx(px: number) {
    return this.gap(`${px}px`);
  }
  get rg0() {
    return this.rg(0);
  }
  get rg1() {
    return this.rg(1);
  }
  get rg2() {
    return this.rg(2);
  }
  get rg3() {
    return this.rg(3);
  }
  get rg4() {
    return this.rg(4);
  }
  get rg5() {
    return this.rg(5);
  }
  get rg6() {
    return this.rg(6);
  }
  get rg7() {
    return this.rg(7);
  }
  rg(inc: number | string) {
    return this.add("rowGap", maybeInc(inc));
  }
  rgPx(px: number) {
    return this.rg(`${px}px`);
  }
  get cg0() {
    return this.cg(0);
  }
  get cg1() {
    return this.cg(1);
  }
  get cg2() {
    return this.cg(2);
  }
  get cg3() {
    return this.cg(3);
  }
  get cg4() {
    return this.cg(4);
  }
  get cg5() {
    return this.cg(5);
  }
  get cg6() {
    return this.cg(6);
  }
  get cg7() {
    return this.cg(7);
  }
  cg(inc: number | string) {
    return this.add("columnGap", maybeInc(inc));
  }
  cgPx(px: number) {
    return this.cg(`${px}px`);
  }

  // height
  get h0() {
    return this.h(0);
  }
  get h1() {
    return this.h(1);
  }
  get h2() {
    return this.h(2);
  }
  get h3() {
    return this.h(3);
  }
  get h4() {
    return this.h(4);
  }
  get h5() {
    return this.h(5);
  }
  get h6() {
    return this.h(6);
  }
  get h7() {
    return this.h(7);
  }
  h(inc: number | string) {
    return this.add("height", maybeInc(inc));
  }
  hPx(px: number) {
    return this.h(`${px}px`);
  }
  get h25() {
    return this.add("height", "25%");
  }
  get h50() {
    return this.add("height", "50%");
  }
  get h75() {
    return this.add("height", "75%");
  }
  get h100() {
    return this.add("height", "100%");
  }
  get vh25() {
    return this.add("height", "25vh");
  }
  get vh50() {
    return this.add("height", "50vh");
  }
  get vh75() {
    return this.add("height", "75vh");
  }
  get vh100() {
    return this.add("height", "100vh");
  }
  get mh0() {
    return this.add("minHeight", 0);
  }
  get mh25() {
    return this.add("minHeight", "25%");
  }
  get mh50() {
    return this.add("minHeight", "50%");
  }
  get mh75() {
    return this.add("minHeight", "75%");
  }
  get mh100() {
    return this.add("minHeight", "100%");
  }
  get mvh100() {
    return this.add("minHeight", "100vh");
  }
  mh(value: Properties["minHeight"]) {
    return this.add("minHeight", value);
  }
  mhPx(px: number) {
    return this.add("minHeight", `${px}px`);
  }
  get maxh0() {
    return this.add("maxHeight", "0");
  }
  get maxh25() {
    return this.add("maxHeight", "25%");
  }
  get maxh50() {
    return this.add("maxHeight", "50%");
  }
  get maxh75() {
    return this.add("maxHeight", "75%");
  }
  get maxh100() {
    return this.add("maxHeight", "100%");
  }
  maxh(value: Properties["maxHeight"]) {
    return this.add("maxHeight", value);
  }
  maxhPx(px: number) {
    return this.add("maxHeight", `${px}px`);
  }

  // lineClamp
  get lineClamp1() {
    return this.add("overflow", "hidden").add("display", "-webkit-box").add("WebkitBoxOrient", "vertical").add(
      "WebkitLineClamp",
      1,
    ).add("textOverflow", "ellipsis");
  }
  get lineClamp2() {
    return this.add("overflow", "hidden").add("display", "-webkit-box").add("WebkitBoxOrient", "vertical").add(
      "WebkitLineClamp",
      2,
    ).add("textOverflow", "ellipsis");
  }
  get lineClamp3() {
    return this.add("overflow", "hidden").add("display", "-webkit-box").add("WebkitBoxOrient", "vertical").add(
      "WebkitLineClamp",
      3,
    ).add("textOverflow", "ellipsis");
  }
  get lineClamp4() {
    return this.add("overflow", "hidden").add("display", "-webkit-box").add("WebkitBoxOrient", "vertical").add(
      "WebkitLineClamp",
      4,
    ).add("textOverflow", "ellipsis");
  }
  get lineClamp5() {
    return this.add("overflow", "hidden").add("display", "-webkit-box").add("WebkitBoxOrient", "vertical").add(
      "WebkitLineClamp",
      5,
    ).add("textOverflow", "ellipsis");
  }
  get lineClamp6() {
    return this.add("overflow", "hidden").add("display", "-webkit-box").add("WebkitBoxOrient", "vertical").add(
      "WebkitLineClamp",
      6,
    ).add("textOverflow", "ellipsis");
  }
  get lineClampNone() {
    return this.add("WebkitLineClamp", "unset");
  }

  // objectFit
  get objectContain() {
    return this.add("objectFit", "contain");
  }
  get objectCover() {
    return this.add("objectFit", "cover");
  }
  get objectFill() {
    return this.add("objectFit", "fill");
  }
  get objectNone() {
    return this.add("objectFit", "none");
  }
  get objectScaleDown() {
    return this.add("objectFit", "scale-down");
  }
  objectFit(value: Properties["objectFit"]) {
    return this.add("objectFit", value);
  }

  // outline
  get outline1() {
    return this.add("outline", "1px solid");
  }
  get outlineTransparent() {
    return this.add("outline", "1px solid transparent");
  }
  get outline0() {
    return this.add("outline", "0");
  }
  outline(value: Properties["outline"]) {
    return this.add("outline", value);
  }

  // overflow
  get overflowVisible() {
    return this.add("overflow", "visible");
  }
  get overflowHidden() {
    return this.add("overflow", "hidden");
  }
  get overflowScroll() {
    return this.add("overflow", "scroll");
  }
  get overflowAuto() {
    return this.add("overflow", "auto");
  }
  overflow(value: Properties["overflow"]) {
    return this.add("overflow", value);
  }
  get overflowYVisible() {
    return this.add("overflowY", "visible");
  }
  get overflowYHidden() {
    return this.add("overflowY", "hidden");
  }
  get overflowYScroll() {
    return this.add("overflowY", "scroll");
  }
  get overflowYAuto() {
    return this.add("overflowY", "auto");
  }
  overflowY(value: Properties["overflowY"]) {
    return this.add("overflowY", value);
  }
  get overflowXVisible() {
    return this.add("overflowX", "visible");
  }
  get overflowXHidden() {
    return this.add("overflowX", "hidden");
  }
  get overflowXScroll() {
    return this.add("overflowX", "scroll");
  }
  get overflowXAuto() {
    return this.add("overflowX", "auto");
  }
  overflowX(value: Properties["overflowX"]) {
    return this.add("overflowX", value);
  }

  // position
  get absolute() {
    return this.add("position", "absolute");
  }
  get fixed() {
    return this.add("position", "fixed");
  }
  get static() {
    return this.add("position", "static");
  }
  get relative() {
    return this.add("position", "relative");
  }
  get sticky() {
    return this.add("position", "sticky");
  }
  position(value: Properties["position"]) {
    return this.add("position", value);
  }

  // skins
  get black() {
    return this.add("color", "#353535");
  }
  get midGray() {
    return this.add("color", "#888888");
  }
  get lightGray() {
    return this.add("color", "#cecece");
  }
  get white() {
    return this.add("color", "#fcfcfa");
  }
  get blue() {
    return this.add("color", "#526675");
  }
  get blueFaded() {
    return this.add("color", "rgba(82, 102, 117, 0.3)");
  }
  get hollow() {
    return this.add("color", "rgba(0, 0, 0, 0)");
  }
  color(value: Properties["color"]) {
    return this.add("color", value);
  }
  get bgBlack() {
    return this.add("backgroundColor", "#353535");
  }
  get bgMidGray() {
    return this.add("backgroundColor", "#888888");
  }
  get bgLightGray() {
    return this.add("backgroundColor", "#cecece");
  }
  get bgWhite() {
    return this.add("backgroundColor", "#fcfcfa");
  }
  get bgBlue() {
    return this.add("backgroundColor", "#526675");
  }
  get bgBlueFaded() {
    return this.add("backgroundColor", "rgba(82, 102, 117, 0.3)");
  }
  get bgHollow() {
    return this.add("backgroundColor", "rgba(0, 0, 0, 0)");
  }
  bgColor(value: Properties["backgroundColor"]) {
    return this.add("backgroundColor", value);
  }
  get fBlack() {
    return this.add("fill", "#353535");
  }
  get fMidGray() {
    return this.add("fill", "#888888");
  }
  get fLightGray() {
    return this.add("fill", "#cecece");
  }
  get fWhite() {
    return this.add("fill", "#fcfcfa");
  }
  get fBlue() {
    return this.add("fill", "#526675");
  }
  get fBlueFaded() {
    return this.add("fill", "rgba(82, 102, 117, 0.3)");
  }
  get fHollow() {
    return this.add("fill", "rgba(0, 0, 0, 0)");
  }
  fill(value: Properties["fill"]) {
    return this.add("fill", value);
  }

  // spacing
  get mt0() {
    return this.mt(0);
  }
  get mt1() {
    return this.mt(1);
  }
  get mt2() {
    return this.mt(2);
  }
  get mt3() {
    return this.mt(3);
  }
  get mt4() {
    return this.mt(4);
  }
  get mt5() {
    return this.mt(5);
  }
  get mt6() {
    return this.mt(6);
  }
  get mt7() {
    return this.mt(7);
  }
  mt(inc: number | string) {
    return this.add("marginTop", maybeInc(inc));
  }
  mtPx(px: number) {
    return this.mt(`${px}px`);
  }
  get mr0() {
    return this.mr(0);
  }
  get mr1() {
    return this.mr(1);
  }
  get mr2() {
    return this.mr(2);
  }
  get mr3() {
    return this.mr(3);
  }
  get mr4() {
    return this.mr(4);
  }
  get mr5() {
    return this.mr(5);
  }
  get mr6() {
    return this.mr(6);
  }
  get mr7() {
    return this.mr(7);
  }
  mr(inc: number | string) {
    return this.add("marginRight", maybeInc(inc));
  }
  mrPx(px: number) {
    return this.mr(`${px}px`);
  }
  get mb0() {
    return this.mb(0);
  }
  get mb1() {
    return this.mb(1);
  }
  get mb2() {
    return this.mb(2);
  }
  get mb3() {
    return this.mb(3);
  }
  get mb4() {
    return this.mb(4);
  }
  get mb5() {
    return this.mb(5);
  }
  get mb6() {
    return this.mb(6);
  }
  get mb7() {
    return this.mb(7);
  }
  mb(inc: number | string) {
    return this.add("marginBottom", maybeInc(inc));
  }
  mbPx(px: number) {
    return this.mb(`${px}px`);
  }
  get ml0() {
    return this.ml(0);
  }
  get ml1() {
    return this.ml(1);
  }
  get ml2() {
    return this.ml(2);
  }
  get ml3() {
    return this.ml(3);
  }
  get ml4() {
    return this.ml(4);
  }
  get ml5() {
    return this.ml(5);
  }
  get ml6() {
    return this.ml(6);
  }
  get ml7() {
    return this.ml(7);
  }
  ml(inc: number | string) {
    return this.add("marginLeft", maybeInc(inc));
  }
  mlPx(px: number) {
    return this.ml(`${px}px`);
  }
  get mx0() {
    return this.mx(0);
  }
  get mx1() {
    return this.mx(1);
  }
  get mx2() {
    return this.mx(2);
  }
  get mx3() {
    return this.mx(3);
  }
  get mx4() {
    return this.mx(4);
  }
  get mx5() {
    return this.mx(5);
  }
  get mx6() {
    return this.mx(6);
  }
  get mx7() {
    return this.mx(7);
  }
  mx(inc: number | string) {
    return this.ml(inc).mr(inc);
  }
  mxPx(px: number) {
    return this.mlPx(px).mrPx(px);
  }
  get my0() {
    return this.my(0);
  }
  get my1() {
    return this.my(1);
  }
  get my2() {
    return this.my(2);
  }
  get my3() {
    return this.my(3);
  }
  get my4() {
    return this.my(4);
  }
  get my5() {
    return this.my(5);
  }
  get my6() {
    return this.my(6);
  }
  get my7() {
    return this.my(7);
  }
  my(inc: number | string) {
    return this.mt(inc).mb(inc);
  }
  myPx(px: number) {
    return this.mtPx(px).mbPx(px);
  }
  get m0() {
    return this.m(0);
  }
  get m1() {
    return this.m(1);
  }
  get m2() {
    return this.m(2);
  }
  get m3() {
    return this.m(3);
  }
  get m4() {
    return this.m(4);
  }
  get m5() {
    return this.m(5);
  }
  get m6() {
    return this.m(6);
  }
  get m7() {
    return this.m(7);
  }
  m(inc: number | string) {
    return this.mt(inc).mb(inc).mr(inc).ml(inc);
  }
  mPx(px: number) {
    return this.mtPx(px).mbPx(px).mrPx(px).mlPx(px);
  }
  get pt0() {
    return this.pt(0);
  }
  get pt1() {
    return this.pt(1);
  }
  get pt2() {
    return this.pt(2);
  }
  get pt3() {
    return this.pt(3);
  }
  get pt4() {
    return this.pt(4);
  }
  get pt5() {
    return this.pt(5);
  }
  get pt6() {
    return this.pt(6);
  }
  get pt7() {
    return this.pt(7);
  }
  pt(inc: number | string) {
    return this.add("paddingTop", maybeInc(inc));
  }
  ptPx(px: number) {
    return this.pt(`${px}px`);
  }
  get pr0() {
    return this.pr(0);
  }
  get pr1() {
    return this.pr(1);
  }
  get pr2() {
    return this.pr(2);
  }
  get pr3() {
    return this.pr(3);
  }
  get pr4() {
    return this.pr(4);
  }
  get pr5() {
    return this.pr(5);
  }
  get pr6() {
    return this.pr(6);
  }
  get pr7() {
    return this.pr(7);
  }
  pr(inc: number | string) {
    return this.add("paddingRight", maybeInc(inc));
  }
  prPx(px: number) {
    return this.pr(`${px}px`);
  }
  get pb0() {
    return this.pb(0);
  }
  get pb1() {
    return this.pb(1);
  }
  get pb2() {
    return this.pb(2);
  }
  get pb3() {
    return this.pb(3);
  }
  get pb4() {
    return this.pb(4);
  }
  get pb5() {
    return this.pb(5);
  }
  get pb6() {
    return this.pb(6);
  }
  get pb7() {
    return this.pb(7);
  }
  pb(inc: number | string) {
    return this.add("paddingBottom", maybeInc(inc));
  }
  pbPx(px: number) {
    return this.pb(`${px}px`);
  }
  get pl0() {
    return this.pl(0);
  }
  get pl1() {
    return this.pl(1);
  }
  get pl2() {
    return this.pl(2);
  }
  get pl3() {
    return this.pl(3);
  }
  get pl4() {
    return this.pl(4);
  }
  get pl5() {
    return this.pl(5);
  }
  get pl6() {
    return this.pl(6);
  }
  get pl7() {
    return this.pl(7);
  }
  pl(inc: number | string) {
    return this.add("paddingLeft", maybeInc(inc));
  }
  plPx(px: number) {
    return this.pl(`${px}px`);
  }
  get px0() {
    return this.px(0);
  }
  get px1() {
    return this.px(1);
  }
  get px2() {
    return this.px(2);
  }
  get px3() {
    return this.px(3);
  }
  get px4() {
    return this.px(4);
  }
  get px5() {
    return this.px(5);
  }
  get px6() {
    return this.px(6);
  }
  get px7() {
    return this.px(7);
  }
  px(inc: number | string) {
    return this.pl(inc).pr(inc);
  }
  pxPx(px: number) {
    return this.plPx(px).prPx(px);
  }
  get py0() {
    return this.py(0);
  }
  get py1() {
    return this.py(1);
  }
  get py2() {
    return this.py(2);
  }
  get py3() {
    return this.py(3);
  }
  get py4() {
    return this.py(4);
  }
  get py5() {
    return this.py(5);
  }
  get py6() {
    return this.py(6);
  }
  get py7() {
    return this.py(7);
  }
  py(inc: number | string) {
    return this.pt(inc).pb(inc);
  }
  pyPx(px: number) {
    return this.ptPx(px).pbPx(px);
  }
  get p0() {
    return this.p(0);
  }
  get p1() {
    return this.p(1);
  }
  get p2() {
    return this.p(2);
  }
  get p3() {
    return this.p(3);
  }
  get p4() {
    return this.p(4);
  }
  get p5() {
    return this.p(5);
  }
  get p6() {
    return this.p(6);
  }
  get p7() {
    return this.p(7);
  }
  p(inc: number | string) {
    return this.pt(inc).pb(inc).pr(inc).pl(inc);
  }
  pPx(px: number) {
    return this.ptPx(px).pbPx(px).prPx(px).plPx(px);
  }

  // textAlign
  get tl() {
    return this.add("textAlign", "left");
  }
  get tc() {
    return this.add("textAlign", "center");
  }
  get tr() {
    return this.add("textAlign", "right");
  }
  get tj() {
    return this.add("textAlign", "justify");
  }
  ta(value: Properties["textAlign"]) {
    return this.add("textAlign", value);
  }

  // textDecoration
  get noUnderline() {
    return this.add("textDecoration", "none");
  }
  get strike() {
    return this.add("textDecoration", "line-through");
  }
  get underline() {
    return this.add("textDecoration", "underline");
  }
  textDecoration(value: Properties["textDecoration"]) {
    return this.add("textDecoration", value);
  }

  // textTransform
  get ttc() {
    return this.add("textTransform", "capitalize");
  }
  get ttl() {
    return this.add("textTransform", "lowercase");
  }
  get ttu() {
    return this.add("textTransform", "uppercase");
  }
  get ttn() {
    return this.add("textTransform", "none");
  }
  tt(value: Properties["textTransform"]) {
    return this.add("textTransform", value);
  }

  // typeScale
  get f10() {
    return this.add("fontSize", "10px");
  }
  get f12() {
    return this.add("fontSize", "12px");
  }
  get f14() {
    return this.add("fontSize", "14px");
  }
  get f24() {
    return this.add("fontSize", "24px");
  }
  get tiny() {
    return this.add("fontWeight", 400).add("fontSize", "10px").add("lineHeight", "14px");
  }

  // typography
  get measure() {
    return this.add("maxWidth", "30em");
  }
  get measureWide() {
    return this.add("maxWidth", "34em");
  }
  get measureNarrow() {
    return this.add("maxWidth", "20em");
  }
  get indent() {
    return this.add("textIndent", "1em").add("marginTop", 0).add("marginBottom", 0);
  }
  get smallCaps() {
    return this.add("fontVariant", "small-caps");
  }
  get truncate() {
    return this.add("whiteSpace", "nowrap").add("overflow", "hidden").add("textOverflow", "ellipsis");
  }
  lh(value: Properties["lineHeight"]) {
    return this.add("lineHeight", value);
  }

  // userSelect
  get selectNone() {
    return this.add("userSelect", "none");
  }
  get selectText() {
    return this.add("userSelect", "text");
  }
  get selectAll() {
    return this.add("userSelect", "all");
  }
  get selectAuto() {
    return this.add("userSelect", "auto");
  }
  select(value: Properties["userSelect"]) {
    return this.add("userSelect", value);
  }

  // verticalAlign
  get vBase() {
    return this.add("verticalAlign", "baseline");
  }
  get vMid() {
    return this.add("verticalAlign", "middle");
  }
  get vTop() {
    return this.add("verticalAlign", "top");
  }
  get vBottom() {
    return this.add("verticalAlign", "bottom");
  }
  va(value: Properties["verticalAlign"]) {
    return this.add("verticalAlign", value);
  }

  // visibility
  get visible() {
    return this.add("visibility", "visible");
  }
  get invisible() {
    return this.add("visibility", "hidden");
  }
  visibility(value: Properties["visibility"]) {
    return this.add("visibility", value);
  }

  // whitespace
  get nowrap() {
    return this.add("whiteSpace", "nowrap");
  }
  get pre() {
    return this.add("whiteSpace", "pre");
  }
  get wsNormal() {
    return this.add("whiteSpace", "normal");
  }
  whiteSpace(value: Properties["whiteSpace"]) {
    return this.add("whiteSpace", value);
  }

  // width
  get w25() {
    return this.add("width", "25%");
  }
  get w50() {
    return this.add("width", "50%");
  }
  get w75() {
    return this.add("width", "75%");
  }
  get w100() {
    return this.add("width", "100%");
  }
  get mw0() {
    return this.add("minWidth", 0);
  }
  get mw25() {
    return this.add("minWidth", "25%");
  }
  get mw50() {
    return this.add("minWidth", "50%");
  }
  get mw75() {
    return this.add("minWidth", "75%");
  }
  get mw100() {
    return this.add("minWidth", "100%");
  }
  mw(value: Properties["minWidth"]) {
    return this.add("minWidth", value);
  }
  mwPx(px: number) {
    return this.mw(`${px}px`);
  }
  get maxw0() {
    return this.add("maxWidth", "0");
  }
  get maxw25() {
    return this.add("maxWidth", "25%");
  }
  get maxw50() {
    return this.add("maxWidth", "50%");
  }
  get maxw75() {
    return this.add("maxWidth", "75%");
  }
  get maxw100() {
    return this.add("maxWidth", "100%");
  }
  maxw(value: Properties["maxWidth"]) {
    return this.add("maxWidth", value);
  }
  maxwPx(px: number) {
    return this.maxw(`${px}px`);
  }
  get w0() {
    return this.w(0);
  }
  get w1() {
    return this.w(1);
  }
  get w2() {
    return this.w(2);
  }
  get w3() {
    return this.w(3);
  }
  get w4() {
    return this.w(4);
  }
  get w5() {
    return this.w(5);
  }
  get w6() {
    return this.w(6);
  }
  get w7() {
    return this.w(7);
  }
  w(inc: number | string) {
    return this.add("width", maybeInc(inc));
  }
  wPx(px: number) {
    return this.w(`${px}px`);
  }

  // wordBreak
  get breakNormal() {
    return this.add("wordBreak", "normal");
  }
  get breakAll() {
    return this.add("wordBreak", "break-all");
  }
  get breakKeepAll() {
    return this.add("wordBreak", "keep-all");
  }
  get breakWord() {
    return this.add("wordBreak", "break-word");
  }
  wordBreak(value: Properties["wordBreak"]) {
    return this.add("wordBreak", value);
  }

  // zIndex
  get z0() {
    return this.add("zIndex", 0);
  }
  get z1() {
    return this.add("zIndex", 1);
  }
  get z2() {
    return this.add("zIndex", 2);
  }
  get z3() {
    return this.add("zIndex", 3);
  }
  get z4() {
    return this.add("zIndex", 4);
  }
  get z5() {
    return this.add("zIndex", 5);
  }
  get z999() {
    return this.add("zIndex", 999);
  }
  get z9999() {
    return this.add("zIndex", 9999);
  }
  get zInherit() {
    return this.add("zIndex", "inherit");
  }
  get zInitial() {
    return this.add("zIndex", "initial");
  }
  get zUnset() {
    return this.add("zIndex", "unset");
  }
  z(value: Properties["zIndex"]) {
    return this.add("zIndex", value);
  }

  // customStuff
  get foo() {
    return this.add("color", "#000000");
  }

  // aliases
  get bodyText() {
    return this.f14.black;
  }

  get $(): T {
    return maybeImportant(sortObject(this.rules), this.opts.important);
  }

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

  get important() {
    return this.newCss({ important: true });
  }

  /** Adds new properties, either a specific key/value or a Properties object, to the current css. */
  add<P extends Properties>(props: P): CssBuilder<T & P>;
  add<K extends keyof Properties>(prop: K, value: Properties[K]): CssBuilder<T & { [U in K]: Properties[K] }>;
  add<K extends keyof Properties>(propOrProperties: K | Properties, value?: Properties[K]): CssBuilder<any> {
    const newRules = typeof propOrProperties === "string" ? { [propOrProperties]: value } : propOrProperties;
    const rules = this.selector
      ? { ...this.rules, [this.selector]: { ...(this.rules as any)[this.selector], ...newRules } }
      : this.enabled
      ? { ...this.rules, ...newRules }
      : this.rules;
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
  return inc * 6;
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
  BlueFaded = "rgba(82, 102, 117, 0.3)",
  Hollow = "rgba(0, 0, 0, 0)",
}

/** A shortcut for defining Xss types. */
export type Xss<P extends keyof Properties> = Pick<Properties, P>;

/** An entry point for Css expressions. CssBuilder is immutable so this is safe to share. */
export const Css = new CssBuilder({ rules: {}, enabled: true, important: false, selector: undefined });

export type Margin = "margin" | "marginTop" | "marginRight" | "marginBottom" | "marginLeft";

export type Padding = "padding" | "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft";

type Brand<K, T> = K & { __brand: T };
type Breakpoint = Brand<string, "Breakpoint">;
export type BreakpointKey = "print" | "sm" | "md" | "smOrMd" | "mdAndUp" | "mdAndDown" | "lg" | "mdOrLg";
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
export const print = "@media print" as Breakpoint;
export const sm = "@media screen and (max-width:599px)" as Breakpoint;
export const md = "@media screen and (min-width:600px) and (max-width:959px)" as Breakpoint;
export const smOrMd = "@media screen and (max-width:959px)" as Breakpoint;
export const mdAndUp = "@media screen and (min-width:600px)" as Breakpoint;
export const mdAndDown = "@media screen and (max-width:959px)" as Breakpoint;
export const lg = "@media screen and (min-width:960px)" as Breakpoint;
export const mdOrLg = "@media screen and (min-width:600px)" as Breakpoint;
