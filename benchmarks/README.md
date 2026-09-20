# Truss compiler benchmarks

This suite uses frozen copies of the **Truss and Tailwind six-page React Router apps** from
`css-in-js-arena`. See [`fixtures/provenance.json`](fixtures/provenance.json) for the source revision,
and the frozen [arena README](fixtures/arena-README.md) and [measurement instructions](fixtures/arena-RUNNING.md).
The suite does not need the other repository once these fixtures are imported.

See [RESULTS.md](RESULTS.md) for the first optimization pass, including the remaining Tailwind gaps.

## Setup

From the repository root:

```sh
yarn install
yarn build
npm --prefix benchmarks ci
```

For browser measurements, run `npx playwright install chromium` from `benchmarks/`.
`BROWSER_CHANNEL=chrome` selects an installed Google Chrome instead. Use the same browser for every
engine within a comparison.

The first benchmark run installs the fixtures with their committed npm lockfiles. Subsequent runs
reuse those dependencies. Source mutations, package overlays, and build caches live in ignored
`benchmarks/.work/`; the committed fixtures are never edited by a benchmark.

### Save a comparison baseline

Before changing compiler code, build it and save its artifacts:

```sh
yarn build
SCENARIOS= RUNS=1 COUNTS=0 node benchmarks/run.mjs --save-baseline
```

`--save-baseline` refuses to overwrite an existing snapshot. For the initial results, the snapshot
was taken from **Truss 2.33.3, revision `8401bba1`**, before this optimization pass. Saving a snapshot
after applying optimizations compares the new compiler with itself, not with that release.

Default comparisons include `baseline` when a snapshot exists, plus local `truss` and `tailwind`.
Use `ENGINES=truss,tailwind` or `ENGINES=baseline,truss` to select a pair. The runner copies the built
compiler/runtime into each Truss app's installed package; this preserves normal package resolution,
React identity, and Vite dependency optimization. **Run `yarn build` after compiler edits.**

## End-to-end measurements

```sh
# Cold/warm production builds and cold dev startup, five interleaved samples each
RUNS=5 COUNTS=0,25,100,400,1600 yarn bench

# The same modules, outside the bundle graph
ORPHANED=1 RUNS=3 COUNTS=0,400,1600 yarn bench

# The arena's distinct-style definitions, with timings as well as byte counts
AXIS=styles RUNS=3 COUNTS=0,50,200,800 yarn bench

# Both edit kinds; four server restarts per engine, five measured edits per kind per restart
SWEEPS=4 PAIRS=5 yarn bench:hmr

# Production visual parity against the saved Truss baseline
yarn bench:verify
```

`SCENARIOS=build` or `SCENARIOS=start` selects one timing family. An empty `SCENARIOS=` prepares
the apps without timing. Run timing commands sequentially: parallel servers, tests, and builds
contend for CPU and corrupt the comparison. The harness owns its child process groups and refuses
a busy benchmark port (`4198`). Interrupting HMR restores the edited disposable source files.

### Measurement boundaries

| Scenario              | Boundary and workload                                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cold production build | `npm run build` completes successfully after removing `build`, `.react-router`, and `node_modules/.vite`. No OS page-cache flush.                                              |
| Warm production build | A new `npm run build` process immediately after the cold build, retaining generated caches/output.                                                                             |
| Cold startup          | Spawn dev server → successful SSR response containing `Recent activity`; remove Vite's cache before **every** sample.                                                          |
| File scaling          | The arena's four repeated declarations in 0/25/100/400/1,600 modules, imported via a barrel from `ui.ts`. CSS should be flat above zero.                                       |
| Orphans               | The same modules, with no import from `ui.ts`. Truss should emit no extra CSS.                                                                                                 |
| Style scaling         | The exact six declarations and value/modulo ranges from the arena's `tools/scale.mjs`, in one imported module.                                                                 |
| Shared edit           | Change `pageTitle` font size in `ui.ts`; observe `h1`.                                                                                                                         |
| Component edit        | Change `kpiValue` font size in `routes/dashboard.tsx`; observe `article span + span`.                                                                                          |
| Correct style         | The target computes **exactly the written font size**, not merely a changed/inherited value. This matches the arena's “correct paint” proxy, not a compositor paint timestamp. |

HMR warms the graph, performs one unmeasured edit per kind, then uses unique values. It records
CSS-rule availability, the class attribute change, the exact computed style, and HTTP response
bytes/counts after a 700 ms settling period. A fresh server is used for each engine/sweep. Engine
order reverses on alternate sweeps (and alternate build/start runs).

`browserUpdate` is the timestamp of an update/full-reload message **with the browser attached**.
It includes the socket/browser delivery path and is a diagnostic, not a substitute for the arena's
browserless server-reaction row. `SERVER=1` additionally runs the bare-websocket component probe;
an absent update is recorded as `null`. In the initial local environment this probe produced no
component payload, so there is no claimed browserless server-reaction result. The arena's shared
browserless probe is likewise unavailable by design; no custom event is counted as compilation.

### Comparability and output guards

- Both fixtures retain the arena's `cssMinify: false` and pre-generated Truss mapping/Css source.
  Codegen and TypeScript typechecking are outside the timed build, as in the arena.
- Tailwind's disposable `app.css` uses `source(none); @source "./"` to restrict scanning to the app.
  Its automatic discovery otherwise scans the enclosing monorepo. The resulting raw/Brotli CSS
  exactly reproduces the arena: **52,116 / 7,157 bytes** at zero and **52,385 bytes raw** with repeated
  generated modules. Truss reproduces **28,432 / 5,612 bytes**, then **28,571 bytes raw**.
- The scaling runner uses the stricter standalone cold-start policy. The arena's `dev-scale.mjs`
  retains Vite caches between some startup samples, so its startup-slope milliseconds are not an
  interchangeable baseline.
- The visual gate compares optimized Truss with saved Truss: byte-identical production CSS,
  identical SSR class attributes, no increase in compressed client JavaScript,
  six routes × two viewport widths × light/dark, and no browser page errors. It freezes animations,
  blocks remote font requests equally, and reports both exact pixel differences and pixelmatch
  differences at threshold 0.1 (antialiasing ignored). This protects the originally ported app's
  rendering; it does not rerun the arena's Bamboo-versus-every-engine gate.
- Gzip can differ from the arena's published numbers with a different Node/zlib version. Raw and
  Brotli output match. Compare baseline/candidate bytes within the same run.

## Compiler attribution

```sh
yarn bench:compiler
node --cpu-prof --cpu-prof-dir=benchmarks/.work benchmarks/compiler.mjs
node benchmarks/profile-summary.mjs benchmarks/.work/CPU.…cpuprofile

# Per-module Vite transform timings; not a headline timing run
PROFILE=1 ENGINES=truss RUNS=1 COUNTS=0 SCENARIOS=build yarn bench

# Diagnostic lower bound: perform Truss compilation before starting each timed process
ENGINES=precompiled,truss,tailwind RUNS=5 COUNTS=0 yarn bench
```

The compiler microbenchmark uses the same real fixture modules and the repeated four-declaration
module from file scaling. It reports plugin import, mapping setup, cold/repeated transforms, and
1,600 distinct source modules. Profiled Vite builds write one `profile-*.json` per plugin instance
in the disposable app directory, including module IDs, source lengths, and hook durations.

`precompiled` is an attribution control, **not a Truss performance result**. It replaces fixture
DSL expressions with their production transforms and writes the collected stylesheet before timing,
then removes the plugin from Vite. Its dev run also omits Truss's debug metadata. This estimates the
framework/runtime floor and how much overhead the live compiler would have to shed to match Tailwind.

## Results

Timestamped raw samples go to ignored `benchmarks/results/`, alongside `latest.json` and
`hmr-latest.json`. Builds record Node, CPU, resolved dependency versions, and compiler hashes.
The reported installed Truss package version is the dependency shell from the fixture lockfile;
the compiler artifacts are overlaid from the local build or saved snapshot.

```sh
node benchmarks/summarize.mjs benchmarks/results/latest.json benchmarks/results/hmr-latest.json
# Keep a selected comparison in version control, including its raw samples:
node benchmarks/summarize.mjs path/to/build.json path/to/hmr.json --save benchmarks/baselines/comparison.json
```

Summaries show median **[minimum, maximum]**. Inspect the samples and the unchanged Tailwind control
before attributing small deltas to compiler changes. There are no hard CI millisecond thresholds:
machine-dependent absolute timings should not make correctness tests flaky.

`import-arena.mjs` is a one-time fixture importer; it refuses to overwrite existing fixtures.
Future fixture refreshes should review the upstream diff and re-establish parity/output baselines.
