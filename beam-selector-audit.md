# Beam Selector Audit & StyleX Migration Proposal

## Part 1: Selector Usage Audit

### Summary

Beam uses four mechanisms for CSS selectors:

1. **DSL methods** on CssBuilder (`.onHover`, `.if()`, `.ifContainer()`)
2. **`.addIn(selector, props)`** escape hatch for arbitrary nested selectors
3. **Inline CSS object keys** with emotion-style selector strings (`"&:hover"`, `"& > div"`)
4. **Emotion `css` tagged templates** in CssReset.tsx for global styles

Additionally, ~48 references to `useHover` (React Aria) apply hover styles via JS boolean `.if(isHovered)`, not CSS selectors.

---

### 1. Pseudo-class selectors

#### `:hover` (~19 total)

**Via `.onHover` DSL method (5):**

- `TreeOption.tsx:82`
- `Accordion.tsx:92-93`
- `PageHeaderBreadcrumbs.tsx:26`
- `ColumnResizeHandle.tsx:267`

**Via inline `"&:hover"` keys (~14):**

- `ListBox.tsx:101`
- `ChipSelectField.tsx:263,277` (combined: `"&:hover:not(:disabled)"`)
- `Menu.tsx:92`
- `Day.tsx:50` (`"&:hover:not(:active) > div"`)
- `TableStyles.tsx:159`
- `EditColumnsButton.tsx:83`
- `Row.tsx:122,127,133`
- `ToggleChipGroup.tsx:135,137` (`:hover:not([data-disabled='true'])`)

#### `:focus` / `:focus-within` (~9)

- `Day.tsx:53` (`"&:focus:not(:active) > div"`)
- `RichTextField.tsx:205` (`"&:focus-within"`)
- `CompoundField.tsx:17,24,38` (`"&:focus-within"`)

#### `:active` (~2)

- `Day.tsx:50,52` (`"&:active > div"`)

#### `:disabled` (1)

- `ButtonGroup.tsx:70`

#### Structural (`:first-of-type`, `:last-of-type`, `:first-child`, `:last-child`) (~5 inline + ~10 via addIn)

- `ButtonGroup.tsx:98,100,102`
- `TableStyles.tsx:154,160`
- `GridTable.tsx:609,619-621,660-665,881-887` (via addIn)

#### `:not()` (~4)

- `ButtonGroup.tsx:102` (`"&:not(:first-of-type)"`)
- `TableStyles.tsx:154` (`"&:not(:last-of-type)"`)
- `ChipSelectField.tsx:263` (`"&:hover:not(:disabled)"`)
- `Day.tsx:50,53` (combined with :hover/:focus)

---

### 2. Pseudo-element selectors (~9)

- `LoadingDots.tsx:24,28,29` (`"&:before"`, `"&:after"`)
- `Day.tsx:56-58` (`":after"` x3)
- `ScrollableParent.tsx:108` (`"&:after"`)
- `AvatarButton.tsx:80-83` (`":after"`)
- `RichTextField.tsx:214` (`"& .trix-button--icon::before"`)
- `TextFieldBase.tsx:186` (`"&::selection"`)
- `ScrollShadows.tsx:77` (`"&::-webkit-scrollbar"`)

---

### 3. Descendant/child selectors (~56)

**Heavy users:**

- `RichTextField.tsx` (~15): `"& trix-editor"`, `"& trix-toolbar"`, `"& .trix-button"`, etc.
- `GridTable.tsx` (~10): `"& > div:first-of-type"`, `"& > tbody > tr > *"`, etc.
- `TableStyles.tsx` (~6): `"& > *:first-of-type"`, `"& > *"`, etc.
- `Icon.tsx` (2): `"& > path"`, `"& > rect"`
- `Copy.tsx` (1): `"& > p"`
- `FormLines.tsx` (1): `"& > *"`
- `SuperDrawer.tsx` (1): `"& h1"`
- Various stories (~10)

---

### 4. `.addIn()` escape hatch (35 occurrences, 13 files)

The primary mechanism for complex selectors. See descendant/child/structural selectors above — many go through `.addIn()`.

---

### 5. Media queries / @-rules

- DSL methods `.ifSm`, `.ifMd`, `.ifLg`, `.ifPrint` defined but **unused** in component code
- `.ifContainer()` used in `useResponsiveGrid.ts` (2 occurrences)
- `@keyframes` in CssReset.tsx (4 definitions: loadingDots, loadingDotsContrast, spin, pulse)

---

### 6. Global styles (CssReset.tsx)

4 emotion `css` tagged template blocks with extensive raw CSS including pseudo-classes, pseudo-elements, element selectors, normalize/preflight resets.

---

### 7. JS-based hover (`useHover` + `.if(isHovered)`)

~48 references across ~20 files. Already compatible with StyleX — no CSS selectors involved.

---

## Part 2: StyleX Migration Proposal

### What StyleX supports natively

| Feature                                                     | StyleX syntax                                                                                         | Notes                                  |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Pseudo-classes (`:hover`, `:focus`, `:active`, `:disabled`) | `{ color: { default: 'black', ':hover': 'blue' } }`                                                   | Per-property, not per-namespace        |
| Pseudo-elements (`::placeholder`, `::selection`)            | `{ '::placeholder': { color: '#999' } }`                                                              | Top-level key in namespace             |
| Media queries                                               | `{ width: { default: 800, '@media (max-width: 800px)': '100%' } }`                                    | Per-property conditions                |
| `@container` queries                                        | Same as media queries                                                                                 | Per-property conditions                |
| Combined conditions                                         | Nested: `{ color: { default: 'blue', ':hover': { default: null, '@media (hover: hover)': 'red' } } }` |                                        |
| Keyframes                                                   | `stylex.keyframes({ from: {...}, to: {...} })`                                                        |                                        |
| Ancestor/sibling state                                      | `stylex.when.ancestor(':hover')` with markers                                                         | New API, replaces descendant selectors |
| Descendant state                                            | `stylex.when.descendant(':focus')` with markers                                                       | Requires `:has()`                      |
| CSS variables for descendant styling                        | `defineVars` + set values conditionally per pseudo-state                                              | Explicit, composable                   |

### What StyleX does NOT support

- Arbitrary descendant/child selectors (`"& > div"`, `"& .className"`)
- Element selectors (`"& h1"`, `"& trix-editor"`)
- Structural pseudo-class selectors on children (`"& > *:first-of-type"`)
- `::before` / `::after` (recommends real elements instead)
- `::webkit-scrollbar`
- Raw CSS injection / escape hatches

---

### Migration strategy per pattern

#### A. `:hover`, `:focus`, `:active`, `:disabled` on self (19+9+2+1 = ~31 uses)

**StyleX support: Native**

Truss DSL approach — generate per-property pseudo-class syntax:

```ts
// Emotion/current:
Css.onHover.bgBlue100.$

// StyleX equivalent in stylex.create:
hoverBg: { backgroundColor: { default: 'initial', ':hover': '#dbeafe' } }

// Truss DSL (proposed):
Css.bgBlue100_onHover.$   // static variant
// or
Css.onHover.bgBlue100.$   // builder pushes a hover-scoped ref
```

**Proposal:** Add `.onHover`, `.onFocus`, `.onActive`, `.onDisabled` to the CssBuilder. When active, subsequent property calls produce `{ prop: { default: null, ':hover': value } }` style entries. The generator would emit separate `stylex.create` entries for hover variants.

**Complexity: Medium.** The tricky part is that StyleX pseudo-classes are per-property, not per-namespace. The builder needs to track "I'm in hover mode" and emit the right structure.

**Alternative (simpler, already works):** Keep the existing `useHover` + `.if(isHovered)` JS pattern that 48 uses already follow. This requires zero StyleX pseudo-class support and works identically. The 31 CSS-selector-based hovers could be migrated to this pattern.

#### B. Combined pseudo-classes (`:hover:not(:disabled)`, `:focus:not(:active)`) (~6 uses)

**StyleX support: Partial** — simple pseudo-classes only, no compound selectors like `:hover:not(:disabled)`.

**Proposal:** Decompose into JS + CSS. Use `useHover` / `useFocusWithin` hooks for the state, and apply styles via `.if(!disabled && isHovered)`. This already matches the existing `useHover` pattern in beam.

**Complexity: Low.** Already proven pattern.

#### C. Pseudo-elements `::before` / `::after` (~7 uses)

**StyleX support: Not supported.** StyleX recommends using real DOM elements instead.

**Proposal:** Replace with actual `<span>` / `<div>` elements:

- `LoadingDots.tsx`: Replace `::before`/`::after` dots with child `<span>` elements
- `Day.tsx`: Replace `::after` date range indicators with child elements
- `ScrollableParent.tsx`: Replace `::after` with a positioned child `<div>`
- `AvatarButton.tsx`: Replace `::after` badge with a child element

**Complexity: Low-Medium.** Mechanical refactor, but needs visual QA.

#### D. `::selection`, `::-webkit-scrollbar` (2 uses)

**StyleX support: `::selection` is supported as a pseudo-element top-level key.** `::-webkit-scrollbar` is not.

**Proposal:**

- `::selection` in TextFieldBase → native StyleX: `{ '::selection': { backgroundColor: '...' } }`
- `::-webkit-scrollbar` in ScrollShadows → keep as a one-off global CSS rule or use `scrollbar-width: none` (standard CSS)

**Complexity: Low.**

#### E. `::placeholder` (CssReset only)

**StyleX support: Native** — `{ '::placeholder': { color: '#999' } }`

**Complexity: Low.**

#### F. Descendant/child selectors (`"& > div"`, `"& > *"`, etc.) (~56 uses)

**StyleX support: Not supported.** This is the hardest category.

**Proposal by sub-pattern:**

**F1. `"& > *"` / `"& > *:first-of-type"` — styling all/specific children (~20 uses, mostly Table)**

Use `stylex.when.ancestor` with markers, or pass styles down via props/context:

```tsx
// Before (emotion):
<div css={{ "& > *": { padding: "8px" } }}>
  <Child /><Child />
</div>

// After (StyleX):
// Option A: Pass style prop to children
<div>
  <Child css={Css.p1.$} /><Child css={Css.p1.$} />
</div>

// Option B: Use CSS variables set on parent, consumed by children
// Parent sets --child-padding: 8px on :hover, children use var(--child-padding)
```

For Table specifically: the grid layout already controls children via `grid-template-columns`. Remaining child selectors (padding, borders on first/last) can be handled by passing styles to Row/Cell components via props.

**Complexity: High for Table.** The GridTable has the most complex descendant selectors. Medium for other components.

**F2. `"& h1"`, `"& trix-editor"`, `"& .trix-button"` — styling third-party/shadow DOM (~15 uses, mostly RichTextField)**

These target elements inside trix (rich text editor) that we don't control.

**Proposal:** Keep these as a global stylesheet or a one-off `<style>` tag scoped to the component. StyleX cannot style elements it doesn't render. This is an inherent limitation.

```tsx
// One-off scoped styles for third-party widgets
const trixStyles = `
  .rich-text-wrapper trix-editor { ... }
  .rich-text-wrapper .trix-button { ... }
`;
<>
  <style>{trixStyles}</style>
  <div className="rich-text-wrapper">
    <trix-editor />
  </div>
</>;
```

**Complexity: Low** — just move existing CSS to a scoped stylesheet.

**F3. `"& > path"`, `"& > rect"` — SVG child styling (2 uses in Icon.tsx)**

**Proposal:** Use `currentColor` and CSS variables. SVG `fill`/`stroke` can inherit from `color` via `currentColor`, or use CSS variables set on the parent SVG element.

```tsx
// Before:
<svg css={{ "& > path": { fill: "blue" } }}>

// After:
<svg css={Css.blue.$}>  {/* sets color: blue */}
  <path fill="currentColor" />
</svg>
```

**Complexity: Low.**

#### G. Structural pseudo-classes on self (`:first-of-type`, `:last-of-type`, `:not()`) (~10 uses)

**StyleX support: Native** — these are pseudo-classes on the element itself.

```ts
// StyleX:
const styles = stylex.create({
  item: {
    borderRadius: {
      default: "0",
      ":first-of-type": "4px 4px 0 0",
      ":last-of-type": "0 0 4px 4px",
    },
  },
});
```

**Complexity: Low.** Direct mapping.

#### H. `.addIn()` escape hatch (35 uses)

Most `.addIn()` calls fall into categories already covered above (descendant selectors, structural pseudo-classes, pseudo-elements). The migration follows the same strategies:

- Self pseudo-classes → native StyleX
- Descendant selectors → props/context/markers
- Pseudo-elements → real DOM elements
- Third-party widget selectors → scoped stylesheet

**Complexity: Varies per call site.**

#### I. `@container` queries (2 uses)

**StyleX support: Native** — same per-property syntax as media queries.

```ts
const styles = stylex.create({
  item: {
    width: {
      default: "100%",
      "@container (min-width: 600px)": "50%",
    },
  },
});
```

**Complexity: Low.**

#### J. `@keyframes` (4 definitions)

**StyleX support: Native** via `stylex.keyframes()`.

```ts
const spin = stylex.keyframes({
  from: { transform: "rotate(0deg)" },
  to: { transform: "rotate(360deg)" },
});
```

**Complexity: Low.**

#### K. CssReset.tsx global styles (4 blocks)

**StyleX support: Not applicable.** Global resets are inherently non-component-scoped.

**Proposal:** Keep as a standalone CSS file (or `<style>` injection). This is orthogonal to StyleX — every StyleX project still needs a CSS reset. Ship as `reset.css` alongside the component library.

**Complexity: None** — no migration needed.

#### L. Data attribute selectors (`[data-disabled='true']`) (2 uses)

**StyleX support: Partial.** `stylex.when.*` accepts pseudo-class strings, and data attributes can be checked via `:hover` etc. but not arbitrary attribute selectors in `stylex.create`.

**Proposal:** Replace with JS boolean: `.if(!disabled && isHovered)` instead of `:hover:not([data-disabled='true'])`.

**Complexity: Low.**

---

## Part 3: Priority & Effort Summary

| Priority | Pattern                                         | Count    | StyleX Support | Migration Strategy                                            | Effort  |
| -------- | ----------------------------------------------- | -------- | -------------- | ------------------------------------------------------------- | ------- |
| **P0**   | `:hover`/`:focus`/`:active`/`:disabled` on self | ~31      | Native         | Per-property pseudo-class in DSL or use `useHover` JS pattern | Medium  |
| **P0**   | `.if(boolean)` conditionals                     | ~175     | Already works  | No change needed                                              | None    |
| **P0**   | `useHover` JS pattern                           | ~48      | Already works  | No change needed                                              | None    |
| **P1**   | Structural pseudo-classes on self               | ~10      | Native         | Direct mapping                                                | Low     |
| **P1**   | `@keyframes`                                    | 4        | Native         | `stylex.keyframes()`                                          | Low     |
| **P1**   | `@container` queries                            | 2        | Native         | Per-property syntax                                           | Low     |
| **P1**   | `::placeholder`, `::selection`                  | 2        | Native         | Top-level pseudo-element key                                  | Low     |
| **P2**   | `::before`/`::after`                            | ~7       | Not supported  | Replace with real DOM elements                                | Low-Med |
| **P2**   | Combined pseudo-classes                         | ~6       | Not supported  | Decompose to JS boolean                                       | Low     |
| **P2**   | Data attribute selectors                        | 2        | Not supported  | Decompose to JS boolean                                       | Low     |
| **P3**   | Descendant/child selectors (Table)              | ~20      | Not supported  | Props/context/markers, major refactor                         | High    |
| **P3**   | Descendant selectors (other)                    | ~20      | Not supported  | Props/context/CSS vars                                        | Medium  |
| **P3**   | Third-party element selectors (trix)            | ~15      | Not supported  | Scoped stylesheet                                             | Low     |
| **P3**   | `::-webkit-scrollbar`                           | 1        | Not supported  | Global CSS or `scrollbar-width`                               | Low     |
| **--**   | CssReset global styles                          | 4 blocks | N/A            | Keep as standalone CSS                                        | None    |

### Recommended approach for the truss DSL

1. **Phase 1 — Pseudo-classes on self:** Add `.onHover`, `.onFocus`, `.onActive`, `.onDisabled` to the StyleX CssBuilder. These generate per-property `{ default, ':hover' }` objects inside `stylex.create`. This covers ~31 direct uses.

2. **Phase 2 — Ancestor/descendant state:** Leverage `stylex.when.ancestor(':hover')` with `stylex.defaultMarker()` for the Table row-hover pattern and similar parent-state-driven styles.

3. **Phase 3 — Descendant selectors:** Migrate `"& > *"` patterns to explicit prop-passing or CSS variable inheritance. This is the largest effort, concentrated in GridTable.

4. **Escape hatch:** For third-party widget styling (trix) and global resets, keep a small amount of non-StyleX CSS as scoped stylesheets. This is pragmatic and matches Meta's own approach.
