---
url: /my_notes/notes/Python学习路线/kai-fa-su-cha-shou-ce/index.md
---
# 🚀 Python 开发速查手册

> 集中收录「常用开发技巧」与「常用库分类清单」，开发时快速查阅。本手册不要求通读，按需翻阅即可。

***

## 📋 目录

* 一、常用开发技巧（1.1 ~ 1.15）
* 二、常用库分类清单
* 三、命令行与调试速查

***

## 一、常用开发技巧

### 1.1 虚拟环境与包管理

**创建与激活**：虚拟环境用于隔离项目依赖，避免全局环境污染。

```bash
# Windows
python -m venv .venv
.venv\Scripts\activate        # 激活
deactivate                    # 退出

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate
```

**依赖导出与安装**

```bash
pip freeze > requirements.txt          # 导出当前环境全部依赖
pip install -r requirements.txt        # 按清单安装
pip list --outdated                    # 查看可升级的包
```

**uv（新一代包管理器，推荐）**

```bash
uv venv                                # 创建虚拟环境
uv pip install requests                # 安装包
uv pip sync requirements.txt           # 精确同步依赖
uv pip compile pyproject.toml -o requirements.txt   # 生成锁定文件
```

### 1.2 路径与文件操作

**pathlib 现代写法**：优先用 `pathlib` 而非 `os.path` 拼接。

```python
from pathlib import Path

base = Path("data")
csv_path = base / "2026" / "report.csv"     # ✅ 跨平台路径拼接
csv_path = Path(f"data/2026/report.csv")    # 等价写法

# 文件读写
text = csv_path.read_text(encoding="utf-8")
csv_path.write_text("name,age\n", encoding="utf-8")

# 遍历与查找
for f in base.glob("**/*.csv"):             # 递归查找
    print(f.name, f.stat().st_size)
```

**open 模式对照**

| 模式 | 含义 | 示例 |
|:-----|:-----|:-----|
| `r` | 只读（默认） | `open("a.txt")` |
| `w` | 写入（覆盖） | `open("a.txt", "w")` |
| `a` | 追加 | `open("a.txt", "a")` |
| `rb` / `wb` | 二进制读写 | 图片、文件传输 |
| `r+` | 读写 | 少用，易出错 |

**临时文件**：`tempfile.NamedTemporaryFile(delete=False, suffix=".tmp")` 可跨平台创建临时文件。

### 1.3 字符串与文本处理

**F-string 格式规范**（Python 3.11+）

```python
name, price = "咖啡", 3.14159
print(f"{name:<10}|{price:.2f}")        # 左对齐 10 宽，保留 2 位小数
print(f"{price:>8.1f}")                 # 右对齐，1 位小数
print(f"{1000000:,}")                   # 千分位：1,000,000
print(f"{0.5:.0%}")                     # 百分比：50%
```

**字符串常用操作**

```python
s = "  hello, world  "
s.strip()                                # 去首尾空白
s.split(", ")                            # 切分
", ".join(["a", "b"])                    # 拼接（勿用 + 拼大量字符串）
s.replace("hello", "hi")
```

**正则常用模式**

| 模式 | 含义 | 示例 |
|:-----|:-----|:-----|
| `\d+` | 数字 | `re.findall(r"\d+", "a1b22")` → `['1','22']` |
| `\w+` | 字母数字下划线 | 匹配标识符 |
| `.*?` | 非贪婪任意 | 抓取 `<...>` 内容 |
| `^` / `$` | 行首 / 行尾 | 匹配整行 |
| `re.search` / `re.findall` / `re.sub` | 查找 / 全部 / 替换 | 三件套 |

### 1.4 日期时间处理

**datetime 基本用法**

```python
from datetime import datetime, timezone, timedelta

now = datetime.now()                     # 本地时间
utc = datetime.now(timezone.utc)         # 推荐：带时区的 UTC
iso = now.isoformat()                    # '2026-08-15T10:30:00'
parsed = datetime.fromisoformat(iso)     # 反向解析

print(now.strftime("%Y-%m-%d %H:%M:%S")) # 格式化输出
```

**时区陷阱**

```python
# ❌ 直接比较无时区时间（naive）与时区时间（aware）会抛异常
# ✅ 统一使用带时区的时间，存储用 UTC
utc_now = datetime.now(timezone.utc)
cn_now = utc_now + timedelta(hours=8)    # 转北京时间
```

### 1.5 数据结构与容器

**collections 速查**

```python
from collections import Counter, defaultdict, deque, namedtuple

Counter("aabbc")                       # 计数 → Counter({'a':2,'b':2,'c':1})
d = defaultdict(list)                  # 缺失键自动初始化
d["users"].append("tom")               # 无需判空
q = deque(["a"], maxlen=3)             # 双向队列，满则挤出
Point = namedtuple("Point", ["x", "y"])
p = Point(1, 2)                        # 带字段名的元组
```

**解包技巧**

```python
a, *rest, z = [1, 2, 3, 4]             # a=1, rest=[2,3], z=4
d1, d2 = {"a": 1}, {"b": 2}
merged = {**d1, **d2}                  # 合并字典（3.9+ 可用 | 运算符）
first, second = (1, 2)
```

### 1.6 函数式与装饰器

**常用 functools 工具**

```python
from functools import lru_cache, partial, wraps

@lru_cache(maxsize=128)                # 缓存函数结果（递归/计算密集）
def fib(n): ...

pow2 = partial(pow, exp=2)             # 部分应用：pow2(3) == 9
```

**装饰器模板**

```python
import time

def timer(func):
    @wraps(func)                       # ✅ 保留原函数名与文档
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        print(f"{func.__name__} took {time.perf_counter()-start:.3f}s")
        return result
    return wrapper
```

### 1.7 异常处理与调试

**try/except 完整结构**

```python
try:
    result = risky_operation()
except ValueError as e:
    print(f"参数错误: {e}")            # 捕获具体异常
except (KeyError, IndexError):
    print("数据缺失")
else:
    print("无异常时执行")              # ✅ 避免 try 内写业务代码
finally:
    cleanup()                          # 无论是否异常都执行
```

**异常链与自定义异常**

```python
# ❌ raise 会丢失原始上下文
# ✅ 用 raise ... from 保留异常链
try:
    parse(data)
except ParseError as e:
    raise ServiceError("解析失败") from e
```

**pdb 调试**：在代码中插入 `breakpoint()`，运行时进入调试器；常用命令 `n` 下一步、`s` 进入函数、`p 变量` 打印、`c` 继续。

### 1.8 日志速查

**logging 基础配置**

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)
logger.info("用户登录: %s", user_id)    # ✅ 勿用 f-string，惰性格式化
```

**文件轮转 + JSON 结构化**

```python
from logging.handlers import RotatingFileHandler

handler = RotatingFileHandler("app.log", maxBytes=10*1024*1024, backupCount=5)
logging.getLogger().addHandler(handler)

# 结构化日志（便于 ELK/Loki 收集）
import json, logging
logging.basicConfig(format='{"ts":"%(asctime)s","level":"%(levelname)s","msg":"%(message)s"}')
```

### 1.9 类型提示与校验

**typing 常用注解**

```python
from typing import Optional, Union, Literal, Protocol

def find(user_id: int) -> Optional[dict]: ...   # 可能返回 None
def send(msg: str, channel: Literal["sms", "email"]) -> bool: ...
data: dict[str, int] = {"a": 1}                # 3.9+ 可直接用内置泛型
```

**Pydantic 模型模板**

```python
from pydantic import BaseModel, Field, EmailStr

class UserIn(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    age: int = Field(ge=0, le=150)
    email: EmailStr

user = UserIn(name="Tom", age=30, email="t@e.com")   # 校验失败即抛异常
```

### 1.10 并发与异步速查

**asyncio 三件套**

```python
import asyncio

async def fetch(url: str): ...
async def main():
    tasks = [fetch(f"https://api/x/{i}") for i in range(10)]
    results = await asyncio.gather(*tasks)          # ✅ 并发收集
    t = asyncio.create_task(fetch("/slow"))          # 后台任务
    await asyncio.sleep(0)                           # 让出控制权

asyncio.run(main())
```

**线程池模板**（CPU 之外的阻塞 IO 用线程）

```python
from concurrent.futures import ThreadPoolExecutor

with ThreadPoolExecutor(max_workers=8) as pool:
    results = list(pool.map(process_item, items))   # 保持顺序
```

### 1.11 网络请求与 HTTP

**httpx（同步 + 异步二合一，推荐）**

```python
import httpx

# 同步
resp = httpx.get("https://api.example.com/users",
                 params={"page": 1},
                 timeout=5.0)
data = resp.json()

# 异步
async def get():
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post("/login", json={"user": "tom", "pwd": "x"})
        return r.json()
```

**超时与重试**

```python
# ❌ 不带 timeout 可能永久挂起
# ✅ 总是设置超时
try:
    r = httpx.get(url, timeout=3.0)
    r.raise_for_status()               # 非 2xx 抛异常
except httpx.HTTPStatusError:
    log_error(url, r.status_code)
```

### 1.12 数据库与缓存速查

**SQLAlchemy 2.0 查询**

```python
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

engine = create_engine("postgresql+psycopg://user:pwd@localhost/db",
                       pool_size=10, max_overflow=5)
with Session(engine) as s:
    stmt = select(User).where(User.age >= 18).order_by(User.name).limit(10)
    users = s.scalars(stmt).all()      # ✅ 2.0 风格 select() 语句
```

**redis-py 模板**

```python
import redis

r = redis.Redis(host="localhost", port=6379, decode_responses=True)
r.setex("k", 60, "value")              # 带过期时间
r.pipeline()                           # 批量操作（减少 RTT）
```

### 1.13 Web 开发速查（FastAPI）

**最小完整应用**

```python
from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel

app = FastAPI()

class Item(BaseModel):
    name: str
    price: float

@app.get("/items/{item_id}")
def get_item(item_id: int):
    if item_id > 100:
        raise HTTPException(status_code=404, detail="未找到")
    return {"id": item_id}
```

**依赖注入 + 响应模型**

```python
def get_db(): ...                      # 依赖函数

@app.post("/items", response_model=Item)     # ✅ 输出字段白名单
def create_item(item: Item, db=Depends(get_db)):
    ...
```

**CORS 配置**

```python
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(CORSMiddleware,
    allow_origins=["http://localhost:5173"],   # ✅ 生产勿用 ["*"]
    allow_methods=["*"], allow_headers=["*"])
```

### 1.14 数据处理速查（pandas）

**读表与筛选**

```python
import pandas as pd

df = pd.read_csv("sales.csv")                # 读 CSV
df = pd.read_excel("data.xlsx", sheet_name="Sheet1")   # 读 Excel
filtered = df[(df["amount"] > 100) & (df["city"] == "上海")]   # 条件筛选（勿用 and，用 &）
```

**聚合与导出**

```python
summary = df.groupby("city")["amount"].agg(["sum", "mean", "count"])
df["date"] = pd.to_datetime(df["date"])      # 时间类型转换
df.to_csv("out.csv", index=False, encoding="utf-8-sig")   # ✅ Excel 打开不乱码
```

### 1.15 性能优化与排查

**定位热点**

```bash
python -m cProfile -s cumulative app.py      # 函数级耗时排序
python -m pip install line_profiler && kernprof -l -v app.py   # 逐行分析
```

**timeit 微基准**

```python
import timeit
timeit.timeit(lambda: ",".join(["a"]*1000), number=10000)   # 对比写法性能
```

**常见性能反模式**

```python
# ❌ 列表内循环拼接字符串（O(n²)）
# ✅ 用 join 或生成器
# ❌ 循环内反复访问远程/数据库（网络 RTT 累积）
# ✅ 批量查询 + 缓存（见 1.12）
# ❌ 在热路径用慢函数（如 datetime 重复解析）
# ✅ 用 lru_cache 缓存计算结果（见 1.6）
```

***

## 二、常用库分类清单

| 类别 | 关键库 | 一句话说明 |
|:-----|:-------|:-----------|
| **Web 框架** | FastAPI、Django、Flask、Starlette、Sanic | 核心 Web 开发框架（异步首选 FastAPI，全家桶选 Django） |
| **ASGI/WSGI 服务器** | uvicorn、hypercorn、gunicorn | 生产部署服务器，uvicorn 配 FastAPI、gunicorn 配 WSGI 应用 |
| **HTTP 客户端** | httpx、requests、aiohttp、urllib3 | 发起 HTTP 请求（httpx 支持同步+异步） |
| **数据校验** | pydantic、attrs、marshmallow | 数据模型定义与运行时校验 |
| **ORM 数据库** | SQLAlchemy 2.0、SQLModel、Tortoise-ORM、Peewee | 关系型数据库 ORM（SQLModel 为 Pydantic+SQLAlchemy 融合） |
| **数据库驱动** | psycopg、asyncpg、pymysql、redis、motor | 底层连接驱动（PG / PG异步 / MySQL / Redis / MongoDB） |
| **迁移工具** | Alembic、yoyo-migrations | 数据库 Schema 版本管理（配合 SQLAlchemy） |
| **缓存** | redis、aiocache、cachetools、joblib | 分布式缓存客户端与函数级缓存 |
| **任务队列** | Celery、Dramatiq、ARQ、huey | 分布式异步任务（Celery 生态最全） |
| **定时任务** | APScheduler、celery-beat、schedule | 定时调度（进程内用 APScheduler，分布式用 celery-beat） |
| **测试** | pytest、pytest-asyncio、pytest-cov、factory\_boy、hypothesis、locust | 单元/异步/覆盖率/数据工厂/属性测试/性能压测 |
| **安全认证** | passlib、PyJWT、python-jose、cryptography、itsdangerous | 密码哈希、JWT 签发校验、加解密 |
| **数据处理** | numpy、pandas、polars、openpyxl | 数值计算与数据分析（大数据量可选 polars） |
| **数据可视化** | matplotlib、seaborn、plotly、pyecharts | 静态/统计/交互式图表 |
| **爬虫** | BeautifulSoup4、lxml、Scrapy、Playwright、Selenium | HTML 解析与网页抓取（动态页用 Playwright/Selenium） |
| **并发异步** | asyncio、anyio、trio、aiofiles、concurrent.futures | 协程/异步 IO/线程池 |
| **配置管理** | pydantic-settings、python-dotenv、dynaconf | 环境变量与配置加载 |
| **日志监控** | loguru、structlog、sentry-sdk、prometheus-client | 易用日志、结构化日志、异常监控、指标暴露 |
| **代码质量** | ruff、black、isort、mypy、pyright、pre-commit | Lint/格式化/导入排序/类型检查/提交钩子 |
| **包管理** | pip、uv、poetry、pip-tools、conda | 依赖与环境管理（uv 速度最快） |
| **CLI 开发** | typer、click、rich、tqdm | 命令行工具、富文本输出、进度条 |
| **消息客户端** | pika、kombu、kafka-python、confluent-kafka | 消息队列客户端（RabbitMQ / Kafka） |
| **AI/ML** | openai、langchain、langgraph、scikit-learn、torch、transformers、chromadb、faiss | LLM 应用、Agent 编排、机器学习、向量检索 |
| **部署运维** | docker、docker-compose、fabric、paramiko、supervisor | 容器、远程运维、进程守护 |

***

## 三、命令行与调试速查

**pip / uv 常用命令**

```bash
pip install requests                 # 安装
pip uninstall requests               # 卸载
pip show requests                    # 查看包信息
uv add requests                      # uv 安装（自动写入 pyproject.toml）
uv remove requests
```

**`python -m` 约定**：把模块当作脚本运行，比直接执行更可靠（自动带上当前目录到 sys.path）：

```bash
python -m venv .venv                 # 创建虚拟环境
python -m pip install -r requirements.txt
python -m pytest                     # 运行测试
python -m http.server 8000           # 快速起静态文件服务器
python -m json.tool data.json        # 格式化 JSON
python -m unittest discover          # 运行 unittest
```

**venv 激活**（见 1.1），Windows 下也可用 `.venv\Scripts\python.exe` 直接调解释器，无需激活。

**镜像源配置**（国内加速）

```bash
# 临时使用
pip install requests -i https://pypi.tuna.tsinghua.edu.cn/simple
# 永久配置（推荐）
pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple
# uv 方式
uv pip install requests --index-url https://pypi.tuna.tsinghua.edu.cn/simple
```

**pdb 调试命令**

| 命令 | 含义 |
|:-----|:-----|
| `n` | 执行下一行 |
| `s` | 进入函数 |
| `c` | 继续运行到断点/结束 |
| `p <变量>` | 打印变量值 |
| `q` | 退出调试器 |

**常用调试技巧**

* 代码里插 `breakpoint()` 即可进入 pdb，无需 IDE
* 打印变量用 `f"{var=}"`（3.8+）自动带变量名：`print(f"{data=}")`
* 排查导入问题：`python -c "import requests; print(requests.__file__)"` 看实际加载路径
* 查看异常完整堆栈：`python -m trace --trace app.py`（过于详细，一般用 pytest 的 `-l` 局部变量或日志替代）
