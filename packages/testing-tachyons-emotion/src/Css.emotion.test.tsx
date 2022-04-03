/** @jsxImportSource @emotion/react */
import { render } from "@testing-library/react";
import {
  Css,
  Margin,
  Only,
  print,
  sm,
  Xss,
} from "@homebound/truss-testing-tachyons";

describe("Css.emotion", () => {
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
    const r = render(
      <div css={{ ...Css.mb1.pb2.$, [sm]: Css.pb3.$, [print]: Css.m0.$ }} />
    );
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

      @media print {
        .emotion-0 {
          margin-bottom: 0px;
          margin-left: 0px;
          margin-right: 0px;
          margin-top: 0px;
        }
      }

      <div>
        <div
          class="emotion-0"
        />
      </div>
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

  it("lineClamp outputs prefixes", () => {
    const r = render(<div css={Css.lineClamp1.$} />);
    expect(r.container).toMatchInlineSnapshot(`
      .emotion-0 {
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 1;
        display: -webkit-box;
        overflow: hidden;
        text-overflow: ellipsis;
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
