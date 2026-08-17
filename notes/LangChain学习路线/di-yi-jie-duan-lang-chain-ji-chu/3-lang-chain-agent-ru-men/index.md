---
url: >-
  /my_notes/notes/LangChain学习路线/di-yi-jie-duan-lang-chain-ji-chu/3-lang-chain-agent-ru-men/index.md
---
# LangChain Agent 入门

> 前面学了"零件"（模型、工具、提示词），这一节把零件组装成**能自主干活的 Agent**。理解"Agent 循环"是贯穿整个生态的核心心智模型。

## 一、Agent 是什么

### 1.1 官方定义

> **Agent（代理）**：一个使用**大模型作为推理核心**、能自主决定"调用什么工具、按什么顺序调用、何时结束"的程序。

普通程序是"我们写死逻辑"；Agent 是"**模型写逻辑**"——我们只给它工具和任务。

### 1.2 核心心智模型：ReAct 循环

官方 Agent 背后是 \*\*ReAct（Reason + Act，推理 + 行动）\*\*模式，循环执行三步：

```text
        ┌──────────────────────────────────────┐
        │  1. 思考 (Reason)：根据现状想下一步    │
        │  2. 行动 (Act)  ：调用工具            │
        │  3. 观察 (Observe)：拿到工具结果       │
        └──────────────┬───────────────────────┘
                       │  问题没解决就回到第1步
                       ▼
                   4. 直到给出最终答案
```

> 🧠 **类比**：让一个实习生查资料并写报告。你给他"搜索引擎、文件系统、计算器"三样工具，他自己决定：先搜什么 → 看到结果 → 再搜什么 → 最后汇总成报告。**你只负责给工具 + 定任务，过程完全由他自主。**

### 1.3 一段"思考"长什么样

```text
思考：用户问北京的天气，我需要调用天气工具。
行动：调用 get_weather(city="北京")
观察：返回"北京晴天 26℃"
思考：已拿到天气，可以直接回答用户。
最终回答：北京今天晴天，26℃。
```

***

## 二、用 `create_agent` 创建第一个 Agent

### 2.1 官方推荐入口

LangChain 官方现在用一个统一函数创建 Agent：

```python
from langchain_anthropic import ChatAnthropic
from langchain.agents import create_agent
from langchain.tools import tool

@tool
def get_weather(city: str) -> str:
    """查询指定城市的天气。"""
    return f"{city} 晴天，26℃"

@tool
def add(a: float, b: float) -> float:
    """计算两个数字的和。"""
    return a + b

# 模型 + 工具列表 → 一个 Agent
model = ChatAnthropic(model="claude-sonnet-4-5-20250929")
agent = create_agent(model=model, tools=[get_weather, add])

# 执行（Agent 内部自动跑 ReAct 循环）
result = agent.invoke({"messages": [{"role": "user", "content": "北京天气多少度？顺便算一下 12+8。"}]})
for msg in result["messages"]:
    print(f"[{msg.type}] {msg.content}")
```

> 🔑 **记住 `create_agent(model, tools=[...])`** —— 这就是 LangChain 层创建 Agent 的统一入口。三个库的三个入口你都要会：`create_agent` / `StateGraph.compile()` / `create_deep_agent`。

### 2.2 观察输出

`result["messages"]` 里能看全整个循环：`user`（问题）→ `ai`（思考+工具调用请求）→ `tool`（工具结果）→ `ai`（最终回答）。**看到这条完整的消息链，你就直观理解了 ReAct 循环。**

***

## 三、Chain 与 Agent 的区别

| 对比维度 | Chain（链） | Agent（代理） |
|:---------|:------------|:--------------|
| 流程 | 写死的固定步骤 | 模型自主决策的循环 |
| 是否调用工具 | 按固定顺序 | 自主决定，可多轮 |
| 行为可预测性 | 高（每次一样） | 低（模型说了算） |
| 适用场景 | 流程确定的 RAG/批处理 | 需要推理、多工具协作的任务 |
| 类比 | 自动流水线 | 有主见的员工 |

> ⚠️ **经验法则**：流程**确定**就用 Chain（省 token、可控、快）；需要**动脑决策**才用 Agent。

***

## 四、Agent 的局限：什么时候该升级

官方文档明确：`create_agent` 适合"单目标、固定工具"的简单场景。当出现下面信号，就该往上走：

| 信号 | 你的真实需求 | 升级到 |
|:-----|:------------|:-------|
| 循环逻辑复杂、有分支并行 | 需要**精确控制流程** | **LangGraph** |
| 任务要跨多轮、要断点续跑、要人工审批 | 需要**持久化 + 人类审批** | **LangGraph** |
| 长任务要**规划、管文件、派子代理、记长期记忆** | 想要一个开箱即用的全能 Agent | **Deep Agents** |

> 💡 简单说：**LangChain Agent = 单兵；LangGraph = 可以自己画战术；Deep Agents = 自带参谋部的整装队伍。** 任务复杂度上升时逐级升级。

***

## 📝 实践项目

### 目标

创建一个带多个工具的 Agent，并观察它的完整 ReAct 循环。

### 步骤

1. **定义 2-3 个工具**：`get_weather`、`add`、再加一个 `current_time()`（返回当前时间）。
2. **用 `create_agent` 组装**（模型用你已配置好的供应商）。
3. **一次性提问多个子问题**，例如："现在几点？北京天气呢？再算 100×3.5。" 观察模型如何**自主拆解并连续调用**多个工具。
4. **打印 `result["messages"]`**，把每条消息的 `type` 和 `content` 写出来，验证 ReAct 循环。
5. **对比实验**：同一个任务，如果只给你 `model.invoke`（不绑定工具），模型会怎么回答？体会"工具让模型从'只会说'变成'会做'"。

> 🧠 **思考题**：如果我想让 Agent "查完资料再写文件"——也就是"**先做 A 再做 B，顺序必须保证**"，用 `create_agent` 能百分百保证顺序吗？如果不能，下一阶段 LangGraph 是怎么解决这个问题的？（提示：Node 和 Edge）
