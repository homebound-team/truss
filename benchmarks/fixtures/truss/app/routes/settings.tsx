import { useState } from "react";

import { Css } from "~/Css";
import "./settings.css";
import {
  avatar,
  button,
  card,
  cardPad,
  pageActions,
  pageHead,
  pageSub,
  pageTitle,
  sectionNote,
  sectionTitle,
  sideLink,
  stack,
} from "../ui";

const sections = [
  { id: "profile", label: "Profile" },
  { id: "notifications", label: "Notifications" },
  { id: "security", label: "Security" },
  { id: "danger", label: "Danger zone" },
];

const notifications = [
  { name: "Deploy failures", desc: "Page the on-call rotation when a production deploy fails.", on: true },
  { name: "Budget thresholds", desc: "Email billing owners when a workspace passes 80% of its cap.", on: true },
  { name: "Weekly digest", desc: "A Monday summary of throughput, incidents and spend.", on: false },
  { name: "Member changes", desc: "Notify admins when someone joins or leaves the org.", on: false },
  { name: "Security advisories", desc: "Alert on newly disclosed CVEs affecting your dependencies.", on: true },
];

const sessionPolicies = [
  { id: "strict", name: "Strict — 8 hours", desc: "Re-authenticate every working day. Recommended for regulated workloads." },
  { id: "balanced", name: "Balanced — 7 days", desc: "Sessions persist for a week on trusted devices." },
  { id: "relaxed", name: "Relaxed — 30 days", desc: "Longest-lived sessions. Not available with SCIM enabled." },
];

export function meta() {
  return [{ title: "Settings · Nimbus" }];
}

export default function Settings() {
  const [active, setActive] = useState("profile");
  const [policy, setPolicy] = useState("balanced");
  const [toggles, setToggles] = useState(() => notifications.map((n) => n.on));

  return (
    <>
      <div css={pageHead}>
        <div>
          <h1 css={pageTitle}>Settings</h1>
          <p css={pageSub}>
            Organisation-wide preferences. Changes apply to all 34 workspaces unless a workspace
            overrides them.
          </p>
        </div>
      </div>

      <div css={s.settingsGrid}>
        <nav aria-label="Settings sections">
          <ul css={s.sideNav}>
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  aria-current={active === section.id ? "true" : undefined}
                  onClick={() => setActive(section.id)}
                  css={sideLink({ active: active === section.id })}
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div css={stack}>
          <section id="profile" css={{ ...card, ...cardPad }}>
            <h2 css={sectionTitle}>Profile</h2>
            <p css={sectionNote}>
              How your organisation appears on invoices, status pages and invitation emails.
            </p>

            <div css={s.identity}>
              <span aria-hidden="true" css={avatar({ size: "lg" })}>
                NS
              </span>
              <div>
                <div css={s.toggleName}>Nimbus Systems, Inc.</div>
                <p css={s.hint}>PNG or SVG, at least 256×256px, under 1 MB.</p>
                <div css={s.identityActions}>
                  <button type="button" css={button({ tone: "secondary" })}>
                    Upload
                  </button>
                  <button type="button" css={button({ tone: "ghost" })}>
                    Remove
                  </button>
                </div>
              </div>
            </div>

            <div css={s.formGrid}>
              <div css={s.formRow}>
                <label htmlFor="org-name" css={s.label}>
                  Organisation name
                </label>
                <input id="org-name" defaultValue="Nimbus Systems, Inc." css={s.input} />
              </div>
              <div css={s.formRow}>
                <label htmlFor="org-slug" css={s.label}>
                  URL slug
                </label>
                <input id="org-slug" defaultValue="nimbus" css={s.input} />
                <span css={s.hint}>nimbus.app/nimbus</span>
              </div>
              <div css={s.formRow}>
                <label htmlFor="billing-email" css={s.label}>
                  Billing email
                </label>
                <input
                  id="billing-email"
                  type="email"
                  defaultValue="billing@nimbus"
                  aria-invalid="true"
                  css={{ ...s.input, ...s.inputError }}
                />
                <span css={s.error}>Enter a complete email address.</span>
              </div>
              <div css={s.formRow}>
                <label htmlFor="region" css={s.label}>
                  Default region
                </label>
                <select id="region" defaultValue="us-east-1" css={{ ...s.input, ...s.select }}>
                  <option value="us-east-1">us-east-1 · N. Virginia</option>
                  <option value="eu-west-2">eu-west-2 · London</option>
                  <option value="ap-south-1">ap-south-1 · Mumbai</option>
                </select>
              </div>
              <div css={{ ...s.formRow, ...s.formRowFull }}>
                <label htmlFor="description" css={s.label}>
                  Description
                </label>
                <textarea
                  id="description"
                  defaultValue="Deployment and observability platform for multi-region teams."
                  css={{ ...s.input, ...s.textarea }}
                />
                <span css={s.hint}>
                  Shown on your public status page. Markdown supported.
                </span>
              </div>
            </div>
          </section>

          <section id="notifications" css={{ ...card, ...cardPad }}>
            <h2 css={sectionTitle}>Notifications</h2>
            <p css={sectionNote}>
              Delivery channels are configured per workspace. These switches control which events
              are eligible to send.
            </p>
            {notifications.map((item, i) => (
              <div
                key={item.name}
                css={{
                  ...s.toggleRow,
                  ...(i === 0 ? s.toggleRowFirst : undefined),
                  ...(i === notifications.length - 1 ? s.toggleRowLast : undefined),
                }}
              >
                <div css={s.toggleCopy}>
                  <div css={s.toggleName}>{item.name}</div>
                  <div css={s.toggleDesc}>{item.desc}</div>
                </div>
                <label css={s.switch}>
                  <input
                    type="checkbox"
                    checked={toggles[i]}
                    aria-label={item.name}
                    onChange={() => setToggles((prev) => prev.map((v, j) => (i === j ? !v : v)))}
                    css={s.switchInput}
                  />
                  {/* Driven by a sibling selector, not React state. */}
                  <span css={s.switchTrack} />
                </label>
              </div>
            ))}
          </section>

          <section id="security" css={{ ...card, ...cardPad }}>
            <h2 css={sectionTitle}>Security</h2>
            <p css={sectionNote}>
              Session lifetime for every member of the organisation.
            </p>
            <div css={s.radioCards}>
              {sessionPolicies.map((option) => (
                /* Selected state comes from :has(), so no state plumbing. */
                <label key={option.id} css={s.radioCard}>
                  <input
                    type="radio"
                    name="session-policy"
                    value={option.id}
                    checked={policy === option.id}
                    onChange={() => setPolicy(option.id)}
                    css={s.radioInput}
                  />
                  <span>
                    <span css={s.radioName}>{option.name}</span>
                    <span css={s.radioDesc}>{option.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section id="danger" css={{ ...card, ...cardPad }}>
            <h2 css={sectionTitle}>Danger zone</h2>
            <p css={sectionNote}>These actions are irreversible.</p>
            <div css={s.dangerZone}>
              <h3 css={s.dangerTitle}>Delete organisation</h3>
              <p css={s.dangerNote}>
                Permanently removes all 34 workspaces, deploy history and audit logs. Billing is
                settled at the end of the current period.
              </p>
              <button type="button" css={button({ tone: "danger" })}>
                Delete organisation
              </button>
            </div>
          </section>

          <div css={s.saveBar}>
            <span>1 unsaved change · billing email is invalid</span>
            <div css={pageActions}>
              <button type="button" css={button({ tone: "ghost" })}>
                Discard
              </button>
              <button type="button" css={button({ tone: "primary" })}>
                Save changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const s = {
  settingsGrid: Css.dg
    .gtc("190px minmax(0, 1fr)")
    .gapPx(28)
    .ais.ifStackAndDown.gtc("minmax(0, 1fr)")
    .gapPx(18).$,
  sideNav: Css.sticky.topPx(84).ifStackAndDown.static.$,

  identity: Css.df.aic.gapPx(14).pbPx(16).mbPx(16).bb.bcBorder.$,
  identityActions: Css.df.gapPx(8).mtPx(8).$,

  formGrid: Css.dg.gtc("repeat(2, minmax(0, 1fr))").gapPx(14).ifFormAndDown.gtc("minmax(0, 1fr)").$,
  formRow: Css.df.fdc.gapPx(5).$,
  formRowFull: Css.gc("1 / -1").$,
  label: Css.f12_5.fw6.text.cursorPointer.$,
  input: Css.w100
    .pyPx(8)
    .pxPx(11)
    .bgSurface.ba.bcBorderStrong.br6.f13_5.text.shadowNone.outlineStyle("none")
    .transition
    .onFocus.bcAccent.shadowRing.end.element("::placeholder").faint.o100.$,
  inputError: Css.bcDanger.shadowNone.onFocus.bcDanger.shadowRingDanger.$,
  select: Css.appearanceNone.prPx(24).$,
  textarea: Css.mhPx(80).resize("vertical").$,
  hint: Css.f12.faint.$,
  error: Css.f12.danger.fw5.$,

  toggleRow: Css.df.aic.jcsb.gapPx(18).pyPx(13).bb.bcBorder.$,
  toggleRowFirst: Css.ptPx(0).$,
  toggleRowLast: Css.add("borderBottomWidth", "0").pbPx(0).$,
  toggleCopy: Css.mw0.$,
  toggleName: Css.f13_5.fw(550).$,
  toggleDesc: Css.f12_5.muted.mtPx(2).$,

  switch: Css.relative.fs0.wPx(38).hPx(22).cursorPointer.$,
  switchInput: Css.absolute.o0.w100.h100.mPx(0).pPx(0).cursorPointer.$,
  // The knob and the checked state live in settings.css.ts — a `Css` chain can
  // only style its own element, so the preceding-sibling rule is a selector
  // there and this class is its anchor.
  switchTrack: Css.db.w100.h100.brPill.bgBorderStrong.pen
    .transitionSlow
    .className("switchTrack").$,

  radioCards: Css.dg.gapPx(10).$,
  radioCard: Css.df.aifs
    .gapPx(11)
    .pPx(13)
    .ba.bcBorderStrong.br10.cursorPointer.transition
    .className("radioCard")
    .onHover.bcAccent.$,
  radioInput: Css.mtPx(2).accentColor("var(--accent)").fs0.cursorPointer.$,
  radioName: Css.db.f13_5.fw6.$,
  radioDesc: Css.db.f12_5.muted.mtPx(2).$,

  dangerZone: Css.pPx(16).ba.bcDangerBorder.br10.bgDangerSoft.$,
  dangerTitle: Css.f14.fw6.danger.mbPx(4).$,
  dangerNote: Css.f12_5.muted.mbPx(12).maxw("56ch").$,

  saveBar: Css.sticky.bottom0.df.aic.jcsb
    .gapPx(14)
    .fww.pyPx(12)
    .pxPx(16)
    .bgSurfaceGlassStrong.backdropFilter("blur(10px)")
    .ba.bcBorder.br10.shadowMd.f12_5.muted.$,
};
