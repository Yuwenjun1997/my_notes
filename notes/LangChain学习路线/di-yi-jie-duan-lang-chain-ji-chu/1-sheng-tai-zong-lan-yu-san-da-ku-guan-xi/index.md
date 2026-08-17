---
url: >-
  /my_notes/notes/LangChain学习路线/di-yi-jie-duan-lang-chain-ji-chu/1-sheng-tai-zong-lan-yu-san-da-ku-guan-xi/index.md
---
# LangChain 生态总览与三大库关系

> 这一节是整个路线的"地图"。学任何技术之前，先回答三个问题：**生态里有什么？它们是什么关系？我该用哪个？** 本文用大白话把 LangChain / LangGraph / Deep Agents 讲清楚，并教你怎么读官方文档。

## 一、LangChain 生态是什么

### 1.1 一个公司，四个开源产品

LangChain 不只是一个库，而是一家公司（LangChain, Inc.）维护的一套 **AI Agent 开发工具链**，从上到下分四层：

| 产品 | 官方定位 | 一句话理解 |
|:-----|:---------|:-----------|
| **Deep Agents** | Agent Harness（装载机） | 开箱即用的"全能 Agent"，规划、文件、子代理、记忆全部内置 |
| **LangGraph** | Agent Runtime（运行时） | 让你精确控制"流程怎么走"的运行时，支持分支、循环、持久化 |
| **LangChain** | Agent Framework（框架） | 提供模型、工具、提示词、检索这些最基础的"零件" |
| **LangSmith** | Observability 平台 | 全程"录像 + 打分"，属于横切每一层的观测平台 |

> 📖 官方文档把 Deep Agents 称为 **top layer**、LangGraph 称为 **middle layer**、LangChain 称为 **bottom layer**，LangSmith 是 **cross-cutting（横切）**。记住这四个英文词，看官方文档时不会迷路。

### 1.2 为什么官方要"拆"成这么多层？

一句话：**每一层解决一种规模的问题。**

* 只调一次模型 → 不需要任何框架，直接写代码。
* 想"模型 + 一个工具"自动干活 → 用 **LangChain** 就够了。
* 流程有分支、要循环、要断点续跑 → 用 **LangGraph** 精雕细琢。
* 想要一个长期干活、能管文件、能找帮手的"员工" → 用 **Deep Agents**，它把前两层的能力打包好了。

就像盖房子：地基（LangChain）→ 主体结构（LangGraph）→ 拎包入住（Deep Agents）。

***

## 二、三大库通俗类比

### 2.1 类比一：零件库 / 流水线 / 整装员工

| 库 | 类比 | 展开 |
|:---|:-----|:-----|
| **LangChain** | 一个**零件库** | 里面有"模型接口、工具接口、提示词模板、检索器"这些通用零件，你要什么自己取、自己拼 |
| **LangGraph** | 一条**流水线** | 决定零件"按什么顺序、满足什么条件"组装，还能在某个环节暂停、等人工确认后再继续 |
| **Deep Agents** | 一名**整装全能员工** | 不用你自己画流水线——它自带"工作计划本、办公室文件柜、一群可调用的下属、长期记忆"，你只需要给任务 |

> 💡 类比到 **员工入职**：
>
> * LangChain = 员工手册（教模型怎么用工具）
> * LangGraph = 部门流程（规定每个任务怎么流转）
> * Deep Agents = 一个自带 SOP 的全能新员工，领了任务自己列计划、查资料、动手干、还能找同事（子代理）帮忙。

### 2.2 类比二：做饭

```text
LangChain      = 菜谱 + 食材清单        → 告诉你"用什么、怎么配"
LangGraph      = 厨房动线              → 规定"先切菜再炒菜、菜可以并行做、菜咸了要重做"
Deep Agents    = 一个全能主厨           → 自己定菜单、自己去仓库取食材、自己把控火候、忙不过来就叫帮厨
```

### 2.3 层级关系图

官方文档给出的依赖方向：**高层依赖低层，但用高层时你不需要碰低层。**

```text
        ┌─────────────────────────────────────────────┐
        │           Deep Agents（最省事，最全能）         │
        │      规划 │ 文件 │ 子代理 │ 记忆 │ Skills │ 审批  │
        ├─────────────────────────────────────────────┤
        │              LangGraph（运行时）               │
        │        状态图 │ 分支循环 │ 持久化 │ 人类审批       │
        ├─────────────────────────────────────────────┤
        │               LangChain（框架）                │
        │        模型 │ 工具 │ 提示词 │ 检索 │ 简单Agent   │
        └─────────────────────────────────────────────┘
                           ↑ 上层"内置并替您写好"下层

   LangSmith（横切一切层）：对每一层的调用做全程可观测与评估
```

***

## 三、三大库对比表（官方术语 → 大白话）

| 对比维度 | LangChain | LangGraph | Deep Agents |
|:---------|:----------|:----------|:------------|
| **官方定位** | Framework（框架） | Runtime（运行时） | Harness（装载机） |
| **大白话** | 零件库，提供模型/工具/提示词 | 流程图引擎，管流程怎么走 | 全能 Agent 成品，拿来就能干 |
| **核心入口** | `create_agent()` | `StateGraph(State)` → `compile()` | `create_deep_agent()` |
| **你会写什么** | 定义模型、工具、提示词 | 定义状态、节点、边 | 一句"创建"，剩下交给框架 |
| **擅长** | 单目标、固定工具的 Agent；RAG | 复杂控制流、持久化、人工审批 | 长任务规划、文件管理、子代理、长期记忆 |
| **不擅长** | 复杂流程、跨会话状态 | 你想要开箱即用的规划/文件/子代理 | 需要精确手控每一条图边的场景 |
| **是否自带规划/文件/子代理** | ❌ 无 | ❌ 无 | ✅ 全部内置 |
| **典型代码量** | 十几行 | 几十行 | 几行 |

> ⚠️ 注意：这三者不是"三选一"，而是**层层叠加**。同一个项目里，可以用 Deep Agents 当总指挥，再让它调用一个 LangGraph 写的确定性子流程——官方称之为 **mixing layers（混层）**。

### 3.1 混层（Mixing Layers）的常见姿势

| 组合方式 | 使用场景 |
|:---------|:---------|
| Deep Agents 总指挥 → 把 LangGraph 图注册为子代理 | 主任务需要规划与记忆，但某一步必须是确定性的图（如固定的 RAG 反思流程） |
| LangGraph 图 → 包装成工具/子代理 | 一个专业管线（如评估循环）被更大的 Agent 调用 |
| LangChain 工具/检索器 → 在 LangGraph 节点和 Deep Agents 工具里复用 | 零件是最通用的，到处都能用 |

***

## 四、官方文档怎么读

### 4.1 文档结构

官方文档统一在 **docs.langchain.com**，分两大区：

| 分区 | 内容 | 语言 |
|:-----|:-----|:-----|
| **OSS**（开源库） | LangChain、LangGraph、Deep Agents | Python 与 JavaScript 两套并行：`/oss/python/` 和 `/oss/javascript/` |
| **LangSmith** | 观测、评估、部署、提示词工程 | 无语言区分 |

> 💡 学的时候**只跟 Python 一套走**（`/oss/python/`），不要两个语言来回跳，会混淆。

### 4.2 每个库的页面树

每个产品都是同一套结构，看懂一个就全通了：

```text
overview（概述） → quickstart（五分钟上手） → how-to guides（How-to 专题） → reference（API 参考）
```

### 4.3 四个规范落地页（收藏它们）

| 库 | 官方落地页 |
|:---|:-----------|
| LangChain | `docs.langchain.com/oss/python/langchain/overview` |
| LangGraph | `docs.langchain.com/oss/python/langgraph/overview` |
| Deep Agents | `docs.langchain.com/oss/python/deepagents/overview` |
| LangSmith | `docs.langchain.com/langsmith/home` |

### 4.4 阅读技巧

1. **先 overview，再 quickstart**：每个新库都先看概览页搞清"它解决什么问题"，再跑 quickstart 拿到体感。
2. **查 API 用 reference**：具体某个函数怎么传参，看 reference，不要背。
3. **关注版本**：这些库迭代很快，本地 `pip show 包名` 看版本，别拿旧教程硬套新 API。
4. **代码块以官方为准**：本仓库代码是"教学简化版"，跑不通时回官方 quickstart 对照。

***

## 五、技术选型决策表

官方文档按下面顺序判断，命中哪条就用哪层：

| 判断顺序 | 你的需求 | 该用哪层 |
|:---------|:---------|:---------|
| 1 | 需要**规划、跨会话文件管理、子代理委派、长期记忆、按需加载 Skills** | **Deep Agents** |
| 2 | 需要**自定义控制流**（确定性循环、分支、并行） | **LangGraph** |
| 3 | **单目标 Agent**，固定一套工具就够 | **LangChain**（`create_agent`） |
| 4 | 只是**纯模型调用 / 检索管线 / 简单提示词链**，不需要 Agent 循环 | **LangChain**（直接用模型/链） |

> 🔑 记不住没关系，只需记住一条主判据：**"我需要的功能 Deep Agents 内置了吗？"** —— 内置了就用它；只是流程特殊才降级到 LangGraph；简单到只有模型+工具才用纯 LangChain。

***

## 六、环境准备与安装

### 6.1 安装核心包

```bash
# Python 3.10+
pip install langchain langgraph deepagents
```

按需追加（用哪个装哪个）：

```bash
pip install langchain-anthropic          # Anthropic 模型接入
pip install langchain-openai             # OpenAI 模型接入
pip install langchain-chroma             # Chroma 向量库（RAG 用）
pip install langchain-text-splitters     # 文本切分（RAG 用）
```

### 6.2 配置环境变量

模型密钥 + LangSmith（从第一阶段起就配上，后面排错全靠它）：

```bash
# 模型密钥（用哪个配哪个）
export ANTHROPIC_API_KEY="sk-..."
# export OPENAI_API_KEY="sk-..."

# LangSmith 可观测性（官方要求用这几个名字，旧名字已失效）
export LANGSMITH_API_KEY="lsv2_..."
export LANGSMITH_TRACING="true"
export LANGSMITH_PROJECT="my-first-agent"
```

> 💡 Windows 用户把 `export` 换成 `set`，或者直接写进 `.env` 文件用 `dotenv` 加载。

### 6.3 验证安装

```bash
python -c "import langchain, langgraph, deepagents; print('ok')"
```

***

## 📝 实践项目

### 目标

跑通 Deep Agents 官方 Quickstart，建立"一个深 Agent 长什么样"的体感，并确认三个库能正常导入。

### 步骤

1. **创建虚拟环境并安装**
   ```bash
   python -m venv .venv
   # Windows: .venv\Scripts\activate   Linux/Mac: source .venv/bin/activate
   pip install langchain langgraph deepagents langchain-anthropic
   ```

2. **配置环境变量**（见上文 6.2）

3. **写一个最简 Deep Agent**
   ```python
   from deepagents import create_deep_agent

   agent = create_deep_agent(
       model="claude-sonnet-4-5-20250929",
       system_prompt="你是一个乐于助人的助手",
   )

   config = {"configurable": {"thread_id": "session-1"}}
   result = agent.invoke(
       {"messages": [{"role": "user", "content": "你好！"}]},
       config=config,
   )
   print(result["messages"][-1].content)
   ```

4. **运行并观察**
   ```bash
   python first_agent.py
   ```

5. **打开 LangSmith**：登录 LangSmith 后台，找到 `my-first-agent` 项目，观察这一次调用的完整调用链（模型调用、工具调用、耗时）。

> 🧠 **思考题**：为什么 Deep Agents 里我没有写任何"规划/文件/记忆"的代码，它却能直接运行？—— 答案在下一阶段的 3.1 节（Harness 概念）。
