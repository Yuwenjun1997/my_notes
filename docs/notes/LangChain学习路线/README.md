---
title: LangChain 学习路线
permalink: /notes/LangChain学习路线/
createTime: 2026/08/15 17:33:35
---

# 🤖 LangChain 生态学习路线（LangChain · LangGraph · Deep Agents）

> 一份面向初学者的 LangChain 生态学习指南，涵盖 **LangChain → LangGraph → Deep Agents** 三个核心库 + LangSmith 观测平台，从基础概念到可工程化的 AI Agent 实战。**重点深入 Deep Agents** —— 它是官方推荐的"开箱即用" Agent 开发框架。
>
> 本路线参考 [LangChain 官方文档](https://docs.langchain.com) 编写，所有概念都用通俗类比解释，力求"看得懂、分得清、用得会"。

---

## 📋 目录索引

- [第一阶段：LangChain 基础](#-第一阶段langchain-基础)
- [第二阶段：LangGraph 编排](#-第二阶段langgraph-编排)
- [第三阶段：Deep Agents 深入（重点）](#-第三阶段deep-agents-深入重点)
- [第四阶段：工程化与实战](#-第四阶段工程化与实战)
- [三大库关系速览（通俗版）](#-三大库关系速览通俗版)
- [学习路线总览](#-学习路线总览)

---

## 📘 第一阶段：LangChain 基础

> **学习周期**：1-2 周 | **每日建议**：2-3 小时
> **目标**：理解三大库的定位与层级关系，掌握 LangChain 的核心抽象（模型 / 提示词 / 工具 / 检索），能写出带工具的简单 Agent，为后面两个库打好地基。

| 模块 | 核心内容 | 文档 |
|:-----|:---------|:----:|
| **1.1 生态总览与三大库关系** | LangChain 生态全景、LangChain/LangGraph/Deep Agents 通俗类比、层级关系图、官方文档怎么读、技术选型决策、环境安装 | [📖 查看](./第一阶段-LangChain基础/1.1-生态总览与三大库关系.md) |
| **1.2 LangChain 核心抽象与 RAG** | ChatModel 模型调用、ChatPromptTemplate 提示词、`@tool` 工具装饰器、Retriever 检索、RAG 完整管线（加载→切分→向量化→检索→生成） | [📖 查看](./第一阶段-LangChain基础/1.2-LangChain核心抽象与RAG.md) |
| **1.3 LangChain Agent 入门** | Agent 工作原理（ReAct：思考→行动→观察）、`create_agent` 用法、Chain 与 Agent 的区别、Agent 的局限与升级信号 | [📖 查看](./第一阶段-LangChain基础/1.3-LangChain-Agent入门.md) |

---

## ⚙️ 第二阶段：LangGraph 编排

> **学习周期**：1-2 周 | **每日建议**：2-3 小时
> **目标**：理解 LangGraph 是"控制流运行时"，掌握 StateGraph（状态图）、节点 / 边 / 条件分支，以及持久化（checkpointer）和人类审批（human-in-the-loop）两个关键能力。

| 模块 | 核心内容 | 文档 |
|:-----|:---------|:----:|
| **2.1 LangGraph 状态图入门** | 为什么需要 LangGraph、核心概念（State/Node/Edge/条件边）、StateGraph 最小示例、条件分支示例、LangGraph vs LangChain Agent 对比 | [📖 查看](./第二阶段-LangGraph编排/2.1-LangGraph状态图入门.md) |
| **2.2 持久化与人类审批** | 为什么 Agent 需要记忆、Checkpointer 与 Thread 概念、跨轮对话保活、interrupt 中断与人类审批（human-in-the-loop）、和 Deep Agents 的分工 | [📖 查看](./第二阶段-LangGraph编排/2.2-持久化与人类审批.md) |

---

## 🧠 第三阶段：Deep Agents 深入（重点）

> **学习周期**：2-3 周 | **每日建议**：2-3 小时
> **目标**：Deep Agents 是本路线**最核心**的一层。掌握 `create_deep_agent` 一键创建全能 Agent，并吃透它的六大内置能力：任务规划、文件系统、子代理、记忆、Skills、人类审批。学完本阶段，你就能独立开发复杂的多步 Agent 应用。

| 模块 | 核心内容 | 文档 |
|:-----|:---------|:----:|
| **3.1 Deep Agents 核心概念** | 什么是"Agent 装载机（harness）"、`create_deep_agent` 快速上手、六大内置能力总览、它和 LangGraph/LangChain 的关系、什么时候该用 Deep Agents | [📖 查看](./第三阶段-Deep-Agents深入/3.1-Deep-Agents核心概念.md) |
| **3.2 文件系统与上下文管理** | 为什么 Agent 需要文件系统、内置文件工具（ls/read_file/write_file/edit_file/glob/grep）、FilesystemBackend（root_dir / virtual_mode）、Filesystem 与 Store 两种后端选型 | [📖 查看](./第三阶段-Deep-Agents深入/3.2-文件系统与上下文管理.md) |
| **3.3 子代理、Skills 与记忆** | SubAgent 子代理与 `task` 工具、Skills 按需加载（SKILL.md 格式）、thread 短时记忆 vs Store 长时记忆、三者组合的完整示例 | [📖 查看](./第三阶段-Deep-Agents深入/3.3-子代理Skills与记忆.md) |
| **3.4 人类审批与安全实践** | `interrupt_on` 审批配置、interrupt 必须配 checkpointer、StoreBackend 必须配 store、thread_id 保持对话、常见坑与安全最佳实践 | [📖 查看](./第三阶段-Deep-Agents深入/3.4-人类审批与安全实践.md) |

---

## 🚀 第四阶段：工程化与实战

> **学习周期**：1-2 周 | **每日建议**：2-3 小时
> **目标**：学会用 LangSmith 做可观测性与评估，把前三阶段的能力串成一个完整的实战项目，具备"从 0 到 1 交付一个 AI 助手"的能力。

| 模块 | 核心内容 | 文档 |
|:-----|:---------|:----:|
| **4.1 LangSmith 可观测性与评估** | 为什么 Agent 需要被"监控"、LangSmith 三大能力（Tracing 追踪 / Evaluation 评估 / Dataset 数据集）、环境变量配置、评估入门 | [📖 查看](./第四阶段-工程化与实战/4.1-LangSmith可观测性与评估.md) |
| **4.2 实战项目：构建个人 AI 助手** | 用 Deep Agents 从 0 搭建一个会规划、能读写文件、可调用子代理的 AI 助手，含架构设计、目录结构、分步实现与扩展方向 | [📖 查看](./第四阶段-工程化与实战/4.2-实战项目-构建个人AI助手.md) |

---

## 🧩 三大库关系速览（通俗版）

一句话记住它们：

> **LangChain 是"零件库"，LangGraph 是"流水线"，Deep Agents 是"整装全能的员工"，LangSmith 是"监控摄像头"。**

| 库 | 一句话定位 | 通俗类比 | 官方术语 | 你主要用它解决什么 |
|:-----|:----------|:---------|:---------|:-------------------|
| **LangChain** | 模型、工具、提示词的抽象层（Framework） | 零件库 / 工具箱：提供"轮子、发动机、导航"这些通用零件 | 框架（Framework） | 怎么连模型、怎么调工具、怎么写提示词 |
| **LangGraph** | 复杂控制流的运行时（Runtime） | 流水线 / 流程图：决定零件按什么顺序、什么条件组装 | 运行时（Runtime） | 流程有分支、循环、需要持久化、需要人审批 |
| **Deep Agents** | 开箱即用的 Agent 装载机（Harness） | 整装员工：自带规划、办公文件、下属、记忆，拿来就能干活 | 装载机（Harness） | 不想自己搭流程，想要一个"全能 Agent" |
| **LangSmith** | 可观测性与评估平台 | 监控摄像头 / 绩效看板：全程录像 + 打分 | 可观测性（Observability） | 看 Agent 每一步干了啥、评估它干得好不好 |

> 💡 **重点**：Deep Agents **不需要**你手动画图写边——它把 LangGraph 的能力"内置"了。反过来，当流程简单到只需要一个固定工具的 Agent 时，用最底层的 LangChain 就够了。**层级越往上越省事，但控制力越低。**

```
        ┌──────────────────────────────┐
        │   Deep Agents（最省事）        │  ← 规划/文件/子代理/记忆/Skills 全内置
        ├──────────────────────────────┤
        │   LangGraph（运行时）          │  ← 状态图/分支/持久化/审批
        ├──────────────────────────────┤
        │   LangChain（框架）            │  ← 模型/工具/提示词/检索
        └──────────────────────────────┘
                         ↑ 上层依赖下层，但上层"替你写好了"下层
   LangSmith（横切一切层）：全程观测与评估
```

---

## 📐 学习路线总览

```
第一阶段：LangChain 基础（1-2周）
    │  生态总览 → 核心抽象(RAG) → Agent入门
    ▼
第二阶段：LangGraph 编排（1-2周）
    │  状态图入门 → 持久化与人类审批
    ▼
第三阶段：Deep Agents 深入·重点（2-3周）
    │  核心概念 → 文件系统 → 子代理/Skills/记忆 → 人类审批
    ▼
第四阶段：工程化与实战（1-2周）
    LangSmith观测 → 实战项目：个人AI助手
```

### 💡 学习建议

1. **先横向、再纵向**：第一阶段把三个库都"认识一遍"，第三阶段再对 Deep Agents 深挖——先有地图，再放大细节。
2. **官方文档优先**：所有模块都以 [docs.langchain.com](https://docs.langchain.com) 为准（OSS 部分按 Python/JavaScript 分两套树，学习时只跟 Python 一套走）。本仓库内容只是"导航 + 通俗翻译"，API 细节请对照官方文档验证。
3. **代码必须亲手跑**：每个模块末尾都有「实践项目」，一定要在本地环境执行。建议用 VS Code + Python 3.10+，配好虚拟环境。
4. **记住三个 `create_*`**：`create_agent`（LangChain）→ `StateGraph.compile()`（LangGraph）→ `create_deep_agent`（Deep Agents），三个入口就是三把钥匙。
5. **养成加 LangSmith 的习惯**：从第一阶段起就配置好 `LANGSMITH_*` 环境变量，能看到每一步的完整调用链，排错效率翻倍。
6. **别背 API**：生态迭代很快（官方文档也会频繁更新），重点理解"概念"，API 用时再查官方文档。
7. **对比着学**：每学一个新库，就对照上一层的表格（如 LangGraph vs LangChain Agent、Deep Agents vs LangGraph），想清楚"为什么官方要多做这一层"。

### 🔧 推荐资源

| 类别 | 资源 | 说明 |
|:-----|:-----|:-----|
| 官方文档 | [docs.langchain.com](https://docs.langchain.com) | 唯一权威来源，OSS + LangSmith 两大分区 |
| LangChain 概述 | `/oss/python/langchain/overview` | 框架入门页 |
| LangGraph 概述 | `/oss/python/langgraph/overview` | 运行时入门页 |
| Deep Agents 概述 | `/oss/python/deepagents/overview` | **重点**：装载机入门页 |
| LangSmith | `/langsmith/home` | 观测与评估平台 |
| 官方教程 | LangChain 各库自带 Quickstart | 每个库的"五分钟上手" |
| 社区 | 官方 GitHub / 文档评论区 | 看 examples 目录学习最佳实践 |

---

<!-- 最后更新时间：2026-08-12 -->
