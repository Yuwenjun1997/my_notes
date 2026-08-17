---
url: >-
  /my_notes/notes/Python学习路线/shen-du-xue-xi/03-microservices/3-fen-bu-shi-ren-wu-yu-mi-deng-she-ji/index.md
---
# 分布式任务与幂等设计

## 一、Celery 大规模任务编排

### 1.1 Celery 架构回顾

Celery 是 Python 最主流的分布式任务队列，核心组件：

| 组件 | 角色 | 常用选择 |
|------|------|----------|
| **Broker** | 消息中间件，任务投递 | Redis / RabbitMQ |
| **Worker** | 任务执行进程 | 多实例部署 |
| **Result Backend** | 结果存储 | Redis / RDBMS |
| **Beat** | 定时任务调度器 | 内置于 celery |

### 1.2 队列划分与路由

**按业务拆分队列**，避免不同类型任务互相阻塞：

```python
# tasks.py
from celery import Celery

app = Celery('myapp', broker='redis://localhost:6379/0',
             backend='redis://localhost:6379/1')

# 默认队列
@app.task(queue='default')
def send_email(email, content):
    ...

# 高优先级队列：独立 Worker 消费，不受慢任务影响
@app.task(queue='priority')
def process_payment(order_id):
    ...

# 慢任务队列：用于耗时型任务（导出、报表）
@app.task(queue='slow')
def export_report(user_id):
    ...

# 定时任务
app.conf.beat_schedule = {
    'daily-report': {
        'task': 'tasks.export_report',
        'schedule': 86400.0,        # 每天执行
        'options': {'queue': 'slow'},
    },
}
```

**按任务类型分队列的意义**：不同队列可由不同数量的 Worker、不同并发级别消费，实现**资源隔离**。例如慢任务 queue 只配 2 个 Worker，避免占满所有进程。

### 1.3 Worker 并发模型

```bash
# prefork 模式（默认）：多进程，适合 CPU 密集 + 常规任务
celery -A tasks worker -Q default,priority --concurrency=8

# gevent 模式：协程并发，适合 IO 密集任务，单进程高吞吐
celery -A tasks worker -Q slow --pool=gevent --concurrency=100

# eventlet 模式：与 gevent 类似的协程池
celery -A tasks worker --pool=eventlet --concurrency=100
```

**并发模型对比**

| 模型 | 原理 | 适合任务 | 注意事项 |
|------|------|----------|----------|
| prefork | 多进程 | CPU 密集、内存隔离要求高 | 每 worker 进程开销大 |
| gevent | 协程 | IO 密集（网络/数据库） | 需 monkey-patch，慎用第三方 C 扩展阻塞 |
| eventlet | 协程 | IO 密集 | 兼容性略弱于 gevent |
| solo | 单进程单线程 | 调试、极简场景 | 无并发，仅测试用 |

### 1.4 任务控制参数

```python
@app.task(
    bind=True,               # 绑定 self（可访问任务实例，用于重试）
    max_retries=5,           # 最大重试次数
    default_retry_delay=30,  # 首次重试延迟（秒）
    retry_backoff=True,      # 指数退避：30/60/120/240/480
    retry_backoff_max=600,   # 退避上限 10 分钟
    acks_late=True,          # 任务执行后再确认，避免执行中崩溃丢失任务
    reject_on_worker_lost=True,  # worker 崩溃时任务回到队列
)
def process_payment(self, order_id):
    try:
        pay_service.pay(order_id)
        return {'status': 'paid'}
    except TemporaryError as e:
        raise self.retry(exc=e, countdown=60)  # 手动重试
    except PermanentError:
        logger.error(f'order {order_id} permanent failure')
        # 不重试，记录失败
```

***

## 二、任务幂等设计

### 2.1 为什么要幂等

网络重试、消费端崩溃恢复、消息重复投递（At-least-once 语义）都会导致**同一任务被执行多次**。若任务有副作用（扣款、发消息、写库存），重复执行会造成严重问题。

**幂等（Idempotency）**：同一请求执行一次与执行多次，最终状态一致。

### 2.2 幂等实现三原则

**原则一：用幂等键（Idempotency Key）去重**

每个任务/请求携带全局唯一键，处理前先查重：

```python
import redis

r = redis.Redis.from_url('redis://localhost:6379/0')

def process_order(order_id: int) -> bool:
    idem_key = f'idem:order:{order_id}'
    # SET NX：仅当键不存在时设置成功 → 说明第一次执行
    ok = r.set(idem_key, 'processing', nx=True, ex=3600)
    if not ok:
        logger.info(f'order {order_id} already processed, skip')
        return False
    try:
        do_payment(order_id)
        r.set(idem_key, 'done', ex=3600)   # 完成后更新状态
        return True
    except Exception:
        r.delete(idem_key)                 # 失败时释放幂等键，允许重试
        raise
```

**原则二：数据库唯一约束兜底**

幂等键落在数据库，利用唯一索引从根源防重：

```python
from sqlalchemy import Column, String, UniqueConstraint

class PaymentRecord(Base):
    __tablename__ = 'payment_record'
    __table_args__ = (UniqueConstraint('order_id', name='uq_payment_order'),)

    id = Column(Integer, primary_key=True)
    order_id = Column(String(64))       # 唯一约束：同一订单只允许一条支付记录
    amount = Column(Numeric(10, 2))
    status = Column(String(16))
```

```python
from sqlalchemy.exc import IntegrityError

try:
    db.add(PaymentRecord(order_id=order_id, amount=100))
    db.commit()
except IntegrityError:
    db.rollback()          # 重复订单直接忽略
    logger.info(f'duplicate order {order_id}')
```

**原则三：业务操作本身幂等化**

如扣款改为「以目标余额为准」、发通知改为「查询是否已发」、库存扣减改为「扣减到指定值」。核心是**结果收敛**，而非每次执行都产生增量。

### 2.3 幂等方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| 幂等键（Redis SETNX） | 简单、性能高 | Redis 故障/清空有风险 | 高频、低并发一致性要求 |
| 数据库唯一约束 | 强一致、可靠 | 需设计表结构 | 支付、订单等核心数据 |
| 幂等表 + 事务 | 可靠且可查询 | 实现复杂 | 跨服务、最终一致 |
| 状态机 + 乐观锁 | 语义清晰 | 业务需可建模为状态机 | 订单状态流转 |

***

## 三、分布式锁进阶

### 3.1 Redis 分布式锁基础

```python
import redis
import uuid

r = redis.Redis.from_url('redis://localhost:6379')

def acquire_lock(name: str, timeout: int = 10) -> str | None:
    token = uuid.uuid4().hex       # 唯一 token，保证只能由持有者释放
    if r.set(name, token, nx=True, ex=timeout):
        return token
    return None

def release_lock(name: str, token: str) -> bool:
    # Lua 脚本：原子校验 token 再删除，防止误删别人的锁
    lua = """
    if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('del', KEYS[1])
    else
        return 0
    end
    """
    return bool(r.eval(lua, 1, name, token))
```

> 关键点：释放锁时必须用 Lua 脚本「先比对 token 再删除」，否则可能把刚过期后被他人获取的锁误删。

### 3.2 看门狗续期（Watchdog）

锁有 TTL 时，业务执行时间可能超过 TTL 导致锁提前释放。**看门狗线程**在锁快过期时自动续期：

```python
import threading
import time

class LockWithWatchdog:
    """持有锁期间，后台线程持续续期"""

    def __init__(self, r: redis.Redis, name: str, token: str, ttl: int = 30):
        self.r, self.name, self.token, self.ttl = r, name, token, ttl
        self._stop = threading.Event()

    def _renew(self):
        # 每 ttl/3 秒续期一次（Lua 脚本原子更新 TTL）
        while not self._stop.is_set():
            time.sleep(self.ttl / 3)
            self.r.eval(
                "if redis.call('get', KEYS[1]) == ARGV[1] "
                "then return redis.call('expire', KEYS[1], ARGV[2]) else return 0 end",
                1, self.name, self.token, self.ttl)

    def __enter__(self):
        self._thread = threading.Thread(target=self._renew, daemon=True)
        self._thread.start()
        return self

    def __exit__(self, *args):
        self._stop.set()
        release_lock(self.name, self.token)
```

### 3.3 Redlock 与权衡

**Redlock**（Redis 官方提出的多节点锁）：在 N 个独立 Redis 节点上都获取锁，成功超过半数才算获取成功。其安全性在分布式系统领域有争议（Martin Kleppmann 曾撰文批评其时钟假设问题）。

**选型建议**

| 场景 | 推荐方案 |
|------|----------|
| 单机/单主 Redis | 单实例锁 + 看门狗即可 |
| 高可用但可容忍极小概率并发 | Redlock / Redisson 风格客户端 |
| 严格强一致（金融） | 改用 ZooKeeper / etcd 分布式锁 |
| 写多读少、锁粒度细 | 数据库乐观锁 + 唯一约束 |

**替代方案**：使用 `redlock-py` 库或 ZooKeeper 锁，避免重复造轮子。

***

## 四、重试与补偿机制

### 4.1 重试退避策略

| 策略 | 公式/做法 | 适用 |
|------|-----------|------|
| 固定间隔 | 每 N 秒重试 | 内部服务、短暂抖动 |
| 指数退避 | delay = base \* 2^n | 外部 API、下游不稳定 |
| 指数退避 + 抖动 | delay = base \* 2^n + random() | 避免惊群，默认推荐 |
| 立即重试 N 次 | 连续重试 3 次后再退避 | 连接池瞬时错误 |

**Celery 重试与退避实现**

```python
@app.task(bind=True, max_retries=5, retry_backoff=True, retry_backoff_max=300, retry_jitter=True)
def call_external_api(self, payload):
    try:
        return external_api.post(payload)
    except ConnectionError:
        # 指数退避 + 随机抖动，最多 5 次，上限 5 分钟
        raise self.retry(countdown=60)
```

### 4.2 补偿机制（Saga 模式）

分布式事务无法用单库事务解决，常用 **Saga 模式**：把一个长事务拆成多个本地事务，每步失败则反向执行补偿操作。

**两种编排方式**

| 方式 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| **Choreography（编排式）** | 每步完成发事件，由下一步监听触发 | 无中心、解耦 | 流程隐式、难追踪 |
| **Orchestration（编排器）** | 中心化 Saga 协调器依次调用各步 | 流程显式、易控制 | 协调器是单点、耦合 |

**Saga 补偿落地（以订单-扣库存-扣款为例）**

```python
# saga_coordinator.py —— Orchestration 方式
class OrderSaga:
    def __init__(self):
        self.steps = [
            ('create_order',  self._create_order,  None),
            ('deduct_stock',  self._deduct_stock,  self._restore_stock),
            ('charge_money',  self._charge_money,  self._refund_money),
        ]

    def execute(self, order_data):
        done = []
        for name, action, compensate in self.steps:
            try:
                action(order_data)
                done.append((name, compensate))
            except Exception as e:
                # 从后往前执行补偿
                for _, comp in reversed(done):
                    if comp:
                        comp(order_data)
                raise SagaFailed(name, e)
```

### 4.3 任务追踪与监控

**Flower 监控面板**

```bash
pip install flower
celery -A tasks flower --port=5555
# 浏览器访问 http://localhost:5555 查看任务状态、队列、活跃 Worker
```

**Celery 事件（Events）**

```python
# 开启事件发送，flower/prometheus 可通过事件做监控
app.conf.worker_send_task_events = True
app.conf.task_send_sent_event = True
```

**监控指标建议**

| 指标 | 来源 | 告警阈值 |
|------|------|----------|
| 队列积压长度 | Redis LLEN / RabbitMQ 队列 | 持续 > 1000 |
| 任务成功率 | flower 事件 / 日志统计 | 低于 95% |
| 任务执行延迟 | 任务时间戳 | P95 > 5s |
| 重试次数 | 任务元数据 | 单任务 > 5 次告警 |
| Worker 存活 | 心跳 | 离线即告警 |

***

## 五、实践项目

### 项目：订单异步处理平台

**目标**：基于 Celery 实现订单创建后的异步流程（防重幂等 + 定时对账 + 失败补偿），并用 Flower 监控。

**步骤**：

1. 配置 Celery：Redis Broker，按 default/priority/slow 拆三个队列
2. 订单创建后投递异步任务：扣库存（priority 队列）、发通知（default 队列）
3. 为每个任务设计幂等键（order\_id + 动作类型），用 Redis SETNX 去重
4. 数据库层用唯一约束兜底；任务开启 retry\_backoff + acks\_late
5. 配置 Beat 定时任务：每日凌晨对账（对账逻辑幂等）
6. 开启 Flower，观察队列积压、任务成功率；模拟失败场景验证补偿流程

**目录结构参考**：

```
order-async-platform/
├── celery_app/
│   ├── __init__.py            # Celery 实例
│   ├── config.py              # Broker/队列/beat 配置
│   └── tasks.py               # 任务定义（幂等 + 重试 + 补偿）
├── services/
│   ├── order_service.py       # 订单服务
│   ├── stock_service.py       # 库存服务
│   └── pay_service.py         # 支付服务
├── core/
│   ├── idempotency.py         # 幂等键工具
│   ├── lock.py                # 分布式锁 + 看门狗
│   └── saga.py                # Saga 补偿编排器
├── docker-compose.yml         # Redis + MySQL + 服务
└── README.md
```
