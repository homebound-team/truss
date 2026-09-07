/**
 * The relationship kinds accepted by `when(marker, relationship, pseudo)`.
 *
 * Each kind owns its class-name fragment, its StyleX-style priority bump, and the
 * selector shape that ties the marker element to the styled target element.
 */
export type WhenRelationship = "ancestor" | "descendant" | "anySibling" | "siblingBefore" | "siblingAfter";

export interface WhenRelationshipSpec {
  /** Class-name fragment, i.e. `"anc"` in `wh_anc_h_blue`. */
  short: string;
  /** Base priority added to rules that use this relationship, matching StyleX's relational selector system. */
  priority: number;
  /**
   * Build the full rule selector.
   *
   * `marker` is the marker selector, i.e. `._row_mrk:hover`; `target` builds the styled element's
   * selector and accepts an extra pseudo-class to splice in before any pseudo-element.
   */
  selector(marker: string, target: (extraPseudoClass?: string) => string): string;
}

/** Keyed in the order the error message for an unknown relationship lists them. */
export const WHEN_RELATIONSHIPS: Readonly<Record<WhenRelationship, WhenRelationshipSpec>> = {
  ancestor: {
    short: "anc",
    priority: 10,
    /** I.e. `._mrk:hover .wh_anc_h_blue`. */
    selector(marker, target) {
      return `${marker} ${target()}`;
    },
  },
  descendant: {
    short: "desc",
    priority: 15,
    /** I.e. `.wh_desc_h_blue:has(._mrk:hover)`. */
    selector(marker, target) {
      return target(`:has(${marker})`);
    },
  },
  anySibling: {
    short: "anyS",
    priority: 20,
    /** I.e. `.wh_anyS_h_blue:has(~ ._mrk:hover), ._mrk:hover ~ .wh_anyS_h_blue`. */
    selector(marker, target) {
      return `${target(`:has(~ ${marker})`)}, ${marker} ~ ${target()}`;
    },
  },
  siblingBefore: {
    short: "sibB",
    priority: 30,
    /** I.e. `._mrk:hover ~ .wh_sibB_h_blue`. */
    selector(marker, target) {
      return `${marker} ~ ${target()}`;
    },
  },
  siblingAfter: {
    short: "sibA",
    priority: 40,
    /** I.e. `.wh_sibA_h_blue:has(~ ._mrk:hover)`. */
    selector(marker, target) {
      return target(`:has(~ ${marker})`);
    },
  },
};

/** True when `value` names one of the supported `when()` relationships. */
export function isWhenRelationship(value: string): value is WhenRelationship {
  return Object.hasOwn(WHEN_RELATIONSHIPS, value);
}
