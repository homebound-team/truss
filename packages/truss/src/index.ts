import { generate } from "src/generate";

export * from "src/config";
export { defaultSections } from "src/sections/tachyons";
export { generate } from "src/generate";
export type { IncConfig } from "src/methods";
export {
  newAliasesMethods,
  newMethod,
  newMethodsForProp,
  newIncrementDelegateMethods,
  newIncrementMethods,
  newParamMethod,
  newSetCssVariablesMethod,
} from "src/methods";

if (require.main === module) {
  // Hook up ts-node so we can require a TypeScript file
  require("ts-node/register/transpile-only");
  const path = require("path").join(process.cwd(), "./truss-config.ts");
  const config = require(path).default;
  generate(config)
    .then((done) => {
      console.log(`Generated ${config.outputPath}`);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
