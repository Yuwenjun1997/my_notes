---
url: >-
  /my_notes/notes/Python学习路线/di-yi-jie-duan-python-ji-chu/4-biao-zhun-ku-jing-jiang/index.md
---
# 标准库精讲

## 一、文件与路径

### 1.1 os vs pathlib

Python 提供两套路径 API：传统 `os.path` 与面向对象的 `pathlib.Path`。**新项目推荐 pathlib**。

```python
from pathlib import Path

# pathlib 路径拼接（跨平台）
base = Path("data")
path = base / "2026" / "report.json"     # data/2026/report.json

# 常用操作
path.exists()          # 是否存在
path.is_file()         # 是否文件
path.is_dir()          # 是否目录
path.name              # report.json      文件名
path.stem              # report           去后缀名
path.suffix            # .json            后缀
path.parent            # data/2026        父目录
path.resolve()         # 绝对路径

# 遍历目录
for p in Path("data").glob("**/*.json"):    # 递归查找
    print(p)

for p in Path("data").iterdir():            # 遍历直接子项
    print(p)
```

**os vs pathlib 对比**

| 场景 | os | pathlib |
|:-----|:---|:--------|
| 拼接路径 | `os.path.join(a, b)` | `a / b` |
| 判断存在 | `os.path.exists(p)` | `Path(p).exists()` |
| 遍历目录 | `os.listdir(d)` | `Path(d).iterdir()` |
| 递归查找 | `os.walk(d)` | `Path(d).rglob("*.py")` |

### 1.2 文件读写与上下文管理器

```python
from pathlib import Path

p = Path("data.txt")

# 写入 / 追加
p.write_text("第一行\n", encoding="utf-8")
with p.open("a", encoding="utf-8") as f:
    f.write("追加行\n")

# 读取
content = p.read_text(encoding="utf-8")

# 大文件逐行读（推荐）
with p.open("r", encoding="utf-8") as f:
    for line in f:
        ...

# 临时文件
import tempfile
with tempfile.TemporaryDirectory() as tmp:
    tmp_path = Path(tmp) / "a.json"
    tmp_path.write_text("{}")
    # 退出 with 后自动清理
```

**读写模式对照**

| 模式 | 说明 |
|:-----|:-----|
| `r` | 只读（默认），文件必须存在 |
| `w` | 写入，覆盖原内容 |
| `a` | 追加 |
| `r+` | 读写 |
| `b` | 二进制（如 `rb`、`wb`） |
| `x` | 独占创建，已存在则报错 |

### 1.3 二进制与字节

```python
# 二进制文件读写
with open("img.png", "rb") as f:
    data = f.read()

# struct 解析二进制结构
import struct
num, flag = struct.unpack("<i?", b"\x01\x00\x00\x00\x01")   # (1, True)
```

***

## 二、序列化、时间与正则

### 2.1 json 序列化

```python
import json

data = {"name": "张三", "age": 25, "tags": ["python", "backend"]}

# 序列化
text = json.dumps(data, ensure_ascii=False, indent=2)
# ensure_ascii=False 保留中文；indent=2 美化输出

# 反序列化
obj = json.loads(text)

# 文件读写
import json
with open("data.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False)

with open("data.json", "r", encoding="utf-8") as f:
    obj = json.load(f)
```

> ⚠️ JSON 键只能是字符串，中文键需要 `ensure_ascii=False` 才能直观显示。

### 2.2 csv 读写

```python
import csv

# 读取
with open("users.csv", "r", newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)            # 按表头读为字典
    for row in reader:
        print(row["name"], row["age"])

# 写入
rows = [["name", "age"], ["张三", 25], ["李四", 30]]
with open("out.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerows(rows)
```

### 2.3 datetime 与 timezone

```python
from datetime import datetime, date, timezone, timedelta

now = datetime.now()                      # 本地时间
utc_now = datetime.now(timezone.utc)      # 带时区

# 解析与格式化
dt = datetime.fromisoformat("2026-08-15T10:30:00")   # 解析 ISO 格式
text = dt.strftime("%Y-%m-%d %H:%M:%S")             # 格式化为字符串
date_obj = date(2026, 8, 15)

# 时间差计算
delta = datetime(2026, 9, 1) - datetime(2026, 8, 15)
print(delta.days)        # 17
print(delta.total_seconds())

# 时区转换
from zoneinfo import ZoneInfo
beijing = now.astimezone(ZoneInfo("Asia/Shanghai"))
print(beijing)
```

**常用 strftime 格式**

| 格式 | 含义 | 示例 |
|:-----|:-----|:-----|
| `%Y-%m-%d` | 年-月-日 | 2026-08-15 |
| `%H:%M:%S` | 时:分:秒 | 10:30:00 |
| `%A` | 星期全名 | Saturday |
| `%b` | 英文月份缩写 | Aug |
| `%j` | 一年中第几天 | 227 |

> ❌ **不要在业务中到处硬编码时区偏移**。统一存 UTC，展示时再转换本地时区。

### 2.4 re 正则表达式

```python
import re

pattern = r"^[a-zA-Z0-9_]{4,20}$"    # 用户名：4-20位字母数字下划线
text = "user_123"

# 判断匹配
re.match(pattern, text) is not None

# 搜索与提取
m = re.search(r"(\d{4})-(\d{2})-(\d{2})", "今天是2026-08-15")
year, month, day = m.groups()

# 查找所有
emails = re.findall(r"[\w.]+@[\w.]+\.\w+", "a@x.com 和 b@y.org")

# 替换
new = re.sub(r"\s+", " ", "多  个   空格")

# 编译复用
email_re = re.compile(r"^[\w.]+@[\w.]+\.\w+$")
```

**常用正则模式**

| 模式 | 含义 |
|:-----|:-----|
| `\d` / `\w` / `\s` | 数字 / 字母数字下划线 / 空白 |
| `+` / `*` / `?` | 至少1个 / 0或多个 / 0或1个 |
| `{m,n}` | m 到 n 次 |
| `^` / `$` | 行首 / 行尾 |
| `[^...]` | 排除字符集 |
| `(?:...)` | 非捕获分组 |

> ❌ **不要** 用正则解析 HTML / JSON，应使用专门的解析库（BeautifulSoup、json）。

***

## 三、collections 与 itertools

### 3.1 collections 速查

```python
from collections import Counter, defaultdict, deque, namedtuple, OrderedDict

# Counter 计数
words = ["a", "b", "a", "c", "a", "b"]
counter = Counter(words)
counter.most_common(2)          # [('a', 3), ('b', 2)]
counter["a"]                    # 3（键不存在返回0）

# defaultdict 带默认值
groups = defaultdict(list)      # 缺失键自动创建空列表
for name in ["张三", "李四", "张三"]:
    groups[name].append("x")
# defaultdict(list, {'张三': ['x', 'x'], '李四': ['x']})

# deque 双端队列（高效两端操作）
dq = deque(maxlen=3)            # 定长队列，超长自动丢弃
dq.append(1)
dq.appendleft(0)

# namedtuple 具名元组
Point = namedtuple("Point", ["x", "y"])
p = Point(3, 4)
p.x, p.y                       # 按属性访问
```

### 3.2 itertools 常用工具

```python
from itertools import chain, groupby, product, islice, cycle, count

# chain 串联多个可迭代
list(chain([1, 2], [3, 4]))              # [1, 2, 3, 4]

# product 笛卡尔积
list(product([1, 2], ["a", "b"]))        # [(1,'a'),(1,'b'),(2,'a'),(2,'b')]

# groupby 分组（需先排序）
from operator import itemgetter
items = [("A", 1), ("A", 2), ("B", 3)]
for key, group in groupby(items, key=itemgetter(0)):
    print(key, list(group))

# islice 切片迭代器
list(islice(range(100), 5))              # [0, 1, 2, 3, 4]

# count 无限计数
for i in islice(count(10), 3):           # 10, 11, 12
    ...
```

### 3.3 functools 常用工具

```python
from functools import partial, lru_cache, reduce, wraps

# partial 固定部分参数
def power(base, exp):
    return base ** exp

square = partial(power, exp=2)
square(5)                    # 25

# lru_cache 记忆化缓存
@lru_cache(maxsize=128)
def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)

fib.cache_info()             # 命中率统计
fib.cache_clear()            # 清空缓存

# reduce 累计归约
reduce(lambda a, b: a + b, [1, 2, 3, 4])   # 10
```

***

## 四、logging、typing 与常用工具

### 4.1 logging 日志配置

```python
import logging

# 快速单文件配置
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(),                             # 输出到控制台
        logging.FileHandler("app.log", encoding="utf-8"),    # 输出到文件
    ],
)

logger = logging.getLogger(__name__)
logger.debug("调试信息")      # 默认不显示
logger.info("服务启动")
logger.warning("磁盘空间不足")
logger.error("数据库连接失败", exc_info=True)   # 附带堆栈
```

**日志级别**

| 级别 | 数值 | 适用场景 |
|:-----|:-----|:---------|
| DEBUG | 10 | 调试细节 |
| INFO | 20 | 正常运行信息 |
| WARNING | 30 | 潜在问题提示 |
| ERROR | 40 | 功能出错 |
| CRITICAL | 50 | 严重故障 |

> ❌ **不要** 用 `print()` 打日志。生产环境应使用 logging，支持分级、滚动、JSON 结构化输出。

### 4.2 typing 类型注解

```python
from typing import Optional, Union, Literal, Callable, TypeVar, Protocol

# 常用容器注解
def process(data: list[dict[str, int]]) -> None: ...
# 3.9+ 可直接用 list[..]、dict[..]、set[..]

# Optional / Union
def find(key: str) -> Optional[int]:
    return None if key not in store else store[key]

# Literal 限定取值
def set_mode(mode: Literal["dev", "prod"]) -> None: ...

# Callable 函数签名
def apply(fn: Callable[[int, int], int], a: int, b: int) -> int:
    return fn(a, b)

# TypeVar 泛型
T = TypeVar("T")
def first(items: list[T]) -> T:
    return items[0]
```

### 4.3 常用工具模块

```python
import hashlib, uuid, random, subprocess

# 哈希
sha = hashlib.sha256("secret".encode()).hexdigest()
print(len(sha))                # 64 位十六进制

# UUID
uid = uuid.uuid4()             # 随机 UUID，适合作主键
print(uid)

# random 随机
random.randint(1, 100)         # 随机整数
random.choice(["a", "b", "c"])  # 随机取一个
random.sample(range(100), 5)   # 不重复抽样

# subprocess 调用外部命令
import subprocess
result = subprocess.run(
    ["python", "-c", "print('hi')"],
    capture_output=True,
    text=True,
    timeout=10,
)
print(result.stdout)           # hi
print(result.returncode)       # 0
```

> ⚠️ `subprocess` 传参**永远用列表**，不要用字符串拼接，避免命令注入风险。

***

## 五、实践项目

### 项目 1：日志轮转 + JSON 配置解析工具

**目标**：综合 logging、json、pathlib，实现一个带配置文件的应用日志工具。

**步骤**：

1. 用 pathlib 创建 logs 目录
2. 读取 config.json 配置（日志级别、文件路径）
3. 配置 `RotatingFileHandler` 实现按大小滚动
4. 输出带时间戳的结构化日志
5. 手动触发 ERROR 验证轮转

**目录结构参考**：

```
log_tool/
├── config.json          # 日志配置
├── logger_setup.py      # logging 封装
└── main.py              # 使用示例
```

### 项目 2：文本统计与数据提取

**目标**：使用 collections、re 和 itertools 分析一篇文章。

**步骤**：

1. 用 pathlib 读取文章文本
2. 用 re 提取所有单词与邮箱
3. 用 Counter 统计词频 Top 10
4. 用 groupby 按首字母分组
5. 输出统计报告

**目录结构参考**：

```
text_analysis/
├── article.txt          # 待分析文本
└── analyzer.py          # 统计逻辑
```
