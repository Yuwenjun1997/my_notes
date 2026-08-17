---
url: >-
  /my_notes/notes/Python学习路线/di-yi-jie-duan-python-ji-chu/2-yu-fa-he-xin/index.md
---
# 语法核心

## 一、数据类型与流程控制

### 1.1 基本数据类型

Python 是**动态类型**语言，变量不需要声明类型，运行时推断。

**内置数据类型一览**

| 类型 | 示例 | 可变性 | 说明 |
|:-----|:-----|:-------|:-----|
| `int` | `42`, `-7`, `0x1F` | 不可变 | 任意精度整数 |
| `float` | `3.14`, `1e-3` | 不可变 | 双精度浮点 |
| `bool` | `True`, `False` | 不可变 | 布尔值（是 int 子类） |
| `str` | `"你好"` | 不可变 | 字符串（Unicode） |
| `None` | `None` | - | 空值 |
| `list` | `[1, 2, 3]` | **可变** | 有序列表 |
| `tuple` | `(1, 2, 3)` | 不可变 | 有序元组 |
| `dict` | `{"k": 1}` | **可变** | 键值映射 |
| `set` | `{1, 2, 3}` | **可变** | 无序不重复集合 |

**变量与类型检查**

```python
x = 10          # 整数
x = "hello"     # 重新赋值为字符串（动态类型）
print(type(x))  # <class 'str'>

# 类型提示（3.6+，仅辅助静态检查，不影响运行）
def add(a: int, b: int) -> int:
    return a + b
```

**类型转换**

```python
int("42")            # 42
float("3.14")        # 3.14
str(42)              # '42'
bool("")             # False（空字符串为假）
bool("non-empty")    # True
list("abc")          # ['a', 'b', 'c']
```

### 1.2 条件判断

```python
score = 85

if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
elif score >= 60:
    grade = "C"
else:
    grade = "D"

print(f"成绩等级: {grade}")
```

**真值判断惯例**

| 表达式 | 真值 |
|:-------|:-----|
| `0`, `0.0` | 假 |
| `""`, `[]`, `{}`, `()` | 假 |
| `None` | 假 |
| 非空字符串 / 非零数字 / 非空容器 | 真 |

> ✅ **推荐**：判断列表非空直接写 `if items:`，而不是 `if len(items) > 0:`
> ❌ **避免**：`if x == True:`，直接写 `if x:`

### 1.3 循环

```python
# for 循环遍历可迭代对象
for i in range(5):          # 0,1,2,3,4
    print(i)

for i in range(2, 10, 2):   # 起始2, 结束10(不含), 步长2 → 2,4,6,8
    print(i)

# enumerate 同时取索引与值
fruits = ["苹果", "香蕉", "橙子"]
for idx, fruit in enumerate(fruits, start=1):
    print(idx, fruit)

# 同时遍历两个列表
names = ["张三", "李四"]
scores = [90, 85]
for name, score in zip(names, scores):
    print(name, score)

# while 循环
count = 0
while count < 3:
    print(count)
    count += 1

# break / continue / else
for i in range(10):
    if i == 3:
        continue          # 跳过本次
    if i == 7:
        break             # 终止循环
    print(i)
else:
    print("循环正常结束（未 break）")  # break 时不会执行
```

### 1.4 match-case 模式匹配（3.10+）

**match-case** 提供类似其他语言 switch 的结构化模式匹配。

```python
def handle_status(code):
    match code:
        case 200:
            return "OK"
        case 404:
            return "Not Found"
        case 500:
            return "Server Error"
        case _:                    # 默认分支（必须放最后）
            return "Unknown"

# 元组解构匹配
def describe_point(point):
    match point:
        case (0, 0):
            return "原点"
        case (x, 0):
            return f"X 轴上，x={x}"
        case (0, y):
            return f"Y 轴上，y={y}"
        case (x, y):
            return f"坐标 ({x}, {y})"
```

***

## 二、容器与解包

### 2.1 容器详解

**list（列表）—— 有序可变**

```python
nums = [1, 2, 3]
nums.append(4)          # [1, 2, 3, 4]
nums.extend([5, 6])     # [1, 2, 3, 4, 5, 6]
nums.insert(0, 0)       # 在下标0处插入
nums.remove(2)          # 按值删除
popped = nums.pop()     # 弹出末尾元素
del nums[0]             # 按下标删除
nums.sort(reverse=True) # 原地排序
```

**tuple（元组）—— 有序不可变**

```python
point = (3, 4)
x, y = point            # 解包
single = (1,)           # 单个元素必须有逗号

# ❌ point[0] = 10  ← 报错：元组不可变
# ✅ 需要修改时转换为列表
```

**dict（字典）—— 键值映射**

```python
user = {"name": "张三", "age": 25}

user["email"] = "zhangsan@example.com"   # 新增/修改
age = user.get("age", 0)                 # 安全取值，带默认值
user.setdefault("city", "北京")          # 不存在才设置
user.pop("age")                          # 删除并返回
user.popitem()                           # 弹出最后插入的键值对

for key, value in user.items():          # 遍历键值
    print(key, value)

for key in user.keys():                  # 遍历键
    ...
```

**set（集合）—— 无序不重复**

```python
a = {1, 2, 3}
b = {2, 3, 4}

a | b    # 并集 {1,2,3,4}
a & b    # 交集 {2,3}
a - b    # 差集 {1}
a ^ b    # 对称差 {1,4}

# 集合去重
nums = [1, 1, 2, 3, 3, 3]
unique = list(set(nums))    # [1, 2, 3]
```

### 2.2 切片与步长

```python
s = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

s[2:5]        # [2, 3, 4]          起:止（止不含）
s[:3]         # [0, 1, 2]          省略起始
s[3:]         # [3, 4, ..., 9]     省略结束
s[::-1]       # 反转 [9,8,...,0]   负步长
s[::2]        # [0, 2, 4, 6, 8]    隔一个取
s[-3:]        # 取最后3个 [7,8,9]

# 切片同样适用于字符串
text = "Python"
text[::-1]    # 'nohtyP'
```

### 2.3 解包（Unpacking）

```python
# 星号解包
first, *middle, last = [1, 2, 3, 4, 5]
# first=1, middle=[2,3,4], last=5

# 合并列表
a = [1, 2]
b = [3, 4]
combined = [*a, *b]          # [1, 2, 3, 4]

# 合并字典（**）
d1 = {"a": 1}
d2 = {"b": 2}
merged = {**d1, **d2}        # {'a': 1, 'b': 2}

# 交换变量
x, y = y, x                  # 无需临时变量
```

***

## 三、推导式与字符串

### 3.1 推导式（Comprehension）

```python
# 列表推导式 [表达式 for 变量 in 可迭代 if 条件]
squares = [x ** 2 for x in range(10)]             # 0,1,4,...,81
evens = [x for x in range(20) if x % 2 == 0]      # 带条件过滤

# 字典推导式
square_dict = {x: x ** 2 for x in range(5)}       # {0:0, 1:1, 2:4, ...}

# 集合推导式
unique_lens = {len(word) for word in ["hi", "hello", "hey"]}   # {2,3,5}

# 生成器表达式（惰性，节省内存）
total = sum(x * x for x in range(1_000_000))      # 不生成完整列表

# 嵌套推导式：展平二维列表
matrix = [[1, 2], [3, 4]]
flat = [num for row in matrix for num in row]     # [1,2,3,4]
```

> ✅ 推导式比 `for` + `append` 更简洁高效。
> ❌ 嵌套超过两层时推导式可读性急剧下降，改用普通循环。

### 3.2 F-string 格式规范

```python
name = "Alice"
age = 25
score = 87.5

# 基础插值
print(f"姓名: {name}, 年龄: {age}")

# 对齐与填充
print(f"{'left':<10}|")     # 左对齐，占10位
print(f"{'right':>10}|")    # 右对齐
print(f"{'center':^10}|")   # 居中
print(f"{42:05d}")          # 数字补零 → '00042'

# 精度与千分位
print(f"{score:.2f}")       # 87.50（保留2位小数）
print(f"{1234567:,}")       # 1,234,567（千分位）

# 进制与百分比
print(f"{255:#x}")          # 0xff
print(f"{0.1234:.1%}")      # 12.3%

# 表达式直接计算
print(f"{5 * 6 = }")        # '5 * 6 = 30'
```

### 3.3 字符串常用方法

```python
text = "  Hello, World!  "

text.strip()          # 'Hello, World!'      去首尾空白
text.lower()          # '  hello, world!  '  转小写
text.upper()          # 转大写
text.split(",")       # ['  Hello', ' World!  ']  按分隔符拆分
",".join(["a", "b"])  # 'a,b'                拼接
text.replace("World", "Python")   # 替换
text.startswith(" ")  # True               判断前缀
text.find("World")    # 8                  查找下标，找不到返回 -1

# 编码与 Unicode
"你好".encode("utf-8")    # b'\xe4\xbd\xa0\xe5\xa5\xbd'
b"\xe4\xbd\xa0".decode("utf-8")  # '你好'
len("你好")               # 2（Python 3 按字符计数）
```

### 3.4 编码与文件读写基础

```python
# 读写文本文件（默认 UTF-8）
with open("data.txt", "w", encoding="utf-8") as f:
    f.write("第一行\n")

with open("data.txt", "r", encoding="utf-8") as f:
    content = f.read()          # 读全部
    lines = f.readlines()       # 读行列表

# 逐行读取大文件
with open("big.log", "r", encoding="utf-8") as f:
    for line in f:
        process(line)
```

***

## 四、异常处理与实战

### 4.1 try / except / else / finally

```python
try:
    result = 10 / int("0")          # 可能抛异常的代码
except ZeroDivisionError:
    print("不能除以零")
except ValueError as e:
    print(f"数值转换失败: {e}")
except (TypeError, KeyError):       # 捕获多个异常
    print("类型或键错误")
else:
    print(f"没有异常，结果为 {result}")   # 仅在无异常时执行
finally:
    print("无论是否异常都会执行")        # 用于清理资源
```

### 4.2 异常链与自定义异常

```python
# 自定义异常类（继承 Exception）
class InsufficientBalanceError(Exception):
    """余额不足异常"""

    def __init__(self, balance, amount):
        self.balance = balance
        self.amount = amount
        super().__init__(f"余额 {balance} 不足以扣除 {amount}")


def withdraw(balance, amount):
    if amount > balance:
        raise InsufficientBalanceError(balance, amount)
    return balance - amount


# 异常链：保留原始异常上下文
try:
    int("abc")
except ValueError as e:
    raise RuntimeError("解析配置失败") from e   # 保留原始异常链
```

**常用内置异常**

| 异常 | 触发场景 |
|:-----|:---------|
| `ValueError` | 值不合法（如 `int("abc")`） |
| `TypeError` | 类型不匹配（如字符串 + 整数） |
| `KeyError` | 字典键不存在 |
| `IndexError` | 列表下标越界 |
| `AttributeError` | 访问不存在的属性 |
| `FileNotFoundError` | 文件不存在 |
| `PermissionError` | 权限不足 |

> ❌ **不要** 用 `except Exception:` 吞掉所有异常，会掩盖真实错误。应精确捕获或记录后再抛。
> ❌ **不要** 用裸 `except:`（等价于捕获所有包括 `KeyboardInterrupt`）。

***

## 五、实践项目

### 项目 1：购物车数据处理小工具

**目标**：综合运用容器、推导式、字符串与异常处理，实现一个购物车统计工具。

**步骤**：

1. 用列表存储商品字典（名称、单价、数量）
2. 计算购物车总价（推导式求和）
3. 用 `defaultdict` 按类别汇总
4. 使用 F-string 格式化输出结算单
5. 对非法输入抛出自定义异常

**目录结构参考**：

```
shopping_cart/
├── cart.py              # 购物车逻辑
└── main.py              # 入口与输出
```

### 项目 2：日志异常分析脚本

**目标**：读取日志文件，统计错误类型并输出报告。

**步骤**：

1. 使用 `with open` 逐行读取日志
2. 用正则或 `in` 判断错误级别（ERROR/WARN/INFO）
3. 用 `Counter` 统计各类错误出现次数
4. 用 F-string 格式化输出统计报告
5. 对文件不存在等情况做异常处理

**目录结构参考**：

```
log_analyzer/
├── analyzer.py          # 统计逻辑
└── app.log              # 示例日志
```
