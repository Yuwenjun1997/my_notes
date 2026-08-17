---
url: >-
  /my_notes/notes/Python学习路线/shen-du-xue-xi/04-dev-ops/3-jian-kong-gao-jing-yu-ri-zhi-ping-tai/index.md
---
# 监控告警与日志平台

> 面向生产环境的可观测性实战，掌握 Prometheus + Grafana 指标监控、Loki 日志收集、OpenTelemetry 链路追踪，以及黄金指标方法论与故障复盘流程。

***

## 一、Prometheus 监控深入

### 1.1 架构与指标类型

Prometheus 采用**拉取（Pull）模式**采集指标，由 exporter 暴露 `/metrics` 端点，Prometheus 周期性抓取并存储到时序数据库。

```text
应用 → [metrics 端点] ← 抓取 ← Prometheus → 存储 TSDB
                                    │
                                    ├─ 告警规则 → Alertmanager → 通知
                                    └─ 数据查询 ← Grafana 面板
```

**四种核心指标类型**

| 类型 | 语义 | 典型场景 | 命名示例 |
|:-----|:-----|:---------|:--------|
| Counter | 只增不减的计数器 | 请求总数、错误数 | `http_requests_total` |
| Gauge | 可增可减的瞬时值 | CPU 使用率、在线连接数 | `node_cpu_usage` |
| Histogram | 观测值分布（桶） | 请求耗时分布、延迟 | `http_request_duration_seconds` |
| Summary | 观测值分位数 | 类似 Histogram，客户端计算 | `rpc_latency_seconds` |

### 1.2 自定义 Python exporter

用 `prometheus_client` 暴露业务指标：

```python
from prometheus_client import Counter, Histogram, Gauge, start_http_server
import random, time

# 指标定义
REQUESTS = Counter('http_requests_total', 'HTTP 请求总数', ['method', 'endpoint'])
LATENCY = Histogram('http_request_duration_seconds', '请求耗时',
                    buckets=(0.01, 0.05, 0.1, 0.5, 1, 2.5, 5))
IN_FLIGHT = Gauge('http_requests_in_flight', '处理中请求数')

def handle_request(method: str, endpoint: str):
    IN_FLIGHT.inc()                      # 请求开始 +1
    start = time.time()
    try:
        time.sleep(random.uniform(0.01, 0.3))   # 模拟业务
        REQUESTS.labels(method=method, endpoint=endpoint).inc()
    finally:
        LATENCY.observe(time.time() - start)    # 记录耗时
        IN_FLIGHT.dec()                  # 请求结束 -1

if __name__ == '__main__':
    start_http_server(9101)              # 暴露 /metrics 端点
    while True:
        handle_request('GET', '/api/items')
```

### 1.3 告警规则与 Alertmanager

```yaml
# prometheus/alerts.yml
groups:
  - name: python-app
    rules:
      - alert: HighErrorRate          # 错误率超过 5% 持续 5 分钟
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m]))
          / sum(rate(http_requests_total[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "错误率过高 {{ $value | humanizePercentage }}"

      - alert: ServiceDown            # 服务不可用
        expr: up == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "实例 {{ $labels.instance }} 已下线"

      - alert: HighLatency            # P95 延迟超过 2s
        expr: histogram_quantile(0.95,
                sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "P95 延迟超过 2 秒"
```

```yaml
# alertmanager.yml —— 告警路由与通知
route:
  group_by: ['alertname', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  routes:
    - match:
        severity: critical
      receiver: pager   # 严重告警走值班电话
    - match:
        severity: warning
      receiver: email   # 一般告警邮件通知

receivers:
  - name: email
    email_configs:
      - to: ops@example.com
        from: alert@example.com
```

***

## 二、Grafana 监控大盘

### 2.1 面板设计

一个合格的监控大盘围绕**黄金指标**设计，通常包含三类视图：

```text
服务总览大盘
├── 红色：请求速率（QPS）曲线
├── 红色：错误率（5xx 比例）曲线
├── 橙色：延迟 P50 / P95 / P99 分位数
├── 绿色：饱和度（CPU / 内存 / 连接数）
└── 灰色：业务指标（订单量、队列积压）
```

**常用 PromQL 查询**

| 需求 | PromQL |
|:-----|:-------|
| QPS | `sum(rate(http_requests_total[1m]))` |
| 错误率 | `sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))` |
| P95 延迟 | `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))` |
| 实例存活 | `up == 0` |
| CPU 使用率 | `100 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100` |

### 2.2 告警通道与值班

Grafana 告警支持接入 **钉钉 / 企业微信 / Slack / Webhook**，将告警与值班流程打通：

```yaml
# 钉钉机器人 Webhook 通知（通过告警联系点配置）
{
  "alertRule": "{{ alert.name }}",
  "message": "{{ alert.message }}",
  "severity": "{{ alert.severity }}",
  "time": "{{ alert.evalTimestamp }}"
}
```

**告警分级**

| 级别 | 含义 | 响应要求 | 通知渠道 |
|:-----|:-----|:---------|:--------|
| P0 | 核心服务不可用 | 立即响应，15 分钟恢复 | 电话 + 短信 + IM |
| P1 | 功能受损 | 1 小时内处理 | 短信 + IM |
| P2 | 性能劣化 / 潜在风险 | 工作时间处理 | IM |
| P3 | 提示信息 | 记录跟进 | 邮件 |

***

## 三、Loki 日志收集

### 3.1 架构与收集

Loki 采用**标签（label）索引 + 日志内容压缩存储**的轻量方案，与 Prometheus 的标签体系无缝衔接：

```text
应用 stdout/stderr → Promtail 采集 → Loki 存储
                                         │
                                         └─ LogQL 查询 ← Grafana 展示
```

**结构化日志是前提**——应用先输出 JSON 格式日志，日志平台才能高效检索：

```python
import json, logging, sys

# 结构化日志：JSON 格式，附带 request_id、trace_id 等上下文
class JsonFormatter(logging.Formatter):
    def format(self, record):
        payload = {
            'ts': self.formatTime(record, '%Y-%m-%dT%H:%M:%S%z'),
            'level': record.levelname,
            'logger': record.name,
            'msg': record.getMessage(),
        }
        if record.exc_info:
            payload['exc'] = self.formatException(record.exc_info)
        # ❌ 不要把 request_id 塞进消息字符串
        # ✅ 作为独立字段，便于 LogQL 精确过滤
        payload.update(getattr(record, 'ctx', {}))
        return json.dumps(payload, ensure_ascii=False)

handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(JsonFormatter())
logging.basicConfig(level=logging.INFO, handlers=[handler])
logger = logging.getLogger(__name__)

logger.info('订单创建', extra={'ctx': {'order_id': '2026-0001', 'user_id': 88}})
```

### 3.2 Promtail 配置与 LogQL 查询

```yaml
# promtail.yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: app
    static_configs:
      - targets: [localhost]
        labels:
          job: myapp
          service: api
          __path__: /var/log/app/*.log
```

**常用 LogQL 查询**

| 需求 | LogQL |
|:-----|:------|
| 最近 1 小时错误日志 | `{job="myapp"} \| json \| level="ERROR"` |
| 按接口统计错误数 | `sum by (endpoint) (count_over_time({job="myapp"} \| json \| level="ERROR"[1h]))` |
| 某个订单号全链路日志 | `{job="myapp"} \| json \| order_id="2026-0001"` |
| 提取字段并过滤 | `{service="api"} \| json \| status >= 500` |
| 速率展示 | `rate({job="myapp"} \| json \| level="ERROR"[5m])` |

### 3.3 日志方案对比

| 方案 | 索引 | 存储 | 查询 | 适合场景 |
|:-----|:-----|:-----|:-----|:--------|
| ELK（ES） | 全文索引 | 重 | 强大 | 海量日志、复杂检索 |
| Loki | 标签索引 | 轻 | 标签 + 内容过滤 | 与 Prometheus 结合、轻量 |
| 云厂商（CloudWatch/SLS） | 托管 | 托管 | 托管 | 无运维团队、快速接入 |

***

## 四、链路追踪与异常监控

### 4.1 OpenTelemetry 接入

分布式系统中，用 **Trace（链路）+ Span（片段）** 串联一次请求跨多个服务的过程：

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

# 初始化 TracerProvider 并导出到 Jaeger/OTel Collector
provider = TracerProvider()
provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(
    endpoint="http://jaeger:4317"
)))
trace.set_tracer_provider(provider)

tracer = trace.get_tracer("myapp")

def business_logic():
    with tracer.start_as_current_span("db.query") as span:
        span.set_attribute("db.table", "orders")   # 记录关键属性
        span.set_attribute("user.id", 88)
        result = execute_sql()
    return result

# FastAPI 自动埋点：自动生成 HTTP 层 Span
# FastAPIInstrumentor.instrument_app(app)
```

### 4.2 指标 / 日志 / 链路三类信号关联

一次请求的可观测性三件套，通过 **request\_id / trace\_id** 关联：

```python
import uuid
from fastapi import Request

async def request_id_middleware(request: Request, call_next):
    # 生成或透传 request_id
    rid = request.headers.get('X-Request-ID', str(uuid.uuid4()))
    request.state.request_id = rid
    response = await call_next(request)
    response.headers['X-Request-ID'] = rid
    return response
```

| 信号 | 回答的问题 | 工具 |
|:-----|:-----------|:-----|
| 指标（Metrics） | 服务健康吗？QPS/延迟/错误率多少 | Prometheus + Grafana |
| 日志（Logs） | 具体发生了什么？错误细节？ | Loki / ELK |
| 链路（Traces） | 慢在哪一环？跨服务调用关系？ | Jaeger / Tempo |

### 4.3 Sentry 异常监控

Sentry 专注**异常采集与告警**，自动捕获未处理异常、聚合相似错误、附带堆栈与用户上下文：

```python
import sentry_sdk

sentry_sdk.init(
    dsn="https://<public-key>@o<org>.ingest.sentry.io/<project>",
    environment="production",
    traces_sample_rate=0.1,          # 抽样，控制成本
    release="myapp@1.2.0",
)

# 捕获主动标记的错误
try:
    risky_call()
except Exception as e:
    sentry_sdk.capture_exception(e)

# 绑定用户上下文，便于定位受影响用户
# sentry_sdk.set_user({"id": user.id, "email": user.email})
```

***

## 五、监控方法论与故障复盘

### 5.1 黄金指标方法论

| 方法论 | 指标 | 一句话定义 |
|:-------|:-----|:----------|
| RED（服务视角） | Rate / Errors / Duration | QPS、错误率、延迟 |
| USE（资源视角） | Utilization / Saturation / Errors | 利用率、饱和度、错误 |
| 四大黄金信号 | 延迟 / 流量 / 错误 / 饱和度 | Google SRE 综合视角 |

**分层监控思维**：业务层（订单量）→ 应用层（QPS/延迟）→ 中间件层（Redis/DB）→ 基础设施层（CPU/内存/磁盘）。

### 5.2 故障复盘流程

```
监控告警触发
   │
   ▼
1. 止血（Rollback / 限流 / 扩容）          ← 立即执行
   ▼
2. 定位（链路 → 日志 → 指标关联分析）
   ▼
3. 根因（5 Whys 追问，区分直接/根本原因）
   ▼
4. 修复 + 验证
   ▼
5. 复盘（时间线 / 影响范围 / 改进项）
   ▼
6. 跟进（告警优化 / 补测试 / 改进文档）
```

**复盘改进清单**：补齐监控盲区、告警噪音治理（去重/升级）、补回归测试、沉淀故障处理文档。

***

## 六、实践项目

### 项目 1：为 FastAPI 应用搭建完整监控告警

**目标**：为「FastAPI + PostgreSQL」应用接入 Prometheus 指标、Grafana 大盘与告警，实现「指标 → 大盘 → 告警 → 通知」闭环。

**步骤**：

1. 在 FastAPI 中用 `prometheus_client` 暴露 `/metrics`，记录 QPS、延迟、错误率
2. 编写 `prometheus.yml` 抓取配置与 `alerts.yml` 告警规则（错误率、服务下线）
3. 配置 docker-compose 加入 prometheus / grafana / alertmanager 服务
4. 在 Grafana 配置 Prometheus 数据源，设计「请求量 / 错误率 / P95 延迟 / 实例存活」面板
5. 配置一条钉钉/邮件告警，用压测触发验证闭环

**目录结构参考**：

```
observability/
├── app/
│   └── main.py                 # FastAPI + metrics 端点
├── prometheus/
│   ├── prometheus.yml
│   └── alerts.yml
├── grafana/
│   └── provisioning/datasources/
│       └── datasource.yml
├── alertmanager/
│   └── alertmanager.yml
└── docker-compose.yml
```

### 项目 2：结构化日志 + Loki 日志检索演练

**目标**：让应用输出 JSON 结构化日志，接入 Promtail + Loki，用 LogQL 完成「按级别过滤、按订单号检索、错误率统计」三类查询。

**步骤**：

1. 封装 JsonFormatter，为每条日志附加 `request_id`、`order_id` 上下文
2. 编写 Promtail 配置，采集应用日志目录
3. docker-compose 加入 loki / promtail，Grafana 添加 Loki 数据源
4. 制造几条错误日志，验证 LogQL：`{job="myapp"} | json | level="ERROR"`
5. 实现「按订单号一键检索全链路日志」查询

**目录结构参考**：

```
logging-platform/
├── app/
│   └── main.py                 # 结构化日志输出
├── promtail/
│   └── promtail.yml
├── docker-compose.yml          # loki + promtail + grafana
└── queries.logql               # 常用 LogQL 示例注释
```
