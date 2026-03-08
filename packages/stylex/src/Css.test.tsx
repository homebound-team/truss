import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { Css, Palette, type CssProp } from "./Css";
import "@testing-library/jest-dom/vitest";

afterEach(() => {
  cleanup();
});

/**
 * With `runtimeInjection: true` in the vitest config, the StyleX unplugin
 * compiles `stylex.create()` at build time AND inserts runtime code that injects
 * the resulting CSS rules into `<style>` tags. This means jsdom's
 * `getComputedStyle` can resolve class-based styles, and `toHaveStyle` works
 * for static (class-based) styles.
 *
 * Dynamic/parameterized styles (e.g. `mt(2)`) use CSS variables: the class sets
 * `margin-top: var(--x-marginTop)` and the inline style sets `--x-marginTop: 16px`.
 * jsdom cannot resolve `var()` references, so dynamic values must be tested by
 * checking the CSS variable on the element's inline style.
 */

describe("StyleX CssBuilder", () => {
  describe("basic static abbreviations", () => {
    test("Css.df applies display: flex", () => {
      const el = renderWithCss(Css.df);
      expect(el).toHaveStyle({ display: "flex" });
    });

    test("Css.db applies display: block", () => {
      const el = renderWithCss(Css.db);
      expect(el).toHaveStyle({ display: "block" });
    });

    test("Css.dn applies display: none", () => {
      const el = renderWithCss(Css.dn);
      expect(el).toHaveStyle({ display: "none" });
    });

    test("Css.aic applies align-items: center", () => {
      const el = renderWithCss(Css.aic);
      expect(el).toHaveStyle({ alignItems: "center" });
    });

    test("Css.jcc applies justify-content: center", () => {
      const el = renderWithCss(Css.jcc);
      expect(el).toHaveStyle({ justifyContent: "center" });
    });

    test("Css.fdc applies flex-direction: column", () => {
      const el = renderWithCss(Css.fdc);
      expect(el).toHaveStyle({ flexDirection: "column" });
    });

    test("Css.black applies color: #353535", () => {
      const el = renderWithCss(Css.black);
      expect(el).toHaveStyle({ color: "#353535" });
    });

    test("Css.white applies color: #fcfcfa", () => {
      const el = renderWithCss(Css.white);
      expect(el).toHaveStyle({ color: "#fcfcfa" });
    });

    test("Css.bgBlue applies background-color: #526675", () => {
      const el = renderWithCss(Css.bgBlue);
      expect(el).toHaveStyle({ backgroundColor: "#526675" });
    });

    test("Css.ba applies border-style: solid and border-width: 1px", () => {
      const el = renderWithCss(Css.ba);
      expect(el).toHaveStyle({ borderStyle: "solid", borderWidth: "1px" });
    });

    test("Css.truncate sets white-space, overflow, and text-overflow", () => {
      const el = renderWithCss(Css.truncate);
      expect(el).toHaveStyle({
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      });
    });
  });

  describe("increment-based getters (static)", () => {
    test("Css.mt0 applies margin-top: 0", () => {
      const el = renderWithCss(Css.mt0);
      expect(el).toHaveStyle({ marginTop: "0" });
    });

    test("Css.mt1 applies margin-top: 8px", () => {
      const el = renderWithCss(Css.mt1);
      expect(el).toHaveStyle({ marginTop: "8px" });
    });

    test("Css.mt2 applies margin-top: 16px", () => {
      const el = renderWithCss(Css.mt2);
      expect(el).toHaveStyle({ marginTop: "16px" });
    });

    test("Css.p1 applies padding (expanded to longhands)", () => {
      const el = renderWithCss(Css.p1);
      // StyleX expands padding shorthand into individual sides
      expect(el).toHaveStyle({
        paddingTop: "8px",
        paddingRight: "8px",
        paddingBottom: "8px",
        paddingLeft: "8px",
      });
    });

    test("Css.mta applies margin-top: auto", () => {
      const el = renderWithCss(Css.mta);
      expect(el).toHaveStyle({ marginTop: "auto" });
    });

    test("Css.gap1 applies gap: 8px", () => {
      const el = renderWithCss(Css.gap1);
      expect(el).toHaveStyle({ gap: "8px" });
    });
  });

  describe("parameterized methods (dynamic styles via CSS variables)", () => {
    // Dynamic styles use CSS variables: the class sets e.g. `margin-top: var(--x-marginTop)`
    // and the inline style sets `--x-marginTop: 16px`. jsdom cannot resolve var() references,
    // so we verify the CSS variable value on the inline style.

    test("Css.mt(2) sets --x-marginTop to 16px", () => {
      const el = renderWithCss(Css.mt(2));
      expect(el.style.getPropertyValue("--x-marginTop")).toBe("16px");
    });

    test('Css.mt("10px") sets --x-marginTop to 10px', () => {
      const el = renderWithCss(Css.mt("10px"));
      expect(el.style.getPropertyValue("--x-marginTop")).toBe("10px");
    });

    test("Css.mtPx(12) sets --x-marginTop to 12px", () => {
      const el = renderWithCss(Css.mtPx(12));
      expect(el.style.getPropertyValue("--x-marginTop")).toBe("12px");
    });

    test('Css.bc("red") sets --x-borderColor to red', () => {
      const el = renderWithCss(Css.bc("red"));
      expect(el.style.getPropertyValue("--x-borderColor")).toBe("red");
    });

    test("Css.w(3) sets --x-width to 24px", () => {
      const el = renderWithCss(Css.w(3));
      expect(el.style.getPropertyValue("--x-width")).toBe("24px");
    });

    test("Css.wPx(100) sets --x-width to 100px", () => {
      const el = renderWithCss(Css.wPx(100));
      expect(el.style.getPropertyValue("--x-width")).toBe("100px");
    });
  });

  describe("composing multiple styles", () => {
    test("Css.df.aic.jcc composes flex layout", () => {
      const el = renderWithCss(Css.df.aic.jcc);
      expect(el).toHaveStyle({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      });
    });

    test("Css.df.fdc.gap1.p2 composes flex column with spacing", () => {
      const el = renderWithCss(Css.df.fdc.gap1.p2);
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

    test("mixing static and dynamic: Css.df.mt(2).black", () => {
      const el = renderWithCss(Css.df.mt(2).black);
      // Static parts via toHaveStyle
      expect(el).toHaveStyle({
        display: "flex",
        color: "#353535",
      });
      // Dynamic part via CSS variable
      expect(el.style.getPropertyValue("--x-marginTop")).toBe("16px");
    });

    test("Css.ba.bcBlack.br2.p1 composes border box", () => {
      const el = renderWithCss(Css.ba.bcBlack.br2.p1);
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
      const el = renderWithCss(Css.f14);
      expect(el).toHaveStyle({ fontSize: "14px" });
    });

    test("Css.f24 applies font-size: 24px", () => {
      const el = renderWithCss(Css.f24);
      expect(el).toHaveStyle({ fontSize: "24px" });
    });
  });

  describe("conditionals", () => {
    test("Css.if(true).df applies display: flex", () => {
      const el = renderWithCss(Css.if(true).df);
      expect(el).toHaveStyle({ display: "flex" });
    });

    test("Css.if(false).df does not apply display: flex", () => {
      const el = renderWithCss(Css.if(false).df);
      expect(el.className || "").toBe("");
    });

    test("if/else applies the correct branch", () => {
      const elTrue = renderWithCss(Css.if(true).df.else.db);
      expect(elTrue).toHaveStyle({ display: "flex" });

      const elFalse = renderWithCss(Css.if(false).df.else.db);
      expect(elFalse).toHaveStyle({ display: "block" });
    });

    test("conditional with dynamic style: Css.if(true).mt(2)", () => {
      const el = renderWithCss(Css.if(true).mt(2));
      expect(el.style.getPropertyValue("--x-marginTop")).toBe("16px");
    });

    test("conditional false skips dynamic style", () => {
      const refs = Css.if(false).mt(2).$;
      expect(refs).toEqual([]);
    });
  });

  describe("aliases", () => {
    test("Css.bodyText applies f14 + black", () => {
      const el = renderWithCss(Css.bodyText);
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

  describe("spreading / combining CssProp arrays", () => {
    test("spreading two CssProp arrays merges styles", () => {
      const base = Css.df.aic.$;
      const override = Css.black.p1.$;
      const r = render(<div css={[...base, ...override]} />);
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
      const r = render(<div css={[...base, ...override]} />);
      const el = r.container.firstChild as HTMLElement;
      expect(el).toHaveStyle({ display: "block" });
    });

    test("helper function accepting CssProp can receive overrides", () => {
      function renderBox(overrides: CssProp) {
        return <div css={[...Css.df.aic.gap1.$, ...overrides]} />;
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

    test("css prop applies dynamic styles", () => {
      const r = render(<div css={Css.mt(2).$}>Test</div>);
      const div = r.container.firstChild as HTMLElement;
      expect(div.style.getPropertyValue("--x-marginTop")).toBe("16px");
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
});

/** Helper: render an element using the css prop and return it. */
function renderWithCss(builder: { $: CssProp }) {
  const r = render(<div css={builder.$} />);
  return r.container.firstChild as HTMLElement;
}
