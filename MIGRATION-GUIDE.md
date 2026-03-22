# Migrating to Native Truss

This guide covers migrating from the legacy runtime truss target (`target: "emotion"` in v1, renamed to `target: "react-native"` in v2) to the native build-time target. The native target uses a Vite plugin that transforms `Css.*.$` chains into property-keyed style hashes and emits atomic CSS at build time.

## What changes

| Aspect       | Before (emotion/fela)                                               | After (native)                                                      |
| ------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Runtime      | Fela atomic CSS renderer via `@homebound/fast-css-prop` JSX runtime | Build-time transform, minimal runtime (`trussProps` / `mergeProps`) |
| `css` prop   | Accepts plain CSS objects (via custom JSX runtime)                  | Accepts `CssProp` style hashes (via declaration merging)            |
| `Css.*.$`    | Returns a CSS properties object                                     | Returns a property-keyed style hash (plain object)                  |
| `xss` type   | `Xss<P>` = `Pick<Properties, P>` — a CSS object                     | Same type signature, values are style hashes at runtime             |
| Plugin chain | None (runtime-only)                                                 | `trussPlugin` (pre) -> React SWC                                    |

## What just works (no changes needed)

The vast majority of code migrates with zero changes. The truss build plugin understands all of these patterns:

### Static chains

```tsx
primary: {
  baseStyles: Css.bgBlue600.white.$,
  hoverStyles: Css.bgBlue700.$,
}

const labelStyles = Css.sm.$;
const descStyles = Css.sm.gray700.$;
```

### Multi-property chains

```tsx
const iconButtonNormal = Css.hPx(28).wPx(28).br8.bw2.$;
const iconButtonCompact = Css.hPx(18).wPx(18).br4.bw1.$;
```

### Dynamic calls with literals

```tsx
sm: Css.hPx(32).pxPx(12).$,
md: Css.hPx(40).px2.$,
lg: Css.hPx(48).px3.$,
```

Literal arguments (numbers, strings) are resolved at build time into static atomic classes. `Css.hPx(32).$` becomes `{ height: "h_32px" }`.

### Dynamic calls with variables

```tsx
css={Css.relative.oh.h(height).w(width).df.fd(!horizontal ? "column" : "row").$}
```

Variable arguments produce CSS custom property classes. The class points at a `var(--prop)` and the runtime value is set via inline style. This works transparently.

### Conditionals (if/else)

```tsx
Css.hPx(fieldHeight - maybeSmaller)
  .if(compact)
  .hPx(compactFieldHeight - maybeSmaller).$;

Css.if(stickyHeader).sticky.topPx(stickyOffset).z(zIndices.stickyHeader).$;
```

### Pseudo-class getters

```tsx
Css.df.jcsb.gapPx(12).aic.p2.md.outline("none").onHover.bgGray100.$

<Link css={Css.smSb.gray700.onHover.gray900.$} />
```

When base and pseudo set the same property (like `Css.gray700.onHover.gray900.$`), they are merged into a single property entry with a space-separated class bundle: `{ color: "gray700 h_gray900" }`.

### `useHover` + `.if(isHovered)` pattern

```tsx
const { hoverProps, isHovered } = useHover({ isDisabled });
css={{
  ...baseStyles(type),
  ...(isHovered && cardHoverStyles),
  ...(isDisabled && disabledStyles),
}}
```

This pattern uses JS booleans, not CSS selectors — it works identically.

### Breakpoints

```tsx
Css.ifSm.df.$; // display: flex only on small screens
Css.df.ifMd.blue.$; // flex always, blue text on medium screens
Css.bgBlue.ifSm.bgBlack.$; // blue bg default, black bg on small (merged)
```

### Aliases

```tsx
// If your truss-config.ts defines:
// aliases: { bodyText: ["f14", "black"] }
Css.bodyText.$; // expands to f14 + black segments
```

### Palette enum

```tsx
Css.color(xss?.color ?? Palette.White).bgColor(xss?.backgroundColor ?? Palette.Blue700).$;
```

`Palette` is still exported from the generated `Css.ts`.

### Spread / xss pattern

```tsx
<h3 css={{
  ...Css.md.$,
  ...(!isFirst && Css.mt4.$),
  ...xss,
}}>
```

Object spread composition is the primary composition mechanism. Because `Css.*.$` returns property-keyed objects, later spreads naturally override earlier ones at the CSS property level:

```tsx
const baseStyles = {
  ...Css.df.aic.$,
};

const buttonStyles = {
  ...baseStyles,
  ...(active && { ...Css.black.$ }),
  ...(isHovered && { ...Css.blue.$ }),
};
```

### css prop on JSX

```tsx
<label css={{
  ...Css.relative.cursorPointer.df.wmaxc.usn.$,
  ...(labelStyle === "form" && Css.fdc.$),
  ...(isDisabled && Css.cursorNotAllowed.gray400.$),
}}>
```

The plugin rewrites `css={...}` into `{...trussProps(...)}` spread attributes. The `Css` import is removed at build time.

### Markers and relationship selectors

```tsx
// Parent applies a marker:
<tr css={Css.marker.cursorPointer.$}>

// Child reacts to parent hover:
<td css={Css.when("ancestor", ":hover").bgBlue100.$}>

// Named markers for specificity:
const row = Css.newMarker();
<tr css={Css.markerOf(row).$}>
<td css={Css.when("ancestor", row, ":hover").bgBlue100.$}>
```

---

## What needs changes

### `addIn()` — NOT SUPPORTED

The `addIn()` method is not supported. Each use needs manual migration.

**Why:** The native approach intentionally does not support arbitrary descendant/child selectors. This is a core design constraint for style determinism — atomic classes must map to single property declarations so that object spread provides correct override semantics.

#### Self pseudo-classes via addIn -> native pseudo getters

```tsx
// BEFORE
Css.display("contents").addIn(":active:not(:has(a))", Css.add("pointerEvents", "none").$).$;

// AFTER — decompose into JS boolean
const { isPressed } = usePress({});
Css.display("contents").if(isPressed).add("pointerEvents", "none").$;
```

#### Pseudo-elements via addIn -> real DOM elements

```tsx
// BEFORE
Css.relative
  .addIn("&:before, &:after", { ...circleCss, ...Css.add("content", "' '").absolute.dib.$ })
  .addIn("&:before", Css.leftPx(-12).add("animationDelay", "0").$)
  .addIn("&:after", Css.rightPx(-12).add("animationDelay", "600ms").$).$

// AFTER — use real elements
<span css={Css.relative.$}>
  <span css={Css.leftPx(-12).add("animationDelay", "0").absolute.dib.$} />
  <span />
  <span css={Css.rightPx(-12).add("animationDelay", "600ms").absolute.dib.$} />
</span>
```

#### Descendant selectors via addIn -> pass styles via props

```tsx
// BEFORE
Css.addIn("& > div:first-of-type", style.firstRowCss).$

// AFTER — pass styles to child components via props
<Row css={isFirst ? style.firstRowCss : undefined}>
```

#### addIn with structural pseudo-classes on self

```tsx
// BEFORE
bordered && { "&:first-child": Css.bl.bcGray200.$, "&:last-child": Css.br.bcGray200.$ };

// AFTER — use JS booleans
Css.if(isFirst).bl.bcGray200.if(isLast).br.bcGray200.$;
```

#### Third-party element selectors -> .css.ts scoped stylesheet

```tsx
// BEFORE
const trixCssOverrides = {
  "& trix-editor": Css.bgWhite.sm.gray900.bn.p1.$,
  "& trix-toolbar": Css.m1.$,
  "& .trix-button": Css.bgWhite.sm.$,
};

// AFTER — use a .css.ts file for scoped selector rules
// trix-overrides.css.ts
import { Css } from "./Css";
export default {
  ".rich-text-wrapper trix-editor": Css.bgWhite.sm.gray900.bn.p1.$,
  ".rich-text-wrapper trix-toolbar": Css.m1.$,
  ".rich-text-wrapper .trix-button": Css.bgWhite.sm.$,
};
```

### Inline emotion selector keys — NOT SUPPORTED

Inline CSS object keys like `"&:hover"`, `"& > div"` are an emotion/fela feature, not part of the truss DSL.

```tsx
// BEFORE
{
  ...rowStyles,
  "&:hover > *": Css.bgColor(style.rowHoverColor ?? Palette.Blue100).$,
  "&:hover": Css.cursorPointer.$,
}

// AFTER — use markers for ancestor hover
// Parent:
<tr css={Css.marker.cursorPointer.onHover.cursorPointer.$}>
// Child:
<td css={Css.when("ancestor", ":hover").bgColor(style.rowHoverColor ?? Palette.Blue100).$}>
```

```tsx
// BEFORE
"&:focus-within": Css.bcBlue700.$

// AFTER — use useFocusWithin hook
const { focusWithinProps, isFocusWithin } = useFocusWithin({});
<div {...focusWithinProps} css={Css.if(isFocusWithin).bcBlue700.$}>
```

### Combined pseudo-classes — decompose to JS

```tsx
// BEFORE
"&:hover:not(:active) > div": Css.bgGray100.$

// AFTER — decompose into JS booleans
const { isHovered } = useHover({});
const { isPressed } = usePress({});
// On the child div:
css={Css.if(isHovered && !isPressed).bgGray100.$}
```

```tsx
// BEFORE
":hover:not([data-disabled='true'])": Css.bgColor(Palette.Blue800).$

// AFTER
css={Css.if(isHovered && !disabled).bgColor(Palette.Blue800).$}
```

### `@keyframes` — use plain CSS or .css.ts

```tsx
// BEFORE (emotion css tagged template)
const ourReset = css`
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// AFTER — define in a .css.ts file or plain CSS file
// animations.css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

### CssReset / global styles — keep as standalone CSS

```tsx
// BEFORE
const modernNormalizeReset = css`...`;

// AFTER — ship as a plain CSS file (reset.css)
// Global resets are orthogonal to Truss. Import as: import "./reset.css";
```

### SVG child selectors — use currentColor

```tsx
// BEFORE
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

After: `CssProp` is a property-keyed style hash (a plain object mapping CSS property names to atomic class name strings or variable tuples). The generated `Css.ts` includes React module augmentation:

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

The `Xss` type and the `Only` constraint pattern work the same way at the type level. At runtime, the values are style hashes instead of CSS objects, but the type signatures are compatible.

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
+ plugins: [trussPlugin({ mapping: "./src/Css.json" }), react()],
```

---

## Setup checklist

1. Run `yarn codegen` to regenerate `Css.ts` + `Css.json`
2. Add the Vite plugin:

   ```ts
   import { trussPlugin } from "@homebound/truss/plugin";
   import react from "@vitejs/plugin-react";

   export default defineConfig({
     plugins: [trussPlugin({ mapping: "./src/Css.json" }), react()],
   });
   ```

3. Remove `jsxImportSource: "@homebound/fast-css-prop"` from Vite/tsconfig
4. Remove `@homebound/fast-css-prop` and `fela`/`fela-dom` dependencies
5. Migrate `addIn()` calls
6. Migrate inline emotion selector keys
7. Migrate `@keyframes` to plain CSS or `.css.ts` files
8. Move CssReset global styles to a plain CSS file

---

## Migration effort summary

| Pattern                         | Count     | Effort          | Notes                          |
| ------------------------------- | --------- | --------------- | ------------------------------ |
| `Css.*.$` static/dynamic chains | ~hundreds | **None**        | Just works                     |
| `.if(bool)` conditionals        | ~175      | **None**        | Just works                     |
| `useHover` + `.if(isHovered)`   | ~48       | **None**        | Just works                     |
| `.onHover` / `.onFocus` etc.    | ~31       | **None**        | Just works                     |
| Breakpoints (`.ifSm`, `.ifMd`)  | varies    | **None**        | Just works                     |
| `Palette` enum                  | ~many     | **None**        | Just works                     |
| Aliases                         | ~many     | **None**        | Just works                     |
| Spread/xss                      | ~many     | **None**        | Just works                     |
| Markers / `when()`              | varies    | **None**        | Just works                     |
| `.addIn()`                      | ~35       | **Medium**      | Manual migration per call site |
| Inline selector keys            | ~56       | **Medium-High** | Manual migration               |
| `@keyframes`                    | ~4        | **Low**         | Move to plain CSS              |
| `ifContainer()`                 | ~2        | **None**        | Supported natively             |
| CssReset globals                | ~4 blocks | **Low**         | Move to plain CSS file         |
| Third-party widget selectors    | ~15       | **Low**         | Scoped stylesheet / .css.ts    |
| `::before`/`::after`            | ~7        | **Low-Med**     | Replace with real DOM elements |
