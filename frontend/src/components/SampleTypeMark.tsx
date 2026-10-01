import {
  ApiFilled,
  ExperimentFilled,
  FireFilled,
  HeartFilled,
  MedicineBoxFilled,
  SafetyCertificateFilled,
  ThunderboltFilled,
} from '@ant-design/icons';
import type { ReactNode } from 'react';

type SampleTypeTone = 'red' | 'gold' | 'purple' | 'green' | 'blue' | 'cyan' | 'orange';

interface SampleTypeMeta {
  tone: SampleTypeTone;
  icon: ReactNode;
}

const defaultSampleTypeMeta: SampleTypeMeta = {
  tone: 'blue',
  icon: <ExperimentFilled />,
};

function resolveSampleTypeMeta(sampleType: string): SampleTypeMeta {
  const text = sampleType.trim().toUpperCase();

  if (text.includes('凝血')) {
    return { tone: 'orange', icon: <SafetyCertificateFilled /> };
  }
  if (text.includes('生化')) {
    return { tone: 'purple', icon: <ExperimentFilled /> };
  }
  if (text.includes('尿')) {
    return { tone: 'gold', icon: <MedicineBoxFilled /> };
  }
  if (text.includes('反应蛋白') || text.includes('CRP')) {
    return { tone: 'cyan', icon: <ApiFilled /> };
  }
  if (text.includes('钾') || text.includes('离子')) {
    return { tone: 'green', icon: <ThunderboltFilled /> };
  }
  if (text.includes('血气')) {
    return { tone: 'blue', icon: <FireFilled /> };
  }
  if (text.includes('血')) {
    return { tone: 'red', icon: <HeartFilled /> };
  }

  return defaultSampleTypeMeta;
}

export function SampleTypeMark({ sampleType }: { sampleType?: string }) {
  const text = sampleType?.trim() || '-';
  const meta = resolveSampleTypeMeta(text);

  return (
    <span className={`sample-type-mark sample-type-mark-${meta.tone}`} title={text}>
      <span className="sample-type-icon" aria-hidden="true">
        {meta.icon}
      </span>
      <span className="sample-type-text">{text}</span>
    </span>
  );
}
