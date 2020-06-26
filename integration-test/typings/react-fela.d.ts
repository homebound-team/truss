declare module "react-fela" {
  import * as React from "react";
  export const fe: typeof React.createElement;
}

declare module "jest-react-fela" {
  import * as React from "react";

  export function createSnapshot(component: React.Element): string;
}
