---
url: >-
  /my_notes/notes/Python学习路线/di-er-jie-duan-web-kai-fa/5-mu-ban-yu-api-she-ji/index.md
---
# 模板与 API 设计

## 一、模板引擎

### 1.1 服务端渲染 vs 前后端分离

**模板引擎** 将动态数据填充到 HTML 中，在服务端生成完整页面返回给浏览器。

| 对比维度 | 服务端渲染（SSR） | 前后端分离 |
|---------|-----------------|-----------|
| **HTML 生成位置** | 服务端 | 浏览器（JS 渲染） |
| **SEO 友好** | ✅ 利于搜索引擎 | ⚠️ 依赖 JS 渲染 |
| **首屏速度** | 快（直接返回 HTML） | 需先加载 JS |
| **开发分离** | 前后端耦合 | 前后端独立并行 |
| **适用场景** | 内容站、后台系统 | SPA、复杂交互应用 |

### 1.2 Jinja2 基础

**Jinja2** 是 Python 最流行的模板引擎，Django 模板也与其相似。

```bash
pip install jinja2
```

**变量与过滤器**

```jinja
<!-- template.html -->
<!DOCTYPE html>
<html>
<head><title>{{ page_title }}</title></head>
<body>
    <!-- 变量：{{ }} -->
    <h1>欢迎，{{ user.name }}</h1>

    <!-- 过滤器：| 后接处理函数 -->
    <p>总价：{{ total | round(2) }} 元</p>
    <p>价格：{{ price | currency }}</p>
    <p>{{ content | truncate(100) }}</p>
</body>
</html>
```

**控制结构**

```jinja
{% if user.is_admin %}
    <a href="/admin">管理后台</a>
{% elif user %}
    <a href="/profile">个人中心</a>
{% else %}
    <a href="/login">登录</a>
{% endif %}

<ul>
{% for item in items %}
    <li>{{ loop.index }}. {{ item.name }}</li>   <!-- loop.index 循环序号 -->
{% else %}
    <li>暂无数据</li>                              <!-- for-else：空列表时 -->
{% endfor %}
</ul>
```

### 1.3 模板继承与宏

**模板继承**：定义基础布局，子模板填充内容。

```jinja
<!-- base.html 基础布局 -->
<!DOCTYPE html>
<html>
<head><title>{% block title %}默认标题{% endblock %}</title></head>
<body>
    {% block content %}{% endblock %}
</body>
</html>
```

```jinja
<!-- page.html 子模板 -->
{% extends "base.html" %}

{% block title %}文章列表{% endblock %}

{% block content %}
    <h1>这里是文章</h1>
{% endblock %}
```

**宏（Macro）**：可复用的模板片段。

```jinja
{% macro render_button(text, style="primary") %}
    <button class="btn btn-{{ style }}">{{ text }}</button>
{% endmacro %}

{{ render_button("保存", "success") }}
{{ render_button("删除", "danger") }}
```

**常用过滤器**

| 过滤器 | 作用 |
|--------|------|
| `{{ s \| upper/lower }}` | 大小写转换 |
| `{{ s \| truncate(n) }}` | 截断字符串 |
| `{{ d \| default("暂无") }}` | 默认值 |
| `{{ l \| length }}` | 长度 |
| `{{ n \| round(2) }}` | 四舍五入 |
| `{{ l \| join(",") }}` | 列表拼接 |
| `{{ x \| safe }}` | 标记为安全 HTML（谨慎！防 XSS） |

***

## 二、Jinja2 与 FastAPI 集成

### 2.1 FastAPI + Jinja2 模板

```python
from fastapi import FastAPI, Request
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse

app = FastAPI()
templates = Jinja2Templates(directory="templates")   # 模板目录

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    # 传 request 是 Jinja2Templates 的要求
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"page_title": "首页", "items": ["苹果", "香蕉", "橙子"]},
    )
```

**注意**：FastAPI 新版 `TemplateResponse` 需传入 `request` 关键字参数（旧版为位置参数）。

### 2.2 自定义过滤器

```python
from fastapi.templating import Jinja2Templates
from datetime import datetime

templates = Jinja2Templates(directory="templates")

# 注册自定义过滤器：把秒数格式化为 "2小时3分"
def format_duration(seconds: int) -> str:
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h}小时{m}分{s}秒" if h else f"{m}分{s}秒"

templates.env.filters["duration"] = format_duration
```

```jinja
<!-- 模板中使用：{{ video.duration | duration }} -->
<p>视频时长：{{ 7500 | duration }}</p>  <!-- 输出：2小时5分0秒 -->
```

***

## 三、RESTful API 设计规范

### 3.1 资源命名与 HTTP 方法

**REST（Representational State Transfer）** 以资源为中心，用 HTTP 方法表达操作。

**资源命名**

| 规范 | 示例 |
|------|------|
| 使用名词复数 | `/users`、`/orders` |
| 不使用动词 | ✅ `/orders`，❌ `/getOrders` |
| 小写 + 连字符 | `/user-profiles` |
| 层级关系 | `/users/1/orders`（用户 1 的订单） |

**方法与语义**

| 方法 | 路径 | 语义 | 幂等 |
|------|------|------|:----:|
| `GET` | `/users` | 获取列表 | ✅ |
| `POST` | `/users` | 创建 | ❌ |
| `GET` | `/users/1` | 获取单个 | ✅ |
| `PUT` | `/users/1` | 整体更新 | ✅ |
| `PATCH` | `/users/1` | 部分更新 | ❌ |
| `DELETE` | `/users/1` | 删除 | ✅ |

### 3.2 状态码使用

| 场景 | 状态码 |
|------|--------|
| 查询成功 | `200` |
| 创建成功 | `201`（返回新资源） |
| 删除成功 | `204`（无内容） |
| 参数错误 | `400` |
| 未认证 | `401` |
| 无权限 | `403` |
| 资源不存在 | `404` |
| 冲突（重复创建） | `409` |
| 校验失败 | `422`（FastAPI 默认） |
| 服务器错误 | `500` |

### 3.3 API 版本控制

| 方案 | 示例 | 优劣 |
|------|------|------|
| **URL 版本** | `/v1/users` | 直观，最常用 |
| **Header 版本** | `Accept: application/vnd.api+json;version=1` | 不污染 URL |
| **查询参数版本** | `/users?version=1` | 简单但易被缓存污染 |

***

## 四、统一响应与分页

### 4.1 统一响应结构

**统一响应体** 让前端解析逻辑一致，前端只需处理固定的结构。

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class ApiResponse(BaseModel):
    code: int = 0          # 业务码（0 成功，非 0 失败）
    message: str = "ok"
    data: dict | list | None = None

@app.get("/users")
def list_users():
    return ApiResponse(data=[{"id": 1, "name": "张三"}])
```

**统一响应 vs 裸响应**

```text
统一响应：{ "code": 0, "message": "ok", "data": [...] }
裸响应：  [ { "id": 1, "name": "张三" } ]
```

前端判断 `code === 0` 即可，业务错误（如"余额不足"）用非 0 的 `code` 表达，HTTP 状态码仍用 200。

### 4.2 分页 / 过滤 / 排序

**分页**是列表接口的标配，防止一次返回海量数据。

```python
from fastapi import FastAPI, Query

app = FastAPI()

# 假设数据源
ALL_USERS = [{"id": i, "name": f"用户{i}"} for i in range(1, 101)]

@app.get("/users")
def list_users(
    page: int = Query(default=1, ge=1),        # 页码
    page_size: int = Query(default=10, ge=1, le=100),  # 每页数量
    name: str | None = None,                   # 过滤：按名称模糊搜索
    sort: str = Query(default="id", pattern="^(id|name)$"),  # 排序字段白名单
):
    # 过滤
    items = [u for u in ALL_USERS if not name or name in u["name"]]
    # 排序（白名单防止注入）
    items.sort(key=lambda u: u[sort])
    # 分页
    start = (page - 1) * page_size
    data = items[start : start + page_size]
    return {
        "data": data,
        "page": page,
        "page_size": page_size,
        "total": len(items),
    }
```

**# ❌ 直接拼接排序字段存在注入风险**

```python
@app.get("/users")
def bad_sort(sort: str = "id"):
    items.sort(key=lambda u: u[sort])  # ❌ 若 sort 来自外部且未校验，可能 keyerror 或越权
    # ✅ 应使用枚举/白名单校验 sort 取值
```

### 4.3 错误码约定

| 层级 | 说明 | 示例 |
|------|------|------|
| HTTP 状态码 | 传输层状态 | 404 Not Found |
| 业务码（code） | 业务层状态 | 1001 余额不足、1002 库存不足 |
| 详细消息 | 可读信息 | "库存不足，仅剩 3 件" |

建议维护一个错误码文档，前端按 `code` 做国际化或跳转。

***

## 五、鉴权概览

### 5.1 API 鉴权方式对比

| 方式 | 原理 | 适用场景 |
|------|------|---------|
| **API Key** | 请求头携带固定密钥 | 服务间调用、第三方开放平台 |
| **Bearer Token** | `Authorization: Bearer <token>` | 用户登录态 |
| **JWT** | 自包含签名的 Token | 无状态认证 |
| **OAuth2** | 授权码换取令牌 | 第三方登录（微信/Google） |
| **签名鉴权** | 时间戳 + 签名 | 开放 API 防篡改 |

**API Key 示例**

```python
from fastapi import FastAPI, Header, HTTPException

API_KEYS = {"key-abc-123": "service-a"}

app = FastAPI()

def verify_api_key(x_api_key: str = Header(default=None)):
    if x_api_key not in API_KEYS:
        raise HTTPException(status_code=401, detail="API Key 无效")
    return API_KEYS[x_api_key]

@app.get("/protected")
def protected(client: str = Depends(verify_api_key)):
    return {"message": f"来自 {client} 的请求"}
```

### 5.2 CORS 与 CSRF

* **CORS**：浏览器跨域安全策略，前后端分离需在服务端配置允许的域名（见 2.2 模块）。
* **CSRF**：跨站请求伪造，服务端渲染的 Cookie 会话需防护（Django 内置），Token 认证模式下天然免疫。

***

## 六、接口测试

### 6.1 Postman / HTTPie

**Postman**：图形化接口调试工具，支持集合、环境变量、自动化测试。

**HTTPie**：命令行接口测试工具，比 curl 更易读。

```bash
# 安装
pip install httpie

# GET 请求
http GET http://127.0.0.1:8000/users

# POST JSON
http POST http://127.0.0.1:8000/users name="张三" age:=20

# 带请求头
http GET http://127.0.0.1:8000/protected X-Api-Key:key-abc-123
```

### 6.2 OpenAPI 与 SDK 生成

**OpenAPI** 描述接口契约，FastAPI 自动生成 `/openapi.json`，可用于：

| 用途 | 工具 |
|------|------|
| 前端类型生成 | `openapi-typescript` |
| Python 客户端 | `openapi-generator` |
| 接口文档平台 | Swagger Hub、Apifox |
| 契约测试 | schemathesis |

***

## 七、实践项目

### 项目 1：完善 Todo API 的分页、统一响应与文档

**目标**：为 2.2 模块的 Todo API 增加统一响应结构、分页和完整的接口文档。

**步骤**：

1. 定义 `ApiResponse` 统一响应模型（code/message/data）
2. 所有接口返回统一响应结构，业务错误用非 0 的 `code`
3. 列表接口增加 `page`、`page_size`、`status` 过滤
4. 为每个接口补充 `summary`、`description`、`tags`
5. 用 `response_model=ApiResponse` 声明响应类型，让 Swagger 文档完整
6. 启动后用 HTTPie 或 Postman 验证各场景

**目录结构参考**：

```
todo-api-v3/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── schemas.py         # ApiResponse、Todo 模型
│   └── deps.py
├── tests/
├── requirements.txt
└── README.md
```

### 项目 2：Jinja2 渲染文章列表页

**目标**：用 FastAPI + Jinja2 渲染一个服务端渲染的文章列表页。

**步骤**：

1. 创建 `templates/base.html` 基础布局（含导航栏、footer）
2. 创建 `templates/list.html` 继承 base，用 `for` 循环渲染文章
3. 自定义过滤器 `format_time` 格式化发布时间
4. 路由返回渲染后的 HTML，浏览器验证 SEO 友好的页面
