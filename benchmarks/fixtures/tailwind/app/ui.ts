import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./cn";

/**
 * Shared UI primitives. Anything with discrete states is a `cva` recipe: the
 * variant keys are inferred as props, and `cn` resolves the base-versus-variant
 * conflicts that cva itself only concatenates.
 */

const buttonVariants = cva(
  "inline-flex items-center gap-6 py-8 px-14 border border-transparent rounded-6 text-13-5 font-550 leading-[1.2] whitespace-nowrap cursor-pointer outline-accent transition",
  {
    variants: {
      tone: {
        primary: "bg-accent text-accent-contrast hover:bg-accent-hover",
        secondary: "bg-surface border-border-strong text-text hover:bg-surface2",
        ghost: "bg-transparent text-muted hover:bg-surface2 hover:text-text",
        danger: "bg-danger text-white hover:bg-danger-hover",
      },
      block: { true: "w-full justify-center" },
    },
    defaultVariants: { tone: "secondary" },
  },
);

/** A button, secondary by default. */
export function button(variants: VariantProps<typeof buttonVariants> = {}): string {
  return cn(buttonVariants(variants));
}

const badgeVariants = cva(
  "inline-flex items-center gap-5 py-2 px-8 rounded-pill text-11-5 font-semibold tracking-[0.005em] whitespace-nowrap",
  {
    variants: {
      status: {
        live: "bg-success-soft text-success",
        staging: "bg-accent-soft text-accent",
        paused: "bg-warning-soft text-warning",
        archived: "bg-surface3 text-muted",
      },
    },
  },
);

/** A status pill. */
export function badge(variants: VariantProps<typeof badgeVariants>): string {
  return cn(badgeVariants(variants));
}

const avatarVariants = cva(
  "grid place-items-center shrink-0 rounded-pill bg-accent-soft text-accent font-650 tracking-[0.02em]",
  {
    variants: {
      size: {
        sm: "size-24 text-10",
        md: "size-30 text-11",
        lg: "size-56 text-18 brand-gradient text-white",
      },
    },
    defaultVariants: { size: "md" },
  },
);

/** An initials avatar, medium by default. */
export function avatar(variants: VariantProps<typeof avatarVariants> = {}): string {
  return cn(avatarVariants(variants));
}

const segButtonVariants = cva(
  "py-5 px-11 rounded-4 text-12-5 font-550 cursor-pointer outline-accent transition",
  {
    variants: {
      active: {
        true: "bg-surface text-text shadow-sm",
        false: "bg-transparent text-muted hover:text-text",
      },
    },
    defaultVariants: { active: false },
  },
);

/** One option of a segmented control. */
export function segButton(variants: VariantProps<typeof segButtonVariants> = {}): string {
  return cn(segButtonVariants(variants));
}

const pageBtnVariants = cva(
  "min-w-28 h-28 px-8 border border-border rounded-6 text-12-5 cursor-pointer outline-accent",
  {
    variants: {
      current: {
        true: "bg-accent border-accent text-accent-contrast font-semibold",
        false: "bg-transparent text-muted hover:bg-surface2 hover:text-text",
      },
    },
    defaultVariants: { current: false },
  },
);

/** A pagination button. */
export function pageBtn(variants: VariantProps<typeof pageBtnVariants> = {}): string {
  return cn(pageBtnVariants(variants));
}

const navLinkVariants = cva("block py-7 px-11 rounded-6 text-14 transition", {
  variants: {
    active: {
      true: "bg-accent-soft text-accent font-semibold",
      false: "bg-transparent text-muted font-medium hover:bg-surface2 hover:text-text",
    },
  },
  defaultVariants: { active: false },
});

/** A top navigation link. */
export function navLink(variants: VariantProps<typeof navLinkVariants> = {}): string {
  return cn(navLinkVariants(variants));
}

const sideLinkVariants = cva("block py-7 px-10 rounded-6 text-13-5 transition", {
  variants: {
    active: {
      true: "bg-accent-soft text-accent font-semibold",
      false: "bg-transparent text-muted hover:bg-surface2 hover:text-text",
    },
  },
  defaultVariants: { active: false },
});

/** A section navigation link. */
export function sideLink(variants: VariantProps<typeof sideLinkVariants> = {}): string {
  return cn(sideLinkVariants(variants));
}

const deltaVariants = cva("inline-flex items-center gap-3 text-12 font-semibold", {
  variants: {
    up: { true: "text-success", false: "text-danger" },
  },
});

/** A signed change, coloured by direction. */
export function delta(variants: VariantProps<typeof deltaVariants>): string {
  return cn(deltaVariants(variants));
}

/* --- static primitives ---------------------------------------------------- */

export const pageHead = "flex items-end justify-between gap-20 flex-wrap mb-24";

export const pageTitle = "text-25 font-semibold tracking-[-0.022em]";
export const pageSub = "mt-5 text-14 text-muted max-w-[62ch]";
export const pageActions = "flex gap-8 shrink-0";

export const card = "bg-surface border border-border rounded-14 shadow-sm";

export const cardPad = "p-18";

export const cardHead =
  "flex items-center justify-between gap-14 py-15 px-18 border-b border-border";

export const cardTitle = "text-14-5 font-semibold";
export const cardNote = "text-12-5 text-muted mt-2";

export const badgeDot = "size-5 rounded-pill bg-current";

export const segmented = "inline-flex p-2 bg-surface2 border border-border rounded-6";

export const tag =
  "inline-block py-2 px-7 rounded-6 bg-surface2 border border-border text-11 font-550 text-muted";

export const field =
  "py-7 px-11 bg-surface border border-border-strong rounded-6 text-13-5 text-text outline-accent placeholder:text-faint placeholder:opacity-100";

export const fieldGrow = "grow min-w-180";

export const sectionTitle = "text-16 font-semibold mb-3";
export const sectionNote = "text-13 text-muted mb-16 max-w-[60ch]";
export const stack = "flex flex-col gap-18";

export const iconButton =
  "grid place-items-center size-32 p-0 shrink-0 bg-transparent border border-border rounded-6 text-muted cursor-pointer outline-accent transition hover:bg-surface2 hover:text-text";
