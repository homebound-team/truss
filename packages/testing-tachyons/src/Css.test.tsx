import React from "react";
import { Css, Margin, Only, Palette, px, Xss } from "./Css";

describe("Css", () => {
  it("can add mb", () => {
    expect(Css.mb1.$).toMatchInlineSnapshot(`
      {
        "marginBottom": "8px",
      }
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

  it("can set two properties at a time", () => {
    const a: {
      borderStyle: string | undefined;
      borderWidth: string | 0 | undefined;
    } = Css.ba.$;
    expect(a).toMatchInlineSnapshot(`
      {
        "borderStyle": "solid",
        "borderWidth": "1px",
      }
    `);
  });

  it("can add via properties", () => {
    const props = { marginTop: "1px", marginBottom: "1px" };
    const a: { marginTop: string; marginBottom: string } = Css.add(props).$;
    expect(a).toMatchInlineSnapshot(`
      {
        "marginBottom": "1px",
        "marginTop": "1px",
      }
    `);
  });

  it("can do conditional output", () => {
    let open = true;
    expect(Css.black.if(open).mb1.else.mb2.$).toMatchInlineSnapshot(`
      {
        "color": "#353535",
        "marginBottom": "8px",
      }
    `);

    open = false;
    expect(Css.black.if(open).mb1.else.mb2.$).toMatchInlineSnapshot(`
      {
        "color": "#353535",
        "marginBottom": "16px",
      }
    `);
  });

  it("can be important conditional output", () => {
    expect(Css.black.mb1.important.$).toMatchInlineSnapshot(`
      {
        "color": "#353535 !important",
        "marginBottom": "8px !important",
      }
    `);
  });

  it("can use generated breakpoints with if dsl", () => {
    expect(Css.pb2.white.ifSm.pb3.black.$).toMatchInlineSnapshot(`
      {
        "@media screen and (max-width:599px)": {
          "color": "#353535",
          "paddingBottom": "24px",
        },
        "color": "#fcfcfa",
        "paddingBottom": "16px",
      }
    `);
  });

  it("can use generated breakpoints with if dsl string", () => {
    expect(Css.pb2.white.if("sm").pb3.black.$).toMatchInlineSnapshot(`
      {
        "@media screen and (max-width:599px)": {
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
    expect(() => Css.ifSm.black.else.white.$).toThrow("else is not supported");
  });

  it("can render with px conversion", () => {
    expect(Css.mb(px(8)).$).toMatchInlineSnapshot(`
      {
        "marginBottom": "8px",
      }
    `);
  });

  it("has px-specific utility methods", () => {
    expect(Css.mbPx(12).$).toMatchInlineSnapshot(`
      {
        "marginBottom": "12px",
      }
    `);
  });

  it("can set css variables", () => {
    expect(Css.setVars.$).toMatchInlineSnapshot(`
      {
        "--primary": "#000000",
      }
    `);
    expect(Css.var.$).toMatchInlineSnapshot(`
      {
        "color": "var(--primary)",
      }
    `);
  });

  it("has the palette", () => {
    expect(Css.fill(Palette.Black).$).toMatchInlineSnapshot(`
      {
        "fill": "#353535",
      }
    `);
  });

  it("can addIn with selectors", () => {
    expect(Css.addIn("& > * + *", "marginBottom", "1px").$).toMatchInlineSnapshot(`
      {
        "& > * + *": {
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
      {
        "color": "#fcfcfa",
      }
    `);
  });

  it("can use breakpoints via ifs", () => {
    expect(Css.black.ifMd.blue.$).toMatchInlineSnapshot(`
      {
        "@media screen and (min-width:600px) and (max-width:959px)": {
          "color": "#526675",
        },
        "color": "#353535",
      }
    `);
  });

  it("can use hover", () => {
    expect(Css.black.onHover.blue.$).toMatchInlineSnapshot(`
      {
        ":hover": {
          "color": "#526675",
        },
        "color": "#353535",
      }
    `);
  });

  it("can use sqPx", () => {
    expect(Css.sqPx(24).$).toMatchInlineSnapshot(`
      {
        "height": "24px",
        "width": "24px",
      }
    `);
  });
});

type FooXss = Xss<Margin>;

type FooProps<X extends FooXss> = { name: string; xss?: X };

/** This component styles its own padding but lets the caller define margin. */
function FooComponent<X extends Only<FooXss, X>>(props: FooProps<X>) {
  // return <span css={{ ...Css.pb1.$, ...props.xss } as any}>{props.name}</span>;
  return <span>{props.name}</span>;
}
