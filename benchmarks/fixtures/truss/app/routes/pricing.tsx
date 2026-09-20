import { useState } from "react";

import { Css } from "~/Css";
import "./pricing.css";
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
      <div css={s.pricingHead}>
        <h1 css={pageTitle}>Pricing that scales with your rollout</h1>
        <p css={{ ...pageSub, ...s.centeredSub }}>
          Every plan includes unlimited members, preview environments and the full API. Pay only
          for the workspaces you keep running.
        </p>
        <div css={s.billingToggle}>
          <div css={segmented}>
            {periods.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={period === p.id}
                onClick={() => setPeriod(p.id)}
                css={segButton({ active: period === p.id })}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div css={s.planGrid}>
        {plans.map((plan) => {
          const amount = plan.price[period];
          return (
            <article key={plan.name} css={{ ...s.plan, ...(plan.featured ? s.planFeatured : undefined) }}>
              {plan.featured && <span css={s.planRibbon}>Most popular</span>}
              <div>
                <h2 css={s.planName}>{plan.name}</h2>
                <p css={s.planBlurb}>{plan.blurb}</p>
              </div>
              <div css={s.planPrice}>
                {amount === null ? (
                  <span css={s.planAmount}>Custom</span>
                ) : (
                  <>
                    <span css={s.planAmount}>${amount}</span>
                    <span css={s.planPeriod}>per seat / month</span>
                  </>
                )}
              </div>
              <ul css={s.planFeatures}>
                {plan.features.map((feature) => (
                  <li key={feature} css={s.planFeature}>
                    <span css={s.check}>
                      <CheckIcon />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                css={button({ tone: plan.featured ? "primary" : "secondary", block: true })}
              >
                {plan.cta}
              </button>
            </article>
          );
        })}
      </div>

      <h2 css={s.compareTitle}>Compare every plan</h2>
      <div css={s.tableWrap}>
        <table css={s.table}>
          <thead>
            <tr>
              <th scope="col" css={{ ...s.th, ...s.thLeft }}>
                Feature
              </th>
              <th scope="col" css={s.th}>
                Starter
              </th>
              <th scope="col" css={s.th}>
                Team
              </th>
              <th scope="col" css={s.th}>
                Enterprise
              </th>
            </tr>
          </thead>
          <tbody>
            {comparison.map((row, i) => {
              const last = i === comparison.length - 1;
              const td = { ...s.td, ...(last ? s.tdLast : undefined) };
              return (
                <tr key={row.feature} css={s.tr}>
                  <td css={{ ...td, ...s.tdFirst }}>{row.feature}</td>
                  <td css={td}>{row.starter}</td>
                  <td css={{ ...td, ...s.tdFeatured }}>{row.team}</td>
                  <td css={td}>{row.enterprise}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 css={{ ...s.compareTitle, ...s.compareTitleTop }}>Frequently asked</h2>
      <div css={s.faqList}>
        {faqs.map((faq, i) => (
          <details key={faq.q} open={i === 0} css={s.faq}>
            {/* The open/closed glyph is a `details[open]` selector in
                pricing.css.ts, so the accordion needs no onToggle handler or
                React state. */}
            <summary css={s.faqSummary}>{faq.q}</summary>
            <div css={s.faqBody}>{faq.a}</div>
          </details>
        ))}
      </div>
    </>
  );
}

const s = {
  pricingHead: Css.tac.mbPx(26).$,
  centeredSub: Css.mxa.$,
  billingToggle: Css.df.jcc.aic.gapPx(10).mtPx(18).$,

  planGrid: Css.dg
    .gtc("repeat(3, minmax(0, 1fr))")
    .gapPx(16)
    .ais.mbPx(44)
    .ifTabletAndDown.gtc("minmax(0, 1fr)")
    .maxwPx(440).mxa.$,
  plan: Css.relative.df.fdc.gapPx(14).pPx(22).bgSurface.ba.bcBorder.br14.shadowSm.$,
  planFeatured: Css.bcAccent.shadowLg.ifLapAndUp.transform("scale(1.035)").$,
  planRibbon: Css.absolute
    .topPx(-10)
    .left("50%")
    .transform("translateX(-50%)")
    .pyPx(3)
    .pxPx(11)
    .brPill.bgAccent.accentContrast.f11.fw(650)
    .ls("0.02em").wsnw.$,
  planName: Css.f15.fw(650).$,
  planBlurb: Css.f13.muted.mtPx(3).$,
  planPrice: Css.df.aib.gapPx(5).pbPx(14).bb.bcBorder.$,
  planAmount: Css.f34.fw(680).ls("-0.03em").lh(1).$,
  planPeriod: Css.f13.muted.$,
  planFeatures: Css.df.fdc.gapPx(9).fg1.$,
  planFeature: Css.df.aifs.gapPx(8).f13.lh(1.45).muted.$,
  check: Css.success.fs0.mtPx(1).lh(0).$,

  compareTitle: Css.f18.fw6.mbPx(14).tac.$,
  compareTitleTop: Css.mtPx(44).$,

  tableWrap: Css.oxa.bgSurface.ba.bcBorder.br14.shadowSm.$,
  table: Css.w100.mwPx(620).borderCollapse("separate").borderSpacing("0").$,
  th: Css.pyPx(10).pxPx(14).bgSurface2.bb.bcBorder.f12.fw6.text.tac.$,
  thLeft: Css.tal.$,
  tr: Css.bgTransparent.transitionFast.onHover.bgSurface2.$,
  td: Css.pyPx(11).pxPx(14).bb.bcBorder.f13_5.tac.$,
  tdFirst: Css.tal.fw(550).$,
  tdLast: Css.add("borderBottomWidth", "0").$,
  tdFeatured: Css.bgAccentSoft.accent.fw6.$,

  faqList: Css.df.fdc.gapPx(10).$,
  faq: Css.bgSurface.ba.bcBorder.br10.$,
  faqSummary: Css.pyPx(14)
    .pxPx(16)
    .f13_5.fw6.listNone
    .df.aic.jcsb.gapPx(12)
    .cursorPointer.ocAccent.className("faqSummary").$,
  faqBody: Css.pyPx(13).pxPx(16).bt.bcBorder.f13.lh(1.6).muted.$,
};
