import { Ecc, QrCode, QrSegment } from '@rc-component/qrcode/lib/libs/qrcodegen.js';
import { DOTS_PER_MODULE, LABEL_HEIGHT_DOTS, LABEL_WIDTH_DOTS, QUIET_MODULES } from './labelLayout';
import type { LabelLayout } from './labelLayout';
import type { Tube } from '../types/experiments';
export const TUBE_FONT_FLOOR_DOTS = 16;
export function createTubeLabelLayout(tube: Tube): LabelLayout {
  const result: LabelLayout = {
    qrPath: '',
    qrSize: 0,
    qrX: 3,
    qrY: 0,
    textX: 0,
    lines: [],
  };
  if (!tube.code.trim()) return { ...result, error: '二维码为空，不能打印。' };
  try {
    const qr = QrCode.encodeSegments(
      QrSegment.makeSegments(tube.code),
      Ecc.MEDIUM,
      1,
      3,
      -1,
      false,
    );
    result.qrSize = (qr.size + 2 * QUIET_MODULES) * DOTS_PER_MODULE;
    result.qrY = Math.floor((LABEL_HEIGHT_DOTS - result.qrSize) / 2);
    result.textX = result.qrX + result.qrSize + 3;
    result.qrPath = qr
      .getModules()
      .flatMap((row, y) =>
        row.flatMap((dark, x) =>
          dark ? [`M${x + QUIET_MODULES},${y + QUIET_MODULES}h1v1h-1z`] : [],
        ),
      )
      .join('');
  } catch {
    return { ...result, error: '二维码过长，25 × 10 mm 无法清晰打印。' };
  }
  const width = LABEL_WIDTH_DOTS - result.textX - 3;
  const fields = [
    tube.projectCode,
    tube.animalNo,
    tube.timePoint,
    tube.labelInfo,
    tube.collectDate,
  ];
  result.lines = fields.map((text, index) => {
    const units = Array.from(text).reduce((n, c) => n + (/[^\x00-\x7f]/.test(c) ? 1 : 0.7), 0);
    const fontSize = Math.min(index === 1 ? 20 : 18, width / Math.max(1, units));
    return {
      text,
      y: 19 + index * 23,
      fontSize,
      width: units * fontSize,
      bold: index === 1,
    };
  });
  const overflows = result.lines.flatMap((line, i) =>
    line.fontSize < TUBE_FONT_FLOOR_DOTS
      ? [['试验编号', '动物号', '时间点', '管标信息', '采样日期'][i]]
      : [],
  );
  if (overflows.length)
    result.error = `${overflows.join('、')}过长；25 × 10 mm 无法完整清晰显示，不能缩小到 16 打印点以下，请调整内容或使用更大标签。`;
  return result;
}
