import {} from "react";
import { FelaStyle } from "react-fela";

declare module "react" {
  interface Attributes {
    css?: FelaStyle;
  }
}
