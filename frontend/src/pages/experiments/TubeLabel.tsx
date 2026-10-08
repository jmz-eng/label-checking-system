import type { Tube } from '../../types/experiments';
import { LABEL_HEIGHT_DOTS, LABEL_WIDTH_DOTS } from '../../utils/labelLayout';
import { createTubeLabelLayout } from '../../utils/tubeLabelLayout';
export function TubeLabel({ tube }: { tube: Tube }) {
  const layout = createTubeLabelLayout(tube);
  return (
    <div className="experiment-tube-label" data-tube-id={tube.id} data-code={tube.code} data-barcode={tube.barcode}>
      {layout.error ? (
        <div className="label-layout-error">{layout.error}</div>
      ) : (
        <svg
          className="experiment-label-artwork"
          viewBox={`0 0 ${LABEL_WIDTH_DOTS} ${LABEL_HEIGHT_DOTS}`}
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label={`${tube.projectCode} ${tube.animalNo} ${tube.timePoint} ${tube.labelInfo} ${tube.collectDate}`}
        >
          <rect x="0" y="0" width={LABEL_WIDTH_DOTS} height={LABEL_HEIGHT_DOTS} fill="#fff" />
          <g
            transform={`translate(${layout.barcodeX},${layout.barcodeY})`}
            shapeRendering="crispEdges"
          >
            <path data-barcode="true" d={layout.barcodePath} fill="#000" />
          </g>
          {layout.lines.map((line, i) => (
            <text
              key={i}
              x={layout.textX}
              textAnchor="middle"
              y={line.y}
              fontSize={line.fontSize}
              fontWeight={line.bold ? 700 : 500}
              fontFamily="Arial, 'PingFang SC', sans-serif"
              fill="#000"
              textLength={line.width}
              lengthAdjust="spacingAndGlyphs"
            >
              {line.text}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}
