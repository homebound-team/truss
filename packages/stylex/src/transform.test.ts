import { describe, test, expect } from "vitest";
import { transformTruss } from "./transform";
import { loadMapping } from "./index";
import { resolve } from "path";

const mapping = loadMapping(resolve(__dirname, "../../app-stylex/src/Css.json"));

describe("transform", () => {
  test("returns null for files without Css import", () => {
    expect(transform(`const x = 1;`)).toBeNull();
  });

  test("returns null for files that import Css but don't use .$", () => {
    expect(transform(`import { Css } from "./Css"; const x = Css.df;`)).toBeNull();
  });

  test("static chain: Css.df.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.df.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ df: { display: "flex" } });
        const s = [css.df];
      `),
    );
  });

  test("multi-getter chain: Css.df.aic.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.df.aic.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          df: { display: "flex" },
          aic: { alignItems: "center" }
        });
        const s = [css.df, css.aic];
      `),
    );
  });

  test("css prop on JSX: css={Css.df.$}", () => {
    expect(n(transform(`import { Css } from "./Css"; const el = <div css={Css.df.$} />;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ df: { display: "flex" } });
        const el = <div {...stylex.props(css.df)} />;
      `),
    );
  });

  test("css prop with multi-getter: css={Css.df.aic.black.$}", () => {
    expect(n(transform(`import { Css } from "./Css"; const el = <div css={Css.df.aic.black.$} />;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          df: { display: "flex" },
          aic: { alignItems: "center" },
          black: { color: "#353535" }
        });
        const el = <div {...stylex.props(css.df, css.aic, css.black)} />;
      `),
    );
  });

  test("dynamic with literal arg: Css.mt(2).$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.mt(2).$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ mt__16px: { marginTop: "16px" } });
        const s = [css.mt__16px];
      `),
    );
  });

  test("dynamic with string literal: Css.mt('10px').$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.mt("10px").$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ mt__10px: { marginTop: "10px" } });
        const s = [css.mt__10px];
      `),
    );
  });

  test("dynamic with variable arg: Css.mt(x).$", () => {
    expect(n(transform(`import { Css } from "./Css"; const x = getSomeValue(); const s = Css.mt(x).$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const __maybeInc = inc => { return typeof inc === "string" ? inc : \`\${inc * 8}px\`; };
        const css = stylex.create({ mt: v => ({ marginTop: v }) });
        const x = getSomeValue();
        const s = [css.mt(__maybeInc(x))];
      `),
    );
  });

  test("delegate with literal: Css.mtPx(12).$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.mtPx(12).$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ mt__12px: { marginTop: "12px" } });
        const s = [css.mt__12px];
      `),
    );
  });

  test("non-incremented dynamic: Css.bc('red').$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.bc("red").$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ bc__red: { borderColor: "red" } });
        const s = [css.bc__red];
      `),
    );
  });

  test("non-incremented dynamic with variable: Css.bc(color).$", () => {
    expect(n(transform(`import { Css } from "./Css"; const color = getColor(); const s = Css.bc(color).$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ bc: v => ({ borderColor: v }) });
        const color = getColor();
        const s = [css.bc(String(color))];
      `),
    );
  });

  test("multiple expressions dedup entries", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const a = <div css={Css.df.$} />; const b = <div css={Css.df.aic.$} />;`,
        )!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          df: { display: "flex" },
          aic: { alignItems: "center" }
        });
        const a = <div {...stylex.props(css.df)} />;
        const b = <div {...stylex.props(css.df, css.aic)} />;
      `),
    );
  });

  test("alias expansion: Css.bodyText.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.bodyText.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          f14: { fontSize: "14px" },
          black: { color: "#353535" }
        });
        const s = [css.f14, css.black];
      `),
    );
  });

  test("Css import is removed when only Css is imported", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.df.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ df: { display: "flex" } });
        const s = [css.df];
      `),
    );
  });

  test("Css specifier removed but Palette kept", () => {
    expect(n(transform(`import { Css, Palette } from "./Css"; const s = Css.df.$; const c = Palette.Black;`)!)).toBe(
      n(`
        import { Palette } from "./Css";
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ df: { display: "flex" } });
        const s = [css.df];
        const c = Palette.Black;
      `),
    );
  });

  test("multi-property static: Css.ba.$ (border)", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.ba.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ ba: { borderStyle: "solid", borderWidth: "1px" } });
        const s = [css.ba];
      `),
    );
  });

  test("mixed static and dynamic: Css.df.mt(2).black.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.df.mt(2).black.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          df: { display: "flex" },
          mt__16px: { marginTop: "16px" },
          black: { color: "#353535" }
        });
        const s = [css.df, css.mt__16px, css.black];
      `),
    );
  });

  test("onHover pseudo: Css.black.onHover.blue.$", () => {
    // base `black` and hover `blue` both set `color` — merged into one entry
    expect(n(transform(`import { Css } from "./Css"; const s = Css.black.onHover.blue.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          black_blue__hover: { color: { default: "#353535", ":hover": "#526675" } }
        });
        const s = [css.black_blue__hover];
      `),
    );
  });

  test("onHover with multi-property: Css.onHover.ba.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.onHover.ba.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          ba__hover: {
            borderStyle: { default: null, ":hover": "solid" },
            borderWidth: { default: null, ":hover": "1px" }
          }
        });
        const s = [css.ba__hover];
      `),
    );
  });

  test("onFocus pseudo: Css.onFocus.blue.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.onFocus.blue.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          blue__focus: { color: { default: null, ":focus": "#526675" } }
        });
        const s = [css.blue__focus];
      `),
    );
  });

  test("onHover with dynamic literal: Css.onHover.bc('red').$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.onHover.bc("red").$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          bc__red__hover: { borderColor: { default: null, ":hover": "red" } }
        });
        const s = [css.bc__red__hover];
      `),
    );
  });

  test("onHover with variable dynamic: Css.onHover.bc(color).$", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const color = getColor(); const s = Css.onHover.bc(color).$;`)!),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          bc__hover: v => ({ borderColor: { default: null, ":hover": v } })
        });
        const color = getColor();
        const s = [css.bc__hover(String(color))];
      `),
    );
  });

  test("spread pattern: css={[...Css.df.$, ...xss]}", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; function Box({ xss }) { return <div css={[...Css.df.$, ...xss]} />; }`,
        )!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ df: { display: "flex" } });
        function Box({ xss }) { return <div {...stylex.props(css.df, ...xss)} />; }
      `),
    );
  });

  test("conditional: Css.if(cond).df.else.db.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.if(isActive).df.else.db.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          df: { display: "flex" },
          db: { display: "block" }
        });
        const s = [isActive ? css.df : css.db];
      `),
    );
  });

  test("conditional with preceding styles: Css.p1.if(cond).df.else.db.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.p1.if(isActive).df.else.db.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          p1: { paddingTop: "8px", paddingBottom: "8px", paddingRight: "8px", paddingLeft: "8px" },
          df: { display: "flex" },
          db: { display: "block" }
        });
        const s = [css.p1, isActive ? css.df : css.db];
      `),
    );
  });

  test("else branch includes trailing styles: Css.if(cond).df.else.db.mt1.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.if(isActive).df.else.db.mt1.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          df: { display: "flex" },
          db: { display: "block" },
          mt1: { marginTop: "8px" }
        });
        const s = [...(isActive ? [css.df] : [css.db, css.mt1])];
      `),
    );
  });

  test("$ assigned to variable then used in css prop", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const base = Css.df.aic.$; const el = <div css={base} />;`)!),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          df: { display: "flex" },
          aic: { alignItems: "center" }
        });
        const base = [css.df, css.aic];
        const el = <div css={base} />;
      `),
    );
  });

  test("negative increment: Css.mt(-1).$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.mt(-1).$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ mt___8px: { marginTop: "-8px" } });
        const s = [css.mt___8px];
      `),
    );
  });

  test("increment zero: Css.mt(0).$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.mt(0).$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ mt__0px: { marginTop: "0px" } });
        const s = [css.mt__0px];
      `),
    );
  });

  test("static increment getters: Css.mt0.mt1.p1.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.mt0.mt1.p1.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          mt0: { marginTop: "0px" },
          mt1: { marginTop: "8px" },
          p1: { paddingTop: "8px", paddingBottom: "8px", paddingRight: "8px", paddingLeft: "8px" }
        });
        const s = [css.mt0, css.mt1, css.p1];
      `),
    );
  });

  test("className merging: css + className on same element", () => {
    expect(n(transform(`import { Css } from "./Css"; const el = <div className="existing" css={Css.df.$} />;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ df: { display: "flex" } });
        const el = <div {...(__r => ({ ...__r, className: ("existing" + " " + (__r.className || "")).trim() }))(stylex.props(css.df))} />;
      `),
    );
  });

  test("className merging: css + dynamic className expression", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const cls = getClass(); const el = <div className={cls} css={Css.df.$} />;`,
        )!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex"stylex.create({ mt: v => ({ marginTop: v }) });
        const css = stylex.create({ df: { display: "flex" } });
        const cls = getClass();
        const el = <div {...(__r => ({ ...__r, className: (cls + " " + (__r.className || "")).trim() }))(stylex.props(css.df))} />;
      `),
    );
  });

  test("falls back to css_ when css is already a binding", () => {
    expect(n(transform(`import { Css } from "./Css"; const css = someOtherThing(); const s = Css.df.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css_ = stylex.create({ df: { display: "flex" } });
        const css = someOtherThing();
        const s = [css_.df];
      `),
    );
  });

  test("falls back to css__1 when css and css_ are already bindings", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const css = someOtherThing(); const css_ = anotherThing(); const s = Css.df.$;`,
        )!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css__1 = stylex.create({ df: { display: "flex" } });
        const css = someOtherThing();
        const css_ = anotherThing();
        const s = [css__1.df];
      `),
    );
  });

  test("reuses existing stylex namespace import", () => {
    expect(
      n(
        transform(
          `import * as stylex from "@stylexjs/stylex"; import { Css } from "./Css"; const el = <div css={Css.df.$} />;`,
        )!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ df: { display: "flex" } });
        const el = <div {...stylex.props(css.df)} />;
      `),
    );
  });

  test("reuses existing stylex namespace alias", () => {
    expect(
      n(transform(`import * as sx from "@stylexjs/stylex"; import { Css } from "./Css"; const s = Css.df.$;`)!),
    ).toBe(
      n(`
        import * as sx from "@stylexjs/stylex";
        const css = sx.create({ df: { display: "flex" } });
        const s = [css.df];
      `),
    );
  });

  test("falls back for __maybeInc helper name collisions", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const __maybeInc = keepMe(); const x = getSomeValue(); const s = Css.mt(x).$;`,
        )!,
      ),
    ).toBe(
      n(
        `
        import * as stylex from "@stylexjs/stylex";
        const __maybeInc_1 = inc => { return typeof inc === "string" ? inc : \`\${inc * 8}px\`; };
        const css = stylex.create({ mt: v => ({ marginTop: v }) });
        const __maybeInc = keepMe();
        const x = getSomeValue();
        const s = [css.mt(__maybeInc_1(x))];
      `,
      ),
    );
  });

  test("onHover on same property merges base+pseudo into single entry", () => {
    // Css.bgBlue.onHover.bgBlack.$ — both set `backgroundColor`
    expect(n(transform(`import { Css } from "./Css"; const s = Css.bgBlue.onHover.bgBlack.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          bgBlue_bgBlack__hover: { backgroundColor: { default: "#526675", ":hover": "#353535" } }
        });
        const s = [css.bgBlue_bgBlack__hover];
      `),
    );
  });

  test("onHover merge: non-overlapping properties kept separate", () => {
    // Css.df.onHover.blue.$ — df sets display, blue sets color — no overlap
    expect(n(transform(`import { Css } from "./Css"; const s = Css.df.onHover.blue.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          df: { display: "flex" },
          blue__hover: { color: { default: null, ":hover": "#526675" } }
        });
        const s = [css.df, css.blue__hover];
      `),
    );
  });

  // ── Marker tests ────────────────────────────────────────────────────

  test("Css.marker.$ emits stylex.defaultMarker()", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.marker.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const s = [stylex.defaultMarker()];
      `),
    );
  });

  test("Css.marker.$ in JSX css prop emits stylex.props(stylex.defaultMarker())", () => {
    expect(n(transform(`import { Css } from "./Css"; function C() { return <div css={Css.marker.$} />; }`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        function C() { return <div {...stylex.props(stylex.defaultMarker())} />; }
      `),
    );
  });

  test("Css.marker.df.$ combines marker with styles", () => {
    expect(n(transform(`import { Css } from "./Css"; function C() { return <div css={Css.marker.df.$} />; }`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ df: { display: "flex" } });
        function C() { return <div {...stylex.props(stylex.defaultMarker(), css.df)} />; }
      `),
    );
  });

  test("Css.markerOf('row').$ emits named marker", () => {
    expect(
      n(transform(`import { Css } from "./Css"; function C() { return <div css={Css.markerOf("row").$} />; }`)!),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const __truss_marker_row = stylex.defineMarker();
        function C() { return <div {...stylex.props(__truss_marker_row)} />; }
      `),
    );
  });

  test("named marker declarations avoid top-level collisions", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const __truss_marker_row = 1; const s = Css.markerOf("row").$;`)!),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const __truss_marker_row_1 = stylex.defineMarker();
        const __truss_marker_row = 1;
        const s = [__truss_marker_row_1];
      `),
    );
  });

  test("Css.onHoverOf().blue.$ emits stylex.when.ancestor with default marker", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.onHoverOf().blue.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          blue__ancestorHover: { color: { default: null, [stylex.when.ancestor(":hover")]: "#526675" } }
        });
        const s = [css.blue__ancestorHover];
      `),
    );
  });

  test("Css.onHoverOf('row').blue.$ emits stylex.when.ancestor with named marker", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.onHoverOf("row").blue.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const __truss_marker_row = stylex.defineMarker();
        const css = stylex.create({
          blue__ancestorHover_row: { color: { default: null, [stylex.when.ancestor(":hover", __truss_marker_row)]: "#526675" } }
        });
        const s = [css.blue__ancestorHover_row];
      `),
    );
  });

  test("Css.onFocusOf().blue.$ emits stylex.when.ancestor(':focus')", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.onFocusOf().blue.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          blue__ancestorFocus: { color: { default: null, [stylex.when.ancestor(":focus")]: "#526675" } }
        });
        const s = [css.blue__ancestorFocus];
      `),
    );
  });

  test("marker and onHoverOf in same file share defineMarker", () => {
    const code = `
      import { Css } from "./Css";
      function Parent() { return <div css={Css.markerOf("card").df.$} />; }
      function Child() { return <div css={Css.onHoverOf("card").blue.$} />; }
    `;
    const result = n(transform(code)!);
    // Only one defineMarker call for "card"
    expect(result).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const __truss_marker_card = stylex.defineMarker();
        const css = stylex.create({
          df: { display: "flex" },
          blue__ancestorHover_card: { color: { default: null, [stylex.when.ancestor(":hover", __truss_marker_card)]: "#526675" } }
        });
        function Parent() { return <div {...stylex.props(__truss_marker_card, css.df)} />; }
        function Child() { return <div {...stylex.props(css.blue__ancestorHover_card)} />; }
      `),
    );
  });

  // ── Breakpoint / media query tests ──────────────────────────────────

  test("breakpoint only: Css.ifSm.df.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.ifSm.df.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          df__sm: { display: { default: null, "@media screen and (max-width:599px)": "flex" } }
        });
        const s = [css.df__sm];
      `),
    );
  });

  test("breakpoint after base style: Css.df.ifMd.blue.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.df.ifMd.blue.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          df: { display: "flex" },
          blue__md: { color: { default: null, "@media screen and (min-width:600px) and (max-width:959px)": "#526675" } }
        });
        const s = [css.df, css.blue__md];
      `),
    );
  });

  test("breakpoint merges overlapping property: Css.bgBlue.ifSm.bgBlack.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.bgBlue.ifSm.bgBlack.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          bgBlue_bgBlack__sm: { backgroundColor: { default: "#526675", "@media screen and (max-width:599px)": "#353535" } }
        });
        const s = [css.bgBlue_bgBlack__sm];
      `),
    );
  });

  test("breakpoint with large: Css.ifLg.df.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.ifLg.df.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          df__lg: { display: { default: null, "@media screen and (min-width:960px)": "flex" } }
        });
        const s = [css.df__lg];
      `),
    );
  });

  test("breakpoint with combination: Css.ifSmOrMd.blue.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.ifSmOrMd.blue.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          blue__smOrMd: { color: { default: null, "@media screen and (max-width:959px)": "#526675" } }
        });
        const s = [css.blue__smOrMd];
      `),
    );
  });

  test("breakpoint with dynamic literal: Css.ifSm.mt(2).$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.ifSm.mt(2).$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          mt__16px__sm: { marginTop: { default: null, "@media screen and (max-width:599px)": "16px" } }
        });
        const s = [css.mt__16px__sm];
      `),
    );
  });

  test("breakpoint with multi-property: Css.ifSm.ba.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.ifSm.ba.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          ba__sm: {
            borderStyle: { default: null, "@media screen and (max-width:599px)": "solid" },
            borderWidth: { default: null, "@media screen and (max-width:599px)": "1px" }
          }
        });
        const s = [css.ba__sm];
      `),
    );
  });

  test("breakpoint in JSX: css={Css.ifSm.df.$}", () => {
    expect(n(transform(`import { Css } from "./Css"; const el = <div css={Css.ifSm.df.$} />;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          df__sm: { display: { default: null, "@media screen and (max-width:599px)": "flex" } }
        });
        const el = <div {...stylex.props(css.df__sm)} />;
      `),
    );
  });

  test("unsupported patterns are rewritten to throwing expressions", () => {
    const result = transform(`import { Css } from "./Css"; const s = Css.notReal.$;`)!;
    expect(result.includes("Unsupported pattern: Unknown abbreviation")).toBe(true);
  });

  test("unsupported markerOf arg is rewritten to throwing expression", () => {
    const result = transform(`import { Css } from "./Css"; const marker = "row"; const s = Css.markerOf(marker).$;`)!;
    expect(result.includes("Unsupported pattern: markerOf() requires a string literal argument")).toBe(true);
  });
});

function transform(code: string): string | null {
  const result = transformTruss(code, "test.tsx", mapping);
  return result?.code ?? null;
}

/** Normalize whitespace so we can write readable multi-line expectations. */
function n(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
