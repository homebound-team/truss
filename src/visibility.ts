export const visibilityRules = [
  // https://tailwindcss.com/docs/visibility/
  `get visible() { return this.add("visibility", "visible"); }`,
  `get invisible() { return this.add("visibility", "hidden"); }`,
];
