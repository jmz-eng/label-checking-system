# 接口设计文档

## 1. 通用约定

基础路径：

```text
/api
```

统一响应：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {},
  "timestamp": "2026-07-07 00:38:31"
}
```

字段说明：

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` | number | 业务状态码。成功为 `200`，常见错误包括 `400`、`401`、`403`、`404`、`409`、`500` |
| `message` | string | 面向用户的提示信息 |
| `data` | object / array / null | 实际业务数据，失败时通常为 `null` |
| `timestamp` | string | 服务端响应时间，时区为 `Asia/Shanghai` |

后端统一使用 `ApiResponse<T>` 返回数据，业务异常、参数校验异常、JSON 格式错误、请求方法错误和未处理异常都由全局异常处理器转换为上述结构。

认证请求头：

```text
Authorization: Bearer <token>
```

## 2. 登录认证

### 2.1 登录

```http
POST /api/auth/login
```

请求：

```json
{
  "username": "admin",
  "password": "<管理员配置的登录密码>"
}
```

响应：

```json
{
  "token": "xxx",
  "user": {
    "id": 1,
    "username": "admin",
    "realName": "系统管理员",
    "permissions": ["*"]
  }
}
```

### 2.2 当前用户

```http
GET /api/auth/me
```

## 3. 项目管理

### 3.1 项目列表

```http
GET /api/projects?keyword=SN26007
```

权限：`project:view`

### 3.2 新增项目

```http
POST /api/projects
```

权限：`project:create`

请求：

```json
{
  "projectCode": "SN26007PK02",
  "projectName": "PK 采血项目",
  "testArticle": "供试品 A",
  "sponsor": "客户 A"
}
```

## 4. 采样任务

### 4.1 任务列表

```http
GET /api/sample-tasks?projectId=1&status=PRINTED&keyword=312-11
```

权限：`sample:view`

### 4.2 批量生成任务

```http
POST /api/sample-tasks/generate
```

权限：`sample:generate`

请求：

```json
{
  "projectId": 1,
  "rows": [
    {
      "animalNo": "312-11-PK",
      "groupNo": "312",
      "gender": "M",
      "sampleType": "PK",
      "timePoint": "D1-96h",
      "plannedCollectDate": "2026-06-09",
      "tubeNo": "A01"
    }
  ]
}
```

响应：返回生成后的任务和 `labelCode`。

## 5. 扫码工作台

### 5.1 贴标绑定

```http
POST /api/scan/bind
```

权限：`sample:bind`

请求：

```json
{
  "labelCode": "TM-SN26007PK02-31211PK-D196H-0001",
  "animalNo": "312-11-PK"
}
```

### 5.2 操作核对

```http
POST /api/scan/verify
```

权限：`sample:verify`

请求：

```json
{
  "labelCode": "TM-SN26007PK02-31211PK-D196H-0001",
  "projectCode": "SN26007PK02",
  "animalNo": "312-11-PK",
  "timePoint": "D1-96h"
}
```

响应：

```json
{
  "passed": true,
  "message": "核对通过，可以继续操作",
  "taskStatus": "VERIFIED"
}
```

失败响应示例：

```json
{
  "passed": false,
  "message": "时间点不一致，期望 D1-96h，实际 D1-24h",
  "taskStatus": "BOUND"
}
```

### 5.3 录入确认

```http
POST /api/scan/record
```

权限：`sample:record`

请求：

```json
{
  "labelCode": "TM-SN26007PK02-31211PK-D196H-0001",
  "resultNote": "分析端已接收"
}
```

## 6. 追溯查询

### 6.1 扫码记录

```http
GET /api/scan-records?labelCode=TM-SN26007
```

权限：`record:view`

### 6.2 审计日志

```http
GET /api/audit-logs?keyword=VERIFY
```

权限：`audit:view`

## 7. 健康检查

```http
GET /api/health
```

不需要登录。

## 8. 动态菜单

### 8.1 当前用户路由菜单

```http
GET /api/menus/routes
```

需要登录。后端根据当前用户权限过滤菜单，前端使用该接口生成动态路由和侧边栏菜单。

## 9. 工作台统计

### 9.1 工作台指标

```http
GET /api/workbench/summary
```

响应字段：

| 字段 | 说明 |
|---|---|
| `totalTasks` | 采样任务总数 |
| `checkedTasks` | 已执行核对的次数 |
| `passedTasks` | 核对通过次数 |
| `failedRecords` | 异常拦截记录数 |
| `pendingTasks` | 待处理任务数 |
| `traceRecords` | 追溯记录总数 |
| `checkedRate` | 已核对比例 |
| `passedRate` | 核对通过比例 |
| `exceptionRate` | 异常拦截比例 |
| `pendingRate` | 待处理比例 |

## 10. 系统管理

### 10.1 菜单管理

```http
GET /api/system/menus
POST /api/system/menus
PUT /api/system/menus/{id}
```

权限：`menu:view`、`menu:create`、`menu:update`

### 10.2 权限管理

```http
GET /api/system/permissions?keyword=project
POST /api/system/permissions
GET /api/system/roles
POST /api/system/roles
PUT /api/system/roles/{id}/permissions
```

权限：`permission:view`、`permission:manage`、`role:view`、`role:manage`

### 10.3 日志管理

```http
GET /api/system/logs?keyword=VERIFY
```

权限：`log:view`

### 10.4 公告管理

```http
GET /api/notices
GET /api/system/notices?keyword=上线
POST /api/system/notices
PUT /api/system/notices/{id}
POST /api/system/notices/{id}/publish
```

公开公告列表 `GET /api/notices` 需要登录但不限制管理权限；后台公告管理接口需要 `notice:view`、`notice:create`、`notice:update`、`notice:publish`。

### 10.5 用户管理

```http
GET /api/system/users?keyword=张三
POST /api/system/users
PUT /api/system/users/{id}
PUT /api/system/users/{id}/password
```

权限：`user:view`、`user:create`、`user:update`、`user:reset-password`

新增用户请求：

```json
{
  "username": "operator01",
  "password": "StrongPassword123!",
  "realName": "操作员一",
  "department": "实验技术部",
  "status": "ENABLED",
  "roleIds": [2]
}
```

编辑用户不允许修改用户名和密码，只维护姓名、部门、状态和角色。重置密码使用独立请求：

```json
{
  "newPassword": "NewPassword123!"
}
```
