# 实验核对 API（2026-10-05）

后端前缀 `/api/experiments`。沿用 `Authorization: Bearer <token>` 和现有登录接口。
除下载外，响应为 `{"code":200,"message":"操作成功","data":...,"timestamp":"服务器时间"}`。
业务拒绝使用 HTTP 400/403/404/409；**扫码不匹配使用 HTTP 200，必须检查 `data.state` 和 `data.lastResult.result`，200 不代表核对通过。**

## 公共约定

- `projectId`/路径 `{p}` 是现有 `project_info.id`，JSON number。其余新实体 `id` 为32位随机字符串。
- 所有 JSON POST 必须包含 `requestId: string`，1–128字符。推荐每个真实操作生成 UUID；网络重试使用相同 requestId 和完全相同内容。相同账号重复请求返回最初保存的响应，不增加记录；同 requestId 换内容或接口返回409。需改变确认/纠错内容时产生新 requestId。
- 上传预览用 multipart 文本字段 requestId。失败事务不保留幂等结果；已提交的 FAIL、ABORT、REJECTED 均保留幂等结果。
- 日期 `collectDate` 为 `yyyy-MM-dd`；时间戳 `createdAt`、`expiresAt` 为 ISO-8601 UTC。动物号/芯片号/时间点均为字符串，保留前导零。扫码 `content` 原文完整归档，匹配时只去除首尾空白。
- 列表直接返回数组；当前版本不分页。筛选走查询参数，采用精确匹配；`keyword` 在归档 JSON 中查找子串。不要发送 page/pageSize 等未定义参数。
- 服务端产生标签码、条形码、人员、结果、版本和时间。客户端传入的 actor/result/state/code/barcode 不构成写入依据。
- 只有请求确实保存成功后才能展示 PASS；网络失败展示“结果未确认”，用同 requestId 重试并读取会话。

## 实验、分组、用途

| 方法与相对路径 | 权限 | 请求/结果 |
|---|---|---|
| GET `/` | project:view | Experiment[] |
| POST `/` | project:create | `{requestId,projectCode,projectName}` → Experiment |
| GET `/{p}` | project:view | Experiment |
| GET `/{p}/mappings` | project:view | Mapping[]，含已停用行 |
| POST `/{p}/mappings` | sample:generate | `{requestId,animalNo,chipNo}` → Mapping |
| POST `/{p}/mappings/{id}` | sample:generate | `{requestId,animalNo,chipNo,reason}` → Mapping |
| POST `/{p}/mappings/{id}/delete` | sample:generate | `{requestId,reason}` → 停用后的 Mapping |
| GET `/{p}/mappings/{id}/history` | audit:view | Event[]，before/after保留原关系 |
| GET `/{p}/purposes` | project:view | Purpose[]，含关键词与停用状态 |
| POST `/{p}/purposes` | sample:generate | `{requestId,name,collectionKeywords:string[],aliquotKeywords:string[],confirmed:true}` → Purpose |
| POST `/{p}/purposes/{id}` | sample:generate | 同新增，另须 reason；新版本完整替换关键词 |
| POST `/{p}/purposes/{id}/delete` | sample:generate | `{requestId,reason}` → 停用后的 Purpose |

```ts
interface Experiment { id:number; projectCode:string; projectName:string; status:string }
interface Mapping { id:string; projectId:number; animalNo:string; chipNo:string;
  active:boolean; version:number; createdAt:string }
interface Purpose { id:string; projectId:number; name:string; collectionKeywords:string[];
  aliquotKeywords:string[]; confirmed:boolean; active:boolean; version:number; createdAt:string }
```

新增实验只需编号和名称，旧 `test_article` 自动存为空字符串。分组保证同实验内有效动物/芯片分别唯一；删除为停用，新关系不会改写旧扫码快照。用途关键词只是导入建议；用途定义和导入确认都需要明确确认，不能静默推断。采血/分装使用相同 purposeId 表示允许配对的一组用途；两类关键词可完全不同。

## 管子、独立标签码与条形码、打印请求

| 方法与相对路径 | 权限 | 请求/结果 |
|---|---|---|
| GET `/{p}/tubes` | project:view | Tube[]；可筛选 kind/status/animalNo/collectDate/timePoint/purposeId/sourceTubeId/printed/keyword |
| GET `/{p}/tubes/{id}` | project:view | Tube |
| POST `/{p}/tubes` | sample:generate | TubeCreate → Tube |
| POST `/{p}/tubes/{id}` | sample:generate | `{requestId,reason,...需要更正的TubeCreate字段}` → 新Tube |
| POST `/{p}/tubes/{id}/reissue` | sample:generate | `{requestId,reason,...可选更正字段}` → 新Tube |
| POST `/{p}/tubes/{id}/void` | sample:generate | `{requestId,reason}` → 原Tube(status=VOID) |
| POST `/{p}/tube-assignments` | sample:generate | `{requestId,reason,confirmed:true,assignments:[{tubeId,purposeId,sourceTubeId?}]}` → `{tubes:Tube[]}` |
| POST `/{p}/print-requests` | label:view | `{requestId,tubeIds:string[]}` → PrintRequest |
| GET `/{p}/print-requests` | label:view | PrintRequest[]（包括补打记录） |

```ts
type Kind = 'COLLECTION' | 'ALIQUOT';
interface TubeCreate {
  requestId:string; kind:Kind; animalNo:string; timePoint:string;
  labelInfo:string; collectDate:string; purposeId?:string; confirmed?:boolean;
  sourceTubeId?:string; expiresAt?:string;
}
interface Tube {
  id:string; projectId:number; projectCode:string; kind:Kind;
  animalNo:string; timePoint:string; labelInfo:string; collectDate:string;
  purposeId?:string; confirmed:boolean; sourceTubeId:string;
  code:string; // E + 22位URL-safe标识，共23字符；保留旧二维码身份，继续接受扫码
  barcode:string; // 数据库登记的固定12位数字别名；当前标签用CODE128 C编码此字符串
  status:'ACTIVE'|'VOID'; printed:boolean; version:number; replacesId:string;
  createdAt:string; expiresAt?:string; voidReason?:string;
  importId?:string; sourceSheet?:string; sourceRow?:number;
}
interface PrintRequest {
  id:string; projectId:number; actorId:number; createdAt:string;
  status:'REQUEST_ACKNOWLEDGED'; tubes:Tube[];
}
```

管子所有内容更正均生成新 id/code/barcode，旧管作废并保留历史；**未打印管也采用此保守规则**。补打同一管再次调用 print-requests，使用新 requestId，code/barcode不变。printed表示已登记打印请求，不表示打印机实际完成。barcode前导零必须保留。旧事件及打印快照不补写barcode；没有该字段的历史打印快照不能用于新条码打印，应从当前管子新建打印请求。

未指定用途可暂存 confirmed=false 的待归类管，不能打印或核对。指定用途须confirmed=true。分装管未给 sourceTubeId 时，仅在同实验/动物/日期/时间点/用途的有效采血管恰好一支时自动配对；否则来源留空、禁止打印/核对，需 bulk assignments 或单管更正明确选择。一个来源可对应多支分装管。明确指定来源仍会校验全部条件。过期、作废、停用用途或失效来源禁止使用。批量操作上限1000条，原子提交。

打印UI使用完整五项内容；本API不裁切 labelInfo，不代替25×10mm打印排版或实体设备验证。

## Excel预览、确认、原件

| 方法与相对路径 | 权限 | 请求/结果 |
|---|---|---|
| GET `/templates/{kind}` | sample:generate | xlsx文件；kind=GROUP/COLLECTION/ALIQUOT |
| POST `/{p}/imports/preview` | sample:generate | multipart: `file`二进制、`kind`文本、`requestId`文本 → ImportBatch |
| GET `/{p}/imports` | sample:generate | ImportBatch[] |
| GET `/{p}/imports/{id}` | sample:generate | ImportBatch |
| POST `/{p}/imports/{id}/commit` | sample:generate | ImportCommit → ImportBatch |
| GET `/{p}/imports/{id}/original` | sample:generate | 原始上传字节；Content-Disposition提供原文件名 |

```ts
interface ImportIssue {sheet:string; row:number; column:string; message:string}
interface ImportRow {
  rowKey:string; sourceSheet:string; sourceRow:number; projectId:number; projectCode:string;
  animalNo:string; chipNo?:string; timePoint?:string; labelInfo?:string; collectDate?:string;
  kind?:Kind; suggestedPurposeId?:string; requiresConfirmation?:boolean;
}
interface ImportBatch {
  id:string; projectId:number; kind:'GROUP'|Kind; fileName:string; hash:string; size:number;
  createdAt:string; status:'PREVIEW'|'INVALID'|'REJECTED'|'COMMITTED'; duplicate:boolean;
  rows:ImportRow[]; issues:ImportIssue[]; commitIssues?:ImportIssue[];
  entityIds?:string[]; confirmedRows?:ImportRow[];
  duplicateBatches?:{importId:string; fileName:string; status:string}[];
  duplicateRows?:{
    rowKey:string; tubeId:string; importId:string; content:ImportRow;
    sourceSheet?:string; sourceRow?:number; status?:'ACTIVE'|'VOID'; matchingRowKey?:string;
  }[];
  duplicateRowsLimit?:number; // 当前10000，达到上限时列表可能未穷尽

}
interface ImportCommit {
  requestId:string; confirmed:true; acknowledgeDuplicate?:boolean;
  assignments?:{rowKey:string; purposeId:string; sourceTubeId?:string}[];
}
```

- GROUP严格三列及顺序：`试验编号,动物号,芯片号`。
- COLLECTION/ALIQUOT严格五列及顺序：`试验编号,动物号,时间点,管标信息,采样日期`。
- 真正支持 xls/xlsx，原文件完整存数据库。上限8MB、20张表、总10000条数据。全空行不算数据；非空行不会静默跳过。公式/Excel错误单元格不接受；长数字、科学计数或非整数标识给单元格错误，建议文本格式。日期支持真实Excel日期或严格yyyy-MM-dd文本。
- issues非空禁止提交，修正附件后重新预览。REJECTED表示确认/关系问题，无任何行已导入；在同批次上补充assignments，用新requestId重试。
- suggestedPurposeId是建议，只有confirmed=true的最终提交才确认它；空建议行必须用assignments显式指定。同元组多个采血管必须显式给分装行sourceTubeId。
- duplicate按当前实验文件SHA-256检测（包括其他未提交预览，排除自身）；duplicateBatches列出匹配批次。duplicateRows按同管类型及五个原始字段精确比较，提示已存在管子（含作废历史）及本附件内相同行；重新保存Excel或换文件名仍会命中内容警告。tubeId/importId为空表示本附件另一行或手工创建管子，matchingRowKey指本附件被匹配行；content保留本行五项信息。最多返回10000条候选，不是完整去重清单。
- commit在项目行锁内重新检查上述两类重复；任一命中且未acknowledgeDuplicate=true均返回HTTP409，零行插入。预览时无重复也可能在提交时发现新重复。客户端收到此409后调用GET批次详情取得最新duplicate/duplicateBatches/duplicateRows，展示实际候选，请用户明确确认追加，再以新requestId和acknowledgeDuplicate=true提交。普通confirmed=true只确认用途/配对，不能代替重复追加确认。GET详情会即时计算未提交批次的重复情况；列表为保存时快照。
- 明确确认后合法相同内容的每一行均生成独立管子，不自动合并、覆盖或丢弃。分组重复动物/芯片仍是错误，更正使用映射编辑，不冒充追加。
- 预览与提交共用字段长度限制：试验编号/动物号64，芯片号128，时间点/管标信息2000字符。超长预览为INVALID并标明sheet/row/column；旧批次提交时再次校验，发现问题返回REJECTED和commitIssues，不插入部分数据。
- 同批次成功提交后再次用原requestId取得原结果；新requestId重提已成功批次返回409。

## 服务端会话与两阶段核对

以下接口首先要求project:view，并在服务端按stage额外验证 COLLECTION=sample:verify / ALIQUOT=sample:record。会话只属于当前账号，访问/操作其他账号会话返回403，管理员也不能冒充操作员。

| 方法与相对路径 | 请求/结果 |
|---|---|
| GET `/sessions/current` | 当前账号唯一未替代会话（含ABORTED），或 `{}` |
| POST `/{p}/sessions` | `{requestId,stage,collectDate,timePoint,purposeId}` → Session |
| GET `/sessions/{id}` | Session，刷新后恢复服务端状态 |
| POST `/sessions/{id}/chip` | `{requestId,content}` → Session |
| POST `/sessions/{id}/tube` | `{requestId,content}` → Session |
| POST `/sessions/{id}/next` | `{requestId,retainSource?:boolean}` → Session |
| POST `/sessions/{id}/exception-close` | `{requestId,remark,confirmed:true}` → Session |

```ts
interface Session {
  id:string; projectId:number; ownerId:number; stage:Kind;
  collectDate:string; timePoint:string; purposeId:string; purposeSnapshot:Purpose;
  round:number; state:'IN_PROGRESS'|'FAILED'|'PASSED'|'ABORTED'|'SUPERSEDED';
  pending:'CHIP'|'COLLECTION_TUBE'|'SOURCE_TUBE'|'ALIQUOT_TUBE'|'NONE';
  animalNo?:string; chipContent?:string; mappingSnapshot?:Mapping;
  sourceTubeId?:string; sourceSnapshot?:Tube; targetTubeId?:string;
  lastResult?:Event; createdAt:string;
}
```

COLLECTION开始后pending=CHIP，识别芯片后pending=COLLECTION_TUBE，再核对当前选择的日期/时间点/用途/实际动物。ALIQUOT开始后pending=SOURCE_TUBE，只有该**具体来源管id**已有COLLECTION PASS才能进入ALIQUOT_TUBE。分装管还须sourceTubeId精确一致，不能只按动物匹配。

FAIL将state保存为FAILED；next和任何实验的新session都被阻断。同动物和预期条件下可重扫纠正；READY仅表示芯片/来源接收成功，不能清除既有FAILED。纠正PASS后允许next。关系版本变更将pending切回CHIP，必须重扫当前动物的最新芯片；旧快照仍在历史。用途规则变更要求异常结束并新选上下文。

exception-close必须非空原因和confirmed=true，保存ABORT，state=ABORTED，绝不产生采血PASS。之后可新session或next。next仅允许PASSED/ABORTED；采血清空动物并强制重新扫芯片。分装retainSource=true保留当前来源用于下一支分装管，否则重新扫描来源。新建会话会将所有非失败旧会话（包括ABORTED）标为SUPERSEDED并留上下文变更记录，旧ABORT证据保留。scan/next/exception-close只能操作当前会话；旧页面对已替代会话操作返回409。任意其他未解决FAILED也会阻断scan/next，不能借旧会话切换动物或上下文。

lastResult在next后保留上一条不可变结果供历史展示；必须结合state/round/pending呈现，不能将上一轮PASS当作新轮成功。

## 核对记录、资料变更与导出

| 方法与相对路径 | 权限 | 结果 |
|---|---|---|
| GET `/{p}/records` | record:view | Event[]，含SCAN/异常关闭及资料更改；用stage/result/action筛选 |
| GET `/{p}/records/{id}` | record:view | Event，使用归档快照，不用当前管/映射替换历史 |
| GET `/{p}/changes` | audit:view | result=CHANGE的Event[] |
| GET `/{p}/changes/{id}` | audit:view | 更改Event详情 |
| GET `/{p}/changes/export` | audit:view | 仅资料更改的CSV，支持相同筛选 |
| GET `/{p}/records/export` | record:view | UTF-8 BOM CSV，应用与列表相同筛选 |

筛选支持 `collectDate,animalNo,timePoint,purposeId,stage,actorId,actorName,result,action,sessionId,entityId,keyword`。空筛选忽略。

```ts
interface Event {
  id:string; projectId:number; projectSnapshot:Experiment;
  action:string; result:'CHANGE'|'READY'|'PASS'|'FAIL'|'ABORT';
  actorId:number; actorName:string; createdAt:string;
  sessionId?:string; round?:number; stage?:Kind;
  collectDate?:string; timePoint?:string; purposeId?:string; animalNo?:string;
  sourceTubeId?:string; targetTubeId?:string; scannedContent?:string; message?:string;
  expected?:Omit<Session,'lastResult'>; actual?:Tube;
  entityId?:string; before?:object; after?:object; reason?:string; remark?:string;
  importId?:string; // 导入事件还可包含hash/fileName/count/issues
}
```

事件追加写入，无更新/删除接口。期望快照含当时用途规则、分组版本、来源管；实际快照含扫描管五项内容、标签码、当前条形码和版本。原扫描内容保留。完整的已登记TUBE条码关键字查询同时关联该管的旧身份记录，保留试验与其他筛选条件，不改写旧归档。CSV包含主要检索列和完整archive JSON，单元格以=、+、-、@或控制字符开头时加单引号并做CSV引号转义。

## 数据库升级与本地测试

1. 备份现有库（尤其原扫描记录），在业务维护窗口以有DDL权限账号运行 `backend/src/main/resources/db/migrations/20261005_experiments.sql`；或启动程序时由现有 `spring.sql.init.data-locations=classpath*:db/migrations/*.sql` 自动执行。
2. 脚本仅CREATE IF NOT EXISTS新exp_*表及插入缺失的experiments菜单，无旧数据转换，无密码/角色重置。即使app.bootstrap-enabled=false也会生效。不要为迁移开启演示初始化。
3. 新表exp_mapping/purpose/tube/session/event/import/print使用项目id和JSON归档payload；exp_mapping有效动物/芯片有数据库唯一约束，exp_tube短码唯一，exp_session有owner索引；exp_request主键(actor_id,request_id)；exp_import_file保存原字节。
4. 管理资料按项目行锁串行；扫码**不锁项目**，只锁本人用户/会话及本次涉及的管、规则和映射。事务提交涵盖状态、事件和幂等响应；FAIL作为数据返回以确保提交。数据库失败不返回PASS。
5. 生产使用MySQL 8；H2仅test依赖。真实集成测试使用H2 MySQL模式，`src/test/resources/legacy-h2-schema.sql`只显式移除旧schema的MySQL引擎/排序规则及重名索引；新迁移原样执行，不跳过SQL。
6. 独立本地H2预览如不运行测试classpath，需外置H2 jar，并覆盖driver/url/schema-locations；旧schema使用上述H2 fixture，data-locations仍使用原迁移目录。预览必须新库和独立端口，不覆盖旧预览或服务器。
7. 启动凭据/令牌密钥继续由环境或application-private.yml提供。新接口复用现有权限；管理员按现有角色管理授权。未验证真实MySQL服务器迁移、实体打印或部署。

运行：`mvn -f backend/pom.xml test`。网络重试/并发测试使用真实HTTP控制器、权限拦截器、事务及H2持久化；没有将新的业务服务替换为mock。

## 事务与并发约定

实验写操作明确使用READ_COMMITTED及独立事务，不继承数据库默认REPEATABLE_READ；requestId检查之后等待项目锁，不会继续使用旧快照。映射、用途、管子、批次的更改均以SELECT FOR UPDATE返回的当前行为输入，管更正保留并发打印登记后的原管快照。

共同锁顺序为账号行 → 管理操作的项目行/扫描的会话行 → 按id排序的全部涉及管子（含来源）→ 按id排序的用途 → 映射。扫描和打印不锁项目行；操作员各自会话独立，同一来源的同时使用通过细粒度行锁串行验证。批量更正预先锁定全部目标/来源，避免与批量打印或来源核对形成反向锁等待。数据管理操作的项目锁保证创建/配对/导入时的映射、用途、来源验证一致。
