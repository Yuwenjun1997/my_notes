---
url: >-
  /my_notes/notes/JAVA学习路线/shen-du-xue-xi/05-she-ji-mo-shi-yu-jia-gou/3-xi-tong-she-ji-zhen-ti-jie-xi/index.md
---
# 系统设计真题解析

> 本文档涵盖 7 道经典系统设计面试题的完整解析，从需求分析到架构设计，再到核心代码实现与扩展性思考。

***

## 目录

1. [题目1：设计一个短链接系统](#题目1设计一个短链接系统)
2. [题目2：设计一个秒杀系统](#题目2设计一个秒杀系统)
3. [题目3：设计一个分布式 ID 生成器](#题目3设计一个分布式-id-生成器)
4. [题目4：设计一个消息推送系统](#题目4设计一个消息推送系统)
5. [题目5：设计一个配置中心](#题目5设计一个配置中心)
6. [题目6：设计一个日志系统](#题目6设计一个日志系统)
7. [题目7：设计一个分布式定时任务系统](#题目7设计一个分布式定时任务系统)

***

## 题目1：设计一个短链接系统

### 1.1 题目分析

**核心功能需求：**

* 长链接转短链接（生成唯一且尽可能短的标识）
* 短链接跳转到原始长链接（302/301 重定向）
* 访问统计（PV、UV、独立用户、地域分布、时间分布）

**非功能需求：**

* 高可用：系统不能宕机，跳转需要 99.99% 可用
* 低延迟：跳转延迟需要 < 50ms
* 高并发：生成 QPS 可能数千，跳转 QPS 可能数十万
* 数据持久化：链接映射永不丢失

**数据量估算：**

* 假设每天新生成 1 亿个短链接，每个短链接存活 7 天
* 总存储量：7 亿条记录，每条约 500 字节 => 约 350GB
* 跳转 QPS：假设 1 亿 \* 10 次/天 => 约 11,500 QPS，峰值可到 5 万+

### 1.2 技术选型

| 组件 | 选型 | 理由 |
|------|------|------|
| 发号器 | 雪花算法 + Base62 | 全局唯一、有序、高性能 |
| 数据库 | MySQL (分库分表) + Redis (缓存) | 持久化 + 高性能读取 |
| 缓存 | Redis Cluster | 扛住跳转的高 QPS |
| 布隆过滤器 | Guava BloomFilter / Redis Bitmap | 防止恶意遍历短链接 |
| 网关 | Nginx + Lua | 高性能反向代理 + 限流 |

### 1.3 架构设计

```
                                    ┌─────────────┐
                                    │    DNS      │
                                    └──────┬──────┘
                                           │
                                    ┌──────▼──────┐
                                    │   Nginx     │
                                    │ (负载均衡)   │
                                    └──────┬──────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                      │
            ┌───────▼───────┐    ┌────────▼────────┐    ┌───────▼───────┐
            │  生成短链接    │    │   短链接跳转     │    │  访问统计     │
            │  服务(写)      │    │   服务(读)       │    │  服务         │
            └───────┬───────┘    └────────┬────────┘    └───────┬───────┘
                    │                      │                      │
            ┌───────▼───────┐    ┌────────▼────────┐             │
            │  IdGenService │    │   Redis Cache   │             │
            │  (雪花算法)   │    │  (LRU 淘汰)     │             │
            └───────┬───────┘    └────────┬────────┘             │
                    │                      │                      │
                    └──────────┬───────────┘                     │
                               │                                 │
                      ┌────────▼────────┐              ┌─────────▼─────────┐
                      │   MySQL (写)    │              │   HBase/ES        │
                      │   tb_short_url │              │   访问日志存储     │
                      └─────────────────┘              └───────────────────┘
```

### 1.4 核心算法：发号器

#### 方案A：雪花算法（推荐）

雪花算法生成的 ID 为 64 位长整型，结构如下：

```
 0 ── 0000000000 0000000000 0000000000 0000000000 0 ── 00000 ── 00000 ── 000000000000
 |                         |                        |        |             |
 1bit 符号位(始终0)       41bit 时间戳(毫秒级)      5bit    5bit        12bit
                          (可使用约 69 年)        数据中心 机器ID     序列号(每毫秒4096个)
```

```java
public class SnowflakeIdGenerator {
    // ============================== 位分配 ==============================
    // 起始时间戳 (2023-01-01)
    private final long twepoch = 1672531200000L;

    // 机器ID所占位数
    private final long workerIdBits = 5L;
    // 数据中心ID所占位数
    private final long datacenterIdBits = 5L;
    // 序列号所占位数
    private final long sequenceBits = 12L;

    // 最大值计算
    private final long maxWorkerId = -1L ^ (-1L << workerIdBits);       // 31
    private final long maxDatacenterId = -1L ^ (-1L << datacenterIdBits); // 31

    // 位移
    private final long workerIdShift = sequenceBits;                              // 12
    private final long datacenterIdShift = sequenceBits + workerIdBits;          // 17
    private final long timestampLeftShift = sequenceBits + workerIdBits + datacenterIdBits; // 22

    private final long sequenceMask = -1L ^ (-1L << sequenceBits); // 4095

    // ============================== 属性 ==============================
    private final long workerId;
    private final long datacenterId;
    private long sequence = 0L;
    private long lastTimestamp = -1L;

    public SnowflakeIdGenerator(long workerId, long datacenterId) {
        if (workerId > maxWorkerId || workerId < 0) {
            throw new IllegalArgumentException("workerId 超出范围");
        }
        if (datacenterId > maxDatacenterId || datacenterId < 0) {
            throw new IllegalArgumentException("datacenterId 超出范围");
        }
        this.workerId = workerId;
        this.datacenterId = datacenterId;
    }

    public synchronized long nextId() {
        long timestamp = timeGen();

        // 时钟回拨处理：等待时间追上
        if (timestamp < lastTimestamp) {
            long offset = lastTimestamp - timestamp;
            if (offset <= 5) {
                // 如果回拨不超过 5ms，等待
                try {
                    wait(lastTimestamp - timestamp);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                timestamp = timeGen();
                if (timestamp < lastTimestamp) {
                    throw new RuntimeException("时钟回拨超过预期: " + offset + "ms");
                }
            } else {
                throw new RuntimeException("时钟回拨超过 5ms: " + offset + "ms");
            }
        }

        // 同一毫秒内，序列号自增
        if (lastTimestamp == timestamp) {
            sequence = (sequence + 1) & sequenceMask;
            if (sequence == 0) {
                // 当前毫秒序列号用完，等待下一毫秒
                timestamp = tilNextMillis(lastTimestamp);
            }
        } else {
            sequence = 0L;
        }

        lastTimestamp = timestamp;

        return ((timestamp - twepoch) << timestampLeftShift)
                | (datacenterId << datacenterIdShift)
                | (workerId << workerIdShift)
                | sequence;
    }

    private long tilNextMillis(long lastTimestamp) {
        long timestamp = timeGen();
        while (timestamp <= lastTimestamp) {
            timestamp = timeGen();
        }
        return timestamp;
    }

    private long timeGen() {
        return System.currentTimeMillis();
    }
}
```

#### 方案B：Base62 编码

使用 10 个数字 + 26 个小写 + 26 个大写 = 62 个字符。6 位 Base62 可表示 62^6 ≈ 568 亿个组合。

```java
public class Base62Encoder {
    private static final String BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

    public static String encode(long value) {
        StringBuilder sb = new StringBuilder();
        while (value > 0) {
            sb.append(BASE62.charAt((int) (value % 62)));
            value /= 62;
        }
        // 补零到 6 位
        while (sb.length() < 6) {
            sb.append('0');
        }
        return sb.reverse().toString();
    }

    public static long decode(String str) {
        long result = 0;
        for (char c : str.toCharArray()) {
            result = result * 62 + BASE62.indexOf(c);
        }
        return result;
    }
}
```

**发号器方案对比：**

| 方案 | 优点 | 缺点 |
|------|------|------|
| 自增ID + Base62 | 实现简单，短链接短 | 依赖 DB，有性能上限 |
| Redis INCR | 高性能，有序 | 依赖 Redis，ID 为顺序易被猜出 |
| 雪花算法 + Base62 | 去中心化，性能高 | 需要处理时钟回拨 |
| 预生成 ID 段 | 高性能，可批量取 | 架构略复杂 |

### 1.5 数据模型

```sql
-- 短链接映射表（分库分表，按短链接哈希分片）
CREATE TABLE `tb_short_url_0000` (
    `id`            BIGINT       NOT NULL COMMENT '主键ID',
    `short_code`    VARCHAR(10)  NOT NULL COMMENT '短链接码',
    `long_url`      VARCHAR(2048) NOT NULL COMMENT '原始长链接',
    `expire_at`     DATETIME     NOT NULL COMMENT '过期时间',
    `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_short_code` (`short_code`),
    KEY `idx_expire_at` (`expire_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 访问统计表（按天分表）
CREATE TABLE `tb_access_log_20260622` (
    `id`            BIGINT       NOT NULL AUTO_INCREMENT,
    `short_code`    VARCHAR(10)  NOT NULL COMMENT '短链接码',
    `ip`            VARCHAR(45)  NOT NULL COMMENT '访问者IP',
    `user_agent`    VARCHAR(512) NOT NULL DEFAULT '',
    `referer`       VARCHAR(512) NOT NULL DEFAULT '',
    `country`       VARCHAR(50)  NOT NULL DEFAULT '',
    `city`          VARCHAR(50)  NOT NULL DEFAULT '',
    `device_type`   VARCHAR(20)  NOT NULL DEFAULT '',
    `access_time`   DATETIME     NOT NULL COMMENT '访问时间',
    PRIMARY KEY (`id`),
    KEY `idx_short_code` (`short_code`, `access_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 1.6 核心流程

#### 生成短链接流程

```
1. 用户提交长链接 URL
2. 校验 URL 合法性
3. 调用 ID 生成器获取唯一 ID
4. Base62 编码生成短链码
5. 写入 MySQL（检查唯一索引防冲突）
6. 写入 Redis（key: short_code, value: long_url, TTL: 7天）
7. 返回短链接
```

```java
@Service
public class ShortUrlService {
    @Autowired
    private SnowflakeIdGenerator idGenerator;
    @Autowired
    private RedisTemplate<String, String> redisTemplate;
    @Autowired
    private ShortUrlMapper shortUrlMapper;

    @Transactional
    public String createShortUrl(String longUrl, long expireSeconds) {
        // 1. 生成唯一ID
        long id = idGenerator.nextId();
        String shortCode = Base62Encoder.encode(id);

        // 2. 构建实体
        ShortUrlEntity entity = new ShortUrlEntity();
        entity.setId(id);
        entity.setShortCode(shortCode);
        entity.setLongUrl(longUrl);
        entity.setExpireAt(new Date(System.currentTimeMillis() + expireSeconds * 1000));

        // 3. 写入数据库
        shortUrlMapper.insert(entity);

        // 4. 写入缓存
        redisTemplate.opsForValue()
                .set("short:" + shortCode, longUrl, expireSeconds, TimeUnit.SECONDS);

        return "https://s.example.com/" + shortCode;
    }
}
```

#### 短链接跳转流程

```
1. 用户访问 https://s.example.com/abc123
2. Nginx 反向代理到跳转服务
3. 查询 Redis 缓存，命中直接返回
4. Redis 未命中，查 MySQL
5. MySQL 查到则回填 Redis，并增加访问计数
6. MySQL 未查到则返回 404
7. 异步记录访问日志（Kafka → HBase/ES）
8. 返回 302 重定向到原始长链接
```

```java
@RestController
public class RedirectController {

    @Autowired
    private RedisTemplate<String, String> redisTemplate;
    @Autowired
    private ShortUrlMapper shortUrlMapper;
    @Autowired
    private KafkaTemplate<String, AccessLog> kafkaTemplate;

    @GetMapping("/{shortCode}")
    public ResponseEntity<Void> redirect(@PathVariable String shortCode,
                                         HttpServletRequest request) {
        // 1. 布隆过滤器检查（防恶意攻击）
        if (!bloomFilter.mightContain(shortCode)) {
            return ResponseEntity.notFound().build();
        }

        // 2. 查缓存
        String longUrl = redisTemplate.opsForValue().get("short:" + shortCode);
        if (longUrl == null) {
            // 3. 缓存未命中，查数据库
            ShortUrlEntity entity = shortUrlMapper.findByShortCode(shortCode);
            if (entity == null || entity.getExpireAt().before(new Date())) {
                return ResponseEntity.notFound().build();
            }
            longUrl = entity.getLongUrl();

            // 4. 回填缓存，并异步增加访问计数
            long ttl = (entity.getExpireAt().getTime() - System.currentTimeMillis()) / 1000;
            redisTemplate.opsForValue()
                    .set("short:" + shortCode, longUrl, ttl, TimeUnit.SECONDS);
        }

        // 5. 异步记录访问日志（通过 MQ 异步写，不阻塞主流程）
        AccessLog log = new AccessLog(shortCode, request.getRemoteAddr(),
                                       request.getHeader("User-Agent"),
                                       request.getHeader("Referer"));
        kafkaTemplate.send("access-log-topic", log);

        // 6. 302 重定向（临时重定向，让浏览器每次都走我们的服务器做统计）
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(longUrl))
                .build();
    }
}
```

### 1.7 301 vs 302 重定向

| 类型 | 含义 | 浏览器行为 | 适用场景 |
|------|------|-----------|---------|
| **301** | 永久重定向 | 浏览器会缓存结果，下次直接跳转到目标，不经过短链服务 | 对统计要求不高的场景，减少服务器压力 |
| **302** | 临时重定向 | 每次都会先请求短链服务，再跳转 | 需要精确统计访问量的场景 |

**策略选择：**

* 业务含义为永久链接（如文章分享）→ 301，减少服务器压力
* 业务需要统计（如广告链接）→ 302，每次都经过统计服务
* 可以混合使用：低频统计的链接用 302，高频的用 301

### 1.8 数据存储分片设计

**分片策略：**

* 按 `short_code` 的哈希值取模分片：`hash(short_code) % N`
* 一致性哈希：减少扩缩容时的数据迁移

```java
public class DbRouter {
    // 分片数量（如 64 个库，每个库 64 张表）
    private static final int DB_COUNT = 64;
    private static final int TABLE_COUNT = 64;

    public static String getDbKey(String shortCode) {
        int hash = Math.abs(shortCode.hashCode());
        int dbIndex = hash % DB_COUNT;
        return String.format("short_url_db_%02d", dbIndex);
    }

    public static String getTableSuffix(String shortCode) {
        int hash = Math.abs(shortCode.hashCode());
        int tableIndex = (hash / DB_COUNT) % TABLE_COUNT;
        return String.format("_%04d", tableIndex);
    }
}
```

**分片后查询流程：**

```
1. 计算 shortCode 的哈希值
2. 根据哈希值确定目标库和表
3. 路由到对应的 MySQL 实例
4. 执行查询
```

### 1.9 布隆过滤器防恶意攻击

**问题：** 攻击者随机生成短链码访问，每次都穿透到数据库，导致 DB 压力过大。

**解决方案：** 使用布隆过滤器快速判断短链码是否存在。

```java
@Component
public class ShortUrlBloomFilter {

    private final BloomFilter<String> bloomFilter;

    // 预计数据量 10 亿，误判率 0.01%
    public ShortUrlBloomFilter() {
        this.bloomFilter = BloomFilter.create(
                Funnels.stringFunnel(Charset.forName("UTF-8")),
                1_000_000_000,
                0.0001);
    }

    @PostConstruct
    public void init() {
        // 从数据库加载所有有效短链接到布隆过滤器
        // 分批加载，避免 OOM
        int page = 0;
        while (true) {
            List<String> codes = shortUrlMapper.listAllShortCodes(page, 10000);
            if (codes.isEmpty()) break;
            codes.forEach(bloomFilter::put);
            page++;
        }
    }

    // 短链接生成时，加入布隆过滤器
    public void add(String shortCode) {
        bloomFilter.put(shortCode);
    }

    // 判断短链接是否存在（有误判率，但误判后还会查缓存+DB兜底）
    public boolean mightContain(String shortCode) {
        return bloomFilter.mightContain(shortCode);
    }
}
```

**Redis 布隆过滤器方案（适用于分布式场景）：**

```java
@Component
public class RedisBloomFilter {
    @Autowired
    private RedisTemplate<String, String> redisTemplate;
    private static final String BLOOM_KEY = "short_url_bloom";

    // Bitmap 方式：使用多个哈希函数
    private static final int[] SEEDS = {3, 7, 11, 13, 31, 37, 61, 73, 97, 103};
    private static final int BIT_SIZE = 1 << 31; // 约 2.1 亿位

    public void add(String url) {
        for (int seed : SEEDS) {
            int hash = hash(url, seed);
            // 计算在 Bitmap 中的位置
            long index = (hash & 0x7FFFFFFF) % BIT_SIZE;
            redisTemplate.opsForValue().setBit(BLOOM_KEY, index, true);
        }
    }

    public boolean mightContain(String url) {
        for (int seed : SEEDS) {
            int hash = hash(url, seed);
            long index = (hash & 0x7FFFFFFF) % BIT_SIZE;
            Boolean bit = redisTemplate.opsForValue().getBit(BLOOM_KEY, index);
            if (Boolean.FALSE.equals(bit)) {
                return false;
            }
        }
        return true;
    }

    private int hash(String str, int seed) {
        int result = 0;
        for (char c : str.toCharArray()) {
            result = result * seed + c;
        }
        return result;
    }
}
```

### 1.10 扩展性思考

1. **自定义短域名：** 允许用户绑定自己的域名，通过 DNS 解析到不同服务分组
2. **短链接有效期：** 支持永久 / 临时（7天自动清理），过期数据通过 TTL 删除
3. **防盗链：** 对短链接来源 Referer 做限制
4. **统计系统：** 使用 HBase 存储海量访问日志，按时 + 地域维度聚合
5. **安全风控：** 自动检测恶意链接（如钓鱼网站），加入黑名单自动拦截
6. **自定义短链：** 用户可自定义短链后缀，需要额外检查唯一性

***

## 题目2：设计一个秒杀系统

### 2.1 题目分析

**核心场景：** 大量用户在同一时间点抢购有限数量的商品，系统需要承受瞬时高并发。

**核心挑战：**

* 瞬时高并发（峰值 QPS 可能达到数百万）
* 超卖：绝不能出现卖出的商品数量 > 库存
* 少卖：不能因为系统原因导致库存没卖出去
* 防止重复下单：同一用户不能下多个订单
* 公平性：防止黄牛刷单
* 数据一致性：库存扣减和订单创建的一致

**数据量估算：**

* 真实库存：100 ~ 10000 件
* 参与人数：10万 ~ 1亿
* 秒杀开始后前 10 秒流量峰值

### 2.2 技术选型

| 组件 | 选型 | 作用 |
|------|------|------|
| 浏览器端 | 静态化 + 按钮置灰 | 前端限流 |
| CDN | 静态资源加速 | 扛住前端流量 |
| 网关 | Nginx + Lua + OpenResty | 请求限流（令牌桶） |
| 应用层 | Spring Boot (无状态部署) | 业务逻辑 |
| 缓存 | Redis Cluster | 库存预扣 |
| 消息队列 | RocketMQ / Kafka | 异步下单削峰 |
| 数据库 | MySQL + 乐观锁 | 最终库存扣减 |
| 分布式锁 | Redisson | 防止重复下单 |

### 2.3 架构设计

```
                      ┌──────────────┐
                      │   用户浏览器   │
                      └──────┬───────┘
                             │
                    ┌────────▼────────┐
                    │   CDN (静态页面)  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  DNS 负载均衡    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Nginx + Lua    │
                    │  (限流/黑白名单) │
                    └────────┬────────┘
                             │
             ┌───────────────┼───────────────┐
             │               │               │
     ┌───────▼───────┐ ┌────▼────┐ ┌───────▼───────┐
     │   秒杀应用1    │ │ 秒杀应用2│ │   秒杀应用N    │
     │ (无状态)       │ │         │ │               │
     └───────┬───────┘ └────┬────┘ └───────┬───────┘
             │               │               │
     ┌───────▼───────────────▼───────────────▼───────┐
     │               Redis Cluster                   │
     │   (库存预扣 + Lua脚本 + 分布式锁 + 限流令牌)    │
     └───────┬───────────────┬───────────────┬───────┘
             │               │               │
     ┌───────▼───────┐ ┌────▼────┐ ┌───────▼───────┐
     │  RocketMQ     │ │ 业务服务 │ │  MySQL 主从    │
     │  (秒杀订单)    │ │(订单创建)│ │ (最终库存)     │
     └───────┬───────┘ └─────────┘ └───────────────┘
             │
     ┌───────▼───────┐
     │  订单消费服务   │
     │  (异步处理订单) │
     └───────┬───────┘
             │
     ┌───────▼───────┐
     │   MySQL       │
     │  (订单写入)    │
     └───────────────┘
```

### 2.4 前端限流

```html
<!-- 秒杀按钮 -->
<button id="seckillBtn" onclick="doSeckill()" disabled>
    距离秒杀开始还有: <span id="countdown">10</span>s
</button>

<script>
    // 倒计时完成后启用按钮
    let countdown = 10;
    const timer = setInterval(() => {
        countdown--;
        document.getElementById('countdown').innerText = countdown;
        if (countdown <= 0) {
            document.getElementById('seckillBtn').disabled = false;
            clearInterval(timer);
        }
    }, 1000);

    // 控制按钮状态，防止重复提交
    let isSubmitting = false;
    function doSeckill() {
        if (isSubmitting) return;
        isSubmitting = true;
        document.getElementById('seckillBtn').disabled = true;

        // 发起秒杀请求
        fetch('/api/seckill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skuId: 'xxx' })
        }).then(res => res.json()).then(data => {
            if (data.code === 0) {
                alert('秒杀成功！');
            } else {
                alert(data.msg);
            }
        }).finally(() => {
            // 设置 3 秒后才能再次点击（防止快速重试）
            setTimeout(() => {
                isSubmitting = false;
                document.getElementById('seckillBtn').disabled = false;
            }, 3000);
        });
    }
</script>
```

### 2.5 Nginx 层限流

```nginx
# OpenResty/Nginx 限流配置
http {
    # 定义限流区域：每个IP每秒最多 5 个请求
    limit_req_zone $binary_remote_addr zone=seckill:10m rate=5r/s;
    # 定义连接数限制：每个IP最多 10 个并发
    limit_conn_zone $binary_remote_addr zone=conn_seckill:10m;

    upstream seckill_backend {
        # 最少连接数负载均衡
        least_conn;
        server 10.0.1.1:8080 max_fails=3 fail_timeout=30s;
        server 10.0.1.2:8080 max_fails=3 fail_timeout=30s;
    }

    server {
        listen 80;
        location /api/seckill {
            # 限流：超过的请求返回 503
            limit_req zone=seckill burst=10 nodelay;
            limit_conn conn_seckill 10;

            # 验证码校验
            access_by_lua_block {
                local captcha = ngx.var.arg_captcha
                if not captcha or captcha ~= ngx.shared.cache:get("captcha_" .. ngx.var.remote_addr) then
                    ngx.exit(ngx.HTTP_FORBIDDEN)
                end
            }

            proxy_pass http://seckill_backend;
        }
    }
}
```

### 2.6 Redis 预扣库存（Lua 脚本原子性）

**核心思想：** 不在数据库层面扣减库存（数据库瓶颈），而是在 Redis 中预扣库存，只有 Redis 扣减成功后才进入后续流程。

```lua
-- lua_seckill.lua
-- KEYS[1]: 库存 key (seckill:stock:{skuId})
-- KEYS[2]: 用户已购 key (seckill:bought:{skuId})
-- ARGV[1]: 用户ID
-- ARGV[2]: 购买数量
-- ARGV[3]: 总库存

-- 1. 检查用户是否已经购买过
local boughtKey = KEYS[2] .. ":" .. ARGV[1]
local bought = redis.call('exists', boughtKey)
if bought == 1 then
    return -1  -- 重复购买
end

-- 2. 检查库存是否充足
local stock = redis.call('get', KEYS[1])
if not stock or tonumber(stock) < tonumber(ARGV[2]) then
    return -2  -- 库存不足
end

-- 3. 扣减库存
local remain = redis.call('decrby', KEYS[1], tonumber(ARGV[2]))
if remain < 0 then
    -- 超卖，回滚
    redis.call('incrby', KEYS[1], tonumber(ARGV[2]))
    return -2
end

-- 4. 标记用户已购买（带 TTL，防止数据残留）
redis.call('setex', boughtKey, 86400, '1')

-- 5. 返回剩余库存
return remain
```

```java
@Service
public class SeckillService {

    @Autowired
    private RedisTemplate<String, String> redisTemplate;

    // 初始化库存
    public void initStock(String skuId, int totalStock) {
        redisTemplate.opsForValue()
                .set("seckill:stock:" + skuId, String.valueOf(totalStock));
    }

    // 秒杀核心逻辑
    public SeckillResult doSeckill(String skuId, String userId, int quantity) {
        // 1. 执行 Lua 脚本，在 Redis 中扣减库存
        DefaultRedisScript<Long> script = new DefaultRedisScript<>();
        script.setScriptSource(new ResourceScriptSource(
                new ClassPathResource("lua/seckill.lua")));
        script.setResultType(Long.class);

        Long result = redisTemplate.execute(script, Arrays.asList(
                "seckill:stock:" + skuId,
                "seckill:bought:" + skuId,
                userId, String.valueOf(quantity)));

        if (result == null || result < 0) {
            String msg = result == -1 ? "您已参与过此秒杀" : "库存不足";
            return SeckillResult.fail(msg);
        }

        // 2. 发送消息到 MQ，异步创建订单
        SeckillMessage msg = new SeckillMessage(skuId, userId, quantity);
        sendSeckillMessage(msg);

        return SeckillResult.success("秒杀成功，正在处理订单...");
    }
}
```

### 2.7 订单异步创建（MQ 削峰）

**为什么使用 MQ：** 秒杀峰值 QPS 可达数十万，数据库无法承受。通过 MQ 削峰，让消费端按自己的节奏处理。

```java
// 生产者：秒杀成功后发送消息
@Service
public class SeckillProducer {

    @Autowired
    private RocketMQTemplate rocketMQTemplate;

    public void sendSeckillMessage(SeckillMessage msg) {
        // 使用事务消息，保证库存扣减和订单创建的最终一致性
        rocketMQTemplate.sendMessageInTransaction(
                "seckill-topic",
                MessageBuilder.withPayload(msg).build(),
                msg
        );
    }
}

// 消费者：异步创建订单
@Component
@RocketMQMessageListener(topic = "seckill-topic",
                          consumerGroup = "seckill-consumer")
public class SeckillConsumer implements RocketMQListener<SeckillMessage> {

    @Autowired
    private OrderService orderService;

    @Override
    public void onMessage(SeckillMessage msg) {
        // 1. 幂等性检查：使用消息唯一ID去重
        String dedupKey = "seckill:dedup:" + msg.getMsgId();
        Boolean existed = redisTemplate.opsForValue()
                .setIfAbsent(dedupKey, "1", 10, TimeUnit.MINUTES);
        if (Boolean.FALSE.equals(existed)) {
            log.info("重复消息，跳过处理: {}", msg.getMsgId());
            return;
        }

        // 2. 创建订单
        try {
            orderService.createOrder(msg.getSkuId(), msg.getUserId(), msg.getQuantity());
        } catch (Exception e) {
            // 异常处理：记录失败消息，重试
            log.error("订单创建失败", e);
            throw new RuntimeException(e);
        }
    }
}
```

### 2.8 防止超卖（数据库乐观锁）

**问题：** Redis 预扣库存可能因为宕机等原因而丢失，必须以数据库为最终依据。

```sql
-- 商品库存表
CREATE TABLE `tb_sku_stock` (
    `id`            BIGINT       NOT NULL AUTO_INCREMENT,
    `sku_id`        VARCHAR(64)  NOT NULL COMMENT '商品SKU',
    `total_stock`   INT          NOT NULL COMMENT '总库存',
    `sold_stock`    INT          NOT NULL DEFAULT 0 COMMENT '已售库存',
    `version`       INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本号',
    `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_sku_id` (`sku_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 扣减库存（使用乐观锁）
UPDATE tb_sku_stock
SET sold_stock = sold_stock + #{quantity},
    version = version + 1
WHERE sku_id = #{skuId}
  AND total_stock - sold_stock >= #{quantity}
  AND version = #{oldVersion};  -- 乐观锁
```

```java
// 数据库扣减库存（最终一致性兜底）
@Transactional
public boolean deductStock(String skuId, int quantity, int version) {
    int affected = stockMapper.deductStock(skuId, quantity, version);
    if (affected == 0) {
        // 可能库存不足或版本冲突
        return false;
    }
    return true;
}
```

### 2.9 防止重复下单（幂等性设计）

**多层级幂等防重复：**

```java
@Service
public class IdempotentService {

    // 1. 前端：按钮置灰（同一用户 3 秒内无法重复提交）

    // 2. 网关：基于用户 ID + SKU 的令牌桶限流
    public boolean tokenBucketCheck(String userId, String skuId) {
        String key = "seckill:token:" + userId + ":" + skuId;
        return redisTemplate.opsForValue()
                .setIfAbsent(key, "1", 1, TimeUnit.SECONDS);
    }

    // 3. Redis Lua 脚本层：检查用户已购标记
    // （已在前面的 Lua 脚本中实现，exists boughtKey）

    // 4. MQ 消费端：消息唯一ID去重
    // （已在前面的消费端代码中实现，setIfAbsent dedupKey）

    // 5. 数据库层面：唯一索引
    @Transactional
    public void createOrder(String skuId, String userId, int quantity) {
        Order order = new Order();
        order.setOrderNo(generateOrderNo(userId, skuId));  // 唯一的订单号
        order.setSkuId(skuId);
        order.setUserId(userId);
        order.setQuantity(quantity);
        order.setStatus(0);  // 待支付

        try {
            orderMapper.insert(order);
        } catch (DuplicateKeyException e) {
            // 重复订单，静默处理
            log.warn("重复订单: userId={}, skuId={}", userId, skuId);
        }
    }

    private String generateOrderNo(String userId, String skuId) {
        // 订单号 = 用户ID_hash + 时间戳 + SKU_ID_hash
        return DigestUtils.md5Hex(userId + "_" + skuId + "_" + System.currentTimeMillis())
                .substring(0, 32);
    }
}
```

### 2.10 扩展性思考

1. **验证码降级：** 高并发时验证码服务本身会成为瓶颈，需要做降级方案（如简化验证码或直接放行）
2. **队列长度控制：** 防止 MQ 积压过多，加一层计数器自动熔断
3. **热点隔离：** 热门秒杀商品使用独立 Redis 实例，防止影响其他业务
4. **黄牛防护：** 设备指纹识别、行为分析（同IP/同设备大量下单自动限流）
5. **库存预加载：** 预热阶段将库存提前加载到 Redis，避免冷启动穿透
6. **订单超时关闭：** 支付限时（通常 15 分钟），超时释放库存（Redis 过期回调 + 定时任务兜底）
7. **多级限流：** 本地限流（Guava RateLimiter）+ 分布式限流（Redis Token Bucket）结合

***

## 题目3：设计一个分布式 ID 生成器

### 3.1 题目分析

**需求：**

* 全局唯一：分布式环境下不能重复
* 趋势递增：方便数据库索引（B+Tree 有序写入性能高）
* 高可用：不能因为单点故障导致 ID 生成不可用
* 高性能：生成 QPS 需要达到数十万甚至百万
* 短：便于存储和展示

### 3.2 方案对比

#### 方案1：UUID

```java
// Java 原生 UUID
String uuid = UUID.randomUUID().toString();
// 结果: "550e8400-e29b-41d4-a716-446655440000"
```

| 项目 | 评价 |
|------|------|
| 长度 | 36 字符（太长） |
| 顺序 | 无序（影响 B+Tree 性能，页分裂严重） |
| 唯一性 | 全球唯一 |
| 性能 | 高（纯内存计算） |
| 适用场景 | 非数据库索引场景 |

#### 方案2：数据库自增 ID

```sql
CREATE TABLE `sequence_id` (
    `id`    BIGINT NOT NULL AUTO_INCREMENT,
    `stub`  CHAR(1) NOT NULL DEFAULT '',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_stub` (`stub`)
) ENGINE=InnoDB;

-- 生成 ID
REPLACE INTO sequence_id (stub) VALUES ('');
SELECT LAST_INSERT_ID();
```

| 项目 | 评价 |
|------|------|
| 优点 | 实现简单，严格递增 |
| 缺点 | 单点瓶颈，数据库 IO 成为性能上限 |

**优化：** 数据库号段模式（批量取 ID）

```java
// 号段模式：一次取一批 ID，在内存中分配
@Service
public class DbIdGenerator {
    private static final int STEP = 1000;  // 每次取 1000 个
    private long currentId = 0;
    private long maxId = 0;
    private final Object lock = new Object();

    public long nextId() {
        synchronized (lock) {
            if (currentId >= maxId) {
                // 从数据库获取新的号段
                IdSegment segment = getIdFromDb();
                currentId = segment.getBeginId();
                maxId = segment.getMaxId();
            }
            return currentId++;
        }
    }

    private IdSegment getIdFromDb() {
        // 根据当前 maxId，使用 REPLACE INTO 获取下一个起始 ID
        // 或使用专门的号段表
        IdSegment segment = new IdSegment();
        segment.setBeginId(/* 从 DB 获取起始 ID */);
        segment.setMaxId(segment.getBeginId() + STEP);
        return segment;
    }
}
```

#### 方案3：Redis INCR

```java
// Redis INCR 命令
Long id = redisTemplate.opsForValue().increment("global_id_key");
```

| 项目 | 评价 |
|------|------|
| 性能 | 单机约 10 万 QPS |
| 依赖 | 强依赖 Redis 可用性 |
| 持久化 | RDB/AOF 可能丢号或重复 |
| 顺序 | 严格递增 |

#### 方案4：雪花算法（推荐）

### 3.3 雪花算法详解

**位结构：**

```
 0          41位时间戳                    10位机器ID      12位序列号
├───────────┼───────────────────────────┼───────────────┼───────────────┤
│ 符号位(1) │ 时间戳差值(毫秒)           │ 工作机器ID    │ 序列号        │
│ 始终为0   │ 可使用约 69 年            │ 最多 1024 台  │ 4096/毫秒     │
└───────────┴───────────────────────────┴───────────────┴───────────────┘
```

**性能：** 单机每秒可生成约 400 万个 ID（4096 \* 1000），完全满足需求。

#### 时钟回拨问题及解决方案

**问题：** 服务器时间回拨（NTP 同步、手动调整）导致生成重复 ID。

**解决方案：**

```java
public class ClockBackResistantIdGenerator {
    // ===================== 位配置 =====================
    private final long twepoch = 1672531200000L;  // 2023-01-01
    private final long workerIdBits = 10L;
    private final long sequenceBits = 12L;
    private final long workerIdShift = sequenceBits;
    private final long timestampLeftShift = sequenceBits + workerIdBits;
    private final long sequenceMask = -1L ^ (-1L << sequenceBits);

    private final long workerId;
    private volatile long lastTimestamp = -1L;
    private volatile long sequence = 0L;

    // 记录上次时间戳回拨时的补偿序号
    private long lastClockOffset = 0;

    // 时钟回拨监听
    private long lastTimeCheck = System.currentTimeMillis();
    private long systemStartTime = System.currentTimeMillis();

    // ===================== 核心方法 =====================
    public synchronized long nextId() {
        long timestamp = currentTime();

        // ----------- 时钟回拨处理 1：等待 -----------
        if (timestamp < lastTimestamp) {
            long offset = lastTimestamp - timestamp;
            if (offset < 1000) {  // 1秒以内的回拨，等待
                try {
                    Thread.sleep(offset);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                timestamp = currentTime();
            } else {
                // ----------- 时钟回拨处理 2：借用未来时间片 -----------
                // 生成一个使用未来时间的 ID，但会被记录下来
                // 等实际时间追上来之前，不再生成 ID
                if (lastClockOffset < 100) {  // 最多允许 100ms 的预借
                    lastClockOffset++;
                    timestamp = lastTimestamp;
                } else {
                    throw new RuntimeException("时钟回拨过大: " + offset + "ms");
                }
            }
        }

        // ----------- 正常生成 -----------
        if (timestamp == lastTimestamp) {
            sequence = (sequence + 1) & sequenceMask;
            if (sequence == 0) {
                timestamp = waitNextMillis(lastTimestamp);
            }
        } else {
            sequence = 0L;
            lastClockOffset = 0;  // 时间恢复正常，重置偏移
        }

        lastTimestamp = timestamp;

        return ((timestamp - twepoch) << timestampLeftShift)
                | (workerId << workerIdShift)
                | sequence;
    }

    private long waitNextMillis(long lastTimestamp) {
        long timestamp = currentTime();
        while (timestamp <= lastTimestamp) {
            timestamp = currentTime();
        }
        return timestamp;
    }

    private long currentTime() {
        return System.currentTimeMillis();
    }
}
```

**时钟回拨深度解决方案对比：**

| 方案 | 描述 | 适用场景 |
|------|------|---------|
| 等待 | 回拨后等待时间自动追上 | 小幅度回拨（< 1秒） |
| 预借时间片 | 允许生成少量未来时间戳的 ID | 中等回拨（< 100ms） |
| 备用机器 | 多台机器备份，回拨严重的自动切换 | 关键业务 |
| ZK 自增序列 | 完全规避时间问题 | 对性能要求不高的场景 |

### 3.4 自定义实现代码

**完整可运行的雪花算法实现：**

```java
public class SnowflakeIdWorker {
    // ============================== 常数 ==============================
    /** 开始时间戳 (2023-01-01) */
    private static final long TWEPOCH = 1672531200000L;

    /** 机器ID所占位数 */
    private static final long WORKER_ID_BITS = 5L;
    /** 数据中心ID所占位数 */
    private static final long DATA_CENTER_ID_BITS = 5L;
    /** 序列号所占位数 */
    private static final long SEQUENCE_BITS = 12L;

    /** 机器ID最大值 31 */
    private static final long MAX_WORKER_ID = ~(-1L << WORKER_ID_BITS);
    /** 数据中心ID最大值 31 */
    private static final long MAX_DATA_CENTER_ID = ~(-1L << DATA_CENTER_ID_BITS);

    /** 机器ID左移12位 */
    private static final long WORKER_ID_SHIFT = SEQUENCE_BITS;
    /** 数据中心ID左移17位 (12+5) */
    private static final long DATA_CENTER_ID_SHIFT = SEQUENCE_BITS + WORKER_ID_BITS;
    /** 时间戳左移22位 (12+5+5) */
    private static final long TIMESTAMP_LEFT_SHIFT = SEQUENCE_BITS + WORKER_ID_BITS + DATA_CENTER_ID_BITS;

    /** 序列号掩码 4095 (0b111111111111=0xfff=4095) */
    private static final long SEQUENCE_MASK = ~(-1L << SEQUENCE_BITS);

    // ============================== 属性 ==============================
    private final long workerId;
    private final long datacenterId;
    private long sequence = 0L;
    private long lastTimestamp = -1L;

    // ============================== 构造 ==============================
    public SnowflakeIdWorker(long workerId, long datacenterId) {
        if (workerId > MAX_WORKER_ID || workerId < 0) {
            throw new IllegalArgumentException(
                    String.format("workerId 不能大于 %d 或小于 0", MAX_WORKER_ID));
        }
        if (datacenterId > MAX_DATA_CENTER_ID || datacenterId < 0) {
            throw new IllegalArgumentException(
                    String.format("datacenterId 不能大于 %d 或小于 0", MAX_DATA_CENTER_ID));
        }
        this.workerId = workerId;
        this.datacenterId = datacenterId;
    }

    // ============================== 方法 ==============================
    public synchronized long nextId() {
        long timestamp = timeGen();

        // 1. 时钟回拨检查
        if (timestamp < lastTimestamp) {
            long offset = lastTimestamp - timestamp;
            if (offset <= 5) {
                // 等待
                try {
                    wait(offset);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                timestamp = timeGen();
                if (timestamp < lastTimestamp) {
                    throw new RuntimeException(
                            String.format("时钟回拨 %dms，拒绝生成 ID", lastTimestamp - timestamp));
                }
            } else {
                // 使用备用序列号空间
                timestamp = lastTimestamp;
            }
        }

        // 2. 同一毫秒内序列号递增
        if (lastTimestamp == timestamp) {
            sequence = (sequence + 1) & SEQUENCE_MASK;
            if (sequence == 0) {
                // 当前毫秒序列号用完
                timestamp = tilNextMillis(lastTimestamp);
            }
        } else {
            sequence = 0L;
        }

        lastTimestamp = timestamp;

        // 3. 拼接 ID
        return ((timestamp - TWEPOCH) << TIMESTAMP_LEFT_SHIFT)
                | (datacenterId << DATA_CENTER_ID_SHIFT)
                | (workerId << WORKER_ID_SHIFT)
                | sequence;
    }

    private long tilNextMillis(long lastTimestamp) {
        long timestamp = timeGen();
        while (timestamp <= lastTimestamp) {
            timestamp = timeGen();
        }
        return timestamp;
    }

    private long timeGen() {
        return System.currentTimeMillis();
    }

    // ============================== 测试 ==============================
    public static void main(String[] args) {
        SnowflakeIdWorker idWorker = new SnowflakeIdWorker(1, 1);
        long start = System.currentTimeMillis();
        int count = 100000;
        for (int i = 0; i < count; i++) {
            long id = idWorker.nextId();
            System.out.println(id);
        }
        long end = System.currentTimeMillis();
        System.out.println("生成 " + count + " 个 ID 耗时: " + (end - start) + "ms");
        System.out.println("QPS: " + (count * 1000 / (end - start)));
    }
}
```

### 3.5 扩展性思考

1. **美团 Leaf 方案：** 号段模式 + 雪花算法的结合，解决雪花算法时钟回拨和号段模式更新开销的问题
2. **百度 UidGenerator：** 基于 Snowflake，将时间戳改为秒级，工作机器ID 使用数据库分配
3. **时钟回拨终极方案：** 当检测到时钟回拨时，使用 ZK 分配新的 workerId，同时保留旧 workerId 的一段时间（双写）
4. **多 ID 生成策略组合：** 根据业务场景选择不同 ID 生成器（如订单 ID 用雪花，日志 ID 用 UUID）

***

## 题目4：设计一个消息推送系统

### 4.1 题目分析

**核心功能：**

* 点对点推送：一个用户推送给另一个用户
* 群发推送：一个用户推送给群组所有成员
* 广播推送：系统推送给所有在线用户
* 离线消息：用户不在线时暂存消息，上线后拉取

**非功能需求：**

* 消息可靠性：消息不丢失、不重复
* 实时性：消息延迟 < 1秒
* 高并发：支持百万级在线用户
* 有序性：同一个用户的消息需要有序

**数据量估算：**

* DAU：1000 万
* 每天消息量：10 亿条
* 峰值 QPS：50 万
* 平均消息大小：1KB

### 4.2 技术选型

| 技术 | 用途 |
|------|------|
| Netty | 高性能网络通信层，处理海量 TCP 连接 |
| WebSocket | 浏览器端全双工通信 |
| RocketMQ / Kafka | 消息异步分发，削峰填谷 |
| Redis | 在线状态管理，离线消息缓存 |
| MySQL / MongoDB | 离线消息持久化 |
| ZK / Nacos | 服务发现、连接路由 |

### 4.3 架构设计

```
                     ┌──────────────────────────────┐
                     │        接入层 (Netty)         │
                     │ ┌─────┐ ┌─────┐ ┌──────────┐ │
                     │ │N1  │ │N2  │ │ ... Nn   │ │
                     │ └──┬──┘ └──┬──┘ └────┬─────┘ │
                     └────┼───────┼─────────┼───────┘
                          │       │         │
                     ┌────▼───────▼─────────▼───────┐
                     │    连接路由层 (ZK/Nacos)      │
                     │   (用户ID -> Netty 节点)      │
                     └───────────────┬───────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
      ┌───────▼───────┐    ┌────────▼────────┐    ┌───────▼───────┐
      │   消息分发服务   │    │   状态管理服务   │    │   离线消息服务  │
      │  (路由 + 推送)  │    │  (在线/离线)     │    │  (存储/拉取)   │
      └───────┬───────┘    └────────┬────────┘    └───────┬───────┘
              │                      │                      │
              └──────────────────────┼──────────────────────┘
                                     │
                          ┌──────────▼──────────┐
                          │    Message Queue     │
                          │   (RocketMQ/Kafka)   │
                          └──────────┬──────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
      ┌───────▼───────┐    ┌────────▼────────┐    ┌───────▼───────┐
      │   消息持久化    │    │   消息去重服务   │    │   Ack 确认服务 │
      │   (MongoDB)    │    │  (幂等性校验)   │    │  (重试机制)    │
      └────────────────┘    └─────────────────┘    └───────────────┘
```

### 4.4 用户接入方式对比

#### WebSocket（推荐）

```java
// Netty WebSocket 服务端
@Slf4j
@Component
public class WebSocketServer {

    private final EventLoopGroup bossGroup = new NioEventLoopGroup(1);
    private final EventLoopGroup workerGroup = new NioEventLoopGroup(
            Runtime.getRuntime().availableProcessors() * 2);

    @PostConstruct
    public void start() {
        try {
            ServerBootstrap bootstrap = new ServerBootstrap();
            bootstrap.group(bossGroup, workerGroup)
                    .channel(NioServerSocketChannel.class)
                    .option(ChannelOption.SO_BACKLOG, 1024)
                    .childOption(ChannelOption.TCP_NODELAY, true)
                    .childHandler(new ChannelInitializer<SocketChannel>() {
                        @Override
                        protected void initChannel(SocketChannel ch) {
                            ChannelPipeline pipeline = ch.pipeline();
                            // HTTP 编解码
                            pipeline.addLast(new HttpServerCodec());
                            // HTTP 聚合器
                            pipeline.addLast(new HttpObjectAggregator(65536));
                            // WebSocket 协议升级
                            pipeline.addLast(new WebSocketServerProtocolHandler("/ws"));
                            // 自定义处理器
                            pipeline.addLast(new WebSocketHandler());
                        }
                    });

            ChannelFuture future = bootstrap.bind(8080).sync();
            log.info("WebSocket 服务启动成功, 端口: 8080");
            future.channel().closeFuture().sync();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            bossGroup.shutdownGracefully();
            workerGroup.shutdownGracefully();
        }
    }
}
```

```java
// 处理器：处理连接、消息、断开
@Slf4j
public class WebSocketHandler extends SimpleChannelInboundHandler<TextWebSocketFrame> {

    // 在线用户映射 (userId -> Channel)
    private static final Map<String, Channel> ONLINE_USERS = new ConcurrentHashMap<>();

    @Override
    public void handlerAdded(ChannelHandlerContext ctx) {
        // 新连接建立
        log.info("新连接: {}", ctx.channel().id());
    }

    @Override
    protected void channelRead0(ChannelHandlerContext ctx, TextWebSocketFrame msg) {
        String text = msg.text();
        JSONObject json = JSON.parseObject(text);
        String type = json.getString("type");

        switch (type) {
            case "AUTH":
                handleAuth(ctx, json);
                break;
            case "PONG":
                // 心跳回复
                break;
            case "MESSAGE":
                handleMessage(ctx, json);
                break;
            case "ACK":
                handleAck(ctx, json);
                break;
        }
    }

    @Override
    public void handlerRemoved(ChannelHandlerContext ctx) {
        // 连接断开，移除用户
        Channel channel = ctx.channel();
        ONLINE_USERS.entrySet().removeIf(entry -> entry.getValue() == channel);
        log.info("连接断开: {}", channel.id());
    }

    private void handleAuth(ChannelHandlerContext ctx, JSONObject json) {
        String userId = json.getString("userId");
        String token = json.getString("token");
        // 校验 token...
        ONLINE_USERS.put(userId, ctx.channel());
        ctx.channel().writeAndFlush(new TextWebSocketFrame(
                "{\"type\":\"AUTH\",\"status\":\"OK\"}"));
    }

    public static Channel getUserChannel(String userId) {
        return ONLINE_USERS.get(userId);
    }

    public static boolean isOnline(String userId) {
        return ONLINE_USERS.containsKey(userId);
    }
}
```

#### 接入方式对比

| 方式 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| **WebSocket** | 全双工、实时性强、长连接 | 需要协议升级、复杂网络环境可能被拦截 | 浏览器端 |
| **SSE** | 浏览器原生支持、自动重连 | 单向（服务端 -> 客户端） | 通知类 |
| **长轮询** | 兼容性好 | 延迟较高、浪费带宽 | 兼容老旧浏览器 |
| **TCP 长连接** | 效率最高、可控性强 | 需要自己实现协议 | 移动端 APP |

### 4.5 消息模型

```java
// 消息结构
@Data
public class PushMessage {
    private String msgId;           // 消息ID (唯一)
    private String fromUserId;      // 发送者
    private String toUserId;        // 接收者 (点对点)
    private String groupId;         // 群组ID (群发)
    private Boolean broadcast;      // 是否广播
    private String content;         // 消息内容
    private Integer msgType;        // 消息类型 (文本/图片/语音等)
    private Long timestamp;         // 时间戳
    private Integer priority;       // 优先级 (高/中/低)
    private Boolean needAck;        // 是否需要ACK
}

// 推送服务
@Service
public class PushService {

    @Autowired
    private UserStatusManager userStatusManager;
    @Autowired
    private OfflineMessageService offlineService;
    @Autowired
    private MessageQueueService messageQueueService;

    // 点对点推送
    public void sendToUser(PushMessage msg) {
        String userId = msg.getToUserId();
        Channel channel = WebSocketHandler.getUserChannel(userId);

        if (channel != null && channel.isActive()) {
            // 在线，直接推送
            channel.writeAndFlush(new TextWebSocketFrame(JSON.toJSONString(msg)));
        } else {
            // 离线，存储消息
            offlineService.storeOfflineMessage(userId, msg);
        }
    }

    // 群发推送
    public void sendToGroup(PushMessage msg) {
        String groupId = msg.getGroupId();
        // 获取群成员列表
        Set<String> memberIds = groupMemberService.getMemberIds(groupId);
        // 推送到消息队列，批量分发
        for (String userId : memberIds) {
            PushMessage copy = msg.clone();
            copy.setToUserId(userId);
            messageQueueService.sendToQueue("push_single", copy);
        }
    }

    // 广播推送
    public void broadcast(PushMessage msg) {
        // 推送到所有在线用户
        for (Map.Entry<String, Channel> entry :
                WebSocketHandler.getOnlineUsers().entrySet()) {
            entry.getValue().writeAndFlush(
                    new TextWebSocketFrame(JSON.toJSONString(msg)));
        }
    }
}
```

### 4.6 消息可靠性（ACK + 重试 + 去重）

```
客户端 ──send──> 服务端
                 │
                 ├── 收到消息
                 ├── 存储消息
                 ├── 投递给目标
                 │
客户端 <──ack────┘
（若超时未收到 ack，服务端重试投递）
```

```java
// ACK 确认机制
@Component
public class MessageAckManager {

    @Autowired
    private RedisTemplate<String, String> redisTemplate;

    // 待确认消息队列
    private final ScheduledExecutorService scheduler =
            Executors.newScheduledThreadPool(4);

    // 发送消息后，注册 ACK 期待
    public void registerAck(PushMessage msg) {
        String ackKey = "msg:ack:" + msg.getMsgId();
        redisTemplate.opsForValue().set(ackKey, "pending", 30, TimeUnit.SECONDS);

        // 15秒后检查是否收到 ACK
        scheduler.schedule(() -> {
            String status = redisTemplate.opsForValue().get(ackKey);
            if ("pending".equals(status)) {
                // 未收到 ACK，重试
                retryPush(msg);
            }
        }, 15, TimeUnit.SECONDS);
    }

    // 客户端收到消息后回复 ACK
    public void handleAck(String msgId) {
        redisTemplate.opsForValue().set("msg:ack:" + msgId, "confirmed",
                1, TimeUnit.HOURS);
    }

    // 重试推送（最多重试 3 次）
    private void retryPush(PushMessage msg) {
        String retryKey = "msg:retry:" + msg.getMsgId();
        Integer count = (Integer) redisTemplate.opsForValue().get(retryKey);
        if (count == null) count = 0;

        if (count >= 3) {
            // 超过最大重试次数，标记为失败
            redisTemplate.opsForValue().set("msg:ack:" + msg.getMsgId(),
                    "failed", 7, TimeUnit.DAYS);
            return;
        }

        // 递增重试次数
        redisTemplate.opsForValue()
                .increment(retryKey, 1);
        redisTemplate.expire(retryKey, 1, TimeUnit.HOURS);

        // 重新投递
        Channel channel = WebSocketHandler.getUserChannel(msg.getToUserId());
        if (channel != null && channel.isActive()) {
            channel.writeAndFlush(
                    new TextWebSocketFrame(JSON.toJSONString(msg)));
        }
    }
}

// 消息去重（幂等性）
@Component
public class MessageDeduplicate {

    @Autowired
    private RedisTemplate<String, String> redisTemplate;

    // 使用消息ID去重
    public boolean isDuplicate(String msgId) {
        // 使用 setIfAbsent：如果 key 已存在返回 false
        Boolean notExist = redisTemplate.opsForValue()
                .setIfAbsent("msg:dedup:" + msgId, "1",
                        7, TimeUnit.DAYS);
        return Boolean.FALSE.equals(notExist);
    }
}
```

### 4.7 离线消息存储

```java
// 离线消息存储方案
@Component
public class OfflineMessageService {

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    @Autowired
    private MongoTemplate mongoTemplate;

    // 存储离线消息
    public void storeOfflineMessage(String userId, PushMessage msg) {
        // 1. 最新消息缓存到 Redis（最多 100 条）
        String redisKey = "offline:latest:" + userId;
        redisTemplate.opsForList().leftPush(redisKey, msg);
        redisTemplate.opsForList().trim(redisKey, 0, 99);
        redisTemplate.expire(redisKey, 7, TimeUnit.DAYS);

        // 2. 全量消息持久化到 MongoDB
        OfflineMessageEntity entity = new OfflineMessageEntity();
        entity.setUserId(userId);
        entity.setMsgId(msg.getMsgId());
        entity.setContent(JSON.toJSONString(msg));
        entity.setCreateTime(new Date());
        mongoTemplate.insert(entity);
    }

    // 用户上线后拉取离线消息
    public List<PushMessage> pullOfflineMessages(String userId, long lastPullTime) {
        // 从 MongoDB 查询 lastPullTime 之后的消息
        Query query = Query.query(
                Criteria.where("userId").is(userId)
                        .and("createTime").gt(new Date(lastPullTime))
        ).with(Sort.by(Sort.Direction.ASC, "createTime"))
         .limit(100);

        List<OfflineMessageEntity> entities =
                mongoTemplate.find(query, OfflineMessageEntity.class);

        return entities.stream()
                .map(e -> JSON.parseObject(e.getContent(), PushMessage.class))
                .collect(Collectors.toList());
    }
}
```

**离线消息存储方案对比：**

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| Redis List | 高性能，读取快 | 容量有限，无法海量 | 最新 N 条消息 |
| MongoDB | 容量大，查询灵活 | 延迟略高 | 全量消息存储 |
| MySQL | 事务支持好 | 写入性能有限 | 小型系统 |

### 4.8 高并发推送（Netty + MQ）

```java
// 消息分发架构
@Component
public class PushDispatcher {

    @Autowired
    private RocketMQTemplate rocketMQTemplate;

    // 接入层收到消息后，投递到 MQ
    public void dispatch(PushMessage msg) {
        // 根据消息类型分发到不同的 Topic
        String topic = "push_single";
        if (msg.getGroupId() != null) {
            topic = "push_group";
        } else if (msg.getBroadcast()) {
            topic = "push_broadcast";
        }
        rocketMQTemplate.send(topic, msg);
    }
}

// MQ 消费者：执行实际推送
@Component
@RocketMQMessageListener(topic = "push_single",
                          consumerGroup = "push-consumer")
public class PushConsumer implements RocketMQListener<PushMessage> {

    @Autowired
    private PushService pushService;
    @Autowired
    private MessageAckManager ackManager;

    @Override
    public void onMessage(PushMessage msg) {
        // 1. 去重检查
        if (duplicateChecker.isDuplicate(msg.getMsgId())) {
            return;
        }

        // 2. 获取用户连接
        Channel channel = UserChannelManager.get(msg.getToUserId());
        if (channel == null || !channel.isActive()) {
            // 用户不在线，存离线消息
            offlineService.store(msg.getToUserId(), msg);
            return;
        }

        // 3. 通过 Netty Channel 发送
        channel.writeAndFlush(new TextWebSocketFrame(JSON.toJSONString(msg)));

        // 4. 注册 ACK 等待
        if (msg.getNeedAck()) {
            ackManager.registerAck(msg);
        }
    }
}
```

**性能优化策略：**

1. **Channel 复用：** 每个连接对应一个 Channel，复用 EventLoop 处理
2. **内存池：** Netty 使用 PooledByteBufAllocator 减少 GC
3. **零拷贝：** 使用 FileRegion 发送文件
4. **写缓冲：** 高并发时使用 writeAndFlush 的批量写模式
5. **业务线程与 IO 线程分离：** IO 线程只处理编解码，业务逻辑提交到业务线程池

### 4.9 扩展性思考

1. **消息已读/未读：** 引入已读回执标记，群消息记录每个用户的已读位置
2. **消息漫游：** 多端登录时同步消息，使用版本号做增量同步
3. **推送通道分级：** 高优先级消息（如系统通知）使用独立的连接通道
4. **多协议适配：** 接入层支持 WebSocket、MQTT、TCP 多种协议
5. **流量控制：** 针对不同用户级别做差异化限流策略
6. **连接迁移：** 支持客户端断线重连后自动恢复消息订阅

***

## 题目5：设计一个配置中心

### 5.1 题目分析

**核心功能：**

* 配置管理：统一管理应用的各类配置（数据库、线程池、开关等）
* 动态刷新：配置修改后实时推送到客户端，无需重启
* 版本管理：配置变更历史可追溯，支持回滚
* 环境隔离：开发、测试、生产环境配置隔离

**非功能需求：**

* 高可用：配置中心不可用不影响已有应用的运行
* 一致性：所有客户端看到的配置是一致的
* 高性能：配置查询延迟 < 100ms
* 权限控制：不同环境/不同应用的配置访问控制

### 5.2 技术选型

| 组件 | 选型 | 作用 |
|------|------|------|
| 存储 | MySQL / Git (配置信息) | 配置数据持久化 |
| 缓存 | Redis | 加速配置查询 |
| 长轮询 | Servlet 3.0 AsyncContext | 推模式的替代方案 |
| 客户端 SDK | Java 注解 + 监听器 | 集成到业务应用 |
| 服务框架 | Spring Boot | API 服务 |

### 5.3 架构设计

```
                    ┌──────────────────────────────────┐
                    │           Config Admin UI        │
                    │     (配置管理后台 - Web界面)       │
                    └──────────────┬───────────────────┘
                                   │
                    ┌──────────────▼───────────────────┐
                    │         Config Service           │
                    │    ┌─────────────────────┐       │
                    │    │ 长轮询管理器         │       │
                    │    │ (维护客户端长连接)    │       │
                    │    └─────────────────────┘       │
                    │    ┌─────────────────────┐       │
                    │    │ 配置版本管理        │       │
                    │    │ (Git/DB双存储)      │       │
                    │    └─────────────────────┘       │
                    │    ┌─────────────────────┐       │
                    │    │ 权限校验模块        │       │
                    │    └─────────────────────┘       │
                    └──────────────┬───────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
              ┌─────▼────┐  ┌─────▼────┐  ┌─────▼────┐
              │  MySQL   │  │  Git     │  │  Redis   │
              │ (持久化)  │  │ (版本管理)│  │ (缓存)   │
              └──────────┘  └──────────┘  └──────────┘

                    ┌──────────────────────────────────┐
                    │       客户端应用 (多个实例)        │
                    │  ┌─────────────────────────────┐  │
                    │  │ Config Client SDK           │  │
                    │  │  ├ 本地缓存 (内存)           │  │
                    │  │  ├ 长轮询连接                │  │
                    │  │  ├ @RefreshScope 支持        │  │
                    │  │  └ 配置变更监听器            │  │
                    │  └─────────────────────────────┘  │
                    └──────────────────────────────────┘
```

### 5.4 拉模式 vs 推模式

#### 拉模式（轮询）

* 客户端每隔一段时间（如 30s）向服务端拉取配置
* 实现简单，但数据更新不及时，且有大量无效请求

#### 推模式（长轮询实现）

```
客户端 -> 服务端: 长轮询请求 (带 namespace + version)
服务端 -> 客户端: 超时返回 (30s) 或 配置变更时立即返回
客户端 -> 服务端: 收到变更，拉取最新配置
客户端 -> 服务端: 发起下一次长轮询
```

```java
// 服务端长轮询实现
@RestController
public class ConfigPollingController {

    @Autowired
    private ConfigService configService;

    // 长轮询：客户端等待配置变更
    @RequestMapping("/config/listener")
    public DeferredResult<String> listen(
            @RequestParam String namespace,
            @RequestParam String appId,
            @RequestParam long version,
            HttpServletRequest request) {

        // 超时时间 30 秒
        DeferredResult<String> deferredResult =
                new DeferredResult<>(30_000L, "{\"status\":\"timeout\"}");

        // 先检查当前版本是否已变更
        long latestVersion = configService.getLatestVersion(namespace, appId);
        if (latestVersion > version) {
            deferredResult.setResult("{\"status\":\"changed\",\"version\":" + latestVersion + "}");
            return deferredResult;
        }

        // 注册到长轮询管理器（配置变更时触发回调）
        PollingHolder.add(namespace, appId, version, deferredResult);

        // 请求完成时清理
        deferredResult.onCompletion(() ->
                PollingHolder.remove(namespace, appId, deferredResult));

        return deferredResult;
    }
}

// 长轮询管理器
@Component
public class PollingHolder {

    // namespace -> appId -> List<DeferredResult>
    private static final Map<String, Map<String, List<DeferredResult<String>>>>
            HOLDER = new ConcurrentHashMap<>();

    public static synchronized void add(
            String namespace, String appId, long version,
            DeferredResult<String> result) {
        HOLDER.computeIfAbsent(namespace, k -> new ConcurrentHashMap<>())
              .computeIfAbsent(appId, k -> new CopyOnWriteArrayList<>())
              .add(result);
    }

    public static synchronized void remove(
            String namespace, String appId, DeferredResult<String> result) {
        Map<String, List<DeferredResult<String>>> map = HOLDER.get(namespace);
        if (map != null) {
            List<DeferredResult<String>> list = map.get(appId);
            if (list != null) {
                list.remove(result);
            }
        }
    }

    // 配置变更时，通知所有等待的客户端
    public static void notifyChange(String namespace, String appId, long newVersion) {
        Map<String, List<DeferredResult<String>>> map = HOLDER.get(namespace);
        if (map != null) {
            List<DeferredResult<String>> list = map.get(appId);
            if (list != null) {
                for (DeferredResult<String> result : list) {
                    result.setResult(
                            "{\"status\":\"changed\",\"version\":" + newVersion + "}");
                }
                list.clear();
            }
        }
    }
}
```

```java
// 配置发布时触发通知
@Service
public class ConfigPublishService {

    @Autowired
    private ConfigRepository configRepository;

    @Transactional
    public void publishConfig(String namespace, String appId,
                               String key, String value) {
        // 1. 保存新配置
        ConfigEntity entity = new ConfigEntity();
        entity.setNamespace(namespace);
        entity.setAppId(appId);
        entity.setConfigKey(key);
        entity.setConfigValue(value);
        entity.setVersion(getNextVersion(namespace, appId));
        configRepository.save(entity);

        // 2. 通知长轮询客户端
        long newVersion = entity.getVersion();
        PollingHolder.notifyChange(namespace, appId, newVersion);
    }
}
```

### 5.5 数据一致性（版本号 + CAS）

**问题：** 多个管理员同时修改同一配置，可能导致覆盖。

**解决方案：** 使用版本号 + CAS（Compare And Swap）机制。

```sql
-- 配置表
CREATE TABLE `tb_config` (
    `id`            BIGINT       NOT NULL AUTO_INCREMENT,
    `namespace`     VARCHAR(64)  NOT NULL COMMENT '命名空间',
    `app_id`        VARCHAR(64)  NOT NULL COMMENT '应用ID',
    `config_key`    VARCHAR(128) NOT NULL COMMENT '配置键',
    `config_value`  TEXT         NOT NULL COMMENT '配置值',
    `version`       INT          NOT NULL DEFAULT 1 COMMENT '版本号',
    `status`        TINYINT      NOT NULL DEFAULT 0 COMMENT '状态:0待发布1已发布',
    `created_by`    VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '创建者',
    `updated_by`    VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '修改者',
    `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_key` (`namespace`, `app_id`, `config_key`),
    KEY `idx_version` (`namespace`, `app_id`, `version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 配置变更历史表
CREATE TABLE `tb_config_history` (
    `id`            BIGINT       NOT NULL AUTO_INCREMENT,
    `config_id`     BIGINT       NOT NULL,
    `namespace`     VARCHAR(64)  NOT NULL,
    `app_id`        VARCHAR(64)  NOT NULL,
    `config_key`    VARCHAR(128) NOT NULL,
    `old_value`     TEXT         NOT NULL,
    `new_value`     TEXT         NOT NULL,
    `version`       INT          NOT NULL,
    `operator`      VARCHAR(64)  NOT NULL,
    `operate_type`  VARCHAR(16)  NOT NULL COMMENT 'UPDATE/ROLLBACK',
    `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_config_id` (`config_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

```java
// CAS 更新（乐观锁）
@Service
public class ConfigService {

    @Autowired
    private ConfigRepository configRepository;
    @Autowired
    private ConfigHistoryRepository historyRepository;

    @Transactional
    public boolean updateConfig(Long configId, String newValue,
                                 String operator, int expectedVersion) {
        // 1. 获取当前配置
        ConfigEntity entity = configRepository.findById(configId)
                .orElseThrow(() -> new RuntimeException("配置不存在"));

        // 2. 版本号检查（CAS）
        if (entity.getVersion() != expectedVersion) {
            return false;  // 版本冲突，更新失败
        }

        // 3. 保存历史
        ConfigHistoryEntity history = new ConfigHistoryEntity();
        history.setConfigId(configId);
        history.setNamespace(entity.getNamespace());
        history.setAppId(entity.getAppId());
        history.setConfigKey(entity.getConfigKey());
        history.setOldValue(entity.getConfigValue());
        history.setNewValue(newValue);
        history.setVersion(entity.getVersion());
        history.setOperator(operator);
        history.setOperateType("UPDATE");
        historyRepository.save(history);

        // 4. 更新配置（版本号 +1）
        int affected = configRepository.updateValueWithVersion(
                configId, newValue, entity.getVersion() + 1, expectedVersion);

        if (affected == 0) {
            throw new OptimisticLockException("配置已被其他人修改");
        }

        return true;
    }

    // 回滚到指定版本
    @Transactional
    public boolean rollback(Long configId, int targetVersion, String operator) {
        // 从历史表中获取目标版本的值
        ConfigHistoryEntity history =
                historyRepository.findByConfigIdAndVersion(configId, targetVersion);
        if (history == null) {
            return false;
        }

        // 使用当前版本作为期望版本进行 CAS 更新
        ConfigEntity entity = configRepository.findById(configId).orElse(null);
        if (entity == null) return false;

        return updateConfig(configId, history.getOldValue(), operator,
                entity.getVersion());
    }
}
```

### 5.6 多环境隔离（Namespace）

```
Namespace 设计：

                                  ┌──────────────┐
                                  │  Config Center│
                                  └──────┬───────┘
                                         │
          ┌──────────────────────────────┼──────────────────────────────┐
          │                              │                              │
  ┌───────▼───────┐             ┌────────▼────────┐           ┌───────▼───────┐
  │  dev          │             │  test            │           │  prod         │
  │  (开发环境)    │             │  (测试环境)      │           │  (生产环境)    │
  └───────┬───────┘             └────────┬────────┘           └───────┬───────┘
          │                              │                              │
  ┌───────▼───────┐             ┌────────▼────────┐           ┌───────▼───────┐
  │ app-a         │             │ app-a            │           │ app-a         │
  │ db.url=dev..  │             │ db.url=test..    │           │ db.url=prod.. │
  │ app.b=1       │             │ app.b=1          │           │ app.b=2       │
  └───────────────┘             └─────────────────┘           └───────────────┘
```

```java
// 多环境配置获取
@Service
public class ConfigQueryService {

    @Autowired
    private RedisTemplate<String, String> redisTemplate;
    @Autowired
    private ConfigRepository configRepository;

    public String getConfig(String namespace, String appId, String key) {
        // 1. 从 Redis 缓存查询
        String cacheKey = String.format("config:%s:%s:%s", namespace, appId, key);
        String value = redisTemplate.opsForValue().get(cacheKey);
        if (value != null) {
            return value;
        }

        // 2. 缓存未命中，查数据库
        ConfigEntity entity = configRepository
                .findByNamespaceAndAppIdAndKey(namespace, appId, key);
        if (entity == null) return null;

        // 3. 回填缓存
        redisTemplate.opsForValue().set(cacheKey, entity.getConfigValue(),
                10, TimeUnit.MINUTES);

        return entity.getConfigValue();
    }

    // 批量获取配置
    public Map<String, String> getConfigs(String namespace, String appId) {
        List<ConfigEntity> entities =
                configRepository.findByNamespaceAndAppId(namespace, appId);
        Map<String, String> result = new HashMap<>();
        for (ConfigEntity e : entities) {
            result.put(e.getConfigKey(), e.getConfigValue());
        }
        return result;
    }
}
```

### 5.7 Spring @RefreshScope 刷新原理

```java
// 客户端 SDK：配置自动刷新
@Component
public class ConfigClient {

    @Autowired
    private ConfigQueryService configService;

    private final ScheduledExecutorService scheduler =
            Executors.newSingleThreadScheduledExecutor();

    // 本地配置缓存
    private final Map<String, String> localCache = new ConcurrentHashMap<>();
    // 配置变更监听器
    private final List<ConfigChangeListener> listeners = new CopyOnWriteArrayList<>();

    @PostConstruct
    public void init() {
        // 初始化时加载配置到本地缓存
        Map<String, String> configs = configService.getConfigs("dev", "app-a");
        localCache.putAll(configs);

        // 启动长轮询线程
        startLongPolling();
    }

    private void startLongPolling() {
        scheduler.submit(() -> {
            while (true) {
                try {
                    // 发起长轮询
                    long currentVersion = getLocalVersion();
                    RestTemplate rest = new RestTemplate();
                    String result = rest.getForObject(
                            "http://config-center/config/listener?" +
                            "namespace=dev&appId=app-a&version=" + currentVersion,
                            String.class);

                    JSONObject json = JSON.parseObject(result);
                    if ("changed".equals(json.getString("status"))) {
                        // 配置有变更，拉取最新配置
                        refreshLocalCache();
                    }
                } catch (Exception e) {
                    try {
                        Thread.sleep(5000); // 出错后 5 秒重试
                    } catch (InterruptedException ex) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }
        });
    }

    public synchronized void refreshLocalCache() {
        // 获取最新配置
        Map<String, String> latest = configService.getConfigs("dev", "app-a");

        // 找出变更的配置项
        for (Map.Entry<String, String> entry : latest.entrySet()) {
            String oldValue = localCache.get(entry.getKey());
            if (!Objects.equals(oldValue, entry.getValue())) {
                // 触发变更事件
                fireChangeEvent(new ConfigChangeEvent(
                        entry.getKey(), oldValue, entry.getValue()));
            }
        }

        // 更新本地缓存
        localCache.clear();
        localCache.putAll(latest);
    }

    // 获取配置
    public String getConfig(String key) {
        return localCache.get(key);
    }
}

// Spring @RefreshScope 原理
/**
 * @RefreshScope 是 Spring Cloud 提供的注解，用于实现 Bean 的动态刷新。
 * 其核心原理如下：
 *
 * 1. @RefreshScope 标注的 Bean 会被封装为 ScopedProxy 代理对象
 * 2. 代理对象不从 Spring 容器直接获取 Bean，而是从 RefreshScope 缓存中获取
 * 3. 当配置刷新时，调用 ContextRefresher.refresh()
 * 4. refresh() 方法会清除 RefreshScope 缓存中所有 Bean
 * 5. 下次请求该 Bean 时，代理对象重新创建新的 Bean 实例
 * 6. 新的 Bean 实例会注入最新的配置值
 */
```

### 5.8 扩展性思考

1. **配置推送动态权重：** 支持灰度发布配置，先推送到一部分实例观察效果
2. **配置格式校验：** 支持 JSON Schema / YAML 校验，防止格式错误导致应用崩溃
3. **加密配置：** 敏感配置（密码、密钥）加密存储和传输，客户端解密
4. **配置回滚：** 支持一键回滚到任意历史版本，记录回滚操作
5. **配置导入导出：** 支持从文件导入配置，方便环境迁移
6. **监听回调：** 配置变更时支持自定义回调函数（如重启线程池）

***

## 题目6：设计一个日志系统

### 6.1 题目分析

**核心需求：**

* 采集：从成千上万台服务器采集日志
* 传输：可靠地将日志传输到中心存储
* 存储：海量日志存储，每天 TB 级别
* 查询：快速检索日志，支持全文搜索和聚合分析
* 告警：基于日志内容的实时告警

**非功能需求：**

* 实时性：日志产生到可查询延迟 < 10秒
* 可靠性：不能丢失日志
* 可扩展性：随业务增长水平扩展
* 成本：日志存储成本可控

**数据量估算：**

* 应用数：2000 个
* 每个应用平均日志量：100MB/天
* 总日志量：200GB/天
* 高峰时段：5 倍于平均值 => 1TB/天
* 存储周期：30 天 => 30TB

### 6.2 技术选型（ELK 体系）

| 层次 | 组件 | 作用 |
|------|------|------|
| 采集 | Filebeat / Logstash | 轻量级日志采集，支持多种输入源 |
| 缓冲 | Kafka | 削峰填谷，保证高可用和数据不丢失 |
| 解析 | Logstash | 日志格式解析、过滤、增强 |
| 存储 | Elasticsearch | 分布式搜索引擎，海量日志存储和检索 |
| 可视化 | Kibana | 日志查询、仪表盘和告警 |

### 6.3 架构设计

```
                    ┌─────────────────────────────────────────────┐
                    │           应用服务器集群 (2000+ 台)           │
                    │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐  │
                    │  │ App1 │ │ App2 │ │ App3 │ │ ... AppN │  │
                    │  └──┬───┘ └──┬───┘ └──┬───┘ └────┬─────┘  │
                    │     │        │        │          │         │
                    │  ┌──▼────────▼────────▼──────────▼─────┐  │
                    │  │        Filebeat (日志采集)          │  │
                    │  │  读取日志文件 -> 发送到 Kafka        │  │
                    │  └────────────────┬────────────────────┘  │
                    └───────────────────┼────────────────────────┘
                                        │
                   ┌────────────────────▼────────────────────┐
                   │        Kafka Cluster (3+ 节点)          │
                   │    Topic: app-log / nginx-log / db-log  │
                   │    分布式、持久化、高吞吐                 │
                   └────────────────────┬────────────────────┘
                                        │
              ┌─────────────────────────┼─────────────────────────┐
              │                         │                         │
      ┌───────▼─────────┐    ┌──────────▼──────────┐    ┌────────▼─────────┐
      │  Logstash (消费) │    │    Logstash (消费)   │    │  Logstash (消费)  │
      │  解析 -> 格式化  │    │   解析 -> 格式化     │    │  解析 -> 格式化   │
      │  写入 ES        │    │  写入 ES            │    │  写入 ES         │
      └───────┬─────────┘    └──────────┬──────────┘    └────────┬─────────┘
              │                         │                         │
              └─────────────────────────┼─────────────────────────┘
                                        │
                   ┌────────────────────▼────────────────────┐
                   │     Elasticsearch Cluster               │
                   │  ┌────────┐ ┌────────┐ ┌────────────┐  │
                   │  │ ES 1   │ │ ES 2   │ │ ... ES N   │  │
                   │  │ 分片 A  │ │ 分片 B  │ │ 分片 C     │  │
                   │  └────────┘ └────────┘ └────────────┘  │
                   └────────────────────┬────────────────────┘
                                        │
                   ┌────────────────────▼────────────────────┐
                   │          Kibana / Alert                 │
                   │  (查询 / 分析 / 可视化 / 告警)           │
                   └─────────────────────────────────────────┘
```

### 6.4 日志采集（Filebeat）

```yaml
# filebeat.yml 配置
filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /var/log/app/*.log
    # 多行日志合并（如 Java 异常栈）
    multiline:
      pattern: '^\['
      negate: true
      match: after
    # 添加自定义字段
    fields:
      app_id: "order-service"
      env: "prod"
    # 字段输出到顶层
    fields_under_root: true

  - type: log
    enabled: true
    paths:
      - /var/log/nginx/access.log
    fields:
      app_id: "nginx"
      log_type: "access"

# 输出到 Kafka
output.kafka:
  hosts: ["kafka1:9092", "kafka2:9092", "kafka3:9092"]
  topic: "app-log"
  partition.round_robin:
    reachable_only: true
  required_acks: 1
  compression: gzip
  max_message_bytes: 10485760  # 10MB

# 监控
monitoring:
  enabled: true
  elasticsearch:
    hosts: ["http://es-monitor:9200"]
```

### 6.5 传输缓冲（Kafka 削峰）

```java
// Kafka 日志生产者（Java 应用内直接发送到 Kafka）
@Component
public class LogProducer {

    @Autowired
    private KafkaTemplate<String, String> kafkaTemplate;

    // 异步发送日志，不阻塞业务线程
    public void sendLog(String appId, String level, String message,
                         Map<String, String> tags) {
        LogEvent event = new LogEvent();
        event.setAppId(appId);
        event.setLevel(level);
        event.setMessage(message);
        event.setTags(tags);
        event.setTimestamp(System.currentTimeMillis());
        event.setHost(getHostName());

        // 使用 partition key 保证同一应用的日志有序
        kafkaTemplate.send("app-log", appId, JSON.toJSONString(event));
    }

    // 批量发送（合并多个日志为一批，提高吞吐量）
    @Scheduled(fixedDelay = 100)  // 每 100ms 发送一批
    public void batchSend() {
        List<LogEvent> batch = buffer.drainTo(new ArrayList<>(1000));
        if (batch.isEmpty()) return;

        StringBuilder sb = new StringBuilder();
        for (LogEvent e : batch) {
            sb.append(JSON.toJSONString(e)).append("\n");
        }
        kafkaTemplate.send("app-log-batch", sb.toString());
    }

    private String getHostName() {
        try {
            return InetAddress.getLocalHost().getHostName();
        } catch (UnknownHostException e) {
            return "unknown";
        }
    }
}
```

**Kafka 配置建议：**

```properties
# Kafka 日志主题配置
# 分区数 = 消费节点数 * 2（方便扩缩容）
partitions=32
replication-factor=3
retention.ms=604800000  # 7天
compression.type=lz4

# 生产者配置
acks=1
linger.ms=20
batch.size=65536
buffer.memory=536870912  # 512MB
```

### 6.6 日志存储（Elasticsearch 分片设计）

```java
// Logstash 配置：解析和格式化日志
// logstash.conf
input {
    kafka {
        bootstrap_servers => "kafka:9092"
        topics => ["app-log"]
        consumer_threads => 4
        codec => json
    }
}

filter {
    # 解析 JSON
    json {
        source => "message"
    }

    # 解析时间戳
    date {
        match => ["timestamp", "UNIX_MS"]
        target => "@timestamp"
    }

    # 提取日志级别
    if [level] == "ERROR" {
        mutate {
            add_tag => ["error_log"]
        }
    }

    # 移除无用字段，减小索引大小
    mutate {
        remove_field => ["@version", "path", "host"]
    }
}

output {
    elasticsearch {
        hosts => ["http://es-cluster:9200"]
        # 按天索引，便于管理和清理
        index => "app-log-%{+YYYY.MM.dd}"
        # 按应用ID路由，同一应用的日志集中到同一分片
        routing => "%{appId}"
    }
}
```

```json
// Elasticsearch 索引模板
PUT _template/app-log-template
{
  "index_patterns": ["app-log-*"],
  "settings": {
    "number_of_shards": 5,
    "number_of_replicas": 1,
    "refresh_interval": "30s",
    "translog.durability": "async",
    "translog.sync_interval": "30s",
    "index.codec": "best_compression"
  },
  "mappings": {
    "properties": {
      "appId":       { "type": "keyword" },
      "level":       { "type": "keyword" },
      "message":     { "type": "text", "analyzer": "ik_max_word" },
      "host":        { "type": "keyword" },
      "timestamp":   { "type": "long" },
      "tags":        { "type": "object" },
      "@timestamp":  { "type": "date" }
    }
  }
}

// 生命周期管理 (ILM)
PUT _ilm/policy/app-log-policy
{
  "policy": {
    "phases": {
      "hot": {
        "min_age": "0ms",
        "actions": {
          "rollover": {
            "max_size": "50GB",
            "max_age": "1d"
          }
        }
      },
      "warm": {
        "min_age": "7d",
        "actions": {
          "forcemerge": {
            "max_num_segments": 1
          },
          "shrink": {
            "number_of_shards": 2
          }
        }
      },
      "cold": {
        "min_age": "15d",
        "actions": {
          "freeze": {}
        }
      },
      "delete": {
        "min_age": "30d",
        "actions": {
          "delete": {}
        }
      }
    }
  }
}
```

**分片设计建议：**

| 因素 | 建议 |
|------|------|
| 分片大小 | 每个分片 20-50GB |
| 分片数 | 每天索引 5-10 个分片（预估每天数据量 / 50GB） |
| 副本数 | 1 个副本（保证高可用） |
| 节点数 | 至少 3 个节点 |
| 内存 | 每个节点 32GB（ES 内存建议不超过 32GB） |

### 6.7 日志查询（Kibana + DSL）

```java
// ES 日志查询 API
@RestController
@RequestMapping("/api/logs")
public class LogQueryController {

    @Autowired
    private RestHighLevelClient esClient;

    @PostMapping("/search")
    public LogSearchResult search(@RequestBody LogSearchRequest request) {
        NativeSearchQueryBuilder queryBuilder = new NativeSearchQueryBuilder();

        // 1. 时间范围过滤
        queryBuilder.withQuery(QueryBuilders.boolQuery()
                .must(QueryBuilders.rangeQuery("@timestamp")
                        .gte(request.getStartTime())
                        .lte(request.getEndTime()))
                // 应用ID过滤
                .must(request.getAppId() != null ?
                        QueryBuilders.termQuery("appId", request.getAppId())
                        : QueryBuilders.matchAllQuery())
                // 日志级别过滤
                .must(request.getLevel() != null ?
                        QueryBuilders.termQuery("level", request.getLevel())
                        : QueryBuilders.matchAllQuery())
                // 全文搜索
                .must(request.getKeyword() != null ?
                        QueryBuilders.matchQuery("message", request.getKeyword())
                        : QueryBuilders.matchAllQuery())
        );

        // 2. 排序（按时间倒序）
        queryBuilder.withSort(SortBuilders.fieldSort("@timestamp").order(SortOrder.DESC));

        // 3. 分页
        queryBuilder.withPageable(PageRequest.of(
                request.getPageNo(), request.getPageSize()));

        // 4. 聚合统计（按级别统计日志数量）
        queryBuilder.addAggregation(
                AggregationBuilders.terms("level_count")
                        .field("level")
                        .size(10));

        // 执行查询
        SearchHits hits = elasticsearchTemplate.search(queryBuilder.build(), LogEvent.class);

        // 转换结果
        List<LogEvent> logs = hits.stream()
                .map(hit -> hit.getContent())
                .collect(Collectors.toList());

        return new LogSearchResult(logs, hits.getTotalHits());
    }

    // 聚合统计：按时间间隔统计日志量
    @GetMapping("/stats")
    public Map<String, Long> getTimeStats(String appId, long startTime, long endTime) {
        NativeSearchQuery query = new NativeSearchQueryBuilder()
                .withQuery(QueryBuilders.boolQuery()
                        .must(QueryBuilders.termQuery("appId", appId))
                        .must(QueryBuilders.rangeQuery("@timestamp")
                                .gte(startTime).lte(endTime)))
                .addAggregation(AggregationBuilders.dateHistogram("time_histogram")
                        .field("@timestamp")
                        .fixedInterval(DateHistogramInterval.minutes(5))
                        .format("yyyy-MM-dd HH:mm:ss"))
                .build();

        Aggregations aggregations = elasticsearchTemplate.search(query, LogEvent.class)
                .getAggregations();

        ParsedDateHistogram histogram =
                aggregations.get("time_histogram");

        Map<String, Long> result = new LinkedHashMap<>();
        for (Histogram.Bucket bucket : histogram.getBuckets()) {
            result.put(bucket.getKeyAsString(), bucket.getDocCount());
        }
        return result;
    }
}
```

### 6.8 海量日志处理策略（每天 TB 级别）

#### 1. 日志采样

```properties
# 不同级别不同采样率
log.sampling.rate.INFO=0.1     # 10% 采样
log.sampling.rate.WARN=0.5     # 50%
log.sampling.rate.ERROR=1.0    # 100%
```

#### 2. 冷热分离

```
热存储 (SSD，7天):   app-log-2026.06.15 ~ 2026.06.22
温存储 (HDD，15天):  app-log-2026.06.08 ~ 2026.06.14
冷存储 (归档，30天): app-log-2026.05.23 ~ 2026.06.07
```

#### 3. 索引压缩

```json
{
  "settings": {
    "index.codec": "best_compression",  // 比默认压缩率高 30-50%
    "index.refresh_interval": "30s"     // 降低刷新频率，提高写入性能
  }
}
```

#### 4. 写入优化

```properties
# ES 配置优化
thread_pool.write.queue_size=2000
thread_pool.search.queue_size=1000

# 批量写入
bulk.size=5000      # 每批 5000 条
bulk.flush_interval=5s  # 最长等待 5 秒

# 禁用一些不必要的功能
index.number_of_routing_shards=30
index.translog.durability=async
index.translog.sync_interval=30s
```

### 6.9 日志告警

```java
// 基于 ES 的日志告警
@Component
public class LogAlertService {

    @Autowired
    private RestHighLevelClient esClient;

    @Scheduled(fixedRate = 60_000)  // 每分钟检查一次
    public void checkErrorAlert() {
        try {
            // 查询最近 5 分钟的 ERROR 日志
            long now = System.currentTimeMillis();
            SearchRequest request = new SearchRequest("app-log-*");
            SearchSourceBuilder source = new SearchSourceBuilder();
            source.query(QueryBuilders.boolQuery()
                    .must(QueryBuilders.termQuery("level", "ERROR"))
                    .must(QueryBuilders.rangeQuery("@timestamp")
                            .gte(now - 5 * 60 * 1000)
                            .lte(now)));
            // 按应用分组统计
            source.aggregation(AggregationBuilders.terms("by_app")
                    .field("appId")
                    .size(100));

            request.source(source);
            SearchResponse response = esClient.search(request, RequestOptions.DEFAULT);

            // 解析聚合结果
            Terms byApp = response.getAggregations().get("by_app");
            for (Terms.Bucket bucket : byApp.getBuckets()) {
                long count = bucket.getDocCount();
                String appId = bucket.getKeyAsString();

                // 超过阈值触发告警
                if (count > getThreshold(appId)) {
                    sendAlert(appId, count, getThreshold(appId));
                }
            }
        } catch (IOException e) {
            log.error("告警检查失败", e);
        }
    }

    private long getThreshold(String appId) {
        // 每个应用的告警阈值（可以从配置中心读取）
        return 100;  // 5分钟内 100 条 ERROR 日志触发告警
    }

    private void sendAlert(String appId, long actualCount, long threshold) {
        // 发送告警通知（短信/邮件/钉钉）
        AlertMessage alert = new AlertMessage();
        alert.setTitle("日志告警: " + appId);
        alert.setContent(String.format(
                "最近5分钟 %s 产生 %d 条ERROR日志，超过阈值 %d",
                appId, actualCount, threshold));
        alert.setLevel("CRITICAL");
        alertService.send(alert);
    }
}
```

### 6.10 扩展性思考

1. **实时计算平台：** 结合 Flink/Spark Streaming 对日志做实时流处理（如实时监控、实时聚合）
2. **日志链路追踪：** 微服务场景配合 TraceId，串联完整的调用链日志
3. **智能异常检测：** 基于机器学习的日志模式分析，自动发现异常行为
4. **日志脱敏：** 自动识别并脱敏敏感信息（身份证、手机号、银行卡号）
5. **多租户隔离：** 不同业务的日志使用独立的 ES 集群或索引前缀

***

## 题目7：设计一个分布式定时任务系统

### 7.1 题目分析

**核心需求：**

* 任务调度：在指定时间点或时间间隔执行任务
* 任务分片：大数据量的任务可以拆分到多台机器并行执行
* 故障转移：某台执行器宕机时，任务自动转移到其他机器
* 任务追踪：记录每次任务的执行状态和结果
* 避免重复：确保同一任务同一时刻只被一个执行器执行一次

**非功能需求：**

* 高可用：调度中心无单点
* 可扩展：支持每天千万级任务调度
* 精确性：调度误差 < 1秒
* 弹性：执行器可动态增减

### 7.2 技术选型

| 组件 | 选型 | 作用 |
|------|------|------|
| 调度中心 | 独立服务（Spring Boot） | 任务管理、调度、监控 |
| 执行器 | 嵌入业务应用 | 执行实际任务逻辑 |
| 注册中心 | Redis / ZK / Nacos | 执行器注册与发现 |
| 任务存储 | MySQL | 任务定义、执行记录 |
| 分布式锁 | Redis Redisson / MySQL 乐观锁 | 防止任务重复执行 |
| 触发机制 | Quartz / 时间轮 | 时间调度核心 |

### 7.3 架构设计（XXL-Job 模式）

```
                    ┌────────────────────────────────────────────┐
                    │            调度中心 (Scheduler)             │
                    │  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
                    │  │ 任务管理  │  │ 调度触发  │  │ 监控中心 │ │
                    │  └──────────┘  └──────────┘  └─────────┘ │
                    │  ┌──────────────────────────────────────┐ │
                    │  │   调度线程池 (ThreadPool)             │ │
                    │  │   时间轮 + 触发队列                   │ │
                    │  └──────────────────────────────────────┘ │
                    └──────────────┬───────────────────────────┘
                                   │
                    ┌──────────────┼───────────────────────────┐
                    │     ┌────────▼────────┐                   │
                    │     │ 注册中心 (Redis) │                   │
                    │     │ 执行器心跳检测   │                   │
                    │     └────────┬────────┘                   │
                    │              │                            │
                    │     ┌────────┴────────┐                   │
                    │     │   任务路由      │                   │
                    │     │  (一致性哈希)   │                   │
                    │     └────────┬────────┘                   │
                    └──────────────┼───────────────────────────┘
                                   │
              ┌────────────────────┼────────────────────────────┐
              │                    │                             │
      ┌───────▼───────┐    ┌──────▼──────┐           ┌─────────▼───────┐
      │ 执行器 (App1)  │    │ 执行器(App2) │           │ 执行器 (AppN)  │
      │ JobHandler A   │    │ JobHandler A│           │  JobHandler A  │
      │ JobHandler B   │    │ JobHandler B│           │  JobHandler B  │
      └───────────────┘    └─────────────┘           └─────────────────┘
```

### 7.4 任务分解模型（Job -> Task -> Shard）

```java
// 任务定义
@Data
public class JobInfo {
    private Long id;                // 任务ID
    private String jobName;         // 任务名称
    private String cronExpr;        // Cron 表达式
    private String handlerClass;    // 执行器类名
    private String param;           // 任务参数 (JSON)
    private Integer shardCount;     // 分片数量
    private String strategy;        // 路由策略 (轮询/一致性哈希/广播)
    private Integer status;         // 状态 (0暂停/1启用)
    private Long nextTriggerTime;   // 下次触发时间
}

// 任务实例（一次执行）
@Data
public class JobInstance {
    private Long id;
    private Long jobId;
    private Long triggerTime;       // 触发时间
    private Integer status;         // 状态 (0待执行/1运行中/2成功/3失败)
    private String executorHost;    // 执行器主机
    private Integer shardIndex;     // 当前分片索引 (0 ~ shardCount-1)
    private Integer shardTotal;     // 总分片数
    private Long startTime;
    private Long endTime;
    private String result;          // 执行结果
}

// 执行日志
@Data
public class JobLog {
    private Long id;
    private Long instanceId;
    private Long jobId;
    private Integer shardIndex;
    private String content;         // 日志内容
    private Date logTime;
}
```

```sql
-- 任务定义表
CREATE TABLE `tb_job_info` (
    `id`              BIGINT       NOT NULL AUTO_INCREMENT,
    `job_name`        VARCHAR(128) NOT NULL COMMENT '任务名称',
    `job_desc`        VARCHAR(256) NOT NULL DEFAULT '' COMMENT '任务描述',
    `cron_expr`       VARCHAR(64)  NOT NULL COMMENT 'Cron表达式',
    `handler_class`   VARCHAR(256) NOT NULL COMMENT '执行器类全路径',
    `handler_param`   TEXT         NOT NULL COMMENT '执行参数',
    `shard_count`     INT          NOT NULL DEFAULT 1 COMMENT '分片数量',
    `route_strategy`  VARCHAR(32)  NOT NULL DEFAULT 'ROUND' COMMENT '路由策略',
    `status`          TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:0暂停1启用',
    `next_trigger_time` BIGINT     NOT NULL DEFAULT 0 COMMENT '下次触发时间',
    `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_status` (`status`, `next_trigger_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 任务实例表
CREATE TABLE `tb_job_instance` (
    `id`              BIGINT       NOT NULL AUTO_INCREMENT,
    `job_id`          BIGINT       NOT NULL COMMENT '任务ID',
    `trigger_time`    BIGINT       NOT NULL COMMENT '触发时间戳',
    `status`          TINYINT      NOT NULL DEFAULT 0 COMMENT '状态:0待执行1运行中2成功3失败',
    `executor_host`   VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '执行器地址',
    `shard_index`     INT          NOT NULL DEFAULT 0 COMMENT '分片索引',
    `shard_total`     INT          NOT NULL DEFAULT 1 COMMENT '总分片数',
    `start_time`      DATETIME     NULL COMMENT '开始时间',
    `end_time`        DATETIME     NULL COMMENT '结束时间',
    `result`          TEXT         NULL COMMENT '执行结果',
    `version`         INT          NOT NULL DEFAULT 1 COMMENT '乐观锁版本',
    `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_job_id` (`job_id`, `trigger_time`),
    KEY `idx_status` (`status`, `executor_host`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 7.5 调度中心核心实现

```java
// 调度器：时间轮 + 数据库轮询
@Component
public class JobScheduler {

    @Autowired
    private JobInfoMapper jobInfoMapper;
    @Autowired
    private JobInstanceMapper instanceMapper;
    @Autowired
    private ExecutorRouter executorRouter;

    private final ScheduledExecutorService scheduler =
            Executors.newScheduledThreadPool(4);

    private static final long SLOT_MS = 1000;  // 时间轮槽位 1 秒

    @PostConstruct
    public void init() {
        // 每 1 秒检查一次待触发的任务
        scheduler.scheduleAtFixedRate(this::triggerJobs, 0, 1, TimeUnit.SECONDS);
    }

    public void triggerJobs() {
        long now = System.currentTimeMillis();
        // 查询当前秒需要触发的任务（使用乐观锁防止重复调度）
        List<JobInfo> jobs = jobInfoMapper.findByNextTriggerTime(now, 100);

        for (JobInfo job : jobs) {
            int updated = jobInfoMapper.compareAndSetNextTime(job.getId(),
                    job.getNextTriggerTime(), calculateNextTriggerTime(job));
            if (updated == 0) {
                continue;  // 被其他调度器抢占了
            }

            // 根据分片数量创建任务实例
            int shardCount = job.getShardCount();
            for (int i = 0; i < shardCount; i++) {
                // 路由到合适的执行器
                String executorHost = executorRouter.route(job, i);

                // 创建任务实例
                JobInstance instance = new JobInstance();
                instance.setJobId(job.getId());
                instance.setTriggerTime(now);
                instance.setStatus(0);  // 待执行
                instance.setExecutorHost(executorHost);
                instance.setShardIndex(i);
                instance.setShardTotal(shardCount);
                instanceMapper.insert(instance);

                // 发送调度命令到执行器
                sendToExecutor(executorHost, instance);
            }
        }
    }

    private void sendToExecutor(String host, JobInstance instance) {
        // 通过 HTTP / gRPC 发送调度请求到执行器
        RestTemplate rest = new RestTemplate();
        String url = "http://" + host + "/api/job/execute";
        rest.postForEntity(url, instance, String.class);
    }

    private long calculateNextTriggerTime(JobInfo job) {
        // 根据 Cron 表达式计算下次触发时间
        CronExpression cron = new CronExpression(job.getCronExpr());
        return cron.getNextValidTimeAfter(new Date()).getTime();
    }
}
```

### 7.6 执行器核心实现

```java
// 执行器注解标记
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Component
public @interface JobHandler {
    String value();  // Handler 名称
}

// 执行器接口
public interface JobProcessor {
    JobResult execute(String param, int shardIndex, int shardTotal);
}

// 执行器注册与调度端点
@RestController
@RequestMapping("/api/job")
public class ExecutorController {

    // 处理器注册中心
    private static final Map<String, JobProcessor> HANDLERS = new HashMap<>();

    public static void registerHandler(String name, JobProcessor processor) {
        HANDLERS.put(name, processor);
    }

    @PostMapping("/execute")
    public ResponseEntity<String> execute(@RequestBody JobInstance instance) {
        // 1. 查询任务定义
        JobInfo jobInfo = jobInfoMapper.selectById(instance.getJobId());

        // 2. 获取处理器
        JobProcessor processor = HANDLERS.get(jobInfo.getHandlerClass());
        if (processor == null) {
            return ResponseEntity.badRequest().body("处理器不存在");
        }

        // 3. 创建执行线程
        CompletableFuture.supplyAsync(() -> {
            try {
                // 更新状态为运行中
                instanceMapper.updateStatus(instance.getId(), 1);

                // 执行任务
                JobResult result = processor.execute(
                        jobInfo.getHandlerParam(),
                        instance.getShardIndex(),
                        instance.getShardTotal()
                );

                // 更新状态为完成
                instanceMapper.updateResult(instance.getId(), 2,
                        JSON.toJSONString(result));
                return result;
            } catch (Exception e) {
                // 更新状态为失败
                instanceMapper.updateResult(instance.getId(), 3, e.getMessage());
                throw new RuntimeException(e);
            }
        }, executorThreadPool);

        return ResponseEntity.ok("已接收");
    }
}

// 示例 JobHandler
@JobHandler("orderStatisticsJob")
public class OrderStatisticsJob implements JobProcessor {

    @Autowired
    private OrderService orderService;

    @Override
    public JobResult execute(String param, int shardIndex, int shardTotal) {
        // 解析参数
        JSONObject json = JSON.parseObject(param);
        String date = json.getString("date");

        // 分片处理：只处理本分片负责的商家
        List<String> merchantIds = orderService.getShardMerchantIds(
                shardIndex, shardTotal);

        int successCount = 0;
        int failCount = 0;

        for (String merchantId : merchantIds) {
            try {
                orderService.calcDailyStatistics(merchantId, date);
                successCount++;
            } catch (Exception e) {
                log.error("商家 {} 统计失败: {}", merchantId, e.getMessage());
                failCount++;
            }
        }

        return JobResult.success(
                String.format("成功: %d, 失败: %d", successCount, failCount));
    }
}
```

### 7.7 任务分片策略（一致性哈希）

```java
@Component
public class ExecutorRouter {

    @Autowired
    private RedisTemplate<String, String> redisTemplate;

    // 一致性哈希环
    private final ConsistentHashRouter<String> router =
            new ConsistentHashRouter<>(100, 160);  // 160 个虚拟节点

    @PostConstruct
    public void init() {
        // 从注册中心加载执行器列表
        refreshExecutors();
    }

    @Scheduled(fixedRate = 10_000)  // 每 10 秒刷新一次
    public void refreshExecutors() {
        Set<String> executors = redisTemplate.opsForSet()
                .members("job:executors");
        router.resetNodes(executors);
    }

    public String route(JobInfo job, int shardIndex) {
        // 路由键 = jobId + ":" + shardIndex
        String routeKey = job.getId() + ":" + shardIndex;
        return router.route(routeKey);
    }
}

// 一致性哈希路由实现
public class ConsistentHashRouter<T> {
    private final TreeMap<Integer, T> circle = new TreeMap<>();
    private final int virtualNodeCount;
    private final int replicas;  // 每个物理节点的虚拟节点数

    public ConsistentHashRouter(int virtualNodeCount, int replicas) {
        this.virtualNodeCount = virtualNodeCount;
        this.replicas = replicas;
    }

    public void resetNodes(Set<T> nodes) {
        circle.clear();
        for (T node : nodes) {
            addNode(node);
        }
    }

    private void addNode(T node) {
        for (int i = 0; i < replicas; i++) {
            int hash = hash(node.toString() + "#" + i);
            circle.put(hash, node);
        }
    }

    public T route(String key) {
        if (circle.isEmpty()) {
            return null;
        }
        int hash = hash(key);
        // 查找第一个 hash >= key 的节点
        Map.Entry<Integer, T> entry = circle.ceilingEntry(hash);
        if (entry == null) {
            // 如果找不到，取第一个节点（环形）
            entry = circle.firstEntry();
        }
        return entry.getValue();
    }

    private int hash(String key) {
        // 使用一致性哈希专用哈希函数（如 FNV1_32_HASH）
        final int p = 16777619;
        int hash = (int) 2166136261L;
        for (byte b : key.getBytes(StandardCharsets.UTF_8)) {
            hash = (hash ^ b) * p;
        }
        hash += hash << 13;
        hash ^= hash >> 7;
        hash += hash << 3;
        hash ^= hash >> 17;
        hash += hash << 5;
        return hash & Integer.MAX_VALUE;
    }
}
```

### 7.8 避免任务重复执行

```java
// 1. 数据库乐观锁（调度时使用）
// 在调度中心的 triggerJobs() 中已经使用了
// compareAndSetNextTime 方法

// 2. 分布式锁（执行前获取）
@Service
public class JobExecutorService {

    @Autowired
    private RedissonClient redissonClient;
    @Autowired
    private JobInstanceMapper instanceMapper;

    public boolean executeJobInstance(JobInstance instance) {
        // 获取分布式锁（锁粒度：jobId + shardIndex）
        String lockKey = "job:lock:" + instance.getJobId()
                + ":" + instance.getShardIndex();
        RLock lock = redissonClient.getLock(lockKey);

        try {
            // 尝试获取锁，等 3 秒，锁 30 秒自动释放
            boolean locked = lock.tryLock(3, 30, TimeUnit.SECONDS);
            if (!locked) {
                log.warn("获取任务锁失败: jobId={}, shardIndex={}",
                        instance.getJobId(), instance.getShardIndex());
                return false;
            }

            // 再次检查任务状态（防止已经执行）
            JobInstance current = instanceMapper.selectById(instance.getId());
            if (current.getStatus() != 0) {
                log.warn("任务已执行，跳过: {}", instance.getId());
                return true;
            }

            // 更新状态为运行中（使用乐观锁）
            int updated = instanceMapper.updateStatusByVersion(
                    instance.getId(), 0, 1);
            if (updated == 0) {
                log.warn("任务已被其他执行器抢占");
                return false;
            }

            // 执行实际任务
            doExecute(instance);
            return true;

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        } finally {
            lock.unlock();
        }
    }

    private void doExecute(JobInstance instance) {
        // 实际执行...
    }
}
```

### 7.9 故障转移（Failover）

```java
// 执行器心跳检测 + 自动迁移
@Component
public class ExecutorHealthChecker {

    @Autowired
    private RedisTemplate<String, String> redisTemplate;
    @Autowired
    private JobInstanceMapper instanceMapper;

    private static final String HEARTBEAT_PREFIX = "job:heartbeat:";

    @Scheduled(fixedRate = 30_000)  // 每 30 秒检查一次
    public void checkAndFailover() {
        // 查询所有运行中状态的任务
        List<JobInstance> runningInstances =
                instanceMapper.findByStatus(1);  // 1=运行中

        for (JobInstance instance : runningInstances) {
            String heartbeatKey = HEARTBEAT_PREFIX + instance.getExecutorHost();
            String heartbeat = redisTemplate.opsForValue().get(heartbeatKey);

            if (heartbeat == null) {
                // 执行器已宕机（超过 30 秒没有心跳）
                // 标记当前实例为失败
                instanceMapper.updateStatus(instance.getId(), 3);
                instanceMapper.updateResult(instance.getId(),
                        "执行器宕机，任务迁移");

                // 创建新实例，路由到其他执行器
                JobInstance newInstance = new JobInstance();
                newInstance.setJobId(instance.getJobId());
                newInstance.setTriggerTime(System.currentTimeMillis());
                newInstance.setStatus(0);
                newInstance.setShardIndex(instance.getShardIndex());
                newInstance.setShardTotal(instance.getShardTotal());
                // 重新路由
                newInstance.setExecutorHost(
                        reRoute(instance.getJobId(), instance.getShardIndex()));
                instanceMapper.insert(newInstance);

                log.info("任务迁移: jobId={}, shard={}, from={} to={}",
                        instance.getJobId(), instance.getShardIndex(),
                        instance.getExecutorHost(),
                        newInstance.getExecutorHost());
            }
        }
    }
}

// 执行器心跳发送
@Component
public class ExecutorHeartbeat {

    @Autowired
    private RedisTemplate<String, String> redisTemplate;

    @Value("${server.host}")
    private String host;

    @Scheduled(fixedRate = 10_000)  // 每 10 秒发送一次心跳
    public void sendHeartbeat() {
        redisTemplate.opsForValue().set(
                "job:heartbeat:" + host,
                String.valueOf(System.currentTimeMillis()),
                30, TimeUnit.SECONDS);
    }
}
```

### 7.10 XXL-Job / Elastic-Job 架构分析

#### XXL-Job 架构

```
调度中心 (Schedule Center)      执行器 (Executor)
┌─────────────────────┐        ┌──────────────────────┐
│ 1. 管理任务定义       │        │ 1. 注册到调度中心      │
│ 2. 触发任务调度       │━━━━━━━▶│ 2. 接收调度请求        │
│ 3. 监控执行状态       │  HTTP  │ 3. 执行任务Handler     │
│ 4. 任务日志查看       │◀━━━━━━━│ 4. 回调执行结果        │
│ 5. 告警通知          │        │ 5. 维护心跳           │
└─────────────────────┘        └──────────────────────┘
```

**XXL-Job 核心特点：**

* 调度中心与执行器分离
* 支持 Cron、固定间隔、API 触发
* 路由策略：轮询、随机、一致性哈希、故障转移、忙碌转移
* 任务分片：广播模式
* 失败处理策略：失败转移、调度过期策略
* 阻塞处理策略：单机串行、丢弃后续调度、覆盖之前调度

#### Elastic-Job 架构

```
┌──────────────────────────────────────────────┐
│  Zookeeper / Etcd (注册中心)                  │
│  - 任务注册、分片信息、执行器状态              │
│  - 选主、监听变化                            │
└────────────────────┬─────────────────────────┘
                     │
                     │
┌────────────────────┼─────────────────────────┐
│       ┌────────────┴────────────┐             │
│       │       执行器集群         │             │
│       │  ┌──────┐ ┌──────┐ ┌───┴───┐        │
│       │  │ Node1│ │Node2 │ │ NodeN │        │
│       │  └──────┘ └──────┘ └───────┘        │
│       │  (通过 ZK 协调分片分配)              │
│       └─────────────────────────────────────┘
└──────────────────────────────────────────────┘
```

**Elastic-Job 核心特点：**

* 无调度中心，通过 ZK 实现去中心化
* 任务分片自动协商（选举主节点进行分片分配）
* 弹性伸缩：执行器增减时自动重新分片
* 支持任务依赖、任务监听
* 支持 Spring 命名空间配置

**两者对比：**

| 特性 | XXL-Job | Elastic-Job |
|------|---------|-------------|
| 架构 | 中心化（调度中心 + 执行器） | 去中心化（基于 ZK） |
| 依赖 | MySQL | ZK/Etcd |
| 分片 | 广播模式 + 手动指定 | 自动分片协商 |
| 路由策略 | 多种内置策略 | 分片为主 |
| 运维 | Web 管理界面丰富 | 依赖 ZK 运维 |
| 学习成本 | 较低 | 较高 |
| 动态扩容 | 需手动调整分片 | 自动分片再平衡 |

### 7.11 扩展性思考

1. **工作流引擎：** 支持 DAG 任务依赖，一个任务执行完成后自动触发下游任务
2. **动态分片：** 根据历史执行耗时动态调整分片大小
3. **任务幂等：** 可重入任务设计，保证重复执行结果一致
4. **执行记录压缩：** 对于高频任务，批量合并执行记录减少存储
5. **任务预热：** 大任务执行前预加载数据到缓存
6. **调度时间精度：** 高精度场景使用时间轮 + 网络时间协议（NTP）
7. **资源隔离：** 不同类型任务使用独立的线程池，避免互相影响

***

## 总结

以上 7 道系统设计题目覆盖了分布式系统设计的核心场景：

| 题目 | 核心难点 | 关键组件 | 设计重点 |
|------|---------|---------|---------|
| 短链接系统 | 唯一ID生成、高并发跳转 | 雪花算法、BloomFilter、Redis | 读多写少，缓存先行 |
| 秒杀系统 | 瞬时高并发、超卖、一致性 | Redis Lua、MQ、乐观锁 | 多级限流，逐层过滤 |
| 分布式ID生成 | 全局唯一、趋势递增、时钟回拨 | 雪花算法、号段模式 | 无状态、高性能 |
| 消息推送系统 | 海量连接、消息可靠性、离线 | Netty、WebSocket、MQ | 连接管理、消息确认 |
| 配置中心 | 实时推送、一致性、多环境 | 长轮询、CAS、Git | 推拉结合，版本控制 |
| 日志系统 | 海量数据、实时性、检索 | ELK、Kafka | 分层处理，冷热分离 |
| 定时任务 | 分片执行、故障转移、防重复 | 一致性哈希、分布式锁 | 调度与执行分离 |

**系统设计的核心原则：**

1. **缓存优先：** 读多写少的场景先用缓存扛流量
2. **异步处理：** 耗时操作通过 MQ 异步化，削峰填谷
3. **逐层过滤：** 请求经过 CDN -> Nginx -> 应用 -> 缓存 -> DB，层层拦截
4. **最终一致性：** 高并发场景下不追求强一致，用补偿机制保证最终一致
5. **幂等设计：** 所有关键操作都要支持幂等，防止重复处理
6. **限流降级：** 保护系统不被突发流量打垮
7. **无状态设计：** 应用层无状态，方便水平扩缩容
