import { border } from "src/sections/tachyons/border";
import { borderColor } from "src/sections/tachyons/borderColors";
import { borderRadius } from "src/sections/tachyons/borderRadius";
import { borderStyle } from "src/sections/tachyons/borderStyles";
import { borderWidth } from "src/sections/tachyons/borderWidths";
import { boxShadow } from "src/sections/tachyons/boxShadow";
import { coordinates } from "src/sections/tachyons/coordinates";
import { cursor } from "src/sections/tachyons/cursor";
import { display } from "src/sections/tachyons/display";
import { flexbox } from "src/sections/tachyons/flexbox";
import { float } from "src/sections/tachyons/floats";
import { fontWeight } from "src/sections/tachyons/fontWeight";
import { grid } from "src/sections/tachyons/grid";
import { height } from "src/sections/tachyons/heights";
import { lineClamp } from "src/sections/tachyons/lineClamp";
import { objectFit } from "src/sections/tachyons/objectFit";
import { outline } from "src/sections/tachyons/outlines";
import { overflow } from "src/sections/tachyons/overflow";
import { position } from "src/sections/tachyons/position";
import { skins } from "src/sections/tachyons/skins";
import { spacing } from "src/sections/tachyons/spacing";
import { textAlign } from "src/sections/tachyons/textAlign";
import { textDecoration } from "src/sections/tachyons/textDecoration";
import { textTransform } from "src/sections/tachyons/textTransform";
import { typeScale } from "src/sections/tachyons/typeScale";
import { typography } from "src/sections/tachyons/typography";
import { userSelect } from "src/sections/tachyons/userSelect";
import { verticalAlign } from "src/sections/tachyons/verticalAlign";
import { visibility } from "src/sections/tachyons/visibility";
import { whitespace } from "src/sections/tachyons/whitespace";
import { width } from "src/sections/tachyons/widths";
import { wordBreak } from "src/sections/tachyons/wordBreak";
import { zIndex } from "src/sections/tachyons/zIndex";
import { container } from "src/sections/tachyons/container";

export const defaultSections = {
  border,
  borderColor,
  borderRadius,
  borderStyle,
  borderWidth,
  boxShadow,
  container,
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
