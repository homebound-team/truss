# Running the benchmark

Everything needed to reproduce the numbers in [`README.md`](./README.md) yourself. If you only want
the results, you do not need this file.

Each engine gets a port pair by its index in `tools/engines.json` — `300N` for the production server,
`400N` for the dev server:

| Engine | Package | Prod port | Dev port |
| --- | --- | --- | --- |
| Bamboo CSS | `@bamboocss/vite` | 3001 | 4001 |
| StyleX | `@stylexjs/unplugin` | 3002 | 4002 |
| Panda CSS | `@pandacss/postcss` | 3003 | 4003 |
| Truss | `@homebound/truss/plugin` | 3004 | 4004 |
| Tailwind | `@tailwindcss/vite` | 3005 | 4005 |

`tools/engines.json` is the single source of truth for that list. Adding an engine is a checklist —
see [`CLAUDE.md`](./CLAUDE.md).

## Install

```bash
for d in apps/* tools; do (cd "$d" && npm install); done
```

## Build

Every app must build with **0 engine warnings and 0 type errors** before anything is measured:

```bash
for d in apps/*; do (cd "$d" && npm run build && npm run typecheck); done
```

For Bamboo specifically, a `🎋 warn [utility]` line means a token does not resolve — the declaration
ships as written and the browser drops it. That is a real bug even when the screenshots look fine.

## Serve

One terminal per engine, each on its assigned port:

```bash
cd apps/bamboo && PORT=3001 npm start
cd apps/stylex && PORT=3002 npm start
cd apps/panda  && PORT=3003 npm start
cd apps/truss  && PORT=3004 npm start
cd apps/tailwind && PORT=3005 npm start
```

## Verify parity — the gate

**If parity fails the numbers are meaningless.** Fix the divergence before measuring anything.

```bash
cd tools
for r in / /projects /settings /pricing /docs /lab; do
  for c in stylex panda truss tailwind; do node layout-diff.mjs "$r" 2 "$c"; done
done
node compare.mjs
```

Expected: **no geometry differences > 1px** on every route, and every combination `MATCH` with a
worst case of ≈0.047% — that residual is the footer credit line, which differs on purpose.

Two things that are easy to get wrong:

- `layout-diff.mjs` takes the challenger as its **fourth** argument and defaults to `stylex`. A loop
  without it never geometry-checks Panda, Truss or Tailwind at all.
- Both tools launch Playwright's `chrome` channel, which needs Google Chrome installed locally.
  Without it, set `BROWSER_CHANNEL=chromium` to use the build Playwright ships — the browser only has
  to be the same for every app within one run.
- Both tools freeze CSS animations before measuring, because `getBoundingClientRect()` reports the
  transformed box and `/lab` animates. Without that the gate fails at random.

`compare.mjs` writes screenshots and diff images to `tools/shots/`.

## Measure — servers running

```bash
cd tools
node bytes.mjs      # CSS/JS/HTML the browser downloads, raw + gzip + brotli
node unused.mjs     # class rules that can never apply
```

## Measure — servers stopped

Kill the servers first; CPU contention skews the timings.

```bash
lsof -ti:3001,3002,3003,3004,3005 | xargs kill

cd tools
RUNS=5 ./timings.sh   # production build, cold and warm
RUNS=7 ./devstart.sh  # dev server cold start
./deadcode.sh         # delete a page, see what happens to the CSS
./typesafety.sh       # token-name and property-name typos
node authoring.mjs    # lines of styling code
node orphan.mjs       # a module matching `include` that nothing imports
```

## Measure HMR — one driver, one dev server at a time

```bash
cd tools
node hmr-phases.mjs 4 5      # 4 sweeps × 5 pairs, every engine, both edit kinds
```

`hmr-phases.mjs` starts and stops each dev server itself, reverses the engine order on alternate
sweeps, and pools the result — you do not drive the servers by hand. Budget ~25 minutes.

It reports the edit as **phases**, not one number, because one number was measuring the wrong thing:

| phase | what it is |
| --- | --- |
| `write → ws` | the dev server's own reaction, up to the HMR broadcast that carries an update payload. The only phase attributable to the engine alone. |
| `write → rule live` | the new rule is live in the document |
| `write → JS re-executed` | the edited module re-ran and React re-rendered |
| `write → correct paint` | the target computes the value that was written — true end to end |

The two rows this replaced polled `getComputedStyle` until it differed from the previous value. That
is wrong twice over, and both are visible in the tool's own output:

- The first change it sees is an **inherited fallback**, not the written value — a flash. The
  `(flash → correct)` row is how far ahead of the real paint that fires; it runs 0–48 ms on the
  shared edit, and the head start differs per engine, so it is not a fixed offset you can subtract.
- Whichever of the CSS and JS signals lands first is what such a poll catches, and **the order is
  engine-dependent** — the `which signal lands last` row. So the old columns were not comparing the
  same event between engines, which is why that row needed 60 runs and still landed with margins
  narrower than its own spreads.

`write → ws` comes from a bare `vite-hmr` websocket with no browser attached. Taken through the
trace instead — browser open, CDP poll running — the same figure moves 3–10× sweep to sweep, so the
tool measures it separately and reports the socket number.

The probe counts only a message carrying `"type":"update"` (or `"full-reload"`), not a bare custom
event. An engine can broadcast "the CSS changed, go refetch" the moment the watcher fires, before it
has compiled anything, and the stylesheet the browser then refetches still holds the old rule.
StyleX's component edit pings that way at ~3 ms while its real update lands ~110 ms later and its
rule goes live at ~250 ms; Truss did the same until 2.29.12. Counting only an update payload makes
every engine's number the same event. `hmr-trace.mjs` still prints every message, so the pings are
visible when you want them.

**Bamboo's `write → ws` is bimodal**: roughly a fifth of runs land near 25 ms and most of the rest
near 125 ms. StyleX's component edit splits the same way, between ~10 ms and ~90 ms. Pool at least
20 runs per engine before reading either, and do not treat a 7-run median as settled — a small
sample lands wherever the cluster mix happens to fall.

```bash
node hmr-payload.mjs bamboo 4001     # bytes the browser refetches — needs a server you started
```

Truss's dev runtime refetches the whole stylesheet from `/virtual:truss.css` on every update, and once
more 50 ms after Vite's `afterUpdate` event, so its payload carries two stylesheet responses per edit.

Truss's dev server also never prunes a rule once it has emitted it. `hmr-trace.mjs` relies on every edit
producing a class that has never existed, so on a Truss server that has already seen a value (the
`write → ws` runs use the same values the trace does) the rule is live before the write and the
`cssLive` reading comes back empty. Restart the dev server before a trace whose rule-live column
matters.

`hmr-payload.mjs` still wants a dev server you start yourself, and is deterministic **once it has
finished warming** — give it ~10s after the port answers and take the number two consecutive runs
agree on, not the first. Measured too early it can report a different payload and response count
(StyleX and Truss have both been seen one response apart between the first and second run). If two
consecutive runs agree, the number is real.

`hmr-trace.mjs` is the underlying instrument and can be run directly on one engine for the full
per-run detail — every websocket message, every module refetch, head mutations:

```bash
node hmr-trace.mjs bamboo 4001 shared 6
```

The dev server binds IPv6 `localhost` only — `127.0.0.1` refuses the connection. The production
server does not have this problem.

Both tools kill dev servers with `lsof -ti:<port> -sTCP:LISTEN`. The `-sTCP:LISTEN` is load-bearing:
a plain `lsof -ti:<port>` also matches the measuring process, which holds a client socket to that
port, so `kill -9` on that set kills the harness mid-run.

## The separate scenarios

These are reported in their own sections of `README.md` and never folded into the main table, because
they are not the default configuration:

```bash
cd tools
node scale.mjs     # marginal cost per rule at 0 / 50 / 200 / 800 style definitions
node theming.mjs   # cost of 0 / 1 / 2 / 4 / 8 brand themes, per engine's own API
node dev-scale.mjs # dev loop cost at 0 / 25 / 100 / 400 extra source files

ORPHANED=1 node dev-scale.mjs   # same sweep, modules left unimported
```

All three rewrite app sources, build, and restore. They take several minutes each; dev-scale is the
longest, since it boots a dev server at every size.

`ORPHANED=1` writes the same generated modules but does not hang the barrel off `ui.ts`, so they match
each engine's `include` while staying out of the bundle graph. Subtracting that pass from the default
one separates what an engine spends *reading* a file from what it spends *using* it — for an engine
that scopes emission to the bundle graph, the difference is work whose output is discarded.

## Interpreting timings

Timing rows are the noisiest thing here and the easiest to misread:

- Build and HMR numbers move several percent with ambient machine load. If an engine you did **not**
  change moved too, that is drift, not a result.
- To attribute a delta to a specific version, A/B that version directly — same app, same machine,
  the two versions interleaved with the order reversed in the second half so a monotonic drift
  cancels. Absolute values from two such pairs are comparable only *within* a pair, never between.
  A session-over-session diff is not evidence: `README.md` records a point in time, not a trend.
- Only `write → ws` is the engine's own work. Every later phase includes Vite's HMR protocol, React
  Fast Refresh and the socket round trip, which no phase boundary can separate out.

## Probe hygiene

`typesafety.sh`, `scale.mjs`, `theming.mjs`, `orphan.mjs`, `dev-scale.mjs` and the ad-hoc probes
deliberately
introduce typos, inject themes and flip config flags. They restore afterwards, but confirm before you
trust a result:

```bash
git status                                        # clean apart from README.md
grep -rnw "acent\|padingBlock\|leterSpacing" apps/*/app/ui.ts   # must return nothing
ls apps/*/app/__scale.ts 2>/dev/null              # generated module must be gone
ls apps/*/app/__orphan.ts 2>/dev/null             # ditto
find apps/*/styled-system/themes -type f          # no leftover theme artifacts
grep -n "data-theme" apps/truss/app/theme.css.ts  # generated Truss themes must be gone
grep -n "data-theme" apps/tailwind/app/app.css    # generated Tailwind themes must be gone
```

Rebuild each app afterwards too. An interrupted probe can leave `build/` holding a stylesheet that no
committed config produces.

Do not pipe a probe into `head` or any other command that closes the pipe early. The probe dies on
`SIGPIPE` before its restore step and leaves the typo in the working tree — `git checkout` the app
source if that happens.
