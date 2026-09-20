import { useState } from "react";

import { Css } from "~/Css";
import {
  barRect,
  CHART_H,
  CHART_MAX,
  CHART_PAD_L,
  CHART_W,
  GRID_LINES,
  gridY,
  SPARK_H,
  SPARK_W,
  sparklinePoints,
} from "../chart-utils";
import { activity, insights, kpis, revenueBars } from "../data";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon } from "../icons";
import {
  avatar,
  button,
  card,
  cardHead,
  cardNote,
  cardPad,
  cardTitle,
  delta,
  pageActions,
  pageHead,
  pageSub,
  pageTitle,
  segButton,
  segmented,
  tag,
} from "../ui";

const ranges = ["3m", "6m", "12m"];

export function meta() {
  return [{ title: "Overview · Nimbus" }];
}

export default function Dashboard() {
  const [range, setRange] = useState("12m");

  return (
    <>
      <div css={pageHead}>
        <div>
          <h1 css={pageTitle}>Overview</h1>
          <p css={pageSub}>
            Platform health across 12 regions. Figures refresh every 60 seconds and exclude
            internal traffic.
          </p>
        </div>
        <div css={pageActions}>
          <button type="button" css={button({ tone: "secondary" })}>
            Export CSV
          </button>
          <button type="button" css={button({ tone: "primary" })}>
            <PlusIcon />
            New deploy
          </button>
        </div>
      </div>

      <div css={s.kpiGrid}>
        {kpis.map((kpi) => (
          <article key={kpi.label} css={s.kpi}>
            <span css={s.kpiLabel}>{kpi.label}</span>
            <span css={s.kpiValue}>{kpi.value}</span>
            <div css={s.kpiFoot}>
              <span css={delta({ up: kpi.up })}>
                {kpi.up ? <ArrowUpIcon /> : <ArrowDownIcon />}
                {kpi.delta}%
              </span>
              <svg
                width={SPARK_W}
                height={SPARK_H}
                viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
                fill="none"
                aria-hidden="true"
                css={{ ...s.spark, ...(kpi.up ? s.sparkUp : s.sparkDown) }}
              >
                <polyline
                  points={sparklinePoints(kpi.series)}
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </article>
        ))}
      </div>

      <div css={s.dashGrid}>
        <section css={card}>
          <div css={cardHead}>
            <div>
              <h2 css={cardTitle}>Revenue by month</h2>
              <p css={cardNote}>Committed contracts vs. usage-based billing</p>
            </div>
            <div css={segmented}>
              {ranges.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={range === r}
                  onClick={() => setRange(r)}
                  css={segButton({ active: range === r })}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div css={s.chartBody}>
            <svg
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              role="img"
              aria-label="Revenue by month"
              css={s.chartSvg}
            >
              {GRID_LINES.map((g) => (
                <g key={g}>
                  <line
                    x1={CHART_PAD_L}
                    x2={CHART_W}
                    y1={gridY(g)}
                    y2={gridY(g)}
                    css={s.gridLine}
                  />
                  <text x={0} y={gridY(g) + 3} css={s.axisLabel}>
                    {g}
                  </text>
                </g>
              ))}
              {revenueBars.map((bar, i) => {
                const primary = barRect(i, bar.primary, CHART_MAX, 0);
                const secondary = barRect(i, bar.secondary, CHART_MAX, 1);
                return (
                  <g key={bar.month}>
                    <rect rx="2" {...primary} css={s.barPrimary} />
                    <rect rx="2" {...secondary} css={s.barSecondary} />
                    <text
                      x={primary.x + primary.width + 1.5}
                      y={CHART_H - 6}
                      textAnchor="middle"
                      css={s.axisLabel}
                    >
                      {bar.month}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div css={s.chartLegend}>
              <span css={s.legendItem}>
                <span css={{ ...s.legendSwatch, ...s.swatchPrimary }} />
                Committed
              </span>
              <span css={s.legendItem}>
                <span css={{ ...s.legendSwatch, ...s.swatchSecondary }} />
                Usage-based
              </span>
            </div>
          </div>
        </section>

        <section css={card}>
          <div css={cardHead}>
            <h2 css={cardTitle}>Recent activity</h2>
            <a href="/" css={button({ tone: "ghost" })}>
              View all
            </a>
          </div>
          <ul>
            {activity.map((item, i) => (
              <li
                key={`${item.who}-${item.target}`}
                css={{ ...s.feedItem, ...(i === activity.length - 1 ? s.feedItemLast : undefined) }}
              >
                <span aria-hidden="true" css={avatar({ size: "sm" })}>
                  {item.initials}
                </span>
                <span css={s.feedText}>
                  <span css={s.feedWho}>{item.who}</span> {item.what}{" "}
                  <code css={s.feedTarget}>{item.target}</code>
                </span>
                <span css={s.feedWhen}>{item.when}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div css={s.insightGrid}>
        {insights.map((insight) => (
          <article key={insight.title} css={{ ...card, ...cardPad }}>
            <span aria-hidden="true" css={s.insightIcon}>
              {insight.icon}
            </span>
            <h3 css={s.insightTitle}>{insight.title}</h3>
            <p css={s.insightBody}>{insight.body}</p>
            <span css={tag}>{insight.tag}</span>
          </article>
        ))}
      </div>
    </>
  );
}

const s = {
  kpiGrid: Css.dg
    .gtc("repeat(4, minmax(0, 1fr))")
    .gapPx(14)
    .mbPx(18)
    .ifLapAndDown.gtc("repeat(2, minmax(0, 1fr))")
    .ifPhoneAndDown.gtc("minmax(0, 1fr)").$,
  kpi: Css.df.fdc
    .gapPx(10)
    .pPx(16)
    .bgSurface.ba.bcBorder.br14.shadowSm.transition
    .onHover.bcBorderStrong.shadowMd.$,
  kpiLabel: Css.f12_5.fw5.muted.$,
  kpiValue: Css.f23
    .fw(650)
    .ls("-0.025em")
    .tabularNums.$,
  kpiFoot: Css.df.aife.jcsb.gapPx(10).$,
  spark: Css.db.$,
  sparkUp: Css.success.$,
  sparkDown: Css.danger.$,

  dashGrid: Css.dg
    .gtc("minmax(0, 2fr) minmax(0, 1fr)")
    .gapPx(14)
    .mbPx(18)
    .ifTabletAndDown.gtc("minmax(0, 1fr)").$,
  chartBody: Css.pPx(18).$,
  chartSvg: Css.db.w100.ha.$,
  gridLine: Css.add("stroke", "var(--border)").add("strokeWidth", "1").$,
  axisLabel: Css.fFaint.f10.$,
  barPrimary: Css.fAccent.$,
  barSecondary: Css.fBarSecondary.$,
  chartLegend: Css.df.gapPx(16).mtPx(14).$,
  legendItem: Css.df.aic.gapPx(6).f12_5.muted.$,
  legendSwatch: Css.sqPx(9).br2.$,
  swatchPrimary: Css.bgAccent.$,
  swatchSecondary: Css.bgBarSecondary.$,

  feedItem: Css.df.aifs.gapPx(10).pyPx(11).pxPx(18).bb.bcBorder.$,
  feedItemLast: Css.add("borderBottomWidth", "0").$,
  feedText: Css.fg1.f13.lh(1.45).muted.mw0.$,
  feedWho: Css.fw6.text.$,
  feedTarget: Css.fontMono.f12.pyPx(1).pxPx(5).br4.bgSurface2.text.$,
  feedWhen: Css.f11_5.faint.wsnw.fs0.$,

  insightGrid: Css.dg.gtc("repeat(3, minmax(0, 1fr))").gapPx(14).ifNarrowAndDown.gtc("minmax(0, 1fr)").$,
  insightIcon: Css.dg.pic.sqPx(30).mbPx(11).br6.bgAccentSoft.accent.f14.$,
  insightTitle: Css.f14.fw6.mbPx(5).$,
  insightBody: Css.f13.lh(1.5).muted.mbPx(11).$,
};
