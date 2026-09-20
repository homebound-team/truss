import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * `clsx` + `tailwind-merge`, the standard pair for composing Tailwind class
 * strings: clsx flattens conditionals, tailwind-merge keeps the last class in
 * each conflicting group so a variant can override its base.
 *
 * tailwind-merge carries its own copy of the default theme and cannot read
 * app.css, so every token this design adds has to be declared again here. It is
 * not cosmetic: `text-13-5` and `text-muted` set different properties, and an
 * unregistered `text-13-5` is parsed as a text colour, so tailwind-merge would
 * silently drop one of the two whenever a variant sets a size and the base sets
 * a colour. The lists below must stay in step with `@theme` in app/app.css.
 */
const colors = [
  "page",
  "surface",
  "surface2",
  "surface3",
  "border",
  "border-strong",
  "text",
  "muted",
  "faint",
  "accent",
  "accent-soft",
  "accent-contrast",
  "accent-hover",
  "accent-border",
  "success",
  "success-soft",
  "warning",
  "warning-soft",
  "warning-border",
  "danger",
  "danger-soft",
  "danger-hover",
  "danger-border",
  "surface-glass",
  "surface-glass-strong",
  "bar-secondary",
];

const fontSizes = [
  "10",
  "11",
  "11-5",
  "12",
  "12-5",
  "13",
  "13-5",
  "14",
  "14-5",
  "15",
  "15-5",
  "16",
  "17",
  "18",
  "19",
  "23",
  "25",
  "28",
  "34",
];

export const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: colors,
      text: fontSizes,
      "font-weight": ["550", "650", "680"],
      radius: ["2", "4", "6", "7", "10", "14", "pill"],
      shadow: ["ring", "ring-danger"],
    },
    classGroups: {
      // The two `@utility` rules in app.css both set `background-image`, so
      // they conflict with each other and with any background-image utility.
      "bg-image": ["brand-gradient", "shimmer-gradient"],
    },
  },
});

/** Compose class names, resolving Tailwind conflicts left to right. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
