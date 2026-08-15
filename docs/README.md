---
pageLayout: home
title: 小鱼开发笔记
description: 小鱼开发笔记 —— 日常开发中使用的技术及参考，赛博朋克风格个人笔记站点
config:
  -
    type: hero
    full: true
    effect: lightning
    forceDark: true
    effectConfig:
      hue: 180
      speed: 1
      intensity: 0.8
    hero:
      name: 小鱼开发笔记
      tagline: 大鱼吃小鱼
      text: "日常开发中使用的技术及参考\n前端 · Java · Python · Linux · LangChain"
      actions:
        -
          theme: brand
          text: 马上开始
          link: /notes/前端开发/js/
        -
          theme: alt
          text: Java 学习路线
          link: /notes/JAVA学习路线/
        -
          theme: alt
          text: GitHub
          icon: logos:github-icon
          link: https://github.com/Yuwenjun1997
          target: _blank
  -
    type: features
    title: 内容分类
    description: 前端开发的三大阵地，以及本站内置的实用能力
    features:
      -
        title: CSS
        icon: logos:css-3
        details: 常用样式类与技巧，文本溢出省略、布局、响应式等
        link: /notes/前端开发/css/
      -
        title: JavaScript
        icon: logos:javascript
        details: 工具函数、数组操作、图片上传预览、二维码生成、Excel 表格解析等
        link: /notes/前端开发/js/
      -
        title: TypeScript
        icon: logos:typescript-icon
        details: 编译、类型基础、接口、类、泛型、枚举、函数知识点等
        link: /notes/前端开发/ts/
      -
        title: 图表可视化
        icon: 📊
        details: 笔记内置 ECharts、Chart.js、Mermaid 图表能力
      -
        title: 全文搜索
        icon: 🔍
        details: 本地搜索，快速检索全部笔记内容
      -
        title: 赛博暗色
        icon: 🌃
        details: 默认暗色风格，支持一键切换明暗主题
  -
    type: features
    title: 学习路线
    description: 从零到进阶的系统化学习路线，每个路线按阶段编排，侧边栏自动生成
    features:
      -
        title: Java 后端学习路线
        icon: logos:java
        details: 核心基础 → 主流框架 → 进阶能力 → 分布式系统设计，以及并发/JVM/微服务等深度学习方向
        link: /notes/JAVA学习路线/
      -
        title: Python 全栈学习路线
        icon: logos:python
        details: Python 基础 → Web 开发 → 进阶能力 → 分布式与部署，以及爬虫/异步/DevOps 等方向
        link: /notes/Python学习路线/
      -
        title: Linux 系统学习路线
        icon: logos:linux-tux
        details: 基础入门 → Shell 常用命令 → 系统管理进阶 → 运维实战与脚本（Ubuntu）
        link: /notes/Linux学习路线/
      -
        title: LangChain 生态学习路线
        icon: simple-icons:langchain
        details: LangChain → LangGraph → Deep Agents，从核心抽象到可工程化的 AI Agent 实战
        link: /notes/LangChain学习路线/
  -
    type: text-image
    title: CSS 笔记
    image: /cyberpunk/css.svg
    width: 160
    description: 日常开发中常用到的样式类与技巧，覆盖布局、文本、响应式等场景。<br><a href="./notes/前端开发/css/">查看全部 CSS 笔记 →</a>
    list:
      -
        title: '<a href="./notes/前端开发/css/chang-yong-yang-shi/">常用样式</a>'
        description: 文本溢出省略、多行截断、常用工具样式类
  -
    type: image-text
    title: JavaScript 笔记
    image: /cyberpunk/js.svg
    width: 160
    description: 日常开发工具函数与交互技巧，从数组到图片上传、Excel 解析。<br><a href="./notes/前端开发/js/">查看全部 JS 笔记 →</a>
    list:
      -
        title: '<a href="./notes/前端开发/js/gong-ju-han-shu/">工具函数</a>'
        description: 随机 ID 等日常开发工具函数
      -
        title: '<a href="./notes/前端开发/js/java-script-shu-zu/">JavaScript 数组</a>'
        description: 数组常用方法整理与技巧
      -
        title: '<a href="./notes/前端开发/js/shang-chuan-tu-pian-ji-yu-lan/">上传图片及预览</a>'
        description: 图片上传、本地预览与回显
      -
        title: '<a href="./notes/前端开发/js/sheng-cheng-er-wei-ma/">生成二维码</a>'
        description: 使用 qrcode 生成二维码
  -
    type: text-image
    title: TypeScript 笔记
    image: /cyberpunk/ts.svg
    width: 160
    description: 从编译入门到类型系统进阶，系统梳理 TS 核心知识点。<br><a href="./notes/前端开发/ts/">查看全部 TS 笔记 →</a>
    list:
      -
        title: '<a href="./notes/前端开发/ts/lei-xing-ji-chu/">类型基础</a>'
        description: 基础类型、类型推断与类型断言
      -
        title: '<a href="./notes/前端开发/ts/jie-kou/">接口</a>'
        description: interface 的声明与合并
      -
        title: '<a href="./notes/前端开发/ts/lei/">类</a>'
        description: 类的语法、继承与修饰符
      -
        title: '<a href="./notes/前端开发/ts/fan-xing/">泛型</a>'
        description: 泛型函数、泛型类与泛型约束
  -
    type: text-image
    title: Java 学习路线
    image: /cyberpunk/java.svg
    width: 160
    description: 系统化的 Java 后端学习指南，从核心基础到分布式系统设计，并附并发/JVM/微服务等深度学习方向。<br><a href="./notes/JAVA学习路线/">查看全部 Java 学习路线 →</a>
    list:
      -
        title: '<a href="./notes/JAVA学习路线/第一阶段-核心基础/">第一阶段 · 核心基础</a>'
        description: 构建工具、数据库基础、网络与 HTTP
      -
        title: '<a href="./notes/JAVA学习路线/第二阶段-主流框架/">第二阶段 · 主流框架</a>'
        description: Spring 全家桶、ORM 框架
      -
        title: '<a href="./notes/JAVA学习路线/第三阶段-进阶能力/">第三阶段 · 进阶能力</a>'
        description: 缓存、消息队列、安全、定时任务
      -
        title: '<a href="./notes/JAVA学习路线/第四阶段-分布式与系统设计/">第四阶段 · 分布式与系统设计</a>'
        description: 微服务架构、可观测性、数据库进阶
      -
        title: '<a href="./notes/JAVA学习路线/深度学习/">深度学习</a>'
        description: 并发编程、Spring Cloud Alibaba、电商实战、运维、架构
  -
    type: image-text
    title: Python 学习路线
    image: /cyberpunk/python.svg
    width: 160
    description: 通用全栈 Python 学习指南，覆盖 Web 后端 + 数据/爬虫 + 自动化/部署 三大方向。<br><a href="./notes/Python学习路线/">查看全部 Python 学习路线 →</a>
    list:
      -
        title: '<a href="./notes/Python学习路线/第一阶段-Python基础/">第一阶段 · Python基础</a>'
        description: 环境搭建、语法核心、函数与 OOP、标准库、虚拟环境
      -
        title: '<a href="./notes/Python学习路线/第二阶段-Web开发/">第二阶段 · Web开发</a>'
        description: 网络异步、FastAPI、Django、ORM、API 设计
      -
        title: '<a href="./notes/Python学习路线/第三阶段-进阶能力/">第三阶段 · 进阶能力</a>'
        description: 并发异步、Redis、任务队列、pytest、安全认证、爬虫
      -
        title: '<a href="./notes/Python学习路线/第四阶段-分布式与部署/">第四阶段 · 分布式与部署</a>'
        description: 微服务与 MQ、Docker 部署、可观测性、性能优化
  -
    type: text-image
    title: Linux 学习路线
    image: /cyberpunk/linux-tux.svg
    width: 160
    description: 面向后端开发者的 Linux 系统化学习指南，聚焦 Ubuntu，从入门到运维实战。<br><a href="./notes/Linux学习路线/">查看全部 Linux 学习路线 →</a>
    list:
      -
        title: '<a href="./notes/Linux学习路线/第一阶段-Linux基础入门/">第一阶段 · Linux基础入门</a>'
        description: 概述发行版、安装配置、文件系统、用户权限
      -
        title: '<a href="./notes/Linux学习路线/第二阶段-Shell与常用命令/">第二阶段 · Shell与常用命令</a>'
        description: Shell 基础、文件操作、文本处理、进程、包管理
      -
        title: '<a href="./notes/Linux学习路线/第三阶段-系统管理进阶/">第三阶段 · 系统管理进阶</a>'
        description: 磁盘、网络、systemd、日志、定时任务
      -
        title: '<a href="./notes/Linux学习路线/第四阶段-运维实战与脚本/">第四阶段 · 运维实战与脚本</a>'
        description: Shell 脚本、安全加固、故障排查、Docker 基础
  -
    type: image-text
    title: LangChain 学习路线
    image: /cyberpunk/langchain.svg
    width: 160
    description: 面向初学者的 LangChain 生态学习指南，从核心抽象到可工程化的 AI Agent 实战。<br><a href="./notes/LangChain学习路线/">查看全部 LangChain 学习路线 →</a>
    list:
      -
        title: '<a href="./notes/LangChain学习路线/第一阶段-LangChain基础/">第一阶段 · LangChain基础</a>'
        description: 生态总览、核心抽象与 RAG、Agent 入门
      -
        title: '<a href="./notes/LangChain学习路线/第二阶段-LangGraph编排/">第二阶段 · LangGraph编排</a>'
        description: 状态图入门、持久化与人类审批
      -
        title: '<a href="./notes/LangChain学习路线/第三阶段-Deep-Agents深入/">第三阶段 · Deep-Agents深入</a>'
        description: 核心概念、文件系统、子代理 Skills、安全实践
      -
        title: '<a href="./notes/LangChain学习路线/第四阶段-工程化与实战/">第四阶段 · 工程化与实战</a>'
        description: LangSmith 可观测性、构建个人 AI 助手
  -
    type: custom
---

## 关于本站

这里是「小鱼开发笔记」——一个记录日常开发中使用的技术与参考的赛博朋克风格个人笔记站点。

**本站技术栈**：VuePress 2 · vuepress-theme-plume · Vite · TypeScript

### 快速导航

- [CSS 笔记](/notes/前端开发/css/)
- [JavaScript 笔记](/notes/前端开发/js/)
- [TypeScript 笔记](/notes/前端开发/ts/)
- [Java 学习路线](/notes/JAVA学习路线/)
- [Python 学习路线](/notes/Python学习路线/)
- [Linux 学习路线](/notes/Linux学习路线/)
- [LangChain 学习路线](/notes/LangChain学习路线/)
- [GitHub](https://github.com/Yuwenjun1997)

### 更新记录

- 2026-08-15：首页升级为赛博朋克风格
- 2026-08-15：迁移 Java / Linux / LangChain / Python 学习路线
