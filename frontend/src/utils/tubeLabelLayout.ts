import { createBarcodeLabelLayout, MIN_FONT_DOTS } from './labelLayout';
import type { Tube } from '../types/experiments';
export const TUBE_FONT_FLOOR_DOTS = MIN_FONT_DOTS;
export function createTubeLabelLayout(tube: Tube) {
  return createBarcodeLabelLayout(tube.barcode, tube);
}
