---
url: >-
  /my_notes/notes/Python学习路线/shen-du-xue-xi/03-microservices/2-g-rpc-wei-fu-wu-shi-zhan/index.md
---
# gRPC 微服务实战

## 一、proto 与 gRPC 基础

### 1.1 gRPC 核心概念

gRPC 是 Google 开源的高性能 RPC 框架，基于 **HTTP/2** 传输，默认使用 **Protocol Buffers（protobuf）** 作为接口定义语言（IDL）和序列化协议。相比 REST 的 JSON，protobuf 体积更小、解析更快，且天然具备强类型接口契约。

**技术要点**

| 特性 | 说明 |
|------|------|
| 传输协议 | HTTP/2（多路复用、头部压缩、双向流） |
| 序列化 | Protocol Buffers（二进制，比 JSON 小 3-10 倍） |
| 接口契约 | .proto 文件定义服务与消息，多语言代码生成 |
| 通信模式 | Unary / Server streaming / Client streaming / Bidirectional streaming |
| 认证 | 基于 metadata（类似 HTTP Header）传递 Token、TLS |

### 1.2 proto 语法

**proto3 基础定义**

```proto
syntax = "proto3";

package user.v1;

// 请求消息
message GetUserRequest {
  int64 id = 1;          // 字段编号从 1 开始，用于二进制编码
}

// 响应消息
message User {
  int64 id = 1;
  string name = 2;
  string email = 3;
  // 枚举
  enum Status {
    STATUS_UNSPECIFIED = 0;  // proto3 枚举首值必须为 0
    STATUS_ACTIVE = 1;
    STATUS_DISABLED = 2;
  }
  Status status = 4;
  // 嵌套消息
  Address address = 5;
  // 重复字段 → 列表
  repeated string tags = 6;
  // 可空字段（包装类型）
  google.protobuf.Timestamp created_at = 7;
}

message Address {
  string country = 1;
  string city = 2;
}

// 服务定义
service UserService {
  // 一元 RPC：请求-响应
  rpc GetUser(GetUserRequest) returns (User);
  // 服务端流式：客户端一次请求，服务端多次返回
  rpc ListUsers(ListUsersRequest) returns (stream User);
  // 客户端流式：客户端多次发送，服务端一次返回
  rpc CreateUsers(stream CreateUserRequest) returns (CreateUsersReply);
  // 双向流式
  rpc Chat(stream ChatMessage) returns (stream ChatMessage);
}
```

**常用标量类型**

| proto 类型 | Python 类型 | 说明 |
|------------|-------------|------|
| `int32` / `int64` | int | 默认 0 |
| `float` / `double` | float | 默认 0.0 |
| `bool` | bool | 默认 False |
| `string` | str | 默认 ""（UTF-8） |
| `bytes` | bytes | 默认 b"" |
| `repeated` | list | 列表 |
| `map<string, string>` | dict | 字典 |
| `oneof` | — | 多字段只允许设置一个 |

### 1.3 代码生成与项目搭建

**安装工具链**

```bash
pip install grpcio grpcio-tools

# 根据 proto 生成 Python 代码
python -m grpc_tools.protoc \
  -I ./proto \
  --python_out=./generated \
  --grpc_python_out=./generated \
  ./proto/user.proto
```

生成两个文件：`user_pb2.py`（消息序列化）和 `user_pb2_grpc.py`（服务桩）。

***

## 二、gRPC 服务端与客户端

### 2.1 服务端实现

```python
import grpc
from concurrent import futures
from generated import user_pb2, user_pb2_grpc

class UserService(user_pb2_grpc.UserServiceServicer):
    def GetUser(self, request, context):
        # 从模拟库查询
        user = db.get(request.id)
        if user is None:
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details(f'user {request.id} not found')
            return user_pb2.User()
        return user_pb2.User(id=user.id, name=user.name, email=user.email)

    def ListUsers(self, request, context):
        # 服务端流式：yield 逐条返回
        for user in db.list_all():
            yield user_pb2.User(id=user.id, name=user.name)

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    user_pb2_grpc.add_UserServiceServicer_to_server(UserService(), server)
    server.add_insecure_port('[::]:50051')
    server.start()
    print('gRPC server listening on :50051')
    server.wait_for_termination()
```

### 2.2 客户端实现

```python
import grpc
from generated import user_pb2, user_pb2_grpc

def get_user():
    channel = grpc.insecure_channel('localhost:50051')
    stub = user_pb2_grpc.UserServiceStub(channel)
    try:
        # 同步阻塞调用
        resp = stub.GetUser(user_pb2.GetUserRequest(id=1), timeout=5)
        print(f'name={resp.name}, email={resp.email}')
    except grpc.RpcError as e:
        print(f'code={e.code().name}, detail={e.details()}')

# 异步客户端（AsyncIO）
async def get_user_async():
    channel = grpc.aio.insecure_channel('localhost:50051')
    stub = user_pb2_grpc.UserServiceStub(channel)
    resp = await stub.GetUser(user_pb2.GetUserRequest(id=1))
    print(resp)
    await channel.close()
```

### 2.3 四种通信模式

| 模式 | 描述 | 适用场景 |
|------|------|----------|
| **Unary** | 一次请求一次响应 | 普通 CRUD、查询 |
| **Server streaming** | 一次请求，流式响应 | 数据导出、日志订阅、分页拉取 |
| **Client streaming** | 流式请求，一次响应 | 批量上传、日志聚合 |
| **Bidirectional** | 双向流 | 聊天、实时协同编辑 |

**双向流示例（实时聊天）**

```python
class ChatService(chat_pb2_grpc.ChatServiceServicer):
    async def Chat(self, request_iterator, context):
        # 打印收到的每条消息，并回一条 ack
        async for msg in request_iterator:
            print(f'received: {msg.text}')
            yield chat_pb2.ChatMessage(text=f'ack: {msg.text}')
```

***

## 三、拦截器与认证

### 3.1 服务端拦截器

gRPC 拦截器在 RPC 前后执行通用逻辑（日志、鉴权、限流）。

```python
import grpc

class AuthInterceptor(grpc.ServerInterceptor):
    """在服务方法前校验 Token"""

    def __init__(self):
        self._deny = grpc.unary_unary_rpc_method_handler(
            lambda req, ctx: (ctx.abort(grpc.StatusCode.UNAUTHENTICATED, 'invalid token')),
            request_deserializer=None,
            response_serializer=None,
        )

    def intercept_service(self, continuation, handler_call_details):
        # 白名单方法跳过鉴权
        if handler_call_details.method == '/user.v1.UserService/Login':
            return continuation(handler_call_details)

        metadata = dict(handler_call_details.invocation_metadata)
        token = metadata.get('authorization', '')
        if not is_valid(token):
            return self._deny  # 直接拒绝，不进入业务逻辑
        return continuation(handler_call_details)

server = grpc.server(
    futures.ThreadPoolExecutor(max_workers=10),
    interceptors=[AuthInterceptor()],
)
```

### 3.2 客户端传递元数据

```python
import grpc

def call_with_token():
    channel = grpc.insecure_channel('localhost:50051')
    stub = user_pb2_grpc.UserServiceStub(channel)

    # 通过 metadata 携带 Token（类似 HTTP Header）
    md = (('authorization', 'Bearer xxx.yyy.zzz'), ('x-request-id', 'req-123'))
    resp = stub.GetUser(
        user_pb2.GetUserRequest(id=1),
        metadata=md,       # 每次调用传递
    )
```

### 3.3 超时与重试

**客户端超时**

```python
try:
    resp = stub.GetUser(req, timeout=3)   # 超过 3 秒抛出 DeadlineExceeded
except grpc.RpcError as e:
    if e.code() == grpc.StatusCode.DEADLINE_EXCEEDED:
        print('调用超时，可做降级处理')
```

**服务端设置最大接收消息大小与连接超时**

```python
server = grpc.server(
    futures.ThreadPoolExecutor(max_workers=10),
    options=[
        ('grpc.max_send_message_length', 100 * 1024 * 1024),      # 最大发送 100MB
        ('grpc.max_receive_message_length', 100 * 1024 * 1024),   # 最大接收 100MB
        ('grpc.keepalive_time_ms', 10_000),                       # 保活间隔 10s
        ('grpc.keepalive_timeout_ms', 5_000),                     # 保活超时 5s
    ],
)
```

**重试策略（客户端）**

```python
# 构建支持重试的通道
channel = grpc.insecure_channel(
    'localhost:50051',
    options=[
        ('grpc.enable_retries', 1),
        ('grpc.service_config', '{"methodConfig": [{"retryPolicy": {'
         '"maxAttempts": 3,'
         '"initialBackoff": "0.1s",'
         '"maxBackoff": "1s",'
         '"backoffMultiplier": 2,'
         '"retryableStatusCodes": ["UNAVAILABLE"]}}]}'),
    ],
)
```

***

## 四、通信模式对比与服务发现

### 4.1 gRPC vs REST vs 消息队列

| 维度 | gRPC | REST | 消息队列 |
|------|------|------|----------|
| 传输 | HTTP/2 二进制 | HTTP/1.1 JSON | TCP/自定义协议 |
| 性能 | 高 | 中 | 高（异步） |
| 契约 | 强类型（.proto） | 松散（OpenAPI） | 消息结构自定义 |
| 通信模式 | 4 种 | 请求-响应 | 异步解耦 |
| 适用场景 | 服务间调用、实时通信 | 对外 API、浏览器端 | 削峰、异步、事件驱动 |

### 4.2 服务注册与发现

gRPC 原生支持 DNS 解析，生产环境通常配合 etcd / Consul / Nacos 做服务发现。

**etcd + gRPC 选型（grpclb / 自定义 resolver）**

```python
import grpc
import grpc.experimental as grpc_exp

# 使用 etcd 注册与解析（示意：健康检查注册）
from etcd3 import client as etcd3

etcd = etcd3.client(host='localhost', port=2379)

# 服务实例注册：TTL 保活
lease = etcd.lease(10)
etcd.put('/services/user-service/192.168.1.10:50051', b'{}', lease=lease)
etcd.refresh_lease(lease.id)
```

**Consul 健康检查**

```python
import consul

c = consul.Consul(host='localhost', port=8500)
c.agent.service.register(
    'user-service',
    service_id='user-service-1',
    address='192.168.1.10',
    port=50051,
    check=consul.Check.tcp('192.168.1.10', 50051, interval='10s'),
)
```

### 4.3 常用最佳实践

| 实践 | 说明 |
|------|------|
| 版本管理 | 服务名带 major 版本：`/user.v2.UserService` |
| 错误处理 | 用标准 StatusCode + 详细 message，避免吞异常 |
| 幂等设计 | 写操作请求携带幂等键，配合服务端去重 |
| 流式限流 | 流式 RPC 注意背压，客户端控制消费速率 |
| 全链路追踪 | metadata 传递 trace\_id，接入 OpenTelemetry |
| 压测 | 使用 ghz 工具对 gRPC 接口做基准测试 |

***

## 五、实践项目

### 项目：用户中心 gRPC 微服务

**目标**：实现一个带 Token 鉴权、服务端流式的用户中心 gRPC 服务，并接入 etcd 服务发现。

**步骤**：

1. 编写 `user.proto`：定义 GetUser（Unary）、ListUsers（Server streaming）、CreateUser（Unary）
2. 用 grpc\_tools 生成 `user_pb2.py` 与 `user_pb2_grpc.py`
3. 实现服务端：SQLAlchemy 查询 + AuthInterceptor 校验 JWT Token
4. 实现客户端：metadata 携带 Token，Unary 与流式调用各写一例
5. 接入 etcd/Consul 做服务注册与发现，客户端从注册中心拿地址

**目录结构参考**：

```
user-center-grpc/
├── proto/
│   └── user.proto
├── generated/
│   ├── user_pb2.py
│   └── user_pb2_grpc.py
├── server/
│   ├── main.py               # gRPC 服务入口
│   ├── auth.py               # JWT 签发与校验
│   ├── interceptor.py        # 鉴权拦截器
│   └── repository.py         # 数据库访问
├── client/
│   ├── unary_client.py       # 一元调用示例
│   └── stream_client.py      # 流式调用示例
├── discovery/
│   └── register.py           # etcd/Consul 注册
└── requirements.txt
```
