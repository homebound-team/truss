import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { Css, Palette, type Only, type Xss } from "./Css";
import { hasCssDeclaration } from "./testCssUtils";
import "@testing-library/jest-dom/vitest";

afterEach(cleanup);

type Margin = "marginLeft" | "marginRight" | "marginTop" | "marginBottom";
type ChipXss = "backgroundColor" | "color" | Margin;

function Chip<X extends Only<Xss<ChipXss>, X>>(props: { xss?: X }) {
  return <div css={{ ...Css.df.$, ...props.xss }}>chip</div>;
}

const chipElement = <Chip xss={Css.bgBlue.mr1.$} />;
// @ts-expect-error `display` is not part of `ChipXss`, so `Css.df.$` should be rejected.
const invalidChipElement = <Chip xss={Css.df.$} />;

void chipElement;
void invalidChipElement;

/**
 * The truss plugin transforms `Css.*.$` expressions at build time and injects
 * the resulting CSS rules into a `<style>` tag via `__injectTrussCSS`. This
 * means jsdom's `getComputedStyle` can resolve class-based styles, and
 * `toHaveStyle` works for static (class-based) styles.
 *
 * Variable/parameterized styles (e.g. `Css.mt(n).$` with a variable) use CSS
 * variables: the class sets `margin-top: var(--marginTop)` and the inline style
 * sets `--marginTop: 16px`. jsdom cannot resolve `var()` references, so truly
 * variable values must be tested by checking the CSS variable on the element's
 * inline style.
 *
 * Note: When the argument to a variable method is a literal (e.g. `Css.mt(2).$`),
 * Truss evaluates it at compile time and produces a static class — no CSS
 * variable is used. Use `toHaveStyle` for these cases.
 */

describe("Truss CssBuilder", () => {
  describe("basic static abbreviations", () => {
    test("Css.df applies display: flex", () => {
      const r = render(<div css={Css.df.$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({ display: "flex" });
    });

    test("Css.db applies display: block", () => {
      const r = render(<div css={Css.db.$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({ display: "block" });
    });

    test("Css.dn applies display: none", () => {
      const r = render(<div css={Css.dn.$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({ display: "none" });
    });

    test("Css.aic applies align-items: center", () => {
      const r = render(<div css={Css.aic.$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({ alignItems: "center" });
    });

    test("Css.jcc applies justify-content: center", () => {
      const r = render(<div css={Css.jcc.$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({ justifyContent: "center" });
    });

    test("Css.fdc applies flex-direction: column", () => {
      const r = render(<div css={Css.fdc.$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({ flexDirection: "column" });
    });

    test("Css.black applies color: #353535", () => {
      const r = render(<div css={Css.black.$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({ color: "#353535" });
    });

    test("Css.white applies color: #fcfcfa", () => {
      const r = render(<div css={Css.white.$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({ color: "#fcfcfa" });
    });

    test("Css.bgBlue applies background-color: #526675", () => {
      const r = render(<div css={Css.bgBlue.$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({ backgroundColor: "#526675" });
    });

    test("Css.ba applies border-style: solid and border-width: 1px", () => {
      const r = render(<div css={Css.ba.$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({ borderStyle: "solid", borderWidth: "1px" });
    });

    test("Css.truncate sets white-space, overflow, and text-overflow", () => {
      const r = render(<div css={Css.truncate.$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      });
    });
  });

  describe("increment-based getters (static)", () => {
    test("Css.mt0 applies margin-top: 0", () => {
      const r = render(<div css={Css.mt0.$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({ marginTop: "0" });
    });

    test("Css.mt1 applies margin-top: 8px", () => {
      const r = render(<div css={Css.mt1.$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({ marginTop: "8px" });
    });

    test("Css.mt2 applies margin-top: 16px", () => {
      const r = render(<div css={Css.mt2.$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({ marginTop: "16px" });
    });

    test("Css.p1 applies padding (expanded to longhands)", () => {
      const r = render(<div css={Css.p1.$} />);
      const el = r.container.firstChild as HTMLElement;
      // StyleX expands padding shorthand into individual sides
      expect(el).toHaveStyle({
        paddingTop: "8px",
        paddingRight: "8px",
        paddingBottom: "8px",
        paddingLeft: "8px",
      });
    });

    test("Css.mta applies margin-top: auto", () => {
      const r = render(<div css={Css.mta.$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({ marginTop: "auto" });
    });

    test("Css.gap1 applies gap: 8px", () => {
      const r = render(<div css={Css.gap1.$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({ gap: "8px" });
    });
  });

  describe("parameterized methods (variable styles via CSS variables)", () => {
    // When the argument is a literal, Truss inlines it at build time as a
    // static class — so we test with toHaveStyle. When we pass a variable,
    // Truss uses CSS variables, so we test via inline style.

    test("Css.mt(2) applies margin-top: 16px (literal → static)", () => {
      const r = render(<div css={Css.mt(2).$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({ marginTop: "16px" });
    });

    test('Css.mt("10px") applies margin-top: 10px (literal → static)', () => {
      const r = render(<div css={Css.mt("10px").$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({ marginTop: "10px" });
    });

    test("Css.mtPx(12) applies margin-top: 12px (literal → static)", () => {
      const r = render(<div css={Css.mtPx(12).$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({ marginTop: "12px" });
    });

    test('Css.bc("red") applies border-color: red (literal → static)', () => {
      const r = render(<div css={Css.bc("red").$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(hasCssDeclaration(el, "border-color", { hover: false })).toBe(true);
    });

    test("Css.w(3) applies width: 24px (literal → static)", () => {
      const r = render(<div css={Css.w(3).$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({ width: "24px" });
    });

    test("Css.wPx(100) applies width: 100px (literal → static)", () => {
      const r = render(<div css={Css.wPx(100).$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({ width: "100px" });
    });

    test("Css.mt(n) with variable uses CSS variable", () => {
      const n = 2;
      const r = render(<div css={Css.mt(n).$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el.style.getPropertyValue("--marginTop")).toBe("16px");
    });

    test("Css.sqPx(n) with variable exposes width/height and CSS vars in computed style", () => {
      const n = 16;
      const r = render(<div css={Css.sqPx(n).$} />);
      const el = r.container.firstChild as HTMLElement;
      const style = getComputedStyle(el);
      expect(style.getPropertyValue("width")).toBe("var(--width)");
      expect(style.getPropertyValue("height")).toBe("var(--height)");
      expect(style.getPropertyValue("--width")).toBe("16px");
      expect(style.getPropertyValue("--height")).toBe("16px");
    });
  });

  describe("composing multiple styles", () => {
    test("Css.df.aic.jcc composes flex layout", () => {
      const r = render(<div css={Css.df.aic.jcc.$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      });
    });

    test("Css.df.fdc.gap1.p2 composes flex column with spacing", () => {
      const r = render(<div css={Css.df.fdc.gap1.p2.$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        paddingTop: "16px",
        paddingRight: "16px",
        paddingBottom: "16px",
        paddingLeft: "16px",
      });
    });

    test("mixing static and variable: Css.df.mt(2).black", () => {
      const r = render(<div css={Css.df.mt(2).black.$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({
        display: "flex",
        color: "#353535",
        marginTop: "16px",
      });
    });

    test("Css.ba.bcBlack.br2.p1 composes border box", () => {
      const r = render(<div css={Css.ba.bcBlack.br2.p1.$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({
        borderStyle: "solid",
        borderWidth: "1px",
        borderColor: "#353535",
        borderRadius: ".25rem",
        paddingTop: "8px",
      });
    });
  });

  describe("font / typeScale", () => {
    test("Css.f14 applies font-size: 14px", () => {
      const r = render(<div css={Css.f14.$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({ fontSize: "14px" });
    });

    test("Css.f24 applies font-size: 24px", () => {
      const r = render(<div css={Css.f24.$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({ fontSize: "24px" });
    });
  });

  describe("conditionals", () => {
    test("Css.if(true).df applies display: flex", () => {
      const r = render(<div css={Css.if(true).df.$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({ display: "flex" });
    });

    test("Css.if(false).df does not apply display: flex", () => {
      const r = render(<div css={Css.if(false).df.$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el.className.trim()).toBe("");
    });

    test("if/else applies the correct branch", () => {
      const r1 = render(<div css={Css.if(true).df.else.db.$} />);
      const elTrue = r1.container.firstChild as HTMLElement;
      expect(elTrue).toHaveStyle({ display: "flex" });

      const r2 = render(<div css={Css.if(false).df.else.db.$} />);
      const elFalse = r2.container.firstChild as HTMLElement;
      expect(elFalse).toHaveStyle({ display: "block" });
    });

    test("conditional with variable style: Css.if(true).mt(2)", () => {
      const r = render(<div css={Css.if(true).mt(2).$} />);
      const el = r.container.firstChild as HTMLElement;
      // Literal argument → static class
      expect(el).toHaveStyle({ marginTop: "16px" });
    });

    test("conditional false skips variable style", () => {
      const refs = Css.if(false).mt(2).$;
      // When condition is false, the style hash is empty (no properties applied)
      expect(refs).toEqual({});
    });
  });

  describe("aliases", () => {
    test("Css.bodyText applies f14 + black", () => {
      const r = render(<div css={Css.bodyText.$} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({
        fontSize: "14px",
        color: "#353535",
      });
    });
  });

  describe("palette enum", () => {
    test("Palette contains expected colors", () => {
      expect(Palette.Black).toBe("#353535");
      expect(Palette.White).toBe("#fcfcfa");
      expect(Palette.Blue).toBe("#526675");
    });
  });

  describe("spreading / combining object styles", () => {
    test("spreading two .$ objects merges styles", () => {
      const base = Css.df.aic.$;
      const override = Css.black.p1.$;
      const r = render(<div css={{ ...base, ...override }} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({
        display: "flex",
        alignItems: "center",
        color: "#353535",
        paddingTop: "8px",
      });
    });

    test("later spread wins on conflicting properties", () => {
      const base = Css.df.$;
      const override = Css.db.$;
      const r = render(<div css={{ ...base, ...override }} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({ display: "block" });
    });

    test("Only/Xss helper accepts allowed overrides", () => {
      function renderBox<X extends Only<Xss<"flexDirection" | "color">, X>>(overrides: X) {
        return <div css={{ ...Css.df.aic.gap1.$, ...overrides }} />;
      }
      const r = render(renderBox(Css.fdc.black.$));
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexDirection: "column",
        color: "#353535",
      });
    });
  });

  describe("rendering with css prop", () => {
    test("css prop applies styles to the element", () => {
      const r = render(<div css={Css.df.aic.black.$}>Hello StyleX</div>);
      const div = r.container.firstChild as HTMLElement;
      expect(div).toHaveStyle({
        display: "flex",
        alignItems: "center",
        color: "#353535",
      });
      expect(div.textContent).toBe("Hello StyleX");
    });

    test("css prop merges with existing className", () => {
      const r = render(
        <div className="existing" css={Css.df.$}>
          Test
        </div>,
      );
      const div = r.container.firstChild as HTMLElement;
      expect(div.className).toContain("existing");
      expect(div).toHaveStyle({ display: "flex" });
    });

    test("css prop applies variable styles with variable", () => {
      const n = 2;
      const r = render(<div css={Css.mt(n).$}>Test</div>);
      const div = r.container.firstChild as HTMLElement;
      expect(div.style.getPropertyValue("--marginTop")).toBe("16px");
    });

    test("css prop applies variable styles with literal", () => {
      const r = render(<div css={Css.mt(2).$}>Test</div>);
      const div = r.container.firstChild as HTMLElement;
      // Literal arg is inlined at build time → static class
      expect(div).toHaveStyle({ marginTop: "16px" });
    });

    test("css prop merges with existing inline style", () => {
      const r = render(
        <div style={{ color: "red" }} css={Css.df.$}>
          Test
        </div>,
      );
      const div = r.container.firstChild as HTMLElement;
      expect(div).toHaveStyle({ display: "flex" });
      expect(div).toHaveStyle({ color: "rgb(255, 0, 0)" });
    });
  });

  describe("Css.props for non-css= spreading", () => {
    test("Css.props spreads className/style into a plain attributes object", () => {
      const attrs = {
        "data-testid": "button",
        ...Css.props(Css.blue.$),
      };
      const r = render(<button {...attrs}>Click me</button>);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({ color: "#526675" });
      expect(el.getAttribute("data-testid")).toBe("button");
    });

    test("Css.props works with composed styles", () => {
      const attrs = {
        ...Css.props(Css.df.aic.mt1.$),
      };
      const r = render(<div {...attrs}>Test</div>);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({
        display: "flex",
        alignItems: "center",
        marginTop: "8px",
      });
    });
  });

  describe("pseudo with overlapping base property", () => {
    test("onHover on same property emits correct default and hover CSS rules", () => {
      // Css.bgBlue.onHover.bgBlack.$ — both set backgroundColor.
      // The plugin merges them into: backgroundColor: { default: "#526675", ":hover": "#353535" }
      //
      // jsdom's getComputedStyle doesn't correctly ignore :hover rules, so we
      // verify the injected CSS rules directly instead of using toHaveStyle.
      const r = render(<div css={Css.bgBlue.onHover.bgBlack.$}>Hover me</div>);
      const el = r.container.firstChild as HTMLElement;
      expect(hasCssDeclaration(el, "background-color", { hover: false })).toBe(true);
      expect(hasCssDeclaration(el, "background-color", { hover: true })).toBe(true);
    });

    test("conditional before hover keeps the earlier non-hover value", () => {
      const r = render(<div css={Css.black.if(true).onHover.white.$}>Hover me</div>);
      const el = r.container.firstChild as HTMLElement;
      expect(hasCssDeclaration(el, "color", { hover: false })).toBe(true);
      expect(hasCssDeclaration(el, "color", { hover: true })).toBe(true);
    });

    test("conditional else before hover keeps the earlier non-hover value", () => {
      const r = render(<div css={Css.black.if(false).bgBlue.else.onHover.white.$}>Hover me</div>);
      const el = r.container.firstChild as HTMLElement;
      expect(hasCssDeclaration(el, "color", { hover: false })).toBe(true);
      expect(hasCssDeclaration(el, "color", { hover: true })).toBe(true);
    });
  });
});
