import { animation } from "./animation";
import { appearance } from "./appearance";
import { aspectRatio } from "./aspectRatio";
import { background } from "./background";
import { border } from "./border";
import { borderColor } from "./borderColors";
import { borderRadius } from "./borderRadius";
import { borderStyle } from "./borderStyles";
import { borderWidth } from "./borderWidths";
import { boxShadow } from "./boxShadow";
import { breaks } from "./breaks";
import { clipPath } from "./clipPath";
import { container } from "./container";
import { coordinates } from "./coordinates";
import { cursor } from "./cursor";
import { display } from "./display";
import { filter } from "./filter";
import { flexbox } from "./flexbox";
import { float } from "./floats";
import { fontStyle } from "./fontStyle";
import { fontWeight } from "./fontWeight";
import { grid } from "./grid";
import { height } from "./heights";
import { lineClamp } from "./lineClamp";
import { listStyle } from "./listStyle";
import { mask } from "./mask";
import { objectFit } from "./objectFit";
import { opacity } from "./opacity";
import { outline } from "./outlines";
import { overflow } from "./overflow";
import { pointerEvents } from "./pointerEvents";
import { position } from "./position";
import { resize } from "./resize";
import { scroll } from "./scroll";
import { scrollSnap } from "./scrollSnap";
import { scrollbarWidth } from "./scrollbarWidth";
import { skins } from "./skins";
import { spacing } from "./spacing";
import { table } from "./table";
import { textAlign } from "./textAlign";
import { textDecoration } from "./textDecoration";
import { textTransform } from "./textTransform";
import { touchAction } from "./touchAction";
import { transform } from "./transform";
import { transition } from "./transition";
import { typeScale } from "./typeScale";
import { typography } from "./typography";
import { userSelect } from "./userSelect";
import { verticalAlign } from "./verticalAlign";
import { visibility } from "./visibility";
import { whitespace } from "./whitespace";
import { width } from "./widths";
import { wordBreak } from "./wordBreak";
import { zIndex } from "./zIndex";

export const defaultSections = {
  animation,
  appearance,
  aspectRatio,
  background,
  border,
  borderColor,
  borderRadius,
  borderStyle,
  borderWidth,
  boxShadow,
  breaks,
  clipPath,
  container,
  coordinates,
  cursor,
  display,
  filter,
  flexbox,
  float,
  fontStyle,
  fontWeight,
  grid,
  height,
  lineClamp,
  listStyle,
  mask,
  objectFit,
  opacity,
  outline,
  overflow,
  pointerEvents,
  position,
  resize,
  scroll,
  scrollSnap,
  scrollbarWidth,
  skins,
  spacing,
  table,
  textAlign,
  textDecoration,
  textTransform,
  touchAction,
  transform,
  transition,
  typeScale,
  typography,
  userSelect,
  verticalAlign,
  visibility,
  whitespace,
  width,
  wordBreak,
  zIndex,
} as const;
