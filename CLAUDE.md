# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

个人知识库网站（"小鱼知识库"），基于 **VuePress 2**（`2.0.0-rc.30`，Vue 3 + Vite 8）的静态文档站。笔记内容全部是中文，按"主题 → 子主题 → 编号 Markdown 文件"组织，定位为技术知识沉淀与系统化学习路线（前端、Java、Python、Linux、LangChain）。部署到 GitHub Pages，仓库名为 `my_notes`。

## Commands

```bash
npm run docs:dev      # 本地开发服务器（Vite 热更新）
npm run docs:build    # 构建静态站点到 docs/.vuepress/dist
```

- 无独立的 lint / test 命令。
- **要求 Node >= 22.18**（VuePress 2 rc.30 + Vite 8 的最低要求）。本机使用 Node 22 LTS。
- 依赖全部为 ESM（`package.json` 中 `"type": "module"`），`.js` 配置/脚本一律用 ESM 语法（`import`/`export default`），不能用 `require`/`module.exports`，也没有 `__dirname`（用 `fileURLToPath(import.meta.url)`）。

## Architecture

### 内容组织（docs/notes/）

笔记是纯 Markdown，按目录结构组织，例如 `docs/notes/前端开发/js/01-工具函数.md`。文件用数字前缀（`01-`、`02-`…）控制排序。

**侧边栏由 `config.js` 的 `collections` 数组驱动**：每个 doc 集合对应 `docs/notes/` 下一个内容目录，`sidebar: 'auto'` 让主题按目录层级递归生成侧边栏（目录名=分组标题，`X.Y-`/`01.` 数字前缀决定排序）。因此：

- 在既有集合目录下新增 Markdown 文件，侧边栏自动收录，**无需改动 config.js**。
- 若要新增一个顶层内容区（如新的学习路线），需在 config.js 的 `collections` 里加一条 `{ type: 'doc', dir, linkPrefix, title, sidebar: 'auto' }`，并同步 `navbar` 与首页 `docs/README.md`。
- `autoFrontmatter: { permalink: 'filepath' }` 会在构建时自动为缺失 `title`/`createTime`/`permalink` 的页面写入 frontmatter（拼音 slug URL）；手动设置的 frontmatter 不会被覆盖。

### 配置与主题（docs/.vuepress/）

- `config.js` — 站点主配置（ESM `export default`）。注意 `base: '/my_notes/'` 必须与 GitHub Pages 的仓库名保持一致。
- 主题为 **vuepress-theme-plume**（`theme: plumeTheme({...})`），不是 VuePress 1 的 `defaultTheme`。导航由 `navbar` 数组定义；侧边栏由 `collections` 数组定义（doc 集合 + `sidebar: 'auto'`，按目录递归生成）。`autoFrontmatter: { permalink: 'filepath' }` 自动写入拼音 slug 形式的 permalink。
- 首页 `docs/README.md` 使用 plume 的 home 布局：frontmatter 里 `config:` 数组（`hero` / `features` / `text-image` / `image-text` / `custom` 块）。
- `client.ts` — 导入全局样式 `styles/index.scss`（赛博朋克视觉定制）。
- `public/` — 静态资源（logo、品牌 SVG 图标），以 `/` 开头的 URL 引用。
- v2 构建会生成 `docs/.vuepress/.cache/`、`.temp/`、`dist/`，均已在 `.gitignore` 中忽略。

### 部署（.github/workflows/node.js.yml）

push 到 `main` 分支时触发：`npm ci` → `npm run docs:build` → 用 `peaceiris/actions-gh-pages` 将 `docs/.vuepress/dist` 发布到 GitHub Pages。CI 使用 Node 22.x。

### 历史说明

- 笔记已从旧目录（`docs/notes/javascript`、`typescript`、`vuejs` 等）迁移到 `docs/notes/前端开发/` 下的 `css`/`js`/`ts` 子目录，旧目录已删除。
- 2026-08-15：从外部仓库迁移了 4 套学习路线（`JAVA学习路线` / `Linux学习路线` / `LangChain学习路线` / `Python学习路线`）到 `docs/notes/`，每套含 `README.md` 总览 + 各阶段目录（阶段目录下有 `README.md` 索引页）。导航栏每个路线一个下拉，侧边栏由对应 collection 的 `sidebar: 'auto'` 生成。
- 与 VuePress 1 的差异：v2/plume 的侧边栏默认不显示页面内 h2/h3 子标题（旧版曾通过自定义 SidebarLink.vue 实现"仅激活页显示子标题"），当前接受默认行为。
