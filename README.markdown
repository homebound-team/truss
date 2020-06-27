<p align="center" style="padding: 100px">
  <img src="logo.svg" width="400" />
</p>

Truss is a mini-framework for generating a Tachyons-ish TypeScript DSL for writing framework-agnostic CSS-in-JS (i.e. the truss DSL can be used in Emotion, MUI, Fela, etc.) that achieves both utility-class brevity and critical-css delivery.

(tldr: truss turns `Css.mt1.black.$` into `{ margin-top: 8px, color: black }`, which then you use in Emotion/Fela/MUI as if you'd written the CSS in long-form. See below for more details.)

See the "Why This Approach?" section for more rationale.

Truss should generally support any CSS-in-JS framework without any customizations; currently the same generated `Css.ts` file can work with all three of Material UI, Emotion, and Fela with no changes (see the integration-test directory for examples).

## Quick Intro

Truss generates a `src/Css.ts` file in your local project; this file exports a `Css` const that you use like:

```typescript
import { Css } from "src/Css";

const css = Css.mx2.black.$;
```

The last `.$` is like a `.build()` or `.finish()` method that converts the DSL object, with its fluent abbreviation getters/methods, into just a regular POJO (plain old JavaScript object), as if you'd written by hand:

```typescript
const css = {
  // added by .mx2
  marginLeft: "16px",
  marginRight: "16px",
  // added by .black
  color: "#000000",
};
```

You can then pass this POJO to whatever CSS-in-JS framework you're using, i.e. with Emotion you would do something like:

```tsx
/** @jsx jsx */
import { jsx } from "@emotion/core";

function MyReactComponent(props: ...) {
  // Use emotion's css prop
  return <div css={Css.mx2.black.$}>content</div>
}
```

And in your HTML output, you'd get an Emotion-generated `.emotion-0` CSS class with the three `marginLeft`, `marginRight`, `color` properties set. (If you were to use Truss with Fela's `fe` JSX factory/`css` prop, you'd get three CSS classes, `a`, `b`, and `c`.)

See the "Common CSS-in-JS Frameworks" section below for Fela and MUI examples.

## Installation

The recommended Truss installation involves checking a few `index.ts`/`package.json` files into a `truss/` subdirectory of your project, to provide a place for Truss configuration/customization, as well as an easy way to kick off the code generator (i.e. it keeps the Truss `ts-node` and `tsconfig.json` settings from interfering with your project's existing setup).

In your current project, run:

- `mkdir truss`
- `cd truss`
- `wget https://github.com/homebound-team/truss-project-files/archive/main.zip`
- `unzip main.zip`
- `rm main.zip`
- `npm install --save @homebound/truss`
  - Note this is purposefully `install`-ing into the `truss/package.json` and not your root `package.json` file
- `npm run generate`

This should create a `src/Css.ts` in your project's main `src/` directory (you can change the output path in `index.ts` if needed).

You can then check in the `truss/` directory, and the generated `src/Css.ts` file (which will be in your root project's `src/` directory and not the `truss/` subdirectory).

Note that you do not need to run `npm run generate` on a regular basis/as part of your day-to-day workflow; you only need to run it when you're specifically making updates to the `truss/index.ts`/`truss/palette.ts` files.

## Configuration

Truss's configuration is all done in the `truss/index.ts` and `truss/palette.ts` files that are installed in your local project.

See the comments in [that file](https://github.com/homebound-team/truss-project-files/blob/main/index.ts) for the available config options.

## Psuedo-Selectors and Media Queries

Unlike Tachyons and Tailwinds, Truss's DSL does not have abbreviations/method names for psuedo-selectors and media queries.

Instead of building these complications into the DSL, with Truss you use your CSS-in-JS framework-of-choice's existing psuedo-selector and media query support.

For example, using Emotion you would do hover-specific styling like:

```tsx
/** @jsx jsx */
import { jsx } from "@emotion/core";

function MyReactComponent(props: ...) {
  return (
    <div css={{...Css.mx2.black.$, "&:hover": Css.blue.$ }}>
      content
    </div>
  );
}
```

And breakpoints like:

```tsx
/** @jsx jsx */
import { jsx } from "@emotion/core";
import { Css, sm } from "src/Css";

function MyReactComponent(props: ...) {
  return (
    <div css={{...Css.mx2.black.$, [sm]: Css.mx1.$}}>
      content
    </div>
  );
}
```

Where `sm` is just a regular media query string, i.e. `@media (max-width: 420px)`, that you can either generate with Truss's `breakpoints` config setting or just write your own by hand.

This leveraging of the existing framework's selector support makes Truss's DSL shorter and simpler than Tachyons/Tailwinds, which have to repetively/pre-emptively mixin hover/media variations for each size into each abbreviation.

## Common CSS-in-JS Frameworks

Truss generates a TypeScript/`Css.ts` DSL that, without any changes, can be used in MUI, Emotion, and Fela.

See the `./integration-test` directory in Truss's repo for running unit tests for each of the these frameworks.

### Emotion

```tsx
function FooComponent() {
  return <div css={Css.black.$}>root</div>;
}
```

### Fela


```tsx
function FooComponent() {
  return <div css={Css.black.$}>root</div>;
}
```

```tsx
function FooComponent() {
  const { css } = useFela();
  return <div className={css(Css.black.$)}>root</div>;
}
```

### MUI

```tsx
const useStyles = makeStyles({ root: Css.black.$ });

function FooComponent() {
  const styles = useStyles();
  return <div className={styles.root}>root</div>;
}
```

## XStyles / Xss Extension Contracts

Truss liberally borrows the idea of type-checked "extension" CSS from the currently-unreleased Facebook XStyles library (at least in theory; I've only seen one or two slides for this feature of XStyles, but I'm pretty sure Truss is faithful re-implementation of it).

As context, when developing components, you often end up with "properties that are okay for the caller to set" (i.e. that you as the component developer support the caller setting) and "properties that are _not_ okay for the caller to set" (i.e. because the component controls them).

Basically, you want to allow the caller to customize _some_ styles of the component, typically things like color or margin or font size, but not give them blanket control of "here is a `className` prop, do whatever you want to my root element", which risks "radical"/open-ended customization that then you, as the component developer, don't know if you will/will not unintentionally break going forward.

(I.e. see [Layout isolated components](https://visly.app/blog/layout-isolated-components) for a great write up of "parents control margin, components control padding".)

With Truss, you can explicitly declare a contract of styles allowed to be set on your component, i.e.:

```tsx
import { Css, Only } from "src/Css";

// Declare the allowed/supported styles
export type DatePickerXss = "marginLeft" | "marginRight";

// Update the props to accept an `xss` prop to accept the customizations
export interface DatePickerProps<X> {
  date: Date;
  xss?: X;
}

// Use the `Only` type to ensure `xss` prop is a subset of DatePickerXss
export function DatePicker<X extends Only<DatePickerXss, X>>(
  props: DatePickerProps<X>
) {
  const { date, xss } = props;
  // The component controls marginTop/marginBottom, and defers to the caller for marginLeft/marginRight
  return <div css={{ ...Css.my2.$, ...xss }}>{date}</div>;
}
```

Here we're allowing callers to set `marginLeft` or `marginRight`, i.e. this line will compile because `mx2` is statically typed as `{ marginLeft: number; marginRight: number }`, and so is a valid `xss` value:

```tsx
<DatePicker xss={Css.mx2.$} date={...} />
```

However, this line will not compile because `mt2` is statically typed as `{ marginTop: number }`, and `marginTop` is not allowed by `DatePickerXss`:

```tsx
<DatePicker date={...} xss={Css.mt2.$} />
```

The `Css` DSL also iteratively types itself, i.e. `Css.ml1.mr2.$` is still statically typed as `{ marginLeft: number; marginRight: number }`, instead of being based just on the last-used abbreviation.

Note that Truss conventionally uses the `xss` prop name for "the component's allowed extension styles" as a play on Emotion's `css` prop, with the `x` representing the "extension" concept. But there is otherwise nothing special about the name of the `xss` prop; i.e. you could use `xstyles={...}` which I believe is what the Facebook XStyles library does, or your own convention.

Also note that the XStyles/Xss feature is completely opt-in; you can use it if you want, or you can use Truss solely for the `Css.m2.black.$` abbreviations.

## Customization

Truss supports several levels of customization:

1. Per-project fonts/colors/etc.
2. Per-project rule additions or changes
3. Forking

### Per-Project Fonts/Colors/Etc

Each project that uses Truss gets a local `index.ts`, checked into its repo essentially as a config file, that defines in TypeScript the core settings, i.e.:

```typescript
const increment = 8;
const numberOfIncrements = 4;

const palette = {
  Black: "#353535",
  MidGray: "#888888",
  LightGray: "#cecece",
  White: "#fcfcfa",
  Blue: "#526675",
};

const fonts = {
  f24: "24px",
  f18: "18px",
  f16: "16px",
  f14: "14px",
  f12: "12px",
  f10: "10px",
};

const breakpoints = { sm: 0, md: 600, lg: 960 };

// ...rest of the config file...
```

Projects should heavily customize these settings, then run `npm run generate` to get an updated `Css.ts`, i.e. after adding `Green: "green"` as a color in `palette`, the `Css.ts` file will automatically have rules added like:

```typescript
  get green() { return this.add("color", "green"); }
  get bgGreen() { return this.add("backgroundColor", "green"); }
  get bGreen() { return this.add("borderColor", "green"); }

```

### Per-Project Rules

In the same `index.ts`, projects can easily add their own new rules/abbreviations:

```typescript
methods["our-section"] = [makeRule("someAbbreviation", { color: "#000000" })];
```

Will result in `Css.ts` having a line that looks like:

```typescript
  get someAbbreviation() { return this.add("color", "#000000"); }
```

Which can then be used as `Css.m2.someAbbreviation.$`.

Besides adding one-off additional rules/abbreviations, if your project wants to replace a whole section of Truss's out-of-the-box rules, you can replace an entire section via:

```typescript
methods["spacing"] = [...ourCustomSpacingRules...];
```

Where `"spacing"` matches the name of the file that declared these rules in Truss's `src/rules` directory (which generally matches Tachyon's sections of organization).

### Forking

At the end of the day, Truss is small and hackable such that forking it to make the abbreviations "strict Tachyons" or "strict Tailwinds" or "whatever best fits your project/conventions/styles" should be easy and is kosher/encouraged.

The core Truss feature of "make a TypeScript DSL with a bunch of abbreviations" is also basically done, so it's unlikely you will miss out on some future/forthcoming amazing features by forking.

And, even if so, the coupling between Truss and your application code is limited to the `Css.abbreviations.$` lines that should be extremely stable even if/as the core of Truss evolves.

## Why This Approach?

Truss's approach is "Tachyons-ish" (or Tailwinds-ish), insofar as having short/cute utility class definitions.

However, the abbreviations are runtime resolved to object-style CSS-in-JS rules that are then output by Emotion (or your CSS-in-JS framework of choice), as if the rules had originally been written long-form.

The benefits of this approach are:

- We get the brevity + "inline-ness" of Tachyons/Tailwinds.

- It delivers critical CSS, i.e. we don't need the large static TW/Tachyons CSS files.

  (My reading of projects like [tachyons-styled-react](https://github.com/tachyons-css/tachyons-styled-react), from the creator of Tachyons, is that critical-ness is still important goal/improvement even for static-utility-class approaches like Tachyons.)

- Psuedo-selectors/breakpoints go through Emotion/the CSS-in-JS framework, which is simpler, more powerful, and reduces method/abbreviation bloat.

  I.e. we don't need to suffix `-nl` for "not large" onto every single abbreviation.

- "Regular Emotion/CSS-in-JS" is easily/inherently available as an escape hatch for places where utility classes don't make sense.

  It's very likely you'll need "not utility" styles at some point in your project, and because Truss's DSL is already going through Emotion/CSS-in-JS anyway, it means your one-off "not utility" rules will use the same/consistent CSS-in-JS output/generation pipeline.

  This means you don't end up with mixed idioms of `className="mx2 black"` for 90% of your styles, but then "something different" like `css={...}` for the last 10%.

- Projects can easily tweak their preferred styles/abbreviations.

  Granted, this is very similar in spirit to Tailwinds customization, but for Truss, the config process is "just change some TypeScript code and run `generate`", and doesn't involve any changes to your build/webpack/PostCSS/etc. setup.

## Themes

The word "theme" can mean either "static themes" (i.e. using the same consistent colors/fonts throughout your app, but the values themselves never really change) or "dynamic themes" (i.e. the user changing from light mode to dark mode).

For static themes, Truss's `index.ts`/`palette.ts` are specifically setup to centrally define your application's fonts, colors, etc. (see the "Configuration" section), so that they are consistently applied through your application.

For dynamic themes, Truss doesn't have any features dedicated explicitly to support them, but you can easily use CSS variables in your rules, i.e.:

```typescript
const palette = {
  Primary: "var(--primary)",
  Secondary: "var(--secondary)",
};
```

And then have your application handle setting the `--primary` / `--secondary` values as appropriate (i.e. by importing a `dark-mode.css` or `light-mode.css` which define the respective CSS variable values).

## Inspiration

Several libraries influenced Truss, specifically:

- [Typed Tailwinds](https://typed.tw) and [babel-plugin-tailwind-components](https://github.com/bradlc/babel-plugin-tailwind-components) are both "type-safe TypeScript utility-css DSLs".

  In particular, the babel-plugin-tailwind-components insight of "if you just make `csstype`-compliant object literals, you can bring them to whatever CSS-in-JS framework you want" was a very useful/inspirational insight.

  The main difference between Truss and both Typed.tw and babel-plugin-tailwind-components is that Truss doesn't try to "perfectly match Tachyons or Tailwinds" (see "Why This Approach?"). Specifically, both projects assume that a `tachyons.css` or `tailwinds.css` file is the source-of-truth for your project's rules (and so parse/generate the TypeScript code from that CSS file); however, with Truss your source-of-truth is Truss's out-of-the-box TypeScript rules + whatever customizations you make in your project's `truss/index.ts` file (so rules are defined directly in TypeScript).

- Facebook's XStyles for the "typed extension" idea

## Todo

- Support `number[]` increments as config
- Upstream optional per-font size letter spacing/line height support
- Babel plugin that evaluates `Css...$` expressions at build-time
  - I.e. see babel-plugin-tailwind-components and [typed.tw's implementation](https://github.com/dvkndn/typed.tw/tree/master/webpack-loader)
- Server-side generation; in theory this should just work?
