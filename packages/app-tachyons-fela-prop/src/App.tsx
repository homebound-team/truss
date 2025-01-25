import { useState } from "react";
import { Css } from "@homebound/truss-testing-tachyons";

export function App() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <h1 css={Css.black.top(count + 1).$}>Vite1</h1>
      <h1
        css={{
          ...Css.black.$,
          "&:hover": Css.white.top(count + 1).$,
        }}
      >
        Vite2
      </h1>
      <div>
        <button onClick={() => setCount((count) => count + 1)}>count is {count}</button>
      </div>
    </div>
  );
}
