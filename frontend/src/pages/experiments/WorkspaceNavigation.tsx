import { useRef, useState } from 'react';
import { Button, Dropdown } from 'antd';
import {
  AppstoreOutlined,
  BarcodeOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  SettingOutlined,
  RightOutlined,
  DownOutlined,
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

export function WorkspaceNavigation({ active, onNavigate, readOnly = false }: {
  active: string; onNavigate: (key: string) => void; readOnly?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  function choose(key: string) {
    onNavigate(key);
    setExpanded(false);
    // Wait for the dropdown's keyboard event and focus restoration to finish.
    if (expanded) setTimeout(() => toggle.current?.focus(), 50);
  }
  return (
    <nav aria-label="实验内导航" className={`workspace-navigation workspace-top-navigation ${expanded ? 'is-expanded' : ''}`}>
      <button ref={toggle} className="workspace-nav-toggle" aria-expanded={expanded}
        aria-controls="workspace-nav-groups" onClick={() => setExpanded(!expanded)}>
        <AppstoreOutlined aria-hidden="true" /> 实验导航
        <span>{workspaceViews.find(view => view.key === active)?.label}</span>
        <RightOutlined aria-hidden="true" />
      </button>
      <div id="workspace-nav-groups" className="workspace-nav-groups">
        {workspaceGroups.filter(group => !readOnly || group.name === '追溯记录').map(group => (
          <section key={group.name} className={group.name === '现场核对' ? 'workspace-primary-nav' : 'workspace-secondary-nav'}>
            {group.name === '现场核对' ? group.items.map(item => (
              <button key={item.key} aria-current={active === item.key ? 'page' : undefined} onClick={() => choose(item.key)}>
                {'icon' in item && item.icon}<span>{item.label}</span>
              </button>
            )) : <Dropdown trigger={['click']} menu={{
              selectedKeys:[active],
              items:group.items.map(item => ({key:item.key,label:item.label})),
              onClick:({key}) => choose(key),
            }}>
              <Button aria-label={group.name} className={group.items.some(item => item.key===active) ? 'workspace-group-active' : ''}>
                {group.icon}{group.name}<DownOutlined />
              </Button>
            </Dropdown>}
          </section>
        ))}
      </div>
    </nav>
  );
}
