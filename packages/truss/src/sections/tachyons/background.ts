import { CreateMethodsFn } from "src/config";
import { newMethodsForProp } from "src/methods";

// `backgroundColor` is in skins.ts, because it is driven by the palette.
// https://developer.mozilla.org/en-US/docs/Web/CSS/background
export const background: CreateMethodsFn = () => [
  // The shorthand, which resets the longhands below that it does not set, i.e. `bg("red")`
  // clears any `bgImage`. Use `bgColor` to set only the color.
  ...newMethodsForProp("background", {}, "bg"),
  ...newMethodsForProp("backgroundImage", {}, "bgImage"),
  ...newMethodsForProp("backgroundSize", {}, "bgSize"),
  ...newMethodsForProp("backgroundPosition", {}, "bgPosition"),
  ...newMethodsForProp("backgroundRepeat", { bgNoRepeat: "no-repeat" }, "bgRepeat"),
  ...newMethodsForProp(
    "backgroundClip",
    // Clipping a background to text needs the prefixed property in Safari, which
    // does not support the standard name.
    { bgClipText: { backgroundClip: "text", WebkitBackgroundClip: "text" } },
    "bgClip",
  ),
];
