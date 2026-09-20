import { useState } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import { Css, type Properties } from "~/Css";
import "./reset.css";
import "./theme.css";
import "virtual:truss.css";
import { footerColumns, navLinks } from "./data";
import {
  BellIcon,
  LogoMark,
  MenuIcon,
  MonitorIcon,
  MoonIcon,
  SearchIcon,
  SunIcon,
} from "./icons";
import { avatar, iconButton, navLink } from "./ui";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

type Theme = "system" | "light" | "dark";
const nextTheme: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const themeIcon: Record<Theme, React.ReactNode> = {
  system: <MonitorIcon />,
  light: <SunIcon />,
  dark: <MoonIcon />,
};

// The palette is declared as light-dark() pairs in theme.css.ts, so an
// explicit theme override is just `color-scheme` on a subtree rather than a
// second copy of the palette.
const schemes = {
  system: Css.add("colorScheme", "light dark").$,
  light: Css.add("colorScheme", "light").$,
  dark: Css.add("colorScheme", "dark").$,
};

export function Layout({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <html lang="en" css={schemes[theme]}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <div css={s.shell}>
          <header css={s.nav}>
            <div css={s.navInner}>
              <a href="/" css={s.brand}>
                <span css={s.brandMark}>
                  <LogoMark />
                </span>
                Nimbus
              </a>

              <nav aria-label="Main">
                <ul css={{ ...s.navLinks, ...(menuOpen ? s.navLinksOpen : undefined) }}>
                  {navLinks.map((link) => (
                    <li key={link.to}>
                      <NavLink
                        to={link.to}
                        end={link.to === "/"}
                        className={(state) => className(navLink({ active: state.isActive }))}
                      >
                        {link.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>

              <span css={s.navSpacer} />

              <div css={s.navSearch}>
                <span css={s.navSearchIcon}>
                  <SearchIcon />
                </span>
                <input
                  type="search"
                  placeholder="Search projects…"
                  aria-label="Search projects"
                  css={s.navSearchInput}
                />
              </div>

              <button
                type="button"
                aria-label={`Theme: ${theme}`}
                onClick={() => setTheme(nextTheme[theme])}
                css={iconButton}
              >
                {themeIcon[theme]}
              </button>

              <button type="button" aria-label="Notifications" css={iconButton}>
                <BellIcon />
              </button>

              <button
                type="button"
                aria-label="Toggle navigation"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
                css={{ ...iconButton, ...s.navToggle }}
              >
                <MenuIcon />
              </button>

              <span aria-hidden="true" css={avatar()}>
                AO
              </span>
            </div>
          </header>

          <main css={s.main}>{children}</main>

          <footer css={s.footer}>
            <div css={s.footerInner}>
              <div css={s.footerCols}>
                <div>
                  <span css={s.brand}>
                    <span css={s.brandMark}>
                      <LogoMark />
                    </span>
                    Nimbus
                  </span>
                  <p css={s.footerBlurb}>
                    Ship, observe and roll back multi-region deployments from one console.
                  </p>
                </div>
                {footerColumns.map((col) => (
                  <div key={col.title}>
                    <h3 css={s.footerColTitle}>{col.title}</h3>
                    <ul css={s.footerColList}>
                      {col.links.map((label) => (
                        <li key={label}>
                          <a href="/" css={s.footerColLink}>
                            {label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div css={s.footerBar}>
                <span>© 2026 Nimbus Systems, Inc.</span>
                <span>Built with Truss</span>
              </div>
            </div>
          </footer>
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <div css={s.errorPage}>
      <h1 css={s.errorTitle}>{message}</h1>
      <p css={s.errorSub}>{details}</p>
      {stack && (
        <pre css={s.errorPre}>
          <code>{stack}</code>
        </pre>
      )}
    </div>
  );
}

const s = {
  shell: Css.df.fdc.mvh100.bgPage.text.$,
  nav: Css.sticky.top0
    .z(50)
    .hPx(60)
    .bgSurfaceGlass.backdropFilter("saturate(180%) blur(12px)").bb.bcBorder.$,
  navInner: Css.df.aic.gapPx(20).h100.maxwPx(1240).mxa.pxPx(20).$,
  brand: Css.df.aic.gapPx(9).fs0.fw(650).f15.ls("-0.02em").$,
  brandMark: Css.dg.pic.sqPx(26).br7.brandGradient.white.$,
  navLinks: Css.df.aic.fdr
    .gapPx(2)
    .static.top("auto")
    .left("auto")
    .right("auto")
    .pPx(0)
    .bgTransparent.add("borderBottomWidth", "0")
    .add("borderBottomStyle", "solid")
    .bcBorder.shadowNone.ifTabletAndDown.dn.aiStretch.fdc
    .gapPx(0)
    .absolute.topPx(60)
    .leftPx(0)
    .rightPx(0)
    .pPx(8)
    .bgSurface.add("borderBottomWidth", "1px").shadowMd.$,
  navLinksOpen: Css.df.$,
  navSpacer: Css.fg1.$,
  navSearch: Css.relative.wPx(200).db.ifTabletAndDown.dn.$,
  navSearchInput: Css.w100
    .pyPx(7)
    .prPx(10)
    .plPx(30)
    .f13.bgSurface2.ba.bcBorder.br6.text.ocAccent.element("::placeholder").faint.o100.$,
  navSearchIcon: Css.absolute
    .leftPx(9)
    .top("50%")
    .transform("translateY(-50%)")
    .faint.pen
    .lh(0).$,
  navToggle: Css.dn.ifTabletAndDown.dg.$,
  main: Css.fg1.w100.maxwPx(1240).mxa.ptPx(28).pxPx(20).pbPx(64).$,
  footer: Css.bt.bcBorder.bgSurface.$,
  footerInner: Css.maxwPx(1240).mxa.ptPx(34).pxPx(20).pbPx(24).$,
  footerCols: Css.dg
    .gtc("1.4fr repeat(4, 1fr)")
    .gapPx(26)
    .pbPx(24)
    .ifNarrowAndDown.gtc("repeat(2, minmax(0, 1fr))")
    .gapPx(22)
    .ifTiny.gtc("minmax(0, 1fr)").$,
  footerBlurb: Css.f12_5.lh(1.55).muted.mtPx(9).maxw("30ch").$,
  footerColTitle: Css.f12.fw(650).mbPx(9).$,
  footerColList: Css.df.fdc.gapPx(6).$,
  footerColLink: Css.f12_5.muted.transition.onHover.accent.$,
  footerBar: Css.df.aic.jcsb.gapPx(14).fww.ptPx(18).bt.bcBorder.f12.faint.$,
  errorPage: Css.maxwPx(1240).mxa.pyPx(60).pxPx(20).$,
  errorTitle: Css.f25.fw6.ls("-0.022em").$,
  errorSub: Css.mtPx(5).f14.muted.$,
  errorPre: Css.w100.pPx(16).mtPx(16).oxa.bgSurface2.br10.f12.$,
};

/** The class string a Truss hash resolves to, for props that take a string rather than `css`. */
function className(styles: Properties): string {
  return Css.props(styles).className as string;
}
