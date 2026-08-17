---
url: >-
  /my_notes/notes/Python学习路线/shen-du-xue-xi/01-async-web/1-shi-jian-xun-huan-di-ceng-yu-yi-bu-jia-gou/index.md
---
# 事件循环底层与异步架构

> 深入 asyncio 事件循环的源码级实现，理解协程、Task、Future 的调度机制，掌握高性能异步应用的架构设计。

## 一、事件循环核心机制

### 1.1 事件循环（EventLoop）本质

**事件循环**：一个持续运行、负责调度所有异步任务的引擎。它的核心工作只有三件事——**轮询事件、分发回调、调度任务**。

```python
# 简化的事件循环模型（理解其工作原理）
class SimpleEventLoop:
    def __init__(self):
        self.ready = []          # 就绪队列：等待被调度的任务
        self.waiters = {}        # 等待表：fd -> 回调（由 Selector 监控）

    def run_forever(self):
        while True:
            # 1. 执行当前就绪的回调
            while self.ready:
                cb = self.ready.pop(0)
                cb()

            # 2. 从操作系统取事件（select/poll/epoll）
            ready_fds = selector.select(timeout)
            for fd, events in ready_fds:
                callback = self.waiters.pop(fd)
                self.ready.append(callback)   # 放入就绪队列，下一轮执行
```

**Selector 事件驱动**：asyncio 在 Unix 上默认使用 `epoll`（Linux）或 `kqueue`（macOS），在 Windows 上使用 `IOCP`（通过 Proactor）或 `SelectSelector`。

| 选择器 | 平台 | 事件模型 | 连接数上限 |
|:-------|:-----|:---------|:----------|
| `epoll` | Linux | 边缘/水平触发 | 无硬限制 |
| `kqueue` | macOS/BSD | 事件过滤 | 无硬限制 |
| `IOCP` | Windows | 完成端口（Proactor） | 无硬限制 |
| `select` | 通用兜底 | 轮询 | 1024 |

**事件循环的线程约束**：`asyncio` 事件循环**不是线程安全的**。同一事件循环只能在一个线程内运行，跨线程操作必须通过 `loop.call_soon_threadsafe()` 等线程安全 API。

```python
import asyncio
import threading

async def worker(name):
    await asyncio.sleep(1)
    return f"done-{name}"

# ❌ 错误：在另一个线程直接调用 loop.run_until_complete
def bad_thread(loop):
    loop.run_until_complete(worker("bad"))   # RuntimeError: loop is already running

# ✅ 正确：用 asyncio.run_coroutine_threadsafe 投递到事件循环线程
def good_thread(loop):
    future = asyncio.run_coroutine_threadsafe(worker("good"), loop)
    return future.result()

async def main():
    loop = asyncio.get_running_loop()
    t = threading.Thread(target=good_thread, args=(loop,))
    t.start()
    t.join()

asyncio.run(main())
```

### 1.2 协程与状态机

**协程（Coroutine）**：本质上是一个**可挂起/恢复的函数状态机**。当协程遇到 `await` 时，会挂起并把控制权交还给事件循环；当等待的事件就绪时，从挂起点恢复执行。

```python
import asyncio

async def fetch_data(url):
    print(f"开始请求: {url}")
    await asyncio.sleep(1)          # 挂起点：让出控制权
    print(f"请求完成: {url}")
    return {"url": url, "status": 200}

async def main():
    # 注意：调用协程函数不会立即执行，返回的是协程对象
    coro = fetch_data("/api/1")     # 此时尚未执行任何代码
    print(type(coro))               # <class 'coroutine'>

    # 必须交给事件循环执行（await / gather / create_task）
    result = await coro
    print(result)

asyncio.run(main())
```

**协程状态机**：每个协程对象内部维护一个状态（`CREATED`、`RUNNING`、`SUSPENDED`、`DONE`），CPython 用 `Coro_wrapper` 包装，每次 `send()` 推进执行。

```
协程生命周期
CREATED --send()--> RUNNING --await--> SUSPENDED --事件就绪--> RUNNING --> DONE
                     |                                        |
                     +--------------抛异常---------------------+
```

### 1.3 Task 与 Future

**Task**：把协程包装成「可被事件循环调度、可查询状态、可取消」的单元。**Future**：一个「未来结果」的占位符，是异步回调的底层抽象。

```python
import asyncio

async def slow_operation():
    await asyncio.sleep(2)
    return 42

async def main():
    # 方式一：直接 await（串行）
    result1 = await slow_operation()

    # 方式二：create_task 创建后台任务（并行）
    task = asyncio.create_task(slow_operation())

    # Task 具备查询与取消能力
    print(task.done())       # False（尚未完成）
    await asyncio.sleep(1)
    task.cancel()            # 取消任务
    try:
        await task
    except asyncio.CancelledError:
        print("任务已被取消")

    # 方式三：gather 并发聚合
    results = await asyncio.gather(
        slow_operation(), slow_operation(),
        return_exceptions=True,   # 单个失败不中断整体
    )
    print(results)

asyncio.run(main())
```

**Task 与 Future 的关系**：

| 特性 | Future | Task |
|:-----|:-------|:-----|
| 底层抽象 | 异步结果占位符 | Future 的子类 |
| 是否执行函数 | 否，需手动 set\_result | 是，驱动协程执行 |
| 可取消 | 支持 | 支持（会向协程注入 CancelledError）|
| 使用场景 | 底层库实现 | 业务代码并发 |

**注意**：未保存引用的 Task 可能被垃圾回收。Python 3.11+ 中事件循环会持有当前待执行 Task 的弱引用，但仍建议用变量保存长生命周期任务。

```python
import asyncio

async def ping():
    await asyncio.sleep(10)

async def main():
    # ❌ 错误：任务对象被丢弃，可能被回收
    asyncio.create_task(ping())

    # ✅ 正确：保存引用，保证任务存活
    task = asyncio.create_task(ping())
    # ... 之后可 task.cancel() 或 await task
    await asyncio.sleep(1)
    task.cancel()

asyncio.run(main())
```

***

## 二、await 挂起与恢复

### 2.1 await 的调度语义

**await**：把控制权交还给事件循环，由事件循环决定「何时继续」。关键在于理解——`await` 一个**耗时操作**不会阻塞事件循环，但 `await` 一个**纯 CPU 计算**同样不会让其他任务并行。

```python
import asyncio

async def io_task(n):
    await asyncio.sleep(0.1)      # 挂起：事件循环可以运行其他任务
    return n

async def cpu_task():
    total = 0
    for i in range(10_000_000):   # 纯 CPU 计算：不挂起，独占事件循环
        total += i
    return total

async def main():
    # I/O 密集型：三个协程几乎同时完成（并行）
    t0 = asyncio.get_event_loop().time()
    await asyncio.gather(*(io_task(i) for i in range(3)))
    print(f"IO 并行耗时: {asyncio.get_event_loop().time() - t0:.2f}s")  # ≈0.1s

    # CPU 密集型：串行执行，gather 也无法并行
    t1 = asyncio.get_event_loop().time()
    await asyncio.gather(cpu_task(), cpu_task(), cpu_task())
    print(f"CPU 串行耗时: {asyncio.get_event_loop().time() - t1:.2f}s")  # 3×单次耗时

asyncio.run(main())
```

**关键结论**：asyncio 适合 **I/O 密集型**任务；**CPU 密集型**任务需要丢给线程池/进程池（`run_in_executor`），否则会阻塞事件循环。

```python
import asyncio
from concurrent.futures import ProcessPoolExecutor

async def main():
    # ✅ 正确：CPU 密集任务交给进程池，不阻塞事件循环
    loop = asyncio.get_running_loop()
    with ProcessPoolExecutor(max_workers=2) as pool:
        results = await asyncio.gather(
            loop.run_in_executor(pool, heavy_calc, 1_000_000),
            loop.run_in_executor(pool, heavy_calc, 2_000_000),
        )
    print(results)

def heavy_calc(n):
    total = 0
    for i in range(n):
        total += i
    return total
```

### 2.2 Task 调度顺序与回调

**回调注册**：事件循环维护一个「就绪回调队列」。`await` 挂起后，事件循环继续执行就绪队列中的其他回调，直到再次轮询事件。

```python
import asyncio

async def step(name, delay):
    await asyncio.sleep(delay)
    return name

async def main():
    # 调度顺序由「就绪时间」决定，非创建顺序
    a = asyncio.create_task(step("A", 0.3))
    b = asyncio.create_task(step("B", 0.1))
    c = asyncio.create_task(step("C", 0.2))

    # 完成顺序：B → C → A（按 sleep 时长，而非创建顺序）
    done, _ = await asyncio.wait([a, b, c], return_when=asyncio.ALL_COMPLETED)
    results = [t.result() for t in done]
    print(results)

asyncio.run(main())
```

**`call_soon` 与 `call_later`**：直接向事件循环投递回调，绕过协程机制，适合在异步代码中桥接同步回调。

```python
import asyncio

def on_timeout():
    print("3 秒后触发")

async def main():
    loop = asyncio.get_running_loop()
    loop.call_later(3, on_timeout)          # 3 秒后执行同步回调
    loop.call_soon(lambda: print("立即执行"))  # 下一轮事件循环执行
    await asyncio.sleep(4)

asyncio.run(main())
```

### 2.3 超时与取消

**超时控制**：`asyncio.timeout`（3.11+）与 `asyncio.wait_for` 是控制任务耗时的标准手段，防止接口/调用无限挂起。

```python
import asyncio

async def unstable_api():
    await asyncio.sleep(5)
    return "slow response"

async def main():
    # 方式一：wait_for（兼容旧版本）
    try:
        result = await asyncio.wait_for(unstable_api(), timeout=1.0)
    except asyncio.TimeoutError:
        print("接口超时（wait_for）")

    # 方式二：timeout 上下文管理器（3.11+，更优雅）
    try:
        async with asyncio.timeout(1.0):
            result = await unstable_api()
    except TimeoutError:
        print("接口超时（timeout 上下文）")

asyncio.run(main())
```

**取消传播**：`task.cancel()` 会向协程内注入 `CancelledError`，协程可在该处执行清理逻辑，但不要吞掉取消信号。

```python
import asyncio

async def job():
    try:
        await asyncio.sleep(10)
    except asyncio.CancelledError:
        print("清理资源...")
        # ❌ 错误：吞掉取消信号，任务将无法真正取消
        # return
        # ✅ 正确：清理后重新抛出取消信号
        raise

async def main():
    task = asyncio.create_task(job())
    await asyncio.sleep(0.1)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        print("任务已正常取消")

asyncio.run(main())
```

***

## 三、高性能异步应用架构设计

### 3.1 分层架构

**分层职责**：一个高性能异步应用通常分为「接口层 → 服务层 → 基础设施层」，每层关注点不同，层与层之间通过协程/抽象解耦。

```
应用分层
┌──────────────────────────────────────────────┐
│  接口层：FastAPI 路由 / WebSocket / 定时入口    │  负责参数校验、鉴权、响应格式
├──────────────────────────────────────────────┤
│  服务层：业务编排、事务边界、领域逻辑            │  负责业务规则，调用基础设施
├──────────────────────────────────────────────┤
│  基础设施层：DB/Redis/HTTP/消息队列 客户端       │  负责 I/O 交互，封装连接池与重试
└──────────────────────────────────────────────┘
```

```python
# 基础设施层示例：统一封装 Redis 异步客户端
import redis.asyncio as aioredis

class RedisCache:
    """基础设施层：封装 Redis 连接池与通用方法"""

    def __init__(self, url: str):
        self._pool = aioredis.from_url(
            url,
            max_connections=50,          # 连接池上限
            decode_responses=True,
        )

    async def get_json(self, key: str):
        data = await self._pool.get(key)
        return data

    async def set_json(self, key: str, value: str, ttl: int = 300):
        await self._pool.set(key, value, ex=ttl)

    async def close(self):
        await self._pool.aclose()
```

### 3.2 背压与并发限制

**背压（Backpressure）**：当生产者速度超过消费者时，必须通过限制机制防止内存/队列无限膨胀。在 asyncio 中最常用的是 `Semaphore`（信号量）。

```python
import asyncio
import aiohttp

async def fetch_one(session, sem, url):
    async with sem:                       # 限制并发数量
        async with session.get(url) as resp:
            return await resp.json()

async def main():
    urls = [f"https://api.example.com/item/{i}" for i in range(1000)]
    sem = asyncio.Semaphore(20)          # 最多 20 个并发请求

    async with aiohttp.ClientSession() as session:
        # 并发执行但受信号量限制
        results = await asyncio.gather(
            *(fetch_one(session, sem, u) for u in urls),
            return_exceptions=True,
        )
    print(f"成功: {sum(1 for r in results if not isinstance(r, Exception))}")

asyncio.run(main())
```

**信号量与锁的区别**：

| 机制 | 用途 | 类比 |
|:-----|:-----|:-----|
| `Semaphore(N)` | 限制并发数为 N | 限流闸门 |
| `Lock()` | 互斥，同一时刻仅一个执行 | 单行通道 |
| `Event()` | 等待某个事件被 set | 信号灯 |
| `Queue()` | 任务排队 + 消费者模型 | 流水线 |

### 3.3 超时、重试与熔断

**超时+重试**：对外部 I/O 调用统一做「超时兜底 + 有限重试 + 指数退避」，防止单点故障拖垮整个应用。

```python
import asyncio

async def call_with_retry(func, max_retries=3, timeout=2.0):
    for attempt in range(max_retries):
        try:
            async with asyncio.timeout(timeout):
                return await func()
        except (TimeoutError, ConnectionError) as e:
            if attempt == max_retries - 1:
                raise
            # 指数退避：0.5s、1s、2s...
            backoff = 0.5 * (2 ** attempt)
            print(f"第 {attempt+1} 次失败，{backoff}s 后重试: {e}")
            await asyncio.sleep(backoff)

async def flaky_service():
    await asyncio.sleep(0.1)
    raise ConnectionError("服务暂时不可用")

async def main():
    try:
        result = await call_with_retry(flaky_service)
    except Exception as e:
        print(f"最终失败: {e}")

asyncio.run(main())
```

### 3.4 结构化并发

**结构化并发**：用 TaskGroup（3.11+）管理子任务的创建与回收，父协程退出时自动等待/取消子任务，避免任务泄漏。

```python
import asyncio

async def worker(id):
    await asyncio.sleep(1)
    if id == 2:
        raise ValueError(f"worker {id} 失败")
    return id

async def main():
    try:
        async with asyncio.TaskGroup() as tg:     # 结构化并发
            task1 = tg.create_task(worker(1))
            task2 = tg.create_task(worker(2))     # 该任务抛异常
            task3 = tg.create_task(worker(3))
        # 全部成功才走到这里；任一失败会自动取消其余任务
    except ExceptionGroup as eg:                  # 汇聚多个异常
        print(f"捕获到 {len(eg.exceptions)} 个异常")

asyncio.run(main())
```

***

## 四、uvloop 与性能对比

### 4.1 uvloop 原理

**uvloop**：用 Cython 实现、基于 libuv 的事件循环，是 asyncio 官方推荐的高性能替代。它直接对接操作系统的 epoll/kqueue，减少了 Python 层的对象开销。

```python
# 启用 uvloop（安装：pip install uvloop）
import asyncio
import uvloop

# 方法一：替换默认事件循环策略
asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())

# 方法二：直接在入口处设置
async def main():
    await asyncio.sleep(1)
    print("运行在 uvloop 事件循环上")

if __name__ == "__main__":
    uvloop.run(main())    # 等价于 asyncio.run，但使用 uvloop
```

**性能对比**：

| 场景 | asyncio（纯 Python） | uvloop | 提升 |
|:-----|:---------------------|:-------|:-----|
| TCP echo 服务 | ~30k req/s | ~45k req/s | ~50% |
| HTTP 短连接 | ~20k req/s | ~28k req/s | ~40% |
| 高并发连接数 | 稳定 | 更稳定 | 内存更省 |

> 注意：uvloop 不兼容 Windows 上的 Proactor 事件循环，Windows 生产环境建议仍用 asyncio 原生循环或考虑 Proactor 优化。

### 4.2 FastAPI + uvloop 部署

**生产部署组合**：`uvicorn` 本身支持 `--loop uvloop`，与 FastAPI 搭配是 Python 异步 Web 的事实标准。

```bash
# 安装
pip install uvicorn[standard] uvloop

# 启动：指定 loop 与 workers
uvicorn app.main:app --host 0.0.0.0 --port 8000 \
    --loop uvloop --workers 4

# 或使用 gunicorn + uvicorn worker（更适合生产多进程管理）
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:8000 --worker-class uvicorn.workers.UvicornWorker
```

**多进程注意**：`--workers 4` 意味着 4 个独立进程，每个进程有独立的 asyncio 事件循环与内存。进程间状态不共享，需要共享状态（缓存/锁）时必须用外部组件（Redis 等）。

### 4.3 异步架构避坑指南

| 反模式 | 问题 | 正确做法 |
|:-------|:-----|:---------|
| 在协程中写阻塞代码（`time.sleep`、`requests`） | 阻塞整个事件循环 | 用 `await asyncio.sleep`、`httpx.AsyncClient` |
| 同步 ORM/DB 驱动 | 同上一并阻塞 | 用 `asyncpg`、`aiomysql`、`SQLAlchemy async` |
| CPU 密集任务直接写在协程 | 独占事件循环 | 丢给 `run_in_executor` 进程池 |
| 忘记设置超时 | 外部服务挂起拖垮服务 | 统一 `asyncio.timeout` 兜底 |
| 任务对象未保存引用 | 任务被垃圾回收 | 保存引用或用 `TaskGroup` |

```python
import asyncio
import time

async def bad_handler():
    # ❌ 错误：同步 sleep 阻塞事件循环 2 秒
    time.sleep(2)

async def good_handler():
    # ✅ 正确：异步 sleep 让出控制权
    await asyncio.sleep(2)
```

***

## 实践项目

### 项目 1：实现一个简化版事件循环

**目标**：不依赖 asyncio，用 `selectors` 模块从零实现一个可调度定时器任务的最小事件循环，深入理解调度机制。

**步骤**：

1. 创建 `MyEventLoop` 类，内部维护就绪队列与定时器列表
2. 用 `selectors.DefaultSelector()` 注册 socket 事件
3. 实现 `call_soon`、`call_later` 与 `run_forever`
4. 写一个 TCP echo server 验证事件循环能同时处理多个连接
5. 与 asyncio 版本对比，总结两者设计差异

**目录结构参考**：

```text
mini-event-loop/
├── event_loop.py          # 自定义事件循环实现
├── tcp_server.py          # 基于自定义循环的 TCP 服务
└── benchmark.py           # 与 asyncio 做性能对比
```

### 项目 2：异步爬虫调度器

**目标**：构建一个带并发限制、超时重试、指数退避的通用异步爬虫调度器。

**步骤**：

1. 封装 `fetch_with_retry`（超时 + 退避重试）
2. 用 `Semaphore` 控制全局并发
3. 用 `TaskGroup` 结构化管理所有抓取任务
4. 解析结果并存入队列，实现生产者-消费者模型
5. 压测不同并发数下的吞吐与耗时曲线

**目录结构参考**：

```text
async-spider/
├── scheduler.py           # 调度器：信号量 + 任务组
├── fetcher.py             # 抓取器：超时/重试/退避
├── parser.py              # 解析器：HTML 解析
└── main.py                # 入口：配置并发数与目标 URL
```
