import { getFCP } from "web-vitals";

// Not sure this is the best way to capture this, but the metric passed to
// `getFCP` has some relative times that are hard to track. This value `a`
// is assigned when all story modules are loaded.

const a = new Date().getTime();
getFCP(() => {
  const b = new Date().getTime();
  const div = document.createElement("div");
  div.innerText = `FCP ${(b - a) / 1000}`;
  document.body.insertBefore(div, document.body.firstChild);
});

export const parameters = {
  actions: { argTypesRegex: "^on[A-Z].*" },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
};
