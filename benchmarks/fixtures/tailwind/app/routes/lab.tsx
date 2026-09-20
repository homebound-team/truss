import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../cn";
import { pipelineTracks, regions, runLog, runStateLabels } from "../data";
import { card, cardHead, cardNote, cardTitle, pageHead, pageSub, pageTitle, sectionNote, sectionTitle, stack } from "../ui";

export function meta() {
  return [{ title: "Lab · Nimbus" }];
}

/* -----------------------------------------------------------------------------
 * 1. Structural and relational selectors
 *
 * One class on the table. Zebra striping, the divider rule and the follow-on
 * tint below a failed run are all selectors in lab.css, so nothing about row
 * position has to be computed in javascript and no class varies per row.
 * -----------------------------------------------------------------------------*/

const runTable = "w-full border-collapse text-13 run-table";

const runStateVariants = cva(
  "inline-flex items-center gap-5 py-2 px-8 rounded-pill text-11-5 font-semibold",
  {
    variants: {
      tone: {
        passed: "bg-success-soft text-success",
        failed: "bg-danger-soft text-danger",
        running: "bg-accent-soft text-accent",
        queued: "bg-surface3 text-muted",
      },
    },
    defaultVariants: { tone: "queued" },
  },
);

type RunTone = NonNullable<VariantProps<typeof runStateVariants>["tone"]>;

/** A run-state pill, queued by default. */
function runState(variants: VariantProps<typeof runStateVariants> = {}): string {
  return cn(runStateVariants(variants));
}

/* -----------------------------------------------------------------------------
 * 2. Motion
 * -----------------------------------------------------------------------------*/

const motionRow = "flex flex-wrap items-center gap-22 py-18 px-18";

const motionItem = "flex flex-col items-center gap-8 text-11-5 text-muted";

const spinner = "size-22 rounded-pill border-2 border-border border-t-accent animate-spin";

const pulseDot = "size-12 rounded-pill bg-success animate-pulse";

const sweepRing =
  "size-24 rounded-pill bg-[conic-gradient(from_0deg,var(--accent),transparent_70%)] animate-sweep";

const trackList = "flex flex-col gap-12 pt-4 pb-18 px-18";

const trackRow = "flex items-center gap-12 text-12-5";
const trackLabel = "w-78 text-muted";

const trackBar = "relative flex-1 h-8 rounded-pill bg-surface3 overflow-hidden";

const trackFill = "h-full rounded-pill shimmer-gradient bg-[length:200%_100%] animate-shimmer";

/* -----------------------------------------------------------------------------
 * 3. Container queries
 *
 * Each card is its own container, so the layout answers the card's width rather
 * than the viewport's — the same card reflows differently in the wide column and
 * the narrow one.
 * -----------------------------------------------------------------------------*/

const regionGrid = "grid grid-cols-[2fr_1fr] gap-14 p-18 max-tablet:grid-cols-1";

const regionCard = "@container border border-border rounded-10 bg-surface2 p-14";

const regionInner =
  "flex flex-col gap-10 @min-[340px]:flex-row @min-[340px]:items-center @min-[340px]:justify-between";

const regionName = "text-13-5 font-semibold";

const regionStats = "flex gap-14 @min-[340px]:gap-22";

const regionStat = "flex flex-col gap-2";
const regionStatValue = "text-14 font-semibold tabular-nums";
const regionStatLabel = "text-11 text-faint";

export default function Lab() {
  return (
    <>
      <div className={pageHead}>
        <div>
          <h1 className={pageTitle}>Lab</h1>
          <p className={pageSub}>
            The surfaces the rest of the console does not exercise — structural selectors, keyframe
            motion and container queries — held to the same pixels in every engine.
          </p>
        </div>
      </div>

      <div className={stack}>
        <section>
          <h2 className={sectionTitle}>Run log</h2>
          <p className={sectionNote}>
            Zebra striping, dividers and the tint below a failed run are selectors, not per-row
            classes.
          </p>
          <div className={card}>
            <div className={cardHead}>
              <div>
                <div className={cardTitle}>Recent runs</div>
                <div className={cardNote}>Last 8 across every region</div>
              </div>
            </div>
            <table className={runTable}>
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Job</th>
                  <th>Step</th>
                  <th>State</th>
                  <th data-numeric="true">Queue</th>
                  <th data-numeric="true">Duration</th>
                </tr>
              </thead>
              <tbody>
                {runLog.map((run) => (
                  <tr key={run.id} data-state={run.state}>
                    <td>{run.id}</td>
                    <td>{run.job}</td>
                    <td>{run.step}</td>
                    <td>
                      <span className={runState({ tone: run.state as RunTone })}>
                        {runStateLabels[run.state]}
                      </span>
                    </td>
                    <td data-numeric="true">{run.queue}</td>
                    <td data-numeric="true">{run.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className={sectionTitle}>Motion</h2>
          <p className={sectionNote}>
            Keyframes owned by the engine, including one that animates a registered custom property.
          </p>
          <div className={card}>
            <div className={motionRow}>
              <div className={motionItem}>
                <div className={spinner} />
                <span>Spinner</span>
              </div>
              <div className={motionItem}>
                <div className={pulseDot} />
                <span>Heartbeat</span>
              </div>
              <div className={motionItem}>
                <div className={sweepRing} />
                <span>Sweep</span>
              </div>
            </div>
            <div className={trackList}>
              {pipelineTracks.map((track) => (
                <div key={track.label} className={trackRow}>
                  <span className={trackLabel}>{track.label}</span>
                  <span className={trackBar}>
                    <span className={trackFill} style={{ width: `${track.pct}%` }} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <h2 className={sectionTitle}>Capacity</h2>
          <p className={sectionNote}>
            Each card is a query container, so the same card reflows on its own width rather than the
            viewport's.
          </p>
          <div className={card}>
            <div className={regionGrid}>
              {regions.map((region) => (
                <article key={region.name} className={regionCard}>
                  <div className={regionInner}>
                    <div className={regionName}>{region.name}</div>
                    <div className={regionStats}>
                      <div className={regionStat}>
                        <span className={regionStatValue}>{region.cpu}%</span>
                        <span className={regionStatLabel}>CPU</span>
                      </div>
                      <div className={regionStat}>
                        <span className={regionStatValue}>{region.mem}%</span>
                        <span className={regionStatLabel}>Memory</span>
                      </div>
                      <div className={regionStat}>
                        <span className={regionStatValue}>
                          {region.pods}/{region.cap}
                        </span>
                        <span className={regionStatLabel}>Pods</span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
