import { inc } from "./spacing";
import { Prop } from "./utils";

const directions: Prop[] = ["top", "right", "bottom", "left"];

export const coordinateRules = directions.flatMap(d => {
  return inc(d, d);
});
