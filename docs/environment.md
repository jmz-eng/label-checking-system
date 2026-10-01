# 本地环境记录

## 基础环境

| 项目 | 当前值 |
|---|---|
| 操作系统 | Microsoft Windows NT 10.0.19045.0 |
| Node.js | v24.3.0 |
| npm | 11.4.2 |
| Java | 17.0.8 LTS |
| Maven | 3.8.4 |
| Python | 3.12.3 |
| pip | 25.2 |
| Git | 2.47.1.windows.1 |
| MySQL | 8.0.46 |

## 项目端口

| 服务 | 端口 | 说明 |
|---|---:|---|
| 后端 API | 8080 | Spring Boot 服务 |
| 前端页面 | 5173 | Vite 开发服务 |
| MySQL | 3306 | 本地数据库服务 |

## 本地环境变量

后端 `application.yml` 保留非敏感默认配置；原工作区凭据已移至 Git 忽略的 `backend/application-private.yml`，从 `backend` 工作目录自动导入。新克隆项目需自行设置密码、JWT 密钥；生产环境使用同名环境变量或服务器私有配置。

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DB_HOST` | `localhost` | MySQL 地址 |
| `DB_PORT` | `3306` | MySQL 端口 |
| `DB_NAME` | `tag_management` | 数据库名 |
| `DB_USER` | `root` | 数据库用户 |
| `DB_PASSWORD` | 无公开默认值 | MySQL 密码，需自行配置 |
| `APP_JWT_SECRET` | 无公开默认值 | 登录令牌签名密钥，长度至少 32 位，需自行配置 |
| `APP_TOKEN_EXPIRE_HOURS` | `12` | 登录令牌有效期，单位为小时 |
| `SERVER_PORT` | `8080` | 后端启动端口 |
| `APP_CORS_ALLOWED_ORIGIN_PATTERNS` | `http://localhost:*,http://127.0.0.1:*` | 本地前端跨域白名单 |
| `APP_BOOTSTRAP_ENABLED` | `false` | 是否初始化基础角色、账号和演示数据，仅首次部署使用 |
| `APP_BOOTSTRAP_ADMIN_PASSWORD` | 空 | 初始化管理员密码，开启初始化时必须设置 |
| `APP_BOOTSTRAP_TECH_PASSWORD` | 空 | 初始化技术员密码，开启初始化时必须设置 |
| `APP_BOOTSTRAP_ANALYST_PASSWORD` | 空 | 初始化分析人员密码，开启初始化时必须设置 |
| `APP_BOOTSTRAP_AUDITOR_PASSWORD` | 空 | 初始化审计人员密码，开启初始化时必须设置 |

## 本地启动前检查

在 `F:\桌面\Tag Management` 执行：

```bash
node -v
npm -v
java -version
python --version
pip --version
git --version
mysql --version
mvn -v
```

## 备注

- 非敏感配置集中于 `application.yml`；密码和 JWT 密钥使用环境变量或 Git 忽略的私有配置，不随源码上传。
- `.env`、日志文件、构建产物必须加入 `.gitignore`。
- 后端启动时会自动创建数据库表，前提是数据库账号具备建库建表权限。
- 基础角色、初始账号和演示数据默认不写入；仅首次部署时临时开启 `APP_BOOTSTRAP_ENABLED`。
