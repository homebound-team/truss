/** @jsxImportSource @emotion/react */
import { Button } from "@material-ui/core";
import { render } from "@testing-library/react";
import { Css, Only, sm, px, Palette, Xss, Margin } from "./Css";

describe("Css", () => {
  it("can add mb", () => {
    expect(Css.mb1.$).toMatchInlineSnapshot(`
      Object {
        "marginBottom": "8px",
      }
    `);
  });

  it("works on divs", () => {
    const r = render(<div css={Css.mb1.pb2.$} />);
    expect(r.container).toMatchInlineSnapshot(`
      .emotion-0 {
        margin-bottom: 8px;
        padding-bottom: 16px;
      }

      <div>
        <div
          class="emotion-0"
        />
      </div>
    `);
  });

  it("works on MUI components", () => {
    const r = render(<Button css={Css.mb1.$}>Click</Button>);
    expect(r.container).toMatchInlineSnapshot(`
      .emotion-0 {
        margin-bottom: 8px;
      }

      <div>
        <button
          class="MuiButtonBase-root MuiButton-root MuiButton-text emotion-0"
          tabindex="0"
          type="button"
        >
          <span
            class="MuiButton-label"
          >
            Click
          </span>
          <span
            class="MuiTouchRipple-root"
          />
        </button>
      </div>
    `);
  });

  it("works on components as xstyle", () => {
    const r = render(<FooComponent name="foo" xss={Css.mb1.$} />);
    expect(r.container).toMatchInlineSnapshot(`
      .emotion-0 {
        padding-bottom: 8px;
        margin-bottom: 8px;
      }

      <div>
        <span
          class="emotion-0"
        >
          foo
        </span>
      </div>
    `);
  });

  it("can be combined with regular emotion rules", () => {
    const phoneOnly = `@media (max-width:500px)`;
    const r = render(
      <div
        css={{
          ...Css.mb1.pb2.$,
          "&:hover": { marginBottom: "16px", ...Css.pb3.$ },
          "&:focus": Css.pb4.$,
          [phoneOnly]: Css.pb3.$,
        }}
      />
    );
    expect(r.container).toMatchInlineSnapshot(`
      .emotion-0 {
        margin-bottom: 8px;
        padding-bottom: 16px;
      }

      .emotion-0:hover {
        margin-bottom: 16px;
        padding-bottom: 24px;
      }

      .emotion-0:focus {
        padding-bottom: 32px;
      }

      @media (max-width:500px) {
        .emotion-0 {
          padding-bottom: 24px;
        }
      }

      <div>
        <div
          class="emotion-0"
        />
      </div>
    `);
  });

  it("can has strongly-typed out", () => {
    const a: { marginBottom: 0 | string | undefined } = Css.mb1.$;
    expect(a.marginBottom).toEqual("8px");
  });

  it("can be limited by an xstyle", () => {
    // only these keys are allowed to style a given component
    type XStyle = Xss<"marginBottom" | "marginTop">;

    // style is like a custom component with an xstyle prop
    function style<T extends Only<XStyle, T>>(xstyle: T): void {}

    // mb1 and mb2 are both fine
    const a = Css.mb1.mt2.$;
    style(a);

    // pb1 can't be used by itself
    const b = Css.pb1.$;
    // @ts-expect-error
    style(b);

    // pb1 also can't be used if passed with mb1
    const c = Css.mb1.pb1.$;
    // @ts-expect-error
    style(c);

    // @ts-expect-error
    const d = <FooComponent xss={Css.mb1.pb1.$} name="foo" />;
    expect(d).toBeDefined();
  });

  it("uses emotion which reuses classes", () => {
    // We use p3 (all padding) then pb2 after that, so pb2 should always win.
    // And we can move mb1 either to the front or the end, and it'll be the same output.
    const r = render(
      <div css={Css.mb1.p3.pb2.$}>
        <span css={Css.p3.pb2.mb1.$} />
      </div>
    );
    expect(r.container).toMatchInlineSnapshot(`
      .emotion-0 {
        margin-bottom: 8px;
        padding-bottom: 16px;
        padding-left: 24px;
        padding-right: 24px;
        padding-top: 24px;
      }

      <div>
        <div
          class="emotion-0"
        >
          <span
            class="emotion-0"
          />
        </div>
      </div>
    `);
  });

  it("can set two properties at a time", () => {
    const a: {
      borderStyle: string | undefined;
      borderWidth: string | 0 | undefined;
    } = Css.ba.$;
    expect(a).toMatchInlineSnapshot(`
      Object {
        "borderStyle": "solid",
        "borderWidth": "1px",
      }
    `);
  });

  it("can add via properties", () => {
    const props = { marginTop: "1px", marginBottom: "1px" };
    const a: { marginTop: string; marginBottom: string } = Css.add(props).$;
    expect(a).toMatchInlineSnapshot(`
      Object {
        "marginBottom": "1px",
        "marginTop": "1px",
      }
    `);
  });

  it("can do conditional output", () => {
    let open = true;
    expect(Css.black.if(open).mb1.else.mb2.$).toMatchInlineSnapshot(`
      Object {
        "color": "#353535",
        "marginBottom": "8px",
      }
    `);

    open = false;
    expect(Css.black.if(open).mb1.else.mb2.$).toMatchInlineSnapshot(`
      Object {
        "color": "#353535",
        "marginBottom": "16px",
      }
    `);
  });

  it("can be important conditional output", () => {
    expect(Css.black.mb1.important.$).toMatchInlineSnapshot(`
      Object {
        "color": "#353535 !important",
        "marginBottom": "8px !important",
      }
    `);
  });

  it("can use generated breakpoints with emotion", () => {
    const r = render(<div css={{ ...Css.mb1.pb2.$, [sm]: Css.pb3.$ }} />);
    expect(r.container).toMatchInlineSnapshot(`
      .emotion-0 {
        margin-bottom: 8px;
        padding-bottom: 16px;
      }

      @media screen and (max-width:599px) {
        .emotion-0 {
          padding-bottom: 24px;
        }
      }

      <div>
        <div
          class="emotion-0"
        />
      </div>
    `);
  });

  it("can use generated breakpoints with if dsl", () => {
    expect(Css.pb2.white.if(sm).pb3.black.$).toMatchInlineSnapshot(`
      Object {
        "@media screen and (max-width:599px)": Object {
          "color": "#353535",
          "paddingBottom": "24px",
        },
        "color": "#fcfcfa",
        "paddingBottom": "16px",
      }
    `);
  });

  it("will not accept just random strings to if", () => {
    // @ts-expect-error
    Css.black.if("rawstring").$;
  });

  it("cannot 'else' when using `if(bp)`", () => {
    expect(() => Css.if(sm).black.else.white.$).toThrow(
      "else is not supported"
    );
  });

  it("can render with px conversion", () => {
    expect(Css.mb(px(8)).$).toMatchInlineSnapshot(`
      Object {
        "marginBottom": "8px",
      }
    `);
  });

  it("has px-specific utility methods", () => {
    expect(Css.mbPx(12).$).toMatchInlineSnapshot(`
      Object {
        "marginBottom": "12px",
      }
    `);
  });

  it("can set css variables", () => {
    expect(Css.setVars.$).toMatchInlineSnapshot(`
      Object {
        "--primary": "#000000",
      }
    `);
    expect(Css.var.$).toMatchInlineSnapshot(`
      Object {
        "color": "var(--primary)",
      }
    `);
  });

  it("has the palette", () => {
    expect(Css.fill(Palette.Black).$).toMatchInlineSnapshot(`
      Object {
        "fill": "#353535",
      }
    `);
  });

  it("can addIn with selectors", () => {
    expect(Css.addIn("& > * + *", "marginBottom", "1px").$)
      .toMatchInlineSnapshot(`
      Object {
        "& > * + *": Object {
          "marginBottom": "1px",
        },
      }
    `);
  });

  it("skips addIn if passed undefined", () => {
    expect(Css.addIn("& > * + *", undefined).$).toEqual({});
  });

  it("doesn't incorrectly infer never", () => {
    // If the string literals of white and black snuck into the the type, then this becomes never, which won't spread
    const s = { ...Css.white.else.black.$ };
    expect(s).toMatchInlineSnapshot(`
      Object {
        "color": "#fcfcfa",
      }
    `);
  });
});

type FooXss = Xss<Margin>;

type FooProps<X extends FooXss> = { name: string; xss?: X };

/** This component styles it's own padding but lets the caller define margin. */
function FooComponent<X extends Only<FooXss, X>>(props: FooProps<X>) {
  return <span css={{ ...Css.pb1.$, ...props.xss }}>{props.name}</span>;
}
