---
url: >-
  /my_notes/notes/JAVA学习路线/di-er-jie-duan-zhu-liu-kuang-jia/3-sse-shi-shi-tui-song-sse-emitter-yu-web-flux/index.md
---
# SSE 实时推送 — SseEmitter 与 WebFlux

## 一、SSE 协议基础

### 1.1 什么是 SSE

**SSE（Server-Sent Events）** 是一种基于 HTTP 的**服务端单向推送**协议。服务端通过一个持久连接向客户端持续发送事件，客户端通过 `EventSource` API 接收。

```
客户端 ──── GET /events ────► 服务端
客户端 ◄─── data: {...}\n\n ─ 服务端  （持续推送）
客户端 ◄─── data: {...}\n\n ─ 服务端
客户端 ◄─── data: {...}\n\n ─ 服务端
```

### 1.2 SSE vs WebSocket vs 轮询

| 特性 | SSE | WebSocket | HTTP 轮询 |
|:-----|:----|:----------|:----------|
| **通信方向** | 服务端 → 客户端（单向） | 双向 | 客户端 → 服务端（单向请求） |
| **协议** | HTTP | ws:// / wss:// | HTTP |
| **数据格式** | 纯文本（UTF-8） | 文本或二进制 | 任意 |
| **自动重连** | 浏览器 EventSource 内置 | 需手动实现 | 不适用 |
| **断点续传** | 内置 Last-Event-ID | 需手动实现 | 不适用 |
| **防火墙/代理友好** | 极好（普通 HTTP） | 较差（需要特殊支持） | 极好 |
| **浏览器支持** | 除 IE 外所有现代浏览器 | 所有现代浏览器 | 所有浏览器 |
| **连接数限制** | HTTP/1.1 同域 6 个 | 同域 6 个 | 每次新建 |

### 1.3 SSE 协议格式

```http
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: 第一条消息

data: 第二条消息，可以很长
data: 多行 data 会被拼接

event: notification
data: {"title": "新消息", "content": "你好"}

id: 1001
data: 带 ID 的事件（支持断点续传）

retry: 5000
data: 客户端重连间隔设为 5 秒

data: 这条消息有 \n 换行符
```

**字段说明**：

| 字段 | 含义 | 规则 |
|:-----|:-----|:-----|
| `data` | 消息内容 | 多行 `data` 用 `\n` 拼接；空行表示事件结束 |
| `event` | 事件类型 | 默认 `"message"`；客户端通过 `addEventListener` 监听自定义类型 |
| `id` | 事件 ID | 设置后浏览器断线重连会发送 `Last-Event-ID` 头 |
| `retry` | 重连间隔（毫秒） | 客户端断线后按此间隔重连 |
| `:` | 注释行 | 用于保持连接活性（心跳） |

***

## 二、Spring MVC — SseEmitter

`SseEmitter` 是 Spring MVC 提供的 SSE 推送实现，适用于 Spring Boot Web 应用。

### 2.1 基础用法

```java
@RestController
@RequestMapping("/api/events")
public class SseController {

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    // 客户端订阅 SSE 连接
    @GetMapping(value = "/subscribe", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribe() {
        // 超时时间：0 表示不超时（长连接）
        SseEmitter emitter = new SseEmitter(0L);
        emitters.add(emitter);

        // 连接关闭时自动移除
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(e -> emitters.remove(emitter));

        return emitter;
    }

    // 向所有已连接客户端推送消息
    @PostMapping("/push")
    public ResponseEntity<Void> push(@RequestBody String message) {
        List<SseEmitter> deadEmitters = new ArrayList<>();
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event()
                    .name("message")
                    .data(message)
                    .id(String.valueOf(System.currentTimeMillis())));
            } catch (IOException e) {
                deadEmitters.add(emitter);
            }
        }
        emitters.removeAll(deadEmitters);
        return ResponseEntity.ok().build();
    }
}
```

### 2.2 发送多种事件类型

```java
@GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public SseEmitter stream() {
    SseEmitter emitter = new SseEmitter(0L);

    // 发送不同类型的消息
    try {
        // 默认 message 事件
        emitter.send("普通消息");

        // 自定义事件类型
        emitter.send(SseEmitter.event()
            .name("heartbeat")
            .data("ping")
            .id("1"));

        emitter.send(SseEmitter.event()
            .name("notification")
            .data(Map.of("title", "新通知", "content": "您有新消息"))
            .id("2"));

        // 发送 JSON 对象（自动序列化）
        emitter.send(SseEmitter.event()
            .name("user-count")
            .data(new UserCountEvent(42))
            .id("3"));

        // 注释行（保持连接心跳，客户端不会收到）
        emitter.send(SseEmitter.event().name(":"));

    } catch (IOException e) {
        // 处理异常
    }

    return emitter;
}
```

### 2.3 线程安全的广播服务

```java
@Service
public class SseNotificationService {

    private final ConcurrentHashMap<String, List<SseEmitter>> userEmitters
        = new ConcurrentHashMap<>();

    // 用户订阅（按用户隔离推送）
    public SseEmitter subscribe(String userId) {
        SseEmitter emitter = new SseEmitter(300_000L); // 5分钟超时
        userEmitters.computeIfAbsent(userId, k -> new CopyOnWriteArrayList<>())
                     .add(emitter);

        emitter.onCompletion(() -> removeEmitter(userId, emitter));
        emitter.onTimeout(() -> removeEmitter(userId, emitter));
        emitter.onError(e -> removeEmitter(userId, emitter));

        return emitter;
    }

    // 向指定用户推送
    public void sendToUser(String userId, String eventName, Object data) {
        List<SseEmitter> emitters = userEmitters.getOrDefault(userId, List.of());
        List<SseEmitter> dead = new ArrayList<>();

        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event()
                    .name(eventName)
                    .data(data));
            } catch (IOException e) {
                dead.add(emitter);
            }
        }
        emitters.removeAll(dead);
    }

    // 广播给所有用户
    public void broadcast(String eventName, Object data) {
        userEmitters.forEach((userId, emitters) -> sendToUser(userId, eventName, data));
    }

    private void removeEmitter(String userId, SseEmitter emitter) {
        userEmitters.computeIfPresent(userId, (k, list) -> {
            list.remove(emitter);
            return list.isEmpty() ? null : list;
        });
    }
}
```

***

## 三、Spring WebFlux — 响应式 SSE

WebFlux 提供了更现代的响应式 SSE 实现，适合高并发场景。

### 3.1 Flux-based SSE

```java
@RestController
@RequestMapping("/api/reactive-events")
public class ReactiveSseController {

    // 使用 Flux 发送 SSE 流
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<String>> stream() {
        return Flux.interval(Duration.ofSeconds(1))
            .map(seq -> ServerSentEvent.<String>builder()
                .id(String.valueOf(seq))
                .event("heartbeat")
                .data("脉搏 #" + seq)
                .build());
    }

    // 发送 JSON 对象
    @GetMapping(value = "/metrics", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<SystemMetrics>> metrics() {
        return Flux.interval(Duration.ofSeconds(5))
            .map(seq -> ServerSentEvent.<SystemMetrics>builder()
                .id(String.valueOf(seq))
                .event("metrics")
                .data(new SystemMetrics(
                    Runtime.getRuntime().totalMemory(),
                    Runtime.getRuntime().freeMemory(),
                    ProcessHandle.current().pid()
                ))
                .build());
    }
}
```

### 3.2 WebFlux SSE 模板类

```java
@Component
public class SseEmitterManager {

    private final ConcurrentHashMap<String, Sinks.Many<ServerSentEvent<Object>>> sinks
        = new ConcurrentHashMap<>();

    // 创建或获取用户的 SSE Sink
    public Sinks.Many<ServerSentEvent<Object>> getOrCreateSink(String userId) {
        return sinks.computeIfAbsent(userId, k -> {
            Sinks.Many<ServerSentEvent<Object>> sink = Sinks.many()
                .multicast()
                .onBackpressureBuffer(256, true);
            return sink;
        });
    }

    // 发送给指定用户
    public void sendToUser(String userId, String eventName, Object data) {
        Sinks.Many<ServerSentEvent<Object>> sink = sinks.get(userId);
        if (sink != null) {
            sink.tryEmitNext(ServerSentEvent.builder()
                .event(eventName)
                .data(data)
                .id(String.valueOf(System.currentTimeMillis()))
                .build());
        }
    }

    // 返回 Flux 用于 SSE 连接
    public Flux<ServerSentEvent<Object>> getStream(String userId) {
        return getOrCreateSink(userId).asFlux()
            .doOnCancel(() -> removeSink(userId));
    }

    private void removeSink(String userId) {
        Sinks.Many<ServerSentEvent<Object>> sink = sinks.remove(userId);
        if (sink != null) {
            sink.tryEmitComplete();
        }
    }
}
```

***

## 四、SSE 客户端实现

### 4.1 浏览器 EventSource API

```javascript
// 基础用法
const source = new EventSource('/api/events/subscribe');

source.onmessage = (event) => {
    console.log('收到消息:', event.data);
    console.log('事件 ID:', event.id);
};

// 监听自定义事件类型
source.addEventListener('notification', (event) => {
    const data = JSON.parse(event.data);
    showNotification(data.title, data.content);
});

source.addEventListener('heartbeat', (event) => {
    console.log('心跳:', event.data);
});

// 错误处理（自动重连）
source.onerror = (error) => {
    console.error('SSE 错误:', error);
    // EventSource 会自动重连，可在此更新 UI 状态
};

// 关闭连接
// source.close();
```

### 4.2 fetch + ReadableStream（现代方式）

```javascript
async function subscribeSSE() {
    const response = await fetch('/api/events/subscribe');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        // 按照 SSE 格式解析
        const lines = text.split('\n');
        for (const line of lines) {
            if (line.startsWith('data:')) {
                console.log('收到:', line.slice(5).trim());
            }
        }
    }
}
```

### 4.3 Java 客户端（WebClient）

```java
@Service
public class SseClientService {

    private final WebClient webClient;

    public SseClientService(WebClient.Builder builder) {
        this.webClient = builder.baseUrl("http://api-server").build();
    }

    // 订阅 SSE 流
    public Flux<ServerSentEvent<String>> subscribe() {
        return webClient.get()
            .uri("/api/events/subscribe")
            .accept(MediaType.TEXT_EVENT_STREAM)
            .retrieve()
            .bodyToFlux(new ParameterizedTypeReference<ServerSentEvent<String>>() {});
    }

    // 使用示例
    public void consumeEvents() {
        subscribe()
            .subscribe(
                event -> {
                    System.out.println("收到事件 [" + event.event() + "]: " + event.data());
                },
                error -> System.err.println("错误: " + error.getMessage()),
                () -> System.out.println("连接关闭")
            );
    }
}
```

***

## 五、SSE 实战场景

### 5.1 实时日志流

```java
@GetMapping(value = "/logs", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public SseEmitter streamLogs(@RequestParam(defaultValue = "INFO") String level) {
    SseEmitter emitter = new SseEmitter(0L);

    // 启动异步线程tail日志文件
    CompletableFuture.runAsync(() -> {
        try (BufferedReader reader = new BufferedReader(
                new FileReader("/var/log/app/application.log"))) {
            String line;
            while ((line = reader.readLine()) != null && !Thread.currentThread().isInterrupted()) {
                if (line.contains(level)) {
                    emitter.send(SseEmitter.event()
                        .name("log")
                        .data(line)
                        .id(String.valueOf(System.currentTimeMillis())));
                }
                Thread.sleep(100); // 模拟实时读取
            }
        } catch (Exception e) {
            emitter.completeWithError(e);
        }
    });

    emitter.onCompletion(() -> Thread.currentThread().interrupt());
    return emitter;
}
```

### 5.2 AI 流式输出（LLM Streaming）

```java
// 对接大语言模型的流式输出
@GetMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public SseEmitter chat(@RequestParam String prompt) {
    SseEmitter emitter = new SseEmitter(60_000L); // 60秒超时

    CompletableFuture.runAsync(() -> {
        try {
            // 模拟调用大模型 API（每次返回一个 token）
            List<String> tokens = List.of("你", "好", "，", "我", "是", "AI", "助", "手", "。");
            for (int i = 0; i < tokens.size(); i++) {
                emitter.send(SseEmitter.event()
                    .name("token")
                    .data(Map.of(
                        "token", tokens.get(i),
                        "index", i
                    ))
                    .id(String.valueOf(i)));
                Thread.sleep(200); // 模拟生成延迟
            }

            // 发送结束事件
            emitter.send(SseEmitter.event()
                .name("done")
                .data(""));

            emitter.complete();
        } catch (Exception e) {
            emitter.completeWithError(e);
        }
    });

    return emitter;
}
```

***

## 六、SSE 注意事项与最佳实践

### 6.1 服务端

| 问题 | 解决方案 |
|:-----|:---------|
| 连接数限制（Tomcat 默认 200） | 调整 `server.tomcat.threads.max` 或使用 NIO 连接池 |
| 长连接超时 | `SseEmitter(0L)` 设置无超时；或配置 `spring.mvc.async.request-timeout` |
| 内存泄漏 | 连接关闭时必须移除 emitter；使用 `onCompletion`/`onError` 回调 |
| 负载均衡 | 需要使用粘性会话（Sticky Session）或广播模式（每个节点维护自己的连接） |
| 断线重连 | 服务端发送 `id` 字段；客户端 `EventSource` 自动发送 `Last-Event-ID` |

### 6.2 生产建议

```
□ 连接池大小评估：根据最大并发连接数调整 Tomcat 线程池
□ 心跳机制：每隔 15-30 秒发送注释行（:keepalive），防止代理/防火墙断连
□ 超时设置：生产环境不要设置 0（永不超时），建议 5-30 分钟
□ 负载均衡策略：使用 IP Hash 或 Sticky Session，避免 SSE 连接被路由到不同节点
□ 监控：暴露 SSE 连接数指标，接入 Prometheus + Grafana
```

***
