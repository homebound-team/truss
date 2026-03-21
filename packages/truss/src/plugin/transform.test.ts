import { describe, test, expect } from "vitest";
import { transformTruss } from "./transform";
import { loadMapping } from "./index";
import { resolve } from "path";

const mapping = loadMapping(resolve(__dirname, "../../../app-stylex/src/Css.json"));

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

  test("debug mode rewrites jsx css props through trussProps", () => {
    expect(n(transform(`import { Css } from "./Css"; const el = <div css={Css.df.aic.$} />;`, { debug: true })!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        import { trussProps, TrussDebugInfo } from "@homebound/truss/runtime";
        const css = stylex.create({
          df: { display: "flex" },
          aic: { alignItems: "center" }
        });
        const el = <div {...trussProps(stylex, new TrussDebugInfo("test.tsx:1"), css.df, css.aic)} />;
      `),
    );
  });

  test("debug mode keeps debug info in non-jsx style arrays", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.df.$;`, { debug: true })!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        import { TrussDebugInfo } from "@homebound/truss/runtime";
        const css = stylex.create({ df: { display: "flex" } });
        const s = [new TrussDebugInfo("test.tsx:1"), css.df];
      `),
    );
  });

  test("debug mode keeps mergeProps for className composition", () => {
    expect(
      n(
        transform(`import { Css } from "./Css"; const el = <div className="existing" css={Css.df.$} />;`, {
          debug: true,
        })!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        import { mergeProps, TrussDebugInfo } from "@homebound/truss/runtime";
        const css = stylex.create({ df: { display: "flex" } });
        const el = <div {...mergeProps(stylex, "existing", new TrussDebugInfo("test.tsx:1"), css.df)} />;
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

  test("delegate with variable arg appends px: Css.mtPx(x).$", () => {
    expect(n(transform(`import { Css } from "./Css"; const x = getSomeValue(); const s = Css.mtPx(x).$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ mt: v => ({ marginTop: v }) });
        const x = getSomeValue();
        const s = [css.mt(String(x) + "px")];
      `),
    );
  });

  test("delegate shorthand with multiple props appends px: Css.pxPx(x).$", () => {
    expect(n(transform(`import { Css } from "./Css"; const x = getSomeValue(); const s = Css.pxPx(x).$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ px: v => ({ paddingLeft: v, paddingRight: v }) });
        const x = getSomeValue();
        const s = [css.px(String(x) + "px")];
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

  test("dynamic method keeps extra defs: Css.lineClamp(lines).$", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const lines = getLineCount(); const s = Css.lineClamp(lines).$;`)!),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          lineClamp: v => ({
            WebkitLineClamp: v,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            textOverflow: "ellipsis"
          })
        });
        const lines = getLineCount();
        const s = [css.lineClamp(String(lines))];
      `),
    );
  });

  test("dynamic literal keeps extra defs: Css.lineClamp('3').$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.lineClamp("3").$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          lineClamp__3: {
            WebkitLineClamp: "3",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            textOverflow: "ellipsis"
          }
        });
        const s = [css.lineClamp__3];
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

  test("typography literal: Css.typography('f14').$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.typography("f14").$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ f14: { fontSize: "14px" } });
        const s = [css.f14];
      `),
    );
  });

  test("typography runtime key: Css.typography(key).$", () => {
    expect(
      n(
        transform(
          `import { Css, type Typography } from "./Css"; const key: Typography = pickType(); const s = Css.typography(key).$;`,
        )!,
      ),
    ).toBe(
      n(`
        import { type Typography } from "./Css";
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          f24: { fontSize: "24px" },
          f18: { fontSize: "18px" },
          f16: { fontSize: "16px" },
          f14: { fontSize: "14px" },
          f12: { fontSize: "12px" },
          f10: { fontSize: "10px", fontWeight: 500 }
        });
        const __typography = {
          f24: [css.f24],
          f18: [css.f18],
          f16: [css.f16],
          f14: [css.f14],
          f12: [css.f12],
          f10: [css.f10]
        };
        const key: Typography = pickType();
        const s = [...(__typography[key] ?? [])];
      `),
    );
  });

  test("typography runtime keys across breakpoint contexts", () => {
    expect(
      n(
        transform(
          `import { Css, type Typography } from "./Css"; const key: Typography = pickType(); const otherKey: Typography = pickOtherType(); const s = Css.typography(key).ifSm.typography(otherKey).$;`,
        )!,
      ),
    ).toBe(
      n(`
        import { type Typography } from "./Css";
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          f24: { fontSize: "24px" },
          f18: { fontSize: "18px" },
          f16: { fontSize: "16px" },
          f14: { fontSize: "14px" },
          f12: { fontSize: "12px" },
          f10: { fontSize: "10px", fontWeight: 500 },
          f24__sm: { fontSize: { default: null, "@media (max-width: 599px)": "24px" } },
          f18__sm: { fontSize: { default: null, "@media (max-width: 599px)": "18px" } },
          f16__sm: { fontSize: { default: null, "@media (max-width: 599px)": "16px" } },
          f14__sm: { fontSize: { default: null, "@media (max-width: 599px)": "14px" } },
          f12__sm: { fontSize: { default: null, "@media (max-width: 599px)": "12px" } },
          f10__sm: {
            fontSize: { default: null, "@media (max-width: 599px)": "10px" },
            fontWeight: { default: null, "@media (max-width: 599px)": 500 }
          }
        });
        const __typography = {
          f24: [css.f24],
          f18: [css.f18],
          f16: [css.f16],
          f14: [css.f14],
          f12: [css.f12],
          f10: [css.f10]
        };
        const __typography__sm = {
          f24: [css.f24__sm],
          f18: [css.f18__sm],
          f16: [css.f16__sm],
          f14: [css.f14__sm],
          f12: [css.f12__sm],
          f10: [css.f10__sm]
        };
        const key: Typography = pickType();
        const otherKey: Typography = pickOtherType();
        const s = [...(__typography[key] ?? []), ...(__typography__sm[otherKey] ?? [])];
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

  test("container query requires literal bounds: emits console.error and preserves valid segments", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const minWidth = getMinWidth(); const maxWidth = getMaxWidth(); const s = Css.ifContainer({ gt: minWidth, lt: maxWidth }).blue.$;`,
        )!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ blue: { color: "#526675" } });
        console.error("[truss] Unsupported pattern: ifContainer().gt must be a numeric literal (test.tsx:1)");
        const minWidth = getMinWidth();
        const maxWidth = getMaxWidth();
        const s = [css.blue];
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

  test("object spread composition rewrites to style array", () => {
    expect(
      n(
        transform(
          `
            import { Css } from "./Css";

            const styles = {
              wrapper: {
                ...Css.df.aic.$,
                // An inline comment
                ...(someCondition ? Css.black.$ : Css.blue.$),
                ...(!compound ? Css.ba.$ : {}),
              },
              hover: Css.bgBlue.$,
            };

            const el = <div css={{ ...styles.wrapper, ...(isHovered ? styles.hover : {}) }} />;
          `,
        )!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          df: { display: "flex" },
          aic: { alignItems: "center" },
          black: { color: "#353535" },
          blue: { color: "#526675" },
          ba: { borderStyle: "solid", borderWidth: "1px" },
          bgBlue: { backgroundColor: "#526675" }
        });
        const styles = {
          wrapper: [css.df, css.aic, ...(someCondition ? [css.black] : [css.blue]), ...(!compound ? [css.ba] : [])],
          hover: [css.bgBlue]
        };
        const el = <div {...stylex.props(...styles.wrapper, ...(isHovered ? styles.hover : []))} />;
      `),
    );
  });

  // Previously unsupported before generalized `css={...}` style-array lowering.

  test("style-array variable in css prop is lowered to stylex.props", () => {
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
        const el = <div {...stylex.props(...base)} />;
      `),
    );
  });

  test("style-array variable named css can be spread inside css prop object", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const css = Css.df.aic.$; const el = <div css={{ ...css }} />;`)!),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css_ = stylex.create({
          df: { display: "flex" },
          aic: { alignItems: "center" }
        });
        const css = [css_.df, css_.aic];
        const el = <div {...stylex.props(...css)} />;
      `),
    );
  });

  test("nested render function param named css is lowered from css={{ ...css }}", () => {
    expect(
      n(
        transform(`
          import { Css } from "./Css";

          export const headerRenderFn =
            () =>
            (key, css, content, classNames) => {
              return <div key={key} css={{ ...css }} className={classNames}><span css={Css.blue.$}>{content}</span></div>;
            };
        `)!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        import { mergeProps, asStyleArray } from "@homebound/truss/runtime";
        const css = stylex.create({ blue: { color: "#526675" } });
        export const headerRenderFn =
          () =>
          (key, css, content, classNames) => {
            return <div key={key} {...mergeProps(stylex, classNames, ...asStyleArray(css))}><span {...stylex.props(css.blue)}>{content}</span></div>;
          };
      `),
    );
  });

  test("non-css prop object spread is not rewritten to style array", () => {
    expect(
      n(
        transform(`
          import { mergeProps } from "react-aria";
          import { Css } from "./Css";

          function Example() {
            return <div inputProps={{
              ...mergeProps(inputProps, { "aria-invalid": Boolean(errorMsg), onInput: () => state.open() }),
            }}><span css={Css.df.$} /></div>;
          }
        `)!,
      ),
    ).toBe(
      n(`
        import { mergeProps } from "react-aria";
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ df: { display: "flex" } });
        function Example() {
          return <div inputProps={{
            ...mergeProps(inputProps, { "aria-invalid": Boolean(errorMsg), onInput: () => state.open() })
          }}><span {...stylex.props(css.df)} /></div>;
        }
      `),
    );
  });

  test("mixed css prop spread and Css chain spread are lowered together", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; function Box({ cssProp }) { return <div css={{ ...cssProp, ...Css.df.$ }} />; }`,
        )!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ df: { display: "flex" } });
        function Box({ cssProp }) { return <div {...stylex.props(...(Array.isArray(cssProp) ? cssProp : cssProp ? [cssProp] : []), css.df)} />; }
      `),
    );
  });

  test("imported spread plus inline Css spread is lowered", () => {
    expect(
      n(
        transform(`
          import { importedStyles } from "./other";
          import { Css } from "./Css";

          const el = <div css={{ ...importedStyles, ...Css.blue.$ }} />;
        `)!,
      ),
    ).toBe(
      n(`
        import { importedStyles } from "./other";
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ blue: { color: "#526675" } });
        const el = <div {...stylex.props(...(Array.isArray(importedStyles) ? importedStyles : importedStyles ? [importedStyles] : []), css.blue)} />;
      `),
    );
  });

  test("props spread plus inline Css spread uses safe fallback when xss is undefined", () => {
    expect(
      n(
        transform(`
          import { Css } from "./Css";

          function Box(props) {
            const { xss } = props;
            return <div css={{ ...xss, ...Css.blue.$ }} />;
          }
        `)!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ blue: { color: "#526675" } });
        function Box(props) {
          const { xss } = props;
          return <div {...stylex.props(...(Array.isArray(xss) ? xss : xss ? [xss] : []), css.blue)} />;
        }
      `),
    );
  });

  test("css object with conditional style spread and xss fallback is parenthesized correctly", () => {
    expect(
      n(
        transform(`
          import { Css } from "./Css";

          function Example(props) {
            const { multiline, wrap, xss, BorderHoverChild } = props;
            const fieldStyles = {
              inputWrapperReadOnly: Css.df.$,
            };
            return <div css={{
              ...fieldStyles.inputWrapperReadOnly,
              ...(multiline ? Css.fdc.aifs.gap2.$ : Css.if(wrap === false).truncate.$),
              ...xss,
            }} className={BorderHoverChild} />;
          }
        `)!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        import { mergeProps } from "@homebound/truss/runtime";
        const css = stylex.create({
          df: { display: "flex" },
          fdc: { flexDirection: "column" },
          aifs: { alignItems: "flex-start" },
          gap2: { gap: "16px" },
          truncate: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }
        });
        function Example(props) {
          const { multiline, wrap, xss, BorderHoverChild } = props;
          const fieldStyles = {
            inputWrapperReadOnly: [css.df]
          };
          return <div {...mergeProps(stylex, BorderHoverChild, ...fieldStyles.inputWrapperReadOnly, ...(multiline ? [css.fdc, css.aifs, css.gap2] : [...(wrap === false ? [css.truncate] : [])]), ...(Array.isArray(xss) ? xss : xss ? [xss] : []))} />;
        }
      `),
    );
  });

  test("mergeProps keeps parenthesized spread args from css object rewrites", () => {
    const result = transform(`
      import { Css } from "./Css";

      function Example(props) {
        const { multiline, wrap, xss, BorderHoverChild } = props;
        const fieldStyles = {
          inputWrapperReadOnly: Css.df.$,
        };
        return <div css={{
          ...fieldStyles.inputWrapperReadOnly,
          ...(multiline ? Css.fdc.aifs.gap2.$ : Css.if(wrap === false).truncate.$),
          ...xss,
        }} className={BorderHoverChild} />;
      }
    `)!;

    expect(result).toContain(
      "...(multiline ? [css.fdc, css.aifs, css.gap2] : [...(wrap === false ? [css.truncate] : [])])",
    );
    expect(result).toContain("...(Array.isArray(xss) ? xss : xss ? [xss] : [])");
  });

  test("css prop object with only intermediate style-array spreads is lowered", () => {
    expect(
      n(
        transform(
          `
            import { Css } from "./Css";

            function MyComponent({ disabled, someConst }) {
              const styles = {
                wrapper: {
                  ...Css.df.aic.ba.$,
                  ...(disabled ? Css.black.$ : {}),
                },
                hover: Css.bgBlue.$,
              };

              return <div className={someConst} css={{ ...styles.wrapper, ...(disabled ? styles.hover : {}) }}>Hello</div>;
            }
          `,
        )!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        import { mergeProps } from "@homebound/truss/runtime";
        const css = stylex.create({
          df: { display: "flex" },
          aic: { alignItems: "center" },
          ba: { borderStyle: "solid", borderWidth: "1px" },
          black: { color: "#353535" },
          bgBlue: { backgroundColor: "#526675" }
        });
        function MyComponent({ disabled, someConst }) {
          const styles = {
            wrapper: [css.df, css.aic, css.ba, ...(disabled ? [css.black] : [])],
            hover: [css.bgBlue]
          };
          return <div {...mergeProps(stylex, someConst, ...styles.wrapper, ...(disabled ? styles.hover : []))}>Hello</div>;
        }
      `),
    );
  });

  test("css prop object with intermediate style-array spreads using && is lowered", () => {
    expect(
      n(
        transform(`
          import { Css } from "./Css";

          function MyComponent({ borderOnHover, compound, isHovered }) {
            const fieldStyles = {
              inputWrapper: {
                ...Css.df.aic.ba.$,
                ...(!compound ? Css.br4.$ : {}),
                ...(borderOnHover && Css.black.$),
                ...(isHovered && Css.blue.$),
              },
            };

            return <div css={{ ...fieldStyles.inputWrapper }} />;
          }
        `)!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          df: { display: "flex" },
          aic: { alignItems: "center" },
          ba: { borderStyle: "solid", borderWidth: "1px" },
          br4: { borderRadius: "1rem" },
          black: { color: "#353535" },
          blue: { color: "#526675" }
        });
        function MyComponent({ borderOnHover, compound, isHovered }) {
          const fieldStyles = {
            inputWrapper: [css.df, css.aic, css.ba, ...(!compound ? [css.br4] : []), ...(borderOnHover ? [css.black] : []), ...(isHovered ? [css.blue] : [])]
          };
          return <div {...stylex.props(...fieldStyles.inputWrapper)} />;
        }
      `),
    );
  });

  test("css prop object with chained && style-array spreads is lowered", () => {
    expect(
      n(
        transform(`
          import { Css } from "./Css";

          function MyComponent({ contrast, inputStylePalette }) {
            const fieldStyles = {
              input: {
                ...Css.w100.mw0.outline0.fg1.$,
                ...(contrast && !inputStylePalette && Css.element("::selection").bgBlue.$),
              },
            };

            return <div css={{ ...fieldStyles.input }} />;
          }
        `)!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          w100: { width: "100%" },
          mw0: { minWidth: 0 },
          outline0: { outline: "0" },
          fg1: { flexGrow: 1 },
          bgBlue__selection: { "::selection": { backgroundColor: "#526675" } }
        });
        function MyComponent({ contrast, inputStylePalette }) {
          const fieldStyles = {
            input: [css.w100, css.mw0, css.outline0, css.fg1, ...(contrast && !inputStylePalette ? [css.bgBlue__selection] : [])]
          };
          return <div {...stylex.props(...fieldStyles.input)} />;
        }
      `),
    );
  });

  test("css prop object with style-array spreads using || is lowered", () => {
    expect(
      n(
        transform(`
          import { Css } from "./Css";

          const base = Css.df.$;
          const hover = Css.blue.$;
          const el = <div css={{ ...(hover || base) }} />;
        `)!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          df: { display: "flex" },
          blue: { color: "#526675" }
        });
        const base = [css.df];
        const hover = [css.blue];
        const el = <div {...stylex.props(...(hover || base))} />;
      `),
    );
  });

  test("css prop object with style-array spreads using ?? is lowered", () => {
    expect(
      n(
        transform(`
          import { Css } from "./Css";

          const base = Css.df.$;
          const hover = Css.blue.$;
          const el = <div css={{ ...(hover ?? base) }} />;
        `)!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          df: { display: "flex" },
          blue: { color: "#526675" }
        });
        const base = [css.df];
        const hover = [css.blue];
        const el = <div {...stylex.props(...(hover ?? base))} />;
      `),
    );
  });

  test("css prop object with computed intermediate member spread is lowered", () => {
    expect(
      n(
        transform(`
          import { Css } from "./Css";

          const key = "wrapper";
          const styles = { wrapper: Css.df.aic.$ };
          const el = <div css={{ ...styles[key] }} />;
        `)!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          df: { display: "flex" },
          aic: { alignItems: "center" }
        });
        const key = "wrapper";
        const styles = { wrapper: [css.df, css.aic] };
        const el = <div {...stylex.props(...styles[key])} />;
      `),
    );
  });

  test("css prop object with function-returned style-array spread is lowered", () => {
    expect(
      n(
        transform(`
          import { Css } from "./Css";

          function getStyles() {
            return Css.df.aic.$;
          }

          const el = <div css={{ ...getStyles() }} />;
        `)!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          df: { display: "flex" },
          aic: { alignItems: "center" }
        });
        function getStyles() {
          return [css.df, css.aic];
        }
        const el = <div {...stylex.props(...getStyles())} />;
      `),
    );
  });

  test("useMemo-composed styles identifier is lowered in css prop", () => {
    expect(
      n(
        transform(`
          import { useMemo } from "react";
          import { Css } from "./Css";

          function chipBaseStyles(compact) {
            return compact ? Css.df.$ : Css.aic.$;
          }

          function Chip(props) {
            const { xss, compact } = props;
            const type = "primary";
            const typeStyles = { primary: Css.blue.$ };
            const styles = useMemo(
              () => ({
                ...chipBaseStyles(compact),
                ...typeStyles[type],
                ...xss,
              }),
              [type, xss, compact],
            );

            return <span css={styles} />;
          }
        `)!,
      ),
    ).toBe(
      n(`
        import { useMemo } from "react";
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          df: { display: "flex" },
          aic: { alignItems: "center" },
          blue: { color: "#526675" }
        });
        function chipBaseStyles(compact) {
          return compact ? [css.df] : [css.aic];
        }
        function Chip(props) {
          const { xss, compact } = props;
          const type = "primary";
          const typeStyles = { primary: [css.blue] };
          const styles = useMemo(() => [...chipBaseStyles(compact), ...typeStyles[type], ...(Array.isArray(xss) ? xss : xss ? [xss] : [])], [type, xss, compact]);
          return <span {...stylex.props(...styles)} />;
        }
      `),
    );
  });

  test("external call expression in css prop is assumed style-array-like", () => {
    expect(
      n(
        transform(`
          import { getFromAnotherFile } from "./other";
          import { Css } from "./Css";

          function Example({ param, content }) {
            return <div css={getFromAnotherFile(param)}><span css={Css.blue.$}>{content}</span></div>;
          }
        `)!,
      ),
    ).toBe(
      n(`
        import { getFromAnotherFile } from "./other";
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ blue: { color: "#526675" } });
        function Example({ param, content }) {
          return <div {...stylex.props(...getFromAnotherFile(param))}><span {...stylex.props(css.blue)}>{content}</span></div>;
        }
      `),
    );
  });

  test("skipped css prop rewrite emits console.error with reason and location", () => {
    expect(
      n(
        transform(`
          import { Css } from "./Css";

          const base = Css.df.$;
          const cssProp = getCssProp();
          const el = <div css={{ ...cssProp, foo: true }} />;
        `)!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ df: { display: "flex" } });
        console.error("[truss] Unsupported pattern: Could not rewrite css prop: object contains a non-spread property ({...cssProp,foo:true}) (test.tsx:6)");
        const base = [css.df];
        const cssProp = getCssProp();
        const el = <div css={{ ...cssProp, foo: true }} />;
      `),
    );
  });

  test("style-array object member in css prop is lowered to stylex.props", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const styles = { wrapper: Css.df.aic.$ }; const el = <div css={styles.wrapper} />;`,
        )!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          df: { display: "flex" },
          aic: { alignItems: "center" }
        });
        const styles = { wrapper: [css.df, css.aic] };
        const el = <div {...stylex.props(...styles.wrapper)} />;
      `),
    );
  });

  test("conditional style-array expression in css prop is lowered to stylex.props", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const base = Css.df.$; const active = Css.black.$; const el = <div css={isActive ? active : base} />;`,
        )!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          df: { display: "flex" },
          black: { color: "#353535" }
        });
        const base = [css.df];
        const active = [css.black];
        const el = <div {...stylex.props(...(isActive ? active : base))} />;
      `),
    );
  });

  test("ordinary object spreads stay objects", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = { foo: true, ...other }; const t = Css.df.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ df: { display: "flex" } });
        const s = { foo: true, ...other };
        const t = [css.df];
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
        import { mergeProps } from "@homebound/truss/runtime";
        const css = stylex.create({ df: { display: "flex" } });
        const el = <div {...mergeProps(stylex, "existing", css.df)} />;
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
        import { mergeProps } from "@homebound/truss/runtime";
        const css = stylex.create({ df: { display: "flex" } });
        const cls = getClass();
        const el = <div {...mergeProps(stylex, cls, css.df)} />;
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

  test("marker and when('ancestor') in same file use same user-defined marker variable", () => {
    const code = `
      import { Css } from "./Css";
      const card = stylex.defineMarker();
      function Parent() { return <div css={Css.markerOf(card).df.$} />; }
      function Child() { return <div css={Css.when("ancestor", card, ":hover").blue.$} />; }
    `;
    const result = n(transform(code)!);
    expect(result).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const card = stylex.defineMarker();
        const css = stylex.create({
          df: { display: "flex" },
          blue__ancestorHover_card: { color: { default: null, [stylex.when.ancestor(":hover", card)]: "#526675" } }
        });
        function Parent() { return <div {...stylex.props(card, css.df)} />; }
        function Child() { return <div {...stylex.props(css.blue__ancestorHover_card)} />; }
      `),
    );
  });

  // ── when() generic API tests ─────────────────────────────────────────

  test("Css.when('ancestor', ':hover').blue.$ — same as onHoverOf()", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.when("ancestor", ":hover").blue.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          blue__ancestorHover: { color: { default: null, [stylex.when.ancestor(":hover")]: "#526675" } }
        });
        const s = [css.blue__ancestorHover];
      `),
    );
  });

  test("Css.when('ancestor', marker, ':hover').blue.$ — with marker", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const row = stylex.defineMarker(); const s = Css.when("ancestor", row, ":hover").blue.$;`,
        )!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const row = stylex.defineMarker();
        const css = stylex.create({
          blue__ancestorHover_row: { color: { default: null, [stylex.when.ancestor(":hover", row)]: "#526675" } }
        });
        const s = [css.blue__ancestorHover_row];
      `),
    );
  });

  test("Css.when('descendant', ':focus').blue.$ — descendant relationship", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.when("descendant", ":focus").blue.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          blue__descendantFocus: { color: { default: null, [stylex.when.descendant(":focus")]: "#526675" } }
        });
        const s = [css.blue__descendantFocus];
      `),
    );
  });

  test("Css.when('siblingAfter', ':hover').blue.$ — siblingAfter relationship", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.when("siblingAfter", ":hover").blue.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          blue__siblingAfterHover: { color: { default: null, [stylex.when.siblingAfter(":hover")]: "#526675" } }
        });
        const s = [css.blue__siblingAfterHover];
      `),
    );
  });

  test("Css.when('anySibling', marker, ':hover').blue.$ — anySibling with marker", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const m = stylex.defineMarker(); const s = Css.when("anySibling", m, ":hover").blue.$;`,
        )!,
      ),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const m = stylex.defineMarker();
        const css = stylex.create({
          blue__anySiblingHover_m: { color: { default: null, [stylex.when.anySibling(":hover", m)]: "#526675" } }
        });
        const s = [css.blue__anySiblingHover_m];
      `),
    );
  });

  test("Css.when with invalid relationship emits console.error", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.when("parent", ":hover").blue.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ blue: { color: "#526675" } });
        console.error("[truss] Unsupported pattern: when() relationship must be one of: ancestor, descendant, anySibling, siblingBefore, siblingAfter -- got \\"parent\\" (test.tsx:1)");
        const s = [css.blue];
      `),
    );
  });

  test("Css.when with non-literal relationship emits console.error", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const rel = "ancestor"; const s = Css.when(rel, ":hover").blue.$;`)!),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ blue: { color: "#526675" } });
        console.error("[truss] Unsupported pattern: when() first argument must be a string literal relationship (test.tsx:1)");
        const rel = "ancestor";
        const s = [css.blue];
      `),
    );
  });

  // ── Breakpoint / media query tests ──────────────────────────────────

  test("if(mediaQuery) as pseudo: Css.if('@media (max-width: 599px)').df.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.if("@media (max-width: 599px)").df.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          df__sm: { display: { default: null, "@media (max-width: 599px)": "flex" } }
        });
        const s = [css.df__sm];
      `),
    );
  });

  test("if(mediaQuery) merges with base: Css.bgBlue.if('@media (max-width: 599px)').bgBlack.$", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const s = Css.bgBlue.if("@media (max-width: 599px)").bgBlack.$;`)!),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          bgBlue_bgBlack__sm: { backgroundColor: { default: "#526675", "@media (max-width: 599px)": "#353535" } }
        });
        const s = [css.bgBlue_bgBlack__sm];
      `),
    );
  });

  test("if(Breakpoints.sm) works like if('@media...')", () => {
    // Breakpoints.sm resolves to the string literal at call site; the plugin sees a string literal
    expect(n(transform(`import { Css } from "./Css"; const s = Css.if("@media (min-width: 960px)").df.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          df__lg: { display: { default: null, "@media (min-width: 960px)": "flex" } }
        });
        const s = [css.df__lg];
      `),
    );
  });

  test("breakpoint + pseudo combination: Css.ifSm.onHover.blue.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.ifSm.onHover.blue.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          blue__sm_hover: {
            color: {
              default: null,
              ":hover": { default: null, "@media (max-width: 599px)": "#526675" }
            }
          }
        });
        const s = [css.blue__sm_hover];
      `),
    );
  });

  test("base + breakpoint + pseudo: Css.black.ifSm.onHover.blue.$", () => {
    // black (base color) + ifSm.onHover.blue (hover color within small screen)
    // Both set `color` so they merge: base default + nested media-in-pseudo for hover
    expect(n(transform(`import { Css } from "./Css"; const s = Css.black.ifSm.onHover.blue.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          black_blue__sm_hover: {
            color: {
              default: "#353535",
              ":hover": { default: null, "@media (max-width: 599px)": "#526675" }
            }
          }
        });
        const s = [css.black_blue__sm_hover];
      `),
    );
  });

  test("base + breakpoint color + breakpoint+pseudo color: Css.black.ifSm.white.onHover.blue.$", () => {
    // black (default color), ifSm.white (color on small), ifSm.onHover.blue (hover color on small)
    // All three set `color` → merged into one entry with stacked conditions
    expect(n(transform(`import { Css } from "./Css"; const s = Css.black.ifSm.white.onHover.blue.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          black_white__sm_blue__sm_hover: {
            color: {
              default: "#353535",
              "@media (max-width: 599px)": "#fcfcfa",
              ":hover": { default: null, "@media (max-width: 599px)": "#526675" }
            }
          }
        });
        const s = [css.black_white__sm_blue__sm_hover];
      `),
    );
  });

  test("breakpoint only: Css.ifSm.df.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.ifSm.df.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          df__sm: { display: { default: null, "@media (max-width: 599px)": "flex" } }
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
          blue__md: { color: { default: null, "@media (min-width: 600px) and (max-width: 959px)": "#526675" } }
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
          bgBlue_bgBlack__sm: { backgroundColor: { default: "#526675", "@media (max-width: 599px)": "#353535" } }
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
          df__lg: { display: { default: null, "@media (min-width: 960px)": "flex" } }
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
          blue__smOrMd: { color: { default: null, "@media (max-width: 959px)": "#526675" } }
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
          mt__16px__sm: { marginTop: { default: null, "@media (max-width: 599px)": "16px" } }
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
            borderStyle: { default: null, "@media (max-width: 599px)": "solid" },
            borderWidth: { default: null, "@media (max-width: 599px)": "1px" }
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
          df__sm: { display: { default: null, "@media (max-width: 599px)": "flex" } }
        });
        const el = <div {...stylex.props(css.df__sm)} />;
      `),
    );
  });

  // ── Pseudo-element tests ─────────────────────────────────────────────

  test("element('::placeholder').blue.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.element("::placeholder").blue.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          blue__placeholder: { "::placeholder": { color: "#526675" } }
        });
        const s = [css.blue__placeholder];
      `),
    );
  });

  test("element('::selection') with static styles", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.element("::selection").bgBlue.white.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          bgBlue__selection: { "::selection": { backgroundColor: "#526675" } },
          white__selection: { "::selection": { color: "#fcfcfa" } }
        });
        const s = [css.bgBlue__selection, css.white__selection];
      `),
    );
  });

  test("element with dynamic literal: element('::placeholder').bc('red').$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.element("::placeholder").bc("red").$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          bc__red__placeholder: { "::placeholder": { borderColor: "red" } }
        });
        const s = [css.bc__red__placeholder];
      `),
    );
  });

  test("element + onHover: Css.element('::placeholder').onHover.blue.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.element("::placeholder").onHover.blue.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          blue__placeholder_hover: {
            "::placeholder": { color: { default: null, ":hover": "#526675" } }
          }
        });
        const s = [css.blue__placeholder_hover];
      `),
    );
  });

  test("element with non-literal argument errors", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const pe = "::placeholder"; const s = Css.element(pe).blue.$;`)!),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({ blue: { color: "#526675" } });
        console.error("[truss] Unsupported pattern: element() requires exactly one string literal argument (e.g. \\"::placeholder\\") (test.tsx:1)");
        const pe = "::placeholder";
        const s = [css.blue];
      `),
    );
  });

  test("unsupported patterns emit console.error and produce empty array", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.notReal.$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        console.error("[truss] Unsupported pattern: Unknown abbreviation \\"notReal\\" (test.tsx:1)");
        const s = [];
      `),
    );
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

  test("add with object overload emits console.error", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.add({ wordBreak: "break-word" }).$;`)!)).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        console.error("[truss] Unsupported pattern: add() requires exactly 2 arguments (property name and value), got 1. The add({...}) object overload is not supported -- use add(\\"propName\\", value) instead (test.tsx:1)");
        const s = [];
      `),
    );
  });

  test("error preserves valid segments: Css.black.add(foo, 'value').df.$", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const foo = getProp(); const s = Css.black.add(foo, "value").df.$;`)!),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        const css = stylex.create({
          black: { color: "#353535" },
          df: { display: "flex" }
        });
        console.error("[truss] Unsupported pattern: add() first argument must be a string literal property name (test.tsx:1)");
        const foo = getProp();
        const s = [css.black, css.df];
      `),
    );
  });

  test("add with non-string-literal property name emits console.error", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const prop = "boxShadow"; const s = Css.add(prop, "value").$;`)!),
    ).toBe(
      n(`
        import * as stylex from "@stylexjs/stylex";
        console.error("[truss] Unsupported pattern: add() first argument must be a string literal property name (test.tsx:1)");
        const prop = "boxShadow";
        const s = [];
      `),
    );
  });
});

function transform(code: string, options?: { debug?: boolean }): string | null {
  const result = transformTruss(code, "test.tsx", mapping, options);
  return result?.code ?? null;
}

/** Normalize whitespace so we can write readable multi-line expectations. */
function n(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
