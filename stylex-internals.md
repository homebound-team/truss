# StyleX Internals: How `stylex.create` and `stylex.props` Actually Work

## The Data Structure from `stylex.create`

`stylex.create` is a compile-time macro. At build time, the Babel plugin transforms it into a plain object where each named style becomes an entry with this shape:

```js
// Source
const styles = stylex.create({
  red:  { color: 'red' },
  blue: { color: 'blue', fontSize: 16 },
  bold: { fontWeight: 'bold', color: 'green' },
});

// Compiled output (production)
const styles = {
  red:  { kMwMTN: "x1e2nbdu",                    $$css: true },
  blue: { kMwMTN: "xju2f9n",  kGuDYH: "x1j61zf2", $$css: true },
  bold: { k63SB2: "x117nqv4", kMwMTN: "x1prwzq3",  $$css: true },
};
```

Each style object has:

- **`$$css: true`** — a sentinel marking it as a compiled StyleX object (vs. an inline style).
- **One key per CSS property**, where the key is a short hash of the property name and the value is a space-separated string of atomic CSS class names.

In dev mode, keys are more readable: `"color-kMwMTN"`, `"backgroundColor-kWkggS"`, etc. In production, only the hash portion is kept: `kMwMTN`, `kWkggS`.

The CSS classes themselves (like `x1e2nbdu`) are injected into the document as atomic rules:
```css
.x1e2nbdu { color: red }
.xju2f9n  { color: blue }
.x1j61zf2 { font-size: 16px }
```

## The Key Insight: One Key Per *Logical Property*, Not Per Selector

This is the critical design decision. When you use pseudo-selectors or media queries, **all the resulting classes are bundled into a single value string under the same property key**:

```js
// Source
stylex.create({
  base: {
    color: { default: 'red', ':hover': 'blue', ':focus': 'green' },
  },
});

// Compiled — ONE key, THREE classes in the value
{
  base: {
    kMwMTN: "x1e2nbdu x17z2mba x166idng",
    //       ^default  ^:hover   ^:focus
    $$css: true,
  },
}
```

The injected CSS uses different selectors and priorities to make them work:
```css
.x1e2nbdu       { color: red }           /* priority: 3000 */
.x17z2mba:hover { color: blue }          /* priority: 3130 */
.x166idng:focus { color: green }          /* priority: 3150 */
```

Media queries follow the same pattern:
```js
// Source
{ color: { default: 'red', '@media (min-width: 768px)': 'blue' } }

// Compiled
{ kMwMTN: "x1e2nbdu x1l9h3i5", $$css: true }

// Injected CSS (note the doubled selector for specificity)
// .x1e2nbdu { color: red }                                           priority: 3000
// @media (min-width: 768px) { .x1l9h3i5.x1l9h3i5 { color: blue } }  priority: 3200
```

## How `stylex.props` Resolves Conflicts: The `styleq` Algorithm

`stylex.props` delegates to a library called **`styleq`**. The algorithm is:

1. Collect all style arguments into an array.
2. **Pop from the end** (last argument processed first → last-wins semantics).
3. For each compiled style object (`$$css === true`), iterate its keys.
4. Maintain a `definedProperties` array tracking which property keys have been claimed.
5. If a key has already been seen → **skip it entirely** (the value string is discarded).
6. If a key has NOT been seen → push the key into `definedProperties`, append the value (class names) to the output.
7. Return `{ className: "..." }`.

### Static optimization

When all arguments to `stylex.props` are statically known, the Babel plugin **runs this merge at compile time** and emits the result as a literal object. No runtime work happens at all:

```js
// Source
const result = stylex.props(styles.red, styles.blue);

// Compiled — already resolved, blue wins
const result = { className: "xju2f9n" };
```

### Dynamic/conditional cases

When there's a condition, the plugin pre-computes all possible outcomes:

```js
// Source
<div {...stylex.props(s.bold, props.isBlue ? s.blue : s.red)} />

// Compiled — a lookup table indexed by the boolean
{
  0: { className: "x117nqv4 x1e2nbdu" },  // bold + red
  1: { className: "x117nqv4 xju2f9n" },   // bold + blue
}[!!props.isBlue << 0]
```

## Conflict Resolution: What Wins and What Gets Wiped

### Same property, different values → last wins completely

```js
stylex.props(styles.red, styles.blue)
// red has  kMwMTN: "x1e2nbdu"
// blue has kMwMTN: "xju2f9n"
// Result: { className: "xju2f9n" }  ← blue wins, red discarded
```

### CRITICAL: Pseudo-selectors are NOT kept separate

Because `:hover`, `:focus`, and `@media` classes are all bundled into the SAME key value, **overriding the property at all replaces the entire bundle**:

```js
const styles = stylex.create({
  withHover: { color: { default: 'red', ':hover': 'blue' } },
  //   → kMwMTN: "x1e2nbdu x17z2mba"  (default + hover)
  
  plainGreen: { color: 'green' },
  //   → kMwMTN: "x1prwzq3"            (default only)
});

stylex.props(styles.withHover, styles.plainGreen)
// Result: { className: "x1prwzq3" }
// The :hover is GONE. plainGreen's value replaced the entire kMwMTN entry.
```

This is by design. The key represents "who owns the `color` property." Whoever goes last owns it completely — default, hover, focus, media, all of it.

### Replacing hover+default with a different hover+default

```js
const styles = stylex.create({
  withHover:     { color: { default: 'red',   ':hover': 'blue'   } },
  // kMwMTN: "x1e2nbdu x17z2mba"
  
  diffHover:     { color: { default: 'green', ':hover': 'orange' } },
  // kMwMTN: "x1prwzq3 x1ahxo3w"
});

stylex.props(styles.withHover, styles.diffHover)
// Result: { className: "x1prwzq3 x1ahxo3w" }
// Both default AND hover replaced atomically.
```

### Partial pseudo-selector overlap is also a full replacement

```js
const styles = stylex.create({
  hoverOnly: { color: { default: 'black', ':hover': 'red' } },
  // kMwMTN: "x1mqxbix x1dgwipm"
  
  focusOnly: { color: { default: 'black', ':focus': 'blue' } },
  // kMwMTN: "x1mqxbix x1cg8fzh"
});

stylex.props(styles.hoverOnly, styles.focusOnly)
// Result: { className: "x1mqxbix x1cg8fzh" }
// focusOnly wins entirely. The :hover from hoverOnly is GONE.
// There is no "merge the hover from A with the focus from B."
```

### Different properties coexist fine

```js
stylex.props(styles.red, styles.bold)
// red  has kMwMTN (color), bold has k63SB2 (fontWeight) + kMwMTN (color)
// bold's kMwMTN wins over red's. bold's k63SB2 is new. 
// Result: { className: "x1prwzq3 x117nqv4" }  (green color + bold)
```

### Shorthand vs longhand: separate keys, both kept

```js
const s = stylex.create({
  shortMargin:   { margin: 10 },     // key: kogj98
  longMarginTop: { marginTop: 5 },   // key: keoZOQ
});

stylex.props(s.shortMargin, s.longMarginTop)
// Result: { className: "x1oin6zd x1ok221b" }
// Both kept! Different keys. CSS specificity resolves it:
// margin: 10px    → priority 1000 (shorthand)
// margin-top: 5px → priority 4000 (longhand)
// So margin-top: 5px wins for the top edge via CSS cascade.
```

## Dynamic Styles (Function Arguments to `stylex.create`)

When a style uses a function parameter, StyleX compiles to CSS custom properties:

```js
// Source
const s = stylex.create({
  dynamic: (color) => ({ color: color, fontSize: 16 }),
});

// Compiled
const s = {
  dynamic: (color) => [
    { kGuDYH: "x1j61zf2", $$css: true },          // static part
    { kMwMTN: color != null ? "x14rh7hd" : color, $$css: true },  // dynamic class
    { "--x-color": color != null ? color : undefined },            // inline style
  ],
};

// Injected CSS
// .x14rh7hd { color: var(--x-color) }
// @property --x-color { syntax: "*"; inherits: false; }
```

The dynamic value becomes a CSS custom property. `stylex.props` handles the third
element in the array as an inline style object (no `$$css` key → treated as inline styles).

## Summary Table

| Scenario | Same key? | Behavior |
|---|---|---|
| Two styles setting `color` to different values | Yes (`kMwMTN`) | Last wins, first discarded |
| `color` plain vs `color` with `:hover` | Yes (`kMwMTN`) | Last wins entirely, pseudo-selectors included |
| `color` with `:hover` vs `color` with `:focus` | Yes (`kMwMTN`) | Last wins entirely — no merging of pseudo-selectors |
| `color` vs `backgroundColor` | No (different keys) | Both kept |
| `margin` (shorthand) vs `marginTop` (longhand) | No (different keys) | Both kept; CSS priority resolves |
| Static merge | N/A | Resolved at compile time, zero runtime cost |
| Dynamic conditional | N/A | Pre-computed lookup table of all possible outcomes |
