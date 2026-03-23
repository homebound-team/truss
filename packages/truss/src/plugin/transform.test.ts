import { describe, test, expect } from "vitest";
import { transformTruss } from "./transform";
import { loadMapping } from "./index";
import { resolve } from "path";
import { normalize } from "../testUtils";

const mapping = loadMapping(resolve(__dirname, "../../../app-stylex/src/Css.json"));

describe("transform", () => {
  test("returns null for files without Css import", () => {
    expectTransform(`
      const x = 1;
    `).toBeNull();
  });

  test("returns null for files that import Css but don't use .$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const x = Css.df;
    `).toBeNull();
  });

  test("static chain: Css.df.$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.df.$;
    `).toBeNormalized(`
      const s = { display: "df" };
    `);
  });

  test("keeps runtime import rewrites on the former Css import line", () => {
    const output = transformTruss(
      `
      import { keepMe } from "./other";
      import { Css } from "./Css";

      const el = <div css={Css.black.$} />;
      const value = keepMe();
    `,
      "test.tsx",
      mapping,
    )?.code;

    expect(lineOf(output!, 'import { trussProps } from "@homebound/truss/runtime";')).toBe(2);
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
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.df.aic.$;
    `).toBeNormalized(`
      const s = { display: "df", alignItems: "aic" };
    `);
  });

  test("css prop on JSX: css={Css.df.$}", () => {
    expectTransform(`
      import { Css } from "./Css";
      const el = <div css={Css.df.$} />;
    `).toBeNormalized(`
      import { trussProps } from "@homebound/truss/runtime";
      const el = <div {...trussProps({ display: "df" })} />;
    `);
  });

  test("css prop with multi-getter: css={Css.df.aic.black.$}", () => {
    expectTransform(`
      import { Css } from "./Css";
      const el = <div css={Css.df.aic.black.$} />;
    `).toBeNormalized(`
      import { trussProps } from "@homebound/truss/runtime";
      const el = <div {...trussProps({ display: "df", alignItems: "aic", color: "black" })} />;
    `);
  });

  test("debug mode rewrites jsx css props through trussProps", () => {
    expectTransform(
      `
      import { Css } from "./Css";
      const el = <div css={Css.df.aic.$} />;
    `,
      { debug: true },
    ).toBeNormalized(`
      import { trussProps, TrussDebugInfo } from "@homebound/truss/runtime";
      const el = <div {...trussProps({ display: ["df", new TrussDebugInfo("test.tsx:2")], alignItems: "aic" })} />;
    `);
  });

  test("debug mode keeps debug info in non-jsx style objects", () => {
    expectTransform(
      `
      import { Css } from "./Css";
      const s = Css.df.$;
    `,
      { debug: true },
    ).toBeNormalized(`
      import { TrussDebugInfo } from "@homebound/truss/runtime";
      const s = { display: ["df", new TrussDebugInfo("test.tsx:2")] };
    `);
  });

  test("debug mode keeps mergeProps for className composition", () => {
    expectTransform(
      `
      import { Css } from "./Css";
      const el = <div className="existing" css={Css.df.$} />;
    `,
      {
        debug: true,
      },
    ).toBeNormalized(`
      import { mergeProps, TrussDebugInfo } from "@homebound/truss/runtime";
      const el = <div {...mergeProps("existing", undefined, { display: ["df", new TrussDebugInfo("test.tsx:2")] })} />;
    `);
  });

  test("variable with literal arg: Css.mt(2).$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.mt(2).$;
    `).toBeNormalized(`
      const s = { marginTop: "mt_16px" };
    `);
  });

  test("variable with string literal: Css.mt('10px').$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.mt("10px").$;
    `).toBeNormalized(`
      const s = { marginTop: "mt_10px" };
    `);
  });

  test("variable with variable arg: Css.mt(x).$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const x = getSomeValue();
      const s = Css.mt(x).$;
    `).toBeNormalized(`
      const __maybeInc = inc => { return typeof inc === "string" ? inc : \`\${inc * 8}px\`; };
            const x = getSomeValue();
            const s = { marginTop: ["mt_var", { "--marginTop": __maybeInc(x) }] };
    `);
  });

  test("delegate with literal: Css.mtPx(12).$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.mtPx(12).$;
    `).toBeNormalized(`
      const s = { marginTop: "mt_12px" };
    `);
  });

  test("delegate with variable arg appends px: Css.mtPx(x).$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const x = getSomeValue();
      const s = Css.mtPx(x).$;
    `).toBeNormalized(`
      const x = getSomeValue();
      const s = { marginTop: ["mt_var", { "--marginTop": \`\${x}px\` }] };
    `);
  });

  test("delegate shorthand with multiple props appends px: Css.pxPx(x).$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const x = getSomeValue();
      const s = Css.pxPx(x).$;
    `).toBeNormalized(`
      const x = getSomeValue();
      const s = { paddingLeft: ["px_var", { "--paddingLeft": \`\${x}px\` }], paddingRight: ["px_var", { "--paddingRight": \`\${x}px\` }] };
    `);
  });

  test("delegate shorthand with multiple props supports sqPx: Css.sqPx(x).$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const x = getSomeValue();
      const s = Css.sqPx(x).$;
    `).toBeNormalized(`
      const x = getSomeValue();
      const s = { height: ["sq_var", { "--height": \`\${x}px\` }], width: ["sq_var", { "--width": \`\${x}px\` }] };
    `);
  });

  test("non-incremented variable: Css.bc('red').$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.bc("red").$;
    `).toBeNormalized(`
      const s = { borderColor: "bc_red" };
    `);
  });

  test("non-incremented variable with variable: Css.bc(color).$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const color = getColor();
      const s = Css.bc(color).$;
    `).toBeNormalized(`
      const color = getColor();
      const s = { borderColor: ["bc_var", { "--borderColor": color }] };
    `);
  });

  test("variable method keeps extra defs: Css.lineClamp(lines).$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const lines = getLineCount();
      const s = Css.lineClamp(lines).$;
    `).toBeNormalized(`
      const lines = getLineCount();
      const s = {
        WebkitLineClamp: ["lineClamp_var", { "--WebkitLineClamp": lines }],
        overflow: "lineClamp_overflow",
        display: "lineClamp_display",
        WebkitBoxOrient: "lineClamp_WebkitBoxOrient",
        textOverflow: "lineClamp_textOverflow"
      };
    `);
  });

  test("variable literal keeps extra defs: Css.lineClamp('3').$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.lineClamp("3").$;
    `).toBeNormalized(`
      const s = {
        WebkitLineClamp: "lineClamp_3_WebkitLineClamp",
        overflow: "oh",
        display: "lineClamp_3_display",
        WebkitBoxOrient: "lineClamp_3_WebkitBoxOrient",
        textOverflow: "lineClamp_3_textOverflow"
      };
    `);
  });

  test("multiple expressions dedup entries", () => {
    expectTransform(
      `
      import { Css } from "./Css";
      const a = <div css={Css.df.$} />;
      const b = <div css={Css.df.aic.$} />;
    `,
    ).toBeNormalized(`
      import { trussProps } from "@homebound/truss/runtime";
      const a = <div {...trussProps({ display: "df" })} />;
      const b = <div {...trussProps({ display: "df", alignItems: "aic" })} />;
    `);
  });

  test("alias expansion: Css.bodyText.$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.bodyText.$;
    `).toBeNormalized(`
      const s = { fontSize: "f14", color: "black" };
    `);
  });

  test("typography literal: Css.typography('f14').$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.typography("f14").$;
    `).toBeNormalized(`
      const s = { fontSize: "f14" };
    `);
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
        f10: { fontSize: "f10_fontSize", fontWeight: "fw5" }
      };
      const key: Typography = pickType();
      const s = { ...(__typography[key] ?? {}) };
    `,
      `
        .f10_fontSize {
          font-size: 10px;
        }
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
      `,
    );
  });

  test("typography runtime keys across breakpoint contexts", () => {
    expectTransform(
      `
      import { Css, type Typography } from "./Css";
      const key: Typography = pickType();
      const otherKey: Typography = pickOtherType();
      const s = Css.typography(key).ifSm.typography(otherKey).$;
    `,
    ).toBeNormalized(`
      import { type Typography } from "./Css";
      const __typography = {
        f24: { fontSize: "f24" },
        f18: { fontSize: "f18" },
        f16: { fontSize: "f16" },
        f14: { fontSize: "f14" },
        f12: { fontSize: "f12" },
        f10: { fontSize: "f10_fontSize", fontWeight: "fw5" }
      };
      const __typography__sm = {
        f24: { fontSize: "sm_f24" },
        f18: { fontSize: "sm_f18" },
        f16: { fontSize: "sm_f16" },
        f14: { fontSize: "sm_f14" },
        f12: { fontSize: "sm_f12" },
        f10: { fontSize: "sm_f10_fontSize", fontWeight: "sm_fw5" }
      };
      const key: Typography = pickType();
      const otherKey: Typography = pickOtherType();
      const s = { ...(__typography[key] ?? {}), ...(__typography__sm[otherKey] ?? {}) };
    `);
  });

  test("Css import is removed when only Css is imported", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.df.$;
    `).toBeNormalized(`
      const s = { display: "df" };
    `);
  });

  test("Css specifier removed but Palette kept", () => {
    expectTransform(`
      import { Css, Palette } from "./Css";
      const s = Css.df.$;
      const c = Palette.Black;
    `).toBeNormalized(`
      import { Palette } from "./Css";
      const s = { display: "df" };
      const c = Palette.Black;
    `);
  });

  test("multi-property static: Css.ba.$ (border)", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.ba.$;
    `).toBeNormalized(`
      const s = { borderStyle: "bss", borderWidth: "bw1" };
    `);
  });

  test("mixed static and variable: Css.df.mt(2).black.$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.df.mt(2).black.$;
    `).toBeNormalized(`
      const s = { display: "df", marginTop: "mt_16px", color: "black" };
    `);
  });

  test("onHover pseudo: Css.black.onHover.blue.$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.black.onHover.blue.$;
    `).toBeNormalized(`
      const s = { color: "black h_blue" };
    `);
  });

  test("onHover with multi-property: Css.onHover.ba.$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.onHover.ba.$;
    `).toBeNormalized(`
      const s = { borderStyle: "h_bss", borderWidth: "h_bw1" };
    `);
  });

  test("onFocus pseudo: Css.onFocus.blue.$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.onFocus.blue.$;
    `).toBeNormalized(`
      const s = { color: "f_blue" };
    `);
  });

  test("onFocusWithin pseudo: Css.onFocusWithin.blue.$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.onFocusWithin.blue.$;
    `).toBeNormalized(`
      const s = { color: "fw_blue" };
    `);
  });

  test("onHover with variable literal: Css.onHover.bc('red').$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.onHover.bc("red").$;
    `).toBeNormalized(`
      const s = { borderColor: "h_bc_red" };
    `);
  });

  test("onHover with variable variable: Css.onHover.bc(color).$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const color = getColor();
      const s = Css.onHover.bc(color).$;
    `).toBeNormalized(`
      const color = getColor();
      const s = { borderColor: ["h_bc_var", { "--h_borderColor": color }] };
    `);
  });

  test("container query pseudo: Css.ifContainer({ gt, lt }).gc('span 2').$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.ifContainer({ gt: 600, lt: 960 }).gc("span 2").$;
    `).toBeNormalized(`
      const s = { gridColumn: "mq_gc_span_2" };
    `);
  });

  test("container query merges overlapping property", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.black.ifContainer({ gt: 600, lt: 960 }).blue.$;
    `).toBeNormalized(`
      const s = { color: "black mq_blue" };
    `);
  });

  test("container query with named container", () => {
    expectTransform(
      `
      import { Css } from "./Css";
      const s = Css.ifContainer({ name: "grid", gt: 600, lt: 960 }).blue.$;
    `,
    ).toBeNormalized(`
      const s = { color: "mq_blue" };
    `);
  });

  test("container query requires literal bounds: emits console.error and preserves valid segments", () => {
    expectTransform(
      `
      import { Css } from "./Css";
      const minWidth = getMinWidth();
      const maxWidth = getMaxWidth();
      const s = Css.ifContainer({ gt: minWidth, lt: maxWidth }).blue.$;
    `,
    ).toBeNormalized(`
      console.error("[truss] Unsupported pattern: ifContainer().gt must be a numeric literal (test.tsx:4)");
      const minWidth = getMinWidth();
      const maxWidth = getMaxWidth();
      const s = { color: "blue" };
    `);
  });

  test("object spread composition uses native object spread", () => {
    expectTransform(
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
    ).toBeNormalized(`
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
    `);
  });

  test("native object composition stays as-is", () => {
    expectTransform(`
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
    `).toBeNormalized(`
      import { trussProps } from "@homebound/truss/runtime";
      function Button(props) {
        const { active, isHovered } = props;
        const baseStyles = { ...{ display: "df", alignItems: "aic" } };
        const activeStyles = { ...{ color: "black" } };
        const hoverStyles = { ...{ color: "blue" } };
        return <div {...trussProps({ ...baseStyles, ...(active && activeStyles), ...(isHovered && hoverStyles) })} />;
      }
    `);
  });

  test("Css.props is rewritten to trussProps spread", () => {
    expectTransform(`
      import { Css } from "./Css";

      function Button() {
        const attrs = {
          "data-testid": "button",
          ...Css.props(Css.blue.$),
        };
        return <button {...attrs}>Click me</button>;
      }
    `).toBeNormalized(`
      import { trussProps } from "@homebound/truss/runtime";
      function Button() {
        const attrs = {
          "data-testid": "button",
          ...trussProps({ color: "blue" })
        };
        return <button {...attrs}>Click me</button>;
      }
    `);
  });

  test("Css.props in debug mode is rewritten to trussProps", () => {
    expectTransform(
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
    ).toBeNormalized(`
      import { trussProps, TrussDebugInfo } from "@homebound/truss/runtime";
      function Button() {
        const attrs = {
          ...trussProps({ display: ["df", new TrussDebugInfo("test.tsx:5")], alignItems: "aic" })
        };
        return <button {...attrs}>Click me</button>;
      }
    `);
  });

  test("Css.props with object literal passes through to trussProps", () => {
    expectTransform(`
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
    `).toBeNormalized(`
      import { trussProps } from "@homebound/truss/runtime";
      function Button({ active, styles }) {
        const attrs = {
          "data-testid": "button",
          ...trussProps({ ...styles.baseStyles, ...(active && styles.activeStyles) })
        };
        return <button {...attrs}>Click me</button>;
      }
    `);
  });

  test("Css.props with sibling className merges via mergeProps", () => {
    expectTransform(`
      import { Css } from "./Css";

      function Button({ asLink, navLink }) {
        const attrs = {
          className: asLink ? navLink : undefined,
          ...Css.props(Css.df.aic.$),
        };
        return <button {...attrs}>Click me</button>;
      }
    `).toBeNormalized(`
      import { trussProps, mergeProps } from "@homebound/truss/runtime";
      function Button({ asLink, navLink }) {
        const attrs = {
          ...mergeProps(asLink ? navLink : undefined, undefined, { display: "df", alignItems: "aic" })
        };
        return <button {...attrs}>Click me</button>;
      }
    `);
  });

  test("Css.props with sibling className and object literal styles", () => {
    expectTransform(`
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
    `).toBeNormalized(`
      import { trussProps, mergeProps } from "@homebound/truss/runtime";
      function Button({ asLink, navLink, baseStyles, active, hoverStyles }) {
        const attrs = {
          ...mergeProps(asLink ? navLink : undefined, undefined, { ...{ display: "df" }, ...baseStyles, ...(active && hoverStyles) })
        };
        return <button {...attrs}>Click me</button>;
      }
    `);
  });

  test("style object variable in css prop is lowered to trussProps", () => {
    expectTransform(`
      import { Css } from "./Css";
      const base = Css.df.aic.$;
      const el = <div css={base} />;
    `).toBeNormalized(`
      import { trussProps } from "@homebound/truss/runtime";
      const base = { display: "df", alignItems: "aic" };
      const el = <div {...trussProps(base)} />;
    `);
  });

  test("mixed css prop spread and Css chain spread are lowered together", () => {
    expectTransform(
      `
      import { Css } from "./Css";
      function Box({ cssProp }) { return <div css={{ ...cssProp, ...Css.df.$ }} />;
      }
    `,
    ).toBeNormalized(`
      import { trussProps } from "@homebound/truss/runtime";
      function Box({ cssProp }) { return <div {...trussProps({ ...cssProp, ...{ display: "df" } })} />; }
    `);
  });

  test("external call expression in css prop is wrapped in trussProps", () => {
    expectTransform(`
      import { getFromAnotherFile } from "./other";
      import { Css } from "./Css";

      function Example({ param, content }) {
        return <div css={getFromAnotherFile(param)}><span css={Css.blue.$}>{content}</span></div>;
      }
    `).toBeNormalized(`
      import { getFromAnotherFile } from "./other";
      import { trussProps } from "@homebound/truss/runtime";
      function Example({ param, content }) {
        return <div {...trussProps(getFromAnotherFile(param))}><span {...trussProps({ color: "blue" })}>{content}</span></div>;
      }
    `);
  });

  test("css prop with non-spread property is still wrapped in trussProps", () => {
    expectTransform(`
      import { Css } from "./Css";

      const base = Css.df.$;
      const cssProp = getCssProp();
      const el = <div css={{ ...cssProp, foo: true }} />;
    `).toBeNormalized(`
      import { trussProps } from "@homebound/truss/runtime";
      const base = { display: "df" };
      const cssProp = getCssProp();
      const el = <div {...trussProps({ ...cssProp, foo: true })} />;
    `);
  });

  test("conditional css prop with undefined branch is still wrapped", () => {
    expectTransform(`
      import { Css } from "./Css";

      function Repro(props: { enabled: boolean }) {
        return <div css={props.enabled ? Css.pb2.$ : undefined}>hello</div>;
      }
    `).toBeNormalized(`
      import { trussProps } from "@homebound/truss/runtime";
      function Repro(props: { enabled: boolean; }) {
        return <div {...trussProps(props.enabled ? { paddingBottom: "pb2" } : undefined)}>hello</div>;
      }
    `);
  });

  test("ordinary object spreads stay objects", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = { foo: true, ...other };
      const t = Css.df.$;
    `).toBeNormalized(`
      const s = { foo: true, ...other };
      const t = { display: "df" };
    `);
  });

  test("style composition objects stay as native object spread", () => {
    expectTransform(
      `
      import { Css } from "./Css";
      const borderBottomStyles = Css.bb.$;
      const styles = { activeStyles: { ...Css.black.$, foo: true, ...borderBottomStyles } };
    `,
    ).toBeNormalized(`
      const borderBottomStyles = { borderBottomStyle: "bb_borderBottomStyle", borderBottomWidth: "bb_borderBottomWidth" };
      const styles = { activeStyles: { ...{ color: "black" }, foo: true, ...borderBottomStyles } };
    `);
  });

  test("style composition objects can mix Css spreads with external spreads", () => {
    expectTransform(
      `
      import { Css } from "./Css";
      const borderBottomStyles = maybeStyles();
      const styles = { activeStyles: { ...Css.black.$, ...borderBottomStyles } };
    `,
    ).toBeNormalized(`
      const borderBottomStyles = maybeStyles();
      const styles = { activeStyles: { ...{ color: "black" }, ...borderBottomStyles } };
    `);
  });

  test("style composition objects support active and hover style maps with shared border styles", () => {
    expectTransform(`
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
    `).toBeNormalized(`
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
    `);
  });

  test("conditional: Css.if(cond).df.else.db.$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.if(isActive).df.else.db.$;
    `).toBeNormalized(`
      const s = { ...(isActive ? { display: "df" } : { display: "db" }) };
    `);
  });

  test("conditional with preceding styles: Css.p1.if(cond).df.else.db.$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.p1.if(isActive).df.else.db.$;
    `).toBeNormalized(`
      const s = {
        paddingTop: "pt1",
        paddingBottom: "pb1",
        paddingRight: "pr1",
        paddingLeft: "pl1",
        ...(isActive ? { display: "df" } : { display: "db" })
      };
    `);
  });

  test("else branch includes trailing styles: Css.if(cond).df.else.db.mt1.$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.if(isActive).df.else.db.mt1.$;
    `).toBeNormalized(`
      const s = { ...(isActive ? { display: "df" } : { display: "db", marginTop: "mt1" }) };
    `);
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
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.bgBlue.if(selected).bgWhite.$;
    `).toBeNormalized(`
      const s = { backgroundColor: "bgBlue", ...(selected ? { backgroundColor: "bgWhite" } : {}) };
    `);
  });

  test("conditional replacement preserves preceding non-overlapping properties", () => {
    // Css.df.aic.bgBlue.if(selected).bgWhite.$ — df and aic should survive the conditional
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.df.aic.bgBlue.if(selected).bgWhite.$;
    `).toBeNormalized(
      `
      const s = { display: "df", alignItems: "aic", backgroundColor: "bgBlue", ...(selected ? { backgroundColor: "bgWhite" } : {}) };
    `,
    );
  });

  test("conditional replacement with many preceding properties and delegates preserves all base classes", () => {
    expectTransform(
      `
      import { Css } from "./Css";
      const el = <div css={Css.absolute.bottomPx(4).wPx(4).hPx(4).bgBlue.br4.if(selected && !range_middle).bgWhite.$} />;
    `,
    ).toBeNormalized(`
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
    `);
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
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.ba.add("borderWidth", "3px").$;
    `).toBeNormalized(`
      const s = { borderStyle: "bss", borderWidth: "borderWidth_3px" };
    `);
  });

  test("negative increment: Css.mt(-1).$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.mt(-1).$;
    `).toBeNormalized(`
      const s = { marginTop: "mt_neg8px" };
    `);
  });

  test("increment zero: Css.mt(0).$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.mt(0).$;
    `).toBeNormalized(`
      const s = { marginTop: "mt_0px" };
    `);
  });

  test("static increment getters: Css.mt0.mt1.p1.$ — later mt1 replaces mt0", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.mt0.mt1.p1.$;
    `).toBeNormalized(`
      const s = {
        marginTop: "mt1",
        paddingTop: "pt1",
        paddingBottom: "pb1",
        paddingRight: "pr1",
        paddingLeft: "pl1"
      };
    `);
  });

  test("className merging: css + className on same element", () => {
    expectTransform(`
      import { Css } from "./Css";
      const el = <div className="existing" css={Css.df.$} />;
    `).toBeNormalized(`
      import { mergeProps } from "@homebound/truss/runtime";
      const el = <div {...mergeProps("existing", undefined, { display: "df" })} />;
    `);
  });

  test("className merging: css + variable className expression", () => {
    expectTransform(
      `
      import { Css } from "./Css";
      const cls = getClass();
      const el = <div className={cls} css={Css.df.$} />;
    `,
    ).toBeNormalized(`
      import { mergeProps } from "@homebound/truss/runtime";
      const cls = getClass();
      const el = <div {...mergeProps(cls, undefined, { display: "df" })} />;
    `);
  });

  test("style merging: css + style on same element", () => {
    expectTransform(
      `
      import { Css } from "./Css";
      const el = <div style={{ minWidth: "fit-content" }} css={Css.blue.$} />;
    `,
    ).toBeNormalized(`
      import { mergeProps } from "@homebound/truss/runtime";
      const el = <div {...mergeProps(undefined, { minWidth: "fit-content" }, { color: "blue" })} />;
    `);
  });

  test("falls back for __maybeInc helper name collisions", () => {
    expectTransform(
      `
      import { Css } from "./Css";
      const __maybeInc = keepMe();
      const x = getSomeValue();
      const s = Css.mt(x).$;
    `,
    ).toBeNormalized(`
      const __maybeInc_1 = inc => { return typeof inc === "string" ? inc : \`\${inc * 8}px\`; };
            const __maybeInc = keepMe();
            const x = getSomeValue();
            const s = { marginTop: ["mt_var", { "--marginTop": __maybeInc_1(x) }] };
    `);
  });

  test("onHover on same property merges base+pseudo into single entry", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.bgBlue.onHover.bgBlack.$;
    `).toBeNormalized(`
      const s = { backgroundColor: "bgBlue h_bgBlack" };
    `);
  });

  test("onHover merge: non-overlapping properties kept separate", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.df.onHover.blue.$;
    `).toBeNormalized(`
      const s = { display: "df", color: "h_blue" };
    `);
  });

  // ── Marker tests ────────────────────────────────────────────────────

  test("Css.marker.$ emits a default marker class", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.marker.$;
    `).toBeNormalized(`
      const s = { __marker: "__truss_m" };
    `);
  });

  test("Css.marker.$ in JSX css prop emits trussProps with marker metadata", () => {
    expectTransform(`
      import { Css } from "./Css";
      const el = <div css={Css.marker.$} />;
    `).toBeNormalized(`
      import { trussProps } from "@homebound/truss/runtime";
      const el = <div {...trussProps({ __marker: "__truss_m" })} />;
    `);
  });

  test("Css.marker.df.$ combines marker with styles", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.marker.df.$;
    `).toBeNormalized(`
      const s = { __marker: "__truss_m", display: "df" };
    `);
  });

  test("Css.markerOf(row).$ passes marker variable through", () => {
    expectTransform(`
      import { Css } from "./Css";
      const row = Css.newMarker();
      const s = Css.markerOf(row).$;
    `).toBeNormalized(`
      const row = Css.newMarker();
      const s = { __marker: "__truss_m_row" };
    `);
  });

  test("marker and when('ancestor') in same file use same user-defined marker variable", () => {
    expectTrussTransform(
      `
      import { Css } from "./Css";
      const row = Css.newMarker();
      const a = Css.markerOf(row).$;
      const b = Css.when("ancestor", row, ":hover").blue.$;
      `,
    ).toHaveTrussOutput(
      `
      const row = Css.newMarker();
      const a = { __marker: "__truss_m_row" };
      const b = { color: "wh_anc_h_row_blue" };
      `,
      `
        .__truss_m_row:hover .wh_anc_h_row_blue {
          color: #526675;
        }
      `,
    );
  });

  // ── when() generic API tests ──────────────────────────────────────

  test("Css.when('ancestor', ':hover').blue.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.when("ancestor", ":hover").blue.$;
    `).toHaveTrussOutput(
      `
      const s = { color: "wh_anc_h_blue" };
    `,
      `
        .__truss_m:hover .wh_anc_h_blue {
          color: #526675;
        }
      `,
    );
  });

  test("Css.when('ancestor', marker, ':hover').blue.$", () => {
    expectTransform(
      `
      import { Css } from "./Css";
      const marker = Css.newMarker();
      const s = Css.when("ancestor", marker, ":hover").blue.$;
    `,
    ).toBeNormalized(`
      const marker = Css.newMarker();
      const s = { color: "wh_anc_h_marker_blue" };
    `);
  });

  test("Css.when('descendant', ':focus').blue.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.when("descendant", ":focus").blue.$;
    `).toHaveTrussOutput(
      `
      const s = { color: "wh_desc_f_blue" };
    `,
      `
        .wh_desc_f_blue:has(.__truss_m:focus) {
          color: #526675;
        }
      `,
    );
  });

  test("Css.when('siblingAfter', ':hover').blue.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.when("siblingAfter", ":hover").blue.$;
    `).toHaveTrussOutput(
      `
      const s = { color: "wh_sibA_h_blue" };
    `,
      `
        .wh_sibA_h_blue:has(~ .__truss_m:hover) {
          color: #526675;
        }
      `,
    );
  });

  test("Css.when('siblingBefore', ':hover').blue.$", () => {
    expectTrussTransform(`
      import { Css } from "./Css";
      const s = Css.when("siblingBefore", ":hover").blue.$;
    `).toHaveTrussOutput(
      `
      const s = { color: "wh_sibB_h_blue" };
    `,
      `
        .__truss_m:hover ~ .wh_sibB_h_blue {
          color: #526675;
        }
      `,
    );
  });

  test("Css.when('anySibling', marker, ':hover').blue.$", () => {
    expectTransform(
      `
      import { Css } from "./Css";
      const row = Css.newMarker();
      const s = Css.when("anySibling", row, ":hover").blue.$;
    `,
    ).toBeNormalized(`
      const row = Css.newMarker();
      const s = { color: "wh_anyS_h_row_blue" };
    `);
  });

  test("Css.when with invalid relationship emits console.error", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.when("bogus", ":hover").blue.$;
    `).toBeNormalized(`
      console.error("[truss] Unsupported pattern: when() relationship must be one of: ancestor, descendant, anySibling, siblingBefore, siblingAfter -- got \\\"bogus\\\" (test.tsx:2)");
      const s = { color: "blue" };
    `);
  });

  test("Css.when with non-literal relationship emits console.error", () => {
    expectTransform(`
      import { Css } from "./Css";
      const rel = "ancestor";
      const s = Css.when(rel, ":hover").blue.$;
    `).toBeNormalized(`
      console.error("[truss] Unsupported pattern: when() first argument must be a string literal relationship (test.tsx:3)");
      const rel = "ancestor";
      const s = { color: "blue" };
    `);
  });

  test("markerOf accepts a variable argument", () => {
    expectTransform(`
      import { Css } from "./Css";
      const row = getMarker();
      const s = Css.markerOf(row).df.$;
    `).toBeNormalized(`
      const row = getMarker();
      const s = { __marker: "__truss_m_row", display: "df" };
    `);
  });

  // ── Breakpoint / media query tests ──────────────────────────────────

  test("if(mediaQuery) as pseudo: Css.if('@media screen and (max-width: 599px)').df.$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.if("@media screen and (max-width: 599px)").df.$;
    `).toBeNormalized(`
      const s = { display: "sm_df" };
    `);
  });

  test("if(mediaQuery) merges with base: Css.bgBlue.if('@media screen and (max-width: 599px)').bgBlack.$", () => {
    expectTransform(
      `
      import { Css } from "./Css";
      const s = Css.bgBlue.if("@media screen and (max-width: 599px)").bgBlack.$;
    `,
    ).toBeNormalized(`
      const s = { backgroundColor: "bgBlue sm_bgBlack" };
    `);
  });

  test("if(Breakpoints.sm) works like if('@media...')", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.if("@media screen and (min-width: 960px)").df.$;
    `).toBeNormalized(`
      const s = { display: "lg_df" };
    `);
  });

  test("breakpoint + pseudo combination: Css.ifSm.onHover.blue.$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.ifSm.onHover.blue.$;
    `).toBeNormalized(`
      const s = { color: "sm_h_blue" };
    `);
  });

  test("base + breakpoint + pseudo: Css.black.ifSm.onHover.blue.$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.black.ifSm.onHover.blue.$;
    `).toBeNormalized(`
      const s = { color: "black sm_h_blue" };
    `);
  });

  test("base + breakpoint color + breakpoint+pseudo color: Css.black.ifSm.white.onHover.blue.$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.black.ifSm.white.onHover.blue.$;
    `).toBeNormalized(`
      const s = { color: "black sm_white sm_h_blue" };
    `);
  });

  test("breakpoint only: Css.ifSm.df.$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.ifSm.df.$;
    `).toBeNormalized(`
      const s = { display: "sm_df" };
    `);
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
    expectTransform(
      `
      import { Css } from "./Css";
      const s = Css.if("@media screen and (max-width: 599px)").black.else.white.$;
    `,
    ).toBeNormalized(`
      const s = { color: "sm_black mdandup_white" };
    `);
  });

  test("breakpoint after base style: Css.df.ifMd.blue.$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.df.ifMd.blue.$;
    `).toBeNormalized(`
      const s = { display: "df", color: "md_blue" };
    `);
  });

  test("breakpoint merges overlapping property: Css.bgBlue.ifSm.bgBlack.$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.bgBlue.ifSm.bgBlack.$;
    `).toBeNormalized(`
      const s = { backgroundColor: "bgBlue sm_bgBlack" };
    `);
  });

  test("breakpoint with large: Css.ifLg.df.$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.ifLg.df.$;
    `).toBeNormalized(`
      const s = { display: "lg_df" };
    `);
  });

  test("breakpoint with combination: Css.ifSmOrMd.blue.$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.ifSmOrMd.blue.$;
    `).toBeNormalized(`
      const s = { color: "smormd_blue" };
    `);
  });

  test("breakpoint with variable literal: Css.ifSm.mt(2).$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.ifSm.mt(2).$;
    `).toBeNormalized(`
      const s = { marginTop: "sm_mt_16px" };
    `);
  });

  test("breakpoint with multi-property: Css.ifSm.ba.$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.ifSm.ba.$;
    `).toBeNormalized(`
      const s = { borderStyle: "sm_bss", borderWidth: "sm_bw1" };
    `);
  });

  test("breakpoint in JSX: css={Css.ifSm.df.$}", () => {
    expectTransform(`
      import { Css } from "./Css";
      const el = <div css={Css.ifSm.df.$} />;
    `).toBeNormalized(`
      import { trussProps } from "@homebound/truss/runtime";
      const el = <div {...trussProps({ display: "sm_df" })} />;
    `);
  });

  // ── Pseudo-element tests ─────────────────────────────────────────────

  test("element('::placeholder').blue.$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.element("::placeholder").blue.$;
    `).toBeNormalized(`
      const s = { color: "placeholder_blue" };
    `);
  });

  test("element('::selection') with static styles", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.element("::selection").bgBlue.white.$;
    `).toBeNormalized(`
      const s = { backgroundColor: "selection_bgBlue", color: "selection_white" };
    `);
  });

  test("element with variable literal: element('::placeholder').bc('red').$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.element("::placeholder").bc("red").$;
    `).toBeNormalized(`
      const s = { borderColor: "placeholder_bc_red" };
    `);
  });

  test("element + onHover: Css.element('::placeholder').onHover.blue.$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.element("::placeholder").onHover.blue.$;
    `).toBeNormalized(`
      const s = { color: "placeholder_h_blue" };
    `);
  });

  test("element with non-literal argument errors", () => {
    expectTransform(`
      import { Css } from "./Css";
      const pe = "::placeholder";
      const s = Css.element(pe).blue.$;
    `).toBeNormalized(`
      console.error("[truss] Unsupported pattern: element() requires exactly one string literal argument (e.g. \\\"::placeholder\\\") (test.tsx:3)");
      const pe = "::placeholder";
      const s = { color: "blue" };
    `);
  });

  test("unsupported patterns emit console.error and produce empty object", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.notReal.$;
    `).toBeNormalized(`
      console.error("[truss] Unsupported pattern: Unknown abbreviation \\\"notReal\\\" (test.tsx:2)");
      const s = {};
    `);
  });

  // ── add() tests ─────────────────────────────────────────────────────

  test("add with string literal value: Css.add('boxShadow', '0 0 0 1px blue').$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.add("boxShadow", "0 0 0 1px blue").$;
    `).toBeNormalized(`
      const s = { boxShadow: "boxShadow_0_0_0_1px_blue" };
    `);
  });

  test("add with numeric literal value: Css.add('animationDelay', '300ms').$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.add("animationDelay", "300ms").$;
    `).toBeNormalized(`
      const s = { animationDelay: "animationDelay_300ms" };
    `);
  });

  test("add with variable value: Css.add('boxShadow', shadow).$", () => {
    expectTransform(
      `
      import { Css } from "./Css";
      const shadow = getShadow();
      const s = Css.add("boxShadow", shadow).$;
    `,
    ).toBeNormalized(`
      const shadow = getShadow();
      const s = { boxShadow: ["boxShadow_var", { "--boxShadow": shadow }] };
    `);
  });

  test("add mixed with other chain segments: Css.df.add('wordBreak', 'break-word').black.$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.df.add("wordBreak", "break-word").black.$;
    `).toBeNormalized(`
      const s = { display: "df", wordBreak: "wordBreak_break_word", color: "black" };
    `);
  });

  test("add uses property name in jsx output and generated css", () => {
    const code = `
      import { Css } from "./Css";
      const el = <div css={Css.mt2.add("transition", "all 240ms").$} />;
    `;

    expectTrussTransform(code).toHaveTrussOutput(
      `
      import { trussProps } from "@homebound/truss/runtime";
      const el = <div {...trussProps({ marginTop: "mt2", transition: "transition_all_240ms" })} />;
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
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.onHover.add("textDecoration", "underline").$;
    `).toBeNormalized(`
      const s = { textDecoration: "h_textDecoration_underline" };
    `);
  });

  test("add with CssProp argument composes inline as spread", () => {
    expectTransform(
      `
      import { Css } from "./Css";
      const base = getBase();
      const sizeStyles = getSize();
      const s = Css.df.add(base).add(sizeStyles).black.$;
    `,
    ).toBeNormalized(`
      const base = getBase();
      const sizeStyles = getSize();
      const s = { display: "df", ...base, ...sizeStyles, color: "black" };
    `);
  });

  test("addCss with CssProp argument composes inline as spread", () => {
    expectTransform(`
      import { Css } from "./Css";
      const height = getHeight();
      const s = Css.df.bgBlue.addCss(height).black.$;
    `).toBeNormalized(`
      const height = getHeight();
      const s = { display: "df", backgroundColor: "bgBlue", ...height, color: "black" };
    `);
  });

  test("addCss supports destructured fallback expressions", () => {
    expectTransform(`
      import { Css } from "./Css";
      function Panel(props) {
        const { height } = props.xss;
        return <div css={Css.h(1).df.bgBlue.addCss({ height }).black.$} />;
      }
    `).toBeNormalized(`
      import { trussProps } from "@homebound/truss/runtime";
      function Panel(props) {
        const { height } = props.xss;
        return <div {...trussProps({ height: "h_8px", display: "df", backgroundColor: "bgBlue", ...(height === undefined ? {} : { height: height }), color: "black" })} />;
      }
    `);
  });

  test("addCss object literals pass through Truss style values", () => {
    expectTransform(`
      import { Css } from "./Css";
       const s = Css.h(1).addCss({ height }).$;
    `).toBeNormalized(`
      const s = { height: "h_8px", ...(height === undefined ? {} : { height: height }) };
    `);
  });

  test("addCss rejects wrong arity", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.addCss("height", "8px").$;
    `).toBeNormalized(`
      console.error("[truss] Unsupported pattern: addCss() requires exactly 1 argument (an existing CssProp/style hash expression) (test.tsx:2)");
      const s = {};
    `);
  });

  test("add with object literal emits console.error", () => {
    expectTransform(`
      import { Css } from "./Css";
      const s = Css.add({ wordBreak: "break-word" }).$;
    `).toBeNormalized(`
      console.error("[truss] Unsupported pattern: add(cssProp) does not accept object literals -- pass an existing CssProp expression instead (test.tsx:2)");
      const s = {};
    `);
  });

  test("error preserves valid segments: Css.black.add(foo, 'value').df.$", () => {
    expectTransform(`
      import { Css } from "./Css";
      const foo = getProp();
      const s = Css.black.add(foo, "value").df.$;
    `).toBeNormalized(`
      console.error("[truss] Unsupported pattern: add() first argument must be a string literal property name (test.tsx:3)");
      const foo = getProp();
      const s = { color: "black", display: "df" };
    `);
  });

  test("add with non-string-literal property name emits console.error", () => {
    expectTransform(`
      import { Css } from "./Css";
      const prop = "boxShadow";
      const s = Css.add(prop, "value").$;
    `).toBeNormalized(`
      console.error("[truss] Unsupported pattern: add() first argument must be a string literal property name (test.tsx:3)");
      const prop = "boxShadow";
      const s = {};
    `);
  });
});

test("indirect style references via useMemo and function calls", () => {
  expectTransform(`
      import { useMemo } from "react";
      import { Css } from "./Css";

      function SpreadLikeButton(props) {
        const styles = useMemo(function () {
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
    `).toBeNormalized(`
      import { useMemo } from "react";
      function SpreadLikeButton(props) {
        const styles = useMemo(function () {
          return getSpreadLikeStyles();
        }, []);
        const attrs = {
          "data-testid": "button",
          css: { ...styles.baseStyles, ...(props.active && styles.activeStyles) }
        };
        return <button {...attrs}>Click me</button>;
      }
      function getSpreadLikeStyles() {
        const borderBottomStyles = { borderBottomStyle: "bb_borderBottomStyle", borderBottomWidth: "bb_borderBottomWidth" };
        return {
          baseStyles: { display: "df", alignItems: "aic" },
          activeStyles: { ...{ color: "blue" }, ...borderBottomStyles }
        };
      }
    `);
});

test("ternary mixing {} and style object normalizes {} to {}", () => {
  expectTransform(`
      import { Css } from "./Css";

      function TabsContent(props) {
        const styles = props.hideTabs ? {} : Css.pt3.$;
        return <div css={{ ...styles, ...props.contentXss }} />;
      }
    `).toBeNormalized(`
      import { trussProps } from "@homebound/truss/runtime";
      function TabsContent(props) {
        const styles = props.hideTabs ? {} : { paddingTop: "pt3" };
        return <div {...trussProps({ ...styles, ...props.contentXss })} />;
      }
    `);
});

test("css helper returns generated CSS text", () => {
  const result = css(`import { Css } from "./Css"; const s = Css.df.$;`);
  expect(result).toMatch(/\.df/);
  expect(result).toMatch(/display: flex/);
});

/** Transform helper — returns the rewritten JS code. */
function transform(code: string, options?: { debug?: boolean }): string | null {
  const result = transformTruss(snippet(code), "test.tsx", mapping, options);
  return result?.code ? normalize(result.code) : null;
}

/** Expect helper around transform output. */
function expectTransform(code: string, options?: { debug?: boolean }) {
  return expect(transform(code, options));
}

/** Expect helper around transform code and css outputs. */
function expectTrussTransform(code: string, options?: { debug?: boolean }) {
  return expect(trussOutput(code, options));
}

/** Truss output helper for asserting code and css together. */
function trussOutput(code: string, options?: { debug?: boolean }): { code: string | null; css: string | null } {
  const result = transformTruss(snippet(code), "test.tsx", mapping, options);
  return {
    code: result?.code ? normalize(result.code) : null,
    css: result?.css ? normalize(result.css) : null,
  };
}

/** CSS helper — returns the generated CSS text. */
function css(code: string, options?: { debug?: boolean }): string | null {
  const result = transformTruss(snippet(code), "test.tsx", mapping, options);
  return result?.css ?? null;
}

/** Normalize whitespace so we can write readable multi-line expectations. */
function n(s: string): string {
  return normalize(s);
}

/** Dedent code snippets so line numbers stay stable. */
function snippet(code: string): string {
  const lines = code.trim().split("\n");
  const indentation = lines.reduce(function (min, line) {
    if (line.trim() === "") {
      return min;
    }

    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    return Math.min(min, indent);
  }, Number.POSITIVE_INFINITY);

  if (!Number.isFinite(indentation) || indentation === 0) {
    return lines.join("\n");
  }

  return lines
    .map(function (line) {
      return line.slice(indentation);
    })
    .join("\n");
}

function lineOf(source: string, search: string): number {
  return (
    source.split("\n").findIndex(function (line) {
      return line.includes(search);
    }) + 1
  );
}
