---
url: >-
  /my_notes/notes/前端学习路线/di-si-jie-duan-gong-cheng-hua-yu-shi-zhan/1-gou-jian-gong-ju-vite-ru-men/index.md
---
# 构建工具 Vite 入门

开发一个大一点的网页/应用时，代码会被拆成大量模块：需要合并、转换（TS/Sass）、处理兼容、热更新。构建工具负责把这些源头代码编译打包成浏览器可用的产物。**Vite** 是当前最主流的现代构建工具，也是 VuePress 这类工具链的底层引擎。

## 为什么需要构建工具

* **模块化**：ES Module、import 依赖之间的关系需要解析与合并。
* **语法转换**：TypeScript、SCSS、JSX/Vue 单文件组件都要编译为浏览器能运行的 JS/CSS。
* **兼容与优化**：降级语法、压缩体积、拆包按需加载。
* **开发体验**：热更新（改代码页面即时刷新）、错误提示。

## Vite vs Webpack

| 维度 | Vite | Webpack |
|:-----|:-----|:--------|
| 开发模式原理 | 原生 ES Module，按需编译，秒级启动 | 全量打包/bundle，项目大时启动慢 |
| 模块打包 | 生产用 Rollup 打包 | 内置打包 |
| 配置复杂度 | 轻，开箱即用 | 复杂，配置项多 |
| 生态 | 现代框架普遍默认 | 成熟但逐步被 Vite 追赶 |

（仓库 `3.1-编译第一个TS程序` 中有一套较旧的 webpack + TS 配置，属历史方案，可对照参考。）

## 创建项目

```bash
npm create vite@latest my-app
# 按提示选择框架模板：vanilla / vue / react / preact 等，及是否用 TS
cd my-app
npm install
npm run dev
```

`npm run dev` 启动本地开发服务器并打印访问地址，默认在 `http://localhost:5173`。

## 目录结构

```
my-app/
├── index.html          # 入口页面（Vite 以它为起点）
├── package.json
├── vite.config.js      # Vite 配置（可集成插件、代理等）
├── public/             # 静态资源，构建时原样拷贝、URL 直接引用
└── src/
    ├── main.js         # 应用入口，import 并挂载
    ├── App.vue         # 以 Vue 模板为例的根组件
    └── assets/         # 需要经过构建处理的资源（import 方式引入）
```

## 常用命令

| 命令 | 作用 |
|:-----|:-----|
| `npm run dev` | 开发服务器，热更新 |
| `npm run build` | 生产构建，产物输出到 `dist/`（压缩、hash 文件名、代码分割） |
| `npm run preview` | 本地预览构建产物（先 build 再 preview） |

## 集成 TypeScript 与 Sass

按脚手架模板选择 Vite 已内置对应能力：选 TypeScript 模板即支持 `.ts`；安装后 Sass 开箱即用：

```bash
npm install -D sass
```

在 `.vue` 或 `.scss` 中把样式写成 `lang="scss"` 即可使用变量/嵌套/mixin（见 `1.6-CSS常用样式` 的 SCSS 片段）。

## vite.config.js 常见配置

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],          // 插件：编译 .vue 等
  server: {
    proxy: {                 // 开发环境代理，解决跨域
      '/api': 'http://localhost:8080',
    },
  },
  build: {
    outDir: 'dist',          // 输出目录
  },
})
```

## 静态资源与 public

* `public/` 下的文件**不做处理**，直接按路径引用：`<img src="/logo.png">`。
* `src/assets/` 下经 `import imgUrl from './x.png'` 引入的资源会被处理（hash 命名、体积优化）。

## 构建产物简述

`npm run build` 后 `dist/` 里是纯静态文件（html + js/css + 资源）。可用任意静态服务器托管（`npm run preview` 或 nginx 等），也可部署到 GitHub Pages 等平台。本知识库本身就是 VuePress 构建后静态托管，原理相同。

## 下一步

Vite 是框架工程化的基础设施。掌握 Vite 后，可以学习 Vue/React 框架（本路线暂未展开，框架部分留作后续方向），并结合第四阶段的实战技巧（工具函数、上传、二维码等）搭建完整应用。
