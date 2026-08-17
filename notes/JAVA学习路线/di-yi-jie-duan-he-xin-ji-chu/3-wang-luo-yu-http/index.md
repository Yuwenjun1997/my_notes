---
url: >-
  /my_notes/notes/JAVA学习路线/di-yi-jie-duan-he-xin-ji-chu/3-wang-luo-yu-http/index.md
---
# 网络与 HTTP

## 一、HTTP/1.1 详解

### 1.1 HTTP 请求方法

HTTP 定义了多种请求方法，每种方法表示对资源的不同操作。

| 方法 | 含义 | 幂等 | 安全 | 请求体 | 响应缓存 |
|------|------|:---:|:---:|:-----:|:-------:|
| GET | 获取资源 | ✅ | ✅ | ❌ | ✅ |
| POST | 创建资源 | ❌ | ❌ | ✅ | ❌ |
| PUT | 全量更新资源 | ✅ | ❌ | ✅ | ❌ |
| PATCH | 部分更新资源 | ❌ | ❌ | ✅ | ❌ |
| DELETE | 删除资源 | ✅ | ❌ | ❌ | ❌ |
| HEAD | 获取响应头（无响应体） | ✅ | ✅ | ❌ | ✅ |
| OPTIONS | 查询支持的 HTTP 方法 | ✅ | ✅ | ❌ | ❌ |

**GET vs POST**

```http
// GET：参数在 URL 中，有长度限制（通常 2048 字符）
GET /api/users?page=1&size=20 HTTP/1.1
Host: example.com

// POST：参数在请求体中，无长度限制
POST /api/users HTTP/1.1
Host: example.com
Content-Type: application/json

{"name": "张三", "age": 25}
```

**幂等性详解**

* **幂等**：多次执行相同请求，结果相同
* PUT 幂等：`PUT /users/1` 多次执行，最终 id=1 的用户数据一致
* POST 非幂等：每次 `POST /users` 都会创建一个新用户
* DELETE 幂等：`DELETE /users/1` 第一次删除 200，第二次删除 404，资源状态相同

### 1.2 HTTP 请求头与响应头

**常见请求头（Request Headers）**

| 请求头 | 示例 | 说明 |
|--------|------|------|
| `Host` | `Host: example.com` | 目标主机和端口（必选） |
| `User-Agent` | `User-Agent: Mozilla/5.0` | 客户端信息 |
| `Accept` | `Accept: application/json` | 客户端能接收的响应类型 |
| `Accept-Encoding` | `Accept-Encoding: gzip, deflate` | 支持的压缩算法 |
| `Accept-Language` | `Accept-Language: zh-CN,en;q=0.9` | 支持的语言 |
| `Authorization` | `Authorization: Bearer <token>` | 认证凭证 |
| `Content-Type` | `Content-Type: application/json` | 请求体的 MIME 类型 |
| `Content-Length` | `Content-Length: 348` | 请求体字节长度 |
| `Cookie` | `Cookie: sessionId=abc123` | 发送 Cookie |
| `Referer` | `Referer: https://example.com/page1` | 当前请求的来源页面 |
| `Origin` | `Origin: https://example.com` | 跨域请求的来源 |
| `Cache-Control` | `Cache-Control: no-cache` | 缓存策略 |

**常见响应头（Response Headers）**

| 响应头 | 示例 | 说明 |
|--------|------|------|
| `Content-Type` | `Content-Type: application/json;charset=utf-8` | 响应体的 MIME 类型 |
| `Content-Length` | `Content-Length: 1024` | 响应体字节长度 |
| `Set-Cookie` | `Set-Cookie: sessionId=abc123; HttpOnly` | 设置 Cookie |
| `Cache-Control` | `Cache-Control: max-age=3600` | 缓存指令 |
| `Location` | `Location: /new-page` | 重定向地址（3xx 响应） |
| `WWW-Authenticate` | `WWW-Authenticate: Bearer realm="api"` | 认证挑战（401 响应） |
| `Access-Control-Allow-Origin` | `Access-Control-Allow-Origin: *` | CORS 允许的来源 |
| `X-Request-Id` | `X-Request-Id: uuid` | 请求追踪 ID |

**Content-Type 常见值**

| MIME 类型 | 说明 |
|-----------|------|
| `text/html` | HTML 文档 |
| `text/plain` | 纯文本 |
| `application/json` | JSON 数据 |
| `application/xml` | XML 数据 |
| `application/x-www-form-urlencoded` | 表单提交（默认编码） |
| `multipart/form-data` | 文件上传（需指定 boundary） |
| `application/octet-stream` | 二进制流 |

### 1.3 HTTP 状态码

**1xx 信息响应**

| 状态码 | 说明 | 场景 |
|-------|------|------|
| 100 Continue | 客户端应继续发送请求体 | 大文件上传前确认 |
| 101 Switching Protocols | 切换协议 | WebSocket 升级 |

**2xx 成功响应**

| 状态码 | 说明 | 场景 |
|-------|------|------|
| 200 OK | 请求成功 | GET 查询成功、PUT 更新成功 |
| 201 Created | 资源创建成功 | POST 创建成功（响应应包含 Location 头指向新资源） |
| 204 No Content | 请求成功，无响应体 | DELETE 删除成功 |

**3xx 重定向**

| 状态码 | 说明 | 场景 |
|-------|------|------|
| 301 Moved Permanently | 永久重定向 | 域名变更，搜索引擎更新链接 |
| 302 Found | 临时重定向 | 登录后跳转，URL 重写 |
| 304 Not Modified | 资源未修改 | 条件请求，使用缓存（配合 ETag/Last-Modified） |

```http
// 301 永久重定向
HTTP/1.1 301 Moved Permanently
Location: https://new-domain.com/page

// 304 使用缓存
HTTP/1.1 304 Not Modified
ETag: "abc123"
// 客户端继续使用本地缓存
```

**4xx 客户端错误**

| 状态码 | 说明 | 常见原因 |
|-------|------|---------|
| 400 Bad Request | 请求格式错误 | 参数校验失败、JSON 格式错误 |
| 401 Unauthorized | 未认证 | 缺少或无效的 Token |
| 403 Forbidden | 无权限 | 已认证但无访问权限 |
| 404 Not Found | 资源不存在 | URL 错误、资源已删除 |
| 405 Method Not Allowed | 请求方法不支持 | API 只允许 GET，用了 POST |
| 408 Request Timeout | 请求超时 | 请求耗时超过服务端限制 |
| 409 Conflict | 资源冲突 | 并发修改、重复创建 |
| 415 Unsupported Media Type | 不支持的媒体类型 | Content-Type 不对 |
| 429 Too Many Requests | 请求频率超限 | 触发限流 |

**5xx 服务器错误**

| 状态码 | 说明 | 常见原因 |
|-------|------|---------|
| 500 Internal Server Error | 服务器内部错误 | 未捕获异常、空指针 |
| 502 Bad Gateway | 网关错误 | 上游服务不可用 |
| 503 Service Unavailable | 服务暂时不可用 | 过载、维护中 |
| 504 Gateway Timeout | 网关超时 | 上游服务超时未响应 |

### 1.4 HTTP 报文格式

**请求报文**

```
<method> <path> <version>
<headers>

<body>
```

示例：

```http
POST /api/users HTTP/1.1
Host: example.com
Content-Type: application/json
Authorization: Bearer eyJhbGci...
Content-Length: 45

{"name": "张三", "email": "zhangsan@example.com"}
```

**响应报文**

```
<version> <status-code> <reason-phrase>
<headers>

<body>
```

示例：

```http
HTTP/1.1 201 Created
Content-Type: application/json
Location: /api/users/123
Content-Length: 80

{"id": 123, "name": "张三", "email": "zhangsan@example.com", "createdAt": "2024-01-15T10:30:00Z"}
```

### 1.5 HTTP 缓存机制

**强缓存**

```
浏览器第一次请求 → 服务器返回资源 + Cache-Control
↓
浏览器再次请求 → 检查 Cache-Control：
  max-age 未过期 → 直接使用本地缓存（不请求服务器，状态码 200 from disk cache）
  max-age 已过期 → 进入协商缓存
```

```http
// 服务器响应
HTTP/1.1 200 OK
Cache-Control: max-age=3600   // 缓存 1 小时
// 或
Expires: Mon, 15 Jan 2024 12:00:00 GMT  // HTTP/1.0，优先级低于 Cache-Control
```

**协商缓存**

```
浏览器请求（带缓存标识） → 服务器验证：
  资源未修改 → 304 Not Modified（浏览器使用缓存）
  资源已修改 → 200 + 新资源
```

```http
// 方式一：基于时间
// 请求：
If-Modified-Since: Mon, 15 Jan 2024 10:00:00 GMT
If-Unmodified-Since: Mon, 15 Jan 2024 10:00:00 GMT

// 响应：
Last-Modified: Mon, 15 Jan 2024 10:00:00 GMT

// 方式二：基于 ETag（优先级高于 Last-Modified）
// 请求：
If-None-Match: "abc123"
If-Match: "abc123"

// 响应：
ETag: "abc123"
```

***

## 二、RESTful API 设计

### 2.1 设计原则

**核心原则**

1. 使用名词而非动词表示资源
2. 使用 HTTP 方法表示操作
3. 资源路径体现层级关系
4. 使用复数形式表示资源集合
5. 使用查询参数进行过滤和分页

### 2.2 资源路径设计

| 操作 | HTTP 方法 | 路径 | 说明 |
|------|----------|------|------|
| 获取所有用户 | GET | `/api/users` | 查询列表 |
| 获取单个用户 | GET | `/api/users/{id}` | 查询详情 |
| 创建用户 | POST | `/api/users` | 新增 |
| 全量更新用户 | PUT | `/api/users/{id}` | 替换 |
| 部分更新用户 | PATCH | `/api/users/{id}` | 更新部分字段 |
| 删除用户 | DELETE | `/api/users/{id}` | 删除 |

**资源关系路径**

```text
/users/{userId}/orders           # 用户的所有订单
/users/{userId}/orders/{orderId} # 用户的某个订单
/orders/{orderId}/items          # 订单的商品明细
/categories/{catId}/products     # 分类下的商品
```

**查询参数设计**

```text
GET /api/users?page=1&size=20&sort=createdAt,desc  # 分页排序
GET /api/users?name=张三                             # 按名筛选
GET /api/users?age=25&age=30                        # 多个值（age=25 或 age=30）
GET /api/users?createdAt=2024-01-01,2024-12-31      # 范围查询
GET /api/users?fields=id,name,email                  # 字段筛选
```

### 2.3 HTTP 方法与资源操作对应

```java
// ✅ 正确的 RESTful 设计

// 查询用户列表
@GetMapping("/api/users")
public Result<List<User>> list(@RequestParam int page, @RequestParam int size) {
    return Result.success(userService.list(page, size));
}

// 查询用户详情
@GetMapping("/api/users/{id}")
public Result<User> getById(@PathVariable Long id) {
    return Result.success(userService.getById(id));
}

// 创建用户
@PostMapping("/api/users")
public Result<User> create(@RequestBody @Valid UserCreateRequest request) {
    User user = userService.create(request);
    return Result.success(user);
}

// 更新用户（全量）
@PutMapping("/api/users/{id}")
public Result<User> update(@PathVariable Long id, @RequestBody @Valid UserUpdateRequest request) {
    return Result.success(userService.update(id, request));
}

// 删除用户
@DeleteMapping("/api/users/{id}")
public Result<Void> delete(@PathVariable Long id) {
    userService.delete(id);
    return Result.success();
}

// ❌ 不推荐的设计（RPC 风格而非 RESTful）
POST /api/getUser
POST /api/deleteUserById
GET /api/getUserList?type=all
POST /api/updateUser
```

### 2.4 统一响应结构

```json
// 成功响应
{
    "code": 200,
    "message": "success",
    "data": {
        "id": 123,
        "name": "张三",
        "email": "zhangsan@example.com"
    },
    "timestamp": 1705300000000
}

// 分页响应
{
    "code": 200,
    "message": "success",
    "data": {
        "content": [...],      // 当前页数据
        "page": 1,             // 当前页码
        "size": 20,            // 每页大小
        "totalElements": 100,  // 总记录数
        "totalPages": 5        // 总页数
    }
}

// 错误响应
{
    "code": 400,
    "message": "参数校验失败",
    "errors": [
        {"field": "email", "message": "邮箱格式不正确"},
        {"field": "age", "message": "年龄必须在 0-150 之间"}
    ],
    "path": "/api/users",
    "timestamp": 1705300000000
}
```

### 2.5 API 版本管理

```text
// 方式一：URL 路径（最常用）
/api/v1/users
/api/v2/users

// 方式二：请求头
Accept: application/vnd.example.v1+json
Accept: application/vnd.example.v2+json

// 方式三：查询参数
/api/users?version=1
/api/users?version=2
```

***

## 三、Cookie 和 Session

### 3.1 Cookie

**Cookie 的作用**

* 会话管理（登录状态、购物车）
* 个性化设置（主题、语言偏好）
* 用户行为追踪

**Cookie 属性**

| 属性 | 示例 | 说明 |
|------|------|------|
| Name=Value | `sessionId=abc123` | Cookie 名称和值 |
| Domain | `Domain=example.com` | 可接收 Cookie 的域名 |
| Path | `Path=/api` | 可接收 Cookie 的路径 |
| Max-Age | `Max-Age=3600` | 过期时间（秒），负数=会话Cookie，0=删除 |
| Secure | `Secure` | 仅 HTTPS 传输 |
| HttpOnly | `HttpOnly` | 禁止 JS 访问（防止 XSS 窃取 Cookie） |
| SameSite | `SameSite=Strict` | 防止 CSRF 攻击（Strict/Lax/None） |

```http
// 服务器设置 Cookie
HTTP/1.1 200 OK
Set-Cookie: sessionId=abc123; Domain=example.com; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Lax
Set-Cookie: theme=dark; Max-Age=31536000

// 客户端发送 Cookie
GET /api/user HTTP/1.1
Cookie: sessionId=abc123; theme=dark
```

**Cookie 生命周期**

* **会话 Cookie**：不设置 Max-Age，浏览器关闭时删除
* **持久 Cookie**：设置 Max-Age，到期后删除

### 3.2 Session

**Session 存储方式**

| 存储方式 | 优点 | 缺点 |
|---------|------|------|
| 内存（默认） | 简单快速 | 重启丢失，无法分布式 |
| Redis | 分布式、持久化、快速 | 需要额外部署 Redis |
| 数据库 | 持久化 | 速度慢 |
| 文件 | 简单 | 不适合分布式 |

**Session 工作原理**

```text
1. 用户登录成功
2. 服务器创建 Session（生成唯一 sessionId）
3. 服务器将 sessionId 通过 Set-Cookie 发给浏览器
4. 浏览器后续请求自动携带 Cookie（sessionId）
5. 服务器根据 sessionId 获取 Session 数据
```

```java
// Spring Boot Session 使用示例
@RestController
public class SessionController {

    @PostMapping("/login")
    public Result<String> login(@RequestBody LoginRequest request,
                                 HttpSession session) {
        // 验证用户名密码
        User user = authenticate(request.getUsername(), request.getPassword());
        if (user != null) {
            // 将用户信息存入 Session
            session.setAttribute("user", user);
            session.setAttribute("loginTime", System.currentTimeMillis());

            return Result.success("登录成功");
        }
        return Result.error("用户名或密码错误");
    }

    @GetMapping("/profile")
    public Result<User> profile(HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) {
            return Result.error(401, "未登录");
        }
        return Result.success(user);
    }

    @PostMapping("/logout")
    public Result<String> logout(HttpSession session) {
        session.invalidate();  // 销毁 Session
        return Result.success("已退出");
    }
}
```

### 3.3 Cookie vs Session vs Token

| 特性 | Cookie | Session | JWT Token |
|------|--------|---------|-----------|
| **存储位置** | 客户端 | 服务端/Redis | 客户端 |
| **是否可跨域** | 受限（需配置 CORS） | 受限 | 支持所有域 |
| **扩展性** | 差 | 需集中存储 | 好（无状态） |
| **安全性** | 易被 XSS/CSRF 攻击 | 相对安全 | Token 泄露风险 |
| **性能** | 无服务端开销 | 需查 Session 存储 | 无需存储，验签即用 |
| **移动端支持** | 差 | 差 | 好 |
| **实时撤销** | - | 支持 | 不直接支持 |

***

## 四、语义化 URL

### URL 设计原则

**1. 使用名词而非动词**

```text
❌ /api/getUser?id=1
✅ /api/users/1
```

**2. 使用复数形式**

```text
❌ /api/user/1/order
✅ /api/users/1/orders
```

**3. 使用连字符分隔单词（而非下划线或驼峰）**

```text
❌ /api/userProfile
❌ /api/user_profile
✅ /api/user-profiles
```

**4. 使用小写字母**

```text
❌ /api/Users/1
✅ /api/users/1
```

**5. 避免文件扩展名**

```text
❌ /api/users.json
✅ /api/users（通过 Accept 头指定格式）
```

**6. 使用查询参数进行过滤而非扩展路径**

```text
❌ /api/users/status/active
✅ /api/users?status=active
```

**7. 层级关系使用斜杠**

```text
✅ /api/users/1/orders/2/items
✅ /api/categories/electronics/products/123
```

***

## 五、实践项目

### 项目 1：设计 RESTful API 并使用 Postman 测试

**目标**：设计一个博客系统的 RESTful API，并使用 Postman 进行测试。

**API 设计**：

```text
GET    /api/posts              # 获取文章列表
GET    /api/posts/{id}         # 获取文章详情
POST   /api/posts              # 创建文章
PUT    /api/posts/{id}         # 更新文章
DELETE /api/posts/{id}         # 删除文章
GET    /api/posts/{id}/comments   # 获取文章评论
POST   /api/posts/{id}/comments   # 添加评论
GET    /api/categories         # 获取分类列表
GET    /api/categories/{id}/posts # 获取分类下的文章
```

### 项目 2：基于 HTTP 协议的简单 Web 服务

**目标**：用 Java 实现一个简单的 HTTP 服务器（基于 Java 内置的 HttpServer），了解 HTTP 协议底层处理。

**核心代码**：

```java
import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;

import java.io.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

public class SimpleHttpServer {

    public static void main(String[] args) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(8080), 0);

        // 注册路由
        server.createContext("/api/hello", new HelloHandler());
        server.createContext("/api/users", new UsersHandler());

        server.setExecutor(null);  // 使用默认线程池
        System.out.println("服务器启动于 http://localhost:8080");
        server.start();
    }

    static class HelloHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String method = exchange.getRequestMethod();
            String response;

            if ("GET".equals(method)) {
                response = "{\"message\": \"Hello, World!\"}";
                sendJsonResponse(exchange, 200, response);
            } else {
                response = "{\"error\": \"Method not allowed\"}";
                sendJsonResponse(exchange, 405, response);
            }
        }
    }

    static class UsersHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String method = exchange.getRequestMethod();
            String path = exchange.getRequestURI().getPath();

            // 解析请求头
            Headers headers = exchange.getRequestHeaders();
            String contentType = headers.getFirst("Content-Type");

            switch (method) {
                case "GET" -> {
                    // 读取查询参数
                    String query = exchange.getRequestURI().getQuery();
                    String response = "{\"users\": []}";
                    sendJsonResponse(exchange, 200, response);
                }
                case "POST" -> {
                    // 读取请求体
                    InputStream is = exchange.getRequestBody();
                    String body = new String(is.readAllBytes(), StandardCharsets.UTF_8);
                    System.out.println("收到 POST 请求体: " + body);

                    // 设置响应头
                    exchange.getResponseHeaders().add("Location", "/api/users/1");
                    sendJsonResponse(exchange, 201, "{\"id\": 1}");
                }
                case "OPTIONS" -> {
                    // 处理 CORS 预检请求
                    exchange.getResponseHeaders().add("Allow", "GET, POST, OPTIONS");
                    sendJsonResponse(exchange, 204, "");
                }
                default -> sendJsonResponse(exchange, 405, "{\"error\": \"Method not allowed\"}");
            }
        }
    }

    private static void sendJsonResponse(HttpExchange exchange, int statusCode, String body)
            throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(statusCode, bytes.length);
        OutputStream os = exchange.getResponseBody();
        os.write(bytes);
        os.close();
    }
}
```
