---
url: >-
  /my_notes/notes/LangChain学习路线/di-san-jie-duan-deep-agents-shen-ru/3-zi-dai-li-skills-yu-ji-yi/index.md
---
# 子代理、Skills 与记忆

> Deep Agents 的"职场三件套"：**会派活**（子代理）、**会查手册**（Skills）、**记性好**（记忆）。掌握这三样，你就从一个"会跑流程的 Agent"升级为"能带团队、能积累经验的全能员工"。

## 一、子代理（SubAgent）：让 Agent 会"派活"

### 1.1 为什么需要子代理

单个 Agent 也有"上下文天花板"。与其让主 Agent 一个人扛所有子任务，不如**专事专人**：

> 🧠 **类比**：项目经理（主 Agent）不会自己去写每个模块的代码。他把任务拆开，派给后端工程师、前端工程师、测试工程师（子代理），各自在自己的上下文里专注干活，最后把结果汇总回来。**每个子代理 = 一个独立的小 Agent，有自己的工具和提示词。**

### 1.2 内置 `task` 工具

每个 Deep Agent 默认就有 `task` 工具，主 Agent 用它来**派活**：

```python
# 主 Agent 会让模型这样用 task 工具（伪代码示意）
task(description="把这份需求文档分析一下，输出三个风险点")
```

主 Agent 决定"要不要派、派给谁、派什么活"，子代理在自己的上下文里独立完成，返回结果。**这避免了所有内容都堆在主 Agent 的上下文里。**

### 1.3 自定义子代理

除了 `task` 自带的基础子代理，你可以注册**专门的专家子代理**：

```python
from deepagents import create_deep_agent

# 先造一个"专家"子代理（比如专门的代码审查员）
code_reviewer = create_deep_agent(
    name="code-reviewer",
    model="claude-sonnet-4-5-20250929",
    system_prompt="你是资深代码审查员，只关注代码质量和安全隐患。",
    tools=[...],            # 子代理可以有自己的专用工具
)

# 再造主代理，把这个专家挂上
boss = create_deep_agent(
    name="boss",
    model="claude-sonnet-4-5-20250929",
    subagents=[code_reviewer],   # ← 注册为可调用的子代理
)
```

> ⚠️ **关键规则（官方明确）**：**Skills 不会被子代理继承。** 子代理需要技能时，必须在创建它时**显式传入** `skills` 参数。

```python
# ❌ 子代理不会继承主代理的 skills
boss = create_deep_agent(skills=["./main-skills/"], subagents=[helper])

# ✅ 每个子代理单独配自己的 skills
helper = create_deep_agent(
    name="helper",
    skills=["./helper-skills/"],   # 显式传给子代理
)
boss = create_deep_agent(subagents=[helper])
```

***

## 二、Skills：按需加载的"岗位手册"

### 2.1 什么是 Skills

> **Skills（技能）**：按需加载的一组领域指令。它解决"Agent 上下文有限、装不下所有专业知识"的问题——**需要时才加载，用完就放下**（官方术语叫 **progressive disclosure，渐进式披露**）。

> 🧠 **类比**：员工桌上不放全部手册，而是"遇到什么问题，才去翻对应那本手册"。Skills 就是那本"按需取阅的手册"。

### 2.2 SKILL.md 格式

每个技能是一个目录，核心是一个带 **frontmatter**（YAML 头）的 `SKILL.md`：

```text
skills/
└── python-testing/          ← 一个技能目录
    ├── SKILL.md             ← 必填：技能主文件
    ├── examples.py          ← 可选：辅助文件
    └── templates/           ← 可选：模板
```

```markdown
---
name: python-testing
description: Python 测试最佳实践，覆盖 pytest 夹具与 mock 用法
---
# Python 测试技能
当你需要编写或审查 Python 测试时，遵循以下规范……
```

> ⚠️ **注意两点**：
>
> 1. **frontmatter 必填**，且 `name` 和 `description` 要**写具体**——Agent 靠 `description` 判断"什么时候该用这个技能"，描述含糊它就不会用。
> 2. **目录结构约定不可改**：`SKILL.md` 是加载入口，格式是 Deep Agents 的协议。

### 2.3 配置 Skills

```python
from deepagents import create_deep_agent
from deepagents.backends import FilesystemBackend

agent = create_deep_agent(
    backend=FilesystemBackend(root_dir=".", virtual_mode=True),  # 从本地文件系统读技能
    skills=["./skills/"],     # 技能目录
)
```

> ⚠️ **Skills 必须配后端**：`skills` 需要从文件系统加载，所以 `backend` 要用 `FilesystemBackend`；如果环境没有文件系统（如 Serverless），要把技能内容**预载入 Store** 再用 `StoreBackend`。

### 2.4 Skills vs 系统提示词（对比）

| 对比维度 | Skills | system\_prompt（系统提示词） |
|:---------|:-------|:---------------------------|
| 加载时机 | **按需**加载 | **每次启动**都加载 |
| 占上下文 | 用时才占 | 一直占着 |
| 适合内容 | 大块领域知识、手册、模板 | 简短的全局行为准则 |
| 类比 | 岗位手册（要用才翻） | 员工守则（每天生效） |

***

## 三、记忆：短时 vs 长时

### 3.1 两种记忆的区别

Deep Agents 用**两套机制**实现记忆：

| 维度 | Thread（短时记忆） | Store（长时记忆） |
|:-----|:------------------|:------------------|
| 官方名 | 会话状态（Checkpointer） | 持久化存储（Store） |
| 存什么 | 一次会话内的消息、State | 跨会话的用户偏好、长期知识 |
| 生命周期 | 会话结束/换 thread\_id 就换 | 长期存在，可被多个会话读 |
| 怎么开 | 传 `checkpointer` + 用固定 `thread_id` | 传 `store` |
| 类比 | 正在进行的谈话 | 记在笔记本上的永久印象 |

### 3.2 Thread：跨轮对话

```python
from langgraph.checkpoint.memory import MemorySaver

agent = create_deep_agent(
    model="claude-sonnet-4-5-20250929",
    checkpointer=MemorySaver(),                    # 短时记忆开关
)

config = {"configurable": {"thread_id": "user-123"}}
agent.invoke({"messages": [{"role": "user", "content": "我叫小明"}]}, config=config)
agent.invoke({"messages": [{"role": "user", "content": "我叫什么？"}]}, config=config)  # 记得
```

> ⚠️ **常见错误**：每次调用不带 `thread_id`，Agent 就会"失忆"。**同一会话用同一个 `thread_id`。**

### 3.3 Store：跨会话长期记忆

```python
from langgraph.store.memory import InMemoryStore

agent = create_deep_agent(
    model="claude-sonnet-4-5-20250929",
    store=InMemoryStore(),     # 长时记忆开关（生产用持久化 Store）
)

# 即使换 thread_id，Agent 也能通过 store 记住"长期事实"
agent.invoke({"messages": [{"role": "user", "content": "记住：我偏好简洁回答"}]},
             config={"configurable": {"thread_id": "s1"}})
agent.invoke({"messages": [{"role": "user", "content": "我的偏好是什么？"}]},
             config={"configurable": {"thread_id": "s2"}})   # 新会话也记得
```

> 🔑 **一句话**：**`checkpointer` + `thread_id` 管"当前对话"，`store` 管"永久记忆"。**

***

## 四、三者组合的完整示例

```python
from deepagents import create_deep_agent
from deepagents.backends import FilesystemBackend
from langgraph.checkpoint.memory import MemorySaver
from langgraph.store.memory import InMemoryStore

# 专家子代理（审查员，自带代码规范技能）
reviewer = create_deep_agent(
    name="reviewer",
    model="claude-sonnet-4-5-20250929",
    system_prompt="你是资深审查员，输出"批准"或"拒绝"及理由。",
    skills=["./skills/code-review/"],      # 子代理独立配技能
)

# 主代理：会派活 + 有短时记忆 + 有长期记忆 + 有文件系统
boss = create_deep_agent(
    name="boss",
    model="claude-sonnet-4-5-20250929",
    subagents=[reviewer],                          # 派活给审查员
    backend=FilesystemBackend(root_dir="./workspace"),   # 文件系统
    skills=["./skills/general/"],                  # 主代理技能
    checkpointer=MemorySaver(),                    # 短时记忆
    store=InMemoryStore(),                         # 长时记忆
)
```

**运行效果（伪代码）**：

```text
用户："审查一下 workspace 的代码，然后记住我爱简洁"
 boss  → 列计划 (write_todos)
      → 读文件 (read_file)
      → 派活给 reviewer (task)
      → 汇总结果 → 回复
      → 写入长期记忆 (store)
```

***

## 📝 实践项目

### 目标

搭建一个"主代理 + 子代理 + Skills + 双记忆"的完整 Agent，验证三者协同。

### 步骤

1. **建技能目录**：写一个 `skills/python-style/`，内含带 frontmatter 的 `SKILL.md`（描述："Python 代码风格检查规范"）。
2. **创建审查员子代理**：`system_prompt` 设为审查角色，挂上 `python-style` 技能。
3. **创建主代理**：挂上子代理 + `checkpointer` + `store` + `FilesystemBackend`。
4. **多轮对话测试短时记忆**：第一轮"记住我的名字"，第二轮换问题验证它记得。
5. **跨会话测试长时记忆**：换一个 `thread_id`，问"我的名字是什么"——如果配置了 `store`，它仍记得。
6. **触发子代理 + Skills**：让它审查一段 Python 代码，观察它调用 `task`、并引用 `python-style` 技能规范。
7. **验证"技能不继承"**：故意不给子代理配技能，观察它是否不知道 `python-style` 的存在。

> 🧠 **思考题**：技能让 Agent"按需翻手册"，审批让 Agent"动手前先问人"。如果某个技能里教的都是"危险操作"，你希望每次它执行该技能的第一步时都停下来问你，怎么配置？（提示：结合 `interrupt_on`，见 3.4 节。）
