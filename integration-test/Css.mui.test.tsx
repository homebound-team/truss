/** @jsx jsx */
import { jsx } from "@emotion/core";
import { Button } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { render } from "@testing-library/react";
import { Css } from "./Css";

const useStyles = makeStyles({
  root: Css.black.$,
});

describe("Css.mui", () => {
  it("works via makeStyles", () => {
    function FooComponent() {
      const styles = useStyles();
      return <div className={styles.root}>root</div>;
    }

    const r = render(<FooComponent />);
    expect(r.container).toMatchInlineSnapshot(`
      <div>
        <div
          class="makeStyles-root-1"
        >
          root
        </div>
      </div>
    `);
  });

  it("works via emotion's prop", () => {
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
});
