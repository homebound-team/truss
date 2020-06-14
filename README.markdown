
## truss

truss is a TypeScript utility Css mini-project that generates a single-file TypeScript DSL for generating object-style CSS-in-JS rules.

I.e. see the `Css.ts` class in our parent `../src/` directory.

This isn't meant to be a "CSS framework" per se, but instead just a set of files that can be liberally copy/pasted/forked and then tweaked to each project's need. I.e. there isn't any intent 

### Files

* `config.ts` contains most project-specific data like colors and font sizes
* `generate.ts` drives the codegen process
* `skins.ts`, `spacing.ts`, each define rules that are inspired by the Tachyons section of the same name (see Tachyon's [table of rules](http://tachyons.io/docs/table-of-styles/))

Note that this project is "Tachyons-ish", i.e. where it makes sense we use/prefer the Tachyons abbreviations, but don't follow them stringently. I.e. we personally prefer a `f32` == `32px` style for font abbreviations instead of `f1`.

### Building

To update `Css.ts`:

* Run `npm install` in this `css-gen` directory
* Run `npm run generate`

(This is a separate project both for separate of concerns but also because `ts-node` needs different `tsconfig.json` settings than create-react-app wants.)

### Why This Approach?

This approach is "Tachyons-ish" (or Tailwinds-ish), insofar as having cute/short utility class definitions. However, the abbreviations are runtime resolved to object-style CSS-in-JS rules that are then output by emotion, as if the user had written emotion rules straight-up.

The benefits of this approach are:

* We get the brevity of Tachyons/Tailwinds
* It delivers critical CSS, i.e. we don't need the large static TW/Tachyons CSS files.
* Using emotion for psuedo-selectors/breakpoints is simpler and reduces the method bloat
  * I.e. we don't need to suffix `-nl` for "not large" onto every single abbreviation
* "Regular emotion" is always available as an escape hatch for places where utility classes don't make sense
* We can tweak our preferred styles, i.e. `f32` is `32px` instead of `f3` or what not.

### Inspiration

* typed.tw
* xstyles 
