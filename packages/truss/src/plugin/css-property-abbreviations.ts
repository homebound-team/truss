/**
 * Static mapping of CSS property names (camelCase) to unique short abbreviations.
 *
 * Used by the Truss compiler to generate compact, deterministic class names
 * when no user-defined canonical abbreviation exists for a given property+value.
 *
 * Convention: first letter of each camelCase word, with conflict resolution
 * via extra characters where needed. I.e. `borderBottomWidth` → `bbw`,
 * `flexDirection` → `fxd`, `fontSize` → `fz`.
 *
 * User-defined abbreviations (from the longhand lookup) always take priority
 * over these — this mapping is only the fallback.
 */
export const cssPropertyAbbreviations: Record<string, string> = {
  // Alignment
  alignContent: "ac",
  alignItems: "ai",
  alignSelf: "als",

  // Animation
  animation: "anim",
  animationDelay: "animd",
  animationDirection: "animdr",
  animationDuration: "animdu",
  animationFillMode: "animfm",
  animationIterationCount: "animic",
  animationName: "animn",
  animationPlayState: "animps",
  animationTimingFunction: "animtf",

  // Appearance
  appearance: "app",

  // Aspect ratio
  aspectRatio: "ar",

  // Backdrop filter
  backdropFilter: "bdf",

  // Background
  background: "bg",
  backgroundAttachment: "bga",
  backgroundBlendMode: "bgbm",
  backgroundClip: "bgcl",
  backgroundColor: "bgc",
  backgroundImage: "bgi",
  backgroundOrigin: "bgo",
  backgroundPosition: "bgp",
  backgroundRepeat: "bgr",
  backgroundSize: "bgs",

  // Border – shorthand
  border: "bd",
  borderCollapse: "bdcl",
  borderColor: "bdc",
  borderImage: "bdi",
  borderRadius: "bra",
  borderSpacing: "bdsp",
  borderStyle: "bs",
  borderWidth: "bw",

  // Border – top
  borderTop: "bdt",
  borderTopColor: "btc",
  borderTopLeftRadius: "btlr",
  borderTopRightRadius: "btrr",
  borderTopStyle: "bts",
  borderTopWidth: "btw",

  // Border – right
  borderRight: "bdr",
  borderRightColor: "brc",
  borderRightStyle: "brs",
  borderRightWidth: "brw",

  // Border – bottom
  borderBottom: "bdb",
  borderBottomColor: "bbc",
  borderBottomLeftRadius: "bblr",
  borderBottomRightRadius: "bbrr",
  borderBottomStyle: "bbs",
  borderBottomWidth: "bbw",

  // Border – left
  borderLeft: "bdl",
  borderLeftColor: "blc",
  borderLeftStyle: "bls",
  borderLeftWidth: "blw",

  // Box
  boxDecorationBreak: "bxdb",
  boxShadow: "bxs",
  boxSizing: "bxz",

  // Break
  breakAfter: "bka",
  breakBefore: "bkb",
  breakInside: "bki",

  // Caret / caption
  captionSide: "cps",
  caretColor: "cac",

  // Clear / clip
  clear: "clr",
  clip: "cli",
  clipPath: "clp",

  // Color
  color: "c",
  colorScheme: "cs",

  // Columns
  columnCount: "cc",
  columnFill: "cf",
  columnGap: "cg",
  columnRule: "cr",
  columnRuleColor: "crc",
  columnRuleStyle: "crs",
  columnRuleWidth: "crw",
  columnSpan: "csp",
  columnWidth: "cw",
  columns: "cols",

  // Contain / container
  contain: "ctn",
  containerName: "ctnm",
  containerType: "ctnt",
  content: "cnt",
  contentVisibility: "cv",

  // Counter
  counterIncrement: "coi",
  counterReset: "cor",

  // Cursor
  cursor: "cur",

  // Direction
  direction: "dir",

  // Display
  display: "d",

  // Empty cells
  emptyCells: "ec",

  // Fill (SVG)
  fill: "fi",
  fillOpacity: "fio",
  fillRule: "fir",

  // Filter
  filter: "flt",

  // Flex
  flex: "fx",
  flexBasis: "fxb",
  flexDirection: "fxd",
  flexFlow: "fxf",
  flexGrow: "fxg",
  flexShrink: "fxs",
  flexWrap: "fxw",

  // Float
  float: "fl",

  // Font
  font: "fnt",
  fontDisplay: "fntd",
  fontFamily: "ff",
  fontFeatureSettings: "ffs",
  fontKerning: "fk",
  fontSize: "fz",
  fontSizeAdjust: "fza",
  fontStretch: "fst",
  fontStyle: "fsy",
  fontSynthesis: "fsyn",
  fontVariant: "fv",
  fontVariantCaps: "fvc",
  fontVariantLigatures: "fvl",
  fontVariantNumeric: "fvn",
  fontWeight: "fw",

  // Gap
  gap: "g",

  // Grid
  grid: "gd",
  gridArea: "ga",
  gridAutoColumns: "gac",
  gridAutoFlow: "gaf",
  gridAutoRows: "gar",
  gridColumn: "gc",
  gridColumnEnd: "gce",
  gridColumnGap: "gcg",
  gridColumnStart: "gcs",
  gridGap: "gg",
  gridRow: "gr",
  gridRowEnd: "gre",
  gridRowGap: "grg",
  gridRowStart: "grs",
  gridTemplate: "gt",
  gridTemplateAreas: "gta",
  gridTemplateColumns: "gtc",
  gridTemplateRows: "gtr",

  // Height
  height: "h",
  maxHeight: "mxh",
  minHeight: "mnh",

  // Hyphens
  hyphens: "hyp",

  // Image rendering
  imageRendering: "ir",

  // Inset
  inset: "ins",
  insetBlock: "insb",
  insetBlockEnd: "insbe",
  insetBlockStart: "insbs",
  insetInline: "insi",
  insetInlineEnd: "insie",
  insetInlineStart: "insis",

  // Isolation
  isolation: "iso",

  // Justify
  justifyContent: "jc",
  justifyItems: "ji",
  justifySelf: "jfs",

  // Left
  left: "l",

  // Letter spacing
  letterSpacing: "ls",

  // Line
  lineBreak: "lb",
  lineHeight: "lh",

  // List
  listStyle: "lis",
  listStyleImage: "lsi",
  listStylePosition: "lsp",
  listStyleType: "lst",

  // Margin
  margin: "m",
  marginBlock: "mbl",
  marginBlockEnd: "mble",
  marginBlockStart: "mbls",
  marginBottom: "mb",
  marginInline: "mil",
  marginInlineEnd: "mile",
  marginInlineStart: "mils",
  marginLeft: "ml",
  marginRight: "mr",
  marginTop: "mt",

  // Mask
  mask: "msk",
  maskImage: "mski",
  maskPosition: "mskp",
  maskRepeat: "mskr",
  maskSize: "msks",

  // Max / min width
  maxWidth: "mxw",
  minWidth: "mnw",

  // Mix blend mode
  mixBlendMode: "mbm",

  // Object
  objectFit: "obf",
  objectPosition: "obp",

  // Offset
  offset: "ofs",
  offsetPath: "ofsp",

  // Opacity
  opacity: "op",

  // Order
  order: "ord",

  // Orphans / widows
  orphans: "orp",
  widows: "wid",

  // Outline
  outline: "ol",
  outlineColor: "olc",
  outlineOffset: "olo",
  outlineStyle: "ols",
  outlineWidth: "olw",

  // Overflow
  overflow: "ov",
  overflowAnchor: "ova",
  overflowWrap: "ovw",
  overflowX: "ovx",
  overflowY: "ovy",
  overscrollBehavior: "osb",
  overscrollBehaviorX: "osbx",
  overscrollBehaviorY: "osby",

  // Padding
  padding: "p",
  paddingBlock: "pbl",
  paddingBlockEnd: "pble",
  paddingBlockStart: "pbls",
  paddingBottom: "pb",
  paddingInline: "pil",
  paddingInlineEnd: "pile",
  paddingInlineStart: "pils",
  paddingLeft: "pl",
  paddingRight: "pr",
  paddingTop: "pt",

  // Page break
  pageBreakAfter: "pgba",
  pageBreakBefore: "pgbb",
  pageBreakInside: "pgbi",

  // Perspective
  perspective: "per",
  perspectiveOrigin: "pero",

  // Place
  placeContent: "plc",
  placeItems: "pli",
  placeSelf: "pls",

  // Pointer events
  pointerEvents: "pe",

  // Position
  position: "pos",

  // Quotes
  quotes: "q",

  // Resize
  resize: "rsz",

  // Right
  right: "r",

  // Rotate / scale
  rotate: "rot",
  scale: "sc",

  // Row gap
  rowGap: "rg",

  // Scroll
  scrollBehavior: "scb",
  scrollMargin: "scm",
  scrollPadding: "scp",
  scrollSnapAlign: "ssa",
  scrollSnapStop: "sss",
  scrollSnapType: "sst",

  // Shape
  shapeImageThreshold: "sit",
  shapeMargin: "sm",
  shapeOutside: "so",

  // Stroke (SVG)
  stroke: "stk",
  strokeDasharray: "sda",
  strokeDashoffset: "sdo",
  strokeLinecap: "slc",
  strokeLinejoin: "slj",
  strokeOpacity: "sop",
  strokeWidth: "sw",

  // Tab size
  tabSize: "ts",

  // Table layout
  tableLayout: "tl",

  // Text
  textAlign: "ta",
  textAlignLast: "tal",
  textDecoration: "td",
  textDecorationColor: "tdc",
  textDecorationLine: "tdl",
  textDecorationStyle: "tds",
  textDecorationThickness: "tdt",
  textEmphasis: "te",
  textIndent: "ti",
  textJustify: "tj",
  textOrientation: "tor",
  textOverflow: "to",
  textRendering: "tr",
  textShadow: "tsh",
  textTransform: "tt",
  textUnderlineOffset: "tuo",
  textUnderlinePosition: "tup",
  textWrap: "twp",

  // Top
  top: "tp",

  // Touch action
  touchAction: "tca",

  // Transform
  transform: "tf",
  transformOrigin: "tfo",
  transformStyle: "tfs",

  // Transition
  transition: "tsn",
  transitionDelay: "tsnd",
  transitionDuration: "tsndu",
  transitionProperty: "tsnp",
  transitionTimingFunction: "tsntf",

  // Translate
  translate: "tsl",

  // Unicode / user select
  unicodeBidi: "ub",
  userSelect: "us",

  // Vertical align
  verticalAlign: "va",

  // Visibility
  visibility: "vis",

  // Webkit
  WebkitAppearance: "wkapp",
  WebkitBackdropFilter: "wkbdf",
  WebkitBoxOrient: "wbo",
  WebkitFontSmoothing: "wkfs",
  WebkitLineClamp: "wlc",
  WebkitMaskImage: "wkmi",
  WebkitOverflowScrolling: "wkos",
  WebkitTapHighlightColor: "wkthc",
  WebkitTextFillColor: "wktfc",
  WebkitTextStrokeColor: "wktsc",
  WebkitTextStrokeWidth: "wktsw",

  // White space
  whiteSpace: "ws",

  // Width
  width: "w",

  // Will change
  willChange: "wc",

  // Word
  wordBreak: "wdb",
  wordSpacing: "wds",
  wordWrap: "wdw",
  writingMode: "wm",

  // Z-index
  zIndex: "zi",

  // Bottom (positioned after "border*" to avoid scan confusion)
  bottom: "bot",
};

// Validate uniqueness at module load time
const seen = new Map<string, string>();
for (const [prop, abbr] of Object.entries(cssPropertyAbbreviations)) {
  const existing = seen.get(abbr);
  if (existing) {
    throw new Error(`CSS property abbreviation conflict: "${abbr}" is used by both "${existing}" and "${prop}"`);
  }
  seen.set(abbr, prop);
}
