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
    expect(n(transform(`import { Css } from "./Css"; const s = Css.df.$;`)!)).toBe(n(`const s = { display: "df" };`));
  });

  test("keeps runtime import rewrites on the former Css import line", () => {
    const output = transform(`
      import { keepMe } from "./other";
      import { Css } from "./Css";

      const el = <div css={Css.black.$} />;
      const value = keepMe();
    `)!;

    expect(lineOf(output, 'import { trussProps } from "@homebound/truss/runtime";')).toBe(2);
    expect(lineOf(output, "const el =")).toBe(4);
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
    expect(n(transform(`import { Css } from "./Css"; const s = Css.df.aic.$;`)!)).toBe(
      n(`const s = { display: "df", alignItems: "aic" };`),
    );
  });

  test("css prop on JSX: css={Css.df.$}", () => {
    expect(n(transform(`import { Css } from "./Css"; const el = <div css={Css.df.$} />;`)!)).toBe(
      n(`
        import { trussProps } from "@homebound/truss/runtime";
        const el = <div {...trussProps({ display: "df" })} />;
      `),
    );
  });

  test("css prop with multi-getter: css={Css.df.aic.black.$}", () => {
    expect(n(transform(`import { Css } from "./Css"; const el = <div css={Css.df.aic.black.$} />;`)!)).toBe(
      n(`
        import { trussProps } from "@homebound/truss/runtime";
        const el = <div {...trussProps({ display: "df", alignItems: "aic", color: "black" })} />;
      `),
    );
  });

  test("debug mode rewrites jsx css props through trussProps", () => {
    expect(n(transform(`import { Css } from "./Css"; const el = <div css={Css.df.aic.$} />;`, { debug: true })!)).toBe(
      n(`
        import { trussProps, TrussDebugInfo } from "@homebound/truss/runtime";
        const el = <div {...trussProps({ display: ["df", new TrussDebugInfo("test.tsx:1")], alignItems: "aic" })} />;
      `),
    );
  });

  test("debug mode keeps debug info in non-jsx style objects", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.df.$;`, { debug: true })!)).toBe(
      n(`
        import { TrussDebugInfo } from "@homebound/truss/runtime";
        const s = { display: ["df", new TrussDebugInfo("test.tsx:1")] };
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
        import { mergeProps, TrussDebugInfo } from "@homebound/truss/runtime";
        const el = <div {...mergeProps("existing", undefined, { display: ["df", new TrussDebugInfo("test.tsx:1")] })} />;
      `),
    );
  });

  test("variable with literal arg: Css.mt(2).$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.mt(2).$;`)!)).toBe(
      n(`const s = { marginTop: "mt_16px" };`),
    );
  });

  test("variable with string literal: Css.mt('10px').$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.mt("10px").$;`)!)).toBe(
      n(`const s = { marginTop: "mt_10px" };`),
    );
  });

  test("variable with variable arg: Css.mt(x).$", () => {
    expect(n(transform(`import { Css } from "./Css"; const x = getSomeValue(); const s = Css.mt(x).$;`)!)).toBe(
      n(`
        const __maybeInc = inc => { return typeof inc === "string" ? inc : \`\${inc * 8}px\`; };
        const x = getSomeValue();
        const s = { marginTop: ["mt_var", { "--marginTop": __maybeInc(x) }] };
      `),
    );
  });

  test("delegate with literal: Css.mtPx(12).$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.mtPx(12).$;`)!)).toBe(
      n(`const s = { marginTop: "mt_12px" };`),
    );
  });

  test("delegate with variable arg appends px: Css.mtPx(x).$", () => {
    expect(n(transform(`import { Css } from "./Css"; const x = getSomeValue(); const s = Css.mtPx(x).$;`)!)).toBe(
      n(`
        const x = getSomeValue();
        const s = { marginTop: ["mt_var", { "--marginTop": \`\${x}px\` }] };
      `),
    );
  });

  test("delegate shorthand with multiple props appends px: Css.pxPx(x).$", () => {
    expect(n(transform(`import { Css } from "./Css"; const x = getSomeValue(); const s = Css.pxPx(x).$;`)!)).toBe(
      n(`
        const x = getSomeValue();
        const s = { paddingLeft: ["px_var", { "--paddingLeft": \`\${x}px\` }], paddingRight: ["px_var", { "--paddingRight": \`\${x}px\` }] };
      `),
    );
  });

  test("delegate shorthand with multiple props supports sqPx: Css.sqPx(x).$", () => {
    expect(n(transform(`import { Css } from "./Css"; const x = getSomeValue(); const s = Css.sqPx(x).$;`)!)).toBe(
      n(`
        const x = getSomeValue();
        const s = { height: ["sq_var", { "--height": \`\${x}px\` }], width: ["sq_var", { "--width": \`\${x}px\` }] };
      `),
    );
  });

  test("non-incremented variable: Css.bc('red').$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.bc("red").$;`)!)).toBe(
      n(`const s = { borderColor: "bc_red" };`),
    );
  });

  test("non-incremented variable with variable: Css.bc(color).$", () => {
    expect(n(transform(`import { Css } from "./Css"; const color = getColor(); const s = Css.bc(color).$;`)!)).toBe(
      n(`
        const color = getColor();
        const s = { borderColor: ["bc_var", { "--borderColor": color }] };
      `),
    );
  });

  test("variable method keeps extra defs: Css.lineClamp(lines).$", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const lines = getLineCount(); const s = Css.lineClamp(lines).$;`)!),
    ).toBe(
      n(`
        const lines = getLineCount();
        const s = {
          WebkitLineClamp: ["lineClamp_var", { "--WebkitLineClamp": lines }],
          overflow: "lineClamp_overflow",
          display: "lineClamp_display",
          WebkitBoxOrient: "lineClamp_WebkitBoxOrient",
          textOverflow: "lineClamp_textOverflow"
        };
      `),
    );
  });

  test("variable literal keeps extra defs: Css.lineClamp('3').$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.lineClamp("3").$;`)!)).toBe(
      n(`
        const s = {
          WebkitLineClamp: "lineClamp_3_WebkitLineClamp",
          overflow: "oh",
          display: "lineClamp_3_display",
          WebkitBoxOrient: "lineClamp_3_WebkitBoxOrient",
          textOverflow: "lineClamp_3_textOverflow"
        };
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
        import { trussProps } from "@homebound/truss/runtime";
        const a = <div {...trussProps({ display: "df" })} />;
        const b = <div {...trussProps({ display: "df", alignItems: "aic" })} />;
      `),
    );
  });

  test("alias expansion: Css.bodyText.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.bodyText.$;`)!)).toBe(
      n(`const s = { fontSize: "f14", color: "black" };`),
    );
  });

  test("typography literal: Css.typography('f14').$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.typography("f14").$;`)!)).toBe(
      n(`const s = { fontSize: "f14" };`),
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
      `),
    );
  });

  test("Css import is removed when only Css is imported", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.df.$;`)!)).toBe(n(`const s = { display: "df" };`));
  });

  test("Css specifier removed but Palette kept", () => {
    expect(n(transform(`import { Css, Palette } from "./Css"; const s = Css.df.$; const c = Palette.Black;`)!)).toBe(
      n(`
        import { Palette } from "./Css";
        const s = { display: "df" };
        const c = Palette.Black;
      `),
    );
  });

  test("multi-property static: Css.ba.$ (border)", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.ba.$;`)!)).toBe(
      n(`const s = { borderStyle: "bss", borderWidth: "bw1" };`),
    );
  });

  test("mixed static and variable: Css.df.mt(2).black.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.df.mt(2).black.$;`)!)).toBe(
      n(`const s = { display: "df", marginTop: "mt_16px", color: "black" };`),
    );
  });

  test("onHover pseudo: Css.black.onHover.blue.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.black.onHover.blue.$;`)!)).toBe(
      n(`const s = { color: "black h_blue" };`),
    );
  });

  test("onHover with multi-property: Css.onHover.ba.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.onHover.ba.$;`)!)).toBe(
      n(`const s = { borderStyle: "h_bss", borderWidth: "h_bw1" };`),
    );
  });

  test("onFocus pseudo: Css.onFocus.blue.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.onFocus.blue.$;`)!)).toBe(
      n(`const s = { color: "f_blue" };`),
    );
  });

  test("onHover with variable literal: Css.onHover.bc('red').$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.onHover.bc("red").$;`)!)).toBe(
      n(`const s = { borderColor: "h_bc_red" };`),
    );
  });

  test("onHover with variable variable: Css.onHover.bc(color).$", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const color = getColor(); const s = Css.onHover.bc(color).$;`)!),
    ).toBe(
      n(`
        const color = getColor();
        const s = { borderColor: ["h_bc_var", { "--h_borderColor": color }] };
      `),
    );
  });

  test("container query pseudo: Css.ifContainer({ gt, lt }).gc('span 2').$", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const s = Css.ifContainer({ gt: 600, lt: 960 }).gc("span 2").$;`)!),
    ).toBe(n(`const s = { gridColumn: "mq_gc_span_2" };`));
  });

  test("container query merges overlapping property", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const s = Css.black.ifContainer({ gt: 600, lt: 960 }).blue.$;`)!),
    ).toBe(n(`const s = { color: "black mq_blue" };`));
  });

  test("container query with named container", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const s = Css.ifContainer({ name: "grid", gt: 600, lt: 960 }).blue.$;`,
        )!,
      ),
    ).toBe(n(`const s = { color: "mq_blue" };`));
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
        console.error("[truss] Unsupported pattern: ifContainer().gt must be a numeric literal (test.tsx:1)");
        const minWidth = getMinWidth();
        const maxWidth = getMaxWidth();
        const s = { color: "blue" };
      `),
    );
  });

  test("object spread composition uses native object spread", () => {
    expect(
      n(
        transform(
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
        )!,
      ),
    ).toBe(
      n(`
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
      `),
    );
  });

  test("native object composition stays as-is", () => {
    expect(
      n(
        transform(`
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
        `)!,
      ),
    ).toBe(
      n(`
        import { trussProps } from "@homebound/truss/runtime";
        function Button(props) {
          const { active, isHovered } = props;
          const baseStyles = { ...{ display: "df", alignItems: "aic" } };
          const activeStyles = { ...{ color: "black" } };
          const hoverStyles = { ...{ color: "blue" } };
          return <div {...trussProps({ ...baseStyles, ...(active && activeStyles), ...(isHovered && hoverStyles) })} />;
        }
      `),
    );
  });

  test("Css.props is rewritten to trussProps spread", () => {
    expect(
      n(
        transform(`
          import { Css } from "./Css";

          function Button() {
            const attrs = {
              "data-testid": "button",
              ...Css.props(Css.blue.$),
            };
            return <button {...attrs}>Click me</button>;
          }
        `)!,
      ),
    ).toBe(
      n(`
        import { trussProps } from "@homebound/truss/runtime";
        function Button() {
          const attrs = {
            "data-testid": "button",
            ...trussProps({ color: "blue" })
          };
          return <button {...attrs}>Click me</button>;
        }
      `),
    );
  });

  test("Css.props in debug mode is rewritten to trussProps", () => {
    expect(
      n(
        transform(
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
        )!,
      ),
    ).toBe(
      n(`
        import { trussProps, TrussDebugInfo } from "@homebound/truss/runtime";
        function Button() {
          const attrs = {
            ...trussProps({ display: ["df", new TrussDebugInfo("test.tsx:6")], alignItems: "aic" })
          };
          return <button {...attrs}>Click me</button>;
        }
      `),
    );
  });

  test("Css.props with object literal passes through to trussProps", () => {
    expect(
      n(
        transform(`
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
        `)!,
      ),
    ).toBe(
      n(`
        import { trussProps } from "@homebound/truss/runtime";
        function Button({ active, styles }) {
          const attrs = {
            "data-testid": "button",
            ...trussProps({ ...styles.baseStyles, ...(active && styles.activeStyles) })
          };
          return <button {...attrs}>Click me</button>;
        }
      `),
    );
  });

  test("Css.props with sibling className merges via mergeProps", () => {
    expect(
      n(
        transform(`
          import { Css } from "./Css";

          function Button({ asLink, navLink }) {
            const attrs = {
              className: asLink ? navLink : undefined,
              ...Css.props(Css.df.aic.$),
            };
            return <button {...attrs}>Click me</button>;
          }
        `)!,
      ),
    ).toBe(
      n(`
        import { trussProps, mergeProps } from "@homebound/truss/runtime";
        function Button({ asLink, navLink }) {
          const attrs = {
            ...mergeProps(asLink ? navLink : undefined, undefined, { display: "df", alignItems: "aic" })
          };
          return <button {...attrs}>Click me</button>;
        }
      `),
    );
  });

  test("Css.props with sibling className and object literal styles", () => {
    expect(
      n(
        transform(`
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
        `)!,
      ),
    ).toBe(
      n(`
        import { trussProps, mergeProps } from "@homebound/truss/runtime";
        function Button({ asLink, navLink, baseStyles, active, hoverStyles }) {
          const attrs = {
            ...mergeProps(asLink ? navLink : undefined, undefined, { ...{ display: "df" }, ...baseStyles, ...(active && hoverStyles) })
          };
          return <button {...attrs}>Click me</button>;
        }
      `),
    );
  });

  test("style object variable in css prop is lowered to trussProps", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const base = Css.df.aic.$; const el = <div css={base} />;`)!),
    ).toBe(
      n(`
        import { trussProps } from "@homebound/truss/runtime";
        const base = { display: "df", alignItems: "aic" };
        const el = <div {...trussProps(base)} />;
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
        import { trussProps } from "@homebound/truss/runtime";
        function Box({ cssProp }) { return <div {...trussProps({ ...cssProp, ...{ display: "df" } })} />; }
      `),
    );
  });

  test("external call expression in css prop is wrapped in trussProps", () => {
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
        import { trussProps } from "@homebound/truss/runtime";
        function Example({ param, content }) {
          return <div {...trussProps(getFromAnotherFile(param))}><span {...trussProps({ color: "blue" })}>{content}</span></div>;
        }
      `),
    );
  });

  test("css prop with non-spread property is still wrapped in trussProps", () => {
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
        import { trussProps } from "@homebound/truss/runtime";
        const base = { display: "df" };
        const cssProp = getCssProp();
        const el = <div {...trussProps({ ...cssProp, foo: true })} />;
      `),
    );
  });

  test("conditional css prop with undefined branch is still wrapped", () => {
    expect(
      n(
        transform(`
          import { Css } from "./Css";

          function Repro(props: { enabled: boolean }) {
            return <div css={props.enabled ? Css.pb2.$ : undefined}>hello</div>;
          }
        `)!,
      ),
    ).toBe(
      n(`
        import { trussProps } from "@homebound/truss/runtime";
        function Repro(props: { enabled: boolean; }) {
          return <div {...trussProps(props.enabled ? { paddingBottom: "pb2" } : undefined)}>hello</div>;
        }
      `),
    );
  });

  test("ordinary object spreads stay objects", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = { foo: true, ...other }; const t = Css.df.$;`)!)).toBe(
      n(`
        const s = { foo: true, ...other };
        const t = { display: "df" };
      `),
    );
  });

  test("style composition objects stay as native object spread", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const borderBottomStyles = Css.bb.$; const styles = { activeStyles: { ...Css.black.$, foo: true, ...borderBottomStyles } };`,
        )!,
      ),
    ).toBe(
      n(`
        const borderBottomStyles = { borderBottomStyle: "bb_borderBottomStyle", borderBottomWidth: "bb_borderBottomWidth" };
        const styles = { activeStyles: { ...{ color: "black" }, foo: true, ...borderBottomStyles } };
      `),
    );
  });

  test("style composition objects can mix Css spreads with external spreads", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const borderBottomStyles = maybeStyles(); const styles = { activeStyles: { ...Css.black.$, ...borderBottomStyles } };`,
        )!,
      ),
    ).toBe(
      n(`
        const borderBottomStyles = maybeStyles();
        const styles = { activeStyles: { ...{ color: "black" }, ...borderBottomStyles } };
      `),
    );
  });

  test("style composition objects support active and hover style maps with shared border styles", () => {
    expect(
      n(
        transform(`
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
        `)!,
      ),
    ).toBe(
      n(`
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
      `),
    );
  });

  test("conditional: Css.if(cond).df.else.db.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.if(isActive).df.else.db.$;`)!)).toBe(
      n(`const s = { ...(isActive ? { display: "df" } : { display: "db" }) };`),
    );
  });

  test("conditional with preceding styles: Css.p1.if(cond).df.else.db.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.p1.if(isActive).df.else.db.$;`)!)).toBe(
      n(`
        const s = {
          paddingTop: "pt1",
          paddingBottom: "pb1",
          paddingRight: "pr1",
          paddingLeft: "pl1",
          ...(isActive ? { display: "df" } : { display: "db" })
        };
      `),
    );
  });

  test("else branch includes trailing styles: Css.if(cond).df.else.db.mt1.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.if(isActive).df.else.db.mt1.$;`)!)).toBe(
      n(`const s = { ...(isActive ? { display: "df" } : { display: "db", marginTop: "mt1" }) };`),
    );
  });

  test("conditional pseudo branch keeps earlier base class on the same property", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.black.if(isActive).onHover.white.$;`)!)).toBe(
      n(`const s = { color: "black", ...(isActive ? { color: "black h_white" } : {}) };`),
    );
    expect(n(css(`import { Css } from "./Css"; const s = Css.black.if(isActive).onHover.white.$;`)!)).toBe(
      n(`
        .black {
          color: #353535;
        }
        .h_white:hover {
          color: #fcfcfa;
        }
      `),
    );
  });

  test("conditional else pseudo branch keeps earlier base class on the same property", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const s = Css.black.if(isActive).bgBlue.else.onHover.white.$;`)!),
    ).toBe(
      n(`const s = { color: "black", ...(isActive ? { backgroundColor: "bgBlue" } : { color: "black h_white" }) };`),
    );
    // bgBlue sorts before black alphabetically (both are priority 3000 longhands)
    expect(n(css(`import { Css } from "./Css"; const s = Css.black.if(isActive).bgBlue.else.onHover.white.$;`)!)).toBe(
      n(`
        .bgBlue {
          background-color: #526675;
        }
        .black {
          color: #353535;
        }
        .h_white:hover {
          color: #fcfcfa;
        }
      `),
    );
  });

  test("conditional same-property replacement does not merge base class into branch", () => {
    // Css.bgBlue.if(selected).bgWhite.$ — when selected, bgWhite replaces bgBlue entirely.
    // The base class should NOT be merged into the then branch.
    expect(n(transform(`import { Css } from "./Css"; const s = Css.bgBlue.if(selected).bgWhite.$;`)!)).toBe(
      n(`const s = { backgroundColor: "bgBlue", ...(selected ? { backgroundColor: "bgWhite" } : {}) };`),
    );
  });

  test("conditional replacement preserves preceding non-overlapping properties", () => {
    // Css.df.aic.bgBlue.if(selected).bgWhite.$ — df and aic should survive the conditional
    expect(n(transform(`import { Css } from "./Css"; const s = Css.df.aic.bgBlue.if(selected).bgWhite.$;`)!)).toBe(
      n(
        `const s = { display: "df", alignItems: "aic", backgroundColor: "bgBlue", ...(selected ? { backgroundColor: "bgWhite" } : {}) };`,
      ),
    );
  });

  test("conditional replacement with many preceding properties and delegates preserves all base classes", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const el = <div css={Css.absolute.bottomPx(4).wPx(4).hPx(4).bgBlue.br4.if(selected && !range_middle).bgWhite.$} />;`,
        )!,
      ),
    ).toBe(
      n(`
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
      `),
    );
  });

  test("conditional variable branch replaces base class on the same property", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.w100.if(isActive).w(getWidth()).$;`)!)).toBe(
      n(`
        const __maybeInc = inc => { return typeof inc === "string" ? inc : \`\${inc * 8}px\`; };
        const s = { width: "w100", ...(isActive ? { width: ["w_var", { "--width": __maybeInc(getWidth()) }] } : {}) };
      `),
    );
    expect(n(css(`import { Css } from "./Css"; const s = Css.w100.if(isActive).w(getWidth()).$;`)!)).toBe(
      n(`
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
      `),
    );
  });

  test("later base-level property replaces earlier base-level property", () => {
    // Css.ba sets borderWidth: "1px", then add("borderWidth", "3px") should replace it, not accumulate
    expect(n(transform(`import { Css } from "./Css"; const s = Css.ba.add("borderWidth", "3px").$;`)!)).toBe(
      n(`const s = { borderStyle: "bss", borderWidth: "borderWidth_3px" };`),
    );
  });

  test("negative increment: Css.mt(-1).$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.mt(-1).$;`)!)).toBe(
      n(`const s = { marginTop: "mt_neg8px" };`),
    );
  });

  test("increment zero: Css.mt(0).$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.mt(0).$;`)!)).toBe(
      n(`const s = { marginTop: "mt_0px" };`),
    );
  });

  test("static increment getters: Css.mt0.mt1.p1.$ — later mt1 replaces mt0", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.mt0.mt1.p1.$;`)!)).toBe(
      n(`
        const s = {
          marginTop: "mt1",
          paddingTop: "pt1",
          paddingBottom: "pb1",
          paddingRight: "pr1",
          paddingLeft: "pl1"
        };
      `),
    );
  });

  test("className merging: css + className on same element", () => {
    expect(n(transform(`import { Css } from "./Css"; const el = <div className="existing" css={Css.df.$} />;`)!)).toBe(
      n(`
        import { mergeProps } from "@homebound/truss/runtime";
        const el = <div {...mergeProps("existing", undefined, { display: "df" })} />;
      `),
    );
  });

  test("className merging: css + variable className expression", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const cls = getClass(); const el = <div className={cls} css={Css.df.$} />;`,
        )!,
      ),
    ).toBe(
      n(`
        import { mergeProps } from "@homebound/truss/runtime";
        const cls = getClass();
        const el = <div {...mergeProps(cls, undefined, { display: "df" })} />;
      `),
    );
  });

  test("style merging: css + style on same element", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const el = <div style={{ minWidth: "fit-content" }} css={Css.blue.$} />;`,
        )!,
      ),
    ).toBe(
      n(`
        import { mergeProps } from "@homebound/truss/runtime";
        const el = <div {...mergeProps(undefined, { minWidth: "fit-content" }, { color: "blue" })} />;
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
      n(`
        const __maybeInc_1 = inc => { return typeof inc === "string" ? inc : \`\${inc * 8}px\`; };
        const __maybeInc = keepMe();
        const x = getSomeValue();
        const s = { marginTop: ["mt_var", { "--marginTop": __maybeInc_1(x) }] };
      `),
    );
  });

  test("onHover on same property merges base+pseudo into single entry", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.bgBlue.onHover.bgBlack.$;`)!)).toBe(
      n(`const s = { backgroundColor: "bgBlue h_bgBlack" };`),
    );
  });

  test("onHover merge: non-overlapping properties kept separate", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.df.onHover.blue.$;`)!)).toBe(
      n(`const s = { display: "df", color: "h_blue" };`),
    );
  });

  // ── Marker tests ────────────────────────────────────────────────────

  test("Css.marker.$ emits a default marker class", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.marker.$;`)!)).toBe(
      n(`const s = { __marker: "__truss_m" };`),
    );
  });

  test("Css.marker.$ in JSX css prop emits trussProps with marker metadata", () => {
    expect(n(transform(`import { Css } from "./Css"; const el = <div css={Css.marker.$} />;`)!)).toBe(
      n(`
        import { trussProps } from "@homebound/truss/runtime";
        const el = <div {...trussProps({ __marker: "__truss_m" })} />;
      `),
    );
  });

  test("Css.marker.df.$ combines marker with styles", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.marker.df.$;`)!)).toBe(
      n(`const s = { __marker: "__truss_m", display: "df" };`),
    );
  });

  test("Css.markerOf(row).$ passes marker variable through", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const row = Css.newMarker(); const s = Css.markerOf(row).$;`)!),
    ).toBe(
      n(`
        const row = Css.newMarker();
        const s = { __marker: "__truss_m_row" };
      `),
    );
  });

  test("marker and when('ancestor') in same file use same user-defined marker variable", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const row = Css.newMarker(); const a = Css.markerOf(row).$; const b = Css.when("ancestor", row, ":hover").blue.$;`,
        )!,
      ),
    ).toBe(
      n(`
        const row = Css.newMarker();
        const a = { __marker: "__truss_m_row" };
        const b = { color: "wh_anc_h_row_blue" };
      `),
    );
    expect(
      n(
        css(
          `import { Css } from "./Css"; const row = Css.newMarker(); const a = Css.markerOf(row).$; const b = Css.when("ancestor", row, ":hover").blue.$;`,
        )!,
      ),
    ).toBe(
      n(`
      .__truss_m_row:hover .wh_anc_h_row_blue {
        color: #526675;
      }
    `),
    );
  });

  // ── when() generic API tests ──────────────────────────────────────

  test("Css.when('ancestor', ':hover').blue.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.when("ancestor", ":hover").blue.$;`)!)).toBe(
      n(`const s = { color: "wh_anc_h_blue" };`),
    );
    expect(n(css(`import { Css } from "./Css"; const s = Css.when("ancestor", ":hover").blue.$;`)!)).toBe(
      n(`
        .__truss_m:hover .wh_anc_h_blue {
          color: #526675;
        }
      `),
    );
  });

  test("Css.when('ancestor', marker, ':hover').blue.$", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const marker = Css.newMarker(); const s = Css.when("ancestor", marker, ":hover").blue.$;`,
        )!,
      ),
    ).toBe(
      n(`
        const marker = Css.newMarker();
        const s = { color: "wh_anc_h_marker_blue" };
      `),
    );
  });

  test("Css.when('descendant', ':focus').blue.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.when("descendant", ":focus").blue.$;`)!)).toBe(
      n(`const s = { color: "wh_desc_f_blue" };`),
    );
    expect(n(css(`import { Css } from "./Css"; const s = Css.when("descendant", ":focus").blue.$;`)!)).toBe(
      n(`
        .wh_desc_f_blue:has(.__truss_m:focus) {
          color: #526675;
        }
      `),
    );
  });

  test("Css.when('siblingAfter', ':hover').blue.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.when("siblingAfter", ":hover").blue.$;`)!)).toBe(
      n(`const s = { color: "wh_sibA_h_blue" };`),
    );
    expect(n(css(`import { Css } from "./Css"; const s = Css.when("siblingAfter", ":hover").blue.$;`)!)).toBe(
      n(`
        .wh_sibA_h_blue:has(~ .__truss_m:hover) {
          color: #526675;
        }
      `),
    );
  });

  test("Css.when('siblingBefore', ':hover').blue.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.when("siblingBefore", ":hover").blue.$;`)!)).toBe(
      n(`const s = { color: "wh_sibB_h_blue" };`),
    );
    expect(n(css(`import { Css } from "./Css"; const s = Css.when("siblingBefore", ":hover").blue.$;`)!)).toBe(
      n(`
        .__truss_m:hover ~ .wh_sibB_h_blue {
          color: #526675;
        }
      `),
    );
  });

  test("Css.when('anySibling', marker, ':hover').blue.$", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const row = Css.newMarker(); const s = Css.when("anySibling", row, ":hover").blue.$;`,
        )!,
      ),
    ).toBe(
      n(`
        const row = Css.newMarker();
        const s = { color: "wh_anyS_h_row_blue" };
      `),
    );
  });

  test("Css.when with invalid relationship emits console.error", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.when("bogus", ":hover").blue.$;`)!)).toBe(
      n(`
        console.error("[truss] Unsupported pattern: when() relationship must be one of: ancestor, descendant, anySibling, siblingBefore, siblingAfter -- got \\\"bogus\\\" (test.tsx:1)");
        const s = { color: "blue" };
      `),
    );
  });

  test("Css.when with non-literal relationship emits console.error", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const rel = "ancestor"; const s = Css.when(rel, ":hover").blue.$;`)!),
    ).toBe(
      n(`
        console.error("[truss] Unsupported pattern: when() first argument must be a string literal relationship (test.tsx:1)");
        const rel = "ancestor";
        const s = { color: "blue" };
      `),
    );
  });

  test("markerOf accepts a variable argument", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const row = getMarker(); const s = Css.markerOf(row).df.$;`)!),
    ).toBe(
      n(`
        const row = getMarker();
        const s = { __marker: "__truss_m_row", display: "df" };
      `),
    );
  });

  // ── Breakpoint / media query tests ──────────────────────────────────

  test("if(mediaQuery) as pseudo: Css.if('@media screen and (max-width: 599px)').df.$", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const s = Css.if("@media screen and (max-width: 599px)").df.$;`)!),
    ).toBe(n(`const s = { display: "sm_df" };`));
  });

  test("if(mediaQuery) merges with base: Css.bgBlue.if('@media screen and (max-width: 599px)').bgBlack.$", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const s = Css.bgBlue.if("@media screen and (max-width: 599px)").bgBlack.$;`,
        )!,
      ),
    ).toBe(n(`const s = { backgroundColor: "bgBlue sm_bgBlack" };`));
  });

  test("if(Breakpoints.sm) works like if('@media...')", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const s = Css.if("@media screen and (min-width: 960px)").df.$;`)!),
    ).toBe(n(`const s = { display: "lg_df" };`));
  });

  test("breakpoint + pseudo combination: Css.ifSm.onHover.blue.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.ifSm.onHover.blue.$;`)!)).toBe(
      n(`const s = { color: "sm_h_blue" };`),
    );
  });

  test("base + breakpoint + pseudo: Css.black.ifSm.onHover.blue.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.black.ifSm.onHover.blue.$;`)!)).toBe(
      n(`const s = { color: "black sm_h_blue" };`),
    );
  });

  test("base + breakpoint color + breakpoint+pseudo color: Css.black.ifSm.white.onHover.blue.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.black.ifSm.white.onHover.blue.$;`)!)).toBe(
      n(`const s = { color: "black sm_white sm_h_blue" };`),
    );
  });

  test("breakpoint only: Css.ifSm.df.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.ifSm.df.$;`)!)).toBe(
      n(`const s = { display: "sm_df" };`),
    );
  });

  test("breakpoint else uses the complementary screen query", () => {
    const input = `import { Css } from "./Css"; const s = Css.ifSm.black.else.white.$;`;

    expect(n(transform(input)!)).toBe(n(`const s = { color: "sm_black mdandup_white" };`));

    // mdandup sorts before sm alphabetically (both are priority 3200 = longhand + @media)
    expect(n(css(input)!)).toEqual(
      n(`
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
    `),
    );
  });

  test("raw media else uses the complementary screen query", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const s = Css.if("@media screen and (max-width: 599px)").black.else.white.$;`,
        )!,
      ),
    ).toBe(n(`const s = { color: "sm_black mdandup_white" };`));
  });

  test("breakpoint after base style: Css.df.ifMd.blue.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.df.ifMd.blue.$;`)!)).toBe(
      n(`const s = { display: "df", color: "md_blue" };`),
    );
  });

  test("breakpoint merges overlapping property: Css.bgBlue.ifSm.bgBlack.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.bgBlue.ifSm.bgBlack.$;`)!)).toBe(
      n(`const s = { backgroundColor: "bgBlue sm_bgBlack" };`),
    );
  });

  test("breakpoint with large: Css.ifLg.df.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.ifLg.df.$;`)!)).toBe(
      n(`const s = { display: "lg_df" };`),
    );
  });

  test("breakpoint with combination: Css.ifSmOrMd.blue.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.ifSmOrMd.blue.$;`)!)).toBe(
      n(`const s = { color: "smormd_blue" };`),
    );
  });

  test("breakpoint with variable literal: Css.ifSm.mt(2).$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.ifSm.mt(2).$;`)!)).toBe(
      n(`const s = { marginTop: "sm_mt_16px" };`),
    );
  });

  test("breakpoint with multi-property: Css.ifSm.ba.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.ifSm.ba.$;`)!)).toBe(
      n(`const s = { borderStyle: "sm_bss", borderWidth: "sm_bw1" };`),
    );
  });

  test("breakpoint in JSX: css={Css.ifSm.df.$}", () => {
    expect(n(transform(`import { Css } from "./Css"; const el = <div css={Css.ifSm.df.$} />;`)!)).toBe(
      n(`
        import { trussProps } from "@homebound/truss/runtime";
        const el = <div {...trussProps({ display: "sm_df" })} />;
      `),
    );
  });

  // ── Pseudo-element tests ─────────────────────────────────────────────

  test("element('::placeholder').blue.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.element("::placeholder").blue.$;`)!)).toBe(
      n(`const s = { color: "placeholder_blue" };`),
    );
  });

  test("element('::selection') with static styles", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.element("::selection").bgBlue.white.$;`)!)).toBe(
      n(`const s = { backgroundColor: "selection_bgBlue", color: "selection_white" };`),
    );
  });

  test("element with variable literal: element('::placeholder').bc('red').$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.element("::placeholder").bc("red").$;`)!)).toBe(
      n(`const s = { borderColor: "placeholder_bc_red" };`),
    );
  });

  test("element + onHover: Css.element('::placeholder').onHover.blue.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.element("::placeholder").onHover.blue.$;`)!)).toBe(
      n(`const s = { color: "placeholder_h_blue" };`),
    );
  });

  test("element with non-literal argument errors", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const pe = "::placeholder"; const s = Css.element(pe).blue.$;`)!),
    ).toBe(
      n(`
        console.error("[truss] Unsupported pattern: element() requires exactly one string literal argument (e.g. \\"::placeholder\\") (test.tsx:1)");
        const pe = "::placeholder";
        const s = { color: "blue" };
      `),
    );
  });

  test("unsupported patterns emit console.error and produce empty object", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.notReal.$;`)!)).toBe(
      n(`
        console.error("[truss] Unsupported pattern: Unknown abbreviation \\"notReal\\" (test.tsx:1)");
        const s = {};
      `),
    );
  });

  // ── add() tests ─────────────────────────────────────────────────────

  test("add with string literal value: Css.add('boxShadow', '0 0 0 1px blue').$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.add("boxShadow", "0 0 0 1px blue").$;`)!)).toBe(
      n(`const s = { boxShadow: "boxShadow_0_0_0_1px_blue" };`),
    );
  });

  test("add with numeric literal value: Css.add('animationDelay', '300ms').$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.add("animationDelay", "300ms").$;`)!)).toBe(
      n(`const s = { animationDelay: "animationDelay_300ms" };`),
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
        const shadow = getShadow();
        const s = { boxShadow: ["boxShadow_var", { "--boxShadow": shadow }] };
      `),
    );
  });

  test("add mixed with other chain segments: Css.df.add('wordBreak', 'break-word').black.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.df.add("wordBreak", "break-word").black.$;`)!)).toBe(
      n(`const s = { display: "df", wordBreak: "wordBreak_break_word", color: "black" };`),
    );
  });

  test("add uses property name in jsx output and generated css", () => {
    const code = `import { Css } from "./Css"; const el = <div css={Css.mt2.add("transition", "all 240ms").$} />;`;

    expect(n(transform(code)!)).toBe(
      n(`
        import { trussProps } from "@homebound/truss/runtime";
        const el = <div {...trussProps({ marginTop: "mt2", transition: "transition_all_240ms" })} />;
      `),
    );
    // transition (shorthand-of-longhands = 2000) sorts before margin-top (physical longhand = 4000)
    expect(n(css(code)!)).toBe(
      n(`
      .transition_all_240ms {
        transition: all 240ms;
      }
      .mt2 {
        margin-top: 16px;
      }
    `),
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

    expect(n(transform(code)!)).toBe(
      n(`
        import { Palette } from "./Css";
        import { trussProps } from "@homebound/truss/runtime";
        const el = <div {...trussProps({ ...{ color: "white" }, ...{ color: ["color_var", { "--color": Palette.Blue }] }, ...{ color: ["color_var", { "--color": Palette.Black }] } })} />;
      `),
    );
    expect(n(css(code)!)).toBe(
      n(`
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
    `),
    );
  });

  test("add with pseudo: Css.onHover.add('textDecoration', 'underline').$", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const s = Css.onHover.add("textDecoration", "underline").$;`)!),
    ).toBe(n(`const s = { textDecoration: "h_textDecoration_underline" };`));
  });

  test("add with CssProp argument composes inline as spread", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const base = getBase(); const sizeStyles = getSize(); const s = Css.df.add(base).add(sizeStyles).black.$;`,
        )!,
      ),
    ).toBe(
      n(`
        const base = getBase();
        const sizeStyles = getSize();
        const s = { display: "df", ...base, ...sizeStyles, color: "black" };
      `),
    );
  });

  test("add with object literal emits console.error", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.add({ wordBreak: "break-word" }).$;`)!)).toBe(
      n(`
        console.error("[truss] Unsupported pattern: add(cssProp) does not accept object literals -- pass an existing CssProp expression instead (test.tsx:1)");
        const s = {};
      `),
    );
  });

  test("error preserves valid segments: Css.black.add(foo, 'value').df.$", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const foo = getProp(); const s = Css.black.add(foo, "value").df.$;`)!),
    ).toBe(
      n(`
        console.error("[truss] Unsupported pattern: add() first argument must be a string literal property name (test.tsx:1)");
        const foo = getProp();
        const s = { color: "black", display: "df" };
      `),
    );
  });

  test("add with non-string-literal property name emits console.error", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const prop = "boxShadow"; const s = Css.add(prop, "value").$;`)!),
    ).toBe(
      n(`
        console.error("[truss] Unsupported pattern: add() first argument must be a string literal property name (test.tsx:1)");
        const prop = "boxShadow";
        const s = {};
      `),
    );
  });
});

test("indirect style references via useMemo and function calls", () => {
  expect(
    n(
      transform(`
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
        `)!,
    ),
  ).toBe(
    n(`
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
    `),
  );
});

test("ternary mixing {} and style object normalizes {} to {}", () => {
  expect(
    n(
      transform(`
        import { Css } from "./Css";

        function TabsContent(props) {
          const styles = props.hideTabs ? {} : Css.pt3.$;
          return <div css={{ ...styles, ...props.contentXss }} />;
        }
      `)!,
    ),
  ).toBe(
    n(`
      import { trussProps } from "@homebound/truss/runtime";
      function TabsContent(props) {
        const styles = props.hideTabs ? {} : { paddingTop: "pt3" };
        return <div {...trussProps({ ...styles, ...props.contentXss })} />;
      }
    `),
  );
});

test("css helper returns generated CSS text", () => {
  const result = css(`import { Css } from "./Css"; const s = Css.df.$;`);
  expect(result).toContain(".df");
  expect(result).toContain("display: flex");
});

/** Transform helper — returns the rewritten JS code. */
function transform(code: string, options?: { debug?: boolean }): string | null {
  const result = transformTruss(code, "test.tsx", mapping, options);
  return result?.code ?? null;
}

/** CSS helper — returns the generated CSS text. */
function css(code: string, options?: { debug?: boolean }): string | null {
  const result = transformTruss(code, "test.tsx", mapping, options);
  return result?.css ?? null;
}

/** Normalize whitespace so we can write readable multi-line expectations. */
function n(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function lineOf(source: string, search: string): number {
  return (
    source.split("\n").findIndex(function (line) {
      return line.includes(search);
    }) + 1
  );
}
