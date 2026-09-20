# OpenEduTools 统计 Worker

OpenEduTools 的匿名使用统计后端，运行在 **Cloudflare Workers + Cloudflare D1** 上。

它只接收下面这种请求，并按 **UTC 日期 × 工具** 聚合计数：

```json
{ "tool_id": "random-group", "event": "tool_use" }
```

不保存原始事件、IP、账号、输入内容、文件名、学生数据或任何可识别信息。

> Analytics is optional; tools are not. 统计服务故障不得影响任何工具使用。

## 已部署资源

| 项目 | 值 |
| --- | --- |
| Worker URL | `https://openedutools-stats.openedutools.workers.dev` |
| D1 数据库 | `openedutools-stats`（region WNAM） |
| D1 binding | `DB` |
| `database_id` | `0c58da74-8638-468d-b264-7ef6bf4ca2f6` |
| workers.dev 子域名 | `openedutools` |
| 允许来源 | `https://xingyezn.github.io` |

`ADMIN_TOKEN` 已作为 Worker Secret 设置，本地副本在 `worker/.dev.vars`（已被 git 忽略）。Phase B 配置 GitHub Actions 时，需要把同一个值写入仓库 Secret `STATS_API_TOKEN`，并把上面的 Worker URL 写入 `STATS_API_URL`。

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/event` | 记录一次匿名事件，成功返回 `204` |
| `GET` | `/admin/export` | 导出聚合数据，需要 `Authorization: Bearer <ADMIN_TOKEN>` |
| `OPTIONS` | 任意 | CORS 预检 |

允许的事件：`tool_open`、`tool_use`、`favorite_add`、`favorite_remove`、`share`。

`tool_id` 必须匹配 `^[a-z0-9][a-z0-9-]{1,63}$`，与 `tools/<tool-id>/tool.json` 的 `id` 一致。

## 数据表

见 [`schema.sql`](./schema.sql)：`tool_daily_stats(date, tool_id, opens, uses, favorite_adds, favorite_removes, shares)`。

即使有 500 个工具，一年也只有约 18 万行，数据库规模很小。

## 本地开发

```bash
cd worker
npm install
npm run db:local        # 在本地 D1 建表
npm run dev             # 启动 http://127.0.0.1:8787
```

另开终端验证：

```bash
curl -i -X POST http://127.0.0.1:8787/event \
  -H "Content-Type: application/json" \
  -d "{\"tool_id\":\"random-group\",\"event\":\"tool_use\"}"
```

`/admin/export` 需要本地密钥。复制 `.dev.vars.example` 为 `.dev.vars`（该文件已被 git 忽略）：

```text
ADMIN_TOKEN=dev-token
```

```bash
curl -s http://127.0.0.1:8787/admin/export -H "Authorization: Bearer dev-token"
```

运行单元测试：

```bash
npm test
```

## 部署到 Cloudflare

1. 登录并创建 D1 数据库：

   ```bash
   npx wrangler login
   npx wrangler d1 create openedutools-stats
   ```

2. 把输出的 `database_id` 填入 [`wrangler.jsonc`](./wrangler.jsonc) 的 `d1_databases[0].database_id`。

3. 建表：

   ```bash
   npm run db:remote
   ```

4. 设置管理员令牌（不要写进仓库）：

   ```bash
   npx wrangler secret put ADMIN_TOKEN
   ```

5. 按需修改 `wrangler.jsonc` 的 `ALLOWED_ORIGINS`（逗号分隔，只保留正式站点；本地调试可加 `http://localhost:8000`）。

6. 部署：

   ```bash
   npm run deploy
   ```

7. 记录部署得到的 `https://<name>.<subdomain>.workers.dev` 地址，Phase B 会把它写入 `js/analytics.js`。

## 安全边界

- `tool_id` 正则校验、事件白名单、`Content-Type` 校验、请求体上限（1 KB）。
- CORS 只放行 `ALLOWED_ORIGINS` 中的来源，不使用 `Access-Control-Allow-Origin: *`。
- `/admin/export` 使用恒定时间比较 Bearer Token。
- 不创建 `raw_events`、`users`、`sessions` 等表，不做用户追踪。
