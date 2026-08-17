---
url: >-
  /my_notes/notes/Python学习路线/di-si-jie-duan-fen-bu-shi-yu-bu-shu/4-xing-neng-you-hua/index.md
---
# 性能优化

## 一、性能分析工具

### 1.1 性能优化方法论

**先测量，再优化**——不要凭直觉猜测瓶颈，用数据说话：

```
1. 测量（Profile）   → 用工具定位热点代码
2. 分析（Analyze）   → 判断是 CPU、IO 还是内存问题
3. 优化（Optimize）  → 针对瓶颈做最小改动
4. 复测（Verify）    → 对比优化前后数据，确认效果
5. 回归（Guard）     → 用基准测试防止性能回退
```

### 1.2 cProfile：函数级 CPU 分析

```bash
# 命令行分析脚本
python -m cProfile -s cumulative slow_script.py
```

```python
# 代码内使用
import cProfile
import pstats
from io import StringIO

pr = cProfile.Profile()
pr.enable()
run_business_logic()          # 待分析的代码
pr.disable()

# 输出分析结果
s = StringIO()
ps = pstats.Stats(pr, stream=s).sort_stats("cumulative")   # 按累计耗时排序
ps.print_stats(20)            # 打印前 20 行
print(s.getvalue())
```

**输出字段解读**

| 字段 | 含义 | 关注点 |
|------|------|--------|
| ncalls | 调用次数 | 次数多说明被反复调用 |
| tottime | 自身耗时（不含子函数） | 自身代码热点 |
| cumtime | 累计耗时（含子函数） | 整条调用链热点 |
| percall | 单次平均耗时 | 找单次最慢的函数 |

### 1.3 line\_profiler：逐行分析

```bash
pip install line_profiler

# 在目标函数上加装饰器
kernprof -l -v slow_script.py
```

```python
# 标注要逐行分析的函数
@profile
def process_orders(orders: list[dict]) -> list[dict]:
    result = []
    for order in orders:                          # 逐行显示每行耗时
        cleaned = {
            "id": order["id"],
            "total": order["price"] * order["qty"],
        }
        result.append(cleaned)
    return result
```

### 1.4 memory\_profiler：内存分析

```python
from memory_profiler import profile

@profile
def load_large_data():
    # 观察每行分配/释放的内存量
    data = [{"id": i, "value": str(i) * 100} for i in range(100000)]
    result = sum(len(d["value"]) for d in data)
    return result
```

```bash
pip install memory_profiler
python -m memory_profiler slow_script.py
```

**内存优化小技巧**

```python
import gc

# 1. 大列表用生成器替代
# ❌ data = [transform(x) for x in huge_iterable]   # 全部驻留内存
# ✅ data = (transform(x) for x in huge_iterable)   # 惰性求值

# 2. 处理完的大对象及时释放并回收
del big_data
gc.collect()

# 3. 流式处理文件，不要一次读入
# ❌ with open("big.log") as f: content = f.read()
# ✅ for line in open("big.log"): process(line)
```

***

## 二、代码层面优化

### 2.1 数据结构选型

正确选择数据结构可以显著提升性能：

```python
import timeit

# 列表 vs 集合：成员判断
# ❌ 列表判断成员是 O(n)
500 in list(range(10000))          # O(n) 线性扫描

# ✅ 集合判断成员是 O(1)
500 in set(range(10000))           # O(1) 哈希查找
```

| 操作 | 列表 list | 集合 set | 字典 dict |
|------|----------|---------|----------|
| 成员判断 | O(n) | **O(1)** | **O(1)** |
| 按索引取 | **O(1)** | 不支持 | 不支持 |
| 队头插入/删除 | O(n) | 不支持 | 不支持 |
| 队尾追加 | **O(1)** | O(1) | O(1) |

**deque：双端队列**

```python
from collections import deque

# 频繁在头部插入/删除时用 deque（O(1)）
# ❌ 用 list 在头部 pop(0) 是 O(n)
queue = list()
queue.insert(0, 1)          # O(n) 需要移动所有元素

# ✅ deque 两端操作都是 O(1)
queue = deque()
queue.appendleft(1)         # O(1)
queue.popleft()             # O(1)
```

### 2.2 局部变量与避免重复计算

```python
# 1. 局部变量比全局变量快（CPython 使用 LOAD_FAST 指令）
# ❌ 循环内访问全局变量
GLOBAL_CONST = 100
def f1():
    total = 0
    for i in range(1000000):
        total += GLOBAL_CONST      # 全局查找较慢

# ✅ 先缓存到局部变量
def f2():
    const = GLOBAL_CONST
    total = 0
    for i in range(1000000):
        total += const             # 局部查找更快


# 2. 循环外提公共计算
# ❌ len 每次循环都计算
for i in range(len(items)): ...     # 实际上 Python 只算一次，但：
# ✅ 明确提取更清晰
n = len(items)
for i in range(n): ...


# 3. 字符串拼接用 join 而非 +=
# ❌ 循环内字符串累加产生大量临时对象
s = ""
for chunk in chunks:
    s += chunk

# ✅ join 一次性拼接
s = "".join(chunks)
```

### 2.3 lru\_cache 缓存函数结果

```python
from functools import lru_cache
import time

# 对纯函数（相同输入相同输出）做记忆化缓存
@lru_cache(maxsize=128)
def fibonacci(n: int) -> int:
    if n < 2:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)


# 计算斐波那契数列，缓存命中时直接返回
start = time.perf_counter()
print(fibonacci(35))        # 首次计算
print(f"耗时: {time.perf_counter() - start:.4f}s")
# 后续重复调用几乎零耗时
print(fibonacci(35))        # 缓存命中
```

```python
# 处理无法缓存的参数：maxsize 限制 + 小心可变参数
@lru_cache(maxsize=1024)
def query_user(user_id: int):
    ...
    # 注意：查询类函数若依赖外部状态变化会缓存过期数据
    # 可结合 ttl 手动清理：query_user.cache_clear()
```

### 2.4 Numba：JIT 加速计算密集代码

```python
import numba

# 对 CPU 密集的纯数值计算，用 JIT 编译到机器码
@numba.jit(nopython=True, cache=True)
def compute_sum(n: int) -> float:
    total = 0.0
    for i in range(n):
        total += i * 1.5
    return total

# 相比纯 Python 循环可提速 10~100 倍
# 局限：只支持数值运算与 NumPy，不适用字符串/对象操作
```

**何时该考虑 C 扩展 / Numba**

| 场景 | 方案 |
|------|------|
| 数值计算密集 | NumPy 向量化 / Numba |
| 需要极高性能 | 用 Cython / Rust 扩展（pyo3） |
| IO 密集 | 异步改造（见下一节） |

***

## 三、I/O 层面优化

### 3.1 同步 IO 改异步

网络请求、文件读写、数据库操作都是 IO 密集操作，阻塞时 CPU 空闲，适合异步：

```python
import asyncio
import httpx

# ❌ 同步串行请求，总耗时 = 各请求耗时之和
import requests

def sync_fetch(urls: list[str]) -> list:
    return [requests.get(u).json() for u in urls]   # 依次阻塞等待


# ✅ 异步并发请求，总耗时 ≈ 最慢的一个请求
async def async_fetch(urls: list[str]) -> list:
    async with httpx.AsyncClient() as client:
        tasks = [client.get(u) for u in urls]        # 并发发起
        responses = await asyncio.gather(*tasks)
        return [r.json() for r in responses]


# 在同步代码中桥接
results = asyncio.run(async_fetch(urls))
# 10 个请求：串行 10s → 并发 1s
```

### 3.2 批量操作

```python
# 数据库批量插入：单条 vs 批量
# ❌ 逐条插入，每次都有一次网络往返
for row in rows:
    session.execute(insert_stmt, row)

# ✅ 批量执行，一次提交多条
session.execute(insert_stmt, rows)    # executemany 一次往返
session.commit()
```

```python
# Redis Pipeline：减少网络往返
import redis

r = redis.Redis()

# ❌ 每条命令一次网络往返（n 条命令 n 次往返）
for key in keys:
    r.get(key)

# ✅ Pipeline 打包一次发送
pipe = r.pipeline(transaction=True)
for key in keys:
    pipe.get(key)
values = pipe.execute()               # 一次往返
```

### 3.3 连接池

数据库、Redis 建立连接开销大，必须使用连接池复用：

```python
# SQLAlchemy 连接池配置
from sqlalchemy import create_engine

engine = create_engine(
    "mysql+pymysql://user:pass@host/db",
    pool_size=10,             # 池中保持的连接数
    max_overflow=20,          # 峰值额外连接数
    pool_pre_ping=True,       # 取连接前先 ping 验证有效性
    pool_recycle=1800,        # 连接 30 分钟回收（避免被服务端断开）
)

# Redis 连接池
pool = redis.ConnectionPool(
    host="localhost", port=6379, max_connections=50,
)
r = redis.Redis(connection_pool=pool)
```

### 3.4 压缩与传输优化

```python
from fastapi import FastAPI, Response
import gzip

# HTTP 响应启用 gzip 压缩（文本类内容体积可降 70%+）
@app.get("/data")
def get_data():
    payload = json.dumps(large_data, ensure_ascii=False)
    compressed = gzip.compress(payload.encode("utf-8"))
    return Response(
        content=compressed,
        media_type="application/json",
        headers={"Content-Encoding": "gzip"},
    )
```

***

## 四、数据库优化

### 4.1 索引设计

```sql
-- 1. 为高频查询条件建索引
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- 2. 联合索引遵循最左前缀原则
-- 查询 WHERE user_id=? AND status=? → 建 (user_id, status)
-- 查询 WHERE user_id=? → 也能命中该联合索引
CREATE INDEX idx_user_status ON orders(user_id, status);

-- 3. 避免对索引列做函数运算（导致索引失效）
-- ❌ WHERE YEAR(create_time) = 2026  无法走索引
-- ✅ WHERE create_time >= '2026-01-01' AND create_time < '2027-01-01'
```

### 4.2 EXPLAIN 分析

```python
# SQLAlchemy 打印实际 SQL 并解释执行计划
stmt = select(Order).where(Order.user_id == 42)
print(stmt)                                   # 先看生成什么 SQL

# 在 MySQL 中执行 EXPLAIN 查看是否走索引
# EXPLAIN SELECT * FROM orders WHERE user_id = 42;
```

**EXPLAIN 关键列解读**

| 列 | 含义 | 健康值 |
|----|------|--------|
| type | 访问类型 | `ref`/`range` 优，`ALL` 全表扫描差 |
| key | 实际使用的索引 | 不为 NULL |
| rows | 预估扫描行数 | 越小越好 |
| Extra | 附加信息 | 出现 `Using filesort`/`Using temporary` 需优化 |

### 4.3 慢查询与缓存策略

```python
# 1. 开启 MySQL 慢查询日志
# SET GLOBAL slow_query_log = ON;
# SET GLOBAL long_query_time = 1;    # 超过 1 秒的记录

# 2. 高频读接口加 Redis 缓存
import redis

r = redis.Redis()

def get_hot_news(news_id: int) -> dict:
    # 先查缓存
    cached = r.get(f"news:{news_id}")
    if cached:
        return json.loads(cached)

    # 缓存未命中再查库
    news = db.query_news(news_id)
    r.setex(f"news:{news_id}", 300, json.dumps(news))   # 5 分钟过期
    return news


# 3. 分页查询用覆盖索引 + 延迟关联
# ❌ SELECT * FROM orders ORDER BY create_time DESC LIMIT 100000, 20;
#    深分页会扫描大量行
# ✅ SELECT * FROM (
#       SELECT id FROM orders ORDER BY create_time DESC LIMIT 100000, 20
#    ) t JOIN orders o ON o.id = t.id;
```

***

## 五、Web 与部署优化

### 5.1 异步端点与任务下放

```python
from fastapi import FastAPI
from celery import Celery

app = FastAPI()
celery = Celery("tasks", broker="redis://localhost:6379/0")


@celery.task
def send_batch_email(user_ids: list[int]):
    # 耗时任务：邮件批量发送
    ...


@app.post("/orders")
async def create_order(order_data: dict):
    # 同步操作：快速响应
    order = save_order(order_data)

    # 耗时操作：下放给 Celery 异步处理，接口立即返回
    send_batch_email.delay(order_data["user_ids"])
    return {"order_id": order.id, "status": "created"}
```

### 5.2 静态资源与 CDN

```bash
# 静态资源交给 Nginx/CDN，不经过 Python 应用
location /static/ {
    alias /var/www/app/static/;
    expires 30d;                    # 长缓存
    add_header Cache-Control "public, immutable";
}

# 图片等大文件走对象存储（OSS/S3）+ CDN 加速
```

### 5.3 负载均衡与多实例

```nginx
# Nginx 多实例负载均衡
upstream fastapi_backend {
    least_conn;                      # 最少连接算法
    server 10.0.0.1:8000;
    server 10.0.0.2:8000;
    server 10.0.0.3:8000;
}

server {
    listen 80;
    location / {
        proxy_pass http://fastapi_backend;
    }
}
```

**多实例部署注意事项**

1. 会话状态不要存本地内存（多实例不一致），用 Redis/JWT
2. 文件上传存对象存储，不落本地磁盘
3. 定时任务只在一个实例跑，或使用分布式锁/集中调度

### 5.4 基准测试方法

```python
import timeit

# 对比两种实现的性能
setup = "from collections import Counter; data = ['a','b','a','c'] * 1000"

manual = timeit.timeit(
    """\
counts = {}
for x in data:
    counts[x] = counts.get(x, 0) + 1
""", setup=setup, number=1000)

with_counter = timeit.timeit(
    """\
counts = Counter(data)
""", setup=setup, number=1000)

print(f"手动统计: {manual:.4f}s")
print(f"Counter:  {with_counter:.4f}s")
```

***

## 六、实践项目

### 项目 1：定位并优化慢接口

**目标**：对一个模拟的高延迟接口做性能分析与优化，对比优化前后耗时。

**步骤**：

1. 编写一个含多重循环、重复查询、同步串行 IO 的模拟接口
2. 用 cProfile 定位 CPU 热点，用 line\_profiler 定位具体行
3. 用 lru\_cache、数据去重、异步并发等手段优化
4. 用 timeit / AP 压测对比优化前后的 P95 延迟
5. 用 memory\_profiler 检查内存是否有泄漏

**目录结构参考**：

```
perf-optimize/
├── slow_app/
│   ├── main.py            # 慢接口
│   └── optimized.py       # 优化后的接口
├── profiles/
│   └── report.txt         # 分析报告
└── benchmark.py           # 基准对比脚本
```

### 项目 2：数据库查询优化实战

**目标**：模拟 10 万条订单数据，优化分页与聚合查询性能。

**步骤**：

1. 建表并插入 10 万条测试数据
2. 用 EXPLAIN 分析几个慢查询的执行计划
3. 设计合理索引，验证执行计划改善
4. 对高频读接口接入 Redis 缓存
5. 对比优化前后查询耗时并记录报告

**目录结构参考**：

```
db-optimize/
├── init_data.py           # 造数脚本
├── queries.py             # 慢查询样例
├── optimize_index.py      # 索引优化
├── cache_redis.py         # 缓存接入
└── benchmark.py           # 耗时对比
```
