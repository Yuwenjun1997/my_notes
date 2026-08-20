import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { viteBundler } from '@vuepress/bundler-vite'
import { defineUserConfig } from 'vuepress'
import { plumeTheme } from 'vuepress-theme-plume'

// plugin-vue 编译 SFC 时解析 defineProps<ImportedType>() 需要文件系统访问，
// 但当前 @vitejs/plugin-vue 不会自动传入，这里补一个 node:fs 适配器
const sfcFs = {
  fileExists: (file) => existsSync(file),
  readFile: (file) => {
    try {
      return readFileSync(file, 'utf-8')
    }
    catch {
      return undefined
    }
  },
  realpath: (file) => {
    try {
      return realpathSync(file)
    }
    catch {
      return file
    }
  },
}

export default defineUserConfig({
  lang: 'zh-CN',
  base: '/my_notes/',
  title: '小鱼知识库',
  description: '技术知识沉淀与参考文档',
  hostname: 'https://yuwenjun1997.github.io',
  head: [['link', { rel: 'icon', href: '/my_notes/cyberpunk/logo-fish.svg' }]],
  bundler: viteBundler({
    vuePluginOptions: { script: { fs: sfcFs } },
  }),
  theme: plumeTheme({
    logo: '/cyberpunk/logo-fish.svg',
    appearance: 'dark',
    navbar: [
      {
        text: '前端开发',
        items: [
          { text: '前端学习路线总览', link: '/notes/前端学习路线/' },
          { text: '第一阶段 · 网页基础', link: '/notes/前端学习路线/第一阶段-网页基础/' },
          { text: '第二阶段 · JavaScript核心', link: '/notes/前端学习路线/第二阶段-JavaScript核心/' },
          { text: '第三阶段 · TypeScript', link: '/notes/前端学习路线/第三阶段-TypeScript/' },
          { text: '第四阶段 · 工程化与实战', link: '/notes/前端学习路线/第四阶段-工程化与实战/' },
          { text: '第五阶段 · 可视化编辑器与低代码技术', link: '/notes/前端学习路线/第五阶段-可视化编辑器与低代码技术/' },
        ],
      },
      {
        text: 'Java开发',
        items: [
          { text: 'Java 学习路线总览', link: '/notes/JAVA学习路线/' },
          { text: '第一阶段 · 核心基础', link: '/notes/JAVA学习路线/第一阶段-核心基础/' },
          { text: '第二阶段 · 主流框架', link: '/notes/JAVA学习路线/第二阶段-主流框架/' },
          { text: '第三阶段 · 进阶能力', link: '/notes/JAVA学习路线/第三阶段-进阶能力/' },
          { text: '第四阶段 · 分布式与系统设计', link: '/notes/JAVA学习路线/第四阶段-分布式与系统设计/' },
          { text: '深度学习', link: '/notes/JAVA学习路线/深度学习/' },
        ],
      },
      {
        text: 'Python开发',
        items: [
          { text: 'Python开发总览', link: '/notes/Python学习路线/' },
          { text: '第一阶段 · Python基础', link: '/notes/Python学习路线/第一阶段-Python基础/' },
          { text: '第二阶段 · Web开发', link: '/notes/Python学习路线/第二阶段-Web开发/' },
          { text: '第三阶段 · 进阶能力', link: '/notes/Python学习路线/第三阶段-进阶能力/' },
          { text: '第四阶段 · 分布式与部署', link: '/notes/Python学习路线/第四阶段-分布式与部署/' },
          { text: '深度学习', link: '/notes/Python学习路线/深度学习/' },
        ],
      },
      {
        text: 'LangChain框架',
        items: [
          { text: 'LangChain总览', link: '/notes/LangChain学习路线/' },
          { text: '第一阶段 · LangChain基础', link: '/notes/LangChain学习路线/第一阶段-LangChain基础/' },
          { text: '第二阶段 · LangGraph编排', link: '/notes/LangChain学习路线/第二阶段-LangGraph编排/' },
          { text: '第三阶段 · Deep-Agents深入', link: '/notes/LangChain学习路线/第三阶段-Deep-Agents深入/' },
          { text: '第四阶段 · 工程化与实战', link: '/notes/LangChain学习路线/第四阶段-工程化与实战/' },
        ],
      },
      {
        text: '数据库',
        items: [
          { text: '数据库总览', link: '/notes/数据库知识库/' },
          { text: '第一阶段 · MySQL核心', link: '/notes/数据库知识库/第一阶段-MySQL核心/' },
          { text: '第二阶段 · PostgreSQL核心', link: '/notes/数据库知识库/第二阶段-PostgreSQL核心/' },
          { text: '第三阶段 · 实战与对比', link: '/notes/数据库知识库/第三阶段-实战与对比/' },
        ],
      },
      {
        text: 'Linux操作',
        items: [
          { text: 'Linux总览', link: '/notes/Linux学习路线/' },
          { text: '第一阶段 · Linux基础入门', link: '/notes/Linux学习路线/第一阶段-Linux基础入门/' },
          { text: '第二阶段 · Shell与常用命令', link: '/notes/Linux学习路线/第二阶段-Shell与常用命令/' },
          { text: '第三阶段 · 系统管理进阶', link: '/notes/Linux学习路线/第三阶段-系统管理进阶/' },
          { text: '第四阶段 · 运维实战与脚本', link: '/notes/Linux学习路线/第四阶段-运维实战与脚本/' },
        ],
      },
    ],
    collections: [
      {
        type: 'doc',
        dir: 'notes/前端学习路线',
        linkPrefix: '/notes/前端学习路线/',
        title: '前端开发',
        sidebar: 'auto',
      },
      {
        type: 'doc',
        dir: 'notes/JAVA学习路线',
        linkPrefix: '/notes/JAVA学习路线/',
        title: 'Java开发',
        sidebar: 'auto',
      },
      {
        type: 'doc',
        dir: 'notes/Python学习路线',
        linkPrefix: '/notes/Python学习路线/',
        title: 'Python开发',
        sidebar: 'auto',
      },
      {
        type: 'doc',
        dir: 'notes/LangChain学习路线',
        linkPrefix: '/notes/LangChain学习路线/',
        title: 'LangChain框架',
        sidebar: 'auto',
      },
      {
        type: 'doc',
        dir: 'notes/数据库知识库',
        linkPrefix: '/notes/数据库知识库/',
        title: '数据库',
        sidebar: 'auto',
      },
      {
        type: 'doc',
        dir: 'notes/Linux学习路线',
        linkPrefix: '/notes/Linux学习路线/',
        title: 'Linux操作',
        sidebar: 'auto',
      },
    ],
    autoFrontmatter: { permalink: 'filepath' },
    search: true,
    markdown: { mermaid: true, echarts: true, chartjs: true, image: true },
    codeHighlighter: { lineNumbers: true },
    llmstxt: true,
    footer: { message: 'MIT Licensed | Copyright © 2021-present Mr.Yu' },
  }),
})
