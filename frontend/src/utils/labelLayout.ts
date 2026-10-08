import JsBarcode from 'jsbarcode';
import type { SampleTask } from '../types';

export const LABEL_WIDTH_MM = 25;
export const LABEL_HEIGHT_MM = 10;
export const LABEL_DPI = 300;
export const DOTS_PER_MODULE = 2;
export const QUIET_MODULES = 10;
const DOTS_PER_MM = LABEL_DPI / 25.4;
export const LABEL_WIDTH_DOTS = LABEL_WIDTH_MM * DOTS_PER_MM;
export const LABEL_HEIGHT_DOTS = LABEL_HEIGHT_MM * DOTS_PER_MM;
export const MIN_FONT_DOTS = 16;
const EDGE_DOTS = 3;
const BAR_HEIGHT_DOTS = 32;

export interface LabelLine {
  text: string;
  y: number;
  fontSize: number;
  width: number;
  bold: boolean;
}
export interface LabelLayout {
  error?: string;
  barcodePath: string;
  barcodeWidth: number;
  barcodeX: number;
  barcodeY: number;
  textX: number;
  lines: LabelLine[];
}

/** Shared physical layout. The original label identity is never used as a fallback alias. */
interface LabelFields {
  projectCode: string;
  animalNo: string;
  timePoint: string;
  labelInfo: string;
  collectDate: string;
}
export function createBarcodeLabelLayout(barcode: string | undefined, source: LabelFields): LabelLayout {
  const result: LabelLayout = {
    barcodePath: '', barcodeWidth: 0, barcodeX: 0, barcodeY: EDGE_DOTS,
    textX: LABEL_WIDTH_DOTS / 2, lines: [],
  };
  if (!barcode || !/^[0-9]{12}$/.test(barcode)) {
    return { ...result, error: '缺少有效的12位条形码，不能打印。历史快照未保存条形码时，请从当前管子重新登记打印请求。' };
  }
  const originalFields = [source.projectCode, source.animalNo, source.timePoint, source.labelInfo, source.collectDate];
  if (originalFields.some((text) => typeof text !== 'string' || !text.trim()))
    return { ...result, error: '标签文字缺失，不能打印不完整的标签。' };
  if (originalFields.some((text) => /[\r\n\t]/.test(text)))
    return { ...result, error: '标签文字包含换行或制表符，25 × 10 mm无法完整保留，请调整内容或使用更大标签。' };
  const fields = [source.projectCode, `${source.animalNo} ${source.timePoint}`, source.labelInfo, source.collectDate];
  const encoded: { encodings?: { data: string }[] } = {};
  JsBarcode(encoded, barcode, { format: 'CODE128C', displayValue: false, margin: 0 });
  const modules = encoded.encodings!.map((part) => part.data).join('');
  const quietDots = QUIET_MODULES * DOTS_PER_MODULE;
  result.barcodeWidth = modules.length * DOTS_PER_MODULE + quietDots * 2;
  if (result.barcodeWidth > LABEL_WIDTH_DOTS - EDGE_DOTS * 2)
    return { ...result, error: '条形码超出25 × 10 mm标签，不能缩小码元打印。' };
  result.barcodeX = Math.floor((LABEL_WIDTH_DOTS - result.barcodeWidth) / 2);
  result.barcodePath = Array.from(modules).flatMap((value, x) => value === '1'
    ? [`M${quietDots + x * DOTS_PER_MODULE},0h${DOTS_PER_MODULE}v${BAR_HEIGHT_DOTS}h-${DOTS_PER_MODULE}z`] : []).join('');
  const maxWidth = LABEL_WIDTH_DOTS - EDGE_DOTS * 2;
  result.lines = fields.map((text, index) => {
    const units = Array.from(text).reduce((sum, char) => sum + (/[^\x00-\x7f]/.test(char) ? 1 : 0.7), 0);
    const fontSize = Math.min(18, maxWidth / Math.max(units, 1));
    return { text, y: 57 + index * 18, fontSize, width: units * fontSize, bold: index === 1 };
  });
  if (result.lines.some((line) => line.fontSize < MIN_FONT_DOTS))
    result.error = '标签文字缺失或过长，25 × 10 mm 无法完整清晰显示，不能缩小到16打印点以下，请调整内容或使用更大标签。';
  return result;
}

export function createLabelLayout(task: SampleTask): LabelLayout {
  return createBarcodeLabelLayout(task.barcode, {
    projectCode: task.projectCode, animalNo: task.animalNo, timePoint: task.timePoint,
    labelInfo: task.sampleType, collectDate: task.plannedCollectDate,
  });
}
