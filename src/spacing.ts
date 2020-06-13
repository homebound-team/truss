import { numberOfIncrements } from "./config";
import { zeroTo, Prop } from "./utils";

const marginDefs: IncConfig[] = [
  ["mt", "marginTop"],
  ["mr", "marginRight"],
  ["mb", "marginBottom"],
  ["ml", "marginLeft"],
  ["mx", ["ml", "mr"]],
  ["my", ["mt", "mb"]],
  ["m", ["mt", "mb", "mr", "ml"]],
];

const paddingDefs: IncConfig[] = [
  ["pt", "paddingTop"],
  ["pr", "paddingRight"],
  ["pb", "paddingBottom"],
  ["pl", "paddingLeft"],
  ["px", ["pl", "pr"]],
  ["py", ["pt", "pb"]],
  ["p", ["pt", "pb", "pr", "pl"]],
];

// For any "increment" abbreviation, maps the abbreviation, i.e. "mt",
// to its longName or N other increment abbreviation that it composes.
type IncConfig = [string, Prop | string[]];

// If conf is a string[], we assume we're doing an alias like mx/my, and the conf entries are themselves mt/mb abbreviations
export function inc(abbr: string, conf: Prop | string[]): string[] {
  const incRules = zeroTo(numberOfIncrements).map(i => `get ${abbr}${i}() { return this.${abbr}(${i}); }`);
  if (Array.isArray(conf)) {
    return [...incRules, `${abbr}(inc: number | string) { return this.${conf.map(l => `${l}(inc)`).join(".")}; }`];
  } else {
    return [...incRules, `${abbr}(inc: number | string) { return this.add("${conf}", px(inc)); }`];
  }
}

const margins = marginDefs.map(([abbr, conf]) => inc(abbr, conf)).flat();
const paddings = paddingDefs.map(([abbr, conf]) => inc(abbr, conf)).flat();

export const spacingRules = [...margins, ...paddings];
