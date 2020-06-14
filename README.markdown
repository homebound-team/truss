## truss

truss is a mini-framework for generating a single-file, Tachyons-ish TypeScript DSL for writing CSS-in-JS.

### Quick Intro

```typescript
const css = Css.m2.black.$;
```

The `css` variable now has object-style CSS-in-JS properties, as if you'd written by hand:

```graphql
const css = {
  marginTop: "16px",
  marginBottom: "16px",
  marginLeft: "16px",
  marginRight: "16px",
  color: "#000000",
};
```

truss is CSS-in-JS agnostic, but was built to work well with emotion, i.e.:

```tsx
function MyReactComponent(props: ...) {
  // Use emotion's css prop
  return <div css={Css.m2.black.$}>content</div>
}
```

### Files

- `config.ts` contains most project-specific data like colors and font sizes
- `generate.ts` drives the codegen process
- `skins.ts`, `spacing.ts`, each define rules that are inspired by the Tachyons section of the same name (see Tachyon's [table of rules](http://tachyons.io/docs/table-of-styles/))

Note that this project is "Tachyons-ish", i.e. where it makes sense we use/prefer the Tachyons abbreviations, but don't follow them stringently. I.e. we personally prefer a `f32` == `32px` style for font abbreviations instead of `f1`.

### Building

To update `Css.ts`:

- Run `npm install` in this `css-gen` directory
- Run `npm run generate`

(This is a separate project both for separate of concerns but also because `ts-node` needs different `tsconfig.json` settings than create-react-app wants.)

### Why This Approach?

This approach is "Tachyons-ish" (or Tailwinds-ish), insofar as having cute/short utility class definitions. However, the abbreviations are runtime resolved to object-style CSS-in-JS rules that are then output by emotion, as if the user had written emotion rules straight-up.

The benefits of this approach are:

- We get the brevity of Tachyons/Tailwinds
- It delivers critical CSS, i.e. we don't need the large static TW/Tachyons CSS files.
- Using emotion for psuedo-selectors/breakpoints is simpler and reduces the method bloat
  - I.e. we don't need to suffix `-nl` for "not large" onto every single abbreviation
- "Regular emotion" is always available as an escape hatch for places where utility classes don't make sense
- We can tweak our preferred styles, i.e. `f32` is `32px` instead of `f3` or what not.

### Inspiration

- typed.tw
- xstyles
