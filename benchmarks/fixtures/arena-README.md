# CSS-in-JS Arena

Benchmark harness for **compile-time CSS engines**. Each engine gets its own React Router 8 app under
`apps/`, all rendering the same six-page admin console: identical markup, design and data, verified
pixel-identical before anything is measured.

Tailwind is not CSS-in-JS. It is here because it answers the same questions — styles resolved ahead
of time from source the compiler reads, no runtime style injection — and because it is what most
teams reach for instead.

| Engine | Integration | Version |
| --- | --- | --- |
| [Bamboo CSS](https://bamboocss.com) | `@bamboocss/vite` | 1.55.0 |
| [StyleX](https://stylexjs.com) | `@stylexjs/unplugin` | 0.19.0 |
| [Panda CSS](https://panda-css.com) | `@pandacss/postcss` | 1.12.0 |
| [Truss](https://github.com/homebound-team/truss) | `@homebound/truss/plugin` | 2.33.1 |
| [Tailwind CSS](https://tailwindcss.com) | `@tailwindcss/vite` | 4.3.3 |

Measured 2026-09-19 · Linux, Node 26.9, Vite 8.2.1–8.2.2

| Engine | Shipped bytes | Build & dev | Authoring | Correctness & maintenance | Rows won 🏆 |
| --- | --- | --- | --- | --- | --- |
| Bamboo | 4 / 11 | 0 / 7 | 7 / 9 | **4** / 4 🏆 | 15 / 31 |
| StyleX | 3 / 11 | 0 / 7 | 2 / 9 | 1 / 4 | 6 / 31 |
| Panda | 1 / 11 | 1 / 7 | 6 / 9 | 1 / 4 | 9 / 31 |
| **Truss** 🏆 | **11** / 11 🏆 | 1 / 7 | **9** / 9 🏆 | 3 / 4 | **24** / 31 🏆 |
| Tailwind | 3 / 11 | **7** / 7 🏆 | 8 / 9 | 1 / 4 | 19 / 31 |

Axes are not equally weighted and two are unscored, so the tally is a scanning aid, not the
judgement.

**Truss wins every shipped-bytes and authoring row.** Its stylesheet is a third smaller than
Bamboo's, it has the lowest marginal cost per declaration, and it writes the fewest class-attribute
bytes into the HTML — none of which depends on this app's size.

**Tailwind wins every build-and-dev row.** It builds in 717 ms against Truss's 1,030, boots a dev
server in 892 ms, and answers both edit kinds fastest. Its build slope is the lowest measured,
0.31 ms per added source file against Truss's 0.67, so that lead widens with inventory rather than
narrowing. It pays for this elsewhere: its raw stylesheet is 52 KB, and although utility rules
compress well enough to land within 3% of Bamboo, `tailwind-merge` and `clsx` add 8,001 B brotli of
client JavaScript, which is most of why it has the largest first load of the five.

**Bamboo takes the correctness category outright.** It is the only engine that both fails the build
on a mistyped token and flags a mistyped property, and it prunes the most CSS when a page is deleted
— though that row rewards having had more to delete, and Truss still ships less CSS after the
deletion than Bamboo does before it.

The two engines that catch nothing are Panda and Tailwind. Tailwind has no types over class names at
all: both typo probes typecheck clean, build clean, and silently drop the declaration.

---

## Full results

| Axis | Bamboo | StyleX | Panda | Truss 🏆 | Tailwind |
| --- | --- | --- | --- | --- | --- |
| **Shipped bytes** | | | | | |
| Full first load | **105,605 B** 🏆 | **106,122 B** 🏆 | 112,835 B | **104,783 B** 🏆 | 113,164 B |
| CSS, brotli | 7,357 B | 7,008 B | 9,518 B | **5,612 B** 🏆 | 7,157 B |
| CSS, gzip | 8,627 B | 8,200 B | 11,489 B | **6,657 B** 🏆 | 8,494 B |
| CSS, raw | 43,420 B | 40,430 B | 54,007 B | **28,432 B** 🏆 | 52,116 B |
| CSS rules emitted *(not a quality axis)* | 463 | 467 | 532 | 450 | 449 |
| Client JS, brotli | **92,712 B** 🏆 | **93,583 B** 🏆 | 97,778 B | **94,053 B** 🏆 | 100,824 B (`tailwind-merge` + `clsx`, 8,001 B) |
| SSR HTML, gzip, mean of 6 | 5,536 B | 5,531 B | 5,539 B | **5,118 B** 🏆 | **5,183 B** 🏆 |
| Class attribute bytes, raw | 93,036 B | 70,843 B | 92,738 B | **62,375 B** 🏆 | 74,043 B |
| Class attribute bytes, selector-heavy route | 11,728 B | 11,754 B | 11,685 B | **7,702 B** 🏆 | 9,189 B |
| Unreachable CSS shipped | **0 B** 🏆 | 344 B | n/a (runtime) | **0 B** 🏆 | **0 B** 🏆 |
| Orphan file in `include` (50 styles), imported by nothing | +2 B | **+0 B** 🏆 | +13,200 B | **+0 B** 🏆 (no `include`; compiles the bundle graph) | +21,100 B |
| Stylesheets emitted | **1** 🏆 | 2 (one unreferenced) | **1** 🏆 | **1** 🏆 | **1** 🏆 |
| **Build & dev** | | | | | |
| Production build, cold | 1,552 ms | 1,867 ms | 2,007 ms | 1,030 ms (codegen committed, not run per build) | **717 ms** 🏆 |
| Production build, warm | 1,537 ms | 1,859 ms | 2,013 ms | 1,019 ms | **720 ms** 🏆 |
| Dev server cold start | 1,762 ms | 1,532 ms | 1,660 ms | 1,041 ms | **892 ms** 🏆 |
| Shared edit → server reacts *(not measurable: no update payload reaches a browserless client)* | — | — | — | — | — |
| Shared edit → correct paint | 142.9 ms | 78.5 ms | 126.5 ms | 62.0 ms | **56.5 ms** 🏆 |
| Component edit → server reacts | 19 ms | 49 ms | **4 ms** 🏆 | 16 ms | **4 ms** 🏆 |
| Component edit → correct paint | 111.3 ms | 188.7 ms | 119.9 ms | 111.5 ms | **68.4 ms** 🏆 |
| HMR payload, one shared edit | 342 KB · 9 | 392 KB · 11 | 402 KB · 9 | **331 KB · 8** 🏆 | **328 KB · 9** 🏆 |
| **Authoring** | | | | | |
| Total lines written | 3,921 | 4,090 | 3,930 | **2,331** 🏆 (one line per style) | **2,344** 🏆 |
| Structural & relational selectors | **one rule on the container** 🏆 | class per cell, `last` in JS | **one rule on the container** 🏆 | **one rule on the container** 🏆 (in a `.css.ts`) | **one rule on the container** 🏆 (in a `.css` file) |
| Next-sibling selector (`+`) | **yes** 🏆 | `~` only, via `when` + a marker | **yes** 🏆 | **yes** 🏆 (in a `.css.ts`) | **yes** 🏆 (in a `.css` file) |
| Component variants, typed and exhaustive | **`cva`, inferred props** 🏆 | compose per call site | **`cva`, inferred props** 🏆 | **`Record<Union, Properties>`, declared props** 🏆 | **`cva`, inferred props** 🏆 |
| Light/dark theming | **2 values per token** 🏆 | 3 values per token | 4 values per token | **2 values per token** 🏆 (custom properties, hand-declared) | **2 values per token** 🏆 (custom properties, hand-declared) |
| Dynamic values | inline `style` | **custom property** 🏆 (survives the cascade) | inline `style` | **custom property** 🏆 (survives the cascade) | inline `style` |
| Register an `@property` (not via `globalCss`) | **`global.vars`** 🏆 | **`stylex.types.*`** 🏆 | **`globalVars`** 🏆 | **`tokens` object form** 🏆 | **the at-rule itself** 🏆 (the config is CSS) |
| Animate a registered property | **yes** 🏆 | declaration dropped, no keyframe or rule | **yes** 🏆 | **yes** 🏆 (`keyframes` config) | **yes** 🏆 |
| Links its stylesheet in a server-rendered app | **`import "virtual:bamboo.css"`** 🏆 | dev needs a shim in `root.tsx` | **plain CSS import** 🏆 | **`import "virtual:truss.css"`** 🏆 | **plain CSS import** 🏆 |
| **Correctness & maintenance** | | | | | |
| Mistyped token name | **build fails** 🏆 | TS error, build succeeds | not caught at all | **build fails** 🏆 (with a did-you-mean) | not caught at all |
| Mistyped property name | **caught** (TS2561) 🏆 | ships `pading-block` | **caught** (TS2561) 🏆 | **caught** (TS2345) 🏆 | not caught at all |
| Delete a page → CSS shrinks | **−22.0%** 🏆 | −8.4% | −13.5% | −12.6% | −3.9% |
| Class names folded to literals | **507 / 507** 🏆 | **451 / 454** 🏆 | 2 / 503 (rest computed in browser, 14.7 KB runtime chunk) | **418 / 418** 🏆 | **377 / 377** 🏆 |
| | | | | | |
| **Rows won**, of 31 scored 🏆 | **15** | **6** | **9** | **24** | **19** |

---

## Where the main table doesn't generalise

One app, one configuration. Three things move the answer: style count, file count, theme count.

### Style volume

The arena is 662 rule blocks. `tools/scale.mjs` generates *N* all-distinct style definitions and
measures the emitted stylesheet.

**Downloaded stylesheet, brotli, relative to Bamboo:**

| Style definitions | Bamboo | StyleX | Panda | Truss | Tailwind |
| --- | --- | --- | --- | --- | --- |
| 0 (as shipped) | ref | −4.7% | +29.4% | −23.7% | −2.7% |
| 50 | ref | +9.8% | +26.0% | −22.4% | −1.7% |
| 200 | ref | +42.1% | +21.0% | −20.0% | +1.2% |
| 800 | ref | **+96.0%** | **+12.3%** | **−16.4%** | **+4.2%** |

| | Marginal cost per declaration | Gap to Bamboo at n=0 | at n=800 |
| --- | --- | --- | --- |
| Bamboo | 44.0 B raw · 2.0 B brotli | ref | ref |
| Panda | 40.3 B raw · 2.0 B brotli | +10,587 B | −7,013 B |
| StyleX | 65.8 B raw · 5.5 B brotli | −2,990 B | +101,809 B |
| Truss | 33.4 B raw · 1.8 B brotli | −14,988 B | −65,788 B |
| Tailwind | 64.0 B raw · 2.2 B brotli | +8,696 B | +104,996 B |

**The baseline ranking does not fully survive added style volume.** StyleX starts below Bamboo and
crosses it before 50 generated definitions: it is almost pure slope, since every rule carries
`:not(#\#)` specificity padding that repeats per declaration and compresses badly. Bamboo and Panda
add 2.0 B brotli per declaration, so Panda's compressed penalty stays close to 2.1 KB even though its
lower raw slope crosses Bamboo by 800 definitions. Truss has the lowest slope on both axes, so its
lead over Bamboo narrows from 24% to 16% across the sweep but holds throughout.

**Tailwind's compressed parity with Bamboo is a property of this app's size.** It ships 8.7 KB more
raw CSS at n=0 and adds 64.0 B raw per declaration, nearly StyleX's slope; what keeps it competitive
is that utility rules are near-identical strings, so brotli reduces a 2.2 B marginal cost out of
that. It starts 2.7% under Bamboo, crosses over before 200 definitions, and ends 4.2% above.

### Dev loop and app size

`tools/dev-scale.mjs` adds *N* generated source files and re-measures. Every module carries identical
declarations, so they fold to the same classes: the first generated module changes Bamboo from
43,420 to 43,604 B, Truss from 28,432 to 28,571 B and Tailwind from 52,116 to 52,385 B, then the
stylesheets stay flat while only file count grows.

**Edit → HMR broadcast, ms:**

| Extra source files | Bamboo | StyleX | Panda | Truss | Tailwind |
| --- | --- | --- | --- | --- | --- |
| 0 (as shipped) | 11 | 2 | 2 | 2 | 2 |
| 25 | 11 | 2 | 2 | 2 | 2 |
| 100 | 12 | 2 | 2 | 2 | 2 |
| 400 | 12 | 2 | 2 | 2 | 2 |

This column counts the first broadcast of any kind, so it answers "does this engine's own reaction
grow with the inventory" within one engine; it is not a cross-engine comparison, for the reason the
main table's server-reaction row gives.

**There is no per-edit growth with file count.** StyleX, Panda, Truss and Tailwind answer a shared
edit in 2 ms at every size; Bamboo sits at 11–12 ms with no slope either. Whole-inventory work is not
flat:

| | Bamboo | StyleX | Panda | Truss | Tailwind |
| --- | --- | --- | --- | --- | --- |
| Production build, 0 → 400 files | 1,535 → 2,078 ms | 1,844 → 2,601 ms | 2,001 → 2,287 ms | 1,006 → 1,284 ms | 706 → 824 ms |
| — per added file | 1.36 ms | 1.89 ms | 0.72 ms | 0.70 ms | 0.30 ms |
| Dev server cold start, 0 → 400 files | 1,636 → 2,225 ms | 1,335 → 1,982 ms | 1,499 → 1,868 ms | 981 → 1,410 ms | 851 → 1,024 ms |
| — per added file | 1.47 ms | 1.62 ms | 0.92 ms | 1.07 ms | 0.43 ms |

Read the milliseconds, not a percentage: the app is 13 source files, so 400 more is 32× the inventory
and any per-file constant reads as a large percentage off that base. Carried out to 1,600 extra files
(`COUNTS=0,400,800,1600`), the build result is:

| Extra source files | 0 | 400 | 800 | 1,600 | per added file |
| --- | --- | --- | --- | --- | --- |
| Bamboo | 1,522 ms | 2,037 ms | 2,516 ms | 3,444 ms | 1.20 ms |
| StyleX | 1,817 ms | 2,558 ms | 3,180 ms | 4,459 ms | 1.65 ms |
| Panda | 1,959 ms | 2,265 ms | 2,489 ms | 2,994 ms | 0.65 ms |
| Truss | 1,004 ms | 1,294 ms | 1,534 ms | 2,081 ms | 0.67 ms |
| Tailwind | 709 ms | 823 ms | 935 ms | 1,209 ms | 0.31 ms |

**Tailwind is fastest at every size and has the lowest slope**, so its build win widens across the
measured range rather than eroding. Truss and Panda sit on almost the same slope, with Truss ahead
throughout on the constant. Bamboo starts faster than Panda and crosses it between 400 and 800 extra
files, on the strength of a slope nearly twice Panda's. StyleX starts ahead of Panda and is last from
400 files on.

Run the same sweep with `ORPHANED=1` and the generated modules remain inside `include` but outside the
bundle graph:

| Orphaned source files | Bamboo | StyleX | Panda | Truss | Tailwind |
| --- | --- | --- | --- | --- | --- |
| 0 | 1,515 ms | 1,827 ms | 1,964 ms | 1,005 ms | 699 ms |
| 400 | 1,627 ms | 1,817 ms | 2,119 ms | 1,010 ms | 711 ms |
| 800 | 1,730 ms | 1,823 ms | 2,241 ms | 1,000 ms | 712 ms |
| 1,600 | 1,913 ms | 1,824 ms | 2,419 ms | 1,022 ms | 724 ms |
| CSS emitted, 0 → 1,600 | +2 B | **+0 B** 🏆 | +168 B | **+0 B** 🏆 | +269 B |

Over the 400→1,600 segment Bamboo adds 0.24 ms per orphaned file and Panda 0.25 ms; StyleX, Truss and
Tailwind add nothing measurable. For StyleX and Truss that is because neither reads a file the bundle
does not reach. **Tailwind is the one engine that splits the two costs**: it scans orphaned files for
free but still emits their rules, where Panda pays in both time and bytes. Output does not grow per
file here, because every generated module contains the same declarations — Bamboo adds a fixed 2 B
once any matching orphan exists, Panda a fixed 168 B and Tailwind a fixed 269 B.

### Theming

The arena ships no brand themes. `tools/theming.mjs` injects *N* through each engine's own multi-theme
mechanism (Bamboo `theme.variants`, Panda `themes`, StyleX `createTheme`; Truss and Tailwind have no
theme API, so both get a custom-property block per theme, which is the documented answer for each),
each overriding the same 18 colours light and dark.

**Stylesheet the browser downloads, brotli:**

| Brand themes | Bamboo | StyleX | Panda | Truss | Tailwind |
| --- | --- | --- | --- | --- | --- |
| 0 | 7,357 B | 7,008 B | 9,518 B | 5,612 B | 7,157 B |
| 2 | 7,357 B | 7,427 B | 9,518 B | 5,939 B | 7,457 B |
| 8 | 7,357 B | 8,350 B | 9,518 B | 6,681 B | 8,228 B |
| **added per theme** | **0 B** 🏆 | +168 B | **0 B** 🏆 | +134 B | +134 B |

**Theme payload, fetched only when a theme is selected:**

| Axis | Bamboo | StyleX | Panda | Truss | Tailwind |
| --- | --- | --- | --- | --- | --- |
| Bytes per theme | **1,374 B** 🏆 | n/a (in the stylesheet) | 2,805 B | n/a (in the stylesheet) | n/a (in the stylesheet) |
| Themes in the critical path | **none** 🏆 | all of them | **none** 🏆 | all of them | all of them |

Two mechanisms, not five. Bamboo and Panda emit each theme as its own artifact loaded on demand, so
first load is flat however many exist. StyleX's `createTheme` and the custom-property blocks Truss and
Tailwind use compile into the linked stylesheet, so every visitor pays for every theme: at eight,
StyleX's CSS is **19% larger** than at zero, Truss's **19%** and Tailwind's **15%**. Between the lazy
two it is the light/dark encoding again, Bamboo writing `base` and `_osDark` and letting
`light-dark()` resolve the rest against Panda's four values, **2.04× the bytes per theme**. For a site
with one fixed brand theme this reverses: a lazy artifact is a second request for bytes the
stylesheet would have carried anyway. Truss's stylesheet is small enough that it still downloads less
at eight themes than any other engine does at zero.

---

## What's measured

### Ground rules

- **One reference app.** `apps/bamboo` is the reference. Every other is diffed against it element for
  element, then pixel for pixel, so all match each other transitively.
- **Shared source is byte-identical.** `data.ts`, `icons.tsx` and `chart-utils.ts` are the same bytes
  in every app.
- **Same baseline reset.** Engines shipping one use theirs. Engines that do not vendor Bamboo's
  `preflight` verbatim, so nobody gets a typography head start. Where an engine's own reset is close
  but not identical, the difference is written back in: Tailwind's preflight omits `text-wrap:
  balance`, `overflow-wrap: break-word` and `body { line-height: inherit; height: 100% }`, and its
  `@layer base` restores those three.
- **Default configuration only.** Opt-in settings are reported separately, never folded into the main
  table.

### Pages

| Route | What it exercises |
| --- | --- |
| `/` | KPI grid, SVG bar chart + sparklines, activity feed, responsive 2-col dashboard |
| `/projects` | Data table, status badges, progress bars, toolbar, pagination |
| `/settings` | Sticky section nav, 2-col form grid, validation states, toggle switches, radio cards, danger zone, sticky save bar |
| `/pricing` | Featured pricing cards, billing toggle, comparison table, `<details>` FAQ |
| `/docs` | 3-column docs layout, prose typography, code block, callouts, table, TOC |
| `/lab` | Structural + relational selectors, keyframe motion, container queries |

All six are responsive across three breakpoints and support system dark mode plus an explicit toggle.

---

## Reproducing this

Every number comes from one contiguous session on one machine. Harness, parity gate and exact commands
are in **[`RUNNING.md`](./RUNNING.md)**.

---

## FAQ

<details>
<summary><strong>Why is CSS minification disabled?</strong></summary>

`build.cssMinify: false` in all five apps. Vite's default runs Lightning CSS over the stylesheet and
rewrites it, most visibly downlevelling `light-dark()` into a 54-variable polyfill under the
`baseline-widely-available` target. That measures the downleveller, and penalises only engines
emitting modern CSS. Off, every stylesheet here is what its engine wrote.

StyleX and Tailwind still show Lightning CSS output because each depends on it directly — StyleX
through `@stylexjs/unplugin`, Tailwind inside its own optimisation pass. That is their product, not
the harness. It is visible in Tailwind's stylesheet as an `@supports (color: color-mix(…))` fallback
pair around every `color-mix()` token.

</details>

<details>
<summary><strong>Is Tailwind in scope for a CSS-in-JS comparison?</strong></summary>

It is not CSS-in-JS, and it is included anyway. Every axis here is about what a compiler does with
styles it reads out of source before the browser runs: what it emits, how fast it emits it, what it
catches, and what the author had to write. Tailwind answers all of those, and it is the alternative
most teams are actually choosing between.

Two axes read differently as a result. **Authoring lines** counts a `cva()` recipe, a `const` bound
to a class string, and the `const s = { … }` map at the foot of a route, which is where a Tailwind
style is declared. **Class names folded to literals** is trivially 377 / 377, since a Tailwind class
name is a literal by construction rather than by compilation.

</details>

<details>
<summary><strong>Why does Tailwind ship the most client JavaScript?</strong></summary>

Because of the variant stack, not the compiler. Tailwind emits no runtime of its own. The app uses
`cva` for variants and resolves the conflicts it produces with `clsx` + `tailwind-merge`, which is
the standard pairing and the peer to Bamboo's and Panda's `cva` row. That chunk is **8,001 B
brotli**; Bamboo's equivalent `cx` helper is **314 B**. The 8.1 KB gap in the Client JS row is
almost exactly that difference.

`tailwind-merge` is not optional decoration here. It carries its own copy of the default theme and
cannot read `app.css`, so every custom token has to be declared to it a second time. Without that,
`text-13-5` is parsed as a text *colour*, and a variant that sets a size silently deletes a base that
sets a colour.

</details>

<details>
<summary><strong>Why is the variant row not called "recipes"?</strong></summary>

Because naming it after one engine's API biases it. The question the row asks is whether a component
with discrete states can be declared in one place, with a call site the compiler checks.

Bamboo, Panda and Tailwind answer with `cva`: a base plus a variant matrix, and the accepted props
are inferred from the definition. Truss answers with a documented convention rather than an API — a
`Record<Variant, Properties>` map spread over a base hash, since a `Css.….$` expression is a plain
object. Both are checked. Removing a map entry in the arena app fails the build with TS2741
("Property 'link' is missing … but required in type 'Record<ButtonTone, Properties>'"), and a
mistyped variant at a call site fails with TS2820 and a did-you-mean. The difference is that `cva`
infers the prop type from the definition while the Truss convention declares the union first and
checks the map against it.

What `cva` checks for Tailwind is the shape of the recipe, not the class strings inside it. The
variant keys are typed; `bg-acent` is not.

StyleX has no single definition point: variants are composed at each call site, so nothing ties the
states of a component together or checks that they are all handled.

</details>

<details>
<summary><strong>What does the orphan-file row measure?</strong></summary>

A module matching the engine's `include` glob that nothing imports: the file a deleted feature leaves
behind. `tools/orphan.mjs` writes one carrying 50 style definitions, rebuilds, and diffs the
stylesheet.

Panda extracts from source text, so it ships all 13,200 B whether or not the bundle reaches the file.
Tailwind does the same and ships 21,100 B, the most of the five — its scanner reads files, not the
module graph. StyleX and Truss scope to the bundle graph and emit nothing. Bamboo does not ship the
orphaned definitions, but the matching file changes its stylesheet by a fixed 2 B. The magnitudes are
properties of the fixture; the finding is what remains when the module is unreachable.

The same scanning behaviour has a smaller everyday cost. Tailwind emits a rule for any class-like
string anywhere it scans, including comments and configuration. `"ring"` and `"ring-danger"` appear
in the `tailwind-merge` config and `blur` inside an arbitrary `backdrop-filter` value; together they
put 585 B of rules in the stylesheet that nothing renders. The unreachable-CSS row does not count
them, because those strings genuinely are in the shipped JavaScript.

</details>

<details>
<summary><strong>Why does deleting a page barely shrink Tailwind's CSS?</strong></summary>

Because a utility is shared by construction. Deleting `/docs` removes the classes only that route
used; everything it had in common with the other five stays, so the stylesheet loses 3.9% against
Bamboo's 22.0%.

The row measures pruning, not waste. It rewards an engine that had more page-specific CSS to remove
in the first place. Read it next to the CSS rows: Tailwind ships 52,116 B before the deletion and
50,076 B after, where Bamboo goes 43,420 B → 33,854 B and Truss 28,432 B → 24,856 B.

</details>

<details>
<summary><strong>Why is the HMR edit four rows instead of one?</strong></summary>

Because one number measured the wrong event. The old probe polled `getComputedStyle` until it
differed from the previous value. `tools/hmr-trace.mjs` shows two faults:

**It fires on a flash.** The first value seen is an inherited fallback, `15px`, and the written value
arrives later by an engine-dependent margin.

**It is not the same event across engines.** An edit produces two signals, the CSS going live and the
JS module re-executing, and the poll catches whichever is first. Which lands last differs by engine
and by edit kind.

Because that head start differs per engine, the flash is not a stable proxy for the ranking. Polling
the first changed value would compare different phases and report a different spread.

Of the four rows only **server reacts** (write to HMR broadcast) is attributable to the engine alone.
Everything later includes Vite's protocol, React Fast Refresh and the socket round trip. **Correct
paint** is end to end.

On this run the shared edit lands JS last for all five engines; the component edit lands JS last for
Bamboo and Truss and CSS last for StyleX, Panda and Tailwind. The flash runs from 0 ms (Panda, Truss,
Tailwind) to 68 ms (Bamboo) ahead of the correct paint on the shared edit.

**Server reaction is the row to read carefully.** It counts the first broadcast that carries an
update payload, not the first broadcast of any kind, because those are not the same event. An engine
may announce "the CSS changed, go refetch" the moment the file watcher fires, before it has compiled
anything, and the stylesheet the browser then refetches still holds the old rule. Counting only an
update payload puts every engine on the same event.

The shared edit has no such figure at all. That probe runs on a bare websocket with no browser
attached, and a shared style module is not in a browserless client's module graph, so no engine
broadcasts an update for it — only pings and React Router's own event. A route module is always
tracked, which is why the component edit still yields a number.

The component-edit server reaction pools 28 runs per engine; the browser-side phases pool 4 traces of
5 edit pairs each.

`HMR payload` counts bytes, not milliseconds, and reproduces exactly.

</details>
