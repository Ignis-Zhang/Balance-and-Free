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

前端默认通过 `/api` 访问后端。生产环境由 Nginx 将 `/api` 代理到 Node.js 服务。

## 生产部署

```bash
npm run build
npm run server:build
scp -P 683 -r dist/. root@服务器:/var/www/work-life-balance/dist/
```

服务器上的 Node.js API 应使用 `systemd` 或 PM2 常驻运行。数据库凭据、JWT_SECRET 和其他 `.env` 内容不能提交到 GitHub。

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
