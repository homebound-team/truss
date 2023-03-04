import { CreateMethodsFn } from "src/config";
import { comment, newIncrementMethods, newMethodsForProp } from "src/methods";

export const height: CreateMethodsFn = (config) => [
  // https://github.com/tachyons-css/tachyons/blob/master/src/_heights.css

  // Technically h1 in tachyons is 1em and ours is 1 inc
  ...newIncrementMethods(config, "h", "height", { auto: true }),

  ...newMethodsForProp(
    "height",
    {
      h25: "25%",
      h50: "50%",
      h75: "75%",
      h100: "100%",
      vh25: "25vh",
      vh50: "50vh",
      vh75: "75vh",
      vh100: "100vh",
      hfc: "fit-content",
      hmaxc: "max-content",
      hminc: "min-content",
    },
    // Skip `h` here b/c it's created by newIncrementMethods below
    null,
  ),

  ...newMethodsForProp(
    "minHeight",
    {
      mh0: 0,
      mh25: "25%",
      mh50: "50%",
      mh75: "75%",
      mh100: "100%",
      mvh100: "100vh",
    },
    "mh",
    true,
  ),

  ...newMethodsForProp(
    "maxHeight",
    {
      maxh0: "0",
      maxh25: "25%",
      maxh50: "50%",
      maxh75: "75%",
      maxh100: "100%",
    },
    "maxh",
    true,
  ),

  // Sneak this into heights.ts even though it's for width & height
  `${comment({ height: "px", width: "px" })}
  sqPx(px: number) { return this.add("height", \`\${px}px\`).add("width", \`\${px}px\`); }`,
];
