---
url: >-
  /my_notes/notes/Python学习路线/shen-du-xue-xi/02-data-scraping/1-pa-chong-kuang-jia-jin-jie/index.md
---
# Scrapy 爬虫框架进阶

## 一、Scrapy 架构详解

### 2.1 Scrapy 核心架构

Scrapy 是一个用 Python 编写的高性能爬虫框架，基于**异步非阻塞网络库 Twisted** 实现。它的核心组件共同构成一个完整的数据流管道。

**五大核心组件**

| 组件 | 作用 |
|:-----|:-----|
| **Engine（引擎）** | 框架中枢，控制所有组件之间的数据流，触发事件 |
| **Scheduler（调度器）** | 接收 Engine 发来的请求，入队并按优先级调度 |
| **Downloader（下载器）** | 执行网络请求，将响应交给 Engine |
| **Spider（爬虫）** | 解析响应，生成新的请求或提取 Item 数据 |
| **Item Pipeline（管道）** | 处理 Spider 提取的数据（清洗、去重、入库） |

**中间件（Middleware）**

| 中间件 | 作用 |
|:-----|:-----|
| **Downloader Middleware** | 在 Downloader 与 Engine 之间拦截请求/响应，常用于代理、User-Agent、重试 |
| **Spider Middleware** | 在 Spider 与 Engine 之间拦截，常用于处理异常、深度控制 |

**安装与创建项目**

```bash
# 安装 Scrapy
pip install scrapy

# 创建项目
scrapy startproject book_spider

# 目录结构
# book_spider/
# ├── scrapy.cfg                  # 项目配置
# └── book_spider/
#     ├── __init__.py
#     ├── items.py                # Item 定义
#     ├── middlewares.py          # 中间件
#     ├── pipelines.py            # 管道
#     ├── settings.py             # 全局配置
#     ├── spiders/                # 爬虫目录
#     └── __init__.py
```

**Request 与 Response**

```python
from scrapy import Request

# 构建请求：指定 URL、回调函数、元数据
req = Request(
    url="https://books.toscrape.com/",
    callback=self.parse,          # 响应回来后调用的解析函数
    meta={"page": 1},             # 传递自定义数据
    headers={"User-Agent": "Mozilla/5.0"},
    dont_filter=True,             # 忽略去重（默认已请求过的 URL 不再请求）
)

# 响应对象常用属性
# response.url       实际响应的 URL
# response.status    HTTP 状态码
# response.headers   响应头
# response.text      文本内容
# response.body      字节内容
# response.xpath()   按 XPath 解析
# response.css()     按 CSS 选择器解析
```

### 2.2 数据流与请求生命周期

一个完整的请求在 Scrapy 中经历以下流程：

```text
Spider 生成 Request
        │
        ▼
Scheduler（入队 + 去重）──→ Downloader（经 Downloader Middleware）
        │                              │
        │                       发送 HTTP 请求
        │                              ▼
        │                      Response 返回（经 Downloader Middleware）
        ▼                              │
Engine 回调 Spider.parse 函数          │
        │                              │
        ├── 生成新 Request → 回到 Scheduler
        └── 提取 Item → 交给 Item Pipeline
```

**关键点**：

1. **调度顺序**：Request 进入 Scheduler 队列，Downloader 空闲时由 Engine 取出
2. **去重机制**：默认使用 `RFPDupeFilter`，基于请求的 URL + 方法 + 体做指纹去重
3. **回调驱动**：每个请求都绑定一个回调函数，响应到达后由 Engine 触发
4. **异步并发**：Downloader 可同时发出多个请求，默认并发数为 16

***

## 二、Spider 开发实战

### 2.3 基础 Spider

一个最简单的 Spider 继承 `scrapy.Spider`，只需定义 `name`、`start_urls` 和 `parse`：

```python
import scrapy


class BookSpider(scrapy.Spider):
    # 爬虫名称，启动命令 scrapy crawl book 时使用
    name = "book"

    # 起始 URL 列表，框架会自动为每个 URL 创建 Request
    start_urls = ["https://books.toscrape.com/"]

    def parse(self, response):
        # 提取所有图书条目
        books = response.css("article.product_pod")
        for book in books:
            yield {
                "title": book.css("h3 a::attr(title)").get(),
                "price": book.css(".price_color::text").get(),
                "url": book.css("h3 a::attr(href)").get(),
            }

        # 处理分页：找到"下一页"链接继续爬取
        next_page = response.css("li.next a::attr(href)").get()
        if next_page:
            # 相对 URL 需要拼接为完整 URL
            yield response.follow(next_page, callback=self.parse)
```

**命令行运行**

```bash
# 运行爬虫（把输出保存为 JSON）
scrapy crawl book -O books.json

# 用 parse 参数查看单页解析结果，便于调试
scrapy crawl book -a parse

# 检查请求头等信息
scrapy shell https://books.toscrape.com/
```

### 2.4 CrawlSpider 与规则爬取

`CrawlSpider` 适合**整站按规则遍历**，通过 `LinkExtractor` 自动发现链接，无需手动 `yield Request`：

```python
import scrapy
from scrapy.linkextractors import LinkExtractor
from scrapy.spiders import CrawlSpider, Rule


class NewsSpider(CrawlSpider):
    name = "news"
    allowed_domains = ["example.com"]          # 只爬取该域名，防止爬出站
    start_urls = ["https://example.com/news"]

    rules = (
        # 规则一：匹配列表页 URL，解析后继续跟进
        Rule(
            LinkExtractor(allow=r"/news/page/\d+"),
            callback="parse_list",              # 列表页解析
            follow=True,                        # 是否继续跟进该页面上的链接
        ),
        # 规则二：匹配详情页 URL，解析详情
        Rule(
            LinkExtractor(allow=r"/news/\d+\.html"),
            callback="parse_detail",
        ),
    )

    def parse_list(self, response):
        # 列表页的解析逻辑
        pass

    def parse_detail(self, response):
        yield {
            "title": response.css("h1::text").get(),
            "content": "".join(response.css(".content p::text").getall()),
        }
```

**LinkExtractor 常用参数**

| 参数 | 说明 |
|:-----|:-----|
| `allow` | 正则，匹配的链接才提取 |
| `deny` | 正则，排除匹配的链接 |
| `restrict_xpaths` | 只在指定 XPath 区域内找链接 |
| `allowed_domains` | 只提取这些域名的链接 |

### 2.5 Item 与字段定义

用 Item 声明结构化字段，配合 `scrapy.Field()` 做类型约束与字段名统一：

```python
# items.py
import scrapy


class BookItem(scrapy.Item):
    # 定义字段：这些字段会被 Pipeline 识别
    title = scrapy.Field()          # 书名
    price = scrapy.Field()          # 价格
    rating = scrapy.Field()         # 评分
    stock = scrapy.Field()          # 库存
    url = scrapy.Field()            # 详情页链接
```

在 Spider 中使用 Item 并补全字段：

```python
import scrapy
from book_spider.items import BookItem


class BookSpider(scrapy.Spider):
    name = "book"
    start_urls = ["https://books.toscrape.com/"]

    def parse(self, response):
        for book in response.css("article.product_pod"):
            item = BookItem()
            item["title"] = book.css("h3 a::attr(title)").get()
            item["price"] = book.css(".price_color::text").get()
            item["rating"] = book.css("p::attr(class)").get().split()[-1]
            item["url"] = response.urljoin(book.css("h3 a::attr(href)").get())
            yield item

        # 进入详情页补充库存信息
        for book in response.css("article.product_pod"):
            detail_url = response.urljoin(book.css("h3 a::attr(href)").get())
            # 用 meta 传递已解析的字段
            yield scrapy.Request(detail_url, callback=self.parse_detail, meta={"book": item})
```

***

## 三、Pipeline 与 Middleware

### 2.6 Item Pipeline 数据处理与去重

Pipeline 按 `settings.py` 中声明的顺序依次处理每个 Item，常用于**清洗、去重、入库**。

```python
# pipelines.py
import json
import hashlib
import sqlite3


class CleanPipeline:
    """清洗管道：处理价格、空值"""

    def process_item(self, item, spider):
        # 清洗价格："£10.99" → 10.99
        if item.get("price"):
            item["price"] = float(item["price"].replace("£", ""))
        # 空值处理
        item.setdefault("rating", "N/A")
        return item


class DuplicatePipeline:
    """去重管道：用标题 MD5 判断是否已爬过"""

    def __init__(self):
        self.seen = set()

    def process_item(self, item, spider):
        fingerprint = hashlib.md5(item["title"].encode()).hexdigest()
        if fingerprint in self.seen:
            # 丢弃重复 Item：抛出 DropItem 异常
            from scrapy.exceptions import DropItem
            raise DropItem(f"重复数据: {item['title']}")
        self.seen.add(fingerprint)
        return item


class SQLitePipeline:
    """入库管道：把 Item 写入 SQLite"""

    def open_spider(self, spider):
        # 爬虫启动时建立连接
        self.conn = sqlite3.connect("books.db")
        self.conn.execute("CREATE TABLE IF NOT EXISTS books (title TEXT, price REAL, rating TEXT)")

    def close_spider(self, spider):
        # 爬虫结束时关闭连接
        self.conn.commit()
        self.conn.close()

    def process_item(self, item, spider):
        self.conn.execute(
            "INSERT INTO books (title, price, rating) VALUES (?, ?, ?)",
            (item["title"], item["price"], item["rating"]),
        )
        return item
```

在 `settings.py` 中声明管道执行顺序（数字越小越先执行）：

```python
# settings.py
ITEM_PIPELINES = {
    "book_spider.pipelines.CleanPipeline": 300,       # 先清洗
    "book_spider.pipelines.DuplicatePipeline": 400,   # 再去重
    "book_spider.pipelines.SQLitePipeline": 500,      # 最后入库
}
```

**Pipeline 钩子方法汇总**

| 方法 | 触发时机 |
|:-----|:---------|
| `open_spider(spider)` | 爬虫启动时 |
| `process_item(item, spider)` | 每个 Item 经过时 |
| `close_spider(spider)` | 爬虫关闭时 |
| `from_crawler(cls, crawler)` | 从 Crawler 获取配置，常用于读取 settings |

### 2.7 中间件（Middleware）

**Downloader Middleware**：最常用于**随机 User-Agent** 与 **代理切换**。

```python
# middlewares.py
import random


class RandomUserAgentMiddleware:
    """随机 User-Agent 中间件"""

    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
        "Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/121.0",
    ]

    def process_request(self, request, spider):
        # 每次请求前随机换一个 UA
        request.headers["User-Agent"] = random.choice(self.user_agents)
        return None  # 返回 None 表示继续处理该请求

    def process_response(self, request, response, spider):
        # 响应处理（可记录状态码、换代理重试）
        if response.status >= 400:
            spider.logger.warning(f"异常状态码: {response.status}")
        return response

    def process_exception(self, request, exception, spider):
        # 请求异常处理（如超时重试）
        spider.logger.error(f"请求异常: {exception}")
        return None  # 返回 None 表示交给框架默认处理
```

注册中间件：

```python
# settings.py
DOWNLOADER_MIDDLEWARES = {
    "book_spider.middlewares.RandomUserAgentMiddleware": 543,
}
```

### 2.8 settings 配置调优

`settings.py` 是爬虫性能与行为的总开关：

```python
# settings.py

# ---- 并发与延迟 ----
CONCURRENT_REQUESTS = 16          # 全局并发请求数（默认 16）
CONCURRENT_REQUESTS_PER_DOMAIN = 8   # 单域名并发
DOWNLOAD_DELAY = 0.5              # 每个请求之间的下载延迟（秒），防止封 IP
RANDOMIZE_DOWNLOAD_DELAY = True   # 延迟随机化

# ---- 重试与超时 ----
RETRY_ENABLED = True
RETRY_TIMES = 2                   # 重试次数
RETRY_HTTP_CODES = [500, 502, 503, 504, 408, 429]  # 触发重试的状态码
DOWNLOAD_TIMEOUT = 15             # 请求超时（秒）

# ---- 去重与内存 ----
DUPEFILTER_CLASS = "scrapy.dupefilters.RFPDupeFilter"
DEPTH_LIMIT = 3                   # 爬取最大深度

# ---- 日志与导出 ----
LOG_LEVEL = "INFO"
FEEDS = {
    "books.json": {"format": "json", "encoding": "utf8", "indent": 2},
}

# ---- 遵守 robots.txt（默认 True）----
ROBOTSTXT_OBEY = True
```

***

## 四、分布式爬虫与 scrapy-redis

### 2.9 scrapy-redis 分布式思路

单机爬虫受限于一台机器的 IP 与带宽。**scrapy-redis** 用 Redis 做共享调度队列，让多台机器协同爬取，实现分布式。

**核心改造点**

| 组件 | 单机版 | scrapy-redis |
|:-----|:-------|:-------------|
| 调度器 | `Scheduler` | `RedisScheduler`（队列在 Redis） |
| 去重器 | 内存 `RFPDupeFilter` | `RFPDupeFilter`（指纹存 Redis Set） |
| Spider 起始 | `start_urls` | `start_urls` 从 Redis 的 key 读取 |
| Item 去重 | 进程内 | 可基于 Redis 全局去重 |

**配置改造**

```python
# settings.py
# 使用 Redis 作为调度器与去重
SCHEDULER = "scrapy_redis.scheduler.Scheduler"
DUPEFILTER_CLASS = "scrapy_redis.dupefilter.RFPDupeFilter"

# Redis 连接配置
REDIS_URL = "redis://192.168.1.100:6379"

# 爬虫关闭后保留 Redis 中的去重指纹（默认会清空）
SCHEDULER_PERSIST = True

# 从 Redis 队列中取起始 URL
REDIS_START_URLS_KEY = "spider:book:start_urls"
```

**Spider 改造**

```python
import scrapy
from scrapy_redis.spiders import RedisSpider


class BookSpider(RedisSpider):
    name = "book"

    # 不再用 start_urls，改用 redis_key
    # 运行前先在 Redis 中写入起始 URL：
    #   redis-cli lpush spider:book:start_urls https://books.toscrape.com/
    redis_key = "spider:book:start_urls"

    def parse(self, response):
        yield {"title": response.css("h3 a::attr(title)").get()}
```

**分布式去重实战**（用 Redis 全局去重替代内存去重）：

```python
import redis
from scrapy.exceptions import DropItem


class RedisDedupPipeline:
    """基于 Redis 的全局去重：多台机器共享 seen 集合"""

    def __init__(self, redis_url):
        self.r = redis.Redis.from_url(redis_url)

    @classmethod
    def from_crawler(cls, crawler):
        # 从 settings 读取 Redis 地址
        return cls(crawler.settings.get("REDIS_URL"))

    def process_item(self, item, spider):
        key = item["title"]
        # sadd 返回 0 表示该标题已存在 → 重复
        if self.r.sadd("seen_titles", key) == 0:
            raise DropItem(f"已爬过: {key}")
        return item
```

**分布式 vs 单机对比**

| 维度 | 单机 | scrapy-redis 分布式 |
|:-----|:-----|:--------------------|
| 去重 | 单进程内存，重启即失 | Redis 持久化，全局共享 |
| 扩容 | 受单机资源限制 | 加机器即可线性扩容 |
| 调度 | 内存队列 | Redis 队列，机器间互不重复 |
| 部署复杂度 | 低 | 需要维护 Redis 集群 |
| 适用场景 | 中小规模采集 | 大规模、多 IP、时效性采集 |

***

## 五、实践项目

### 项目目标

用 Scrapy 爬取 [Books to Scrape](https://books.toscrape.com/) 全站图书数据，清洗后写入 SQLite，并用 scrapy-redis 实现多任务去重。

**步骤**：

1. `scrapy startproject book_spider` 创建项目
2. 定义 `BookItem` 字段（title/price/rating/stock/url）
3. 编写 Spider：遍历列表页与详情页，提取字段
4. 编写 `CleanPipeline` 清洗价格，`DuplicatePipeline` 去重，`SQLitePipeline` 入库
5. 配置 `settings.py`：并发、延迟、`ROBOTSTXT_OBEY`
6. 运行 `scrapy crawl book -O books.json`，核对 JSON 与数据库数据

**目录结构参考**：

```text
book_spider/
├── scrapy.cfg
├── books.db                      # 生成的 SQLite 数据库
├── books.json                    # 导出结果
└── book_spider/
    ├── __init__.py
    ├── items.py                  # BookItem 字段定义
    ├── middlewares.py            # UA 中间件
    ├── pipelines.py              # 清洗/去重/入库管道
    ├── settings.py               # 并发与 Redis 配置
    └── spiders/
        ├── __init__.py
        └── book.py               # 主爬虫
```
