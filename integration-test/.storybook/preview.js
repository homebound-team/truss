import { getFCP } from "web-vitals";

getFCP((e) => {
  const div = document.createElement("div");
  div.innerText = JSON.stringify(e);
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
