# Phase 2: Vite Integration, Production CSS, and Cleanup

## Goal

Wire the Phase 1 transform pipeline into the full Vite build, add HMR support for dev, emit a single `truss.css` in production, update `.css.ts` handling, remove StyleX dependencies, and get the black-box test suite passing.

## Depends on

Phase 1 (transform pipeline) must be complete.

## Scope

### In scope

- **Vite plugin HMR** — virtual CSS endpoint, runtime script injection, `truss:css-update` WebSocket event, `handleHotUpdate` hook
- **Production CSS** — `generateBundle` appends to existing CSS asset or emits `truss.css`; `writeBundle` fallback
- **Global CSS rule registry** — shared state across transform calls within a build; version counter for HMR
- **`.css.ts` pipeline** — update `transform-css.ts` to use shared CSS formatting helpers; append `.css.ts` output to `truss.css` in production
- **Remove StyleX** — remove `@stylexjs/*` from dependencies, Vite config, Vitest config; delete `emit-stylex.ts`
- **Black-box tests** (`Css.test.tsx`) — update expectations for new runtime shape; remove StyleX-specific vitest setup
- **jsdom test path** — `__injectTrussCSS` calls in test mode for stylesheet inspection tests

### Out of scope

- `marker`, `markerOf`, `when()` (Phase 3)

## Implementation Order

### 1. Global CSS rule registry in Vite plugin

The Vite plugin (`index.ts`) needs shared state:

```ts
const cssRegistry = new Map<string, AtomicRule>();
let cssVersion = 0;
```

- `transform()` calls `transformTruss()`, which returns `{ code, map, css, rules }`.
- New rules are merged into `cssRegistry`. If any new rules were added, increment `cssVersion`.
- `collectCss()` generates the full CSS string from `cssRegistry`, ordered by precedence tiers.

### 2. Dev mode HMR

Following the StyleX Vite plugin approach:

- **`configureServer`**: Register middleware at `/virtual:truss.css` that serves `collectCss()` with `Cache-Control: no-store`. Start a 150ms interval that checks `cssVersion` and sends `truss:css-update` via `server.ws.send()`.
- **`resolveId` / `load`**: Serve a virtual `virtual:truss:runtime` module containing the client-side HMR script.
- **`transformIndexHtml`**: Inject `<script type="module" src="virtual:truss:runtime">` and `<link rel="stylesheet" href="/virtual:truss.css">` into `<head>`.
- **`handleHotUpdate`**: Send `truss:css-update` event on any file change.

The virtual runtime script:

- Creates `<style id="__truss_virtual__">` in `<head>`
- Fetches from `/virtual:truss.css` and updates `textContent`
- Listens for `truss:css-update` and `vite:afterUpdate` HMR events

### 3. Production CSS emission

- **`generateBundle`**: Call `collectCss()`. Find an existing `.css` asset in the bundle and append. If none found, emit a new `truss.css` asset.
- **`writeBundle`**: Fallback — read the output CSS file and append if not already present.

### 4. `.css.ts` pipeline updates

- Update `transform-css.ts` to use the same `generateCssText()` / CSS formatting helpers from `emit-truss.ts`.
- In production, `.css.ts` output is collected into the global registry alongside atomic classes and included in the single `truss.css`.
- In dev, the existing `?truss-css` virtual module pipeline continues to work for HMR via Vite's native CSS handling.

### 5. Remove StyleX

- Delete `emit-stylex.ts`
- Remove `@stylexjs/stylex`, `@stylexjs/babel-plugin`, `@stylexjs/unplugin` from `package.json`
- Remove StyleX Vite plugin from `packages/app-stylex/vite.config.ts`
- Remove StyleX-specific Vitest setup/config
- Clean up any remaining `stylex` imports or references

### 6. Black-box test suite (`Css.test.tsx`)

- Update vitest config to remove StyleX plugin
- Keep behavior-driven assertions (rendered styles, object spread, pseudo behavior)
- Update CSS variable name expectations if needed
- Ensure jsdom tests use `__injectTrussCSS` path so `document.styleSheets` has rules
- Verify `Css.props` still works end-to-end

## Definition of Done

- Full Vite dev server works with HMR — editing a file updates styles without page reload
- Production build emits a single `truss.css` with all atomic rules + `.css.ts` rules
- `Css.test.tsx` black-box suite passes
- No `@stylexjs` packages in `node_modules` or config
- `emit-stylex.ts` deleted
