import { Css } from "~/Css";

/**
 * The theme-aware tokens, declared once as `light-dark()` pairs. Values are
 * identical to the ones the Bamboo app declares in bamboo.config.ts. Truss's
 * palette (truss-config.ts) refers to these by `var()`, so `color-scheme` on
 * a subtree is the whole light/dark toggle.
 */
export const css = {
  ":root": Css.raw`
    --bg: light-dark(#f7f8fa, #14171f);
    --surface: light-dark(#ffffff, #1b1f2a);
    --surface2: light-dark(#f1f3f7, #232834);
    --surface3: light-dark(#e8ecf3, #2b3140);
    --border: light-dark(#e3e7ee, #2c3240);
    --border-strong: light-dark(#cdd4e0, #3d4557);
    --text: light-dark(#10131a, #e8ebf2);
    --muted: light-dark(#5d6675, #98a1b3);
    --faint: light-dark(#8b94a5, #7c8598);
    --accent: light-dark(#4f46e5, #818cf8);
    --accent-soft: light-dark(#eef0fe, #262a40);
    --accent-contrast: light-dark(#ffffff, #0b0d12);
    --success: light-dark(#0f7a52, #34d399);
    --success-soft: light-dark(#e3f5ec, #16302a);
    --warning: light-dark(#92500a, #fbbf24);
    --warning-soft: light-dark(#fdf0dc, #332711);
    --danger: light-dark(#c0271f, #f87171);
    --danger-soft: light-dark(#fdeceb, #341d1f);
    --shadow-sm: 0 1px 2px rgb(16 19 26 / 0.06), 0 1px 3px rgb(16 19 26 / 0.04);
    --shadow-md: 0 4px 12px rgb(16 19 26 / 0.08), 0 1px 3px rgb(16 19 26 / 0.04);
    --shadow-lg: 0 12px 32px rgb(16 19 26 / 0.12), 0 2px 8px rgb(16 19 26 / 0.06);
  `,
  // Shadows are not colours, so light-dark() cannot carry them. Like Bamboo's
  // `_osDark` shadow tokens, they follow the OS preference only.
  "@media (prefers-color-scheme: dark)": Css.raw`
    :root {
      --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.3);
      --shadow-md: 0 4px 12px rgb(0 0 0 / 0.36);
      --shadow-lg: 0 12px 32px rgb(0 0 0 / 0.44);
    }
  `,
};
