/* @jsx fe */
import { createSnapshot } from "jest-react-fela";
import { fe, useFela } from "react-fela";
import { Css } from "./Css";

describe("Css.fela", () => {
  it("supports css prop", () => {
    const r = createSnapshot(<span css={Css.mt1.$} />);
    expect(r).toMatchInlineSnapshot(`
      ".a {
        margin-top: 8px;
      }


      <span className=a />;
      "
    `);
  });

  it("supports useFela", () => {
    function FooComponent(props: { name: string }) {
      const { css } = useFela();
      return (
        <span className={css(Css.pb1.white.$)}>
          <span className={css(Css.pb1.black.$)}>{props.name}</span>
        </span>
      );
    }

    const r = createSnapshot(<FooComponent name="foo" />);
    expect(r).toMatchInlineSnapshot(`
      ".a {
        color: #fcfcfa;
      }
      .b {
        padding-bottom: 8px;
      }
      .c {
        color: #353535;
      }


      <span className=a b>
        <span className=c b>foo</span>
      </span>;
      "
    `);
  });

  it("supports selectors", () => {
    const r = createSnapshot(
      <span css={{ ...Css.mt1.$, ":hover": Css.mt2.$ }} />
    );
    expect(r).toMatchInlineSnapshot(`
      ".a {
        margin-top: 8px;
      }
      .b:hover {
        margin-top: 16px;
      }


      <span className=a b />;
      "
    `);
  });
});
