---
url: >-
  /my_notes/notes/LangChain学习路线/di-san-jie-duan-deep-agents-shen-ru/2-wen-jian-xi-tong-yu-shang-xia-wen-guan-li/index.md
---
# 文件系统与上下文管理

> Deep Agents 最实用的能力之一：**它真的会"读写文件"**。这一节讲清楚为什么需要文件系统、内置哪些工具、以及用 `FilesystemBackend` 怎么"圈定"它的活动范围。官方把这套能力叫作 **Context Management（上下文管理）**。

## 一、为什么 Agent 需要文件系统

### 1.1 模型的"内存瓶颈"

大模型的上下文窗口（一次能记住的内容）是**有限**的：几万 token 的对话可能就塞满了。而真实的长任务——写一本书、分析一个月的数据、管理一个项目——**内容量远超窗口**。

### 1.2 文件系统 = 给 Agent 外挂"仓库"

> 🧠 **类比**：人类也不把所有东西记在脑子里。我们有**工作台**（当前正在处理的内容）和**仓库/文件柜**（存下所有资料）。需要时从仓库取出放到工作台，用完整理完存回仓库。

Deep Agents 的文件系统就是这个"仓库"：Agent 把大量内容**写到文件里**，需要时**读回一小段**到上下文，用完再存。**上下文永远只放"当前需要的"，而不是"全部内容"。**

```text
模型上下文（工作台，容量小）         文件系统（仓库，容量无限）
  只放当前正在处理的                     存放所有资料
  读文件 → 取一小段到这里                read_file
  写文件 → 归档到这里 ←                write_file
```

***

## 二、内置文件工具一览

每个 Deep Agent **默认就带**以下文件工具（不用你写一行代码）：

| 工具 | 作用 | 类比 |
|:-----|:-----|:-----|
| `ls` | 列目录内容 | 看文件柜里有什么 |
| `read_file` | 读文件内容 | 打开文件读 |
| `write_file` | 写入/覆盖文件 | 写新文件归档 |
| `edit_file` | 精确修改文件某段 | 在文件里改一行 |
| `glob` | 按通配符找文件（如 `**/*.py`） | 按名字检索 |
| `grep` | 在文件里按关键词搜索 | 按内容检索 |

> 💡 **含义解释**：这套工具和你在 VS Code 里用的完全一样——只是使用者从"你"变成了"模型"。**给 Agent 一套文件工具，它就能在会话之外"长期保存"工作成果**，这正是跨天、跨项目工作能力的基础。

***

## 三、FilesystemBackend：圈定"活动范围"

### 3.1 什么是 Backend（后端）

官方说 Deep Agents 支持 **pluggable backends（可插拔后端）**——文件系统工具**底层存储在哪**，是可以换的。`FilesystemBackend` 就是默认的文件系统后端，它决定了两件事：

| 参数 | 作用 | 大白话 |
|:-----|:-----|:-------|
| `root_dir` | 允许 Agent 操作的最顶层目录 | 它的"工作地盘"边界 |
| `virtual_mode` | 是否允许访问根目录之外的路径 | 放它出不出院子 |

### 3.2 用法示例

```python
from deepagents import create_deep_agent
from deepagents.backends import FilesystemBackend

agent = create_deep_agent(
    model="claude-sonnet-4-5-20250929",
    # 只允许 Agent 在当前目录（.）下操作，且不允许跑出这个目录
    backend=FilesystemBackend(root_dir=".", virtual_mode=False),
)
```

> ⚠️ **含义解释**：`root_dir` 是**安全边界**。比如你把 `root_dir` 设为 `./workspace/`，Agent 就只能在这个文件夹里读写，**不能乱碰系统其他文件**——这是把 Agent 放进一个"隔离工作间"。

> ⚠️ `virtual_mode` 为 True 时，Agent 可以用相对路径跳出 root\_dir，操作更自由但**更危险**。生产环境请设为 False，并配合人工审批（下一节）使用。

***

## 四、Filesystem vs Store 后端选型

Deep Agents 提供两套"后端"思路，适用场景不同（官方 `StoreBackend` 需要配合 `store` 实例）：

| 对比维度 | `FilesystemBackend` | `StoreBackend` |
|:---------|:--------------------|:---------------|
| 存储对象 | 真实文件/目录 | 键值对（Key-Value）数据 |
| 体验 | 和本地文件系统一致 | 更像数据库 |
| 适用环境 | 有文件系统的本机 / 容器 | 无文件系统的沙箱、Serverless |
| 依赖 | 不需要额外 store | **必须传入 `store` 实例** |
| 典型用途 | 读写项目文件、笔记、代码 | 存记忆、配置、技能内容 |

> 🔑 **一句话选型**：**要在"文件"上工作 → `FilesystemBackend`；要在"数据"上存取 → `StoreBackend`。** 二选一传给 `backend` 参数。

***

## 五、文件系统相关的常见坑

| 坑 | 正确做法 |
|:---|:---------|
| 想用文件系统却忘了传 `backend` | 显式传 `backend=FilesystemBackend(root_dir=...)` |
| `root_dir` 太宽（直接给 `/`） | 收敛到任务专用目录，越小越安全 |
| 生产环境 `virtual_mode=True` 放它出界 | 设为 False + 关键写操作开审批 |
| 让 Agent 读二进制大文件 | 用 `grep`/`glob` 先定位，避免整文件塞进上下文 |

***

## 📝 实践项目

### 目标

让 Agent 在一个"圈定的工作区"里完成一次"读→写→改"的完整任务，并验证安全边界。

### 步骤

1. **建工作区**：新建 `workspace/` 目录，放一份 `notes.txt`。
2. **配后端**：`backend=FilesystemBackend(root_dir="workspace", virtual_mode=False)`。
3. **任务 1（读写）**：让 Agent "读 notes.txt 并总结，把总结存为 summary.md"。
4. **任务 2（修改）**：让 Agent "把 summary.md 中第 2 行改成 xxx"（触发 `edit_file`）。
5. **验证边界**：问它"帮我看看 C:\Windows 下的文件"，观察它**因为越界而拒绝或报错**——体会 `root_dir` 的安全价值。
6. **打开 LangSmith**，在时间线上定位每一次 `read_file` / `write_file` / `edit_file` 调用。

> 🧠 **思考题**：文件系统解决了"上下文装不下"的问题，但 Agent 每次写文件都会留下"痕迹"。如果某些写操作（如覆盖一个重要文件）你希望**先经过人工确认**再执行，该怎么做？（提示：`interrupt_on`，见 3.4 节。）
