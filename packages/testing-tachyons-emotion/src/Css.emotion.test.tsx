/** @jsxImportSource @emotion/react */
import { render } from "@testing-library/react";
import { Css, Margin, Only, Xss } from "@homebound/truss-testing-tachyons";
import { describe, expect, test } from "vitest";

describe("Css.emotion", () => {
  test("works on divs", () => {
    const r = render(<div css={Css.mb1.pb2.$} />);
    expect(r.container).toMatchInlineSnapshot(`
      <div>
        <div
          class="css-l7uox6"
        />
      </div>
    `);
  });

  test("works on components as xstyle", () => {
    const r = render(<FooComponent name="foo" xss={Css.mb1.$} />);
    expect(r.container).toMatchInlineSnapshot(`
      <div>
        <span
          class="css-19gol7"
        >
          foo
        </span>
      </div>
    `);
  });

  test("can be combined with regular emotion rules", () => {
    const phoneOnly = `@media (max-width:500px)`;
    const r = render(
      <div
        css={{
          ...Css.mb1.pb2.$,
          "&:hover": { marginBottom: "16px", ...Css.pb3.$ },
          "&:focus": Css.pb4.$,
          [phoneOnly]: Css.pb3.$,
        }}
      />,
    );
    expect(r.container).toMatchInlineSnapshot(`
      <div>
        <div
          class="css-1dgympk"
        />
      </div>
    `);
  });

  test("works with emotion", () => {
    // We use p3 (all padding) then pb2 after that, so pb2 should always win.
    // And we can move mb1 either to the front or the end, and it'll be the same output.
    const r = render(
      <div css={Css.mb1.p3.pb2.$}>
        <span css={Css.p3.pb2.mb1.$} />
      </div>,
    );
    expect(r.container).toMatchInlineSnapshot(`
      <div>
        <div
          class="css-1m5j0yz"
        >
          <span
            class="css-1m5j0yz"
          />
        </div>
      </div>
    `);
  });

  test("uses emotion which reuses classes", () => {
    // We use p3 (all padding) then pb2 after that, so pb2 should always win.
    // And we can move mb1 either to the front or the end, and it'll be the same output.
    const r = render(
      <div css={Css.mb1.p3.pb2.$}>
        <span css={Css.p3.pb2.mb1.$} />
      </div>,
    );
    expect(r.container).toMatchInlineSnapshot(`
      <div>
        <div
          class="css-1m5j0yz"
        >
          <span
            class="css-1m5j0yz"
          />
        </div>
      </div>
    `);
  });

  test("can be combined with other rules", () => {
    const phoneOnly = `@media (max-width:500px)`;
    const r = render(
      <div
        css={{
          ...Css.mb1.pb2.$,
          "&:hover": { marginBottom: "16px", ...Css.pb3.$ },
          "&:focus": Css.pb4.$,
          [phoneOnly]: Css.pb3.$,
        }}
      />,
    );
    expect(r.container).toMatchInlineSnapshot(`
      <div>
        <div
          class="css-1dgympk"
        />
      </div>
    `);
  });

  test("can use generated breakpoints", () => {
    const r = render(<div css={Css.mb1.pb2.ifSm.pb3.ifPrint.m0.$} />);
    expect(r.container).toMatchInlineSnapshot(`
      <div>
        <div
          class="css-3mj3q7"
        />
      </div>
    `);
  });

  test("can use generated breakpoints with emotion", () => {
    const r = render(<div css={Css.mb1.pb2.ifSm.pb3.$} />);
    expect(r.container).toMatchInlineSnapshot(`
      <div>
        <div
          class="css-172f0au"
        />
      </div>
    `);
  });

  test("lineClamp outputs prefixes", () => {
    // @ts-ignore Not sure why `Type '"revert-layer"' is not assignable to type BoxOrient` is happening
    const r = render(<div css={Css.lineClamp1.$} />);
    expect(r.container).toMatchInlineSnapshot(`
      <div>
        <div
          class="css-1kkrsiq"
        />
      </div>
    `);
  });

  test("can use onHover", () => {
    const r = render(<div css={Css.mb1.onHover.mb2.$} />);
    expect(r.container).toMatchInlineSnapshot(`
      <div>
        <div
          class="css-1nnwgsm"
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
