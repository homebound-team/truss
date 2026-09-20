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
import "./app.css";
import { cn } from "./cn";
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

// The palette is declared as light-dark() pairs in app.css, so an explicit
// theme override is just `color-scheme` on a subtree rather than a second copy
// of the palette.
const schemes: Record<Theme, string> = {
  system: "scheme-light-dark",
  light: "scheme-light",
  dark: "scheme-dark",
};

export function Layout({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <html lang="en" className={schemes[theme]}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <div className={s.shell}>
          <header className={s.nav}>
            <div className={s.navInner}>
              <a href="/" className={s.brand}>
                <span className={s.brandMark}>
                  <LogoMark />
                </span>
                Nimbus
              </a>

              <nav aria-label="Main">
                <ul className={cn(s.navLinks, menuOpen && s.navLinksOpen)}>
                  {navLinks.map((link) => (
                    <li key={link.to}>
                      <NavLink
                        to={link.to}
                        end={link.to === "/"}
                        className={(state) => navLink({ active: state.isActive })}
                      >
                        {link.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>

              <span className={s.navSpacer} />

              <div className={s.navSearch}>
                <span className={s.navSearchIcon}>
                  <SearchIcon />
                </span>
                <input
                  type="search"
                  placeholder="Search projects…"
                  aria-label="Search projects"
                  className={s.navSearchInput}
                />
              </div>

              <button
                type="button"
                aria-label={`Theme: ${theme}`}
                onClick={() => setTheme(nextTheme[theme])}
                className={iconButton}
              >
                {themeIcon[theme]}
              </button>

              <button type="button" aria-label="Notifications" className={iconButton}>
                <BellIcon />
              </button>

              <button
                type="button"
                aria-label="Toggle navigation"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
                className={cn(iconButton, s.navToggle)}
              >
                <MenuIcon />
              </button>

              <span aria-hidden="true" className={avatar()}>
                AO
              </span>
            </div>
          </header>

          <main className={s.main}>{children}</main>

          <footer className={s.footer}>
            <div className={s.footerInner}>
              <div className={s.footerCols}>
                <div>
                  <span className={s.brand}>
                    <span className={s.brandMark}>
                      <LogoMark />
                    </span>
                    Nimbus
                  </span>
                  <p className={s.footerBlurb}>
                    Ship, observe and roll back multi-region deployments from one console.
                  </p>
                </div>
                {footerColumns.map((col) => (
                  <div key={col.title}>
                    <h3 className={s.footerColTitle}>{col.title}</h3>
                    <ul className={s.footerColList}>
                      {col.links.map((label) => (
                        <li key={label}>
                          <a href="/" className={s.footerColLink}>
                            {label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className={s.footerBar}>
                <span>© 2026 Nimbus Systems, Inc.</span>
                <span>Built with Tailwind</span>
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
    <div className={s.errorPage}>
      <h1 className={s.errorTitle}>{message}</h1>
      <p className={s.errorSub}>{details}</p>
      {stack && (
        <pre className={s.errorPre}>
          <code>{stack}</code>
        </pre>
      )}
    </div>
  );
}

const s = {
  shell: "flex flex-col min-h-screen bg-page text-text",
  // The bar's backdrop is written as one arbitrary value rather than as a
  // saturate utility plus a blur utility. Tailwind composes those two into a
  // single fixed order that puts the blur first, and the design specifies them
  // the other way round.
  nav: "sticky top-0 z-50 h-60 bg-surface-glass backdrop-filter-[saturate(180%)_blur(12px)] border-b border-border",
  navInner: "flex items-center gap-20 h-full max-w-1240 mx-auto px-20",
  brand: "flex items-center gap-9 shrink-0 font-650 text-15 tracking-[-0.02em]",
  brandMark: "grid place-items-center size-26 rounded-7 brand-gradient text-white",
  // Only the mobile half of each pair is written: the desktop values the other
  // apps state explicitly (`static`, `top: auto`, `padding: 0`, transparent
  // background, no bottom border, no shadow) are already what preflight leaves
  // a `ul` at.
  navLinks:
    "flex items-center flex-row gap-2 max-tablet:hidden max-tablet:items-stretch max-tablet:flex-col max-tablet:gap-0 max-tablet:absolute max-tablet:top-60 max-tablet:left-0 max-tablet:right-0 max-tablet:p-8 max-tablet:bg-surface max-tablet:border-b max-tablet:border-border max-tablet:shadow-md",
  navLinksOpen: "flex",
  navSpacer: "grow",
  navSearch: "relative w-200 block max-tablet:hidden",
  navSearchInput:
    "w-full py-7 pr-10 pl-30 text-13 bg-surface2 border border-border rounded-6 text-text outline-accent placeholder:text-faint placeholder:opacity-100",
  navSearchIcon:
    "absolute left-9 top-1/2 -translate-y-1/2 text-faint pointer-events-none leading-[0]",
  navToggle: "hidden max-tablet:grid",
  main: "grow w-full max-w-1240 mx-auto pt-28 px-20 pb-64",
  footer: "border-t border-border bg-surface",
  footerInner: "max-w-1240 mx-auto pt-34 px-20 pb-24",
  footerCols:
    "grid grid-cols-[1.4fr_repeat(4,1fr)] gap-26 pb-24 max-narrow:grid-cols-[repeat(2,minmax(0,1fr))] max-narrow:gap-22 max-tiny:grid-cols-1",
  footerBlurb: "text-12-5 leading-[1.55] text-muted mt-9 max-w-[30ch]",
  footerColTitle: "text-12 font-650 mb-9",
  footerColList: "flex flex-col gap-6",
  footerColLink: "text-12-5 text-muted transition hover:text-accent",
  footerBar:
    "flex items-center justify-between gap-14 flex-wrap pt-18 border-t border-border text-12 text-faint",
  errorPage: "max-w-1240 mx-auto py-60 px-20",
  errorTitle: "text-25 font-semibold tracking-[-0.022em]",
  errorSub: "mt-5 text-14 text-muted",
  errorPre: "w-full p-16 mt-16 overflow-x-auto bg-surface2 rounded-10 text-12",
};
