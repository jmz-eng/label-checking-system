import { Ecc, QrCode, QrSegment } from '@rc-component/qrcode/lib/libs/qrcodegen.js';
import type { SampleTask } from '../types';

export const LABEL_WIDTH_MM = 25;
export const LABEL_HEIGHT_MM = 10;
export const LABEL_DPI = 300;
export const DOTS_PER_MODULE = 3;
export const QUIET_MODULES = 4;
const DOTS_PER_MM = LABEL_DPI / 25.4;
export const LABEL_WIDTH_DOTS = LABEL_WIDTH_MM * DOTS_PER_MM;
export const LABEL_HEIGHT_DOTS = LABEL_HEIGHT_MM * DOTS_PER_MM;
const EDGE_DOTS = 3;
const MIN_FONT_DOTS = 16;

export interface LabelLine {
  text: string;
  y: number;
  fontSize: number;
  width: number;
  bold: boolean;
}

export interface LabelLayout {
  error?: string;
  qrPath: string;
  qrSize: number;
  qrX: number;
  qrY: number;
  textX: number;
  lines: LabelLine[];
}

export function createLabelLayout(task: SampleTask): LabelLayout {
  const result: LabelLayout = { qrPath: '', qrSize: 0, qrX: EDGE_DOTS, qrY: 0, textX: 0, lines: [] };
  if (!task.labelCode.trim()) return { ...result, error: '标签码为空，无法打印。' };
  try {
    // 版本 3 加四格留白后占 111 个打印点，再增大就无法放入 10 mm 高的纸张。
    const qr = QrCode.encodeSegments(QrSegment.makeSegments(task.labelCode), Ecc.MEDIUM, 1, 3, -1, false);
    result.qrSize = (qr.size + QUIET_MODULES * 2) * DOTS_PER_MODULE;
    result.qrY = Math.floor((LABEL_HEIGHT_DOTS - result.qrSize) / 2);
    result.textX = EDGE_DOTS + result.qrSize + EDGE_DOTS;
    result.qrPath = qr.getModules().flatMap((row, y) => row.flatMap((dark, x) => dark
      ? [`M${x + QUIET_MODULES},${y + QUIET_MODULES}h1v1h-1z`] : [])).join('');
  } catch {
    return { ...result, error: '标签码过长，25 × 10 mm 无法保留足够清晰的二维码，请使用更大标签。' };
  }
  const maxWidth = LABEL_WIDTH_DOTS - result.textX - EDGE_DOTS;
  const fields = [task.projectCode, task.animalNo, `${task.timePoint} ${task.sampleType}`, task.plannedCollectDate];
  result.lines = fields.map((text, index) => {
    // 保守估计中英文宽度，并使用 SVG 固定行宽，完整保留文字，不截断动物号或时间点。
    const units = Array.from(text).reduce((sum, char) => sum + (/[^\x00-\x7f]/.test(char) ? 1 : 0.7), 0);
    const fontSize = Math.min(index === 1 ? 23 : 18, maxWidth / Math.max(units, 1));
    return { text, y: 24 + index * 26, fontSize, width: units * fontSize, bold: index === 1 };
  });
  if (result.lines.some((line) => line.fontSize < MIN_FONT_DOTS)) {
    result.error = '标签文字过长，25 × 10 mm 无法清晰显示完整信息，请使用更大标签。';
  }
  return result;
}
