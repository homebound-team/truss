# Truss Development Guidelines

- After editing `packages/truss/src/generate.ts`, always run `yarn codegen` from the repo root to regenerate the `Css.ts` output files (e.g. `packages/app/src/Css.ts`, `packages/template-tachyons/src/Css.ts`). Never manually edit generated `Css.ts` files.
