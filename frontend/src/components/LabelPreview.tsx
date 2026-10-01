import { useMemo } from 'react';
import type { SampleTask } from '../types';
import { createLabelLayout, DOTS_PER_MODULE, LABEL_HEIGHT_DOTS, LABEL_WIDTH_DOTS } from '../utils/labelLayout';

export function LabelPreview({ task }: { task: SampleTask }) {
  const layout = useMemo(() => createLabelLayout(task), [task]);
  return (
    <div className="label-preview" data-label-code={task.labelCode}>
      {layout.error ? <div className="label-layout-error" role="alert">{layout.error}</div> : (
        <svg className="label-artwork" viewBox={`0 0 ${LABEL_WIDTH_DOTS} ${LABEL_HEIGHT_DOTS}`}
          role="img" aria-label={`标签二维码：${task.labelCode}`} xmlns="http://www.w3.org/2000/svg">
          <rect width={LABEL_WIDTH_DOTS} height={LABEL_HEIGHT_DOTS} fill="#fff" />
          <path data-qr-code="true" d={layout.qrPath} fill="#000" shapeRendering="crispEdges"
            transform={`translate(${layout.qrX} ${layout.qrY}) scale(${DOTS_PER_MODULE})`} />
          {layout.lines.map((line, index) => (
            <text key={index} x={layout.textX} y={line.y} fill="#000" fontFamily="Arial, Microsoft YaHei, sans-serif"
              fontSize={line.fontSize} fontWeight={line.bold ? 700 : 400}
              textLength={line.width || undefined} lengthAdjust="spacingAndGlyphs">{line.text}</text>
          ))}
        </svg>
      )}
    </div>
  );
}
