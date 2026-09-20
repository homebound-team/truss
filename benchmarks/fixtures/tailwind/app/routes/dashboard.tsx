import { useState } from "react";

import { cn } from "../cn";
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
      <div className={pageHead}>
        <div>
          <h1 className={pageTitle}>Overview</h1>
          <p className={pageSub}>
            Platform health across 12 regions. Figures refresh every 60 seconds and exclude
            internal traffic.
          </p>
        </div>
        <div className={pageActions}>
          <button type="button" className={button({ tone: "secondary" })}>
            Export CSV
          </button>
          <button type="button" className={button({ tone: "primary" })}>
            <PlusIcon />
            New deploy
          </button>
        </div>
      </div>

      <div className={s.kpiGrid}>
        {kpis.map((kpi) => (
          <article key={kpi.label} className={s.kpi}>
            <span className={s.kpiLabel}>{kpi.label}</span>
            <span className={s.kpiValue}>{kpi.value}</span>
            <div className={s.kpiFoot}>
              <span className={delta({ up: kpi.up })}>
                {kpi.up ? <ArrowUpIcon /> : <ArrowDownIcon />}
                {kpi.delta}%
              </span>
              <svg
                width={SPARK_W}
                height={SPARK_H}
                viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
                fill="none"
                aria-hidden="true"
                className={cn(s.spark, kpi.up ? s.sparkUp : s.sparkDown)}
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

      <div className={s.dashGrid}>
        <section className={card}>
          <div className={cardHead}>
            <div>
              <h2 className={cardTitle}>Revenue by month</h2>
              <p className={cardNote}>Committed contracts vs. usage-based billing</p>
            </div>
            <div className={segmented}>
              {ranges.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={range === r}
                  onClick={() => setRange(r)}
                  className={segButton({ active: range === r })}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className={s.chartBody}>
            <svg
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              role="img"
              aria-label="Revenue by month"
              className={s.chartSvg}
            >
              {GRID_LINES.map((g) => (
                <g key={g}>
                  <line
                    x1={CHART_PAD_L}
                    x2={CHART_W}
                    y1={gridY(g)}
                    y2={gridY(g)}
                    className={s.gridLine}
                  />
                  <text x={0} y={gridY(g) + 3} className={s.axisLabel}>
                    {g}
                  </text>
                </g>
              ))}
              {revenueBars.map((bar, i) => {
                const primary = barRect(i, bar.primary, CHART_MAX, 0);
                const secondary = barRect(i, bar.secondary, CHART_MAX, 1);
                return (
                  <g key={bar.month}>
                    <rect rx="2" {...primary} className={s.barPrimary} />
                    <rect rx="2" {...secondary} className={s.barSecondary} />
                    <text
                      x={primary.x + primary.width + 1.5}
                      y={CHART_H - 6}
                      textAnchor="middle"
                      className={s.axisLabel}
                    >
                      {bar.month}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className={s.chartLegend}>
              <span className={s.legendItem}>
                <span className={cn(s.legendSwatch, s.swatchPrimary)} />
                Committed
              </span>
              <span className={s.legendItem}>
                <span className={cn(s.legendSwatch, s.swatchSecondary)} />
                Usage-based
              </span>
            </div>
          </div>
        </section>

        <section className={card}>
          <div className={cardHead}>
            <h2 className={cardTitle}>Recent activity</h2>
            <a href="/" className={button({ tone: "ghost" })}>
              View all
            </a>
          </div>
          <ul>
            {activity.map((item, i) => (
              <li
                key={`${item.who}-${item.target}`}
                className={cn(s.feedItem, i === activity.length - 1 && s.feedItemLast)}
              >
                <span aria-hidden="true" className={avatar({ size: "sm" })}>
                  {item.initials}
                </span>
                <span className={s.feedText}>
                  <span className={s.feedWho}>{item.who}</span> {item.what}{" "}
                  <code className={s.feedTarget}>{item.target}</code>
                </span>
                <span className={s.feedWhen}>{item.when}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className={s.insightGrid}>
        {insights.map((insight) => (
          <article key={insight.title} className={cn(card, cardPad)}>
            <span aria-hidden="true" className={s.insightIcon}>
              {insight.icon}
            </span>
            <h3 className={s.insightTitle}>{insight.title}</h3>
            <p className={s.insightBody}>{insight.body}</p>
            <span className={tag}>{insight.tag}</span>
          </article>
        ))}
      </div>
    </>
  );
}

const s = {
  kpiGrid: "grid grid-cols-4 gap-14 mb-18 max-lap:grid-cols-2 max-phone:grid-cols-1",
  kpi: "flex flex-col gap-10 p-16 bg-surface border border-border rounded-14 shadow-sm transition hover:border-border-strong hover:shadow-md",
  kpiLabel: "text-12-5 font-medium text-muted",
  kpiValue: "text-23 font-650 tracking-[-0.025em] tabular-nums",
  kpiFoot: "flex items-end justify-between gap-10",
  spark: "block",
  sparkUp: "text-success",
  sparkDown: "text-danger",

  dashGrid:
    "grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-14 mb-18 max-tablet:grid-cols-1",
  chartBody: "p-18",
  chartSvg: "block w-full h-auto",
  gridLine: "stroke-border stroke-1",
  axisLabel: "fill-faint text-10",
  barPrimary: "fill-accent",
  barSecondary: "fill-bar-secondary",
  chartLegend: "flex gap-16 mt-14",
  legendItem: "flex items-center gap-6 text-12-5 text-muted",
  legendSwatch: "size-9 rounded-2",
  swatchPrimary: "bg-accent",
  swatchSecondary: "bg-bar-secondary",

  feedItem: "flex items-start gap-10 py-11 px-18 border-b border-border",
  feedItemLast: "border-b-0",
  feedText: "grow text-13 leading-[1.45] text-muted min-w-0",
  feedWho: "font-semibold text-text",
  feedTarget: "font-mono text-12 py-1 px-5 rounded-4 bg-surface2 text-text",
  feedWhen: "text-11-5 text-faint whitespace-nowrap shrink-0",

  insightGrid: "grid grid-cols-3 gap-14 max-narrow:grid-cols-1",
  insightIcon:
    "grid place-items-center size-30 mb-11 rounded-6 bg-accent-soft text-accent text-14",
  insightTitle: "text-14 font-semibold mb-5",
  insightBody: "text-13 leading-[1.5] text-muted mb-11",
};
