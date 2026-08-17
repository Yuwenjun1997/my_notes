---
url: >-
  /my_notes/notes/Python学习路线/di-er-jie-duan-web-kai-fa/1-wang-luo-bian-cheng-yu-yi-bu-ji-chu/index.md
---
# 网络编程与异步基础

## 一、HTTP 协议复习

### 1.1 HTTP 请求与响应

**HTTP（HyperText Transfer Protocol）** 是 Web 开发的基础协议，客户端（浏览器/代码）与服务端通过请求-响应模型通信。

**请求结构**：请求行（方法 + URL + 版本）+ 请求头 + 请求体。

```text
POST /api/users HTTP/1.1
Host: example.com
Content-Type: application/json
Authorization: Bearer xxxxx

{"name": "张三", "age": 20}
```

**常用请求方法**

| 方法 | 用途 | 幂等性 | 请求体 |
|------|------|:------:|:------:|
| `GET` | 查询资源 | ✅ | 通常无 |
| `POST` | 创建资源 | ❌ | 有 |
| `PUT` | 整体更新资源 | ✅ | 有 |
| `PATCH` | 部分更新资源 | ❌ | 有 |
| `DELETE` | 删除资源 | ✅ | 通常无 |

**响应结构**：状态行 + 响应头 + 响应体。

**常见状态码**

| 状态码 | 含义 | 常见场景 |
|--------|------|---------|
| `200` | OK | 请求成功 |
| `201` | Created | 创建成功 |
| `204` | No Content | 删除成功 |
| `301/302` | 重定向 | URL 跳转 |
| `400` | Bad Request | 参数错误 |
| `401` | Unauthorized | 未认证 |
| `403` | Forbidden | 无权限 |
| `404` | Not Found | 资源不存在 |
| `429` | Too Many Requests | 请求过频 |
| `500` | Internal Server Error | 服务器内部错误 |
| `502/503` | 网关/服务不可用 | 上游故障 |

### 1.2 常用请求头

| 请求头 | 作用 |
|--------|------|
| `User-Agent` | 标识客户端（浏览器/爬虫） |
| `Accept` | 期望的响应类型 |
| `Content-Type` | 请求体类型（`application/json` 等） |
| `Authorization` | 认证凭证（`Bearer <token>`） |
| `Cookie` | 携带会话信息 |
| `Referer` | 来源页面 |

***

## 二、HTTP 请求库

### 2.1 requests 库（同步）

`requests` 是 Python 最流行的同步 HTTP 客户端，API 简洁易用。

**基础请求**

```python
import requests

# GET 请求，query 参数自动拼接
resp = requests.get("https://httpbin.org/get",
                    params={"q": "python", "page": 1},
                    headers={"User-Agent": "my-app/1.0"},
                    timeout=5)  # 必须设置超时！

print(resp.status_code)      # 200
print(resp.headers)          # 响应头
print(resp.json())           # 解析 JSON 响应
```

**POST 与 JSON 数据**

```python
import requests

# 发送 JSON 请求体
resp = requests.post("https://httpbin.org/post",
                     json={"name": "张三", "age": 20},
                     headers={"Authorization": "Bearer xxx"},
                     timeout=5)

# 表单提交
resp = requests.post("https://httpbin.org/post",
                     data={"key": "value"},
                     timeout=5)
```

**会话与错误处理**

```python
import requests
from requests.exceptions import RequestException

# Session 复用连接，自动携带 Cookie
with requests.Session() as s:
    s.get("https://example.com/login")          # 登录，服务端 set-cookie
    resp = s.get("https://example.com/profile")  # 自动带上 Cookie

# 统一异常处理
try:
    resp = requests.get("https://example.com", timeout=3)
    resp.raise_for_status()   # 状态码 >= 400 时抛出 HTTPError
except RequestException as e:
    print(f"请求失败: {e}")
```

**要点：永远设置 `timeout`，否则可能无限阻塞。**

### 2.2 httpx 库（同步 + 异步）

`httpx` 是新一代 HTTP 客户端，同时支持同步与异步，API 与 requests 高度兼容，是 FastAPI 官方推荐的测试客户端底层。

**同步用法**

```python
import httpx

resp = httpx.get("https://httpbin.org/get",
                 params={"q": "python"},
                 headers={"User-Agent": "my-app"},
                 timeout=5.0)
print(resp.status_code, resp.json())
```

**异步用法**

```python
import asyncio
import httpx

async def fetch(url: str) -> dict:
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(url)
        return resp.json()

async def main():
    results = await asyncio.gather(
        fetch("https://httpbin.org/get?a=1"),
        fetch("https://httpbin.org/get?a=2"),
        fetch("https://httpbin.org/get?a=3"),
    )
    print(results)

asyncio.run(main())
```

**requests vs httpx 对比**

| 对比维度 | requests | httpx |
|---------|----------|-------|
| **异步支持** | 不支持（需 aiohttp） | ✅ 原生支持 |
| **HTTP/2** | 不支持 | ✅ 支持 |
| **API 风格** | 简洁成熟 | 与 requests 兼容 |
| **性能** | 较好 | 异步场景更优 |
| **生态** | 极成熟 | 快速崛起，FastAPI 官方使用 |

***

## 三、socket 编程基础

### 3.1 TCP 服务端与客户端

`socket` 是网络通信的最底层接口，HTTP 建立在 TCP 之上。了解 socket 有助于理解整个网络栈。

**TCP 服务端**

```python
import socket

server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
server.bind(("127.0.0.1", 8000))   # 绑定地址和端口
server.listen(5)                    # 监听，最多 5 个排队连接
print("服务端启动，等待连接...")

while True:
    conn, addr = server.accept()    # 阻塞等待客户端连接
    print(f"客户端连接: {addr}")
    data = conn.recv(1024)          # 接收数据（最多 1024 字节）
    print(f"收到: {data.decode()}")
    conn.sendall(b"Hello, client!") # 发送响应
    conn.close()                    # 关闭连接
```

**TCP 客户端**

```python
import socket

client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
client.connect(("127.0.0.1", 8000))  # 连接服务端
client.sendall(b"Hello, server!")    # 发送数据
data = client.recv(1024)             # 接收响应
print(f"服务端响应: {data.decode()}")
client.close()
```

**阻塞式 socket 的局限**：`accept()` 和 `recv()` 会阻塞当前线程，一个连接占用一个线程，高并发时资源消耗巨大。这就是异步 I/O 出现的原因。

### 3.2 网络模型演进

| 模型 | 原理 | 优点 | 缺点 |
|------|------|------|------|
| **阻塞 I/O（BIO）** | 每连接一线程 | 简单直观 | 线程开销大，并发有限 |
| **多路复用（select/epoll）** | 单线程监听多个 fd | 高并发、省资源 | 编程复杂 |
| **异步 I/O（asyncio）** | 事件循环 + 协程 | 极高并发、代码简洁 | 心智模型较难 |

***

## 四、asyncio 核心

### 4.1 事件循环与协程

**asyncio** 是 Python 标准库自带的异步 I/O 框架，核心是**事件循环**（Event Loop）与**协程**（Coroutine）。

* **事件循环**：一个永不退出的循环，不断检查是否有就绪的事件（I/O 完成、定时器到期）并执行对应的回调。
* **协程**：使用 `async def` 定义的函数，通过 `await` 挂起、让出控制权。

**基本用法**

```python
import asyncio

async def hello(name: str):
    print(f"开始 {name}")
    await asyncio.sleep(1)        # 模拟异步 I/O，不会阻塞事件循环
    print(f"结束 {name}")
    return f"Hello, {name}"

async def main():
    # 1. asyncio.run 启动事件循环并运行协程
    result = await hello("张三")
    print(result)

asyncio.run(main())
```

**并发执行任务**

```python
import asyncio

async def fetch(url: str, delay: float):
    await asyncio.sleep(delay)     # 模拟网络请求耗时
    return f"{url} 完成"

async def main():
    # gather：并发执行多个协程，全部完成后统一返回
    results = await asyncio.gather(
        fetch("https://api.example.com/a", 0.5),
        fetch("https://api.example.com/b", 0.3),
        fetch("https://api.example.com/c", 0.1),
    )
    print(results)  # 总耗时约 0.5 秒而非 0.9 秒

    # create_task：创建后台任务，不等待立即继续
    task = asyncio.create_task(fetch("https://api.example.com/d", 0.2))
    print("任务已创建，继续做其他事...")
    await task     # 最后再等待任务完成

asyncio.run(main())
```

**要点：同步 I/O（`time.sleep`、`requests.get`）会阻塞事件循环，必须使用异步版本（`asyncio.sleep`、`httpx.AsyncClient`）。**

### 4.2 常见异步函数

| 函数 | 作用 |
|------|------|
| `asyncio.run(coro)` | 创建事件循环并运行协程（程序入口） |
| `asyncio.gather(*coros)` | 并发执行多个协程 |
| `asyncio.create_task(coro)` | 创建后台任务 |
| `asyncio.sleep(sec)` | 异步睡眠 |
| `asyncio.wait_for(coro, timeout)` | 设置超时 |
| `asyncio.Semaphore(n)` | 并发信号量（限流） |

```python
import asyncio

async def slow_api(x: int):
    await asyncio.sleep(2)
    return x * 10

async def main():
    # wait_for：超时控制
    try:
        result = await asyncio.wait_for(slow_api(1), timeout=1.0)
    except asyncio.TimeoutError:
        print("请求超时！")

    # Semaphore：限制并发数，防止压垮下游
    sem = asyncio.Semaphore(3)

    async def limited(x: int):
        async with sem:                      # 同时最多 3 个进入
            return await slow_api(x)

    results = await asyncio.gather(*[limited(i) for i in range(10)])
    print(results)

asyncio.run(main())
```

### 4.3 aiohttp（异步 HTTP 客户端）

`aiohttp` 是老牌异步 HTTP 库，同时提供客户端和服务端功能。

```python
import asyncio
import aiohttp

async def fetch(session: aiohttp.ClientSession, url: str):
    async with session.get(url) as resp:
        return await resp.json()

async def main():
    # 复用同一个连接池
    async with aiohttp.ClientSession() as session:
        tasks = [fetch(session, f"https://httpbin.org/get?a={i}") for i in range(5)]
        results = await asyncio.gather(*tasks)
    print(results)

asyncio.run(main())
```

***

## 五、同步 vs 异步

### 5.1 性能对比

**同步串行**（每个请求阻塞等待，耗时为请求数 × 单请求耗时）：

```text
请求1 ▓▓▓▓▓ 1s → 请求2 ▓▓▓▓▓ 1s → 请求3 ▓▓▓▓▓ 1s = 3s
```

**异步并发**（I/O 等待时切换执行其他任务，耗时为最慢请求耗时）：

```text
请求1 ▓▓▓▓▓ 1s
请求2 ▓▓▓▓▓ 1s   ← 三者同时进行
请求3 ▓▓▓▓▓ 1s   = 1s
```

### 5.2 适用场景

| 场景 | 推荐 | 原因 |
|------|------|------|
| 爬虫大量抓取 | 异步（httpx/aiohttp） | I/O 密集，并发收益巨大 |
| 高并发 Web API | 异步（FastAPI） | 单进程可处理上万连接 |
| CPU 密集计算 | 多进程（multiprocessing） | 异步无法加速计算 |
| 简单脚本/教学 | 同步（requests） | 代码直观易调试 |

**# ❌ 同步库写在异步代码里，阻塞事件循环**

```python
import asyncio
import requests

async def bad():
    requests.get("https://httpbin.org/get", timeout=5)  # ❌ 阻塞整个事件循环！
    return "ok"

async def good():
    import httpx
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get("https://httpbin.org/get")  # ✅ 异步不阻塞
    return resp.status_code
```

### 5.3 ASGI 协议与 uvicorn

**ASGI（Asynchronous Server Gateway Interface）** 是 Python 异步 Web 的接口规范，类比同步时代的 WSGI。FastAPI 基于 ASGI，由 **uvicorn** 作为服务器运行。

**ASGI 应用本质**：一个接收 `scope / receive / send` 三个参数的异步函数。

```python
# 一个极简 ASGI 应用
async def app(scope, receive, send):
    assert scope["type"] == "http"
    await send({
        "type": "http.response.start",
        "status": 200,
        "headers": [(b"content-type", b"text/plain")],
    })
    await send({
        "type": "http.response.body",
        "body": b"Hello, ASGI!",
    })
```

```bash
# 用 uvicorn 启动（uvicorn 会调用 receive/send 与事件循环交互）
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

**WSGI vs ASGI**

| 对比维度 | WSGI | ASGI |
|---------|------|------|
| **支持异步** | ❌ | ✅ |
| **WebSocket** | ❌ | ✅ |
| **HTTP/2** | ❌ | ✅ |
| **代表框架** | Flask、Django 传统模式 | FastAPI、Starlette |
| **服务器** | gunicorn/uwsgi | uvicorn/hypercorn |

***

## 六、实践项目

### 项目 1：异步并发抓取接口并汇总

**目标**：使用 httpx 异步并发请求 5 个接口，统计总耗时并汇总结果。

**步骤**：

1. 创建虚拟环境并安装 `httpx`
2. 编写异步函数 `fetch_one(url)`，打印每个接口的耗时
3. 用 `asyncio.gather` 并发执行 5 个请求
4. 用 `time.perf_counter()` 对比同步串行与异步并发的总耗时
5. 用 `asyncio.Semaphore` 限制并发数，观察超限后的排队行为

**目录结构参考**：

```
async-crawler/
├── .venv/
├── main.py
└── requirements.txt
```

**关键代码预览**：

```python
import asyncio
import time
import httpx

URLS = [f"https://httpbin.org/delay/1?i={i}" for i in range(5)]

async def fetch(url: str):
    async with httpx.AsyncClient(timeout=10.0) as client:
        start = time.perf_counter()
        await client.get(url)
        print(f"{url} 耗时 {time.perf_counter() - start:.2f}s")

async def main():
    start = time.perf_counter()
    await asyncio.gather(*[fetch(url) for url in URLS])
    print(f"异步总耗时: {time.perf_counter() - start:.2f}s")

asyncio.run(main())
# 输出示例：5 个 1 秒接口，总耗时约 1 秒而非 5 秒
```
