---
url: >-
  /my_notes/notes/Python学习路线/di-si-jie-duan-fen-bu-shi-yu-bu-shu/3-ke-guan-ce-xing/index.md
---
# 可观测性

## 一、日志体系

### 1.1 结构化日志

传统的文本日志难以被机器解析和检索，生产环境应输出**结构化日志**（JSON 格式），方便 ELK/Loki 等平台采集。

**日志三大支柱**

| 支柱 | 关注点 | 典型工具 |
|------|--------|---------|
| **Logging（日志）** | 发生了什么 | Python logging、Loguru、ELK、Loki |
| **Metrics（指标）** | 系统状态如何 | Prometheus、Grafana |
| **Tracing（追踪）** | 一次请求经历了什么 | OpenTelemetry、Jaeger |

**Python logging JSON 格式化**

```python
import json
import logging
from datetime import datetime


class JsonFormatter(logging.Formatter):
    """自定义 JSON 日志格式器"""
    def format(self, record):
        data = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        # 附加 request_id 等上下文（存在 record 上）
        if hasattr(record, "request_id"):
            data["request_id"] = record.request_id
        if record.exc_info:
            data["exception"] = self.formatException(record.exc_info)
        return json.dumps(data, ensure_ascii=False)


# 配置根 logger
handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
root = logging.getLogger()
root.setLevel(logging.INFO)
root.addHandler(handler)

# 使用方式：把上下文附加到日志记录
logger = logging.getLogger("order")
extra = {"request_id": "req-12345"}
logger.info("订单创建成功", extra=extra)
# 输出：{"timestamp":"2026-08-15T08:00:00Z","level":"INFO",...,"request_id":"req-12345"}
```

**日志级别与使用规范**

| 级别 | 使用场景 | 示例 |
|------|---------|------|
| DEBUG | 调试细节 | 参数、中间变量 |
| INFO | 关键业务事件 | 下单成功、任务完成 |
| WARNING | 潜在问题 | 重试、阈值接近上限 |
| ERROR | 异常但可恢复 | 单次请求失败 |
| CRITICAL | 严重故障 | 服务不可用、数据损坏 |

### 1.2 日志采集方案

**ELK / EFK 方案**

```
应用 ---> Filebeat/fluent-bit ---> Logstash ---> Elasticsearch ---> Kibana
   （采集日志）              （清洗处理）   （存储检索）      （可视化）
```

**Loki 方案（轻量，配合 Grafana）**

```
应用 ---> Promtail ---> Loki ---> Grafana
   （采集）      （存储）    （查询展示）
```

**日志采集注意点**

```python
# 1. 日志中不要记录敏感信息
logger.info(f"用户密码: {password}")   # ❌ 密码泄漏
logger.info(f"用户 {user.id} 登录成功") # ✅

# 2. 循环中避免重复打日志
for item in items:
    logger.debug(f"处理 {item}")        # ❌ 高并发下日志爆炸
# ✅ 改为统计汇总后打印一次

# 3. 采样：高流量日志只记录部分
if random.random() < 0.1:               # 10% 采样
    logger.info(f"慢请求: {elapsed:.2f}s")
```

***

## 二、指标监控：Prometheus + Grafana

### 2.1 Prometheus 指标类型

| 指标类型 | 说明 | 示例 |
|---------|------|------|
| **Counter（计数器）** | 只增不减 | 请求总数、错误总数 |
| **Gauge（仪表盘）** | 可增可减 | 当前连接数、队列长度 |
| **Histogram（直方图）** | 观测值分布 | 请求延迟分位 |
| **Summary（摘要）** | 观测值摘要 | 分位数（客户端计算） |

### 2.2 prometheus-client 接入 Python

```python
# metrics.py — 定义指标
from prometheus_client import Counter, Histogram, Gauge, generate_latest
from fastapi import FastAPI, Request
from fastapi.responses import Response
import time

# 指标定义
REQUEST_COUNT = Counter(
    "http_requests_total",
    "HTTP 请求总数",
    ["method", "path", "status"],
)
REQUEST_LATENCY = Histogram(
    "http_request_duration_seconds",
    "HTTP 请求耗时",
    ["method", "path"],
    buckets=(0.005, 0.01, 0.05, 0.1, 0.5, 1, 5),
)
ACTIVE_REQUESTS = Gauge("http_requests_active", "进行中的请求数")


# FastAPI 中间件：记录请求指标
@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    ACTIVE_REQUESTS.inc()
    start = time.perf_counter()

    response = await call_next(request)

    duration = time.perf_counter() - start
    REQUEST_COUNT.labels(
        method=request.method, path=request.url.path, status=response.status_code
    ).inc()
    REQUEST_LATENCY.labels(
        method=request.method, path=request.url.path
    ).observe(duration)
    ACTIVE_REQUESTS.dec()
    return response


# 暴露 /metrics 接口给 Prometheus 抓取
@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type="text/plain")
```

### 2.3 Prometheus 配置与抓取

```yaml
# prometheus.yml
global:
  scrape_interval: 15s          # 抓取间隔

scrape_configs:
  - job_name: "fastapi-app"
    static_configs:
      - targets: ["api:8000"]
```

```yaml
# docker-compose 中加入 Prometheus 和 Grafana
services:
  prometheus:
    image: prom/prometheus:latest
    ports: ["9090:9090"]
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"

  grafana:
    image: grafana/grafana:latest
    ports: ["3000:3000"]
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

**常用 PromQL 查询**

```promql
# 总请求速率（5 分钟内）
rate(http_requests_total[5m])

# 4xx/5xx 错误率
sum(rate(http_requests_total{status=~"5.."}[5m]))
/ sum(rate(http_requests_total[5m]))

# P95 延迟
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
```

***

## 三、分布式追踪：OpenTelemetry

### 3.1 核心概念

分布式追踪用于定位一次跨服务请求的完整调用链：

**Trace 与 Span**

```
Trace（一次完整请求）
├── Span A（网关接收请求）          duration: 0ms ~ 100ms
│   └── Span B（调用用户服务）       duration: 10ms ~ 50ms
│       └── Span C（用户服务查库）   duration: 15ms ~ 30ms
└── Span D（返回响应）              duration: 80ms ~ 100ms
```

1. **Trace（追踪）**：一次请求贯穿多个服务的完整链路，用 trace\_id 标识
2. **Span（跨度）**：链路中的一个操作单元，用 span\_id 标识，父子关系形成树
3. **采样**：全量追踪开销大，通常按比例采样（如 10%）

### 3.2 OpenTelemetry Python SDK 接入

```python
# tracing.py — FastAPI + OpenTelemetry 集成
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor


def setup_tracing(service_name: str = "order-api"):
    # 1. 配置 Tracer Provider 与导出器（发送到 Jaeger/OTLP Collector）
    provider = TracerProvider(
        resource=Resource.create({"service.name": service_name})
    )
    exporter = OTLPSpanExporter(endpoint="http://jaeger:4317", insecure=True)
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)

    # 2. 自动埋点：FastAPI 请求 + requests HTTP 调用
    FastAPIInstrumentor.instrument()
    RequestsInstrumentor.instrument()


# 手动创建 Span（标注关键业务节点）
from opentelemetry import trace

tracer = trace.get_tracer("order.service")

def create_order(user_id: int):
    with tracer.start_as_current_span("create_order") as span:
        span.set_attribute("user.id", user_id)       # 附加业务属性
        span.add_event("db.query", {"sql": "INSERT INTO orders"})  # 记录事件
        result = do_db_work()
        if result is None:
            span.set_status(trace.Status(trace.StatusCode.ERROR, "订单创建失败"))
        return result
```

**Jaeger 部署**

```yaml
services:
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"      # Web UI
      - "4317:4317"        # OTLP gRPC
      - "4318:4318"        # OTLP HTTP
```

**排查思路**：在 Jaeger 中找到慢 Trace，查看耗时最高的 Span，定位是网络、DB 还是第三方调用。

***

## 四、异常监控与性能压测

### 4.1 Sentry 异常监控

Sentry 用于实时收集线上异常并聚合告警：

```python
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.logging import LoggingIntegration

sentry_sdk.init(
    dsn="https://your-key@sentry.io/1234567",
    traces_sample_rate=0.1,          # 追踪采样率
    environment="production",
    integrations=[
        FastApiIntegration(),
        LoggingIntegration(level=40),   # 自动上报 ERROR 级别日志
    ],
)


# 主动上报（捕获但不中断）
try:
    result = risky_operation()
except Exception as e:
    sentry_sdk.capture_exception(e)    # 上报异常，业务继续
```

### 4.2 告警规则

Prometheus 告警规则示例：

```yaml
# alerting-rules.yml
groups:
  - name: app-alerts
    rules:
      - alert: HighErrorRate
        # 5 分钟内错误率超过 5%
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m]))
          / sum(rate(http_requests_total[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "错误率超过 5%"
          description: "服务 {{ $labels.job }} 5xx 错误率过高"

      - alert: HighLatency
        expr: |
          histogram_quantile(0.95,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
          > 1.0
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "P95 延迟超过 1 秒"
```

### 4.3 Locust 性能压测

```python
# locustfile.py — 压测脚本
from locust import HttpUser, task, between


class UserBehavior(HttpUser):
    # 每个虚拟用户两次请求间隔 1~3 秒
    wait_time = between(1, 3)

    @task(3)   # 权重 3：更频繁
    def get_todos(self):
        self.client.get("/todos")

    @task(1)   # 权重 1
    def create_todo(self):
        self.client.post("/todos", json={"title": "测试任务"})


class StressUser(HttpUser):
    """压力测试：不停歇请求"""
    wait_time = lambda self: 0.05    # 50ms 间隔

    @task
    def get_health(self):
        self.client.get("/health")
```

```bash
# 启动压测（Web 界面 http://localhost:8089 可调并发数）
locust -f locustfile.py --host http://localhost:8000

# 无界面运行
locust -f locustfile.py --host http://localhost:8000 \
  --headless -u 1000 -r 100 --run-time 5m \
  --html report.html
# -u 1000：1000 个并发用户  -r 100：每秒增加 100 个
```

**压测结果关注指标**

| 指标 | 含义 | 健康阈值 |
|------|------|---------|
| **QPS / RPS** | 每秒请求数 | 无固定值，看业务 |
| **P50 / P95 / P99** | 延迟分位 | P95 < 500ms |
| **错误率** | 非 2xx 占比 | < 0.1% |
| **CPU / 内存** | 资源占用 | CPU < 80% |

***

## 五、实践项目

### 项目 1：为容器化 API 接入指标与日志

**目标**：为 FastAPI 应用接入 Prometheus 指标 + 结构化日志 + Sentry，实现基础可观测。

**步骤**：

1. 用 prometheus-client 定义请求数、延迟、活跃连接指标
2. 实现 JSON 结构化日志格式器
3. docker-compose 加入 Prometheus + Grafana + Loki
4. 集成 Sentry，模拟一次异常验证上报
5. Grafana 中配置 P95 延迟面板和错误率告警

**目录结构参考**：

```
observable-api/
├── app/
│   ├── main.py               # FastAPI 入口
│   ├── metrics.py            # Prometheus 指标
│   └── logging_conf.py       # JSON 日志配置
├── prometheus/
│   ├── prometheus.yml
│   └── alerting-rules.yml
├── docker-compose.yml        # api + prometheus + grafana + loki
└── locustfile.py             # 压测脚本
```

### 项目 2：OpenTelemetry 全链路追踪

**目标**：两个服务（订单 + 库存）之间实现全链路追踪。

**步骤**：

1. 编写两个 FastAPI 服务，订单服务 HTTP 调用库存服务
2. 两个服务都接入 OpenTelemetry SDK
3. docker-compose 启动 Jaeger
4. 发起一次下单请求，在 Jaeger UI 查看完整调用链
5. 定位并优化耗时最长的 Span

**目录结构参考**：

```
tracing-demo/
├── order-service/
│   ├── app/main.py
│   └── tracing.py
├── stock-service/
│   ├── app/main.py
│   └── tracing.py
├── docker-compose.yml        # order + stock + jaeger
└── scripts/                  # 压测与验证脚本
```
