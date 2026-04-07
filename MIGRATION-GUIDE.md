# Migrating to Native Truss

This guide reflects the migration we actually made in this repo: from the legacy runtime Truss setup to native build-time Truss.

Native Truss compiles `Css.*.$` usage at build time with `trussPlugin({ mapping: "./src/Css.json" })`. In this repo, the source of truth is `truss-config.ts`; `src/Css.ts` and `src/Css.json` are generated outputs.

## What changed

| Aspect                  | Before                                                | After                                                                                   |
| ----------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Runtime                 | Runtime styling plus Emotion-era globals/test helpers | Build-time transform via `trussPlugin`, runtime helpers from `@homebound/truss/runtime` |
| Generated files         | Older generated `Css.ts` shape                        | Generated `src/Css.ts` **and** `src/Css.json`                                           |
| `css` prop typing       | Runtime-specific setup                                | Generated React module augmentation with `css?: Properties`                             |
| Self selectors          | Inline selector keys / `addIn()` patterns             | `onHover`, `onFocusWithin`, `ifFirstOfType`, `when(...)`, `element(...)`                |
| Cross-element selectors | Nested selector objects                               | Markers + `when(marker, relationship, pseudo)`                                          |
| Globals                 | Emotion `Global` / `emotionTheme.ts`                  | `MuiCssBaseline` globals or plain CSS                                                   |
| Tests                   | `@emotion/jest` serializers/matchers                  | `@homebound/truss/vitest` `toHaveStyle`                                                 |
| Tooling                 | App Vite config only                                  | Every Vite pipeline needs the Truss plugin, including Storybook                         |

## What just works

Most plain `Css.*.$` usage migrated cleanly.

### Static and dynamic chains

```tsx
const labelStyles = Css.sm.$;
const descStyles = Css.sm.gray700.$;

const iconButtonNormal = Css.hPx(28).wPx(28).br8.bw2.$;
const iconButtonCompact = Css.hPx(18).wPx(18).br4.bw1.$;

css={Css.relative.oh.h(height).w(width).df.fd(!horizontal ? "column" : "row").$}
```

### Conditionals and breakpoints

```tsx
Css.if(stickyHeader).sticky.topPx(stickyOffset).z(zIndices.stickyHeader).$;

Css.ifSm.df.$;
Css.df.ifMd.blue.$;
Css.bgBlue.ifSm.bgBlack.$;
```

### Spread / `xss` composition

```tsx
const buttonCss = {
  ...baseStyles,
  ...(active ? Css.black.$ : {}),
  ...(isHovered ? Css.blue.$ : {}),
  ...xss,
};
```

### Aliases and palette values

```tsx
Css.bodyText.$;
Css.color(xss?.color ?? Palette.White).bgColor(xss?.backgroundColor ?? Palette.Blue700).$;
```

### Self selectors via `when()` and pseudo getters

These are supported now, including combined pseudo/attribute selectors on the same element.

```tsx
const primaryButtonCss = Css.bgBlack.bcTransparent.white.when({
  ":hover": Css.bgBlackFaded.bcTransparent.$,
  ":active": Css.bgBlackFaded.bcTransparent.$,
  ":focus": Css.bcWhite.$,
  ":disabled": Css.bgGray400.$,
  "[aria-disabled=true]": Css.bgGray400.$,
}).$;

Css.when(":hover:not(:disabled)").bgBlue800.$;
Css.onFocusWithin.bcBlue700.$;
Css.bcTaupe.bt.ifFirstOfType.add("borderTop", "none").$;
Css.when(":last-child").bb.bcDarkTransparentGray.$;
```

### Pseudo-elements via `element()`

```tsx
const accordionCss = {
  ...Css.p2.m0.bgTransparent.shadowNone.bt.bcDarkTransparentGray.$,
  ...Css.when(":last-child").bb.bcDarkTransparentGray.$,
  ...Css.element("::before").add("backgroundColor", "unset").$,
};
```

### Relationship selectors via markers

```tsx
const rowMarker = Css.newMarker();

<tr css={Css.markerOf(rowMarker).$} />
<td css={Css.when(rowMarker, "ancestor", ":hover").bgBlue100.cursorPointer.$} />
```

### `Css.props()`, `className()`, and `style()`

Use these when an API does not accept a `css` prop directly.

```tsx
<Menu PaperProps={Css.props(Css.shadowDark.br3.$)} />

const expandedClassName = Css.props(Css.m0.bt.bcDarkTransparentGray.$).className as string;

<svg css={{ ...Css.style(iconVars).onFocus.outline0.bw1.bsDashed.bcGray600.$, ...xss }} />

<div css={Css.df.className(isFullScreen ? "document-canvas-fill" : "").$} />
```

## What still needs manual changes

### `addIn()` is not supported

Every `addIn()` call needs a manual rewrite, but the replacement is often simpler than the old runtime version.

#### Self selectors: use `when()` or pseudo getters

```tsx
// BEFORE
Css.addIn("&:hover:not(:disabled)", Css.bgBlue800.$).$;

// AFTER
Css.when(":hover:not(:disabled)").bgBlue800.$;
```

#### Pseudo-elements: use `element()`

```tsx
// BEFORE
Css.addIn("&:before", Css.add("backgroundColor", "unset").$).$;

// AFTER
{
  ...Css.element("::before").add("backgroundColor", "unset").$,
}
```

#### Structural selectors on self: use `ifFirstOfType` / `ifLastOfType` or `when()`

```tsx
// BEFORE
Css.addIn("&:first-child", Css.bt.bcTaupe.add("borderTop", "none").$).$;

// AFTER
Css.bt.bcTaupe.ifFirstOfType.add("borderTop", "none").$;
```

#### Cross-element selectors: use markers

```tsx
// BEFORE
{
  "&:hover > *": Css.cursorPointer.bgBlue100.$,
}

// AFTER
const rowMarker = Css.newMarker();

<tr css={Css.markerOf(rowMarker).$} />
<td css={Css.when(rowMarker, "ancestor", ":hover").cursorPointer.bgBlue100.$} />
```

#### Third-party DOM you do not control: use `.css.ts` or plain CSS

```ts
// trix-overrides.css.ts
import { Css } from "src/Css";

export const css = {
  ".rich-text-wrapper trix-editor": Css.bgWhite.sm.gray900.bsn.p1.$,
  ".rich-text-wrapper trix-toolbar": Css.m1.$,
  ".rich-text-wrapper .trix-button": Css.bgWhite.sm.$,
};
```

### Inline selector object keys inside `css={{}}` are not supported

These Emotion-style keys still need to move to Truss helpers.

```tsx
// BEFORE
{
  ...rowStyles,
  "&:focus-within": Css.bcBlue700.$,
  "&::before": Css.add("backgroundColor", "unset").$,
}

// AFTER
{
  ...rowStyles,
  ...Css.onFocusWithin.bcBlue700.$,
  ...Css.element("::before").add("backgroundColor", "unset").$,
}
```

### Global styles need to move out of Emotion `Global`

In this repo, we deleted `src/theme/emotionTheme.ts`, removed `globalStyles`, and moved those globals into `MuiCssBaseline` overrides in `src/theme/muiTheme.ts`.

Keep resets and app-wide rules in one of these places:

- `MuiCssBaseline` overrides
- plain `.css`
- selector-oriented `.css.ts`

### Tests need Truss-aware assertions

Replace Emotion serializers/matchers with Truss helpers:

```ts
import { toHaveStyle } from "@homebound/truss/vitest";

expect.extend({ toHaveStyle });
```

## Type and runtime changes

### The generated `css` prop type is `Properties`

In this repo's generated `src/Css.ts`, React is augmented like this:

```ts
declare module "react" {
  interface HTMLAttributes<T> {
    css?: Properties;
  }
  interface SVGAttributes<T> {
    css?: Properties;
  }
  namespace JSX {
    interface IntrinsicAttributes {
      css?: Properties;
    }
  }
}
```

So the guide should talk about generated `Properties` style hashes, not a separate `CssProp` type.

### `Xss<P>` still works

The `Only<Xss<...>, X>` pattern still works the same way at call sites. The runtime shape changed, but the component API pattern did not.

### `Css.props()` is the bridge for non-`css` APIs

`Css.props(styles)` returns `{ className, style }` and is the preferred bridge for:

- MUI `PaperProps`
- `classes` APIs that want a class name string
- manual prop spreading into non-`css` contexts

### `RuntimeStyle` exists, but selector helpers stay build-time only

`src/Css.ts` now re-exports `RuntimeStyle` and `useRuntimeStyle` from `@homebound/truss/runtime`.

Use them only for genuinely runtime-only styling. Selector helpers like `when()`, `marker`, `element()`, and `ifContainer()` still belong in the build-time path.

### No more custom JSX runtime

The active JSX runtime config was removed. In this repo that meant deleting `jsxImportSource` from `tsconfig.json` and adding the Truss Vite plugin:

```diff
// vite.config.ts
- plugins: [react()],
+ plugins: [trussPlugin({ mapping: "./src/Css.json" }), react()],
```

## Setup checklist

1. Upgrade `@homebound/truss` to the native version used by your repo.
2. Remove active runtime-specific JSX config such as `jsxImportSource`.
3. Add `trussPlugin({ mapping: "./src/Css.json" })` to `vite.config.ts`.
4. Add the same plugin to every other Vite pipeline, especially Storybook.
5. Run `yarn truss` to regenerate `src/Css.ts` and `src/Css.json`.
6. Commit the generated files, but treat `truss-config.ts` as the source of truth.
7. Remove runtime-only styling deps you no longer need. In this migration that included `@emotion/react`, `@emotion/cache`, `@emotion/jest`, and `@stitches/react`.
8. Migrate `addIn()` and inline selector keys to `when()`, pseudo getters, `element()`, markers, or `.css.ts`.
9. Move Emotion `Global` usage and `emotionTheme.ts` globals into `MuiCssBaseline` or plain CSS.
10. Update tests to use `@homebound/truss/vitest` matchers.
11. Keep Storybook wrappers aligned with the app: `StylesProvider injectFirst`, shared `MuiThemeProvider`, and `CssBaseline`.

## Best practices

- Treat `truss-config.ts` as the only hand-edited Truss source. Do not manually edit `src/Css.ts` or `src/Css.json`.
- Prefer dedicated helpers when they exist: `bc*` for border colors, `wPx`/`hPx`/`sqPx`/`mwPx` over generic raw-value patterns.
- Prefer `when()` / `onHover` / `onFocusWithin` / `ifFirstOfType` / `element()` for selectors on the same element.
- Use markers only for relationships between elements. If you own both components and can pass `xss` directly, that is often simpler.
- Use `Css.props()` for library APIs that want `className`, `style`, `PaperProps`, or `classes` instead of a `css` prop.
- Use `Css.style()` for CSS variables and `className()` only to stitch in an existing global class.
- Keep global resets in one place: `MuiCssBaseline`, plain CSS, or selector-oriented `.css.ts` files.
- Keep Storybook and app styling wrappers in sync so stories render the same baseline/global styles as the app.
- In tests, assert styles with `toHaveStyle` instead of Emotion snapshot serializers.

## Repo-specific gotchas we hit

- Border color helpers changed from `b*` to `bc*` (`bTaupe` -> `bcTaupe`, `bGray400` -> `bcGray400`).
- A lot of old nested selector code became cleaner with `when({ ... })`.
- Some style-only class name hooks moved to `Css.props(...).className`.
- App and Storybook both needed the Truss plugin.
- Global font/reset rules moved from Emotion globals into `MuiCssBaseline`.
