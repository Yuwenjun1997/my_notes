---
url: >-
  /my_notes/notes/Python学习路线/di-san-jie-duan-jin-jie-neng-li/3-ren-wu-dui-lie-yu-ding-shi-ren-wu/index.md
---
# 任务队列与定时任务

## 一、Celery 核心概念

### 3.3.1 Celery 架构

**Celery**：Python 最流行的分布式任务队列，用于处理异步任务和定时任务。

```
┌────────────┐   投递任务    ┌──────────┐   拉取执行    ┌──────────┐
│  生产者     │ ──────────→  │  Broker   │ ──────────→ │  Worker  │
│ (Web应用)   │              │ Redis/RabbitMQ │          │ (任务执行者)│
└────────────┘              └──────────┘              └──────────┘
                                   │                         │
                                   ▼                         ▼
                              ┌──────────┐            ┌──────────┐
                              │ Result 后端 │            │ 结果存储  │
                              │ (可选)    │            └──────────┘
                              └──────────┘
```

**核心组件**：

| 组件 | 作用 | 说明 |
|------|------|------|
| **Task（任务）** | 业务逻辑封装 | 用 `@app.task` 装饰的函数 |
| **Broker（消息代理）** | 任务消息中转站 | Redis / RabbitMQ |
| **Worker（工作进程）** | 从 Broker 拉取并执行任务 | 可水平扩展 |
| **Beat（调度器）** | 定时向 Broker 投递任务 | 独立进程 |
| **Result Backend** | 存储任务执行结果 | 可选，Redis / DB |

```bash
# 安装
pip install celery[redis]
```

**创建第一个任务**：

```python
# tasks.py
from celery import Celery

# broker：任务队列；backend：结果存储
app = Celery(
    "tasks",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/1",
)

@app.task
def add(x, y):
    return x + y

@app.task(bind=True, max_retries=3)
def send_email(to, content):
    """bind=True 使任务内可通过 self 访问重试等能力"""
    try:
        # 模拟发送邮件（可能失败）
        send_smtp(to, content)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=5)  # 5 秒后重试，最多 3 次
```

**启动 Worker**：

```bash
# 启动 worker，-l 日志级别，-c 并发进程数
celery -A tasks worker --loglevel=info --concurrency=4

# 启动定时调度器（使用 beat 时）
celery -A tasks beat --loglevel=info

# 安装 flower 监控面板
pip install flower
celery -A tasks flower --port=5555
```

### 3.3.2 任务调用方式

**在业务代码中调用任务**：

```python
from tasks import add, send_email

# ✅ 异步调用：立即返回 AsyncResult，任务在 Worker 中执行
result = add.delay(4, 5)

# ✅ 指定参数调用
send_email.apply_async(args=["user@example.com", "欢迎注册"], countdown=10)

# 检查结果
print(result.id)          # 任务 ID
print(result.ready())     # 是否已完成
print(result.get(timeout=5))  # 阻塞获取结果（生产慎用）

# 获取结果（不阻塞，未完成返回 None）
status = result.state    # PENDING / STARTED / SUCCESS / FAILURE
```

**任务队列与路由**：将不同任务分发到不同队列，实现隔离与优先级。

```python
# 配置
app.conf.task_routes = {
    "tasks.send_email": {"queue": "email"},
    "tasks.add": {"queue": "default"},
}

# 调用时指定队列
send_email.apply_async(args=[...], queue="email")

# 启动多个 worker 消费不同队列
# celery -A tasks worker -Q email
# celery -A tasks worker -Q default
```

***

## 二、Celery 实战配置

### 3.3.3 配置与最佳实践

**集中配置**：

```python
# celeryconfig.py
from celery.schedules import crontab

broker_url = "redis://localhost:6379/0"
result_backend = "redis://localhost:6379/1"
task_serializer = "json"
result_serializer = "json"
accept_content = ["json"]
timezone = "Asia/Shanghai"
enable_utc = True

# 每个任务最大重试次数
task_max_retries = 3

# 结果过期时间
result_expires = 3600

# 任务执行超时时间（秒）
task_time_limit = 300
task_soft_time_limit = 280

# 结果后端：推荐配置——结果保存后快速清除，避免堆积
result_backend_transport_options = {
    "visibility_timeout": 3600,
}
```

```python
# tasks.py
from celery import Celery
app = Celery("tasks")
app.config_from_object("celeryconfig")
```

**任务幂等与重试**：

```python
@app.task(bind=True, max_retries=5, default_retry_delay=10)
def process_payment(self, order_id, amount):
    """支付处理：必须幂等，重试不产生副作用"""
    # ✅ 幂等设计：先检查是否已处理
    if redis.get(f"payed:{order_id}"):
        return {"status": "already_done"}

    try:
        result = call_payment_api(order_id, amount)
        if result["code"] != 0:
            raise PaymentError(f"支付失败: {result['msg']}")
        # 记录处理痕迹，防止重复
        redis.setex(f"payed:{order_id}", 86400, "1")
        return result
    except PaymentError as exc:
        # 指数退避重试：10s, 20s, 40s...
        raise self.retry(exc=exc, countdown=self.request.retries * 10)
    except Exception as exc:
        raise self.retry(exc=exc)
```

**限流（rate\_limit）**：控制任务执行频率。

```python
@app.task(rate_limit="100/m")  # 每分钟最多执行 100 次
def send_notification(user_id):
    pass

# 或按队列限制
app.conf.task_annotations = {
    "tasks.send_notification": {"rate_limit": "10/s"}
}
```

### 3.3.4 FastAPI 集成

**在 FastAPI 中调用 Celery 任务**：

```python
# app/tasks.py
from celery import Celery

celery_app = Celery(
    "app",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/1",
)

@celery_app.task
def send_welcome_email(user_email: str, user_id: int):
    # 异步邮件逻辑
    return f"邮件已发送给 {user_email}"
```

```python
# app/main.py
from fastapi import FastAPI
from app.tasks import celery_app, send_welcome_email

app = FastAPI()

@app.post("/users")
async def create_user(user: UserCreate):
    # 创建用户（同步写入 DB）
    user_id = save_user(user)

    # ✅ 异步投递邮件任务，接口立即返回
    task = send_welcome_email.delay(user.email, user_id)
    return {"user_id": user_id, "task_id": task.id}

@app.get("/tasks/{task_id}")
async def get_task_status(task_id: str):
    task = celery_app.AsyncResult(task_id)
    return {"state": task.state, "result": task.result}
```

> ⚠️ Worker 进程与 FastAPI 进程分离启动：`celery -A app.tasks worker --loglevel=info`。

***

## 三、APScheduler 定时任务

### 3.3.5 APScheduler 核心

**APScheduler（Advanced Python Scheduler）**：功能强大的进程内定时调度库。

**触发器（Trigger）**：

| 触发器 | 适用场景 | 示例 |
|--------|---------|------|
| `date` | 一次性任务 | 明天 10:00 执行 |
| `interval` | 固定间隔 | 每 5 分钟 |
| `cron` | 类 Cron 表达式 | 每天凌晨 3 点 |

```python
from apscheduler.schedulers.blocking import BlockingScheduler

def job(name):
    print(f"任务执行：{name}")

scheduler = BlockingScheduler()

# ✅ interval 触发器：每 10 秒
scheduler.add_job(job, "interval", seconds=10, args=["间隔任务"], id="interval_job")

# ✅ cron 触发器：每天 3:00 与 15:00
scheduler.add_job(job, "cron", hour="3,15", minute=0, args=["cron任务"])

# ✅ cron：工作日每小时的 30 分执行
scheduler.add_job(job, "cron", day_of_week="mon-fri", hour="*", minute=30)

# date 触发器：一次性
from datetime import datetime, timedelta
run_date = datetime.now() + timedelta(seconds=30)
scheduler.add_job(job, "date", run_date=run_date, args=["一次性任务"])

scheduler.start()
```

**调度器类型对比**：

| 调度器 | 特点 | 适用场景 |
|--------|------|---------|
| `BlockingScheduler` | 阻塞主线程 | 独立脚本 |
| `BackgroundScheduler` | 后台线程运行 | 嵌入 Web 应用 |
| `AsyncIOScheduler` | 基于 asyncio | 异步应用 |
| `ThreadPoolExecutor` 搭配 | 任务多线程执行 | 综合场景 |

**持久化 JobStore**：重启后任务不丢失。

```python
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore

# ✅ 任务存储到 SQLite，重启后自动恢复
jobstores = {"default": SQLAlchemyJobStore(url="sqlite:///jobs.sqlite")}
scheduler = BackgroundScheduler(jobstores=jobstores)

def daily_report():
    print("生成每日报表")

scheduler.add_job(daily_report, "cron", hour=1, minute=0, id="daily_report")
scheduler.start()
```

### 3.3.6 定时任务与任务队列对比

| 对比维度 | Celery（含 beat） | APScheduler | schedule |
|---------|:---:|:---:|:---:|
| 架构 | 分布式，独立 Worker 进程 | 进程内单机 | 进程内轻量 |
| 任务持久化 | Broker 持久化 | JobStore（DB） | 无 |
| 分布式执行 | ✅ 支持水平扩展 | ❌ 单机 | ❌ 单机 |
| 结果跟踪 | ✅ 完整 | 部分 | ❌ |
| 重试/限流 | ✅ 内置 | 需手动 | ❌ |
| 适用场景 | 大型异步任务系统 | Web 应用内定时任务 | 简单脚本 |

**选型建议**：

* **需要分布式执行、异步任务** → Celery
* **仅需要应用内定时调度** → APScheduler（嵌入 FastAPI 非常方便）
* **几个简单定时脚本** → `schedule` 库，几行代码搞定

```python
import schedule
import time

def job():
    print("每分钟执行")

schedule.every().minute.do(job)
schedule.every().day.at("09:30").do(job)
schedule.every().monday.do(job)  # 每周一

while True:
    schedule.run_pending()
    time.sleep(1)
```

***

## 四、分布式任务最佳实践

### 3.3.7 幂等、去重与死信

**任务幂等**：同一任务重复执行结果一致，是分布式任务的第一原则。

| 风险场景 | 解决方案 |
|---------|---------|
| 网络超时导致重复投递 | 任务内检查处理痕迹（幂等键） |
| 消费者崩溃后任务重新执行 | 以业务唯一键做去重 |
| 第三方接口失败重试 | 记录重试次数，超过阈值转入死信 |

**任务去重实现**：

```python
import redis
from celery import Celery

r = redis.Redis(decode_responses=True)
app = Celery("tasks", broker="redis://localhost:6379/0")

@app.task(bind=True)
def send_order_message(self, order_id):
    # ✅ 用业务唯一键去重：同一订单只处理一次
    dedup_key = f"task_dedup:{self.name}:{order_id}"
    if not r.set(dedup_key, "1", nx=True, ex=300):
        return {"status": "duplicate, skipped"}
    # 实际业务逻辑...
```

**死信队列（DLQ）**：失败多次的任务转入专用队列隔离，避免阻塞主队列。

```python
@app.task(bind=True, max_retries=3)
def handle_failure(self, task_id):
    try:
        process(task_id)
    except Exception as exc:
        if self.request.retries >= self.max_retries:
            # ✅ 达到最大重试，投递到死信队列
            app.send_task(
                "tasks.handle_dead_letter",
                args=[task_id, str(exc)],
                queue="dead_letter",
            )
            return
        raise self.retry(exc=exc, countdown=30)

@app.task
def handle_dead_letter(task_id, error):
    # 记录死信日志，通知人工处理
    log_dead_letter(task_id, error)
```

**任务监控与排查**：

```python
from celery.result import AsyncResult
from app.tasks import celery_app

def inspect_workers():
    """查看 worker 在线状态与活跃任务"""
    inspector = celery_app.control.inspect()
    print(inspector.ping())          # 各 worker 是否存活
    print(inspector.active())        # 正在执行的任务
    print(inspector.scheduled())     # 已排期的任务
    print(inspector.reserved())      # 已取走但未执行的任务

def purge_tasks():
    """清空待处理队列（紧急情况）"""
    celery_app.control.purge()
```

***

## 实践项目

### 目标

构建一个**异步订单通知系统**：使用 Celery 处理订单后的邮件/短信通知，用 APScheduler 生成每日销量统计报表，并实现任务幂等、重试与死信处理。

### 步骤

1. 搭建 Celery + Redis 项目，配置 `celeryconfig.py`
2. 定义 `send_order_notification` 任务（bind=True + 重试 + 幂等去重）
3. 在 FastAPI 的 `POST /orders` 中异步投递通知任务
4. 用 APScheduler 添加每日凌晨 1 点生成销售报表的 cron 任务
5. 启动 worker 与 beat，用 flower 观察任务执行与失败情况
6. 测试：模拟第三方接口故障，验证重试与死信队列

### 目录结构参考

```text
order_system/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 入口
│   ├── celery_app.py        # Celery 实例与配置
│   ├── tasks.py             # 任务定义
│   ├── scheduler.py         # APScheduler 定时任务
│   └── routers/
│       └── orders.py        # 订单接口
├── celeryconfig.py          # Celery 配置
├── docker-compose.yml       # Redis 服务
├── requirements.txt
└── .env                     # 环境变量
```
