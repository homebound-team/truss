import { Css } from "~/Css";
import "./docs.css";
import { docsNav, toc } from "../data";
import { ChevronIcon } from "../icons";

const snippet = `# authenticate once per machine
npx nimbus login --sso

# link the working directory to a project
npx nimbus link --project checkout-v3

# build locally with the production toolchain
npx nimbus build --target=edge`;

export function meta() {
  return [{ title: "Your first deploy · Nimbus Docs" }];
}

export default function Docs() {
  return (
    <div css={s.docsGrid}>
      <nav aria-label="Documentation" css={s.docsNav}>
        {docsNav.map((group) => (
          <div key={group.section}>
            <div css={s.sectionLabel}>{group.section}</div>
            <ul>
              {group.items.map((item) => (
                <li key={item.label}>
                  <a
                    href="/docs"
                    aria-current={item.active ? "page" : undefined}
                    css={{ ...s.navItem, ...(item.active ? s.navItemOn : undefined) }}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* One `prose` class styles every descendant. The selectors live in
          docs.css.ts, so the article's own markup carries no classes at all. */}
      <article css={s.prose}>
        <div css={s.crumbs}>
          <span>Docs</span>
          <ChevronIcon />
          <span>Getting started</span>
          <ChevronIcon />
          <span>Your first deploy</span>
        </div>

        <h1>Your first deploy</h1>
        <p>
          This guide takes a repository from zero to a production URL in about five minutes. You
          will need an organisation with at least one seat and local access to the repository you
          want to deploy.
        </p>

        <h2>Before you begin</h2>
        <p>
          Nimbus builds run in ephemeral containers that mirror your production runtime. Make sure
          your project builds cleanly with <code>npm ci &amp;&amp; npm run build</code> before you
          start — the platform will not install undeclared system packages for you.
        </p>
        <ul>
          <li>Node.js 20 or newer, or a container image you control.</li>
          <li>A lockfile committed to the repository.</li>
          <li>
            Owner or admin role in the target workspace. See <a href="/settings">Settings</a>.
          </li>
        </ul>

        <div css={{ ...s.callout, ...s.calloutInfo }}>
          <span aria-hidden="true" css={{ ...s.calloutIcon, ...s.calloutIconInfo }}>
            ◈
          </span>
          <div>
            <div css={s.calloutTitle}>Trial workspaces</div>
            <p css={s.calloutText}>
              Deploys from a trial workspace are capped at 2 concurrent builds and are torn down
              after 14 days of inactivity.
            </p>
          </div>
        </div>

        <h2>Authenticate the CLI</h2>
        <p>
          The CLI stores a scoped refresh token in your system keychain. Tokens are bound to a
          single organisation and can be revoked from the security settings page at any time.
        </p>

        <div css={s.codeBlock}>
          <div css={s.codeHead}>
            <span>terminal</span>
            <span>bash</span>
          </div>
          <pre css={s.pre}>
            <code>{snippet}</code>
          </pre>
        </div>

        <h2>Link a repository</h2>
        <p>
          Linking writes a <code>nimbus.json</code> file to the repository root. Commit it — the
          build pipeline reads the project ID from this file rather than from CLI state, so CI runs
          and local runs resolve to the same project.
        </p>

        <h3>Choosing a region</h3>
        <p>
          Pick the region closest to your primary datastore, not your users. Edge routing already
          terminates requests near the user; what matters for cold-start latency is the round trip
          from the build region to your database.
        </p>

        <table>
          <thead>
            <tr>
              <th scope="col">Region</th>
              <th scope="col">Location</th>
              <th scope="col">Cold start</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["us-east-1", "N. Virginia", "~120 ms"],
              ["eu-west-2", "London", "~140 ms"],
              ["ap-south-1", "Mumbai", "~180 ms"],
            ].map(([region, location, cold]) => (
              <tr key={region}>
                <td>{region}</td>
                <td>{location}</td>
                <td>{cold}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div css={{ ...s.callout, ...s.calloutWarn }}>
          <span aria-hidden="true" css={{ ...s.calloutIcon, ...s.calloutIconWarn }}>
            ▲
          </span>
          <div>
            <div css={s.calloutTitle}>Region changes rebuild everything</div>
            <p css={s.calloutText}>
              Moving a linked project to a new region invalidates the build cache and re-issues TLS
              certificates. Expect the first deploy after a move to take 3–4× longer.
            </p>
          </div>
        </div>

        <h2>Configure the build</h2>
        <p>
          Most projects need no configuration. If autodetection picks the wrong framework, set it
          explicitly and Nimbus will skip detection entirely.
        </p>
        <ol>
          <li>
            Open <strong>Project → Build</strong> in the console.
          </li>
          <li>Set the framework preset, or choose “Other” to supply raw commands.</li>
          <li>Add environment variables scoped to preview, staging or production.</li>
          <li>Save. The next push triggers a build with the new settings.</li>
        </ol>

        <h2>Promote to production</h2>
        <p>
          Every push produces an immutable deployment with its own URL. Promotion is a pointer swap
          — it never rebuilds — so rolling back is instantaneous and always safe.
        </p>
        <blockquote>
          Promotion changes which deployment the production domain resolves to. It does not change
          the deployment itself.
        </blockquote>

        <div css={s.docsFoot}>
          <a href="/docs" css={s.footLink}>
            <div css={s.footDir}>Previous</div>
            <div css={s.footLabel}>Installation</div>
          </a>
          <a href="/docs" css={{ ...s.footLink, ...s.footLinkNext }}>
            <div css={s.footDir}>Next</div>
            <div css={s.footLabel}>CLI reference</div>
          </a>
        </div>
      </article>

      <aside aria-label="On this page" css={s.docsToc}>
        <div css={s.sectionLabel}>On this page</div>
        <ul>
          {toc.map((item) => (
            <li key={item.label}>
              <a href="/docs" css={{ ...s.tocLink, ...(item.depth > 0 ? s.tocDeep : undefined) }}>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

const s = {
  docsGrid: Css.dg
    .gtc("200px minmax(0, 1fr) 180px")
    .gapPx(34)
    .ais.ifWideAndDown.gtc("190px minmax(0, 1fr)")
    .ifStackAndDown.gtc("minmax(0, 1fr)")
    .gapPx(20).$,
  docsNav: Css.sticky.topPx(84).df.fdc.gapPx(18).ifStackAndDown.static.$,
  sectionLabel: Css.f11.fw(650).ttu.ls("0.06em").faint.mbPx(6).$,
  navItem: Css.db
    .pyPx(5)
    .pxPx(10)
    .add("borderLeftWidth", "2px")
    .add("borderLeftStyle", "solid")
    .bcTransparent.f13.muted.transition
    .onHover.text.$,
  navItemOn: Css.bcAccent.accent.fw6.onHover.accent.$,
  docsToc: Css.sticky.topPx(84).db.ifWideAndDown.dn.$,
  tocLink: Css.db.pyPx(4).f12_5.muted.transition.onHover.accent.$,
  tocDeep: Css.plPx(12).$,

  crumbs: Css.df.aic.gapPx(7).mbPx(12).f12_5.faint.$,

  prose: Css.maxw("72ch").className("prose").$,

  callout: Css.df.gapPx(11).pyPx(13).pxPx(15).mbPx(16).br10.ba.f13_5.lh(1.6).$,
  calloutInfo: Css.bgAccentSoft.bcAccentBorder.$,
  calloutWarn: Css.bgWarningSoft.bcWarningBorder.$,
  calloutIcon: Css.fs0.f14.lh(1.45).$,
  calloutIconInfo: Css.accent.$,
  calloutIconWarn: Css.warning.$,
  calloutTitle: Css.fw(650).mbPx(2).$,
  calloutText: Css.f13_5.lh(1.6).$,

  codeBlock: Css.mbPx(16).bgSurface2.ba.bcBorder.br10.oh.$,
  codeHead: Css.df.aic.jcsb.pyPx(8).pxPx(13).bb.bcBorder.f11_5.fontMono.faint.$,
  pre: Css.pPx(13).f12_5.fontMono.lh(1.62).oxa.wsp.$,

  docsFoot: Css.df.jcsb.gapPx(14).mtPx(34).ptPx(18).bt.bcBorder.$,
  footLink: Css.db
    .pyPx(11)
    .pxPx(14)
    .ba.bcBorder.br10.mwPx(170)
    .inherit.tdn.transition
    .onHover.bcAccent.$,
  footLinkNext: Css.tar.$,
  footDir: Css.f11_5.faint.mbPx(2).$,
  footLabel: Css.f13_5.fw6.$,
};
