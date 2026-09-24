# 平衡工作台

这是一个 React + TypeScript 前端和 Node.js + PostgreSQL 后端组成的工作协作平台。

## 本地开发

```bash
npm install
npm run dev
```

后端需要 PostgreSQL，并复制 `.env.example` 为 `.env` 后填写数据库连接串和 JWT 密钥：

```bash
psql "$DATABASE_URL" -f server/schema.sql
npm run server:dev
```

前端默认通过 `/api` 访问后端，生产环境由 Nginx 将 `/api` 代理到 Node.js 服务。本地开发时 Vite 未配置 `/api` 代理，需要用 `VITE_API_BASE` 指向本地后端：

```bash
VITE_API_BASE=http://localhost:3000/api npm run dev
```

## 生产部署

GitHub 只托管源码，云服务器上只放运行产物（前端静态文件 + 编译后的后端 JS），服务器不需要 `.git`。

### 一键发布（推荐）

```bash
./deploy.sh                   # 构建 → 上传 → 重启 → 自检
./deploy.sh --only backend    # 只改了 server/ 时最快
./deploy.sh --only frontend   # 只改了前端时
./deploy.sh --no-build        # 复用现有 dist/ 与 dist-server/ 产物
./deploy.sh --dry-run         # 只预览将执行的命令
./deploy.sh --help
```

脚本依次完成：

1. 构建 `dist/` 与 `dist-server/index.js`，并**校验后端产物包含 `/api/auth/me`**；
2. 前端上传到 `/var/www/work-life-balance/dist`（先传 `dist-next` 再原子切换，旧版保留为 `dist-prev` 便于回滚）；
3. 后端备份为 `server/index.js.bak-<时间戳>` 后覆盖上传，并做 md5 一致性校验；
4. `systemctl restart work-life-balance-api`；
5. 自检 `/api/health`、`/api/auth/me`（预期 401，若为 404 说明后端版本落后会直接报错中断）以及线上前端产物与本地构建的 md5。

目标机器与路径可用环境变量覆盖：`DEPLOY_HOST`、`DEPLOY_PORT`（默认 683）、`DEPLOY_USER`、`PUBLIC_URL`、`WEB_ROOT`、`API_DIR`、`SERVICE`。

### 服务器现状

| 项 | 值 |
| --- | --- |
| SSH | `ssh -p 683 root@114.214.241.56`（22 端口只在云平台内网，公网映射为 683） |
| 前端 | Nginx 1.24，root `/var/www/work-life-balance/dist`，`/api/` 反代到 `127.0.0.1:3000` |
| 后端 | `/opt/work-life-balance`，systemd 服务 `work-life-balance-api`（`Restart=always`，已 `enable`） |
| 数据库 | 本机 PostgreSQL，库 `worklife`，仅监听 `127.0.0.1:5432` |
| 配置 | `/opt/work-life-balance/.env`：`PORT`、`FRONTEND_ORIGIN`、`DATABASE_URL`、`JWT_SECRET` |

### 手工发布（与脚本等价）

```bash
npm run build && npm run server:build
scp -P 683 -r dist/. root@114.214.241.56:/var/www/work-life-balance/dist/
scp -P 683 dist-server/index.js root@114.214.241.56:/opt/work-life-balance/server/index.js
ssh -p 683 root@114.214.241.56 'systemctl restart work-life-balance-api'
```

> ⚠️ **前端与后端必须一起发布。** 曾经只发前端、后端仍是上一版产物，`/api/auth/me` 返回 404，前端启动时 `getCurrentUser()` 抛错并 `clearToken()`，用户一刷新页面就被强制登出。`deploy.sh` 已把这条校验固化进流程。

> ⚠️ 修改端口、绑定域名或启用 HTTPS 后，要同步更新服务器 `.env` 里的 `FRONTEND_ORIGIN`，否则跨域请求会被 CORS 拒绝。

> ⚠️ 数据库凭据、JWT_SECRET 及任何 `.env` 内容都不能提交到 GitHub。

## 数据与协作

注册后会自动创建个人工作区。日程和待办保存到 PostgreSQL，并按工作区隔离；后续可在 `workspace_members` 表上扩展成员邀请和协作权限。

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
