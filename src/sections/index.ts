import { border } from "./border";
import { borderColor } from "./borderColors";
import { borderRadius } from "./borderRadius";
import { borderStyle } from "./borderStyles";
import { borderWidth } from "./borderWidths";
import { boxShadow } from "./boxShadow";
import { coordinates } from "./coordinates";
import { cursor } from "./cursor";
import { display } from "./display";
import { flexbox } from "./flexbox";
import { float } from "./floats";
import { fontWeight } from "./fontWeight";
import { grid } from "./grid";
import { height } from "./heights";
import { lineClamp } from "./lineClamp";
import { objectFit } from "./objectFit";
import { outline } from "./outlines";
import { overflow } from "./overflow";
import { position } from "./position";
import { skins } from "./skins";
import { spacing } from "./spacing";
import { textAlign } from "./textAlign";
import { textDecoration } from "./textDecoration";
import { textTransform } from "./textTransform";
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
  border,
  borderColor,
  borderRadius,
  borderStyle,
  borderWidth,
  boxShadow,
  coordinates,
  cursor,
  display,
  flexbox,
  float,
  fontWeight,
  grid,
  height,
  lineClamp,
  objectFit,
  outline,
  overflow,
  position,
  skins,
  spacing,
  textAlign,
  textDecoration,
  textTransform,
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
