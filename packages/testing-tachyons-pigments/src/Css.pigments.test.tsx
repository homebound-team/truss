import React from "react";
import { render } from "@testing-library/react";

declare global {
  namespace React {
    interface HTMLAttributes<T> {
      sx?: React.CSSProperties | ReadonlyArray<React.CSSProperties>;
    }
  }
}

describe("Css.pigments", () => {
  it("works via makeStyles", () => {
    function FooComponent() {
      return <div sx={{ display: "flex" }}>root</div>;
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
