import { Css, type Properties } from "~/Css";

/**
 * Shared UI primitives. Truss has no recipe API, so anything with discrete
 * states is a function that picks a variant hash per call and spreads it over
 * the base. A Truss hash is keyed by CSS property, so the last value per
 * property wins and a variant overrides the base without a specificity fight.
 */

export type ButtonTone = "primary" | "secondary" | "ghost" | "danger";
export type BadgeStatus = "live" | "staging" | "paused" | "archived";
export type AvatarSize = "sm" | "md" | "lg";

const buttonBase = Css.dif.aic
  .gapPx(6)
  .pyPx(8)
  .pxPx(14)
  .ba.bcTransparent.br6.f13_5.fw(550)
  .lh(1.2)
  .wsnw.cursorPointer.ocAccent.transition.$;
const buttonTone: Record<ButtonTone, Properties> = {
  primary: Css.bgAccent.accentContrast.onHover.bgAccentHover.$,
  secondary: Css.bgSurface.bcBorderStrong.text.onHover.bgSurface2.$,
  ghost: Css.bgTransparent.muted.onHover.bgSurface2.text.$,
  danger: Css.bgDanger.white.onHover.bgDangerHover.$,
};
const buttonBlock = Css.w100.jcc.$;

/** A button, secondary by default. */
export function button(variants: { tone?: ButtonTone; block?: boolean } = {}): Properties {
  return {
    ...buttonBase,
    ...buttonTone[variants.tone ?? "secondary"],
    ...(variants.block ? buttonBlock : undefined),
  };
}

const badgeBase = Css.dif.aic.gapPx(5).pyPx(2).pxPx(8).brPill.f11_5.fw6.ls("0.005em").wsnw.$;
const badgeStatus: Record<BadgeStatus, Properties> = {
  live: Css.bgSuccessSoft.success.$,
  staging: Css.bgAccentSoft.accent.$,
  paused: Css.bgWarningSoft.warning.$,
  archived: Css.bgSurface3.muted.$,
};

/** A status pill. */
export function badge(variants: { status: BadgeStatus }): Properties {
  return { ...badgeBase, ...badgeStatus[variants.status] };
}

const avatarBase = Css.dg.pic.fs0.brPill.bgAccentSoft.accent.fw(650).ls("0.02em").$;
const avatarSize: Record<AvatarSize, Properties> = {
  sm: Css.sqPx(24).f10.$,
  md: Css.sqPx(30).f11.$,
  lg: Css.sqPx(56).f18.brandGradient.white.$,
};

/** An initials avatar, medium by default. */
export function avatar(variants: { size?: AvatarSize } = {}): Properties {
  return { ...avatarBase, ...avatarSize[variants.size ?? "md"] };
}

const segButtonBase = Css.pyPx(5)
  .pxPx(11)
  .br4.f12_5.fw(550)
  .cursorPointer.ocAccent.transition.$;
const segButtonOn = Css.bgSurface.text.shadowSm.$;
const segButtonOff = Css.bgTransparent.muted.onHover.text.$;

/** One option of a segmented control. */
export function segButton(variants: { active?: boolean } = {}): Properties {
  return { ...segButtonBase, ...(variants.active ? segButtonOn : segButtonOff) };
}

const pageBtnBase = Css.mwPx(28).hPx(28).pxPx(8).ba.bcBorder.br6.f12_5.cursorPointer.ocAccent.$;
const pageBtnOn = Css.bgAccent.bcAccent.accentContrast.fw6.$;
const pageBtnOff = Css.bgTransparent.muted.onHover.bgSurface2.text.$;

/** A pagination button. */
export function pageBtn(variants: { current?: boolean } = {}): Properties {
  return { ...pageBtnBase, ...(variants.current ? pageBtnOn : pageBtnOff) };
}

const navLinkBase = Css.db.pyPx(7).pxPx(11).br6.f14.transition.$;
const navLinkOn = Css.bgAccentSoft.accent.fw6.$;
const navLinkOff = Css.bgTransparent.muted.fw5.onHover.bgSurface2.text.$;

/** A top navigation link. */
export function navLink(variants: { active?: boolean } = {}): Properties {
  return { ...navLinkBase, ...(variants.active ? navLinkOn : navLinkOff) };
}

const sideLinkBase = Css.db.pyPx(7).pxPx(10).br6.f13_5.transition.$;
const sideLinkOn = Css.bgAccentSoft.accent.fw6.$;
const sideLinkOff = Css.bgTransparent.muted.onHover.bgSurface2.text.$;

/** A section navigation link. */
export function sideLink(variants: { active?: boolean } = {}): Properties {
  return { ...sideLinkBase, ...(variants.active ? sideLinkOn : sideLinkOff) };
}

const deltaBase = Css.dif.aic.gapPx(3).f12.fw6.$;
const deltaUp = Css.success.$;
const deltaDown = Css.danger.$;

/** A signed change, coloured by direction. */
export function delta(variants: { up: boolean }): Properties {
  return { ...deltaBase, ...(variants.up ? deltaUp : deltaDown) };
}

/* --- static primitives ---------------------------------------------------- */

export const pageHead = Css.df.aife.jcsb.gapPx(20).fww.mbPx(24).$;

export const pageTitle = Css.f25.fw6.ls("-0.022em").$;
export const pageSub = Css.mtPx(5).f14.muted.maxw("62ch").$;
export const pageActions = Css.df.gapPx(8).fs0.$;

export const card = Css.bgSurface.ba.bcBorder.br14.shadowSm.$;

export const cardPad = Css.pPx(18).$;

export const cardHead = Css.df.aic.jcsb.gapPx(14).pyPx(15).pxPx(18).bb.bcBorder.$;

export const cardTitle = Css.f14_5.fw6.$;
export const cardNote = Css.f12_5.muted.mtPx(2).$;

export const badgeDot = Css.sqPx(5).brPill.bgCurrent.$;

export const segmented = Css.dif.pPx(2).bgSurface2.ba.bcBorder.br6.$;

export const tag = Css.dib.pyPx(2).pxPx(7).br6.bgSurface2.ba.bcBorder.f11.fw(550).muted.$;

export const field = Css.pyPx(7).pxPx(11).bgSurface.ba.bcBorderStrong.br6.f13_5.text.ocAccent.element("::placeholder").faint.o100.$;

export const fieldGrow = Css.fg1.mwPx(180).$;

export const sectionTitle = Css.f16.fw6.mbPx(3).$;
export const sectionNote = Css.f13.muted.mbPx(16).maxw("60ch").$;
export const stack = Css.df.fdc.gapPx(18).$;

export const iconButton = Css.dg.pic
  .sqPx(32)
  .pPx(0)
  .fs0.bgTransparent.ba.bcBorder.br6.muted.cursorPointer.ocAccent.transition
  .onHover.bgSurface2.text.$;
