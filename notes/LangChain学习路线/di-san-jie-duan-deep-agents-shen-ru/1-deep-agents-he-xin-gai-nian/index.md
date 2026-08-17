---
url: >-
  /my_notes/notes/LangChain学习路线/di-san-jie-duan-deep-agents-shen-ru/1-deep-agents-he-xin-gai-nian/index.md
---
# Deep Agents 核心概念

> **本路线最核心的一节。** 前两阶段你学会了"零件"（LangChain）和"画流程图"（LangGraph），但真实任务需要的远不止这些：要规划、要管文件、要派子代理、要长期记忆、要按需加载技能……全部自己写？太累。**Deep Agents 把这些高频能力全打包了。**

## 一、Deep Agents 是什么

### 1.1 官方定位：Agent Harness（装载机）

官方文档对 Deep Agents 的定位是 **top layer（顶层）**，叫 **Agent Harness**。Harness 这个词直译是"马具/背带"——**把马和车拴在一起、让它们协同工作的那套装备**。引申义：**把各种能力"装配"到 Agent 身上的一套框架。**

> 🧠 **大白话**：LangChain 是零件库，LangGraph 是流水线，而 **Deep Agents 是一台"整装全能的机器"**——规划、文件、子代理、记忆、技能、审批六样能力出厂自带，你只需要**配置**，不需要**实现**。

### 1.2 官方给它的定义

> Deep Agents 是构建在 LangChain + LangGraph 之上的、**内置了规划、文件管理、子代理生成、长期记忆**等能力的 Agent 开发框架。它让"复杂 Agent"的开发从"写几十行图代码"降到"几行配置"。

### 1.3 它解决了什么痛点

| 痛点（用 LangGraph 自己搞） | Deep Agents 的做法 |
|:----------------------------|:-------------------|
| 长任务要做任务分解 | 内置 `write_todos` 规划工具 |
| 大上下文要读写文件 | 内置整套文件系统工具 |
| 要派活给专门的小代理 | 内置 `task` 子代理工具 |
| 要跨会话长期记忆 | 内置 Store 存储 |
| 要按需加载领域知识 | 内置 Skills 机制 |
| 危险操作要人工确认 | `interrupt_on` 一行开启 |

***

## 二、核心心智模型：Harness = 配置而非实现

Deep Agents 最反直觉的一点是：**你不再"写逻辑"，而是"做选择"。** 官方把这套"装配机制"称为 **中间件（Middleware）**，每个中间件负责一类内置能力：

| 中间件（官方） | 提供的内置能力 | 默认状态 |
|:--------------|:---------------|:---------|
| `TodoListMiddleware` | 任务规划（`write_todos` 工具） | ✅ 默认开启 |
| `FilesystemMiddleware` | 文件系统（ls/read/write/edit/glob/grep） | ✅ 默认开启 |
| `SubAgentMiddleware` | 子代理委派（`task` 工具） | ✅ 默认开启 |
| `MemoryMiddleware` | 跨会话长期记忆（需配 Store） | 需配置 |
| `SkillsMiddleware` | 按需加载领域技能 | 需配置 |
| `HumanInTheLoopMiddleware` | 人工审批（需配 checkpointer） | 需配置 |

> 💡 **含义解释**：前三个中间件**默认就在**（你 1.1 节创建的最简 Agent 其实已经带了规划 + 文件 + 子代理能力）；后三个需要你"告诉它该用哪个存储/哪里的技能/要不要审批"。**这就是"配置驱动"。**

### 2.1 你不能改什么（官方边界）

Deep Agents 有清晰的"固定边界"——下面这些**不可配置、不可移除、名字固定**：

| 不可变更项 | 原因 |
|:-----------|:-----|
| 核心中间件不可移除（TodoList / Filesystem / SubAgent） | 它们是 Deep Agents 的定义性能力 |
| 工具名固定（`write_todos` / `task` / 文件工具名） | Agent 与框架的契约 |
| SKILL.md 的 frontmatter 格式 | Skills 的加载协议 |

> ✅ **能配置的**：模型、额外自定义工具、系统提示词、后端存储策略、审批规则、自定义子代理、Skills 目录。

***

## 三、`create_deep_agent` 快速上手

### 3.1 最小可用版

```python
from deepagents import create_deep_agent

agent = create_deep_agent(
    model="claude-sonnet-4-5-20250929",   # 模型（必填）
    system_prompt="你是一个项目助理，帮我管理学习资料。",  # 系统提示词
)

config = {"configurable": {"thread_id": "session-1"}}
result = agent.invoke(
    {"messages": [{"role": "user", "content": "帮我把今天的笔记存到 notes.md"}]},
    config=config,
)
print(result["messages"][-1].content)
```

> ✨ 注意：**没有写任何工具**，但它已经会用文件系统把笔记写进 `notes.md`——因为文件工具是内置的。试试就懂。

### 3.2 完整配置版（把六种能力都用上）

```python
from deepagents import create_deep_agent
from deepagents.backends import FilesystemBackend
from langgraph.checkpoint.memory import MemorySaver
from langgraph.store.memory import InMemoryStore
from langchain.tools import tool

@tool
def get_weather(city: str) -> str:
    """查询指定城市的天气。"""
    return f"{city} 晴天，26℃"

agent = create_deep_agent(
    name="my-assistant",                              # 名字（可选）
    model="claude-sonnet-4-5-20250929",
    tools=[get_weather],                              # 自定义工具
    system_prompt="你是我的全能助理。",
    subagents=[research_agent],                       # 自定义子代理（3.3 详讲）
    backend=FilesystemBackend(root_dir=".", virtual_mode=True),  # 文件后端
    interrupt_on={"write_file": True},                # 写文件前要人工确认
    skills=["./skills/"],                             # 技能目录
    checkpointer=MemorySaver(),                       # 断点续跑 / 审批支持
    store=InMemoryStore(),                            # 长期记忆
)
```

> 🔑 **记住 8 个参数**：`name / model / tools / system_prompt / subagents / backend / interrupt_on / skills / checkpointer / store`（其实 10 个，很好记：模型、提示词、工具、子代理、文件后端、审批、技能、两种存储）。

***

## 四、内置工具一览（开箱即用）

Deep Agents 出厂自带三类工具，**你一行都不用写**：

| 工具 | 官方分组 | 作用 | 类比 |
|:-----|:---------|:-----|:-----|
| `write_todos` | 规划 | 把复杂任务拆成待办清单，边做边更新 | 工作计划本 |
| `ls` `read_file` `write_file` `edit_file` `glob` `grep` | 文件系统 | 查看、读写、搜索文件 | 办公室文件柜 |
| `task` | 子代理 | 派一个专门的子代理去干某个子任务 | 叫同事帮忙 |

> 💡 **含义解释**：有了这三类工具，Agent 天然具备"**列计划 → 读写资料 → 派活**"的完整能力闭环——这正是复杂长任务最需要的三件事。

***

## 五、它和 LangGraph / LangChain 的关系

一句话：**Deep Agents 站在两者之上，并把它们"内置"了。**

| 能力 | 原本要在 LangGraph 里做的事 | Deep Agents 里 |
|:-----|:---------------------------|:---------------|
| 持久化 | 自己接 Checkpointer + thread\_id | `checkpointer=` 参数 |
| 人类审批 | 自己写 `interrupt` 节点 | `interrupt_on=` 参数 |
| 长期记忆 | 自己设计 Store | `store=` 参数 |
| 任务规划 / 文件 / 子代理 | 完全没有，自己造 | **出厂自带** |

> 💡 官方原话精神：**"Deep Agents 让你不用写图代码，也能享受到 LangGraph 的持久化执行能力。"** 你不需要知道底层是张什么图——它就是一张预装好的 LangGraph 图。

### 5.1 需要精确手控时怎么办

如果某个子任务需要"精确到每一条边"（比如一个确定性的反思循环），官方支持**混层（mixing layers）**：把你自己写的 LangGraph 图**注册成一个命名子代理**，交给 Deep Agents 用 `task` 工具去调用——总指挥保持全能，子任务保持精确。

```text
Deep Agents（总指挥：规划/文件/子代理/记忆）
   │  task 工具
   ▼
LangGraph 子代理（你手画的确定性流程图，作为"专家"被调用）
```

***

## 六、什么时候该用 Deep Agents

| 你的需求 | 该用吗 | 说明 |
|:---------|:-------|:-----|
| 长任务需要**规划 + 文件管理 + 子代理 + 记忆** | ✅ 首选 | 这就是它的主场 |
| 任务简单到只有一个固定工具 | ❌ 用 `create_agent` | 杀鸡不用牛刀 |
| 需要精确手控每条图边 | ⚠️ 用 LangGraph 或混层 | Deep Agents 不适合"手搓细节" |
| 既要全能，又要有确定性子流程 | ✅ 混层 | Deep Agents + LangGraph 子代理 |

> 🔑 **记忆口诀**：**"要全能，用 Deep Agents；要精确，用 LangGraph；要简单，用 LangChain。"**

***

## 📝 实践项目

### 目标

体验"配置驱动"：用一个不写任何逻辑的 Deep Agents，完成一个多步骤真实任务。

### 步骤

1. **创建 Deep Agent**（最小可用版），system\_prompt 设为"你是一位软件工程师助理"。
2. **布置一个长任务**，例如："把《学习路线》目录下的 README.md 读一遍，总结出三个要点，写进 `summary.md`，最后给我列出待办清单。"
3. **观察它自主完成**：它会自己调用 `read_file` → 思考 → `write_todos` → `write_file` → 完成。
4. **打开 LangSmith** 看调用链：数一数它自主调用了多少个工具、经历了多少轮循环。
5. **加一个自定义工具** `get_weather`，再问一句天气相关的问题，验证自定义工具和内置工具能混用。

> 🧠 **思考题**：刚才的任务里，Agent 把总结写进了当前目录的文件。如果我不想让它写进任意路径、只允许它在我指定目录里操作，该怎么办？（提示：`FilesystemBackend` 的 `root_dir` 参数，下一节详讲。）
