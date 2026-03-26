import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { Css, type Only, type Xss } from "./Css";

afterEach(cleanup);

describe("Xss", () => {
  type PanelXss = "color" | "height" | "marginRight";

  function Panel<X extends Only<Xss<PanelXss>, X>>(props: { xss?: X }) {
    const { height, ...rest } = props.xss ?? {};
    const css = {
      // Spread out `height` as an example where we'd want to move it around within the component
      // (as-is there is no reason to destructure it, vs. letting it stay in `...rest`
      ...Css.h(1).df.bgBlue.addCss({ height }).$,
      ...rest,
    };

    return <div css={css}>panel</div>;
  }

  test("caller-provided xss height can be destructured and re-injected where needed", () => {
    const r = render(<Panel xss={Css.black.hPx(24).mr1.$} />);
    const el = r.container.firstChild as HTMLElement;
    expect(getComputedStyle(el).height).toBe("24px");
    expect(el).toHaveStyle({
      display: "flex",
      backgroundColor: "#526675",
      color: "#353535",
      height: "24px",
      marginRight: "8px",
    });
  });

  test("unset xss height can fall back to a default while preserving other caller props", () => {
    const r = render(<Panel xss={Css.black.mr1.$} />);
    const el = r.container.firstChild as HTMLElement;
    expect(getComputedStyle(el).height).toBe("8px");
    expect(el).toHaveStyle({
      display: "flex",
      backgroundColor: "#526675",
      color: "#353535",
      height: "8px",
      marginRight: "8px",
    });
  });

  test("addCss ignores undefined height instead of unsetting an earlier height", () => {
    const height: Xss<"height">["height"] | undefined = undefined;
    const r = render(<div css={Css.h(1).addCss({ height }).$} />);
    const el = r.container.firstChild as HTMLElement;
    expect(getComputedStyle(el).height).toBe("8px");
    expect(el).toHaveStyle({ height: "8px" });
  });
});
