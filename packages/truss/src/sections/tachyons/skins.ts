import { CreateMethodsFn, UtilityMethod } from "src/config";
import { newMethod, newMethodsForProp, Prop } from "src/methods";
import { lowerCaseFirst } from "src/utils";

export const skins: CreateMethodsFn = (config) => {
  const { palette } = config;
  return [
    ...paletteMethods(palette, "color", lowerCaseFirst),
    ...newMethodsForProp("color", {}),
    ...paletteMethods(palette, "backgroundColor", (key) => `bg${key}`),
    ...newMethodsForProp("backgroundColor", {}, "bgColor"),
    ...paletteMethods(palette, "fill", (key) => `f${key}`),
    ...newMethodsForProp("fill", {}),
    ...newMethodsForProp("accentColor", {}),
    ...newMethodsForProp("caretColor", {}),
  ];
};

/**
 * A method per palette entry that sets `prop` to that entry's color, i.e. `Bg` -> `get bg()`.
 *
 * Each method passes along the palette key it is named after, so an error about a duplicate
 * method name can name the palette entry instead of this section.
 */
function paletteMethods(palette: Record<string, string>, prop: Prop, abbrOf: (key: string) => string): UtilityMethod[] {
  return Object.entries(palette).map(([key, value]) =>
    newMethod(abbrOf(key), { [prop]: value }, { kind: "palette", name: key }),
  );
}
