# Build-Time Vite Plugin Architecture Plan

## Architecture overview

```
codegen (yarn codegen)         build time (vite transform)
┌──────────────┐              ┌───────────────┐    ┌───────────────┐
│ generate.ts  │──produces──▶ │ Css.ts         │    │ stylex babel  │
│              │              │ (object hash   │    │ plugin        │
│              │──produces──▶ │  builder)      │    └───────┬───────┘
│              │              │                │            │
│              │              │ truss-map.json │            │
└──────────────┘              │ (abbr→CSS      │            │
                              │  mapping)      │            │
                              └───────┬────────┘            │
                                      │                     │
                              ┌───────▼────────┐            │
                              │ truss vite     │───output──▶│
                              │ plugin         │            │
                              │ (AST rewrite)  │            │
                              └────────────────┘            │
                                                            ▼
                                                     atomic CSS
```

**Plugin ordering in vite.config.ts:**

```ts
plugins: [
  trussPlugin({ mapping: "./src/truss-map.json" }), // enforce:'pre', order 1
  stylex.vite({ dev: true, runtimeInjection: true }), // enforce:'pre', order 2
  react(), // default
];
```

## What codegen produces

### 1. `Css.ts` — emotion-style object-hash builder

Reverts to the emotion-target CssBuilder. `$` returns `CssProp` typed as `StyleXStyles[]` (internal cast). Used for IDE autocomplete and type checking. Plugin erases all CssBuilder usage at build time.

### 2. `truss-map.json` — static abbreviation→CSS mapping

```json
{
  "increment": 8,
  "abbreviations": {
    "df": { "kind": "static", "defs": { "display": "flex" } },
    "mt": { "kind": "dynamic", "props": ["marginTop"], "incremented": true },
    "mtPx": { "kind": "delegate", "target": "mt" },
    "bodyText": { "kind": "alias", "chain": ["f14", "black"] }
  },
  "pseudoMethods": {
    "onHover": { "pseudo": ":hover" },
    "onFocus": { "pseudo": ":focus" },
    "onFocusVisible": { "pseudo": ":focus-visible" },
    "onActive": { "pseudo": ":active" },
    "onDisabled": { "pseudo": ":disabled" }
  }
}
```

## The Vite plugin

### Transform steps

1. **Find Css import** — skip files without it
2. **Collect all Css expression sites** — walk AST for `Css.*...$` chains
3. **Resolve to CSS properties** using mapping
4. **Build file-level `stylex.create`** — deduplicate entries
5. **Rewrite `css={...}` sites** — replace with `{...stylex.props(...)}`
6. **Rewrite `$` variable assignments** — `const s = Css.df.$` → `const s = [__s.df]`
7. **Inject imports, clean up** — add stylex import, remove Css import

### Naming convention

- Pseudo variants: `blue__hover`, `black__focus`, etc.
- Static resolved: `mt__16px` for `mt(2)` with literal
- Parameterized: `mt` for `mt(x)` with variable

### Unsupported patterns

Emit `throw new Error("[truss] Unsupported pattern: ...")` for anything that can't be statically resolved.

## Decisions

- **No JSX runtime** — always use the plugin (dev + prod), with `runtimeInjection: true` for dev/tests
- **Full replacement** — no incremental adoption path
- **100% coverage** — unsupported patterns emit throwing code
- **`maybeInc` inlined** into each file that needs it
- **`addIn()` not supported** initially
- **Multi-property pseudo** uses per-property conditional syntax: `{ borderStyle: { default: null, ":hover": "solid" }, borderWidth: { default: null, ":hover": "1px" } }`

## Files

### Create

- `packages/stylex/src/vite-plugin/index.ts`
- `packages/stylex/src/vite-plugin/transform.ts`
- `packages/stylex/src/vite-plugin/resolve-chain.ts`
- `packages/stylex/src/vite-plugin/emit-stylex.ts`
- `packages/stylex/src/vite-plugin/types.ts`
- `packages/stylex/src/vite-plugin/__tests__/transform.test.ts`
- `packages/stylex/src/vite-plugin/__tests__/resolve-chain.test.ts`
- `packages/stylex/src/truss-map.json` (generated)

### Modify

- `packages/truss/src/generate.ts` — add `generateTrussMapping()`
- `packages/stylex/vite.config.ts` — add trussPlugin
- `packages/stylex/vitest.config.js` — add trussPlugin
- `packages/app-stylex/vite.config.ts` — add trussPlugin
- `packages/app-stylex/vitest.config.js` — add trussPlugin
- `packages/stylex/src/Css.ts` — regenerated as emotion-style builder
- `packages/stylex/src/index.ts` — export trussPlugin, maybeInc
- `packages/stylex/src/jsx-runtime.ts` — simplify to passthrough
- `packages/stylex/src/jsx-dev-runtime.ts` — simplify to passthrough

### Delete

- `packages/stylex/src/expandCssProp.ts`

## Implementation order

1. Add `generateTrussMapping()` to `generate.ts`, produce `truss-map.json`
2. Regenerate `Css.ts` as emotion-style builder (with `CssProp` typed as `StyleXStyles[]`)
3. Simplify JSX runtime to passthrough (delete `expandCssProp.ts`)
4. Scaffold `vite-plugin/` with types + plugin entry
5. Implement `resolve-chain.ts` + unit tests
6. Implement `emit-stylex.ts` (stylex.create generation)
7. Implement `transform.ts` (full AST rewrite) + snapshot tests
8. Wire up in `vite.config.ts` / `vitest.config.js` across both packages
9. Get existing `Css.test.tsx` (43 tests) + `App.test.tsx` (8 tests) passing
10. Add pseudo-class support (`onHover`/`onFocus`/etc.) + tests
11. Add `onHover(marker)` support + tests
12. Add conditional `if/else` support + tests
13. Add spread/composition support + tests
