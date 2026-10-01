# 采血样品标签防错管理系统

用于采血样品任务管理、标签生成、贴标绑定、扫码核对、录入确认和历史追溯。前端版本 `1.0.5`，后端版本 `1.0.3`。

## 功能与技术栈

- 项目、动物信息与采样任务管理。
- 工作台任务详情、联合筛选、扫码核对及异常提示。
- 25 × 10 mm、300 dpi 二维码标签预览与单张打印。
- 扫描记录、审计日志、统计报告及公告管理。
- 用户、菜单、角色和权限管理，后端接口校验权限。

项目使用 React 18、TypeScript、Vite、Ant Design、Spring Boot 3、MyBatis-Plus 和 MySQL。标签打印文件已通过图像解码验证，实物打印效果仍需结合打印机试打确认。已知问题见 [功能模块检查报告](docs/功能模块检查报告.md)。

## 目录

```text
frontend/  前端源码、依赖锁文件和浏览器回归测试
backend/   后端源码、数据库建表与迁移 SQL、单元测试
docs/      需求、设计、接口、测试与部署文档
scripts/   部署包制作和打印文件验证脚本
ppt/       项目需求研讨材料
```

建表文件为 `backend/src/main/resources/db/schema.sql`，增量迁移位于相邻的 `migrations/` 目录。本地业务数据库备份、私有配置、部署包及构建产物由 Git 忽略。

## 本地启动

准备 Node.js、npm、JDK 17、Maven 和 MySQL，验证环境见 [环境检查记录](docs/环境检查记录.md)。MySQL 账号需具备本地建库建表权限。

在 PowerShell 中进入 `backend` 目录，设置连接信息和随机 JWT 密钥：

```powershell
$env:DB_HOST="localhost"
$env:DB_PORT="3306"
$env:DB_NAME="tag_management"
$env:DB_USER="root"
$env:DB_PASSWORD="填写你的数据库密码"
$secretBytes = New-Object byte[] 48
$randomGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$randomGenerator.GetBytes($secretBytes)
$randomGenerator.Dispose()
$env:APP_JWT_SECRET=[Convert]::ToBase64String($secretBytes)
mvn.cmd clean package
java -jar target/tag-management-backend-1.0.3.jar
```

JWT 密钥应固定保存到私有环境配置，后续启动继续使用。也可以在 `backend/application-private.yml` 配置 `spring.datasource.password` 和 `app.jwt-secret`；该文件从 `backend` 工作目录自动导入，已由 Git 忽略，不能提交。

空库首次创建角色、账号和示例数据时，还需设置 `APP_BOOTSTRAP_ENABLED=true`，并提供 `APP_BOOTSTRAP_ADMIN_PASSWORD`、`APP_BOOTSTRAP_TECH_PASSWORD`、`APP_BOOTSTRAP_ANALYST_PASSWORD`、`APP_BOOTSTRAP_AUDITOR_PASSWORD` 四项初始化密码。完成后关闭开关；已有数据库保持默认 `false`。详见 [部署文档](docs/deploy.md)。

另开终端，在 `frontend` 目录执行：

```powershell
npm.cmd ci
npm.cmd run dev
```

前端默认访问 `http://localhost:5173`，后端默认端口 `8080`。端口被占用时按 [部署文档](docs/deploy.md) 设置 `SERVER_PORT` 和 `VITE_API_BASE`。

## 验证

在 `frontend` 目录执行：

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd test
```

浏览器回归测试使用本机 Chrome 和隔离接口数据。在 `backend` 目录执行 `mvn.cmd test`；打印文件的独立图像解码方法见 [小标签打印修复报告](docs/小标签打印修复报告.md)。

完整文档入口：[docs/README.md](docs/README.md)。
