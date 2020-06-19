/** @jsx jsx */
import { Button } from "@material-ui/core";
import { jsx } from "@emotion/core";
import { render } from "@testing-library/react";
import { Css, Only, Properties } from "./Css";

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
    const r = render(<FooComponent name="foo" xstyle={Css.mb1.$} />);
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
    const a: { marginBottom: string } = Css.mb1.$;
    expect(a.marginBottom).toEqual("8px");
  });

  it("can be limited by an xstyle", () => {
    // only these keys are allowed to style a given component
    type XStyle = Pick<Properties, "marginBottom" | "marginTop">;

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
    const d = <FooComponent xstyle={Css.mb1.pb1.$} name="foo" />;
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
    const a: { borderStyle: string; borderWidth: string } = Css.ba.$;
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
});

type Margins =
  | "margin"
  | "marginTop"
  | "marginLeft"
  | "marginBottom"
  | "marginRight";

type FooXStyle = Pick<Properties, Margins>;

type FooProps<X extends FooXStyle> = { name: string; xstyle: X };

/** This component styles it's own padding but lets the caller define margin. */
function FooComponent<X extends Only<FooXStyle, X>>(props: FooProps<X>) {
  return <span css={{ ...Css.pb1.$, ...props.xstyle }}>{props.name}</span>;
}
