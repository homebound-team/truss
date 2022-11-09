import { useState } from "react";
import { Css } from "@homebound/truss-testing-tachyons";

function App() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <h1 css={Css.lightGray.$}>Vite + React</h1>
      <div>
        <button onClick={() => setCount((count) => count + 1)}>count is {count}</button>
      </div>
    </div>
  );
}

export default App;
