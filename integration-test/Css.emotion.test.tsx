/** @jsx jsx */
import { jsx } from "@emotion/core";
import { render } from "@testing-library/react";
import { Css, Margin, Only, Properties, sm, Xss } from "./Css";
import { matchers } from "jest-emotion";

expect.extend(matchers);

describe("Css.emotion", () => {
  it("works with emotion", () => {
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

  it("can be combined with other rules", () => {
    const phoneOnly = `@media (max-width:500px)`;
    const r = render(
      <div
        data-testid="div"
        css={{
          ...Css.mb1.pb2.$,
          "&:hover": { marginBottom: "16px", ...Css.pb3.$ },
          "& > div:focus": Css.pb4.$,
          "& > div + div": Css.pt4.$,
          [phoneOnly]: Css.pb3.$,
        }}
      />
    );

    // Temp to exercise toHaveStyleRule
    const div = r.getByTestId("div");
    expect(div).toHaveStyleRule("margin-bottom", "8px");
    expect(div).toHaveStyleRule("margin-bottom", "16px", { target: ":hover" });
    expect(div).toHaveStyleRule("padding-bottom", "32px", {
      target: "div:focus",
    });
    expect(div).toHaveStyleRule("padding-top", "32px", {
      target: "div",
    });

    expect(r.container).toMatchInlineSnapshot(`
      .emotion-0 {
        margin-bottom: 8px;
        padding-bottom: 16px;
      }

      .emotion-0:hover {
        margin-bottom: 16px;
        padding-bottom: 24px;
      }

      .emotion-0 > div:focus {
        padding-bottom: 32px;
      }

      .emotion-0 > div + div {
        padding-top: 32px;
      }

      @media (max-width:500px) {
        .emotion-0 {
          padding-bottom: 24px;
        }
      }

      <div>
        <div
          class="emotion-0"
          data-testid="div"
        />
      </div>
    `);
  });

  it("can use generated breakpoints", () => {
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
});

type FooXss = Xss<Margin>;

type FooProps<X extends FooXss> = { name: string; xss?: X };

/** This component styles it's own padding but lets the caller define margin. */
function FooComponent<X extends Only<FooXss, X>>(props: FooProps<X>) {
  return <span css={{ ...Css.pb1.$, ...props.xss }}>{props.name}</span>;
}
