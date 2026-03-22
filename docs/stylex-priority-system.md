# Controlled CSS Output Order: StyleX's Priority System

**Status:** Reference Design Doc  
**Purpose:** Drive an alternative build-time CSS-in-JS engine that uses the same "controlled output order" approach as StyleX  
**Source of truth:** [`property-priorities.js`](https://github.com/facebook/stylex/blob/1ddee1dde1d55134c7d4f6889d8cbf34091e72fd/packages/%40stylexjs/shared/src/utils/property-priorities.js#L658)

---

## Part 1: High-Level Overview

### The Problem

In atomic CSS-in-JS systems, every declaration becomes its own class:

```css
.x1a { color: red }
.x1b { margin: 10px }
.x1c { margin-top: 20px }
```

Because every class has identical CSS specificity (one class selector = specificity `0,1,0`), **source order in the stylesheet** is the only tiebreaker. But in a build system that collects styles from many files, the order CSS rules land in the final stylesheet is nondeterministic — it depends on module evaluation order, bundler chunking, code splitting, etc.

This creates three categories of ambiguity:

1. **Shorthand vs. longhand** — Does `margin: 10px` or `margin-top: 20px` win? In native CSS, whichever comes last. In an atomic system, that order is undefined.
2. **Pseudo-class ordering** — Does `:hover` or `:focus` win when both match? Native CSS relies on source order (the LVFHA convention). An atomic system has no inherent order.
3. **At-rule nesting** — Should a `@media` override beat a base style? Should `@container` beat `@media`?

### The Solution: Priority-Based Injection Order

StyleX assigns a **numeric priority** to every generated CSS rule. Rules are sorted by this number before being written to the stylesheet, guaranteeing that:

- **Longhands always appear after shorthands** → longhands win
- **Pseudo-classes appear in a fixed conventional order** → `:active` beats `:hover` beats `:link`
- **At-rules appear after base styles** → media/container queries override defaults
- **Physical properties appear after logical equivalents** → `margin-top` beats `margin-block-start` (for the `property-specificity` resolution mode)

The priority for a single CSS rule is computed as an **additive sum** of its parts:

```
priority = propertyPriority + sum(pseudoPriorities) + sum(atRulePriorities) + sum(constRulePriorities)
```

Where each component is looked up from a static table. This is the key insight: the system is **fully deterministic at build time**, requires no runtime specificity hacks (no `!important`, no deeply nested selectors), and produces the same output regardless of file processing order.

### Walkthrough Examples

#### Example 1: Shorthand vs. Longhand

```js
const styles = stylex.create({
  box: {
    margin: 10,        // shorthand-of-shorthands → priority 1000
    marginTop: 20,     // longhand (logical)      → priority 3000
  }
});
```

Output CSS (sorted by priority):

```css
/* priority 1000 */ .x1a { margin: 10px }
/* priority 3000 */ .x1b { margin-top: 20px }
```

`margin-top: 20px` appears later, so it wins in the cascade. Deterministic, regardless of authoring order.

#### Example 2: Pseudo-Class Ordering

```js
const styles = stylex.create({
  link: {
    color: {
      default: 'blue',     // base longhand     → 3000
      ':hover': 'red',     // 3000 + 130        → 3130
      ':focus': 'green',   // 3000 + 150        → 3150
      ':active': 'purple', // 3000 + 170        → 3170
    }
  }
});
```

Output CSS (sorted):

```css
/* 3000 */ .x1a       { color: blue }
/* 3130 */ .x1b:hover  { color: red }
/* 3150 */ .x1c:focus  { color: green }
/* 3170 */ .x1d:active { color: purple }
```

If an element is both hovered and focused, `:focus` wins because it's injected later. This matches the conventional LVFHA pseudo-class order from CSS best practices.

#### Example 3: Media Query Override

```js
const styles = stylex.create({
  text: {
    fontSize: {
      default: '14px',                        // 3000
      '@media (min-width: 768px)': '16px',    // 3000 + 200 = 3200
    }
  }
});
```

The media query variant gets a higher priority, guaranteeing it overrides the base rule when the condition matches. StyleX also doubles the selector inside `@media` blocks (`.x1b.x1b`) to bump specificity by one class, ensuring the override works even if the base rule appears later in the sheet due to other factors.

#### Example 4: Additive Composition

```js
const styles = stylex.create({
  link: {
    color: {
      default: 'blue',
      ':hover': {
        default: 'red',                         // 3000 + 130 = 3130
        '@media (prefers-color-scheme: dark)': 'orange',  // 3000 + 130 + 200 = 3330
      }
    }
  }
});
```

Nested conditions stack additively. A `:hover` rule inside a `@media` query gets both bonuses.

### The Four Property Tiers

The property classification is the backbone of the system. Every CSS property falls into one of four tiers:

| Priority | Tier | Description | Examples | Expansion |
|----------|------|-------------|----------|-----------|
| **1000** | Shorthand of Shorthands | Properties that expand into other shorthands | `margin`, `padding`, `border`, `font`, `grid`, `animation`, `inset`, `all` | `margin: 10px` → `margin-block` + `margin-inline` → `margin-top` + `margin-bottom` + `margin-left` + `margin-right` |
| **2000** | Shorthand of Longhands | Properties that expand directly into longhands | `margin-block`, `border-top`, `gap`, `flex`, `overflow`, `border-radius`, `transition` | `margin-block: 10px` → `margin-block-start` + `margin-block-end` *(stops here — these are longhands)* |
| **3000** | Longhand (Logical) | Individual properties, including CSS logical properties | `color`, `margin-block-start`, `display`, `flex-grow`, `border-block-start-color` | `margin-block-start: 10px` → *(no further expansion — this is a final value)* |
| **4000** | Longhand (Physical) | Physical-direction equivalents of logical properties | `margin-top`, `border-top-color`, `padding-left`, `top`, `width`, `height` | `margin-top: 10px` → *(no further expansion — physical equivalent of `margin-block-start`)* |

**Key insight:** The physical tier (4000) only exists for properties that have a logical equivalent. Properties like `color` or `display` that don't have physical/logical variants live at 3000. Unknown properties default to 3000.

The physical > logical ordering supports the `property-specificity` `styleResolution` mode where physical properties should always override their logical counterparts.

---

## Part 2: Complete Priority Reference

### Property Priorities

#### Tier 1000 — Shorthand of Shorthands

These are the broadest shorthands — properties that set other shorthand properties, which in turn set longhands.

| Property | Notes |
|----------|-------|
| `all` | Resets nearly everything; avoid in practice |
| `animation` | Sets `animation-name`, `animation-duration`, etc. |
| `background` | Sets `background-color`, `background-image`, `background-position`, etc. |
| `border` | Sets `border-top`, `border-right`, etc. (which are themselves shorthands) |
| `border-block` | Logical; sets `border-block-start` + `border-block-end` |
| `border-inline` | Logical; sets `border-inline-start` + `border-inline-end` |
| `font` | Sets `font-family`, `font-size`, `font-weight`, `line-height`, etc. |
| `grid` | Sets `grid-template` + `grid-auto-*` |
| `grid-area` | Sets `grid-row` + `grid-column` (which expand further) |
| `grid-template` | Sets `grid-template-rows`, `-columns`, `-areas` |
| `inset` | Logical; sets `inset-block` + `inset-inline` |
| `margin` | Sets `margin-block` + `margin-inline` |
| `padding` | Sets `margin-block` + `padding-inline` |
| `scroll-margin` | Sets `scroll-margin-block` + `scroll-margin-inline` |
| `scroll-padding` | Sets `scroll-padding-block` + `scroll-padding-inline` |

#### Tier 2000 — Shorthand of Longhands

These shorthands expand directly into longhand properties.

| Property | Expands to |
|----------|-----------|
| `animation-range` | `animation-range-start`, `animation-range-end` |
| `background-position` | `background-position-x`, `background-position-y` |
| `border-block-start` | `border-block-start-color`, `-style`, `-width` |
| `border-block-end` | `border-block-end-color`, `-style`, `-width` |
| `border-bottom` | `border-bottom-color`, `-style`, `-width` |
| `border-color` | `border-top-color`, `border-right-color`, etc. |
| `border-image` | `border-image-outset`, `-repeat`, `-slice`, `-source`, `-width` |
| `border-inline-color` | `border-inline-start-color`, `border-inline-end-color` |
| `border-inline-end` | `border-inline-end-color`, `-style`, `-width` |
| `border-inline-start` | `border-inline-start-color`, `-style`, `-width` |
| `border-inline-style` | `border-inline-start-style`, `border-inline-end-style` |
| `border-inline-width` | `border-inline-start-width`, `border-inline-end-width` |
| `border-left` | `border-left-color`, `-style`, `-width` |
| `border-radius` | `border-top-left-radius`, etc. |
| `border-right` | `border-right-color`, `-style`, `-width` |
| `border-style` | `border-top-style`, `border-right-style`, etc. |
| `border-top` | `border-top-color`, `-style`, `-width` |
| `border-width` | `border-top-width`, `border-right-width`, etc. |
| `caret` | `caret-color`, `caret-shape` |
| `columns` | `column-count`, `column-width` |
| `column-rule` | `column-rule-color`, `-style`, `-width` |
| `container` | `container-name`, `container-type` |
| `contain-intrinsic-size` | `contain-intrinsic-width`, `-height`, `-block-size`, `-inline-size` |
| `corner-shape` | `corner-top-left-shape`, etc. |
| `flex` | `flex-grow`, `flex-shrink`, `flex-basis` |
| `flex-flow` | `flex-direction`, `flex-wrap` |
| `font-variant` | `font-variant-caps`, `-ligatures`, `-numeric`, etc. |
| `gap` / `grid-gap` | `row-gap`, `column-gap` |
| `grid-column` | `grid-column-start`, `grid-column-end` |
| `grid-row` | `grid-row-start`, `grid-row-end` |
| `grid-template-areas` | (special: sets named grid areas) |
| `inset-block` | `inset-block-start`, `inset-block-end` |
| `inset-inline` | `inset-inline-start`, `inset-inline-end` |
| `list-style` | `list-style-image`, `-position`, `-type` |
| `margin-block` | `margin-block-start`, `margin-block-end` |
| `margin-inline` | `margin-inline-start`, `margin-inline-end` |
| `mask` | `mask-clip`, `-composite`, `-image`, `-mode`, `-origin`, `-position`, `-repeat`, `-size` |
| `mask-border` | `mask-border-mode`, `-outset`, `-repeat`, `-slice`, `-source`, `-width` |
| `offset` | `offset-anchor`, `-distance`, `-path`, `-position`, `-rotate` |
| `outline` | `outline-color`, `-offset`, `-style`, `-width` |
| `overflow` | `overflow-x`, `overflow-y` / `overflow-block`, `overflow-inline` |
| `overscroll-behavior` | `overscroll-behavior-x`, `overscroll-behavior-y` |
| `padding-block` | `padding-block-start`, `padding-block-end` |
| `padding-inline` | `padding-inline-start`, `padding-inline-end` |
| `place-content` | `align-content`, `justify-content` |
| `place-items` | `align-items`, `justify-items` |
| `place-self` | `align-self`, `justify-self` |
| `scroll-margin-block` | `scroll-margin-block-start`, `scroll-margin-block-end` |
| `scroll-margin-inline` | `scroll-margin-inline-start`, `scroll-margin-inline-end` |
| `scroll-padding-block` | `scroll-padding-block-start`, `scroll-padding-block-end` |
| `scroll-padding-inline` | `scroll-padding-inline-start`, `scroll-padding-inline-end` |
| `scroll-snap-type` | (historically a shorthand) |
| `scroll-timeline` | `scroll-timeline-axis`, `scroll-timeline-name` |
| `text-decoration` | `text-decoration-color`, `-line`, `-style`, `-thickness`, `-skip`, `-skip-ink` |
| `text-emphasis` | `text-emphasis-color`, `-position`, `-style` |
| `transition` | `transition-delay`, `-duration`, `-property`, `-timing-function` |
| `view-timeline` | `view-timeline-axis`, `-inset`, `-name` |

#### Tier 3000 — Longhand (Logical)

This is the largest tier. It includes all individual CSS properties that don't have a physical-direction equivalent, plus the logical-direction variants of properties that do. A few representative groups:

**Layout:** `display`, `position`, `z-index`, `float`, `clear`, `box-sizing`, `visibility`

**Flexbox:** `flex-grow`, `flex-shrink`, `flex-basis`, `flex-direction`, `flex-wrap`, `order`, `align-items`, `justify-content`, `align-self`, `justify-self`, `align-content`

**Grid:** `grid-template-columns`, `grid-template-rows`, `grid-auto-flow`, `grid-auto-rows`, `grid-auto-columns`, `grid-row-start`, `grid-row-end`, `grid-column-start`, `grid-column-end`

**Box Model (logical):** `margin-block-start`, `margin-block-end`, `margin-inline-start`, `margin-inline-end`, `padding-block-start`, `padding-block-end`, `padding-inline-start`, `padding-inline-end`, `block-size`, `inline-size`, `min-block-size`, `max-inline-size`, `inset-block-start`, `inset-inline-end`

**Typography:** `font-family`, `font-size`, `font-weight`, `font-style`, `line-height`, `letter-spacing`, `text-align`, `text-transform`, `text-indent`, `white-space`, `word-break`, `hyphens`, `text-wrap`

**Color & Visual:** `color`, `opacity`, `background-color`, `background-image`, `box-shadow`, `text-shadow`, `filter`, `backdrop-filter`

**Border (logical):** `border-block-start-color`, `border-block-start-style`, `border-block-start-width`, `border-inline-end-color`, etc., plus logical border-radius (`border-start-start-radius`, etc.)

**Misc:** `cursor`, `pointer-events`, `user-select`, `content`, `will-change`, `transform`, `perspective`, `accent-color`, `scroll-behavior`, `overflow-anchor`, `touch-action`

For the exhaustive list, see the [source file](https://github.com/facebook/stylex/blob/1ddee1dde1d55134c7d4f6889d8cbf34091e72fd/packages/%40stylexjs/shared/src/utils/property-priorities.js#L658).

#### Tier 4000 — Longhand (Physical)

Only properties that have a logical-property equivalent. These override their logical counterparts in the `property-specificity` resolution mode.

| Physical Property | Logical Equivalent |
|---|---|
| `height` | `block-size` |
| `width` | `inline-size` |
| `min-height` | `min-block-size` |
| `min-width` | `min-inline-size` |
| `max-height` | `max-block-size` |
| `max-width` | `max-inline-size` |
| `margin-top` | `margin-block-start` |
| `margin-bottom` | `margin-block-end` |
| `margin-left` | `margin-inline-start` |
| `margin-right` | `margin-inline-end` |
| `padding-top` | `padding-block-start` |
| `padding-bottom` | `padding-block-end` |
| `padding-left` | `padding-inline-start` |
| `padding-right` | `padding-inline-end` |
| `top` | `inset-block-start` |
| `bottom` | `inset-block-end` |
| `left` | `inset-inline-start` |
| `right` | `inset-inline-end` |
| `border-top-color` | `border-block-start-color` |
| `border-top-style` | `border-block-start-style` |
| `border-top-width` | `border-block-start-width` |
| `border-bottom-color` | `border-block-end-color` |
| `border-bottom-style` | `border-block-end-style` |
| `border-bottom-width` | `border-block-end-width` |
| `border-left-color` | `border-inline-start-color` |
| `border-left-style` | `border-inline-start-style` |
| `border-left-width` | `border-inline-start-width` |
| `border-right-color` | `border-inline-end-color` |
| `border-right-style` | `border-inline-end-style` |
| `border-right-width` | `border-inline-end-width` |
| `border-top-left-radius` | `border-start-start-radius` |
| `border-top-right-radius` | `border-start-end-radius` |
| `border-bottom-left-radius` | `border-end-start-radius` |
| `border-bottom-right-radius` | `border-end-end-radius` |
| `corner-top-left-shape` | `corner-start-start-shape` |
| `corner-top-right-shape` | `corner-start-end-shape` |
| `corner-bottom-left-shape` | `corner-end-start-shape` |
| `corner-bottom-right-shape` | `corner-end-end-shape` |
| `overflow-x` | `overflow-inline` |
| `overflow-y` | `overflow-block` |
| `overscroll-behavior-x` | `overscroll-behavior-inline` |
| `overscroll-behavior-y` | `overscroll-behavior-block` |
| `scroll-margin-top` | `scroll-margin-block-start` |
| `scroll-margin-bottom` | `scroll-margin-block-end` |
| `scroll-margin-left` | `scroll-margin-inline-start` |
| `scroll-margin-right` | `scroll-margin-inline-end` |
| `scroll-padding-top` | `scroll-padding-block-start` |
| `scroll-padding-bottom` | `scroll-padding-block-end` |
| `scroll-padding-left` | `scroll-padding-inline-start` |
| `scroll-padding-right` | `scroll-padding-inline-end` |

### Pseudo-Class Priorities

Added to the property priority when a pseudo-class condition is present. Ordered to match conventional CSS authoring expectations (LVFHA pattern and beyond).

| Priority | Pseudo-Class | Category |
|----------|-------------|----------|
| 40 | `:is`, `:where`, `:not` | Functional selectors |
| 45 | `:has` | Relational |
| 50 | `:dir` | Directionality |
| 51 | `:lang` | Language |
| 52 | `:first-child` | Structural (tree) |
| 53 | `:first-of-type` | Structural (tree) |
| 54 | `:last-child` | Structural (tree) |
| 55 | `:last-of-type` | Structural (tree) |
| 56 | `:only-child` | Structural (tree) |
| 57 | `:only-of-type` | Structural (tree) |
| 60 | `:nth-child` | Structural (nth) |
| 61 | `:nth-last-child` | Structural (nth) |
| 62 | `:nth-of-type` | Structural (nth) |
| 63 | `:nth-last-of-type` | Structural (nth) |
| 70 | `:empty` | Structural (content) |
| 80 | `:link` | Link/Navigation |
| 81 | `:any-link` | Link/Navigation |
| 82 | `:local-link` | Link/Navigation |
| 83 | `:target-within` | Link/Navigation |
| 84 | `:target` | Link/Navigation |
| 85 | `:visited` | Link/Navigation |
| 91 | `:enabled` | Form state |
| 92 | `:disabled` | Form state |
| 93 | `:required` | Form state |
| 94 | `:optional` | Form state |
| 95 | `:read-only` | Form state |
| 96 | `:read-write` | Form state |
| 97 | `:placeholder-shown` | Form state |
| 98 | `:in-range` | Form validation |
| 99 | `:out-of-range` | Form validation |
| 100 | `:default` | Form validation |
| 101 | `:checked`, `:indeterminate` | Form validation |
| 102 | `:blank` | Form validation |
| 103 | `:valid` | Form validation |
| 104 | `:invalid` | Form validation |
| 105 | `:user-invalid` | Form validation |
| 110 | `:autofill` | UI state |
| 120 | `:picture-in-picture` | UI state |
| 121 | `:modal` | UI state |
| 122 | `:fullscreen` | UI state |
| 123 | `:paused` | Media state |
| 124 | `:playing` | Media state |
| 125 | `:current` | Timeline |
| 126 | `:past` | Timeline |
| 127 | `:future` | Timeline |
| **130** | **`:hover`** | **Interaction (LVFHA)** |
| **140** | **`:focusWithin`** | **Interaction** |
| **150** | **`:focus`** | **Interaction (LVFHA)** |
| **160** | **`:focusVisible`** | **Interaction** |
| **170** | **`:active`** | **Interaction (LVFHA)** |

The interaction pseudo-classes (130–170) are the most commonly used and follow the standard LVFHA ordering convention where `:active` overrides `:focus` overrides `:hover`.

Unknown pseudo-classes default to priority **40**.

### Relational Selector Priorities

StyleX supports relational selectors (ancestor/descendant/sibling conditions) via `stylex.when`. These use the pseudo-class value (divided by 100) as a fractional offset from a base:

| Base | Selector Pattern | Example |
|------|-----------------|---------|
| 10 + pseudoBase | Ancestor condition | `:where(.class:hover *)` |
| 15 + pseudoBase | Descendant condition | `:where(:has(.class:hover))` |
| 20 + pseudoBase | Any sibling | Combined before + after |
| 30 + pseudoBase | Sibling before | `:where(.class:hover ~ *)` |
| 40 + pseudoBase | Sibling after | `:where(:has(~ .class:hover))` |

Where `pseudoBase = PSEUDO_CLASS_PRIORITIES[pseudo] / 100` (e.g., `:hover` → `130 / 100 = 1.3`).

### At-Rule Priorities

Added to the property priority when wrapped in an at-rule condition.

| Priority | At-Rule | Rationale |
|----------|---------|-----------|
| 1 | `--custom-property` | CSS custom property definitions; minimal priority |
| 30 | `@supports` | Feature queries; low priority since they gate capability, not override |
| 200 | `@media` | Responsive overrides; should beat base styles and pseudo-classes |
| 300 | `@container` | Container queries; should beat media queries (more specific context) |

Multiple at-rules are additive: a rule inside both `@supports` and `@media` gets priority `+230`.

### Pseudo-Element Priority

| Priority | Selector |
|----------|----------|
| 5000 | `::before`, `::after`, `::placeholder`, `::selection`, etc. |

All pseudo-elements share a single high priority (5000), ensuring they sort into their own band well above any property or pseudo-class combination.

### Compound Pseudo Priorities

Chained pseudo-classes/pseudo-elements (e.g., `::placeholder:hover`) have their individual priorities summed. For example, `::placeholder:hover` = 5000 + 130 = 5130. This only applies to simple chains without functional pseudo-classes.

### The Priority Formula

For any given CSS rule, the final priority is:

```
priority = getDefaultPriority(property)        // 1000 | 2000 | 3000 | 4000
         + sum(pseudos.map(getPriority))        // e.g., 130 for :hover
         + sum(atRules.map(getPriority))        // e.g., 200 for @media
         + sum(constRules.map(getPriority))     // e.g., stylex.when conditions
```

**Concrete examples:**

| Rule | Calculation | Priority |
|------|-------------|----------|
| `color: red` | 3000 | 3000 |
| `margin: 10px` | 1000 | 1000 |
| `margin-top: 10px` (logical = `margin-block-start`) | 3000 | 3000 |
| `margin-top: 10px` (physical) | 4000 | 4000 |
| `color:hover` | 3000 + 130 | 3130 |
| `color:active` | 3000 + 170 | 3170 |
| `color @media(...)` | 3000 + 200 | 3200 |
| `color:hover @media(...)` | 3000 + 130 + 200 | 3330 |
| `margin @media(...)` | 1000 + 200 | 1200 |
| `::before color` | 5000 + 3000 | 8000 |

### Design Decisions & Tradeoffs

**Why additive?** Additive composition is simple, predictable, and supports arbitrary nesting depth. The gaps between tiers (1000 apart) ensure that no realistic combination of pseudo-classes or at-rules can cause a shorthand to accidentally outprioritize a longhand.

**Why 4 property tiers instead of 2?** The logical vs. physical split (3000 vs. 4000) supports the `property-specificity` `styleResolution` mode used by React Native StyleX, where physical properties always override logical ones regardless of application order.

**Known limitation — media query ordering:** Multiple `@media` rules for the same property all receive the same `+200` bonus, so their relative order among themselves is undefined. GitHub issue [#82](https://github.com/facebook/stylex/issues/82) tracks this. A workaround is to incorporate breakpoint values into the priority, but StyleX has not adopted this yet.

**Unknown properties default to 3000.** Any CSS property not explicitly classified is treated as a longhand, which is the safest default since most properties are longhands.
