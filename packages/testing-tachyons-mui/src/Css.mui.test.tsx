import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import { render } from "@testing-library/react";
import { Css } from "@homebound/truss-testing-tachyons";

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
});
