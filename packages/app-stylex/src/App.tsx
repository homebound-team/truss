import { Css } from "@homebound/truss-stylex";
import { useState } from "react";

export function App() {
  const [count, setCount] = useState(0);
  return (
    <div css={Css.df.fdc.aic.p2.$}>
      <h1 css={Css.black.f24.$}>Truss + StyleX</h1>

      <p css={Css.bodyText.mb1.$}>This demo uses the Truss DSL with StyleX as the CSS backend.</p>

      <div css={Css.df.aic.gap1.$}>
        <button onClick={() => setCount((c) => c + 1)}>count is {count}</button>
        {count > 0 && (
          <span css={Css.if(count > 5).blue.else.black.$}>
            {count > 5 ? "That's a lot!" : `Clicked ${count} times`}
          </span>
        )}
      </div>

      <div css={Css.mt2.df.gap1.$}>
        <div css={Css.ba.bcBlack.p1.br2.$}>Border box with padding and radius</div>
        <div css={Css.bgBlue.white.p1.br2.$}>Blue background with white text</div>
      </div>
    </div>
  );
}
