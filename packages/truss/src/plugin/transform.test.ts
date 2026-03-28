import { describe, test, expect } from "vitest";
import { transformTruss } from "./transform";
import { loadMapping } from "./index";
import { resolve } from "path";
import { normalize } from "../testUtils";

const mapping = loadMapping(resolve(__dirname, "../../../app/src/Css.json"));

describe("transform", () => {
  test("returns null for files without Css import", () => {
    expectTrussTransform(`
      const x = 1;
    `).toEqual({ code: null, css: "" });
  });

  test("returns null for files that import Css but don't use .$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const x = Css.df;
    `).toEqual({ code: null, css: "" });
  });

  test("static chain: Css.df.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.df.$;
    `).toHaveTrussOutput(
      `
      const s = { display: "df" };
    `,
      `
      .df {
        display: flex;
      }
    `,
    );
  });

  test("keeps runtime import rewrites on the former Css import line", () => {
    const output = transformTruss(
      `
      import { keepMe } from "./other";
      import { Css } from "./Css";

      const el = <div css={Css.black.$} className="extra" />;
      const value = keepMe();
    `,
      "test.tsx",
      mapping,
    )?.code;

    expect(lineOf(output!, 'import { mergeProps } from "@homebound/truss/runtime";')).toBe(2);
    expect(lineOf(output!, "const el =")).toBe(4);
  });

  test("returns a source map for rewritten files", () => {
    const result = transformTruss(
      `import { Css } from "./Css"; const el = <div css={Css.black.$} />;`,
      "test.tsx",
      mapping,
    );

    expect(result?.map).toMatchObject({
      sources: ["test.tsx"],
    });
  });

  test("multi-getter chain: Css.df.aic.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.df.aic.$;
    `).toHaveTrussOutput(
      `
      const s = { display: "df", alignItems: "aic" };
    `,
      `
      .aic {
        align-items: center;
      }
      .df {
        display: flex;
      }
    `,
    );
  });

  test("css prop on JSX: css={Css.df.$}", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const el = <div css={Css.df.$} />;
    `).toHaveTrussOutput(
      `
      const el = <div className="df" />;
    `,
      `
      .df {
        display: flex;
      }
    `,
    );
  });

  test("css prop with multi-getter: css={Css.df.aic.black.$}", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const el = <div css={Css.df.aic.black.$} />;
    `).toHaveTrussOutput(
      `
      const el = <div className="df aic black" />;
    `,
      `
      .aic {
        align-items: center;
      }
      .black {
        color: #353535;
      }
      .df {
        display: flex;
      }
    `,
    );
  });

  test("debug mode rewrites jsx css props through trussProps", () => {
    expectTrussTransform(
      `
      import { Css } from "./Css";
      const el = <div css={Css.df.aic.$} />;
    `,
      { debug: true },
    ).toHaveTrussOutput(
      `
      import { trussProps, TrussDebugInfo } from "@homebound/truss/runtime";
      const el = <div {...trussProps({ display: ["df", new TrussDebugInfo("test.tsx:2")], alignItems: "aic" })} />;
    `,
      `
      .aic {
        align-items: center;
      }
      .df {
        display: flex;
      }
    `,
    );
  });

  test("debug mode keeps debug info in non-jsx style objects", () => {
    expectTrussTransform(
      `
      import { Css } from "./Css";
      const s = Css.df.$;
    `,
      { debug: true },
    ).toHaveTrussOutput(
      `
      import { TrussDebugInfo } from "@homebound/truss/runtime";
      const s = { display: ["df", new TrussDebugInfo("test.tsx:2")] };
    `,
      `
      .df {
        display: flex;
      }
    `,
    );
  });

  test("debug mode keeps mergeProps for className composition", () => {
    expectTrussTransform(
      `
      import { Css } from "./Css";
      const el = <div className="existing" css={Css.df.$} />;
    `,
      {
        debug: true,
      },
    ).toHaveTrussOutput(
      `
      import { mergeProps, TrussDebugInfo } from "@homebound/truss/runtime";
      const el = <div {...mergeProps("existing", undefined, { display: ["df", new TrussDebugInfo("test.tsx:2")] })} />;
    `,
      `
      .df {
        display: flex;
      }
    `,
    );
  });

  test("debug mode adds origin marker className for multi-property segments", () => {
    expectTrussTransform(
      `
      import { Css } from "./Css";
      const s = Css.bb.$;
    `,
      { debug: true },
    ).toHaveTrussOutput(
      `
      import { TrussDebugInfo } from "@homebound/truss/runtime";
      const s = { className_bb: "bb", borderBottomStyle: ["bbs_solid", new TrussDebugInfo("test.tsx:2")], borderBottomWidth: "bbw_1px" };
    `,
      `
      .bbs_solid {
        border-bottom-style: solid;
      }
      .bbw_1px {
        border-bottom-width: 1px;
      }
    `,
    );
  });

  test("debug mode adds origin marker className for variable segments with extra defs", () => {
    expectTrussTransform(
      `
      import { Css } from "./Css";
      const lines = getLineCount();
      const s = Css.lineClamp(lines).$;
    `,
      { debug: true },
    ).toHaveTrussOutput(
      `
      import { TrussDebugInfo } from "@homebound/truss/runtime";
      const lines = getLineCount();
      const s = {
        className_lineClamp: "lineClamp",
        WebkitLineClamp: ["lineClamp_var", { "--WebkitLineClamp": lines }, new TrussDebugInfo("test.tsx:3")],
        overflow: "oh",
        display: "d_negwebkit_box",
        WebkitBoxOrient: "wbo_vertical",
        textOverflow: "to_ellipsis"
      };
    `,
      `
      .oh {
        overflow: hidden;
      }
      .d_negwebkit_box {
        display: -webkit-box;
      }
      .to_ellipsis {
        text-overflow: ellipsis;
      }
      .wbo_vertical {
        -webkit-box-orient: vertical;
      }
      .lineClamp_var {
        -webkit-line-clamp: var(--WebkitLineClamp);
      }
      @property --WebkitLineClamp {
        syntax: "*";
        inherits: false;
      }
    `,
    );
  });

  test("variable with literal arg: Css.mt(2).$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.mt(2).$;
    `).toHaveTrussOutput(
      `
      const s = { marginTop: "mt_16px" };
    `,
      `
      .mt_16px {
        margin-top: 16px;
      }
    `,
    );
  });

  test("variable with string literal: Css.mt('10px').$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.mt("10px").$;
    `).toHaveTrussOutput(
      `
      const s = { marginTop: "mt_10px" };
    `,
      `
      .mt_10px {
        margin-top: 10px;
      }
    `,
    );
  });

  test("variable with variable arg: Css.mt(x).$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const x = getSomeValue();
      const s = Css.mt(x).$;
    `).toHaveTrussOutput(
      `
      const __maybeInc = inc => { return typeof inc === "string" ? inc : \`\${inc * 8}px\`; };
            const x = getSomeValue();
            const s = { marginTop: ["mt_var", { "--marginTop": __maybeInc(x) }] };
    `,
      `
      .mt_var {
        margin-top: var(--marginTop);
      }
      @property --marginTop {
        syntax: "*";
        inherits: false;
      }
    `,
    );
  });

  test("delegate with literal: Css.mtPx(12).$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.mtPx(12).$;
    `).toHaveTrussOutput(
      `
      const s = { marginTop: "mt_12px" };
    `,
      `
      .mt_12px {
        margin-top: 12px;
      }
    `,
    );
  });

  test("delegate with variable arg appends px: Css.mtPx(x).$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const x = getSomeValue();
      const s = Css.mtPx(x).$;
    `).toHaveTrussOutput(
      `
      const x = getSomeValue();
      const s = { marginTop: ["mt_var", { "--marginTop": \`\${x}px\` }] };
    `,
      `
      .mt_var {
        margin-top: var(--marginTop);
      }
      @property --marginTop {
        syntax: "*";
        inherits: false;
      }
    `,
    );
  });

  test("delegate shorthand with multiple props appends px: Css.pxPx(x).$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const x = getSomeValue();
      const s = Css.pxPx(x).$;
    `).toHaveTrussOutput(
      `
      const x = getSomeValue();
      const s = { paddingLeft: ["px_var", { "--paddingLeft": \`\${x}px\` }], paddingRight: ["px_var", { "--paddingRight": \`\${x}px\` }] };
    `,
      `
      .px_var {
        padding-left: var(--paddingLeft);
        padding-right: var(--paddingRight);
      }
      @property --paddingLeft {
        syntax: "*";
        inherits: false;
      }
      @property --paddingRight {
        syntax: "*";
        inherits: false;
      }
    `,
    );
  });

  test("delegate shorthand with multiple props supports sqPx: Css.sqPx(x).$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const x = getSomeValue();
      const s = Css.sqPx(x).$;
    `).toHaveTrussOutput(
      `
      const x = getSomeValue();
      const s = { height: ["sq_var", { "--height": \`\${x}px\` }], width: ["sq_var", { "--width": \`\${x}px\` }] };
    `,
      `
      .sq_var {
        height: var(--height);
        width: var(--width);
      }
      @property --height {
        syntax: "*";
        inherits: false;
      }
      @property --width {
        syntax: "*";
        inherits: false;
      }
    `,
    );
  });

  test("non-incremented variable: Css.bc('red').$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.bc("red").$;
    `).toHaveTrussOutput(
      `
      const s = { borderColor: "bc_red" };
    `,
      `
      .bc_red {
        border-color: red;
      }
    `,
    );
  });

  test("non-incremented variable with variable: Css.bc(color).$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const color = getColor();
      const s = Css.bc(color).$;
    `).toHaveTrussOutput(
      `
      const color = getColor();
      const s = { borderColor: ["bc_var", { "--borderColor": color }] };
    `,
      `
      .bc_var {
        border-color: var(--borderColor);
      }
      @property --borderColor {
        syntax: "*";
        inherits: false;
      }
    `,
    );
  });

  test("variable method keeps extra defs: Css.lineClamp(lines).$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const lines = getLineCount();
      const s = Css.lineClamp(lines).$;
    `).toHaveTrussOutput(
      `
      const lines = getLineCount();
      const s = {
        WebkitLineClamp: ["lineClamp_var", { "--WebkitLineClamp": lines }],
        overflow: "oh",
        display: "d_negwebkit_box",
        WebkitBoxOrient: "wbo_vertical",
        textOverflow: "to_ellipsis"
      };
    `,
      `
      .oh {
        overflow: hidden;
      }
      .d_negwebkit_box {
        display: -webkit-box;
      }
      .to_ellipsis {
        text-overflow: ellipsis;
      }
      .wbo_vertical {
        -webkit-box-orient: vertical;
      }
      .lineClamp_var {
        -webkit-line-clamp: var(--WebkitLineClamp);
      }
      @property --WebkitLineClamp {
        syntax: "*";
        inherits: false;
      }
    `,
    );
  });

  test("variable literal keeps extra defs: Css.lineClamp('3').$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.lineClamp("3").$;
    `).toHaveTrussOutput(
      `
      const s = {
        WebkitLineClamp: "wlc_3",
        overflow: "oh",
        display: "d_negwebkit_box",
        WebkitBoxOrient: "wbo_vertical",
        textOverflow: "to_ellipsis"
      };
    `,
      `
      .oh {
        overflow: hidden;
      }
      .d_negwebkit_box {
        display: -webkit-box;
      }
      .to_ellipsis {
        text-overflow: ellipsis;
      }
      .wbo_vertical {
        -webkit-box-orient: vertical;
      }
      .wlc_3 {
        -webkit-line-clamp: 3;
      }
    `,
    );
  });

  test("multiple expressions dedup entries", () => {
    expectTrussTransform(
      `
      import { Css } from "./Css";
      const a = <div css={Css.df.$} />;
      const b = <div css={Css.df.aic.$} />;
    `,
    ).toHaveTrussOutput(
      `
      const a = <div className="df" />;
      const b = <div className="df aic" />;
    `,
      `
      .aic {
        align-items: center;
      }
      .df {
        display: flex;
      }
    `,
    );
  });

  test("alias expansion: Css.bodyText.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.bodyText.$;
    `).toHaveTrussOutput(
      `
      const s = { fontSize: "f14", color: "black" };
    `,
      `
      .black {
        color: #353535;
      }
      .f14 {
        font-size: 14px;
      }
    `,
    );
  });

  test("typography literal: Css.typography('f14').$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.typography("f14").$;
    `).toHaveTrussOutput(
      `
      const s = { fontSize: "f14" };
    `,
      `
      .f14 {
        font-size: 14px;
      }
    `,
    );
  });

  test("typography runtime key: Css.typography(key).$", () => {
    const code = `
      import { Css, type Typography } from "./Css";
      const key: Typography = pickType();
      const s = Css.typography(key).$;
    `;

    expectTrussTransform(code).toHaveTrussOutput(
      `
      import { type Typography } from "./Css";
      const __typography = {
        f24: { fontSize: "f24" },
        f18: { fontSize: "f18" },
        f16: { fontSize: "f16" },
        f14: { fontSize: "f14" },
        f12: { fontSize: "f12" },
        f10: { fontSize: "fz_10px", fontWeight: "fw5" }
      };
      const key: Typography = pickType();
      const s = { ...(__typography[key] ?? {}) };
    `,
      `
        .f12 {
          font-size: 12px;
        }
        .f14 {
          font-size: 14px;
        }
        .f16 {
          font-size: 16px;
        }
        .f18 {
          font-size: 18px;
        }
        .f24 {
          font-size: 24px;
        }
        .fw5 {
          font-weight: 500;
        }
        .fz_10px {
          font-size: 10px;
        }
      `,
    );
  });

  test("typography runtime keys across breakpoint contexts", () => {
    expectTrussTransform(
      `
      import { Css, type Typography } from "./Css";
      const key: Typography = pickType();
      const otherKey: Typography = pickOtherType();
      const s = Css.typography(key).ifSm.typography(otherKey).$;
    `,
    ).toHaveTrussOutput(
      `
      import { type Typography } from "./Css";
      const __typography = {
        f24: { fontSize: "f24" },
        f18: { fontSize: "f18" },
        f16: { fontSize: "f16" },
        f14: { fontSize: "f14" },
        f12: { fontSize: "f12" },
        f10: { fontSize: "fz_10px", fontWeight: "fw5" }
      };
      const __typography__sm = {
        f24: { fontSize: "sm_f24" },
        f18: { fontSize: "sm_f18" },
        f16: { fontSize: "sm_f16" },
        f14: { fontSize: "sm_f14" },
        f12: { fontSize: "sm_f12" },
        f10: { fontSize: "sm_fz_10px", fontWeight: "sm_fw5" }
      };
      const key: Typography = pickType();
      const otherKey: Typography = pickOtherType();
      const s = { ...(__typography[key] ?? {}), ...(__typography__sm[otherKey] ?? {}) };
    `,
      `
      .f12 {
        font-size: 12px;
      }
      .f14 {
        font-size: 14px;
      }
      .f16 {
        font-size: 16px;
      }
      .f18 {
        font-size: 18px;
      }
      .f24 {
        font-size: 24px;
      }
      .fw5 {
        font-weight: 500;
      }
      .fz_10px {
        font-size: 10px;
      }
      @media screen and (max-width: 599px) {
        .sm_f12.sm_f12 {
          font-size: 12px;
        }
      }
      @media screen and (max-width: 599px) {
        .sm_f14.sm_f14 {
          font-size: 14px;
        }
      }
      @media screen and (max-width: 599px) {
        .sm_f16.sm_f16 {
          font-size: 16px;
        }
      }
      @media screen and (max-width: 599px) {
        .sm_f18.sm_f18 {
          font-size: 18px;
        }
      }
      @media screen and (max-width: 599px) {
        .sm_f24.sm_f24 {
          font-size: 24px;
        }
      }
      @media screen and (max-width: 599px) {
        .sm_fw5.sm_fw5 {
          font-weight: 500;
        }
      }
      @media screen and (max-width: 599px) {
        .sm_fz_10px.sm_fz_10px {
          font-size: 10px;
        }
      }
    `,
    );
  });

  test("Css import is removed when only Css is imported", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.df.$;
    `).toHaveTrussOutput(
      `
      const s = { display: "df" };
    `,
      `
      .df {
        display: flex;
      }
    `,
    );
  });

  test("Css specifier removed but Palette kept", () => {
    expectTrussTransform(`
      import { Css, Palette } from "./Css";
      const s = Css.df.$;
      const c = Palette.Black;
    `).toHaveTrussOutput(
      `
      import { Palette } from "./Css";
      const s = { display: "df" };
      const c = Palette.Black;
    `,
      `
      .df {
        display: flex;
      }
    `,
    );
  });

  test("multi-property static: Css.ba.$ (border)", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.ba.$;
    `).toHaveTrussOutput(
      `
      const s = { borderStyle: "bss", borderWidth: "bw1" };
    `,
      `
      .bss {
        border-style: solid;
      }
      .bw1 {
        border-width: 1px;
      }
    `,
    );
  });

  test("mixed static and variable: Css.df.mt(2).black.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.df.mt(2).black.$;
    `).toHaveTrussOutput(
      `
      const s = { display: "df", marginTop: "mt_16px", color: "black" };
    `,
      `
      .black {
        color: #353535;
      }
      .df {
        display: flex;
      }
      .mt_16px {
        margin-top: 16px;
      }
    `,
    );
  });

  test("onHover pseudo: Css.black.onHover.blue.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.black.onHover.blue.$;
    `).toHaveTrussOutput(
      `
      const s = { color: "black h_blue" };
    `,
      `
      .black {
        color: #353535;
      }
      .h_blue:hover {
        color: #526675;
      }
    `,
    );
  });

  test("onHover with multi-property: Css.onHover.ba.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.onHover.ba.$;
    `).toHaveTrussOutput(
      `
      const s = { borderStyle: "h_bss", borderWidth: "h_bw1" };
    `,
      `
      .h_bss:hover {
        border-style: solid;
      }
      .h_bw1:hover {
        border-width: 1px;
      }
    `,
    );
  });

  test("onFocus pseudo: Css.onFocus.blue.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.onFocus.blue.$;
    `).toHaveTrussOutput(
      `
      const s = { color: "f_blue" };
    `,
      `
      .f_blue:focus {
        color: #526675;
      }
    `,
    );
  });

  test("onFocusWithin pseudo: Css.onFocusWithin.blue.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.onFocusWithin.blue.$;
    `).toHaveTrussOutput(
      `
      const s = { color: "fw_blue" };
    `,
      `
      .fw_blue:focus-within {
        color: #526675;
      }
    `,
    );
  });

  test("ifFirstOfType pseudo: Css.ifFirstOfType.blue.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.ifFirstOfType.blue.$;
    `).toHaveTrussOutput(
      `
      const s = { color: "fot_blue" };
    `,
      `
      .fot_blue:first-of-type {
        color: #526675;
      }
    `,
    );
  });

  test("ifLastOfType pseudo: Css.ifLastOfType.blue.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.ifLastOfType.blue.$;
    `).toHaveTrussOutput(
      `
      const s = { color: "lot_blue" };
    `,
      `
      .lot_blue:last-of-type {
        color: #526675;
      }
    `,
    );
  });

  test("onHover with variable literal: Css.onHover.bc('red').$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.onHover.bc("red").$;
    `).toHaveTrussOutput(
      `
      const s = { borderColor: "h_bc_red" };
    `,
      `
      .h_bc_red:hover {
        border-color: red;
      }
    `,
    );
  });

  test("onHover with variable variable: Css.onHover.bc(color).$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const color = getColor();
      const s = Css.onHover.bc(color).$;
    `).toHaveTrussOutput(
      `
      const color = getColor();
      const s = { borderColor: ["h_bc_var", { "--h_borderColor": color }] };
    `,
      `
      .h_bc_var:hover {
        border-color: var(--h_borderColor);
      }
      @property --h_borderColor {
        syntax: "*";
        inherits: false;
      }
    `,
    );
  });

  test("container query pseudo: Css.ifContainer({ gt, lt }).gc('span 2').$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.ifContainer({ gt: 600, lt: 960 }).gc("span 2").$;
    `).toHaveTrussOutput(
      `
      const s = { gridColumn: "mq_gc_span_2" };
    `,
      `
      @container (min-width: 601px) and (max-width: 960px) {
        .mq_gc_span_2.mq_gc_span_2 {
          grid-column: span 2;
        }
      }
    `,
    );
  });

  test("container query merges overlapping property", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.black.ifContainer({ gt: 600, lt: 960 }).blue.$;
    `).toHaveTrussOutput(
      `
      const s = { color: "black mq_blue" };
    `,
      `
      .black {
        color: #353535;
      }
      @container (min-width: 601px) and (max-width: 960px) {
        .mq_blue.mq_blue {
          color: #526675;
        }
      }
    `,
    );
  });

  test("container query with named container", () => {
    expectTrussTransform(
      `
      import { Css } from "./Css";
      const s = Css.ifContainer({ name: "grid", gt: 600, lt: 960 }).blue.$;
    `,
    ).toHaveTrussOutput(
      `
      const s = { color: "mq_blue" };
    `,
      `
      @container grid (min-width: 601px) and (max-width: 960px) {
        .mq_blue.mq_blue {
          color: #526675;
        }
      }
    `,
    );
  });

  test("container query requires literal bounds: emits console.error and preserves valid segments", () => {
    expectTrussTransform(
      `
      import { Css } from "./Css";
      const minWidth = getMinWidth();
      const maxWidth = getMaxWidth();
      const s = Css.ifContainer({ gt: minWidth, lt: maxWidth }).blue.$;
    `,
    ).toHaveTrussOutput(
      `
      console.error("[truss] Unsupported pattern: ifContainer().gt must be a numeric literal (test.tsx:4)");
      const minWidth = getMinWidth();
      const maxWidth = getMaxWidth();
      const s = { color: "blue" };
    `,
      `
      .blue {
        color: #526675;
      }
    `,
    );
  });

  test("object spread composition uses native object spread", () => {
    expectTrussTransform(
      `
      import { Css } from "./Css";

      const styles = {
        wrapper: {
          ...Css.df.aic.$,
          ...(someCondition ? Css.black.$ : Css.blue.$),
          ...(!compound ? Css.ba.$ : {}),
        },
        hover: Css.bgBlue.$,
      };

      const el = <div css={{ ...styles.wrapper, ...(isHovered ? styles.hover : {}) }} />;
    `,
    ).toHaveTrussOutput(
      `
      import { trussProps } from "@homebound/truss/runtime";
      const styles = {
        wrapper: {
          ...{ display: "df", alignItems: "aic" },
          ...(someCondition ? { color: "black" } : { color: "blue" }),
          ...(!compound ? { borderStyle: "bss", borderWidth: "bw1" } : {})
        },
        hover: { backgroundColor: "bgBlue" }
      };
      const el = <div {...trussProps({ ...styles.wrapper, ...(isHovered ? styles.hover : {}) })} />;
    `,
      `
      .bss {
        border-style: solid;
      }
      .bw1 {
        border-width: 1px;
      }
      .aic {
        align-items: center;
      }
      .bgBlue {
        background-color: #526675;
      }
      .black {
        color: #353535;
      }
      .blue {
        color: #526675;
      }
      .df {
        display: flex;
      }
    `,
    );
  });

  test("native object composition stays as-is", () => {
    expectTrussTransform(`
      import { Css } from "./Css";

      function Button(props) {
        const { active, isHovered } = props;
        const baseStyles = {
          ...Css.df.aic.$,
        };
        const activeStyles = {
          ...Css.black.$,
        };
        const hoverStyles = {
          ...Css.blue.$,
        };

        return <div css={{
          ...baseStyles,
          ...(active && activeStyles),
          ...(isHovered && hoverStyles),
        }} />;
      }
    `).toHaveTrussOutput(
      `
      import { trussProps } from "@homebound/truss/runtime";
      function Button(props) {
        const { active, isHovered } = props;
        const baseStyles = { ...{ display: "df", alignItems: "aic" } };
        const activeStyles = { ...{ color: "black" } };
        const hoverStyles = { ...{ color: "blue" } };
        return <div {...trussProps({ ...baseStyles, ...(active && activeStyles), ...(isHovered && hoverStyles) })} />;
      }
    `,
      `
      .aic {
        align-items: center;
      }
      .black {
        color: #353535;
      }
      .blue {
        color: #526675;
      }
      .df {
        display: flex;
      }
    `,
    );
  });

  test("Css.props is rewritten to trussProps spread", () => {
    expectTrussTransform(`
      import { Css } from "./Css";

      function Button() {
        const attrs = {
          "data-testid": "button",
          ...Css.props(Css.blue.$),
        };
        return <button {...attrs}>Click me</button>;
      }
    `).toHaveTrussOutput(
      `
      import { trussProps } from "@homebound/truss/runtime";
      function Button() {
        const attrs = {
          "data-testid": "button",
          ...trussProps({ color: "blue" })
        };
        return <button {...attrs}>Click me</button>;
      }
    `,
      `
      .blue {
        color: #526675;
      }
    `,
    );
  });

  test("Css.props in debug mode is rewritten to trussProps", () => {
    expectTrussTransform(
      `
      import { Css } from "./Css";

      function Button() {
        const attrs = {
          ...Css.props(Css.df.aic.$),
        };
        return <button {...attrs}>Click me</button>;
      }
    `,
      { debug: true },
    ).toHaveTrussOutput(
      `
      import { trussProps, TrussDebugInfo } from "@homebound/truss/runtime";
      function Button() {
        const attrs = {
          ...trussProps({ display: ["df", new TrussDebugInfo("test.tsx:5")], alignItems: "aic" })
        };
        return <button {...attrs}>Click me</button>;
      }
    `,
      `
      .aic {
        align-items: center;
      }
      .df {
        display: flex;
      }
    `,
    );
  });

  test("Css.props with object literal passes through to trussProps", () => {
    expectTrussTransform(`
      import { Css } from "./Css";

      function Button({ active, styles }) {
        const attrs = {
          "data-testid": "button",
          ...Css.props({
            ...styles.baseStyles,
            ...(active && styles.activeStyles),
          }),
        };
        return <button {...attrs}>Click me</button>;
      }
    `).toHaveTrussOutput(
      `
      import { trussProps } from "@homebound/truss/runtime";
      function Button({ active, styles }) {
        const attrs = {
          "data-testid": "button",
          ...trussProps({ ...styles.baseStyles, ...(active && styles.activeStyles) })
        };
        return <button {...attrs}>Click me</button>;
      }
    `,
      ``,
    );
  });

  test("Css.props with sibling className merges via mergeProps", () => {
    expectTrussTransform(`
      import { Css } from "./Css";

      function Button({ asLink, navLink }) {
        const attrs = {
          className: asLink ? navLink : undefined,
          ...Css.props(Css.df.aic.$),
        };
        return <button {...attrs}>Click me</button>;
      }
    `).toHaveTrussOutput(
      `
      import { trussProps, mergeProps } from "@homebound/truss/runtime";
      function Button({ asLink, navLink }) {
        const attrs = {
          ...mergeProps(asLink ? navLink : undefined, undefined, { display: "df", alignItems: "aic" })
        };
        return <button {...attrs}>Click me</button>;
      }
    `,
      `
      .aic {
        align-items: center;
      }
      .df {
        display: flex;
      }
    `,
    );
  });

  test("Css.props with sibling className and object literal styles", () => {
    expectTrussTransform(`
      import { Css } from "./Css";

      function Button({ asLink, navLink, baseStyles, active, hoverStyles }) {
        const attrs = {
          className: asLink ? navLink : undefined,
          ...Css.props({
            ...Css.df.$,
            ...baseStyles,
            ...(active && hoverStyles),
          }),
        };
        return <button {...attrs}>Click me</button>;
      }
    `).toHaveTrussOutput(
      `
      import { trussProps, mergeProps } from "@homebound/truss/runtime";
      function Button({ asLink, navLink, baseStyles, active, hoverStyles }) {
        const attrs = {
          ...mergeProps(asLink ? navLink : undefined, undefined, { ...{ display: "df" }, ...baseStyles, ...(active && hoverStyles) })
        };
        return <button {...attrs}>Click me</button>;
      }
    `,
      `
      .df {
        display: flex;
      }
    `,
    );
  });

  test("style object variable in css prop is lowered to trussProps", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const base = Css.df.aic.$;
      const el = <div css={base} />;
    `).toHaveTrussOutput(
      `
      import { trussProps } from "@homebound/truss/runtime";
      const base = { display: "df", alignItems: "aic" };
      const el = <div {...trussProps(base)} />;
    `,
      `
      .aic {
        align-items: center;
      }
      .df {
        display: flex;
      }
    `,
    );
  });

  test("mixed css prop spread and Css chain spread are lowered together", () => {
    expectTrussTransform(
      `
      import { Css } from "./Css";
      function Box({ cssProp }) { return <div css={{ ...cssProp, ...Css.df.$ }} />;
      }
    `,
    ).toHaveTrussOutput(
      `
      import { trussProps } from "@homebound/truss/runtime";
      function Box({ cssProp }) { return <div {...trussProps({ ...cssProp, ...{ display: "df" } })} />; }
    `,
      `
      .df {
        display: flex;
      }
    `,
    );
  });

  test("external call expression in css prop is wrapped in trussProps", () => {
    expectTrussTransform(`
      import { getFromAnotherFile } from "./other";
      import { Css } from "./Css";

      function Example({ param, content }) {
        return <div css={getFromAnotherFile(param)}><span css={Css.blue.$}>{content}</span></div>;
      }
    `).toHaveTrussOutput(
      `
      import { getFromAnotherFile } from "./other";
      import { trussProps } from "@homebound/truss/runtime";
      function Example({ param, content }) {
        return <div {...trussProps(getFromAnotherFile(param))}><span className="blue">{content}</span></div>;
      }
    `,
      `
      .blue {
        color: #526675;
      }
    `,
    );
  });

  test("css prop with non-spread property is still wrapped in trussProps", () => {
    expectTrussTransform(`
      import { Css } from "./Css";

      const base = Css.df.$;
      const cssProp = getCssProp();
      const el = <div css={{ ...cssProp, foo: true }} />;
    `).toHaveTrussOutput(
      `
      import { trussProps } from "@homebound/truss/runtime";
      const base = { display: "df" };
      const cssProp = getCssProp();
      const el = <div {...trussProps({ ...cssProp, foo: true })} />;
    `,
      `
      .df {
        display: flex;
      }
    `,
    );
  });

  test("conditional css prop with undefined branch is still wrapped", () => {
    expectTrussTransform(`
      import { Css } from "./Css";

      function Repro(props: { enabled: boolean }) {
        return <div css={props.enabled ? Css.pb2.$ : undefined}>hello</div>;
      }
    `).toHaveTrussOutput(
      `
      import { trussProps } from "@homebound/truss/runtime";
      function Repro(props: { enabled: boolean; }) {
        return <div {...trussProps(props.enabled ? { paddingBottom: "pb2" } : undefined)}>hello</div>;
      }
    `,
      `
      .pb2 {
        padding-bottom: 16px;
      }
    `,
    );
  });

  test("ordinary object spreads stay objects", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = { foo: true, ...other };
      const t = Css.df.$;
    `).toHaveTrussOutput(
      `
      const s = { foo: true, ...other };
      const t = { display: "df" };
    `,
      `
      .df {
        display: flex;
      }
    `,
    );
  });

  test("style composition objects stay as native object spread", () => {
    expectTrussTransform(
      `
      import { Css } from "./Css";
      const borderBottomStyles = Css.bb.$;
      const styles = { activeStyles: { ...Css.black.$, foo: true, ...borderBottomStyles } };
    `,
    ).toHaveTrussOutput(
      `
      const borderBottomStyles = { borderBottomStyle: "bbs_solid", borderBottomWidth: "bbw_1px" };
      const styles = { activeStyles: { ...{ color: "black" }, foo: true, ...borderBottomStyles } };
    `,
      `
      .black {
        color: #353535;
      }
      .bbs_solid {
        border-bottom-style: solid;
      }
      .bbw_1px {
        border-bottom-width: 1px;
      }
    `,
    );
  });

  test("style composition objects can mix Css spreads with external spreads", () => {
    expectTrussTransform(
      `
      import { Css } from "./Css";
      const borderBottomStyles = maybeStyles();
      const styles = { activeStyles: { ...Css.black.$, ...borderBottomStyles } };
    `,
    ).toHaveTrussOutput(
      `
      const borderBottomStyles = maybeStyles();
      const styles = { activeStyles: { ...{ color: "black" }, ...borderBottomStyles } };
    `,
      `
      .black {
        color: #353535;
      }
    `,
    );
  });

  test("style composition objects support active and hover style maps with shared border styles", () => {
    expectTrussTransform(`
      import { Css } from "./Css";

      function getTabStyles() {
        const borderBottomStyles = maybeBorderStyles();
        return {
          baseStyles: Css.df.aic.hPx(32).px1.outline0.black.cursorPointer.$,
          activeStyles: { ...Css.black.br4.$, ...borderBottomStyles },
          disabledStyles: Css.blue.cursorNotAllowed.$,
          focusRingStyles: Css.ba.$,
          hoverStyles: { ...Css.blue.$, ...borderBottomStyles },
          activeHoverStyles: { ...Css.ba.black.$, ...borderBottomStyles },
        };
      }
    `).toHaveTrussOutput(
      `
      function getTabStyles() {
        const borderBottomStyles = maybeBorderStyles();
        return {
          baseStyles: { display: "df", alignItems: "aic", height: "h_32px", paddingLeft: "pl1", paddingRight: "pr1", outline: "outline0", color: "black", cursor: "cursorPointer" },
          activeStyles: { ...{ color: "black", borderRadius: "br4" }, ...borderBottomStyles },
          disabledStyles: { color: "blue", cursor: "cursorNotAllowed" },
          focusRingStyles: { borderStyle: "bss", borderWidth: "bw1" },
          hoverStyles: { ...{ color: "blue" }, ...borderBottomStyles },
          activeHoverStyles: { ...{ borderStyle: "bss", borderWidth: "bw1", color: "black" }, ...borderBottomStyles }
        };
      }
    `,
      `
      .br4 {
        border-radius: 1rem;
      }
      .bss {
        border-style: solid;
      }
      .bw1 {
        border-width: 1px;
      }
      .outline0 {
        outline: 0;
      }
      .aic {
        align-items: center;
      }
      .black {
        color: #353535;
      }
      .blue {
        color: #526675;
      }
      .cursorNotAllowed {
        cursor: not-allowed;
      }
      .cursorPointer {
        cursor: pointer;
      }
      .df {
        display: flex;
      }
      .h_32px {
        height: 32px;
      }
      .pl1 {
        padding-left: 8px;
      }
      .pr1 {
        padding-right: 8px;
      }
    `,
    );
  });

  test("conditional: Css.if(cond).df.else.db.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.if(isActive).df.else.db.$;
    `).toHaveTrussOutput(
      `
      const s = { ...(isActive ? { display: "df" } : { display: "db" }) };
    `,
      `
      .db {
        display: block;
      }
      .df {
        display: flex;
      }
    `,
    );
  });

  test("conditional with preceding styles: Css.p1.if(cond).df.else.db.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.p1.if(isActive).df.else.db.$;
    `).toHaveTrussOutput(
      `
      const s = {
        paddingTop: "pt1",
        paddingBottom: "pb1",
        paddingRight: "pr1",
        paddingLeft: "pl1",
        ...(isActive ? { display: "df" } : { display: "db" })
      };
    `,
      `
      .db {
        display: block;
      }
      .df {
        display: flex;
      }
      .pb1 {
        padding-bottom: 8px;
      }
      .pl1 {
        padding-left: 8px;
      }
      .pr1 {
        padding-right: 8px;
      }
      .pt1 {
        padding-top: 8px;
      }
    `,
    );
  });

  test("else branch includes trailing styles: Css.if(cond).df.else.db.mt1.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.if(isActive).df.else.db.mt1.$;
    `).toHaveTrussOutput(
      `
      const s = { ...(isActive ? { display: "df" } : { display: "db", marginTop: "mt1" }) };
    `,
      `
      .db {
        display: block;
      }
      .df {
        display: flex;
      }
      .mt1 {
        margin-top: 8px;
      }
    `,
    );
  });

  test("conditional pseudo branch keeps earlier base class on the same property", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.black.if(isActive).onHover.white.$;
    `).toHaveTrussOutput(
      `
      const s = { color: "black", ...(isActive ? { color: "black h_white" } : {}) };
    `,
      `
        .black {
          color: #353535;
        }
        .h_white:hover {
          color: #fcfcfa;
        }
      `,
    );
  });

  test("conditional else pseudo branch keeps earlier base class on the same property", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.black.if(isActive).bgBlue.else.onHover.white.$;
    `).toHaveTrussOutput(
      `
      const s = { color: "black", ...(isActive ? { backgroundColor: "bgBlue" } : { color: "black h_white" }) };
    `,
      `
        .bgBlue {
          background-color: #526675;
        }
        .black {
          color: #353535;
        }
        .h_white:hover {
          color: #fcfcfa;
        }
      `,
    );
  });

  test("conditional same-property replacement does not merge base class into branch", () => {
    // Css.bgBlue.if(selected).bgWhite.$ — when selected, bgWhite replaces bgBlue entirely.
    // The base class should NOT be merged into the then branch.
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.bgBlue.if(selected).bgWhite.$;
    `).toHaveTrussOutput(
      `
      const s = { backgroundColor: "bgBlue", ...(selected ? { backgroundColor: "bgWhite" } : {}) };
    `,
      `
      .bgBlue {
        background-color: #526675;
      }
      .bgWhite {
        background-color: #fcfcfa;
      }
    `,
    );
  });

  test("conditional replacement preserves preceding non-overlapping properties", () => {
    // Css.df.aic.bgBlue.if(selected).bgWhite.$ — df and aic should survive the conditional
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.df.aic.bgBlue.if(selected).bgWhite.$;
    `).toHaveTrussOutput(
      `
      const s = { display: "df", alignItems: "aic", backgroundColor: "bgBlue", ...(selected ? { backgroundColor: "bgWhite" } : {}) };
    `,
      `
      .aic {
        align-items: center;
      }
      .bgBlue {
        background-color: #526675;
      }
      .bgWhite {
        background-color: #fcfcfa;
      }
      .df {
        display: flex;
      }
    `,
    );
  });

  test("conditional replacement with many preceding properties and delegates preserves all base classes", () => {
    expectTrussTransform(
      `
      import { Css } from "./Css";
      const el = <div css={Css.absolute.bottomPx(4).wPx(4).hPx(4).bgBlue.br4.if(selected && !range_middle).bgWhite.$} />;
    `,
    ).toHaveTrussOutput(
      `
      import { trussProps } from "@homebound/truss/runtime";
      const el = <div {...trussProps({
        position: "absolute",
        bottom: "bottom_4px",
        width: "w_4px",
        height: "h_4px",
        backgroundColor: "bgBlue",
        borderRadius: "br4",
        ...(selected && !range_middle ? { backgroundColor: "bgWhite" } : {})
      })} />;
    `,
      `
      .br4 {
        border-radius: 1rem;
      }
      .absolute {
        position: absolute;
      }
      .bgBlue {
        background-color: #526675;
      }
      .bgWhite {
        background-color: #fcfcfa;
      }
      .bottom_4px {
        bottom: 4px;
      }
      .h_4px {
        height: 4px;
      }
      .w_4px {
        width: 4px;
      }
    `,
    );
  });

  test("conditional variable branch replaces base class on the same property", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.w100.if(isActive).w(getWidth()).$;
    `).toHaveTrussOutput(
      `
      const __maybeInc = inc => { return typeof inc === "string" ? inc : \`\${inc * 8}px\`; };
      const s = { width: "w100", ...(isActive ? { width: ["w_var", { "--width": __maybeInc(getWidth()) }] } : {}) };
    `,
      `
        .w100 {
          width: 100%;
        }
        .w_var {
          width: var(--width);
        }
        @property --width {
          syntax: "*";
          inherits: false;
        }
      `,
    );
  });

  test("later base-level property replaces earlier base-level property", () => {
    // Css.ba sets borderWidth: "1px", then add("borderWidth", "3px") should replace it, not accumulate
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.ba.add("borderWidth", "3px").$;
    `).toHaveTrussOutput(
      `
      const s = { borderStyle: "bss", borderWidth: "borderWidth_3px" };
    `,
      `
      .borderWidth_3px {
        border-width: 3px;
      }
      .bss {
        border-style: solid;
      }
      .bw1 {
        border-width: 1px;
      }
    `,
    );
  });

  test("negative increment: Css.mt(-1).$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.mt(-1).$;
    `).toHaveTrussOutput(
      `
      const s = { marginTop: "mt_neg8px" };
    `,
      `
      .mt_neg8px {
        margin-top: -8px;
      }
    `,
    );
  });

  test("increment zero: Css.mt(0).$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.mt(0).$;
    `).toHaveTrussOutput(
      `
      const s = { marginTop: "mt_0px" };
    `,
      `
      .mt_0px {
        margin-top: 0px;
      }
    `,
    );
  });

  test("static increment getters: Css.mt0.mt1.p1.$ — later mt1 replaces mt0", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.mt0.mt1.p1.$;
    `).toHaveTrussOutput(
      `
      const s = {
        marginTop: "mt1",
        paddingTop: "pt1",
        paddingBottom: "pb1",
        paddingRight: "pr1",
        paddingLeft: "pl1"
      };
    `,
      `
      .mt0 {
        margin-top: 0px;
      }
      .mt1 {
        margin-top: 8px;
      }
      .pb1 {
        padding-bottom: 8px;
      }
      .pl1 {
        padding-left: 8px;
      }
      .pr1 {
        padding-right: 8px;
      }
      .pt1 {
        padding-top: 8px;
      }
    `,
    );
  });

  test("className merging: css + className on same element", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const el = <div className="existing" css={Css.df.$} />;
    `).toHaveTrussOutput(
      `
      import { mergeProps } from "@homebound/truss/runtime";
      const el = <div {...mergeProps("existing", undefined, { display: "df" })} />;
    `,
      `
      .df {
        display: flex;
      }
    `,
    );
  });

  test("custom className passthrough: Css.className(cls).df.$", () => {
    expectTrussTransform(
      `
      import { Css } from "./Css";
      const cls = getClass();
      const el = <div css={Css.className(cls).df.$} />;
    `,
    ).toHaveTrussOutput(
      `
      import { trussProps } from "@homebound/truss/runtime";
      const cls = getClass();
      const el = <div {...trussProps({ className_cls: cls, display: "df" })} />;
    `,
      `
      .df {
        display: flex;
      }
    `,
    );
  });

  test("custom className passthrough combines across spread expressions", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = { ...Css.className("foo").$, ...Css.className("bar").$ };
    `).toHaveTrussOutput(
      `
      const s = { ...{ className_foo: "foo" }, ...{ className_bar: "bar" } };
    `,
      ``,
    );
  });

  test("className merging: css + variable className expression", () => {
    expectTrussTransform(
      `
      import { Css } from "./Css";
      const cls = getClass();
      const el = <div className={cls} css={Css.df.$} />;
    `,
    ).toHaveTrussOutput(
      `
      import { mergeProps } from "@homebound/truss/runtime";
      const cls = getClass();
      const el = <div {...mergeProps(cls, undefined, { display: "df" })} />;
    `,
      `
      .df {
        display: flex;
      }
    `,
    );
  });

  test("style merging: css + style on same element", () => {
    expectTrussTransform(
      `
      import { Css } from "./Css";
      const el = <div style={{ minWidth: "fit-content" }} css={Css.blue.$} />;
    `,
    ).toHaveTrussOutput(
      `
      import { mergeProps } from "@homebound/truss/runtime";
      const el = <div {...mergeProps(undefined, { minWidth: "fit-content" }, { color: "blue" })} />;
    `,
      `
      .blue {
        color: #526675;
      }
    `,
    );
  });

  test("bundled file with multiple @homebound/truss/runtime imports does not duplicate mergeProps", () => {
    expectTrussTransform(`
      import { trussProps } from "@homebound/truss/runtime";
      import { Css } from "./Css";
      const a = <div {...trussProps({ display: "df" })} />;
      const other = someCode();
      import { mergeProps as mergeProps13 } from "@homebound/truss/runtime";
      const b = <div {...mergeProps13("cls", undefined, { display: "df" })} />;
      const el = <div className="existing" css={Css.df.$} />;
    `).toHaveTrussOutput(
      `
      import { trussProps } from "@homebound/truss/runtime";
      const a = <div {...trussProps({ display: "df" })} />;
      const other = someCode();
      import { mergeProps as mergeProps13 } from "@homebound/truss/runtime";
      const b = <div {...mergeProps13("cls", undefined, { display: "df" })} />;
      const el = <div {...mergeProps13("existing", undefined, { display: "df" })} />;
    `,
      `
      .df {
        display: flex;
      }
    `,
    );
  });

  test("falls back for __maybeInc helper name collisions", () => {
    expectTrussTransform(
      `
      import { Css } from "./Css";
      const __maybeInc = keepMe();
      const x = getSomeValue();
      const s = Css.mt(x).$;
    `,
    ).toHaveTrussOutput(
      `
      const __maybeInc_1 = inc => { return typeof inc === "string" ? inc : \`\${inc * 8}px\`; };
            const __maybeInc = keepMe();
            const x = getSomeValue();
            const s = { marginTop: ["mt_var", { "--marginTop": __maybeInc_1(x) }] };
    `,
      `
      .mt_var {
        margin-top: var(--marginTop);
      }
      @property --marginTop {
        syntax: "*";
        inherits: false;
      }
    `,
    );
  });

  test("onHover on same property merges base+pseudo into single entry", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.bgBlue.onHover.bgBlack.$;
    `).toHaveTrussOutput(
      `
      const s = { backgroundColor: "bgBlue h_bgBlack" };
    `,
      `
      .bgBlue {
        background-color: #526675;
      }
      .h_bgBlack:hover {
        background-color: #353535;
      }
    `,
    );
  });

  test("onHover merge: non-overlapping properties kept separate", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.df.onHover.blue.$;
    `).toHaveTrussOutput(
      `
      const s = { display: "df", color: "h_blue" };
    `,
      `
      .df {
        display: flex;
      }
      .h_blue:hover {
        color: #526675;
      }
    `,
    );
  });

  // ── Marker tests ────────────────────────────────────────────────────

  test("Css.marker.$ emits a default marker class", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.marker.$;
    `).toHaveTrussOutput(
      `
      const s = { __marker: "_mrk" };
    `,
      ``,
    );
  });

  test("Css.marker.$ in JSX css prop emits trussProps with marker metadata", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const el = <div css={Css.marker.$} />;
    `).toHaveTrussOutput(
      `
      const el = <div className="_mrk" />;
    `,
      ``,
    );
  });

  test("Css.marker.df.$ combines marker with styles", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.marker.df.$;
    `).toHaveTrussOutput(
      `
      const s = { __marker: "_mrk", display: "df" };
    `,
      `
      .df {
        display: flex;
      }
    `,
    );
  });

  test("Css.markerOf(row).$ passes marker variable through", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const row = Css.newMarker();
      const s = Css.markerOf(row).$;
    `).toHaveTrussOutput(
      `
      const row = Css.newMarker();
      const s = { __marker: "_row_mrk" };
    `,
      ``,
    );
  });

  test("marker and when(row, 'ancestor') in same file use same user-defined marker variable", () => {
    expectTrussTransform(
      `
      import { Css } from "./Css";
      const row = Css.newMarker();
      const a = Css.markerOf(row).$;
      const b = Css.when(row, "ancestor", ":hover").blue.$;
      `,
    ).toHaveTrussOutput(
      `
      const row = Css.newMarker();
      const a = { __marker: "_row_mrk" };
      const b = { color: "wh_anc_h_row_blue" };
      `,
      `
        ._row_mrk:hover .wh_anc_h_row_blue {
          color: #526675;
        }
      `,
    );
  });

  // ── when() generic API tests ──────────────────────────────────────

  test("Css.when(':hover:not(:disabled)').black.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.when(":hover:not(:disabled)").black.$;
    `).toHaveTrussOutput(
      `
      const s = { color: "h_n_d_black" };
    `,
      `
        .h_n_d_black:hover:not(:disabled) {
          color: #353535;
        }
      `,
    );
  });

  test("Css.when(marker, 'ancestor', ':hover').blue.$", () => {
    expectTrussTransform(`
      import { Css, marker } from "./Css";
      const s = Css.when(marker, "ancestor", ":hover").blue.$;
    `).toHaveTrussOutput(
      `
      import { marker } from "./Css";
      const s = { color: "wh_anc_h_blue" };
    `,
      `
        ._mrk:hover .wh_anc_h_blue {
          color: #526675;
        }
      `,
    );
  });

  test("Css.when(customMarker, 'ancestor', ':hover').blue.$", () => {
    expectTrussTransform(
      `
      import { Css } from "./Css";
      const customMarker = Css.newMarker();
      const s = Css.when(customMarker, "ancestor", ":hover").blue.$;
    `,
    ).toHaveTrussOutput(
      `
      const customMarker = Css.newMarker();
      const s = { color: "wh_anc_h_customMarker_blue" };
    `,
      `
      ._customMarker_mrk:hover .wh_anc_h_customMarker_blue {
        color: #526675;
      }
    `,
    );
  });

  test("Css.when(marker, 'descendant', ':focus').blue.$", () => {
    expectTrussTransform(`
      import { Css, marker } from "./Css";
      const s = Css.when(marker, "descendant", ":focus").blue.$;
    `).toHaveTrussOutput(
      `
      import { marker } from "./Css";
      const s = { color: "wh_desc_f_blue" };
    `,
      `
        .wh_desc_f_blue:has(._mrk:focus) {
          color: #526675;
        }
      `,
    );
  });

  test("Css.when(marker, 'siblingAfter', ':hover').blue.$", () => {
    expectTrussTransform(`
      import { Css, marker } from "./Css";
      const s = Css.when(marker, "siblingAfter", ":hover").blue.$;
    `).toHaveTrussOutput(
      `
      import { marker } from "./Css";
      const s = { color: "wh_sibA_h_blue" };
    `,
      `
        .wh_sibA_h_blue:has(~ ._mrk:hover) {
          color: #526675;
        }
      `,
    );
  });

  test("Css.when(marker, 'siblingBefore', ':hover').blue.$", () => {
    expectTrussTransform(`
      import { Css, marker } from "./Css";
      const s = Css.when(marker, "siblingBefore", ":hover").blue.$;
    `).toHaveTrussOutput(
      `
      import { marker } from "./Css";
      const s = { color: "wh_sibB_h_blue" };
    `,
      `
        ._mrk:hover ~ .wh_sibB_h_blue {
          color: #526675;
        }
      `,
    );
  });

  test("Css.when(marker, 'anySibling', ':hover').blue.$", () => {
    expectTrussTransform(`
      import { Css, marker } from "./Css";
      const s = Css.when(marker, "anySibling", ":hover").blue.$;
    `).toHaveTrussOutput(
      `
      import { marker } from "./Css";
      const s = { color: "wh_anyS_h_blue" };
    `,
      `
        .wh_anyS_h_blue:has(~ ._mrk:hover), ._mrk:hover ~ .wh_anyS_h_blue {
          color: #526675;
        }
      `,
    );
  });

  test("Css.when(row, 'anySibling', ':hover').blue.$", () => {
    expectTrussTransform(
      `
      import { Css } from "./Css";
      const row = Css.newMarker();
      const s = Css.when(row, "anySibling", ":hover").blue.$;
    `,
    ).toHaveTrussOutput(
      `
      const row = Css.newMarker();
      const s = { color: "wh_anyS_h_row_blue" };
    `,
      `
      .wh_anyS_h_row_blue:has(~ ._row_mrk:hover), ._row_mrk:hover ~ .wh_anyS_h_row_blue {
        color: #526675;
      }
    `,
    );
  });

  test("Css.when with removed 2-arg relationship form emits console.error", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.when("ancestor", ":hover").blue.$;
    `).toHaveTrussOutput(
      `
      console.error("[truss] Unsupported pattern: when() expects 1 or 3 arguments (selector) or (marker, relationship, pseudo), got 2 (test.tsx:2)");
      const s = { color: "blue" };
    `,
      `
      .blue {
        color: #526675;
      }
    `,
    );
  });

  test("Css.when with invalid relationship emits console.error", () => {
    expectTrussTransform(`
      import { Css, marker } from "./Css";
      const s = Css.when(marker, "bogus", ":hover").blue.$;
    `).toHaveTrussOutput(
      `
      import { marker } from "./Css";
      console.error("[truss] Unsupported pattern: when() relationship must be one of: ancestor, descendant, anySibling, siblingBefore, siblingAfter -- got \\\"bogus\\\" (test.tsx:2)");
      const s = { color: "blue" };
    `,
      `
      .blue {
        color: #526675;
      }
    `,
    );
  });

  test("Css.when with non-literal relationship emits console.error", () => {
    expectTrussTransform(`
      import { Css, marker } from "./Css";
      const rel = "ancestor";
      const s = Css.when(marker, rel, ":hover").blue.$;
    `).toHaveTrussOutput(
      `
      import { marker } from "./Css";
      console.error("[truss] Unsupported pattern: when() relationship argument must be a string literal (test.tsx:3)");
      const rel = "ancestor";
      const s = { color: "blue" };
    `,
      `
      .blue {
        color: #526675;
      }
    `,
    );
  });

  test("markerOf accepts a variable argument", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const row = getMarker();
      const s = Css.markerOf(row).df.$;
    `).toHaveTrussOutput(
      `
      const row = getMarker();
      const s = { __marker: "_row_mrk", display: "df" };
    `,
      `
      .df {
        display: flex;
      }
    `,
    );
  });

  // ── Breakpoint / media query tests ──────────────────────────────────

  test("if(mediaQuery) as pseudo: Css.if('@media screen and (max-width: 599px)').df.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.if("@media screen and (max-width: 599px)").df.$;
    `).toHaveTrussOutput(
      `
      const s = { display: "sm_df" };
    `,
      `
      @media screen and (max-width: 599px) {
        .sm_df.sm_df {
          display: flex;
        }
      }
    `,
    );
  });

  test("if(mediaQuery) merges with base: Css.bgBlue.if('@media screen and (max-width: 599px)').bgBlack.$", () => {
    expectTrussTransform(
      `
      import { Css } from "./Css";
      const s = Css.bgBlue.if("@media screen and (max-width: 599px)").bgBlack.$;
    `,
    ).toHaveTrussOutput(
      `
      const s = { backgroundColor: "bgBlue sm_bgBlack" };
    `,
      `
      .bgBlue {
        background-color: #526675;
      }
      @media screen and (max-width: 599px) {
        .sm_bgBlack.sm_bgBlack {
          background-color: #353535;
        }
      }
    `,
    );
  });

  test("if(Breakpoints.sm) works like if('@media...')", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.if("@media screen and (min-width: 960px)").df.$;
    `).toHaveTrussOutput(
      `
      const s = { display: "lg_df" };
    `,
      `
      @media screen and (min-width: 960px) {
        .lg_df.lg_df {
          display: flex;
        }
      }
    `,
    );
  });

  test("breakpoint + pseudo combination: Css.ifSm.onHover.blue.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.ifSm.onHover.blue.$;
    `).toHaveTrussOutput(
      `
      const s = { color: "sm_h_blue" };
    `,
      `
      @media screen and (max-width: 599px) {
        .sm_h_blue.sm_h_blue:hover {
          color: #526675;
        }
      }
    `,
    );
  });

  test("base + breakpoint + pseudo: Css.black.ifSm.onHover.blue.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.black.ifSm.onHover.blue.$;
    `).toHaveTrussOutput(
      `
      const s = { color: "black sm_h_blue" };
    `,
      `
      .black {
        color: #353535;
      }
      @media screen and (max-width: 599px) {
        .sm_h_blue.sm_h_blue:hover {
          color: #526675;
        }
      }
    `,
    );
  });

  test("base + breakpoint color + breakpoint+pseudo color: Css.black.ifSm.white.onHover.blue.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.black.ifSm.white.onHover.blue.$;
    `).toHaveTrussOutput(
      `
      const s = { color: "black sm_white sm_h_blue" };
    `,
      `
      .black {
        color: #353535;
      }
      @media screen and (max-width: 599px) {
        .sm_white.sm_white {
          color: #fcfcfa;
        }
      }
      @media screen and (max-width: 599px) {
        .sm_h_blue.sm_h_blue:hover {
          color: #526675;
        }
      }
    `,
    );
  });

  test("breakpoint only: Css.ifSm.df.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.ifSm.df.$;
    `).toHaveTrussOutput(
      `
      const s = { display: "sm_df" };
    `,
      `
      @media screen and (max-width: 599px) {
        .sm_df.sm_df {
          display: flex;
        }
      }
    `,
    );
  });

  test("breakpoint else uses the complementary screen query", () => {
    const input = `
      import { Css } from "./Css";
      const s = Css.ifSm.black.else.white.$;
    `;

    expectTrussTransform(input).toHaveTrussOutput(
      `
      const s = { color: "sm_black mdandup_white" };
    `,
      `
      @media screen and (min-width: 600px) {
        .mdandup_white.mdandup_white {
          color: #fcfcfa;
        }
      }
      @media screen and (max-width: 599px) {
        .sm_black.sm_black {
          color: #353535;
        }
      }
    `,
    );
  });

  test("raw media else uses the complementary screen query", () => {
    expectTrussTransform(
      `
      import { Css } from "./Css";
      const s = Css.if("@media screen and (max-width: 599px)").black.else.white.$;
    `,
    ).toHaveTrussOutput(
      `
      const s = { color: "sm_black mdandup_white" };
    `,
      `
      @media screen and (min-width: 600px) {
        .mdandup_white.mdandup_white {
          color: #fcfcfa;
        }
      }
      @media screen and (max-width: 599px) {
        .sm_black.sm_black {
          color: #353535;
        }
      }
    `,
    );
  });

  test("breakpoint after base style: Css.df.ifMd.blue.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.df.ifMd.blue.$;
    `).toHaveTrussOutput(
      `
      const s = { display: "df", color: "md_blue" };
    `,
      `
      .df {
        display: flex;
      }
      @media screen and (min-width: 600px) and (max-width: 959px) {
        .md_blue.md_blue {
          color: #526675;
        }
      }
    `,
    );
  });

  test("breakpoint merges overlapping property: Css.bgBlue.ifSm.bgBlack.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.bgBlue.ifSm.bgBlack.$;
    `).toHaveTrussOutput(
      `
      const s = { backgroundColor: "bgBlue sm_bgBlack" };
    `,
      `
      .bgBlue {
        background-color: #526675;
      }
      @media screen and (max-width: 599px) {
        .sm_bgBlack.sm_bgBlack {
          background-color: #353535;
        }
      }
    `,
    );
  });

  test("breakpoint with large: Css.ifLg.df.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.ifLg.df.$;
    `).toHaveTrussOutput(
      `
      const s = { display: "lg_df" };
    `,
      `
      @media screen and (min-width: 960px) {
        .lg_df.lg_df {
          display: flex;
        }
      }
    `,
    );
  });

  test("breakpoint with combination: Css.ifSmOrMd.blue.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.ifSmOrMd.blue.$;
    `).toHaveTrussOutput(
      `
      const s = { color: "smormd_blue" };
    `,
      `
      @media screen and (max-width: 959px) {
        .smormd_blue.smormd_blue {
          color: #526675;
        }
      }
    `,
    );
  });

  test("breakpoint with variable literal: Css.ifSm.mt(2).$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.ifSm.mt(2).$;
    `).toHaveTrussOutput(
      `
      const s = { marginTop: "sm_mt_16px" };
    `,
      `
      @media screen and (max-width: 599px) {
        .sm_mt_16px.sm_mt_16px {
          margin-top: 16px;
        }
      }
    `,
    );
  });

  test("breakpoint with multi-property: Css.ifSm.ba.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.ifSm.ba.$;
    `).toHaveTrussOutput(
      `
      const s = { borderStyle: "sm_bss", borderWidth: "sm_bw1" };
    `,
      `
      @media screen and (max-width: 599px) {
        .sm_bss.sm_bss {
          border-style: solid;
        }
      }
      @media screen and (max-width: 599px) {
        .sm_bw1.sm_bw1 {
          border-width: 1px;
        }
      }
    `,
    );
  });

  test("breakpoint in JSX: css={Css.ifSm.df.$}", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const el = <div css={Css.ifSm.df.$} />;
    `).toHaveTrussOutput(
      `
      const el = <div className="sm_df" />;
    `,
      `
      @media screen and (max-width: 599px) {
        .sm_df.sm_df {
          display: flex;
        }
      }
    `,
    );
  });

  // ── Pseudo-element tests ─────────────────────────────────────────────

  test("element('::placeholder').blue.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.element("::placeholder").blue.$;
    `).toHaveTrussOutput(
      `
      const s = { color: "placeholder_blue" };
    `,
      `
      .placeholder_blue::placeholder {
        color: #526675;
      }
    `,
    );
  });

  test("element('::selection') with static styles", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.element("::selection").bgBlue.white.$;
    `).toHaveTrussOutput(
      `
      const s = { backgroundColor: "selection_bgBlue", color: "selection_white" };
    `,
      `
      .selection_bgBlue::selection {
        background-color: #526675;
      }
      .selection_white::selection {
        color: #fcfcfa;
      }
    `,
    );
  });

  test("element with variable literal: element('::placeholder').bc('red').$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.element("::placeholder").bc("red").$;
    `).toHaveTrussOutput(
      `
      const s = { borderColor: "placeholder_bc_red" };
    `,
      `
      .placeholder_bc_red::placeholder {
        border-color: red;
      }
    `,
    );
  });

  test("element + onHover: Css.element('::placeholder').onHover.blue.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.element("::placeholder").onHover.blue.$;
    `).toHaveTrussOutput(
      `
      const s = { color: "placeholder_h_blue" };
    `,
      `
      .placeholder_h_blue:hover::placeholder {
        color: #526675;
      }
    `,
    );
  });

  test("element with non-literal argument errors", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const pe = "::placeholder";
      const s = Css.element(pe).blue.$;
    `).toHaveTrussOutput(
      `
      console.error("[truss] Unsupported pattern: element() requires exactly one string literal argument (e.g. \\\"::placeholder\\\") (test.tsx:3)");
      const pe = "::placeholder";
      const s = { color: "blue" };
    `,
      `
      .blue {
        color: #526675;
      }
    `,
    );
  });

  test("unsupported patterns emit console.error and produce empty object", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.notReal.$;
    `).toHaveTrussOutput(
      `
      console.error("[truss] Unsupported pattern: Unknown abbreviation \\\"notReal\\\" (test.tsx:2)");
      const s = {};
    `,
      ``,
    );
  });

  // ── add() tests ─────────────────────────────────────────────────────

  test("add with string literal value: Css.add('boxShadow', '0 0 0 1px blue').$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.add("boxShadow", "0 0 0 1px blue").$;
    `).toHaveTrussOutput(
      `
      const s = { boxShadow: "boxShadow_0_0_0_1px_blue" };
    `,
      `
      .boxShadow_0_0_0_1px_blue {
        box-shadow: 0 0 0 1px blue;
      }
    `,
    );
  });

  test("add with numeric literal value: Css.add('animationDelay', '300ms').$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.add("animationDelay", "300ms").$;
    `).toHaveTrussOutput(
      `
      const s = { animationDelay: "animationDelay_300ms" };
    `,
      `
      .animationDelay_300ms {
        animation-delay: 300ms;
      }
    `,
    );
  });

  test("add with variable value: Css.add('boxShadow', shadow).$", () => {
    expectTrussTransform(
      `
      import { Css } from "./Css";
      const shadow = getShadow();
      const s = Css.add("boxShadow", shadow).$;
    `,
    ).toHaveTrussOutput(
      `
      const shadow = getShadow();
      const s = { boxShadow: ["boxShadow_var", { "--boxShadow": shadow }] };
    `,
      `
      .boxShadow_var {
        box-shadow: var(--boxShadow);
      }
      @property --boxShadow {
        syntax: "*";
        inherits: false;
      }
    `,
    );
  });

  test("add mixed with other chain segments: Css.df.add('wordBreak', 'break-word').black.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.df.add("wordBreak", "break-word").black.$;
    `).toHaveTrussOutput(
      `
      const s = { display: "df", wordBreak: "wordBreak_break_word", color: "black" };
    `,
      `
      .black {
        color: #353535;
      }
      .df {
        display: flex;
      }
      .wordBreak_break_word {
        word-break: break-word;
      }
    `,
    );
  });

  test("add uses property name in jsx output and generated css", () => {
    const code = `
      import { Css } from "./Css";
      const el = <div css={Css.mt2.add("transition", "all 240ms").$} />;
    `;

    expectTrussTransform(code).toHaveTrussOutput(
      `
      const el = <div className="mt2 transition_all_240ms" />;
    `,
      `
      .transition_all_240ms {
        transition: all 240ms;
      }
      .mt2 {
        margin-top: 16px;
      }
    `,
    );
  });

  test("later color spreads override earlier color spreads", () => {
    const code = `
      import { Css, Palette } from "./Css";
      const el = <div css={{
        ...Css.white.$,
        ...Css.color(Palette.Blue).$,
         ...Css.add("color", Palette.Black).$ }
        }
      />;
    `;

    expectTrussTransform(code).toHaveTrussOutput(
      `
      import { Palette } from "./Css";
      import { trussProps } from "@homebound/truss/runtime";
      const el = <div {...trussProps({ ...{ color: "white" }, ...{ color: ["color_var", { "--color": Palette.Blue }] }, ...{ color: ["color_var", { "--color": Palette.Black }] } })} />;
    `,
      `
      .white {
        color: #fcfcfa;
      }
      .color_var {
        color: var(--color);
      }
      @property --color {
        syntax: "*";
        inherits: false;
      }
    `,
    );
  });

  test("add with pseudo: Css.onHover.add('textDecoration', 'underline').$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.onHover.add("textDecoration", "underline").$;
    `).toHaveTrussOutput(
      `
      const s = { textDecoration: "h_textDecoration_underline" };
    `,
      `
      .h_textDecoration_underline:hover {
        text-decoration: underline;
      }
    `,
    );
  });

  test("add with CssProp argument composes inline as spread", () => {
    expectTrussTransform(
      `
      import { Css } from "./Css";
      const base = getBase();
      const sizeStyles = getSize();
      const s = Css.df.add(base).add(sizeStyles).black.$;
    `,
    ).toHaveTrussOutput(
      `
      const base = getBase();
      const sizeStyles = getSize();
      const s = { display: "df", ...base, ...sizeStyles, color: "black" };
    `,
      `
      .black {
        color: #353535;
      }
      .df {
        display: flex;
      }
    `,
    );
  });

  test("addCss with CssProp argument composes inline as spread", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const height = getHeight();
      const s = Css.df.bgBlue.addCss(height).black.$;
    `).toHaveTrussOutput(
      `
      const height = getHeight();
      const s = { display: "df", backgroundColor: "bgBlue", ...height, color: "black" };
    `,
      `
      .bgBlue {
        background-color: #526675;
      }
      .black {
        color: #353535;
      }
      .df {
        display: flex;
      }
    `,
    );
  });

  test("addCss supports destructured fallback expressions", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      function Panel(props) {
        const { height } = props.xss;
        return <div css={Css.h(1).df.bgBlue.addCss({ height }).black.$} />;
      }
    `).toHaveTrussOutput(
      `
      import { trussProps } from "@homebound/truss/runtime";
      function Panel(props) {
        const { height } = props.xss;
        return <div {...trussProps({ height: "h_8px", display: "df", backgroundColor: "bgBlue", ...(height === undefined ? {} : { height: height }), color: "black" })} />;
      }
    `,
      `
      .bgBlue {
        background-color: #526675;
      }
      .black {
        color: #353535;
      }
      .df {
        display: flex;
      }
      .h_8px {
        height: 8px;
      }
    `,
    );
  });

  test("addCss object literals pass through Truss style values", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
       const s = Css.h(1).addCss({ height }).$;
    `).toHaveTrussOutput(
      `
      const s = { height: "h_8px", ...(height === undefined ? {} : { height: height }) };
    `,
      `
      .h_8px {
        height: 8px;
      }
    `,
    );
  });

  test("addCss rejects wrong arity", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.addCss("height", "8px").$;
    `).toHaveTrussOutput(
      `
      console.error("[truss] Unsupported pattern: addCss() requires exactly 1 argument (an existing CssProp/style hash expression) (test.tsx:2)");
      const s = {};
    `,
      ``,
    );
  });

  test("add with object literal emits console.error", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.add({ wordBreak: "break-word" }).$;
    `).toHaveTrussOutput(
      `
      console.error("[truss] Unsupported pattern: add(cssProp) does not accept object literals -- pass an existing CssProp expression instead (test.tsx:2)");
      const s = {};
    `,
      ``,
    );
  });

  test("error preserves valid segments: Css.black.add(foo, 'value').df.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const foo = getProp();
      const s = Css.black.add(foo, "value").df.$;
    `).toHaveTrussOutput(
      `
      console.error("[truss] Unsupported pattern: add() first argument must be a string literal property name (test.tsx:3)");
      const foo = getProp();
      const s = { color: "black", display: "df" };
    `,
      `
      .black {
        color: #353535;
      }
      .df {
        display: flex;
      }
    `,
    );
  });

  test("add with non-string-literal property name emits console.error", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const prop = "boxShadow";
      const s = Css.add(prop, "value").$;
    `).toHaveTrussOutput(
      `
      console.error("[truss] Unsupported pattern: add() first argument must be a string literal property name (test.tsx:3)");
      const prop = "boxShadow";
      const s = {};
    `,
      ``,
    );
  });
});

test("indirect style references via useMemo and function calls", () => {
  expectTrussTransform(`
      import { useMemo } from "react";
      import { Css } from "./Css";

      function SpreadLikeButton(props) {
        const styles = useMemo(() => {
          return getSpreadLikeStyles();
        }, []);

        const attrs = {
          "data-testid": "button",
          css: {
            ...styles.baseStyles,
            ...(props.active && styles.activeStyles),
          },
        };

        return <button {...attrs}>Click me</button>;
      }

      function getSpreadLikeStyles() {
        const borderBottomStyles = Css.bb.$;

        return {
          baseStyles: Css.df.aic.$,
          activeStyles: { ...Css.blue.$, ...borderBottomStyles },
        };
      }
    `).toHaveTrussOutput(
    `
      import { useMemo } from "react";
      function SpreadLikeButton(props) {
        const styles = useMemo(() => {
          return getSpreadLikeStyles();
        }, []);
        const attrs = {
          "data-testid": "button",
          css: { ...styles.baseStyles, ...(props.active && styles.activeStyles) }
        };
        return <button {...attrs}>Click me</button>;
      }
      function getSpreadLikeStyles() {
        const borderBottomStyles = { borderBottomStyle: "bbs_solid", borderBottomWidth: "bbw_1px" };
        return {
          baseStyles: { display: "df", alignItems: "aic" },
          activeStyles: { ...{ color: "blue" }, ...borderBottomStyles }
        };
      }
    `,
    `
      .aic {
        align-items: center;
      }
      .blue {
        color: #526675;
      }
      .df {
        display: flex;
      }
      .bbs_solid {
        border-bottom-style: solid;
      }
      .bbw_1px {
        border-bottom-width: 1px;
      }
    `,
  );
});

test("ternary mixing {} and style object normalizes {} to {}", () => {
  expectTrussTransform(`
      import { Css } from "./Css";

      function TabsContent(props) {
        const styles = props.hideTabs ? {} : Css.pt3.$;
        return <div css={{ ...styles, ...props.contentXss }} />;
      }
    `).toHaveTrussOutput(
    `
      import { trussProps } from "@homebound/truss/runtime";
      function TabsContent(props) {
        const styles = props.hideTabs ? {} : { paddingTop: "pt3" };
        return <div {...trussProps({ ...styles, ...props.contentXss })} />;
      }
    `,
    `
      .pt3 {
        padding-top: 24px;
      }
    `,
  );
});

/** Expect helper around transform code and css outputs. */
function expectTrussTransform(code: string, options?: { debug?: boolean }) {
  const result = transformTruss(snippet(code), "test.tsx", mapping, options);
  return expect({
    code: result?.code ? normalize(result.code) : null,
    css: normalize(result?.css ?? ""),
  });
}

/** Dedent code snippets so line numbers stay stable. */
function snippet(code: string): string {
  const lines = code.trim().split("\n");
  const indentation = lines.reduce((min, line) => {
    if (line.trim() === "") {
      return min;
    }
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    return Math.min(min, indent);
  }, Number.POSITIVE_INFINITY);
  if (!Number.isFinite(indentation) || indentation === 0) return lines.join("\n");
  return lines.map((line) => line.slice(indentation)).join("\n");
}

function lineOf(source: string, search: string): number {
  return source.split("\n").findIndex((line) => line.includes(search)) + 1;
}
