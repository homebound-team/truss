# Phase 3: `marker` and `when()`

## Goal

Re-implement the `marker`, `markerOf`, and `when()` APIs using native CSS selectors instead of StyleX's `stylex.defineMarker()` / `stylex.when.ancestor()` machinery.

## Depends on

Phases 1 and 2 must be complete.

## Scope

### In scope

- `Css.marker.$` — applies a deterministic marker class to an element
- `Css.markerOf("name").$` — applies a named marker class
- `Css.when("ancestor", ":hover").blue.$` — styles conditioned on an ancestor/descendant/sibling state
- `Css.when("ancestor", marker, ":hover").blue.$` — styles conditioned on a specific marker's state
- Default marker behavior (the implicit marker when none is specified)
- Transform-time lowering to CSS descendant/sibling combinators
- CSS generation for relationship-based selectors

### Design direction

- Markers become deterministic CSS classes applied to elements (`.__truss_m` for the default marker, `.__truss_m_<identifier>` for named markers)
- `when("ancestor", ":hover")` lowers to an ancestor descendant selector: `.__truss_m:hover .target_class { ... }`
- `when("descendant", ":focus")` lowers to a `:has(...)` selector on the target: `.target_class:has(.__truss_m:focus) { ... }`
- `when("siblingBefore", ":hover")` lowers to a previous-sibling selector: `.__truss_m:hover ~ .target_class { ... }`
- `when("siblingAfter", ":hover")` lowers to a following-sibling selector: `.target_class:has(~ .__truss_m:hover) { ... }`
- `when("anySibling", ":hover")` lowers to both sibling directions combined
- These selectors emit in their own tier after pseudo-element atoms and before media atoms

## Definition of Done

- All existing `marker`/`when()` tests pass against the new implementation
- No remaining references to `stylex.defineMarker`, `stylex.defaultMarker`, or `stylex.when`
- CSS for relationship selectors is emitted in the correct tier in `truss.css`

## Completion

Phase 3 is done. All definition-of-done criteria are met:

- `marker`, `markerOf`, and `when()` are now fully native and no longer rely on any StyleX marker or relationship-selector APIs.
- Relationship selectors are emitted directly in `emit-truss.ts` and participate in a dedicated CSS ordering tier between pseudo-element rules and media rules.
- Default markers use the stable class `.__truss_m`; explicit markers use `.__truss_m_<identifier>` when the marker argument is an identifier.
- `when()` owns logical CSS properties exactly like other condition bundles: later object spreads replace the full property bundle, including relationship-based variants.
- Selector directionality is now explicit and tested:
  - `ancestor` -> `marker:pseudo .target`
  - `descendant` -> `.target:has(marker:pseudo)`
  - `siblingBefore` -> `marker:pseudo ~ .target`
  - `siblingAfter` -> `.target:has(~ marker:pseudo)`
  - `anySibling` -> both sibling directions combined

### Files changed

| File                                          | Change                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| `packages/truss/src/plugin/resolve-chain.ts`  | Carries `whenPseudo` through variable, delegate, and `add()` segments                 |
| `packages/truss/src/plugin/emit-truss.ts`     | Emits native relationship selectors, marker class naming, and `when()` rule tier      |
| `packages/truss/src/plugin/rewrite-sites.ts`  | Emits `__marker` metadata into rewritten style hashes and preserves `when()` segments |
| `packages/truss/src/runtime.ts`               | Treats `__marker` as marker-class metadata and merges it into `className`             |
| `packages/truss/src/plugin/transform.test.ts` | Adds full transform + CSS assertions for marker and relationship selector support     |
| `packages/app-stylex/src/App.test.tsx`        | Enables app-level marker smoke test                                                   |
| `packages/truss/src/plugin/types.ts`          | Removes stale StyleX-specific docs for marker/when internals                          |

### Key design decisions made during implementation

1. **Marker naming**: Rather than deriving marker names from component context, the native runtime uses one stable default marker class (`.__truss_m`) plus identifier-based named markers (`.__truss_m_row`). This keeps transforms deterministic without requiring component-name inference.

2. **Selector lowering strategy**: `ancestor` and `siblingBefore` use plain combinators, while `descendant` and `siblingAfter` use `:has(...)` because the target element must react to state in elements that appear inside or after it.

3. **No extra specificity bump**: Relationship selectors already include at least two selector components, so they naturally outrank base atoms. They emit in a dedicated tier for deterministic ordering, but do not use doubled-selector specificity bumps like media rules.

4. **Property ownership model**: `when()` variants are bundled into the same property-keyed style hash model as base/pseudo/media styles. That means object spread remains the single override mechanism, and replacing `color` removes both base and relationship-based `color` ownership together.

### Verification

- `yarn workspace @homebound/truss exec tsc --noEmit`
- `yarn workspace @homebound/truss vitest --run src/plugin/transform.test.ts`
- `yarn workspace @homebound/truss vitest --run`
- `yarn workspace app-stylex test`
- `yarn test`
