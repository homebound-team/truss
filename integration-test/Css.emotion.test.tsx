/** @jsx jsx */
import { jsx } from "@emotion/core";
import { render } from "@testing-library/react";
import { Css, Only, Properties, sm } from "./Css";

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

type Margins =
  | "margin"
  | "marginTop"
  | "marginLeft"
  | "marginBottom"
  | "marginRight";

type FooXss = Pick<Properties, Margins>;

type FooProps<X extends FooXss> = { name: string; xss?: X };

/** This component styles it's own padding but lets the caller define margin. */
function FooComponent<X extends Only<FooXss, X>>(props: FooProps<X>) {
  return <span css={{ ...Css.pb1.$, ...props.xss }}>{props.name}</span>;
}
