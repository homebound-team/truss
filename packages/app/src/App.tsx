import { Css, defaultMarker } from "./Css";
import { useState } from "react";
import { buttonNoteClassName } from "./App.css.ts";

export function App() {
  const [count, setCount] = useState(0);
  return (
    <div css={Css.df.fdc.aic.p2.gap2.$}>
      <h1 css={Css.f24.black.$}>Truss v2</h1>

      <p css={Css.bodyText.$}>This demo uses the Truss DSL.</p>

      <div css={Css.df.gap1.$}>
        <div css={Css.p1.ba.bcBlack.br2.cursorPointer.onHover.bcBlue.bgLightGray.$}>
          Border box with padding and radius
        </div>
        <div css={Css.bgBlue.white.p1.br2.cursorPointer.onHover.bgBlack.$}>Blue background with white text</div>
      </div>

      <div css={Css.df.aic.gap1.$}>
        <button onClick={() => setCount((c) => c + 1)}>count is {count}</button>
        {count > 0 && (
          <span css={Css.if(count > 5).blue.else.black.$}>
            {count > 5 ? "That's a lot!" : `Clicked ${count} times`}
          </span>
        )}
      </div>

      {/* Marker example: hovering the parent card reveals the child text */}
      <div css={Css.df.gap1.$}>
        <div css={Css.marker.ba.bcBlack.p2.br2.cursorPointer.$}>
          <span>Hover this card</span>
          <span css={Css.when(defaultMarker, "ancestor", ":hover").white.$}> — I turn white on parent hover</span>
        </div>
      </div>

      {/* Media query example */}
      <div css={Css.df.gap1.$}>
        <div css={Css.black.ifLg.white.$}>SMALL</div>
        <div css={Css.black.ifMdAndDown.white.$}>LARGE</div>
      </div>

      <div className={buttonNoteClassName}>This note use an class from App.css.ts.</div>
    </div>
  );
}
