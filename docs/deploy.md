# 部署说明文档

2026-09-17 服务器已部署至 <http://110.40.188.106:8096/>。实际端口、目录、数据迁移核对及回滚方式见 [服务器部署记录](./服务器部署记录.md)。

## 1. 本地开发启动

### 1.1 MySQL

确认 MySQL 已启动，账号具备创建数据库和建表权限。

后端 JDBC URL 默认使用：

```text
jdbc:mysql://localhost:3306/tag_management
```

如数据库不存在，后端连接串会尝试自动创建。

### 1.2 后端

在 `F:\桌面\Tag Management\backend` 执行：

```bash
mvn clean package
java -jar target/tag-management-backend-1.0.3.jar
```

本地开发也可以直接运行：

```bash
mvn spring-boot:run
```

当前 Windows 中文路径下曾出现 `spring-boot:run` 找不到主类的情况，已验证 jar 方式可正常启动。若遇到同类问题，以 `java -jar target/tag-management-backend-1.0.3.jar` 为准。

### 1.3 前端

在 `F:\桌面\Tag Management\frontend` 执行：

```bash
npm install
npm run dev
```

浏览器访问：

```text
http://localhost:5173
```

## 2. 环境变量

仓库内 `application.yml` 保留地址、端口等非敏感默认值，数据库密码和 JWT 密钥需自行配置。当前工作区的原开发凭据已迁移至 Git 忽略的 `backend/application-private.yml`，从 `backend` 目录启动时自动导入；新克隆项目请设置以下环境变量：

```text
DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PASSWORD
APP_JWT_SECRET
APP_TOKEN_EXPIRE_HOURS
APP_CORS_ALLOWED_ORIGIN_PATTERNS
APP_BOOTSTRAP_ENABLED
SERVER_PORT
```

本地联调可在 PowerShell 中临时设置：

```powershell
$env:DB_HOST="localhost"
$env:DB_PORT="3306"
$env:DB_NAME="tag_management"
$env:DB_USER="root"
$env:DB_PASSWORD="<本地数据库密码>"
$env:APP_JWT_SECRET="<至少32位随机字符串>"
$env:APP_TOKEN_EXPIRE_HOURS="12"
$env:APP_CORS_ALLOWED_ORIGIN_PATTERNS="https://your-domain.example.com"
```

本地已有私有配置时可继续启动，环境变量优先于该文件中的默认值。新克隆项目必须提供 `DB_PASSWORD` 和至少 32 位的 `APP_JWT_SECRET`；私有文件和真实凭据不能提交到 Git。

可选连接池配置：

```text
DB_MIN_IDLE
DB_MAX_POOL_SIZE
DB_CONNECTION_TIMEOUT
DB_IDLE_TIMEOUT
DB_MAX_LIFETIME
```

## 3. 首次初始化

基础角色、初始账号和演示数据默认不会创建。空数据库本地首次启动时，只需临时开启：

```powershell
$env:APP_BOOTSTRAP_ENABLED="true"
```

仓库不提供初始化密码。空库首次初始化时，需同时设置：

```powershell
$env:APP_BOOTSTRAP_ADMIN_PASSWORD="<至少12位的管理员初始密码>"
$env:APP_BOOTSTRAP_TECH_PASSWORD="<至少12位的技术员初始密码>"
$env:APP_BOOTSTRAP_ANALYST_PASSWORD="<至少12位的分析人员初始密码>"
$env:APP_BOOTSTRAP_AUDITOR_PASSWORD="<至少12位的审计人员初始密码>"
```

完成首次启动后立即将 `APP_BOOTSTRAP_ENABLED` 改为 `false` 并移除生产初始化密码变量。这样可避免重启时重置预置角色权限或再次写入演示数据。

## 4. Nginx 部署建议

前端构建：

```bash
cd frontend
npm run build
```

将 `frontend/dist` 发布到 Nginx 静态目录，并把 `/api` 代理到后端：

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:8080/api/;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
}
```

## 5. 上线检查

- 确认初始化开关已关闭，初始化密码变量已移除。
- 设置生产级 `APP_JWT_SECRET`。
- 确认 MySQL 账号最小权限。
- 禁止生产环境暴露异常堆栈。
- 确认审计日志保留策略。
- 确认标签打印机和扫码枪在目标浏览器中可用。

## 6. 后端基础配置

- 统一返回结构由 `ApiResponse<T>` 提供，响应字段为 `code`、`message`、`data`、`timestamp`。
- 全局异常处理覆盖业务异常、参数校验异常、JSON 格式异常、请求方法错误和未知异常。
- 服务端强制使用 UTF-8 响应编码，JSON 时间按 `Asia/Shanghai` 输出。
- 数据库连接使用 HikariCP，连接池大小可通过环境变量调整。
- MyBatis-Plus 已启用分页插件和防全表更新/删除插件。
- JDBC 连接串中的 `characterEncoding` 保持为 `utf8`，表结构字符集使用 `utf8mb4`，避免 MySQL JDBC 驱动把 `utf8mb4` 当作 Java 字符集解析失败。

## 7. 本地联调端口说明

本次联调时 8080 已被占用，后端临时使用 8081：

```powershell
$env:SERVER_PORT="8081"
java -jar target/tag-management-backend-1.0.3.jar
```

前端 Vite 自动切到 5175，启动前通过 `VITE_API_BASE` 指向后端：

```powershell
$env:VITE_API_BASE="http://localhost:8081"
npm run dev
```

后端本地 CORS 默认允许 `http://localhost:*` 和 `http://127.0.0.1:*`，用于适配 Vite 自动换端口。生产环境应收紧为正式域名。
