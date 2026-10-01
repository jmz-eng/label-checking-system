# 采血样品标签防错管理系统文档

## 阅读顺序

- 小标签修复：[小标签打印修复报告.md](小标签打印修复报告.md)（25 × 10 mm、300 dpi，前端 1.0.5）。
- 最新部署：[服务器部署记录.md](服务器部署记录.md)（2026-09-17，公网地址、数据迁移与回滚）。
- 最新检查：[功能模块检查报告.md](功能模块检查报告.md)（2026-09-17，工作台修复与剩余问题）。
- 最新环境：[环境检查记录.md](环境检查记录.md)（2026-09-17 实测）。

1. [project-overview.md](project-overview.md)：项目背景、业务闭环、功能模块、系统架构和完成情况。
2. [environment.md](environment.md)：本地环境、端口和变量说明。
3. [requirements.md](requirements.md)：从 PPT 提炼的业务目标、角色和功能范围。
4. [design.md](design.md)：系统架构、权限模型和核心流程。
5. [detail-design.md](detail-design.md)：模块级设计与关键业务规则。
6. [database.md](database.md)：MySQL 表结构、索引和 ER 关系。
7. [api.md](api.md)：RESTful API 设计。
8. [test.md](test.md)：测试用例与验证记录。
9. [deploy.md](deploy.md)：本地启动与部署说明。
10. [user-manual.md](user-manual.md)：管理员、技术员、分析人员和审计人员使用说明。
11. [development-plan.md](development-plan.md)：开发计划与完成标准。
12. [optimization.md](optimization.md)：问题审计、优化方案与实施结果。
13. [changelog.md](changelog.md)：版本变更记录。

## 项目定位

本系统根据 `ppt/采血样品防错改进研讨.pptx` 开发，目标是把采血及样品处理环节中的“人工读文字核对”改为“系统生成标签、扫码绑定、扫码核对、自动留痕”，在错误发生当下完成拦截。

## 技术栈

- 前端：React + TypeScript + Vite + Ant Design
- 后端：Spring Boot + MyBatis-Plus
- 数据库：MySQL
- 接口风格：RESTful API
- 权限模型：RBAC，后端接口强校验

## 当前范围

第一版聚焦采血样品标签防错闭环：

- 用户登录、用户管理与权限控制
- 项目与动物基础信息维护
- 采样任务生成
- 标签编码与标签预览
- 贴标扫码绑定
- 操作前扫码核对
- 分析录入状态确认
- 异常拦截、扫描记录与审计追溯
- 菜单、角色权限、日志和公告管理
