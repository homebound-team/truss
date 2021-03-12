import { RuleFn } from "../config";
import { newMethodsForProp } from "../utils";

// https://github.com/tachyons-css/tachyons/blob/master/src/_display.css
export const displayRules: RuleFn = () =>
  newMethodsForProp("display",
    {
      dn: "none",
      db: "block",
      dib: "inline-block",
      dit: "inline-table",
      dt: "table",
      dtc: "table-cell",
      dtRow: "table-row",
      dtColumn: "table-column",
      dtColumnGroup: "table-column-group",
      // added
      dg: "grid",
      df: "flex",
      dif: "inline-flex",
    },
    "display"
  );
