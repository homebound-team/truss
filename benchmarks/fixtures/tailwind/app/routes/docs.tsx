import { cn } from "../cn";
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
    <div className={s.docsGrid}>
      <nav aria-label="Documentation" className={s.docsNav}>
        {docsNav.map((group) => (
          <div key={group.section}>
            <div className={s.sectionLabel}>{group.section}</div>
            <ul>
              {group.items.map((item) => (
                <li key={item.label}>
                  <a
                    href="/docs"
                    aria-current={item.active ? "page" : undefined}
                    className={cn(s.navItem, item.active && s.navItemOn)}
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
          docs.css, so the article's own markup carries no classes at all. */}
      <article className={s.prose}>
        <div className={s.crumbs}>
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

        <div className={cn(s.callout, s.calloutInfo)}>
          <span aria-hidden="true" className={cn(s.calloutIcon, s.calloutIconInfo)}>
            ◈
          </span>
          <div>
            <div className={s.calloutTitle}>Trial workspaces</div>
            <p className={s.calloutText}>
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

        <div className={s.codeBlock}>
          <div className={s.codeHead}>
            <span>terminal</span>
            <span>bash</span>
          </div>
          <pre className={s.pre}>
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

        <div className={cn(s.callout, s.calloutWarn)}>
          <span aria-hidden="true" className={cn(s.calloutIcon, s.calloutIconWarn)}>
            ▲
          </span>
          <div>
            <div className={s.calloutTitle}>Region changes rebuild everything</div>
            <p className={s.calloutText}>
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

        <div className={s.docsFoot}>
          <a href="/docs" className={s.footLink}>
            <div className={s.footDir}>Previous</div>
            <div className={s.footLabel}>Installation</div>
          </a>
          <a href="/docs" className={cn(s.footLink, s.footLinkNext)}>
            <div className={s.footDir}>Next</div>
            <div className={s.footLabel}>CLI reference</div>
          </a>
        </div>
      </article>

      <aside aria-label="On this page" className={s.docsToc}>
        <div className={s.sectionLabel}>On this page</div>
        <ul>
          {toc.map((item) => (
            <li key={item.label}>
              <a href="/docs" className={cn(s.tocLink, item.depth > 0 && s.tocDeep)}>
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
  docsGrid:
    "grid grid-cols-[200px_minmax(0,1fr)_180px] gap-34 items-start max-wide:grid-cols-[190px_minmax(0,1fr)] max-stack:grid-cols-1 max-stack:gap-20",
  docsNav: "sticky top-84 flex flex-col gap-18 max-stack:static",
  sectionLabel: "text-11 font-650 uppercase tracking-[0.06em] text-faint mb-6",
  navItem:
    "block py-5 px-10 border-l-2 border-transparent text-13 text-muted transition hover:text-text",
  navItemOn: "border-accent text-accent font-semibold hover:text-accent",
  docsToc: "sticky top-84 block max-wide:hidden",
  tocLink: "block py-4 text-12-5 text-muted transition hover:text-accent",
  tocDeep: "pl-12",

  crumbs: "flex items-center gap-7 mb-12 text-12-5 text-faint",

  prose: "max-w-[72ch] prose",

  callout: "flex gap-11 py-13 px-15 mb-16 rounded-10 border text-13-5 leading-[1.6]",
  calloutInfo: "bg-accent-soft border-accent-border",
  calloutWarn: "bg-warning-soft border-warning-border",
  calloutIcon: "shrink-0 text-14 leading-[1.45]",
  calloutIconInfo: "text-accent",
  calloutIconWarn: "text-warning",
  calloutTitle: "font-650 mb-2",
  calloutText: "text-13-5 leading-[1.6]",

  codeBlock: "mb-16 bg-surface2 border border-border rounded-10 overflow-hidden",
  codeHead:
    "flex items-center justify-between py-8 px-13 border-b border-border text-11-5 font-mono text-faint",
  pre: "p-13 text-12-5 font-mono leading-[1.62] overflow-x-auto whitespace-pre",

  docsFoot: "flex justify-between gap-14 mt-34 pt-18 border-t border-border",
  footLink:
    "block py-11 px-14 border border-border rounded-10 min-w-170 text-inherit no-underline transition hover:border-accent",
  footLinkNext: "text-right",
  footDir: "text-11-5 text-faint mb-2",
  footLabel: "text-13-5 font-semibold",
};
