---
url: >-
  /my_notes/notes/Python学习路线/di-yi-jie-duan-python-ji-chu/3-han-shu-mo-kuai-yu-mian-xiang-dui-xiang/index.md
---
# 函数模块与面向对象

## 一、函数

### 1.1 函数定义与参数

```python
def greet(name, greeting="你好", *, end="!"):
    """返回问候语。

    greeting 带默认值；* 之后的参数必须用关键字传入。
    """
    return f"{greeting}, {name}{end}"


greet("张三")                    # 位置参数
greet("李四", "早上好")           # 位置参数覆盖默认值
greet(name="王五", greeting="嗨") # 关键字参数
greet("赵六", end="~")           # 强制关键字参数
```

**参数类型一览**

| 参数类型 | 写法 | 说明 |
|:---------|:-----|:-----|
| 位置参数 | `def f(a, b)` | 按顺序传入 |
| 默认参数 | `def f(a, b=1)` | 可选，有默认值 |
| 仅限关键字 | `def f(*, a)` | `*` 后必须用关键字 |
| 仅限位置 | `def f(a, /)` | `/` 前只能用位置 |
| 可变位置 | `def f(*args)` | 接收任意个位置参数 → 元组 |
| 可变关键字 | `def f(**kwargs)` | 接收任意个关键字参数 → 字典 |

```python
def log(level, *messages, **options):
    prefix = options.get("prefix", "")
    print(f"[{level}] {prefix} " + " ".join(messages))

log("INFO", "服务启动", "端口 8000", prefix="app")
# [INFO] app 服务启动 端口 8000
```

### 1.2 作用域与闭包（LEGB 规则）

Python 变量查找遵循 **LEGB** 顺序：

```
Local（局部） → Enclosing（外层） → Global（全局） → Built-in（内置）
```

```python
x = 10                # Global

def outer():
    x = 20            # Enclosing
    def inner():
        x = 30        # Local
        return x
    return inner()

# 修改全局变量需声明 global
count = 0
def increment():
    global count
    count += 1

# 修改外层变量需声明 nonlocal
def counter():
    n = 0
    def inc():
        nonlocal n
        n += 1
        return n
    return inc

c = counter()
c()   # 1
c()   # 2
```

**闭包（Closure）**：内层函数捕获外层函数的局部变量，即使外层已返回仍能访问，常用于**配置工厂**与**计数器**。

### 1.3 高阶函数与 lambda

```python
# lambda 匿名函数
square = lambda x: x * x

# 内置高阶函数
nums = [1, 2, 3, 4, 5]
list(map(lambda x: x * 2, nums))       # [2,4,6,8,10]
list(filter(lambda x: x % 2 == 0, nums))  # [2,4]
from functools import reduce
reduce(lambda a, b: a + b, nums)       # 15

# ❌ 现代风格更推荐推导式（可读性更好）
[x * 2 for x in nums]
```

### 1.4 装饰器

装饰器是"**接收函数、返回增强函数**"的可调用对象，用于在不动原函数的情况下扩展行为。

```python
import functools
import time

def timer(func):
    """计时装饰器。"""
    @functools.wraps(func)          # 保留原函数名与文档
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f"{func.__name__} 耗时 {elapsed:.4f}s")
        return result
    return wrapper

@timer
def compute(n):
    """模拟耗时计算。"""
    time.sleep(0.1)
    return n * n

compute(5)   # 打印耗时并返回 25
```

**带参数的装饰器**

```python
def retry(max_attempts=3, delay=0.5):
    """失败重试装饰器（工厂）。"""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_attempts - 1:
                        raise
                    print(f"第 {attempt + 1} 次失败: {e}，重试中...")
                    time.sleep(delay)
        return wrapper
    return decorator

@retry(max_attempts=3, delay=1)
def call_api():
    ...
```

> ❌ 装饰器内 `wrapper` 务必加 `@functools.wraps(func)`，否则会丢失原函数的 `__name__` 和 `__doc__`。

***

## 二、迭代器与生成器

### 2.1 迭代器协议

```python
# 可迭代对象：实现 __iter__；迭代器：实现 __iter__ 和 __next__
nums = iter([1, 2, 3])
next(nums)    # 1
next(nums)    # 2
next(nums)    # 3
# next(nums)  # StopIteration
```

### 2.2 生成器

生成器用 `yield` 惰性产出值，**不一次性占用内存**，适合处理大文件与无限序列。

```python
def countdown(n):
    while n > 0:
        yield n
        n -= 1

for i in countdown(3):
    print(i)   # 3, 2, 1

# 生成器表达式（惰性）
gen = (x * x for x in range(10))

# yield from 委托子生成器
def flatten(lists):
    for sub in lists:
        yield from sub

list(flatten([[1, 2], [3, 4]]))   # [1, 2, 3, 4]
```

**生成器 vs 列表对比**

| 维度 | 列表 | 生成器 |
|:-----|:-----|:-------|
| 内存 | 全部元素驻留内存 | 逐项产出，省内存 |
| 可否重复遍历 | 可以 | 只能遍历一次 |
| 索引访问 | 支持 | 不支持 |
| 适用场景 | 小数据 / 需多次访问 | 大文件 / 无限流 |

***

## 三、模块与包

### 3.1 import 机制

```python
# 多种导入方式
import math
from math import sqrt
from datetime import datetime, timezone
import numpy as np                  # 别名

# 查看模块路径
print(math.__file__)
```

**搜索顺序**：当前目录 → `PYTHONPATH` → 标准库 → site-packages。

```python
import sys
print(sys.path)    # 查看模块搜索路径列表
```

### 3.2 包结构

```text
myproject/
├── main.py
└── utils/
    ├── __init__.py       # 包标记文件（可为空或声明 __all__）
    ├── strings.py
    └── dates.py
```

```python
# main.py 中导入包内模块
from utils import strings, dates
from utils.strings import split_words      # 直接导入函数

# __init__.py 中声明对外导出
__all__ = ["strings", "dates"]
```

**相对导入**（仅在包内部使用）

```python
# utils/strings.py
from . import dates        # 同级导入
from ..config import Settings   # 上级包导入
```

> ❌ 顶层脚本不要用相对导入（`from . import`），会报 `ImportError`，相对导入只在包内模块间使用。

***

## 四、面向对象

### 4.1 类与对象基础

```python
class User:
    # 类属性：所有实例共享
    role = "user"

    def __init__(self, name, age):
        # 实例属性
        self.name = name
        self.age = age
        self._private = True       # 约定：下划线开头表示"私有"

    def greet(self):
        return f"我是 {self.name}，今年 {self.age} 岁"

    @classmethod
    def create_admin(cls, name):
        """类方法：接收类本身，可访问类属性"""
        user = cls(name, 0)
        user.role = "admin"
        return user

    @staticmethod
    def is_valid_name(name):
        """静态方法：不依赖实例和类"""
        return len(name) > 0


u1 = User("张三", 25)
u2 = User("李四", 30)
print(u1.greet())              # 我是 张三，今年 25 岁
print(User.role)               # user
admin = User.create_admin("管理员")   # 类方法调用
```

**三种方法对比**

| 方法类型 | 第一个参数 | 访问实例 | 访问类属性 | 装饰器 |
|:---------|:-----------|:---------|:-----------|:-------|
| 实例方法 | `self` | ✅ | ✅（经 `self`） | 无 |
| 类方法 | `cls` | ❌ | ✅ | `@classmethod` |
| 静态方法 | 无 | ❌ | ❌ | `@staticmethod` |

### 4.2 继承、多态与 MRO

```python
class Animal:
    def __init__(self, name):
        self.name = name

    def speak(self):
        raise NotImplementedError

    def describe(self):
        return f"{self.__class__.__name__}: {self.name}"


class Dog(Animal):
    def speak(self):
        return "汪汪！"


class Cat(Animal):
    def speak(self):
        return "喵～"


# 多态：同一接口，不同实现
animals = [Dog("旺财"), Cat("咪咪")]
for a in animals:
    print(a.speak())    # 汪汪！ / 喵～
```

**super() 与 MRO**

```python
class Base:
    def __init__(self, value):
        self.value = value


class Child(Base):
    def __init__(self, value, extra):
        super().__init__(value)       # 调用父类初始化
        self.extra = extra

# 菱形继承时 MRO（方法解析顺序）决定调用链
print(Child.__mro__)    # (<class 'Child'>, <class 'Base'>, <class 'object'>)
```

### 4.3 魔法方法与特殊方法

```python
class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __repr__(self):
        """开发者视角的表示（调试用）"""
        return f"Vector({self.x}, {self.y})"

    def __str__(self):
        """用户视角的表示（print 用）"""
        return f"({self.x}, {self.y})"

    def __add__(self, other):          # 支持 +
        return Vector(self.x + other.x, self.y + other.y)

    def __eq__(self, other):           # 支持 ==
        return self.x == other.x and self.y == other.y

    def __len__(self):                 # 支持 len()
        return 2

    def __enter__(self):               # 支持 with
        return self

    def __exit__(self, exc_type, exc, tb):
        pass


v1 = Vector(1, 2)
v2 = Vector(3, 4)
print(v1 + v2)        # (4, 6)
print(v1 == Vector(1, 2))   # True
```

### 4.4 abc 抽象基类与 dataclasses

**抽象基类（abc）**

```python
from abc import ABC, abstractmethod

class Shape(ABC):
    @abstractmethod
    def area(self) -> float:
        """子类必须实现"""

class Circle(Shape):
    def __init__(self, r):
        self.r = r
    def area(self):
        return 3.14159 * self.r ** 2

# ❌ Shape()  ← 抽象类不能实例化
# ✅ Circle(2).area() → 12.56636
```

**dataclasses 数据类**

```python
from dataclasses import dataclass, field

@dataclass(frozen=True)          # frozen=True 实例不可变
class Product:
    name: str
    price: float
    tags: list[str] = field(default_factory=list)   # 可变默认值必须用 default_factory
    discount: float = 0.0

    @property
    def final_price(self) -> float:
        return self.price * (1 - self.discount)


p = Product("键盘", 299.0, tags=["外设"])
print(p)                # Product(name='键盘', price=299.0, ...)  自动生成 __repr__
print(p.final_price)    # 299.0
```

> ❌ **不要** 用可变对象（列表/字典）作 dataclass 或函数的默认值，应使用 `field(default_factory=list)`。可变默认值会被所有实例共享。

***

## 五、实践项目

### 项目 1：配置管理类

**目标**：综合运用 dataclass、装饰器与类方法，实现一个带校验的配置管理类。

**步骤**：

1. 用 dataclass 定义 `AppConfig`（host、port、debug）
2. 添加 `@property` 校验属性（端口范围）
3. 用类方法 `from_dict` 支持从字典构建
4. 用 `@classmethod` 提供环境变量读取工厂方法
5. 编写计时装饰器验证属性访问

**目录结构参考**：

```
config_manager/
├── config.py            # AppConfig 定义
└── main.py              # 使用示例
```

### 项目 2：生成器处理大日志文件

**目标**：用生成器逐行处理超大日志文件，统计关键词，验证内存占用。

**步骤**：

1. 编写 `read_lines` 生成器逐行产出文件内容
2. 编写 `filter_keyword` 生成器过滤含关键字的行
3. 用 `yield from` 串联多个生成器
4. 对比一次性 `readlines()` 与生成器的内存差异
5. 用 `Counter` 统计关键词频率

**目录结构参考**：

```
log_processor/
├── processors.py        # 生成器链
├── gen_data.py          # 生成测试日志
└── main.py              # 主流程
```
