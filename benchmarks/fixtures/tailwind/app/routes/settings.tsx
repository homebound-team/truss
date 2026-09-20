import { useState } from "react";

import { cn } from "../cn";
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
      <div className={pageHead}>
        <div>
          <h1 className={pageTitle}>Settings</h1>
          <p className={pageSub}>
            Organisation-wide preferences. Changes apply to all 34 workspaces unless a workspace
            overrides them.
          </p>
        </div>
      </div>

      <div className={s.settingsGrid}>
        <nav aria-label="Settings sections">
          <ul className={s.sideNav}>
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  aria-current={active === section.id ? "true" : undefined}
                  onClick={() => setActive(section.id)}
                  className={sideLink({ active: active === section.id })}
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className={stack}>
          <section id="profile" className={cn(card, cardPad)}>
            <h2 className={sectionTitle}>Profile</h2>
            <p className={sectionNote}>
              How your organisation appears on invoices, status pages and invitation emails.
            </p>

            <div className={s.identity}>
              <span aria-hidden="true" className={avatar({ size: "lg" })}>
                NS
              </span>
              <div>
                <div className={s.toggleName}>Nimbus Systems, Inc.</div>
                <p className={s.hint}>PNG or SVG, at least 256×256px, under 1 MB.</p>
                <div className={s.identityActions}>
                  <button type="button" className={button({ tone: "secondary" })}>
                    Upload
                  </button>
                  <button type="button" className={button({ tone: "ghost" })}>
                    Remove
                  </button>
                </div>
              </div>
            </div>

            <div className={s.formGrid}>
              <div className={s.formRow}>
                <label htmlFor="org-name" className={s.label}>
                  Organisation name
                </label>
                <input id="org-name" defaultValue="Nimbus Systems, Inc." className={s.input} />
              </div>
              <div className={s.formRow}>
                <label htmlFor="org-slug" className={s.label}>
                  URL slug
                </label>
                <input id="org-slug" defaultValue="nimbus" className={s.input} />
                <span className={s.hint}>nimbus.app/nimbus</span>
              </div>
              <div className={s.formRow}>
                <label htmlFor="billing-email" className={s.label}>
                  Billing email
                </label>
                <input
                  id="billing-email"
                  type="email"
                  defaultValue="billing@nimbus"
                  aria-invalid="true"
                  className={cn(s.input, s.inputError)}
                />
                <span className={s.error}>Enter a complete email address.</span>
              </div>
              <div className={s.formRow}>
                <label htmlFor="region" className={s.label}>
                  Default region
                </label>
                <select id="region" defaultValue="us-east-1" className={cn(s.input, s.select)}>
                  <option value="us-east-1">us-east-1 · N. Virginia</option>
                  <option value="eu-west-2">eu-west-2 · London</option>
                  <option value="ap-south-1">ap-south-1 · Mumbai</option>
                </select>
              </div>
              <div className={cn(s.formRow, s.formRowFull)}>
                <label htmlFor="description" className={s.label}>
                  Description
                </label>
                <textarea
                  id="description"
                  defaultValue="Deployment and observability platform for multi-region teams."
                  className={cn(s.input, s.textarea)}
                />
                <span className={s.hint}>
                  Shown on your public status page. Markdown supported.
                </span>
              </div>
            </div>
          </section>

          <section id="notifications" className={cn(card, cardPad)}>
            <h2 className={sectionTitle}>Notifications</h2>
            <p className={sectionNote}>
              Delivery channels are configured per workspace. These switches control which events
              are eligible to send.
            </p>
            {notifications.map((item, i) => (
              <div
                key={item.name}
                className={cn(
                  s.toggleRow,
                  i === 0 && s.toggleRowFirst,
                  i === notifications.length - 1 && s.toggleRowLast,
                )}
              >
                <div className={s.toggleCopy}>
                  <div className={s.toggleName}>{item.name}</div>
                  <div className={s.toggleDesc}>{item.desc}</div>
                </div>
                <label className={s.switch}>
                  <input
                    type="checkbox"
                    checked={toggles[i]}
                    aria-label={item.name}
                    onChange={() => setToggles((prev) => prev.map((v, j) => (i === j ? !v : v)))}
                    className={s.switchInput}
                  />
                  {/* Driven by a sibling selector, not React state. */}
                  <span className={s.switchTrack} />
                </label>
              </div>
            ))}
          </section>

          <section id="security" className={cn(card, cardPad)}>
            <h2 className={sectionTitle}>Security</h2>
            <p className={sectionNote}>
              Session lifetime for every member of the organisation.
            </p>
            <div className={s.radioCards}>
              {sessionPolicies.map((option) => (
                /* Selected state comes from :has(), so no state plumbing. */
                <label key={option.id} className={s.radioCard}>
                  <input
                    type="radio"
                    name="session-policy"
                    value={option.id}
                    checked={policy === option.id}
                    onChange={() => setPolicy(option.id)}
                    className={s.radioInput}
                  />
                  <span>
                    <span className={s.radioName}>{option.name}</span>
                    <span className={s.radioDesc}>{option.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section id="danger" className={cn(card, cardPad)}>
            <h2 className={sectionTitle}>Danger zone</h2>
            <p className={sectionNote}>These actions are irreversible.</p>
            <div className={s.dangerZone}>
              <h3 className={s.dangerTitle}>Delete organisation</h3>
              <p className={s.dangerNote}>
                Permanently removes all 34 workspaces, deploy history and audit logs. Billing is
                settled at the end of the current period.
              </p>
              <button type="button" className={button({ tone: "danger" })}>
                Delete organisation
              </button>
            </div>
          </section>

          <div className={s.saveBar}>
            <span>1 unsaved change · billing email is invalid</span>
            <div className={pageActions}>
              <button type="button" className={button({ tone: "ghost" })}>
                Discard
              </button>
              <button type="button" className={button({ tone: "primary" })}>
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
  settingsGrid:
    "grid grid-cols-[190px_minmax(0,1fr)] gap-28 items-start max-stack:grid-cols-1 max-stack:gap-18",
  sideNav: "sticky top-84 max-stack:static",

  identity: "flex items-center gap-14 pb-16 mb-16 border-b border-border",
  identityActions: "flex gap-8 mt-8",

  formGrid: "grid grid-cols-2 gap-14 max-form:grid-cols-1",
  formRow: "flex flex-col gap-5",
  formRowFull: "col-span-full",
  label: "text-12-5 font-semibold text-text cursor-pointer",
  input:
    "w-full py-8 px-11 bg-surface border border-border-strong rounded-6 text-13-5 text-text shadow-none outline-none transition focus:border-accent focus:shadow-ring placeholder:text-faint placeholder:opacity-100",
  inputError: "border-danger shadow-none focus:border-danger focus:shadow-ring-danger",
  select: "appearance-none pr-24",
  textarea: "min-h-80 resize-y",
  hint: "text-12 text-faint",
  error: "text-12 text-danger font-medium",

  toggleRow: "flex items-center justify-between gap-18 py-13 border-b border-border",
  toggleRowFirst: "pt-0",
  toggleRowLast: "border-b-0 pb-0",
  toggleCopy: "min-w-0",
  toggleName: "text-13-5 font-550",
  toggleDesc: "text-12-5 text-muted mt-2",

  switch: "relative shrink-0 w-38 h-22 cursor-pointer",
  switchInput: "absolute opacity-0 w-full h-full m-0 p-0 cursor-pointer",
  // The knob and the checked state live in settings.css — a utility can only
  // style its own element, so the preceding-sibling rule is a selector there
  // and `switch-track` is its anchor.
  switchTrack:
    "block w-full h-full rounded-pill bg-border-strong pointer-events-none transition duration-180 switch-track",

  radioCards: "grid gap-10",
  radioCard:
    "flex items-start gap-11 p-13 border border-border-strong rounded-10 cursor-pointer transition hover:border-accent radio-card",
  radioInput: "mt-2 accent-accent shrink-0 cursor-pointer",
  radioName: "block text-13-5 font-semibold",
  radioDesc: "block text-12-5 text-muted mt-2",

  dangerZone: "p-16 border border-danger-border rounded-10 bg-danger-soft",
  dangerTitle: "text-14 font-semibold text-danger mb-4",
  dangerNote: "text-12-5 text-muted mb-12 max-w-[56ch]",

  saveBar:
    "sticky bottom-0 flex items-center justify-between gap-14 flex-wrap py-12 px-16 bg-surface-glass-strong backdrop-blur-[10px] border border-border rounded-10 shadow-md text-12-5 text-muted",
};
