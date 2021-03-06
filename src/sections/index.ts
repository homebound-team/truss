import { borderColor } from "./borderColors";
import { borderRadius } from "./borderRadius";
import { border } from "./border";
import { borderStyle } from "./borderStyles";
import { borderWidth } from "./borderWidths";
import { boxShadow } from "./boxShadow";
import { coordinates } from "./coordinates";
import { cursor } from "./cursor";
import { display } from "./display";
import { flexbox } from "./flexbox";
import { float } from "./floats";
import { fontWeight } from "./fontWeight";
import { height } from "./heights";
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
import { zIndex } from "./zIndex";

export const defaultSections = {
  borderColor,
  borderRadius,
  border,
  borderStyle,
  borderWidth,
  boxShadow,
  coordinates,
  cursor,
  display,
  flexbox,
  float,
  fontWeight,
  height,
  outline,
  objectFit,
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
  zIndex,
} as const;
