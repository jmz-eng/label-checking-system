# 实验工作台布局 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现场核对入口作为实验页视觉主角，资料准备和追溯分组导航，改善布局与窄屏体验。

**Architecture:** ExperimentsPage保留实验选择/资料请求/会话恢复；提取简单的实验工作台首页与分组导航组件，继续挂载原有业务面板。ScanPanel仅调整表现层容器和CSS，不改状态机。CSS限定实验工作区，不影响标签SVG尺寸或其他项目。

**Tech Stack:** React18、TypeScript、Ant Design、现有图标、CSS、Playwright。

## Global Constraints

- Only label-checking-system; no medicine-reminder changes, no backend/business/data changes, no deployment or push.
- Default selected-experiment destination is overview with two dominant collection/aliquot entry cards; entering a scan view does not start a server session.
- Navigation groups: 现场核对, 实验准备, 追溯记录. Preserve all existing tab query deep links and all previously available preparation/history pages.
- Preserve permissions, failed-round return/blocking, durable pending request identity, retry and refresh logic. Do not use counts as eligibility or PASS indicators.
- Responsive with visible keyboard focus, current-location semantics and no page-level horizontal overflow at375/1440px. Preserve print physical layout.

### Task 1: UI, navigation and meaningful regressions

**Files:** frontend/src/pages/experiments/ExperimentsPage.tsx; new focused WorkspaceOverview/WorkspaceNavigation modules as useful; presentation-only ScanPanel containers; scoped styles.css; frontend/tests/e2e/experiments.spec.ts and/or focused workspace-layout.spec.ts.

**Interfaces:** Reuse Experiment/Mapping/Purpose/Tube/Session and useAuth; views keep existingtab names, new overview. Parent onTab callback changes query; no entrycard POST. Prepared business panel props/APIs remain unchanged. Navigation semanticrole can be button/link, tests must target actual intended accessible control (no fake Tabs retained only to pass oldtests).

- [ ] First add failed tests for default experiment destination/overview, two maincards routingwithoutsessionPOST, groupnavigation and existing deep link/currentlocation. Capture meaningful RED before source edits.
- [ ] Implement overview/groupnavigation and scoped appearance. Primary cards describe two scanning sequences and respect stage permissions; keep failed/in-progress recovery visible and all preparation/trace pages reachable. Do not invent readiness/calculatedsuccess states.
- [ ] Improve scan form visualhierarchy only; preserve all state/command logic. Ensure narrowviewports/keyboardfocussupport and longChineseexperimentnames wrap. Do not modify barcode renderer/printrootstyles.
- [ ] Adjust existing navigation tests to real controls, add permission/foreignfailedreturn/backforward/mobile tests and screenshots covering overview, preparation and scan pages. Keep existing failedround/pendingcommand/printlifecycle assertions.
- [ ] Run env -u NO_COLOR npm test, npm run lint, npm run build. Review full desktop/mobile screenshots; fix actual defects and rerun coveringchecks. Commit only featurefiles and report evidence.

### Task 2: Review and local preview

- [ ] Independent single whole-feature review (spec+quality) for navigation/state lifecycle/accessibility/printCSSscope; fix blocking findings with coveringtests.
- [ ] Parent inspect desktop/mobile screenshots and code diff, verify localfrontend health, show updated local overview URL. No real5174automatedbrowser access after prior denial.
- [ ] Update current use guide/developmentprogress, preserve branch, record limitations and previewlink for user. No push/deploy.
