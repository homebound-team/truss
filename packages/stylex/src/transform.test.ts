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

  test("container query pseudo: Css.ifContainer({ gt, lt }).gc('span 2').$", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const s = Css.ifContainer({ gt: 600, lt: 960 }).gc("span 2").$;`)!),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          gc__span_2__container_min_width_601px_and_max_width_960px: {
            gridColumn: {
              default: null,
              "@container (min-width: 601px) and (max-width: 960px)": "span 2"
            }
          }
        });
        const s = [css.gc__span_2__container_min_width_601px_and_max_width_960px];
      `),
    );
  });

  test("container query merges overlapping property", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const s = Css.black.ifContainer({ gt: 600, lt: 960 }).blue.$;`)!),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          black_blue__container_min_width_601px_and_max_width_960px: {
            color: {
              default: "#353535",
              "@container (min-width: 601px) and (max-width: 960px)": "#526675"
            }
          }
        });
        const s = [css.black_blue__container_min_width_601px_and_max_width_960px];
      `),
    );
  });

  test("container query with named container", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const s = Css.ifContainer({ name: "grid", gt: 600, lt: 960 }).blue.$;`,
        )!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          blue__container_grid_min_width_601px_and_max_width_960px: {
            color: {
              default: null,
              "@container grid (min-width: 601px) and (max-width: 960px)": "#526675"
            }
          }
        });
        const s = [css.blue__container_grid_min_width_601px_and_max_width_960px];
      `),
    );
  });

  test("container query requires literal bounds", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const minWidth = getMinWidth(); const maxWidth = getMaxWidth(); const s = Css.ifContainer({ gt: minWidth, lt: maxWidth }).blue.$;`,
        )!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const minWidth = getMinWidth();
        const maxWidth = getMaxWidth();
        const s = (() => {
          throw new Error("[truss] Unsupported pattern: ifContainer().gt must be a numeric literal");
        })();
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
        import * as stylex from "@stylexjs/stylex";
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

  test("Css.markerOf(row).$ passes marker variable through", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const row = stylex.defineMarker(); function C() { return <div css={Css.markerOf(row).$} />; }`,
        )!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const row = stylex.defineMarker();
        function C() { return <div {...stylex.props(row)} />; }
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

  test("Css.onHoverOf(row).blue.$ emits stylex.when.ancestor with user-defined marker", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const row = stylex.defineMarker(); const s = Css.onHoverOf(row).blue.$;`,
        )!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          blue__ancestorHover_row: { color: { default: null, [stylex.when.ancestor(":hover", row)]: "#526675" } }
        });
        const row = stylex.defineMarker();
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

  test("marker and onHoverOf in same file use same user-defined marker variable", () => {
    const code = `
      import { Css } from "./Css";
      const card = stylex.defineMarker();
      function Parent() { return <div css={Css.markerOf(card).df.$} />; }
      function Child() { return <div css={Css.onHoverOf(card).blue.$} />; }
    `;
    const result = n(transform(code)!);
    expect(result).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          df: { display: "flex" },
          blue__ancestorHover_card: { color: { default: null, [stylex.when.ancestor(":hover", card)]: "#526675" } }
        });
        const card = stylex.defineMarker();
        function Parent() { return <div {...stylex.props(card, css.df)} />; }
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

  test("markerOf accepts a variable argument", () => {
    const result = n(
      transform(
        `import { Css } from "./Css"; const marker = stylex.defineMarker(); const s = Css.markerOf(marker).$;`,
      )!,
    );
    expect(result).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const marker = stylex.defineMarker();
        const s = [marker];
      `),
    );
  });

  // ── add() tests ─────────────────────────────────────────────────────

  test("add with string literal value: Css.add('boxShadow', '0 0 0 1px blue').$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.add("boxShadow", "0 0 0 1px blue").$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          add_boxShadow__0_0_0_1px_blue: { boxShadow: "0 0 0 1px blue" }
        });
        const s = [css.add_boxShadow__0_0_0_1px_blue];
      `),
    );
  });

  test("add with numeric literal value: Css.add('animationDelay', '300ms').$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.add("animationDelay", "300ms").$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          add_animationDelay__300ms: { animationDelay: "300ms" }
        });
        const s = [css.add_animationDelay__300ms];
      `),
    );
  });

  test("add with variable value: Css.add('boxShadow', shadow).$", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const shadow = getShadow(); const s = Css.add("boxShadow", shadow).$;`,
        )!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ add_boxShadow: v => ({ boxShadow: v }) });
        const shadow = getShadow();
        const s = [css.add_boxShadow(String(shadow))];
      `),
    );
  });

  test("add mixed with other chain segments: Css.df.add('wordBreak', 'break-word').black.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.df.add("wordBreak", "break-word").black.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          df: { display: "flex" },
          add_wordBreak__break_word: { wordBreak: "break-word" },
          black: { color: "#353535" }
        });
        const s = [css.df, css.add_wordBreak__break_word, css.black];
      `),
    );
  });

  test("add with pseudo: Css.onHover.add('textDecoration', 'underline').$", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const s = Css.onHover.add("textDecoration", "underline").$;`)!),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          add_textDecoration__underline__hover: {
            textDecoration: { default: null, ":hover": "underline" }
          }
        });
        const s = [css.add_textDecoration__underline__hover];
      `),
    );
  });

  test("add with object overload errors", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.add({ wordBreak: "break-word" }).$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const s = (() => { throw new Error("[truss] Unsupported pattern: add() requires exactly 2 arguments (property name and value), got 1. The add({...}) object overload is not supported -- use add(\\"propName\\", value) instead"); })();
      `),
    );
  });

  test("add with non-string-literal property name errors", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const prop = "boxShadow"; const s = Css.add(prop, "value").$;`)!),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const prop = "boxShadow";
        const s = (() => { throw new Error("[truss] Unsupported pattern: add() first argument must be a string literal property name"); })();
      `),
    );
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
