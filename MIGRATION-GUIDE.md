# Migrating to StyleX-backed Truss

This guide covers migrating from the legacy runtime truss target (`target: "emotion"` in v1, renamed to `target: "react-native"` in v2) to the StyleX-backed target (`target: "stylex"`, now the default). The StyleX target uses a build-time Vite plugin that transforms `Css.*.$` chains into file-local `stylex.create()` + `stylex.props()` calls.

## What changes

| Aspect       | Before (emotion/fela)                                               | After (stylex)                                                    |
| ------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Runtime      | Fela atomic CSS renderer via `@homebound/fast-css-prop` JSX runtime | Build-time transform, zero runtime                                |
| `css` prop   | Accepts plain CSS objects (via custom JSX runtime)                  | Accepts `CssProp` arrays (via declaration merging on React types) |
| `Css.*.$`    | Returns a CSS properties object                                     | Returns a `CssProp` (opaque array of stylex refs)                 |
| `xss` type   | `Xss<P>` = `Pick<Properties, P>` — a CSS object                     | Same type signature, but values are stylex ref arrays at runtime  |
| Plugin chain | None (runtime-only)                                                 | `trussPlugin` (pre) -> StyleX unplugin (pre) -> React SWC         |

## What just works (no changes needed)

The vast majority of beam code migrates with zero changes. The truss build plugin understands all of these patterns:

### Static chains

```tsx
// beam/components/Button.tsx
primary: {
  baseStyles: Css.bgBlue600.white.$,
  hoverStyles: Css.bgBlue700.$,
}

// beam/inputs/CheckboxBase.tsx
const labelStyles = Css.sm.$;
const descStyles = Css.sm.gray700.$;
```

### Multi-property chains

```tsx
// beam/components/IconButton.tsx
const iconButtonNormal = Css.hPx(28).wPx(28).br8.bw2.$;
const iconButtonCompact = Css.hPx(18).wPx(18).br4.bw1.$;
```

### Dynamic calls with literals

```tsx
// beam/components/Button.tsx
sm: Css.hPx(32).pxPx(12).$,
md: Css.hPx(40).px2.$,
lg: Css.hPx(48).px3.$,
```

Literal arguments (numbers, strings) are resolved at build time into static `stylex.create` entries. `Css.hPx(32).$` becomes `css.h__32px` with `{ height: "32px" }`.

### Dynamic calls with variables

```tsx
// beam/components/ScrollShadows.tsx
css={Css.relative.oh.h(height).w(width).df.fd(!horizontal ? "column" : "row").$}
```

Variable arguments produce parameterized `stylex.create` entries using CSS custom properties under the hood. This works transparently.

### Conditionals (if/else)

```tsx
// beam/inputs/TextFieldBase.tsx
Css.hPx(fieldHeight - maybeSmaller)
  .if(compact)
  .hPx(compactFieldHeight - maybeSmaller).$;

// beam/components/Table/GridTable.tsx
Css.if(stickyHeader).sticky.topPx(stickyOffset).z(zIndices.stickyHeader).$;
```

### Pseudo-class getters

```tsx
// beam/components/Accordion.tsx
Css.df.jcsb.gapPx(12).aic.p2.md.outline("none").onHover.bgGray100.$

// beam/components/Layout/PageHeaderBreadcrumbs.tsx
<Link css={Css.smSb.gray700.onHover.gray900.$} />
```

The plugin emits per-property pseudo syntax: `{ color: { default: "#353535", ":hover": "#526675" } }`. When base and pseudo set the same property (like `Css.gray700.onHover.gray900.$`), they are automatically merged into a single entry.

### `useHover` + `.if(isHovered)` pattern (~48 uses)

```tsx
// beam/components/Card.tsx
const { hoverProps, isHovered } = useHover({ isDisabled });
// ...
css={{
  ...baseStyles(type),
  ...(isHovered && cardHoverStyles),
  ...(isDisabled && disabledStyles),
}}
```

This pattern uses JS booleans, not CSS selectors -- it works identically.

### Breakpoints

```tsx
// These are now supported by the plugin:
Css.ifSm.df.$; // display: flex only on small screens
Css.df.ifMd.blue.$; // flex always, blue text on medium screens
Css.bgBlue.ifSm.bgBlack.$; // blue bg default, black bg on small (merged)
```

The plugin treats `@media` queries identically to pseudo selectors.

### Aliases

```tsx
// If your truss-config.ts defines:
// aliases: { bodyText: ["f14", "black"] }
Css.bodyText.$; // expands to f14 + black segments
```

### Palette enum

```tsx
// beam/inputs/ToggleChipGroup.tsx
Css.color(xss?.color ?? Palette.White).bgColor(xss?.backgroundColor ?? Palette.Blue700).$;
```

`Palette` is still exported from the generated `Css.ts`. The import just needs to stay alongside `Css`.

### Spread / xss pattern

```tsx
// beam/forms/FormHeading.tsx
<h3 css={{
  ...Css.md.$,
  ...(!isFirst && Css.mt4.$),
  ...xss,
}}>
```

The plugin handles spread patterns. `css={[...Css.df.$, ...xss]}` is flattened into `{...stylex.props(css.df, ...xss)}`.

### css prop on JSX

```tsx
// beam/inputs/Switch.tsx
<label css={{
  ...Css.relative.cursorPointer.df.wmaxc.usn.$,
  ...(labelStyle === "form" && Css.fdc.$),
  ...(isDisabled && Css.cursorNotAllowed.gray400.$),
}}>
```

The plugin rewrites `css={...}` into `{...stylex.props(...)}` spread attributes. The `Css` import is removed and replaced with `import * as stylex from "@stylexjs/stylex"`.

---

## What needs changes

### `addIn()` -- NOT SUPPORTED

The `addIn()` method is not supported by the StyleX plugin. There are ~35 uses across 13 files in beam. Each needs manual migration.

**Why:** StyleX intentionally does not support arbitrary descendant/child selectors. This is a core design constraint for style determinism and performance.

#### Self pseudo-classes via addIn -> native pseudo getters

```tsx
// BEFORE (beam/components/Tooltip.tsx)
Css.display("contents").addIn(":active:not(:has(a))", Css.add("pointerEvents", "none").$).$;

// AFTER — decompose into JS boolean
const { isPressed } = usePress({});
Css.display("contents").if(isPressed).add("pointerEvents", "none").$;
```

#### Pseudo-elements via addIn -> real DOM elements

```tsx
// BEFORE (beam/inputs/internal/LoadingDots.tsx)
Css.relative
  .addIn("&:before, &:after", { ...circleCss, ...Css.add("content", "' '").absolute.dib.$ })
  .addIn("&:before", Css.leftPx(-12).add("animationDelay", "0").$)
  .addIn("&:after", Css.rightPx(-12).add("animationDelay", "600ms").$).$

// AFTER — use real elements
<span css={Css.relative.$}>
  <span css={Css.leftPx(-12).add("animationDelay", "0").absolute.dib.$} />  {/* was ::before */}
  <span />  {/* the dot itself */}
  <span css={Css.rightPx(-12).add("animationDelay", "600ms").absolute.dib.$} />  {/* was ::after */}
</span>
```

#### Descendant selectors via addIn -> pass styles via props

```tsx
// BEFORE (beam/components/Table/GridTable.tsx)
Css.addIn("& > div:first-of-type", style.firstRowCss).$

// AFTER — pass styles to child components via props
<Row css={isFirst ? style.firstRowCss : undefined}>
```

#### addIn with structural pseudo-classes on self -> native StyleX

```tsx
// BEFORE (beam/components/Table/TableStyles.tsx)
bordered && { "&:first-child": Css.bl.bcGray200.$, "&:last-child": Css.br.bcGray200.$ };

// AFTER — StyleX supports structural pseudos on self natively
// The truss DSL doesn't have these yet, but the pattern would be:
// Option A: Use .add() with the pseudo syntax
Css.add("borderLeftStyle", { default: null, ":first-child": "solid" }).$;
// Option B: Use JS — pass isFirst/isLast as props
Css.if(isFirst).bl.bcGray200.if(isLast).br.bcGray200.$;
```

#### Third-party element selectors -> scoped stylesheet

```tsx
// BEFORE (beam/inputs/RichTextField.tsx)
const trixCssOverrides = {
  "& trix-editor": Css.bgWhite.sm.gray900.bn.p1.$,
  "& trix-toolbar": Css.m1.$,
  "& .trix-button": Css.bgWhite.sm.$,
};

// AFTER — scoped CSS (StyleX cannot style elements it doesn't render)
const trixStyles = `
  .rich-text-wrapper trix-editor { background: white; font-size: 14px; border: none; padding: 8px; }
  .rich-text-wrapper trix-toolbar { margin: 8px; }
  .rich-text-wrapper .trix-button { background: white; font-size: 14px; }
`;
<>
  <style>{trixStyles}</style>
  <div className="rich-text-wrapper">
    <trix-editor />
  </div>
</>;
```

### Inline emotion selector keys -- NOT SUPPORTED

Inline CSS object keys like `"&:hover"`, `"& > div"` are an emotion/fela feature, not part of the truss DSL.

```tsx
// BEFORE (beam/components/Table/components/Row.tsx)
{
  ...rowStyles,
  "&:hover > *": Css.bgColor(style.rowHoverColor ?? Palette.Blue100).$,
  "&:hover": Css.cursorPointer.$,
}

// AFTER — use markers for ancestor hover, or useHover for self
// Option A: ancestor marker pattern (for child elements reacting to parent hover)
// Parent:
<tr css={Css.marker.cursorPointer.onHover.cursorPointer.$}>
// Child:
<td css={Css.onHoverOf().bgColor(style.rowHoverColor ?? Palette.Blue100).$}>

// Option B: useHover (simpler, already proven in beam)
const { isHovered, hoverProps } = useHover({});
<tr {...hoverProps} css={Css.if(isHovered).cursorPointer.$}>
  <td css={Css.if(isHovered).bgColor(rowHoverColor).$}>
```

```tsx
// BEFORE (beam/inputs/RichTextField.tsx)
"&:focus-within": Css.bcBlue700.$

// AFTER — use useFocusWithin hook
const { focusWithinProps, isFocusWithin } = useFocusWithin({});
<div {...focusWithinProps} css={Css.if(isFocusWithin).bcBlue700.$}>
```

### Combined pseudo-classes -- decompose to JS

```tsx
// BEFORE (beam/inputs/internal/DatePicker/Day.tsx)
"&:hover:not(:active) > div": Css.bgGray100.$

// AFTER — decompose into JS booleans
const { isHovered } = useHover({});
const { isPressed } = usePress({});
// On the child div:
css={Css.if(isHovered && !isPressed).bgGray100.$}
```

```tsx
// BEFORE (beam/inputs/ToggleChipGroup.tsx)
":hover:not([data-disabled='true'])": Css.bgColor(Palette.Blue800).$

// AFTER
css={Css.if(isHovered && !disabled).bgColor(Palette.Blue800).$}
```

### `@keyframes` -- use stylex.keyframes()

```tsx
// BEFORE (beam/components/CssReset.tsx) — emotion css tagged template
const ourReset = css`
  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

// AFTER — define with stylex.keyframes, keep in a shared module
import * as stylex from "@stylexjs/stylex";
const spin = stylex.keyframes({
  from: { transform: "rotate(0deg)" },
  to: { transform: "rotate(360deg)" },
});
// Use in stylex.create:
const styles = stylex.create({
  spinner: { animationName: spin, animationDuration: "1s" },
});
```

### `ifContainer()` -- native StyleX per-property syntax

```tsx
// BEFORE (beam/components/Grid/useResponsiveGrid.ts)
Css.ifContainer({ gt: minWidth, lt: maxWidth }).gc(`span ${span}`).$;

// AFTER — manual stylex.create with @container query
// The truss DSL doesn't generate ifContainer yet.
// Use raw stylex.create for now:
const styles = stylex.create({
  span: {
    gridColumn: {
      default: null,
      "@container (min-width: 601px) and (max-width: 960px)": "span 2",
    },
  },
});
```

### CssReset / global styles -- keep as standalone CSS

```tsx
// BEFORE (beam/components/CssReset.tsx)
const modernNormalizeReset = css`...`;
const tailwindPreflightReset = css`...`;

// AFTER — ship as a plain CSS file (reset.css)
// Global resets are orthogonal to StyleX. Every project needs them.
// Import as: import "./reset.css";
```

### SVG child selectors -- use currentColor

```tsx
// BEFORE (beam/components/Icon.tsx)
<svg css={{ "& > path": { fill: "blue" } }}>

// AFTER — set color on svg, use currentColor in SVG markup
<svg css={Css.blue.$}>
  <path fill="currentColor" />
</svg>
```

---

## Type changes

### `CssProp`

Before: `CssProp` was `StandardProperties & { [Key in '&${string}']?: StandardProperties }` (a CSS object with optional nested selectors).

After: `CssProp` is `any[]` (an opaque array of stylex refs). The generated `Css.ts` includes React module augmentation:

```ts
declare module "react" {
  interface HTMLAttributes<T> {
    css?: CssProp;
  }
  interface SVGAttributes<T> {
    css?: CssProp;
  }
}
```

No separate JSX runtime is needed. The truss plugin rewrites `css={...}` at build time.

### `Xss<P>`

The `Xss` type and the `Only` constraint pattern work the same way at the type level. At runtime, the values are stylex ref arrays instead of CSS objects, but the type signatures are compatible.

```tsx
// This pattern still works:
interface TagProps<X> {
  xss?: X;
}
function Tag<X extends Only<Xss<TagXss>, X>>(props: TagProps<X>) { ... }
```

### No more `@homebound/fast-css-prop`

The custom JSX runtime (`jsxImportSource: "@homebound/fast-css-prop"`) is no longer needed. Remove it from your Vite config:

```diff
// vite.config.ts
- plugins: [react({ jsxImportSource: "@homebound/fast-css-prop" })],
+ plugins: [trussPlugin({ mapping: "./src/Css.json" }), stylexPlugin(), react()],
```

---

## Setup checklist

1. Update `truss-config.ts` to use the StyleX target (`target: "stylex"`, or omit `target` to use the default)
2. Run `yarn codegen` to regenerate `Css.ts` + `Css.json`
3. Add the Vite plugin chain:

   ```ts
   import { trussPlugin } from "@homebound/truss/plugin";
   import stylexPlugin from "@stylexjs/vite-plugin";
   import react from "@vitejs/plugin-react";

   export default defineConfig({
     plugins: [
       trussPlugin({ mapping: "./src/Css.json" }),
       stylexPlugin({
         /* stylex options */
       }),
       react(),
     ],
   });
   ```

4. Remove `jsxImportSource: "@homebound/fast-css-prop"` from Vite/tsconfig
5. Remove `@homebound/fast-css-prop` and `fela`/`fela-dom` dependencies
6. Migrate `addIn()` calls (35 occurrences, 13 files)
7. Migrate inline emotion selector keys (~56 occurrences)
8. Migrate `@keyframes` to `stylex.keyframes()`
9. Move CssReset global styles to a plain CSS file
10. Migrate `ifContainer()` calls (2 occurrences)

---

## Migration effort summary

| Pattern                             | Count      | Effort          | Notes                             |
| ----------------------------------- | ---------- | --------------- | --------------------------------- |
| `Css.*.$` static/dynamic chains     | ~hundreds  | **None**        | Just works                        |
| `.if(bool)` conditionals            | ~175       | **None**        | Just works                        |
| `useHover` + `.if(isHovered)`       | ~48        | **None**        | Just works                        |
| `.onHover` / `.onFocus` etc.        | ~31        | **None**        | Just works                        |
| Breakpoints (`.ifSm`, `.ifMd`)      | 0 (unused) | **None**        | Supported if used                 |
| `Palette` enum                      | ~many      | **None**        | Just works                        |
| Aliases                             | ~many      | **None**        | Just works                        |
| Spread/xss                          | ~many      | **None**        | Just works                        |
| `.addIn()`                          | 35         | **Medium**      | Manual migration per call site    |
| Inline selector keys                | ~56        | **Medium-High** | Manual migration, mostly in Table |
| `@keyframes`                        | 4          | **Low**         | Use `stylex.keyframes()`          |
| `ifContainer()`                     | 2          | **Low**         | Manual stylex.create              |
| CssReset globals                    | 4 blocks   | **Low**         | Move to plain CSS file            |
| Third-party widget selectors (trix) | ~15        | **Low**         | Scoped stylesheet                 |
| `::before`/`::after`                | ~7         | **Low-Med**     | Replace with real DOM elements    |
