# Initial compiler optimization results

Measured September 20, 2026 UTC on Linux, Intel i9-12900K, Node **24.20.0**, Vite **8.2.2**,
React Router **8.3.1**, React **19.2.8**, Tailwind **4.3.3**. The saved Truss baseline is
**2.33.3 at `8401bba1`**. These are same-session comparisons, not deltas against the arena's
Node 26 README numbers.

**The pass improves Truss substantially, but does not beat Tailwind on the headline build/dev
metrics.** The remaining gap should not be presented as a win based on a faster CSS-live event
or the first websocket notification.

## Main results

Build/start numbers are medians of five runs, interleaving engines and reversing their order.
HMR numbers pool 20 measured edits per engine/kind across four fresh servers, after warmup edits.

| Metric                                |  Truss before |   Truss after |      Tailwind | Truss improvement |
| ------------------------------------- | ------------: | ------------: | ------------: | ----------------: |
| Cold production build                 |      1,009 ms |        820 ms |        672 ms |             18.7% |
| Warm production build                 |        989 ms |        810 ms |        678 ms |             18.1% |
| Cold dev startup → SSR content        |        975 ms |        940 ms |        785 ms |              3.6% |
| Cold build, +400 imported files       |      1,291 ms |      1,023 ms |        794 ms |             20.7% |
| Cold build, +1,600 imported files     |      2,103 ms |      1,542 ms |      1,192 ms |             26.6% |
| Warm build, +1,600 imported files     |      2,041 ms |      1,533 ms |      1,122 ms |             24.9% |
| Build slope, 0→1,600 files            | 0.684 ms/file | 0.451 ms/file | 0.325 ms/file |             34.0% |
| Shared edit → exact computed style    |       77.1 ms |       69.9 ms |       65.5 ms |              9.4% |
| Component edit → exact computed style |      100.1 ms |       89.5 ms |       79.1 ms |             10.6% |

For context, the zero-file cold-build ranges were **980–1,014 ms** before, **801–827 ms** after,
and **654–686 ms** for Tailwind. Startup ranged **963–989**, **928–959**, and **782–799 ms**
respectively. The build improvement is much larger than the sample spread; startup's improvement
is smaller. Full raw samples are retained in [baselines/2026-09-20.json](baselines/2026-09-20.json).

### Scaling checks

- Repeated-file CSS remains constant above zero: Truss **28,571 bytes**, Tailwind **52,385 bytes**.
- With 1,600 orphan files, Truss still emits **28,432 bytes**, exactly its zero-file output.
  Cold builds are effectively flat: **825 → 824 ms**. Tailwind takes **671 → 701 ms** in this run,
  and its scanner emits the additional rules (**52,116 → 52,385 bytes**).
- Cold dev startup grows with orphan inventory for **all three variants** in this strict-cache
  run. That is not evidence of a Truss-only whole-inventory compile; the framework/watcher and
  dependency discovery also see that inventory.
- With the arena's 800 additional style definitions, Truss cold builds improve **1,154 → 878 ms**;
  Tailwind takes **812 ms**. Truss still emits the same **188,732 raw / 14,157 Brotli bytes** as its
  saved baseline, versus Tailwind's **359,516 / 17,644 bytes**.

## Changes retained

1. **Session-local transform caching**, keyed by source path, source text, and transform mode.
   An unchanged client/server request reuses compiled JavaScript and rules. Build resets still
   clear the emission registry; cache hits replay only reached modules' rules into it. Diagnostic
   results are deliberately not cached, so warnings/errors recur in each environment. Bare CSS
   imports also recheck whether a `.css.ts` companion exists before replaying a cached rewrite.
2. **Lazy per-module CSS text.** The Vite adapter consumes atomic rules and serializes the merged
   stylesheet; it no longer pays to serialize an unused stylesheet for every source file.
3. **One parse for CSS import rewrites and DSL compilation.** This also keeps debug locations tied
   to the original source rather than to an intermediate regenerated module.
4. **Reuse already collected JSX rewrite paths**, avoiding a second full Babel traversal in
   ordinary modules. Modules with props calls or potentially cloned nested JSX retain a traversal
   so every runtime expression is compiled and sibling spread order stays unchanged.
5. **Skip Babel scope crawling unless `when()` may need lexical lookup.** Top-level binding names
   and hoisted module-level `var` declarations still reserve injected helper names.
6. **Cache arbitrary-CSS compilation and collected stylesheet text**, invalidating stylesheet
   caches on registry changes/reset.

## Correctness and discarded experiments

- `yarn test`: **604 passed, 1 skipped** across all workspaces.
- `yarn build`: passed, including TypeScript/declaration generation.
- Fourteen added regression tests cover cache replay/reset, source/mode changes, diagnostic replay,
  stylesheet invalidation, hoisted binding collisions, debug source locations, and nested/cloned
  props calls with stable sibling spread order, filesystem-dependent CSS import resolution, and
  import-only rewrites that retain a re-exported Css binding.
- Production baseline/candidate CSS and SSR class attributes are **identical**. All emitted client
  JavaScript totals **110,833 Brotli bytes** before and after (sum of separately compressed chunks,
  not the arena's first-load measurement). All **24 route/viewport/theme screenshot comparisons**
  pass at pixelmatch threshold 0.1, with no browser page errors. Raw antialiasing differences are
  recorded separately from material pixel differences.
- A source-preserving AST renderer added complexity without a clear end-to-end win and worsened
  some HMR samples; it was removed. Bundling Babel into the plugin likewise did not improve the
  timing enough and was removed. No dependency or generated application-Css changes are needed
  for the retained compiler optimizations.

## Follow-up: one transformation flow

The Vite hook now sends every eligible file through the same transformation flow. Import rewriting,
Truss expressions, test bootstrap imports, and test CSS injection share one parsed AST; `.css.ts`
extraction also consumes that AST while preserving runtime exports. The import-rewrite helper no
longer has a separate source-text parsing/printing path.

Four additional regression tests cover import-only files, original source locations in test mode,
bootstrap cache isolation, and cached `.css.ts` registry replay. Validation passes with **608 tests,
1 existing skip**, a successful build, unchanged production CSS/SSR classes/client-JS size, all
24 visual comparisons, and shared/component browser HMR checks. A three-run 0/400-file smoke
comparison also retains the build improvement over the saved baseline. The archived table above
remains the measurements from the initial optimization pass.

## Refactoring regression check

Compared the current compiler at **`813aa35f`** directly with the original optimized compiler at
**`1aace93b`**, using interleaved fresh processes and alternating order. The reconstructed reference
has SHA-256 `dcaa459fd0f8a82cb90207ca1f044f58fc307b18194e5abca3c5d722149a2b3b`, exactly matching
the optimized compiler in the original archived results. The saved unoptimized 2.33.3 baseline
was preserved; `BASELINE_BUILD` selects this separate reference build.

**No material regression was detected.** Builds are flat or slightly faster. Focused reruns retain
small positive differences in 400-file startup and component HMR, approximately 1–2%; these are
point estimates with overlapping run-to-run ranges, not proof of precisely zero regression.

| Metric                                         | Before refactoring | After refactoring | Change |
| ---------------------------------------------- | -----------------: | ----------------: | -----: |
| Cold build                                     |             846 ms |            828 ms |  -2.1% |
| Warm build                                     |             833 ms |            828 ms |  -0.6% |
| Cold startup → SSR                             |             952 ms |            953 ms |  +0.1% |
| Cold build, +400 files                         |           1,024 ms |          1,024 ms |    ~0% |
| Cold build, +1,600 files                       |           1,563 ms |          1,550 ms |  -0.8% |
| Warm build, +1,600 files                       |           1,567 ms |          1,542 ms |  -1.6% |
| Cold startup, +1,600 files                     |           2,732 ms |          2,687 ms |  -1.6% |
| Cold build, +800 style definitions             |             885 ms |            878 ms |  -0.8% |
| Cold build, +1,600 orphan files                |             820 ms |            827 ms |  +0.9% |
| Cold startup, +400 files (focused rerun)       |           1,428 ms |          1,447 ms |  +1.3% |
| Shared edit → correct style (focused rerun)    |            69.6 ms |           69.2 ms |  -0.6% |
| Component edit → correct style (focused rerun) |            89.5 ms |           91.4 ms |  +2.0% |

Build/startup rows use five samples; style/orphan rows use three. The focused startup rerun uses
seven samples per version; its ranges were **1,414–1,442 ms** before and **1,410–1,475 ms** after.
The focused HMR rerun uses 30 edits per kind per version across six fresh servers, with the two
versions alternating first/second position. Component HMR ranges were **82.3–119.8 ms** before
and **81.1–106.8 ms** after.

The initial three-engine run included Tailwind as a control and showed larger differences for
400-file startup (**1,445 → 1,486 ms**) and component HMR (**87.0 → 93.6 ms**). Those larger gaps
did not reproduce in the focused comparisons. Both runs are retained in
[baselines/2026-09-20-refactor.json](baselines/2026-09-20-refactor.json).

CSS sizes match at every file/style count, and orphan files still emit no additional Truss CSS.
Production CSS and SSR classes are identical between revisions; all client JavaScript still totals
**110,833 Brotli bytes**. All **24 visual comparisons** pass with no browser page errors.

## Remaining work

The remaining base-app gap is approximately **148 ms for cold builds**, **155 ms for startup**,
and **10.4 ms for component edits**. File scaling still costs Truss about **0.13 ms/file** more.
CSS output is already competitive; reaching several Tailwind build/dev wins likely needs a larger
change to the compilation path, not another stylesheet-size optimization.

A further five-run interleaved **precompiled control** moves all Truss compilation outside the timer
and removes its plugin. It produces the same CSS bytes, but is explicitly not a competing-engine
result (its dev output also omits debug metadata):

| Diagnostic run | Precompiled control | Optimized Truss | Tailwind |
| -------------- | ------------------: | --------------: | -------: |
| Cold build     |              602 ms |          817 ms |   681 ms |
| Warm build     |              597 ms |          816 ms |   679 ms |
| Cold startup   |              749 ms |          959 ms |   797 ms |

In that paired run, Truss adds about **215 ms** above the precompiled cold-build floor; the budget
to match Tailwind is only **80 ms**. For startup, about **210 ms** of extra work must fit in **49 ms**.
This is an attribution estimate, not a precise isolation of one plugin hook: changed module sizes,
debug metadata, and framework interactions also contribute.

The next investigation should evaluate a lighter/native frontend or a broader incremental
compilation design, with initialization and per-file work measured separately. The benchmarks and
regression suite now provide the acceptance criteria. No claim is made that Tailwind is impossible
to beat, only that the incremental changes measured here have not done so.
