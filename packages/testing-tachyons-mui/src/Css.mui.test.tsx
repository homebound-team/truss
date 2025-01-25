import { Css } from "@homebound/truss-testing-tachyons";
import { makeStyles } from "@mui/styles";
import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, test } from "vitest";

const useStyles = makeStyles({
  root: Css.black.$,
});

describe("Css.mui", () => {
  test("works via makeStyles", () => {
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
