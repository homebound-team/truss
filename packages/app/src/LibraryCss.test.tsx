import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

afterEach(cleanup);

describe("library css", () => {
  test("automatically includes library css file", () => {
    const r = render(<div className="beamStatic">beam</div>);
    const el = r.container.firstChild as HTMLElement;
    expect(el).toHaveStyle({ display: "flex" });
  });
});
