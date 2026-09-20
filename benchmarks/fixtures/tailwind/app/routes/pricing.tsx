import { useState } from "react";

import { cn } from "../cn";
import { comparison, faqs, plans } from "../data";
import { CheckIcon } from "../icons";
import { button, pageSub, pageTitle, segButton, segmented } from "../ui";

const periods = [
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly · save 20%" },
] as const;

export function meta() {
  return [{ title: "Pricing · Nimbus" }];
}

export default function Pricing() {
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");

  return (
    <>
      <div className={s.pricingHead}>
        <h1 className={pageTitle}>Pricing that scales with your rollout</h1>
        <p className={cn(pageSub, s.centeredSub)}>
          Every plan includes unlimited members, preview environments and the full API. Pay only
          for the workspaces you keep running.
        </p>
        <div className={s.billingToggle}>
          <div className={segmented}>
            {periods.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={period === p.id}
                onClick={() => setPeriod(p.id)}
                className={segButton({ active: period === p.id })}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={s.planGrid}>
        {plans.map((plan) => {
          const amount = plan.price[period];
          return (
            <article key={plan.name} className={cn(s.plan, plan.featured && s.planFeatured)}>
              {plan.featured && <span className={s.planRibbon}>Most popular</span>}
              <div>
                <h2 className={s.planName}>{plan.name}</h2>
                <p className={s.planBlurb}>{plan.blurb}</p>
              </div>
              <div className={s.planPrice}>
                {amount === null ? (
                  <span className={s.planAmount}>Custom</span>
                ) : (
                  <>
                    <span className={s.planAmount}>${amount}</span>
                    <span className={s.planPeriod}>per seat / month</span>
                  </>
                )}
              </div>
              <ul className={s.planFeatures}>
                {plan.features.map((feature) => (
                  <li key={feature} className={s.planFeature}>
                    <span className={s.check}>
                      <CheckIcon />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={button({ tone: plan.featured ? "primary" : "secondary", block: true })}
              >
                {plan.cta}
              </button>
            </article>
          );
        })}
      </div>

      <h2 className={s.compareTitle}>Compare every plan</h2>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th scope="col" className={cn(s.th, s.thLeft)}>
                Feature
              </th>
              <th scope="col" className={s.th}>
                Starter
              </th>
              <th scope="col" className={s.th}>
                Team
              </th>
              <th scope="col" className={s.th}>
                Enterprise
              </th>
            </tr>
          </thead>
          <tbody>
            {comparison.map((row, i) => {
              const last = i === comparison.length - 1;
              const td = cn(s.td, last && s.tdLast);
              return (
                <tr key={row.feature} className={s.tr}>
                  <td className={cn(td, s.tdFirst)}>{row.feature}</td>
                  <td className={td}>{row.starter}</td>
                  <td className={cn(td, s.tdFeatured)}>{row.team}</td>
                  <td className={td}>{row.enterprise}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className={cn(s.compareTitle, s.compareTitleTop)}>Frequently asked</h2>
      <div className={s.faqList}>
        {faqs.map((faq, i) => (
          <details key={faq.q} open={i === 0} className={s.faq}>
            {/* The open/closed glyph is a `details[open]` selector in
                pricing.css, so the accordion needs no onToggle handler or
                React state. */}
            <summary className={s.faqSummary}>{faq.q}</summary>
            <div className={s.faqBody}>{faq.a}</div>
          </details>
        ))}
      </div>
    </>
  );
}

const s = {
  pricingHead: "text-center mb-26",
  centeredSub: "mx-auto",
  billingToggle: "flex justify-center items-center gap-10 mt-18",

  planGrid:
    "grid grid-cols-3 gap-16 items-start mb-44 max-tablet:grid-cols-1 max-tablet:max-w-440 max-tablet:mx-auto",
  plan: "relative flex flex-col gap-14 p-22 bg-surface border border-border rounded-14 shadow-sm",
  planFeatured: "border-accent shadow-lg tablet:scale-[1.035]",
  planRibbon:
    "absolute -top-10 left-1/2 -translate-x-1/2 py-3 px-11 rounded-pill bg-accent text-accent-contrast text-11 font-650 tracking-[0.02em] whitespace-nowrap",
  planName: "text-15 font-650",
  planBlurb: "text-13 text-muted mt-3",
  planPrice: "flex items-baseline gap-5 pb-14 border-b border-border",
  planAmount: "text-34 font-680 tracking-[-0.03em] leading-[1]",
  planPeriod: "text-13 text-muted",
  planFeatures: "flex flex-col gap-9 grow",
  planFeature: "flex items-start gap-8 text-13 leading-[1.45] text-muted",
  check: "text-success shrink-0 mt-1 leading-[0]",

  compareTitle: "text-18 font-semibold mb-14 text-center",
  compareTitleTop: "mt-44",

  tableWrap: "overflow-x-auto bg-surface border border-border rounded-14 shadow-sm",
  table: "w-full min-w-620 border-separate border-spacing-0",
  th: "py-10 px-14 bg-surface2 border-b border-border text-12 font-semibold text-text text-center",
  thLeft: "text-left",
  tr: "bg-transparent transition-colors duration-120 hover:bg-surface2",
  td: "py-11 px-14 border-b border-border text-13-5 text-center",
  tdFirst: "text-left font-550",
  tdLast: "border-b-0",
  tdFeatured: "bg-accent-soft text-accent font-semibold",

  faqList: "flex flex-col gap-10",
  faq: "bg-surface border border-border rounded-10",
  faqSummary:
    "py-14 px-16 text-13-5 font-semibold list-none flex items-center justify-between gap-12 cursor-pointer outline-accent faq-summary",
  faqBody: "py-13 px-16 border-t border-border text-13 leading-[1.6] text-muted",
};
