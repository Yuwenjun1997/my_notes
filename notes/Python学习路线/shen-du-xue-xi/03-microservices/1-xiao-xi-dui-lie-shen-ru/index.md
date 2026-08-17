---
url: >-
  /my_notes/notes/Python学习路线/shen-du-xue-xi/03-microservices/1-xiao-xi-dui-lie-shen-ru/index.md
---
# 消息队列深入

## 一、RabbitMQ 深入

### 1.1 延迟队列

延迟队列（Delayed Queue）的核心需求是：**消息发送后，等待指定时间才被消费者消费**。典型场景：订单超时未支付自动取消、定时提醒、重试间隔控制。

RabbitMQ 本身没有原生延迟队列，常见实现方案有两种：

**方案一：TTL + 死信队列（DLX）**

核心思路：消息设置 TTL 后过期，被投递到绑定的死信交换机（Dead Letter Exchange），再转发到消费队列。

```python
import pika

connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
channel = connection.channel()

# 1. 定义死信交换机与死信队列（真正被消费的队列）
channel.exchange_declare('dlx.exchange', 'direct', durable=True)
channel.queue_declare('order.paid.queue', durable=True)
channel.queue_bind('order.paid.queue', 'dlx.exchange', routing_key='order.paid')

# 2. 定义延迟交换机与延迟队列：消息 TTL 到期后 → 转发到 dlx.exchange
channel.exchange_declare('delay.exchange', 'direct', durable=True)
channel.queue_declare(
    'order.delay.queue',
    durable=True,
    arguments={
        'x-message-ttl': 30_000,        # 消息 30 秒后过期
        'x-dead-letter-exchange': 'dlx.exchange',   # 死信交换机
        'x-dead-letter-routing-key': 'order.paid',  # 死信路由键
    },
)
channel.queue_bind('order.delay.queue', 'delay.exchange', routing_key='order.create')

# 3. 发送消息到延迟队列
channel.basic_publish(
    exchange='delay.exchange',
    routing_key='order.create',
    body=b'{"order_id": "202608150001"}',
    properties=pika.BasicProperties(delivery_mode=2),  # 持久化
)
```

**方案二：rabbitmq\_delayed\_message\_exchange 插件**

使用官方延迟消息插件，消息本身携带延迟时间，更灵活（每条消息延迟时间可不同）：

```python
import pika

params = pika.ConnectionParameters('localhost')
connection = pika.BlockingConnection(params)
channel = connection.channel()

# 声明延迟交换机（类型必须是 x-delayed-message）
channel.exchange_declare(
    'delay.exchange',
    exchange_type='x-delayed-message',
    arguments={'x-delayed-type': 'direct'},  # 底层复用 direct 语义
)
channel.queue_declare('task.queue', durable=True)
channel.queue_bind('task.queue', 'delay.exchange', routing_key='task')

channel.basic_publish(
    exchange='delay.exchange',
    routing_key='task',
    body=b'execute after 10s',
    properties=pika.BasicProperties(headers={'x-delay': 10_000}),  # 单条消息延迟 10 秒
)
```

**实现方案对比**

| 维度 | TTL + DLX | 延迟插件 |
|------|-----------|----------|
| 安装依赖 | 无，RabbitMQ 原生 | 需安装 rabbitmq\_delayed\_message\_exchange 插件 |
| 每条消息独立延迟 | 否（同一队列 TTL 相同） | 是（通过 x-delay 头） |
| 队列数量 | 一种延迟时间一个队列 | 一个交换机即可 |
| 性能 | 依赖死信转发，略慢 | 更高效 |
| 生产就绪度 | 稳定成熟 | 官方支持，社区广泛使用 |

### 1.2 死信队列与消息 TTL

**死信队列（Dead Letter Queue）**：消息因以下三种原因之一无法被正常处理时，被投递到死信交换机：

1. **消息被拒绝**：消费者调用 `basic_nack` / `basic_reject` 且 `requeue=False`
2. **消息过期**：消息 TTL 到期仍未消费
3. **队列达到最大长度**：队列已满，最早的消息被丢弃（overflow 行为）

```python
# 消费者拒绝消息 → 进入死信队列
def callback(ch, method, properties, body):
    try:
        process(body)
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception:
        # requeue=False：不重回队列，直接进入死信队列
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

channel.basic_consume('task.queue', callback)
```

**TTL 设置两种粒度**

| 方式 | 位置 | 生效范围 |
|------|------|----------|
| 队列级别 | `x-message-ttl`（queue\_declare arguments） | 该队列所有消息 |
| 消息级别 | `pika.BasicProperties(expiration='10000')` | 单条消息 |

> 注意：两个同时设置时取**较小值**。消息级别的 TTL 在到达队列头部之前不会立即过期——这就是延迟队列的原理基础。

### 1.3 Exchange 与 Binding 高级用法

**Exchange 四种类型回顾**

| 类型 | 路由规则 | 适用场景 |
|------|---------|----------|
| `direct` | routing\_key 精确匹配 | 定向投递、死信转发 |
| `fanout` | 广播到所有绑定队列 | 事件广播、缓存刷新 |
| `topic` | routing\_key 按 `.` 分段通配（`*` 一个词 / `#` 多个词） | 灵活路由、多条件订阅 |
| `headers` | 按消息头属性匹配 | 复杂条件路由（少用） |

**topic 通配符示例**

```python
channel.exchange_declare('logs.exchange', 'topic')

# 绑定：匹配 logs.ERROR.*（ERROR.xxx）
channel.queue_bind('err.queue', 'logs.exchange', routing_key='logs.ERROR.*')
# 绑定：匹配 logs.#（所有 logs 开头）
channel.queue_bind('all.queue', 'logs.exchange', routing_key='logs.#')
```

**Publisher Confirms（发布确认）**

生产环境必须开启发布确认，确保消息真正进入队列：

```python
channel.confirm_delivery()  # 开启 confirm 模式

try:
    channel.basic_publish('logs.exchange', 'logs.INFO.app', b'hello', mandatory=True)
    print('确认：消息已到达队列')
except pika.exceptions.UnroutableError:
    print('路由失败：mandatory=True 且无匹配队列')
except pika.exceptions.NackError:
    print('未确认：broker 拒绝消息')
```

***

## 二、Kafka 深入

### 2.1 分区与副本机制

**分区（Partition）**：Kafka 将一个 Topic 分成多个 Partition，Partition 是**消息顺序性**的基本单位——同一分区的消息严格有序，不同分区之间无序。

**副本（Replica）**：每个分区有多个副本，其中一个是 Leader（负责读写），其余是 Follower（同步备份）。`acks` 参数决定写入可靠性：

| acks 值 | 行为 | 可靠性 | 性能 |
|---------|------|--------|------|
| `0` | 不等待确认 | 可能丢消息 | 最高 |
| `1` | Leader 写入即确认 | Leader 宕机可能丢 | 中 |
| `all`（或 `-1`） | 所有 ISR 副本同步后确认 | 最可靠 | 最低 |

**ISR（In-Sync Replicas）**：与 Leader 保持同步的副本集合。Follower 落后超过阈值会从 ISR 中剔除，避免拖慢 Leader。

### 2.2 消费者组与 Rebalance

**消费者组（Consumer Group）**：同一组的多个消费者共同消费一个 Topic，**一个分区同一时刻只能被组内一个消费者消费**——这是实现并行消费的关键。

```
Topic: orders（4 个分区）
消费者组 group-A：3 个消费者
  consumer-0 → partition-0, partition-1
  consumer-1 → partition-2
  consumer-2 → partition-3
```

**Rebalance**：消费者加入/退出/故障时，分区在消费者之间重新分配。频繁 Rebalance 会导致消费停滞，优化手段：

```python
from kafka import KafkaConsumer

consumer = KafkaConsumer(
    'orders',
    bootstrap_servers=['localhost:9092'],
    group_id='group-a',
    enable_auto_commit=False,          # 关闭自动提交，手动控制 offset
    session_timeout_ms=10_000,          # 心跳超时（默认 10s）
    max_poll_interval_ms=300_000,       # 两次 poll 最大间隔（处理慢时会触发 rebalance）
    max_poll_records=500,               # 单次 poll 最多条数，避免处理超时
)
```

### 2.3 Offset 提交与顺序性

**Offset 提交策略对比**

| 策略 | 做法 | 风险 |
|------|------|------|
| 自动提交 | `enable_auto_commit=True`，默认 5s 提交一次 | 崩溃时重复消费或丢失 |
| 手动同步提交 | `consumer.commit()` 处理完一批后提交 | 阻塞，大批量时性能差 |
| 手动异步提交 + 回调 | `consumer.commit_async()` | 提交失败需重试，注意顺序 |
| 提交前偏移 | 先提交「即将处理的 offset」再处理 | 崩溃时重复消费，但绝不丢失 |

```python
# 手动提交模式：处理完成后提交 offset
while True:
    records = consumer.poll(timeout_ms=1000)
    for tp, messages in records.items():
        for msg in messages:
            handle(msg)          # 业务处理
    consumer.commit()            # 全部处理完再提交
```

**顺序性保证**：Kafka 只保证**单分区内**有序。全局有序需要把 Topic 设为单分区（牺牲并行度）。生产实践：将需要保持顺序的数据（如同一订单的事件）按 key 哈希到同一分区：

```python
producer.send('orders', key=str(order_id), value=event)
# 相同 order_id 的 key 会进入同一分区 → 天然有序
```

### 2.4 恰好一次语义（Exactly-Once）

**三种投递语义对比**

| 语义 | 含义 | Kafka 实现 |
|------|------|-----------|
| At-most-once | 至多一次，可能丢失 | acks=0，消费者不提交 offset |
| At-least-once | 至少一次，可能重复 | acks=all，消费者处理后再提交（默认） |
| Exactly-once | 恰好一次，不丢不重 | 幂等 Producer + 事务 + 消费者幂等 |

**幂等 Producer 与事务**

```python
from kafka import KafkaProducer

# 开启幂等：同一 batch 内自动去重，防止重试导致重复消息
producer = KafkaProducer(
    bootstrap_servers=['localhost:9092'],
    enable_idempotence=True,          # 幂等 Producer（自动设 acks=all）
    acks='all',
    transactional_id='tx-order-service',  # 开启事务（唯一 ID，服务重启后保持）
)

# 事务性发送：要么全部成功，要么全部回滚
producer.init_transactions()
try:
    producer.begin_transaction()
    producer.send('orders', key=b'1', value=b'a')
    producer.send('orders', key=b'2', value=b'b')
    producer.commit_transaction()
except Exception:
    producer.abort_transaction()
```

> 即使 Exactly-once，**消费者的业务处理仍必须幂等**（如去重表、唯一索引），因为网络重试、消费端崩溃恢复本质上无法完全避免重复处理。

### 2.5 消息积压与治理

**积压原因**：消费者处理能力不足、单条消息处理卡死、分区数量少于消费者数量、下游数据库慢。

**排查思路**

1. 用 `kafka-consumer-groups` 查看滞后（lag）：
   ```bash
   kafka-consumer-groups --bootstrap-server localhost:9092 \
     --describe --group group-a
   # 输出 CURRENT-OFFSET / LOG-END-OFFSET / LAG 三列，LAG 大说明积压
   ```

2. 增加消费者数量（不能超过分区数，否则多余消费者空闲）

3. 增加分区数（扩容后需要重启消费者组触发重新分配）

4. 定位慢消息：开启消费耗时日志，隔离异常消息到死信 Topic

**治理规范**

| 措施 | 说明 |
|------|------|
| 消费监控 | 对每个消费组配置 LAG 告警阈值 |
| 消息体规范 | 限制单条消息大小，避免超大 JSON |
| 消费超时兜底 | 单条消息处理超时快速失败，进入重试/死信 Topic |
| 吞吐设计 | 先评估消费者 QPS，再定分区数与实例数 |

***

## 三、可靠性保证对比

### 3.1 三种投递语义

| 维度 | At-most-once | At-least-once | Exactly-once |
|------|--------------|---------------|--------------|
| 语义 | 不重 | 不丢 | 不丢不重 |
| 可能发生 | 丢失 | 重复 | 无（需幂等配合） |
| 实现成本 | 低 | 中 | 高 |
| 适用场景 | 日志、监控指标 | 订单处理、消息通知 | 金融、支付、对账 |

### 3.2 RabbitMQ vs Kafka 可靠性机制

| 维度 | RabbitMQ | Kafka |
|------|----------|-------|
| 确认机制 | 消费者 basic\_ack | 消费者提交 offset |
| 重复消费 | 需手动幂等 | 需手动幂等 |
| 顺序保证 | 单队列内有序 | 单分区内有序 |
| 事务 | 单消息确认 / 插件事务 | 事务性 Producer（多 Topic） |
| 死信处理 | 原生 DLX，灵活 | 需自建死信 Topic + 重试队列 |
| 大规模吞吐 | 万级 QPS | 百万级 QPS |

***

## 四、实践项目

### 项目 1：订单超时自动关闭系统

**目标**：用 RabbitMQ 延迟队列实现「订单 30 分钟未支付自动关闭」，并具备死信兜底。

**步骤**：

1. 定义延迟交换机（x-delayed-message 插件）或 TTL+DLX 方案，延迟 30 分钟
2. 创建订单服务：下单时发布延迟消息
3. 创建定时任务服务：消费延迟消息，查询订单状态
4. 若订单仍为「待支付」，更新为「已关闭」
5. 配置死信队列兜底：消息处理失败进入死信队列并告警

**目录结构参考**：

```
order-delay-demo/
├── docker-compose.yml          # RabbitMQ + MySQL
├── order_service/
│   ├── main.py                 # FastAPI：下单接口
│   ├── producer.py             # 延迟消息发布
│   └── models.py               # 订单模型
├── close_service/
│   ├── consumer.py             # 延迟消息消费 + 关闭订单
│   └── dead_letter.py          # 死信消费与告警
└── requirements.txt
```

### 项目 2：Kafka 事件流平台

**目标**：搭建 Kafka 事件流平台，实现用户行为事件的有序采集、可靠消费与幂等落库。

**步骤**：

1. 单机或 Docker 启动 Kafka，创建 `user_events` Topic（3 分区）
2. 生产者按 `user_id` 作 key，保证单用户事件有序
3. 消费者组实现并行消费，开启 `enable_auto_commit=False` 手动提交
4. 消费端做幂等：以「事件唯一 ID」为主键去重入库
5. 模拟积压场景，用 `kafka-consumer-groups` 观察 LAG，验证扩容策略

**目录结构参考**：

```
kafka-event-demo/
├── docker-compose.yml          # Kafka + Zookeeper/KRaft + UI
├── producer/
│   └── event_producer.py       # 事件采集生产者（幂等 + 事务）
├── consumer/
│   ├── event_consumer.py       # 消费与落库
│   └── dedup.py                # 幂等去重（Redis 或数据库唯一索引）
└── scripts/
    └── check_lag.sh            # 滞后检查脚本
```
