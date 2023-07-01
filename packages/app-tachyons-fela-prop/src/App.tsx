import { useInsertionEffect, useState } from "react";
import { Css } from "@homebound/truss-testing-tachyons";

function App() {
  const [count, setCount] = useState(0);
  useInsertionEffect(() => {
    console.log("DO INSERT!");
  });
  console.log("app render");
  return (
    <div>
      <h1 css={Css.black.$}>Vite css prop</h1>
      <h1 css={Css.black.$}>Vite css 2nd prop</h1>
      <h1 style={Css.black.$}>Vite style prop</h1>
      <div>
        <button onClick={() => setCount((count) => count + 1)}>count is {count}</button>
      </div>
      <Child />
    </div>
  );
}

function Child() {
  const [count, setCount] = useState(0);
  useInsertionEffect(() => {
    console.log("DO CHILD INSERT!");
  });
  console.log("child render");
  return (
    <div css={Css.black.$}>
      <div>
        <button onClick={() => setCount((count) => count + 1)}>child count is {count}</button>
      </div>
      Child
    </div>
  );
}

export default App;
