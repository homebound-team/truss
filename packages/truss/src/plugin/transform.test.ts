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

  test("dynamic with literal arg: Css.mt(2).$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.mt(2).$;`)!)).toBe(
      n(`const s = { marginTop: "mt_16px" };`),
    );
  });

  test("dynamic with string literal: Css.mt('10px').$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.mt("10px").$;`)!)).toBe(
      n(`const s = { marginTop: "mt_10px" };`),
    );
  });

  test("dynamic with variable arg: Css.mt(x).$", () => {
    expect(n(transform(`import { Css } from "./Css"; const x = getSomeValue(); const s = Css.mt(x).$;`)!)).toBe(
      n(`
        const __maybeInc = inc => { return typeof inc === "string" ? inc : \`\${inc * 8}px\`; };
        const x = getSomeValue();
        const s = { marginTop: ["mt_dyn", { "--mt_dyn": __maybeInc(x) }] };
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
        const s = { marginTop: ["mt_dyn", { "--mt_dyn": \`\${x}px\` }] };
      `),
    );
  });

  test("delegate shorthand with multiple props appends px: Css.pxPx(x).$", () => {
    expect(n(transform(`import { Css } from "./Css"; const x = getSomeValue(); const s = Css.pxPx(x).$;`)!)).toBe(
      n(`
        const x = getSomeValue();
        const s = { paddingLeft: ["px_dyn", { "--px_dyn": \`\${x}px\` }], paddingRight: ["px_dyn", { "--px_dyn": \`\${x}px\` }] };
      `),
    );
  });

  test("delegate shorthand with multiple props supports sqPx: Css.sqPx(x).$", () => {
    expect(n(transform(`import { Css } from "./Css"; const x = getSomeValue(); const s = Css.sqPx(x).$;`)!)).toBe(
      n(`
        const x = getSomeValue();
        const s = { height: ["sq_dyn", { "--sq_dyn": \`\${x}px\` }], width: ["sq_dyn", { "--sq_dyn": \`\${x}px\` }] };
      `),
    );
  });

  test("non-incremented dynamic: Css.bc('red').$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.bc("red").$;`)!)).toBe(
      n(`const s = { borderColor: "bc_red" };`),
    );
  });

  test("non-incremented dynamic with variable: Css.bc(color).$", () => {
    expect(n(transform(`import { Css } from "./Css"; const color = getColor(); const s = Css.bc(color).$;`)!)).toBe(
      n(`
        const color = getColor();
        const s = { borderColor: ["bc_dyn", { "--bc_dyn": color }] };
      `),
    );
  });

  test("dynamic method keeps extra defs: Css.lineClamp(lines).$", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const lines = getLineCount(); const s = Css.lineClamp(lines).$;`)!),
    ).toBe(
      n(`
        const lines = getLineCount();
        const s = {
          WebkitLineClamp: ["lineClamp_dyn", { "--lineClamp_dyn": lines }],
          overflow: "lineClamp_overflow",
          display: "lineClamp_display",
          WebkitBoxOrient: "lineClamp_WebkitBoxOrient",
          textOverflow: "lineClamp_textOverflow"
        };
      `),
    );
  });

  test("dynamic literal keeps extra defs: Css.lineClamp('3').$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.lineClamp("3").$;`)!)).toBe(
      n(`
        const s = {
          WebkitLineClamp: "lineClamp_3_WebkitLineClamp",
          overflow: "lineClamp_3_overflow",
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
          f10: { fontSize: "f10_fontSize", fontWeight: "f10_fontWeight" }
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
          f10: { fontSize: "f10_fontSize", fontWeight: "f10_fontWeight" }
        };
        const __typography__sm = {
          f24: { fontSize: "f24_sm" },
          f18: { fontSize: "f18_sm" },
          f16: { fontSize: "f16_sm" },
          f14: { fontSize: "f14_sm" },
          f12: { fontSize: "f12_sm" },
          f10: { fontSize: "f10_fontSize_sm", fontWeight: "f10_fontWeight_sm" }
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
      n(`const s = { borderStyle: "ba_borderStyle", borderWidth: "ba_borderWidth" };`),
    );
  });

  test("mixed static and dynamic: Css.df.mt(2).black.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.df.mt(2).black.$;`)!)).toBe(
      n(`const s = { display: "df", marginTop: "mt_16px", color: "black" };`),
    );
  });

  test("onHover pseudo: Css.black.onHover.blue.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.black.onHover.blue.$;`)!)).toBe(
      n(`const s = { color: "black blue_h" };`),
    );
  });

  test("onHover with multi-property: Css.onHover.ba.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.onHover.ba.$;`)!)).toBe(
      n(`const s = { borderStyle: "ba_borderStyle_h", borderWidth: "ba_borderWidth_h" };`),
    );
  });

  test("onFocus pseudo: Css.onFocus.blue.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.onFocus.blue.$;`)!)).toBe(
      n(`const s = { color: "blue_f" };`),
    );
  });

  test("onHover with dynamic literal: Css.onHover.bc('red').$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.onHover.bc("red").$;`)!)).toBe(
      n(`const s = { borderColor: "bc_red_h" };`),
    );
  });

  test("onHover with variable dynamic: Css.onHover.bc(color).$", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const color = getColor(); const s = Css.onHover.bc(color).$;`)!),
    ).toBe(
      n(`
        const color = getColor();
        const s = { borderColor: ["bc_dyn_h", { "--bc_dyn_h": color }] };
      `),
    );
  });

  test("container query pseudo: Css.ifContainer({ gt, lt }).gc('span 2').$", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const s = Css.ifContainer({ gt: 600, lt: 960 }).gc("span 2").$;`)!),
    ).toBe(n(`const s = { gridColumn: "gc_span_2_mq" };`));
  });

  test("container query merges overlapping property", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const s = Css.black.ifContainer({ gt: 600, lt: 960 }).blue.$;`)!),
    ).toBe(n(`const s = { color: "black blue_mq" };`));
  });

  test("container query with named container", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const s = Css.ifContainer({ name: "grid", gt: 600, lt: 960 }).blue.$;`,
        )!,
      ),
    ).toBe(n(`const s = { color: "blue_mq" };`));
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

  test("spread pattern: css={[...Css.df.$, ...xss]}", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; function Box({ xss }) { return <div css={[...Css.df.$, ...xss]} />; }`,
        )!,
      ),
    ).toBe(
      n(`
        import { trussProps } from "@homebound/truss/runtime";
        function Box({ xss }) { return <div {...trussProps([...{ display: "df" }, ...xss])} />; }
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
            ...(!compound ? { borderStyle: "ba_borderStyle", borderWidth: "ba_borderWidth" } : {})
          },
          hover: { backgroundColor: "bgBlue" }
        };
        const el = <div {...trussProps({ ...styles.wrapper, ...(isHovered ? styles.hover : {}) })} />;
      `),
    );
  });

  test("Css.spread legacy helper is erased and inner expression stays as-is", () => {
    expect(
      n(
        transform(`
          import { Css } from "./Css";

          function Button(props) {
            const { active, isHovered } = props;
            const baseStyles = Css.spread({
              ...Css.df.aic.$,
            });
            const activeStyles = Css.spread({
              ...Css.black.$,
            });
            const hoverStyles = Css.spread({
              ...Css.blue.$,
            });

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

  test("inline css object supports nested object spread branch", () => {
    expect(
      n(
        transform(`
          import { Css } from "./Css";

          const el = <div css={{
            ...Css.df.aic.oa.wsnw.gap1.$,
            ...(includeBottomBorder ? { ...Css.bb.black.$ } : {}),
          }} />;
        `)!,
      ),
    ).toBe(
      n(`
        import { trussProps } from "@homebound/truss/runtime";
        const el = <div {...trussProps({
          ...{ display: "df", alignItems: "aic", overflow: "oa", whiteSpace: "wsnw", gap: "gap1" },
          ...(includeBottomBorder ? { ...{ borderBottomStyle: "bb_borderBottomStyle", borderBottomWidth: "bb_borderBottomWidth", color: "black" } } : {})
        })} />;
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

  test("style object variable named css can be spread inside css prop object", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const css = Css.df.aic.$; const el = <div css={{ ...css }} />;`)!),
    ).toBe(
      n(`
        import { trussProps } from "@homebound/truss/runtime";
        const css = { display: "df", alignItems: "aic" };
        const el = <div {...trussProps({ ...css })} />;
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
        import { trussProps, mergeProps } from "@homebound/truss/runtime";
        export const headerRenderFn =
          () =>
          (key, css, content, classNames) => {
            return <div key={key} {...mergeProps(classNames, undefined, { ...css })}><span {...trussProps({ color: "blue" })}>{content}</span></div>;
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
        import { trussProps } from "@homebound/truss/runtime";
        function Example() {
          return <div inputProps={{
            ...mergeProps(inputProps, { "aria-invalid": Boolean(errorMsg), onInput: () => state.open() })
          }}><span {...trussProps({ display: "df" })} /></div>;
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
        import { trussProps } from "@homebound/truss/runtime";
        function Box({ cssProp }) { return <div {...trussProps({ ...cssProp, ...{ display: "df" } })} />; }
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
        import { trussProps } from "@homebound/truss/runtime";
        const el = <div {...trussProps({ ...importedStyles, ...{ color: "blue" } })} />;
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
        import { trussProps } from "@homebound/truss/runtime";
        function Box(props) {
          const { xss } = props;
          return <div {...trussProps({ ...xss, ...{ color: "blue" } })} />;
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
        import { mergeProps } from "@homebound/truss/runtime";
        function Example(props) {
          const { multiline, wrap, xss, BorderHoverChild } = props;
          const fieldStyles = {
            inputWrapperReadOnly: { display: "df" }
          };
          return <div {...mergeProps(BorderHoverChild, undefined, {
            ...fieldStyles.inputWrapperReadOnly,
            ...(multiline ? { flexDirection: "fdc", alignItems: "aifs", gap: "gap2" } : { ...(wrap === false ? { whiteSpace: "truncate_whiteSpace", overflow: "truncate_overflow", textOverflow: "truncate_textOverflow" } : {}) }),
            ...xss
          })} />;
        }
      `),
    );
  });

  test("css prop object with only intermediate style-object spreads is lowered", () => {
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
        import { mergeProps } from "@homebound/truss/runtime";
        function MyComponent({ disabled, someConst }) {
          const styles = {
            wrapper: {
              ...{ display: "df", alignItems: "aic", borderStyle: "ba_borderStyle", borderWidth: "ba_borderWidth" },
              ...(disabled ? { color: "black" } : {})
            },
            hover: { backgroundColor: "bgBlue" }
          };
          return <div {...mergeProps(someConst, undefined, { ...styles.wrapper, ...(disabled ? styles.hover : {}) })}>Hello</div>;
        }
      `),
    );
  });

  test("css prop object with intermediate style-object spreads using && is lowered", () => {
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
        import { trussProps } from "@homebound/truss/runtime";
        function MyComponent({ borderOnHover, compound, isHovered }) {
          const fieldStyles = {
            inputWrapper: {
              ...{ display: "df", alignItems: "aic", borderStyle: "ba_borderStyle", borderWidth: "ba_borderWidth" },
              ...(!compound ? { borderRadius: "br4" } : {}),
              ...(borderOnHover && { color: "black" }),
              ...(isHovered && { color: "blue" })
            }
          };
          return <div {...trussProps({ ...fieldStyles.inputWrapper })} />;
        }
      `),
    );
  });

  test("css prop object with chained && style-object spreads is lowered", () => {
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
        import { trussProps } from "@homebound/truss/runtime";
        function MyComponent({ contrast, inputStylePalette }) {
          const fieldStyles = {
            input: {
              ...{ width: "w100", minWidth: "mw0", outline: "outline0", flexGrow: "fg1" },
              ...(contrast && !inputStylePalette && { backgroundColor: "bgBlue_selection" })
            }
          };
          return <div {...trussProps({ ...fieldStyles.input })} />;
        }
      `),
    );
  });

  test("css prop object with style-object spreads using || is lowered", () => {
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
        import { trussProps } from "@homebound/truss/runtime";
        const base = { display: "df" };
        const hover = { color: "blue" };
        const el = <div {...trussProps({ ...(hover || base) })} />;
      `),
    );
  });

  test("css prop object with style-object spreads using ?? is lowered", () => {
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
        import { trussProps } from "@homebound/truss/runtime";
        const base = { display: "df" };
        const hover = { color: "blue" };
        const el = <div {...trussProps({ ...(hover ?? base) })} />;
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
        import { trussProps } from "@homebound/truss/runtime";
        const key = "wrapper";
        const styles = { wrapper: { display: "df", alignItems: "aic" } };
        const el = <div {...trussProps({ ...styles[key] })} />;
      `),
    );
  });

  test("css prop object with function-returned style-object spread is lowered", () => {
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
        import { trussProps } from "@homebound/truss/runtime";
        function getStyles() {
          return { display: "df", alignItems: "aic" };
        }
        const el = <div {...trussProps({ ...getStyles() })} />;
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
        import { trussProps } from "@homebound/truss/runtime";
        function chipBaseStyles(compact) {
          return compact ? { display: "df" } : { alignItems: "aic" };
        }
        function Chip(props) {
          const { xss, compact } = props;
          const type = "primary";
          const typeStyles = { primary: { color: "blue" } };
          const styles = useMemo(() => ({ ...chipBaseStyles(compact), ...typeStyles[type], ...xss }), [type, xss, compact]);
          return <span {...trussProps(styles)} />;
        }
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

  test("style-object member in css prop is lowered to trussProps", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const styles = { wrapper: Css.df.aic.$ }; const el = <div css={styles.wrapper} />;`,
        )!,
      ),
    ).toBe(
      n(`
        import { trussProps } from "@homebound/truss/runtime";
        const styles = { wrapper: { display: "df", alignItems: "aic" } };
        const el = <div {...trussProps(styles.wrapper)} />;
      `),
    );
  });

  test("conditional style-object expression in css prop is lowered to trussProps", () => {
    expect(
      n(
        transform(
          `import { Css } from "./Css"; const base = Css.df.$; const active = Css.black.$; const el = <div css={isActive ? active : base} />;`,
        )!,
      ),
    ).toBe(
      n(`
        import { trussProps } from "@homebound/truss/runtime";
        const base = { display: "df" };
        const active = { color: "black" };
        const el = <div {...trussProps(isActive ? active : base)} />;
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
            baseStyles: { display: "df", alignItems: "aic", height: "h_32px", paddingLeft: "px1_paddingLeft", paddingRight: "px1_paddingRight", outline: "outline0", color: "black", cursor: "cursorPointer" },
            activeStyles: { ...{ color: "black", borderRadius: "br4" }, ...borderBottomStyles },
            disabledStyles: { color: "blue", cursor: "cursorNotAllowed" },
            focusRingStyles: { borderStyle: "ba_borderStyle", borderWidth: "ba_borderWidth" },
            hoverStyles: { ...{ color: "blue" }, ...borderBottomStyles },
            activeHoverStyles: { ...{ borderStyle: "ba_borderStyle", borderWidth: "ba_borderWidth", color: "black" }, ...borderBottomStyles }
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
          paddingTop: "p1_paddingTop",
          paddingBottom: "p1_paddingBottom",
          paddingRight: "p1_paddingRight",
          paddingLeft: "p1_paddingLeft",
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

  test("static increment getters: Css.mt0.mt1.p1.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.mt0.mt1.p1.$;`)!)).toBe(
      n(`
        const s = {
          marginTop: "mt0 mt1",
          paddingTop: "p1_paddingTop",
          paddingBottom: "p1_paddingBottom",
          paddingRight: "p1_paddingRight",
          paddingLeft: "p1_paddingLeft"
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

  test("className merging: css + dynamic className expression", () => {
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
        const s = { marginTop: ["mt_dyn", { "--mt_dyn": __maybeInc_1(x) }] };
      `),
    );
  });

  test("onHover on same property merges base+pseudo into single entry", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.bgBlue.onHover.bgBlack.$;`)!)).toBe(
      n(`const s = { backgroundColor: "bgBlue bgBlack_h" };`),
    );
  });

  test("onHover merge: non-overlapping properties kept separate", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.df.onHover.blue.$;`)!)).toBe(
      n(`const s = { display: "df", color: "blue_h" };`),
    );
  });

  // ── Marker tests (Phase 2 deferred) ─────────────────────────────────

  test.skip("Css.marker.$ emits stylex.defaultMarker()", () => {});

  test.skip("Css.marker.$ in JSX css prop emits stylex.props(stylex.defaultMarker())", () => {});

  test.skip("Css.marker.df.$ combines marker with styles", () => {});

  test.skip("Css.markerOf(row).$ passes marker variable through", () => {});

  test.skip("marker and when('ancestor') in same file use same user-defined marker variable", () => {});

  // ── when() generic API tests (Phase 2 deferred) ──────────────────────

  test.skip("Css.when('ancestor', ':hover').blue.$", () => {});

  test.skip("Css.when('ancestor', marker, ':hover').blue.$", () => {});

  test.skip("Css.when('descendant', ':focus').blue.$", () => {});

  test.skip("Css.when('siblingAfter', ':hover').blue.$", () => {});

  test.skip("Css.when('anySibling', marker, ':hover').blue.$", () => {});

  test.skip("Css.when with invalid relationship emits console.error", () => {});

  test.skip("Css.when with non-literal relationship emits console.error", () => {});

  test.skip("markerOf accepts a variable argument", () => {});

  // ── Breakpoint / media query tests ──────────────────────────────────

  test("if(mediaQuery) as pseudo: Css.if('@media (max-width: 599px)').df.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.if("@media (max-width: 599px)").df.$;`)!)).toBe(
      n(`const s = { display: "df_sm" };`),
    );
  });

  test("if(mediaQuery) merges with base: Css.bgBlue.if('@media (max-width: 599px)').bgBlack.$", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const s = Css.bgBlue.if("@media (max-width: 599px)").bgBlack.$;`)!),
    ).toBe(n(`const s = { backgroundColor: "bgBlue bgBlack_sm" };`));
  });

  test("if(Breakpoints.sm) works like if('@media...')", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.if("@media (min-width: 960px)").df.$;`)!)).toBe(
      n(`const s = { display: "df_lg" };`),
    );
  });

  test("breakpoint + pseudo combination: Css.ifSm.onHover.blue.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.ifSm.onHover.blue.$;`)!)).toBe(
      n(`const s = { color: "blue_sm_h" };`),
    );
  });

  test("base + breakpoint + pseudo: Css.black.ifSm.onHover.blue.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.black.ifSm.onHover.blue.$;`)!)).toBe(
      n(`const s = { color: "black blue_sm_h" };`),
    );
  });

  test("base + breakpoint color + breakpoint+pseudo color: Css.black.ifSm.white.onHover.blue.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.black.ifSm.white.onHover.blue.$;`)!)).toBe(
      n(`const s = { color: "black white_sm blue_sm_h" };`),
    );
  });

  test("breakpoint only: Css.ifSm.df.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.ifSm.df.$;`)!)).toBe(
      n(`const s = { display: "df_sm" };`),
    );
  });

  test("breakpoint after base style: Css.df.ifMd.blue.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.df.ifMd.blue.$;`)!)).toBe(
      n(`const s = { display: "df", color: "blue_md" };`),
    );
  });

  test("breakpoint merges overlapping property: Css.bgBlue.ifSm.bgBlack.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.bgBlue.ifSm.bgBlack.$;`)!)).toBe(
      n(`const s = { backgroundColor: "bgBlue bgBlack_sm" };`),
    );
  });

  test("breakpoint with large: Css.ifLg.df.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.ifLg.df.$;`)!)).toBe(
      n(`const s = { display: "df_lg" };`),
    );
  });

  test("breakpoint with combination: Css.ifSmOrMd.blue.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.ifSmOrMd.blue.$;`)!)).toBe(
      n(`const s = { color: "blue_smormd" };`),
    );
  });

  test("breakpoint with dynamic literal: Css.ifSm.mt(2).$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.ifSm.mt(2).$;`)!)).toBe(
      n(`const s = { marginTop: "mt_16px_sm" };`),
    );
  });

  test("breakpoint with multi-property: Css.ifSm.ba.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.ifSm.ba.$;`)!)).toBe(
      n(`const s = { borderStyle: "ba_borderStyle_sm", borderWidth: "ba_borderWidth_sm" };`),
    );
  });

  test("breakpoint in JSX: css={Css.ifSm.df.$}", () => {
    expect(n(transform(`import { Css } from "./Css"; const el = <div css={Css.ifSm.df.$} />;`)!)).toBe(
      n(`
        import { trussProps } from "@homebound/truss/runtime";
        const el = <div {...trussProps({ display: "df_sm" })} />;
      `),
    );
  });

  // ── Pseudo-element tests ─────────────────────────────────────────────

  test("element('::placeholder').blue.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.element("::placeholder").blue.$;`)!)).toBe(
      n(`const s = { color: "blue_placeholder" };`),
    );
  });

  test("element('::selection') with static styles", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.element("::selection").bgBlue.white.$;`)!)).toBe(
      n(`const s = { backgroundColor: "bgBlue_selection", color: "white_selection" };`),
    );
  });

  test("element with dynamic literal: element('::placeholder').bc('red').$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.element("::placeholder").bc("red").$;`)!)).toBe(
      n(`const s = { borderColor: "bc_red_placeholder" };`),
    );
  });

  test("element + onHover: Css.element('::placeholder').onHover.blue.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.element("::placeholder").onHover.blue.$;`)!)).toBe(
      n(`const s = { color: "blue_placeholder_h" };`),
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
      n(`const s = { boxShadow: "add_boxShadow_0_0_0_1px_blue" };`),
    );
  });

  test("add with numeric literal value: Css.add('animationDelay', '300ms').$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.add("animationDelay", "300ms").$;`)!)).toBe(
      n(`const s = { animationDelay: "add_animationDelay_300ms" };`),
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
        const s = { boxShadow: ["add_boxShadow_dyn", { "--add_boxShadow_dyn": shadow }] };
      `),
    );
  });

  test("add mixed with other chain segments: Css.df.add('wordBreak', 'break-word').black.$", () => {
    expect(n(transform(`import { Css } from "./Css"; const s = Css.df.add("wordBreak", "break-word").black.$;`)!)).toBe(
      n(`const s = { display: "df", wordBreak: "add_wordBreak_break_word", color: "black" };`),
    );
  });

  test("add with pseudo: Css.onHover.add('textDecoration', 'underline').$", () => {
    expect(
      n(transform(`import { Css } from "./Css"; const s = Css.onHover.add("textDecoration", "underline").$;`)!),
    ).toBe(n(`const s = { textDecoration: "add_textDecoration_underline_h" };`));
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

test("Css.spread with indirect style references via useMemo and function calls", () => {
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
              css: Css.spread({
                ...styles.baseStyles,
                ...(props.active && styles.activeStyles),
              }),
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
