import { Css, type Properties } from "~/Css";
import "./lab.css";
import { pipelineTracks, regions, runLog, runStateLabels } from "../data";
import { card, cardHead, cardNote, cardTitle, pageHead, pageSub, pageTitle, sectionNote, sectionTitle, stack } from "../ui";

export function meta() {
  return [{ title: "Lab · Nimbus" }];
}

/* -----------------------------------------------------------------------------
 * 1. Structural and relational selectors
 *
 * One class on the table. Zebra striping, the divider rule and the follow-on
 * tint below a failed run are all selectors in lab.css.ts, so nothing about row
 * position has to be computed in javascript and no class varies per row.
 * -----------------------------------------------------------------------------*/

const runTable = Css.w100.borderCollapse("collapse").f13.className("runTable").$;

type RunTone = "passed" | "failed" | "running" | "queued";

const runStateBase = Css.dif.aic.gapPx(5).pyPx(2).pxPx(8).brPill.f11_5.fw6.$;
const runStateTone: Record<RunTone, Properties> = {
  passed: Css.bgSuccessSoft.success.$,
  failed: Css.bgDangerSoft.danger.$,
  running: Css.bgAccentSoft.accent.$,
  queued: Css.bgSurface3.muted.$,
};

/** A run-state pill, queued by default. */
function runState(variants: { tone?: RunTone } = {}): Properties {
  return { ...runStateBase, ...runStateTone[variants.tone ?? "queued"] };
}

/* -----------------------------------------------------------------------------
 * 2. Motion
 * -----------------------------------------------------------------------------*/

const motionRow = Css.df.fww.aic.gapPx(22).pyPx(18).pxPx(18).$;

const motionItem = Css.df.fdc.aic.gapPx(8).f11_5.muted.$;

const spinner = Css.sqPx(22)
  .brPill.bss.bw2.bcBorder.btc("var(--accent)")
  .spin("0.8s linear infinite").$;

const pulseDot = Css.sqPx(12).brPill.bgSuccess.pulse("1.4s ease-in-out infinite").$;

const sweepRing = Css.sqPx(24)
  .brPill.add("background", "conic-gradient(from 0deg, var(--accent), transparent 70%)")
  .sweep("1.6s linear infinite").$;

const trackList = Css.df.fdc.gapPx(12).ptPx(4).pbPx(18).pxPx(18).$;

const trackRow = Css.df.aic.gapPx(12).f12_5.$;
const trackLabel = Css.wPx(78).muted.$;

const trackBar = Css.relative.f1.hPx(8).brPill.bgSurface3.oh.$;

const trackFill = Css.h100.brPill.shimmerGradient.bgSize("200% 100%").shimmer("2.2s linear infinite").$;

/* -----------------------------------------------------------------------------
 * 3. Container queries
 *
 * Each card is its own container, so the layout answers the card's width rather
 * than the viewport's — the same card reflows differently in the wide column and
 * the narrow one.
 * -----------------------------------------------------------------------------*/

const regionGrid = Css.dg.gtc("2fr 1fr").gapPx(14).pPx(18).ifTabletAndDown.gtc("1fr").$;

const regionCard = Css.ctis.ba.bcBorder.br10.bgSurface2.pPx(14).$;

const regionInner = Css.df.fdc.gapPx(10).ifContainer({ gt: 339 }).fdr.aic.jcsb.$;

const regionName = Css.f13_5.fw6.$;

const regionStats = Css.df.gapPx(14).ifContainer({ gt: 339 }).gapPx(22).$;

const regionStat = Css.df.fdc.gapPx(2).$;
const regionStatValue = Css.f14.fw6.tabularNums.$;
const regionStatLabel = Css.f11.faint.$;

export default function Lab() {
  return (
    <>
      <div css={pageHead}>
        <div>
          <h1 css={pageTitle}>Lab</h1>
          <p css={pageSub}>
            The surfaces the rest of the console does not exercise — structural selectors, keyframe
            motion and container queries — held to the same pixels in every engine.
          </p>
        </div>
      </div>

      <div css={stack}>
        <section>
          <h2 css={sectionTitle}>Run log</h2>
          <p css={sectionNote}>
            Zebra striping, dividers and the tint below a failed run are selectors, not per-row
            classes.
          </p>
          <div css={card}>
            <div css={cardHead}>
              <div>
                <div css={cardTitle}>Recent runs</div>
                <div css={cardNote}>Last 8 across every region</div>
              </div>
            </div>
            <table css={runTable}>
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
                      <span css={runState({ tone: run.state as RunTone })}>
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
          <h2 css={sectionTitle}>Motion</h2>
          <p css={sectionNote}>
            Keyframes owned by the engine, including one that animates a registered custom property.
          </p>
          <div css={card}>
            <div css={motionRow}>
              <div css={motionItem}>
                <div css={spinner} />
                <span>Spinner</span>
              </div>
              <div css={motionItem}>
                <div css={pulseDot} />
                <span>Heartbeat</span>
              </div>
              <div css={motionItem}>
                <div css={sweepRing} />
                <span>Sweep</span>
              </div>
            </div>
            <div css={trackList}>
              {pipelineTracks.map((track) => (
                <div key={track.label} css={trackRow}>
                  <span css={trackLabel}>{track.label}</span>
                  <span css={trackBar}>
                    <span css={{ ...trackFill, ...Css.w(`${track.pct}%`).$ }} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <h2 css={sectionTitle}>Capacity</h2>
          <p css={sectionNote}>
            Each card is a query container, so the same card reflows on its own width rather than the
            viewport's.
          </p>
          <div css={card}>
            <div css={regionGrid}>
              {regions.map((region) => (
                <article key={region.name} css={regionCard}>
                  <div css={regionInner}>
                    <div css={regionName}>{region.name}</div>
                    <div css={regionStats}>
                      <div css={regionStat}>
                        <span css={regionStatValue}>{region.cpu}%</span>
                        <span css={regionStatLabel}>CPU</span>
                      </div>
                      <div css={regionStat}>
                        <span css={regionStatValue}>{region.mem}%</span>
                        <span css={regionStatLabel}>Memory</span>
                      </div>
                      <div css={regionStat}>
                        <span css={regionStatValue}>
                          {region.pods}/{region.cap}
                        </span>
                        <span css={regionStatLabel}>Pods</span>
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
