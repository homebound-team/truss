import { CreateMethodsFn } from "../config";
import { newMethodsForProp } from "../methods";

// https://github.com/tachyons-css/tachyons/blob/master/src/_display.css
export const display: CreateMethodsFn = () =>
  newMethodsForProp("display", {
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
    dig: "inline-grid",
    df: "flex",
    dif: "inline-flex",
  });
