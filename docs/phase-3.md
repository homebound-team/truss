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

- Markers become deterministic CSS classes applied to elements (e.g. `.truss-marker-ComponentName`)
- `when("ancestor", ":hover")` lowers to a descendant combinator: `.truss-marker-X:hover .target_class { ... }`
- `when("sibling", ":hover")` lowers to a sibling combinator: `.truss-marker-X:hover ~ .target_class { ... }`
- Default marker behavior uses a convention-based marker class derived from the component context
- These selectors need their own specificity tier in the CSS emission ordering

### Open questions

- How to derive default marker names deterministically from component context
- Whether marker selectors need additional specificity bumps to avoid conflicts with base/pseudo tiers
- How `when()` interacts with the property ownership model (does `when(ancestor, :hover).blue.$` own the `color` property the same way `onHover.blue` does?)

## Definition of Done

- All existing `marker`/`when()` tests pass against the new implementation
- No remaining references to `stylex.defineMarker`, `stylex.defaultMarker`, or `stylex.when`
- CSS for relationship selectors is emitted in the correct tier in `truss.css`
