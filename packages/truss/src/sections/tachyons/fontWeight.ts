import { CreateMethodsFn } from "src/config";
import { newMethodsForProp } from "src/methods";

export const fontWeight: CreateMethodsFn = () =>
  newMethodsForProp(
    "fontWeight",
    {
      normal: "normal",
      b: "bold",
      fw1: 100,
      fw2: 200,
      fw3: 300,
      fw4: 400,
      fw5: 500,
      fw6: 600,
      fw7: 700,
      fw8: 800,
      fw9: 900,
    },
    "fw"
  );
