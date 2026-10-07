import { useRef, useState } from 'react';
import {
  AppstoreOutlined,
  BarcodeOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  SettingOutlined,
  RightOutlined,
} from '@ant-design/icons';

export const workspaceGroups = [
  {
    name: '现场核对',
    icon: <BarcodeOutlined aria-hidden="true" />,
    items: [
      { key: 'overview', label: '工作台', icon: <AppstoreOutlined aria-hidden="true" /> },
      { key: 'collection', label: '采血核对', icon: <BarcodeOutlined aria-hidden="true" /> },
      { key: 'aliquot', label: '血样处理核对', icon: <ExperimentOutlined aria-hidden="true" /> },
    ],
  },
  {
    name: '实验准备',
    icon: <SettingOutlined aria-hidden="true" />,
    items: [
      { key: 'groups', label: '分组关系' },
      { key: 'purposes', label: '用途配对' },
      { key: 'imports', label: '附件导入' },
      { key: 'collection-tubes', label: '采血管' },
      { key: 'aliquot-tubes', label: '分装管' },
      { key: 'print', label: '标签打印' },
    ],
  },
  {
    name: '追溯记录',
    icon: <FileSearchOutlined aria-hidden="true" />,
    items: [
      { key: 'records', label: '核对记录' },
      { key: 'changes', label: '更改记录' },
    ],
  },
];
export const workspaceViews = workspaceGroups.flatMap((group) => group.items);

export function WorkspaceNavigation({
  active,
  onNavigate,
}: {
  active: string;
  onNavigate: (key: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  return (
    <nav aria-label="实验内导航" className={`workspace-navigation ${expanded ? 'is-expanded' : ''}`}>
      <button
        ref={toggle}
        className="workspace-nav-toggle"
        aria-expanded={expanded}
        aria-controls="workspace-nav-groups"
        onClick={() => setExpanded(!expanded)}
      >
        <AppstoreOutlined aria-hidden="true" /> 实验导航
        <span>{workspaceViews.find((view) => view.key === active)?.label}</span>
        <RightOutlined aria-hidden="true" />
      </button>
      <div id="workspace-nav-groups" className="workspace-nav-groups">
        {workspaceGroups.map((group) => (
          <section key={group.name}>
            <h4>{group.icon} {group.name}</h4>
            {group.items.map((item) => (
              <button
                key={item.key}
                aria-current={active === item.key ? 'page' : undefined}
                onClick={() => {
                  onNavigate(item.key);
                  setExpanded(false);
                  // Only the visible mobile toggle can receive the collapsed menu's focus.
                  if (expanded && toggle.current?.getClientRects().length) toggle.current.focus();
                }}
              >
                {'icon' in item && item.icon}
                <span>{item.label}</span>
                {active === item.key && <RightOutlined aria-hidden="true" className="workspace-current-marker" />}
              </button>
            ))}
          </section>
        ))}
      </div>
    </nav>
  );
}
