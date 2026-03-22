import { Css } from "./Css";
import { useState } from "react";
import { buttonNoteClassName } from "./App.css.ts";

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
      <p className={buttonNoteClassName}>This note uses an exported class constant from `App.css.ts`.</p>

      <div css={Css.mt2.df.gap1.$}>
        <div css={Css.ba.bcBlack.p1.br2.cursorPointer.onHover.bcBlue.bgLightGray.$}>
          Border box with padding and radius
        </div>
        <div css={Css.bgBlue.white.p1.br2.cursorPointer.onHover.bgBlack.$}>Blue background with white text</div>
      </div>

      {/* Marker example: hovering the parent card reveals the child text */}
      <div css={Css.mt2.df.gap1.$}>
        <div css={Css.marker.ba.bcBlack.p3.br2.cursorPointer.$}>
          <span>Hover this card</span>
          <span css={Css.when("ancestor", ":hover").white.$}> — I turn white on parent hover</span>
        </div>
      </div>

      {/* Media query example */}
      <div css={Css.mt2.df.gap1.$}>
        <div css={Css.black.ifLg.white.$}>SMALL</div>
        <div css={Css.black.ifMdAndDown.white.$}>LARGE</div>
      </div>
    </div>
  );
}
