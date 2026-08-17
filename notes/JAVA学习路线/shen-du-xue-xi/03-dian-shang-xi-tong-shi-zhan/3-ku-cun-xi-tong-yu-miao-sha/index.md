---
url: >-
  /my_notes/notes/JAVA学习路线/shen-du-xue-xi/03-dian-shang-xi-tong-shi-zhan/3-ku-cun-xi-tong-yu-miao-sha/index.md
---
# 电商实战：库存系统与秒杀

> 本文档覆盖电商库存核心模型设计、并发扣减策略、Redis 库存数据结构、秒杀系统完整架构与防超卖设计，配套生产级代码实现。

***

## 1. 库存模型设计

### 1.1 库存表结构

库存模型以 SKU（Stock Keeping Unit，库存量单位）为核心，每款商品的不同规格（颜色、尺寸等）对应一个 SKU。

```sql
CREATE TABLE `sku_stock` (
    `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    `sku_id`          BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
    `spu_id`          BIGINT UNSIGNED NOT NULL COMMENT 'SPU ID',
    `total_stock`     INT             NOT NULL DEFAULT 0 COMMENT '总库存（采购入库总量）',
    `locked_stock`    INT             NOT NULL DEFAULT 0 COMMENT '锁定库存（已下单未支付的占用）',
    `available_stock` INT             NOT NULL DEFAULT 0 COMMENT '可用库存（可销售数量）',
    `sold_stock`      INT             NOT NULL DEFAULT 0 COMMENT '已售数量',
    `frozen_stock`    INT             NOT NULL DEFAULT 0 COMMENT '冻结库存（售后/预留）',
    `warehouse_id`    BIGINT UNSIGNED DEFAULT NULL COMMENT '仓库ID',
    `version`         INT             NOT NULL DEFAULT 0 COMMENT '乐观锁版本号',
    `status`          TINYINT         NOT NULL DEFAULT 1 COMMENT '状态：1-正常 2-停售',
    `create_time`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE KEY `uk_sku_id` (`sku_id`) USING BTREE,
    KEY `idx_spu_id` (`spu_id`),
    KEY `idx_warehouse_id` (`warehouse_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SKU库存表';

-- 初始化语句
INSERT INTO `sku_stock` (`sku_id`, `spu_id`, `total_stock`, `locked_stock`, `available_stock`, `sold_stock`)
VALUES (10001, 20001, 1000, 0, 1000, 0);
```

**库存字段关系：**

```
total_stock = available_stock + locked_stock + sold_stock + frozen_stock
available_stock >= 0（不允许负库存）
locked_stock >= 0
```

### 1.2 库存扣减策略

库存扣减分三个阶段，对应订单的不同生命周期：

```
下单 ──→ 步骤1：预扣库存（Redis 原子扣减 available_stock）
 │
 ├── 支付成功 ──→ 步骤2：确认扣减（MySQL 减少 available_stock，增加 sold_stock）
 │                 状态：预扣 → 已售
 │
 └── 超时/取消 ──→ 步骤3：归还库存（MySQL 增加 available_stock，减少 locked_stock）
                    状态：预扣 → 归还
```

| 阶段 | 动作 | 数据源 | 时机 |
|------|------|--------|------|
| 预扣 | `available_stock - N` | Redis | 下单时 |
| 确认扣 | `locked_stock - N, sold_stock + N` | MySQL | 支付回调时 |
| 归还 | `available_stock + N, locked_stock - N` | MySQL | 关单/取消时 |

### 1.3 库存流水表

每笔库存变更都记录流水，用于对账和问题排查。

```sql
CREATE TABLE `stock_flow` (
    `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    `flow_no`       VARCHAR(32)     NOT NULL COMMENT '流水号',
    `sku_id`        BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
    `order_id`      VARCHAR(32)     DEFAULT NULL COMMENT '关联订单号',
    `change_type`   TINYINT         NOT NULL COMMENT '变更类型：1-下单预扣 2-支付确认 3-取消归还 4-退款归还 5-入库增加 6-盘点调整',
    `change_amount` INT             NOT NULL COMMENT '变更数量（正数增加，负数减少）',
    `before_stock`  INT             NOT NULL COMMENT '变更前可用库存',
    `after_stock`   INT             NOT NULL COMMENT '变更后可用库存',
    `before_locked` INT             NOT NULL DEFAULT 0 COMMENT '变更前锁定库存',
    `after_locked`  INT             NOT NULL DEFAULT 0 COMMENT '变更后锁定库存',
    `operator`      VARCHAR(50)     DEFAULT 'system' COMMENT '操作人/系统',
    `remark`        VARCHAR(255)    DEFAULT NULL COMMENT '备注',
    `create_time`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE KEY `uk_flow_no` (`flow_no`),
    KEY `idx_sku_id` (`sku_id`),
    KEY `idx_order_id` (`order_id`),
    KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存流水表';
```

***

## 2. 库存扣减的并发控制

### 2.1 方案一：数据库乐观锁（性能一般）

```java
/**
 * 数据库乐观锁扣减库存
 * UPDATE ... WHERE available_stock >= quantity AND version = ?
 * 适用于低并发场景
 */
@Repository
public interface SkuStockMapper {

    /**
     * 乐观锁扣减可用库存
     * @param skuId    SKU ID
     * @param quantity 扣减数量
     * @param version  当前版本号（乐观锁）
     * @return 影响行数（0 表示失败）
     */
    @Update("UPDATE sku_stock SET " +
            "available_stock = available_stock - #{quantity}, " +
            "locked_stock = locked_stock + #{quantity}, " +
            "version = version + 1 " +
            "WHERE sku_id = #{skuId} " +
            "AND available_stock >= #{quantity} " +
            "AND version = #{version}")
    int deductStockWithLock(@Param("skuId") Long skuId,
                            @Param("quantity") Integer quantity,
                            @Param("version") Integer version);
}
```

**优点：** 实现简单，强一致性。
**缺点：** 高并发下大量 UPDATE 行锁竞争，TPS 受限（MySQL 单行锁约数百 TPS）。

### 2.2 方案二：Redis 原子扣减（高性能，有数据一致性问题）

```java
/**
 * Redis 原子扣减库存
 * INCRBY/DECRBY 是原子操作
 * 性能极高（单机 Redis 可达数万 TPS）
 */
@Service
public class RedisStockService {

    @Autowired
    private RedisTemplate<String, String> redisTemplate;

    /**
     * 扣减库存（直接 Redis 操作，无 Lua 脚本）
     * 简单但有竞态问题：DECRBY 负数后仍需处理
     */
    public boolean deductStock(Long skuId, Integer quantity) {
        String key = "sku:stock:" + skuId;
        Long after = redisTemplate.opsForValue().decrement(key, quantity);
        if (after != null && after < 0) {
            // 扣超了，回滚
            redisTemplate.opsForValue().increment(key, quantity);
            return false;
        }
        return true;
    }
}
```

**问题：** `DECRBY` 和后面的 `increment` 不是原子操作，高并发下多线程同时扣减到负数后同时回滚，会导致多扣。

### 2.3 方案三：Redis 预扣 + 异步同步 DB（推荐方案）

```
下单请求
    │
    ├── 1. Redis Lua 脚本原子扣减（检查 + 扣减一步完成）
    │       ├── 成功 → 继续
    │       └── 失败 → 返回库存不足
    │
    ├── 2. 创建订单（MySQL 事务）
    │
    ├── 3. 发送 MQ 消息异步同步到 MySQL
    │
    └── 4. 返回成功
```

**完整代码实现：**

```java
@Service
@Slf4j
public class StockService {

    @Autowired
    private RedisTemplate<String, String> redisTemplate;
    @Autowired
    private SkuStockMapper skuStockMapper;
    @Autowired
    private StockFlowMapper stockFlowMapper;
    @Autowired
    private RabbitTemplate rabbitTemplate;

    /** 预扣库存 Lua 脚本 */
    private static final String DEDUCT_STOCK_LUA =
            "local stock_key = KEYS[1] " +
            "local qty = tonumber(ARGV[1]) " +
            "local stock = redis.call('GET', stock_key) " +
            "if not stock or tonumber(stock) < qty then " +
            "    return 0 " +
            "end " +
            "redis.call('DECRBY', stock_key, qty) " +
            "return 1";

    /** 归还库存 Lua 脚本 */
    private static final String REVERT_STOCK_LUA =
            "local stock_key = KEYS[1] " +
            "local qty = tonumber(ARGV[1]) " +
            "redis.call('INCRBY', stock_key, qty) " +
            "return 1";

    /**
     * Redis 原子预扣库存（下单时调用）
     */
    public boolean tryDeductStock(Long skuId, Integer quantity) {
        String stockKey = "sku:stock:" + skuId;
        DefaultRedisScript<Long> script = new DefaultRedisScript<>(DEDUCT_STOCK_LUA, Long.class);
        Long result = redisTemplate.execute(script, Collections.singletonList(stockKey),
                String.valueOf(quantity));
        return result != null && result == 1;
    }

    /**
     * Redis 归还库存（取消/超时关单时调用）
     */
    public void revertStock(Long skuId, Integer quantity) {
        String stockKey = "sku:stock:" + skuId;
        DefaultRedisScript<Long> script = new DefaultRedisScript<>(REVERT_STOCK_LUA, Long.class);
        redisTemplate.execute(script, Collections.singletonList(stockKey),
                String.valueOf(quantity));
    }

    /**
     * 异步同步 Redis → MySQL（MQ 消费者处理）
     * 支付成功后的确认扣减
     */
    @Transactional(rollbackFor = Exception.class)
    public void confirmDeduct(Long skuId, Integer quantity, String orderId) {
        // 1. 数据库乐观锁扣减
        int rows = skuStockMapper.deductAvailableStock(skuId, quantity);
        if (rows == 0) {
            log.error("数据库库存扣减失败，skuId={}, quantity={}, orderId={}",
                    skuId, quantity, orderId);
            throw new StockException("库存扣减失败");
        }

        // 2. 记录库存流水
        StockFlow flow = new StockFlow();
        flow.setFlowNo(generateFlowNo());
        flow.setSkuId(skuId);
        flow.setOrderId(orderId);
        flow.setChangeType(2); // 支付确认
        flow.setChangeAmount(-quantity);
        // before_stock / after_stock 通过查库获取
        flow.setRemark("支付确认扣减");
        stockFlowMapper.insert(flow);
    }

    /**
     * 异步归还库存（关单/取消时调用）
     */
    @Transactional(rollbackFor = Exception.class)
    public void confirmRevert(Long skuId, Integer quantity, String orderId) {
        int rows = skuStockMapper.revertStock(skuId, quantity);
        if (rows == 0) {
            log.error("库存归还失败，skuId={}, quantity={}, orderId={}",
                    skuId, quantity, orderId);
            throw new StockException("库存归还失败");
        }

        StockFlow flow = new StockFlow();
        flow.setFlowNo(generateFlowNo());
        flow.setSkuId(skuId);
        flow.setOrderId(orderId);
        flow.setChangeType(3); // 取消归还
        flow.setChangeAmount(quantity);
        flow.setRemark("超时/取消归还");
        stockFlowMapper.insert(flow);
    }

    private String generateFlowNo() {
        return "SF" + System.currentTimeMillis() + ThreadLocalRandom.current().nextInt(1000);
    }
}
```

**Mapper 层 SQL：**

```java
@Repository
public interface SkuStockMapper {

    /**
     * 支付确认：减少可用库存，增加已售数量
     * 此时 Redis 已预扣，数据库只做确认操作
     */
    @Update("UPDATE sku_stock SET " +
            "available_stock = available_stock - #{quantity}, " +
            "sold_stock = sold_stock + #{quantity} " +
            "WHERE sku_id = #{skuId} " +
            "AND available_stock >= #{quantity}")
    int deductAvailableStock(@Param("skuId") Long skuId,
                              @Param("quantity") Integer quantity);

    /**
     * 归还库存：恢复可用库存，减少锁定库存
     */
    @Update("UPDATE sku_stock SET " +
            "available_stock = available_stock + #{quantity}, " +
            "locked_stock = locked_stock - #{quantity} " +
            "WHERE sku_id = #{skuId} " +
            "AND locked_stock >= #{quantity}")
    int revertStock(@Param("skuId") Long skuId,
                     @Param("quantity") Integer quantity);
}
```

**三种方案对比：**

| 维度 | 方案一：DB 乐观锁 | 方案二：Redis 直接扣 | 方案三：Redis + 异步 DB |
|------|------------------|--------------------|-----------------------|
| 性能 | 低（数百 TPS） | 高（数万 TPS） | 高（数万 TPS） |
| 一致性 | 强 | 弱（可能超扣） | 最终一致 |
| 复杂度 | 低 | 中 | 较高 |
| 适用场景 | 低并发/管理后台 | 可接受短暂不一致 | 高并发秒杀 |
| 推荐 | 不推荐生产 | 不推荐 | **推荐** |

***

## 3. Redis 库存数据结构

### 3.1 String 存储库存数量

```java
// 库存预热：系统启动时从 MySQL 加载到 Redis
@PostConstruct
public void initStockCache() {
    List<SkuStock> stocks = skuStockMapper.selectAll();
    for (SkuStock stock : stocks) {
        String key = "sku:stock:" + stock.getSkuId();
        redisTemplate.opsForValue().set(key, String.valueOf(stock.getAvailableStock()));
        // 设置过期时间，防止垃圾数据堆积
        redisTemplate.expire(key, 7, TimeUnit.DAYS);
    }
    log.info("库存缓存初始化完毕，共加载 {} 个 SKU", stocks.size());
}
```

**多个 SKU 的库存变更操作：**

```java
/**
 * 批量预扣库存（购物车场景：多个 SKU 同时下单）
 * 使用 Lua 脚本保证批量操作的原子性
 */
private static final String BATCH_DEDUCT_LUA =
        "for i = 1, #KEYS do " +
        "    local stock = redis.call('GET', KEYS[i]) " +
        "    local qty = tonumber(ARGV[i]) " +
        "    if not stock or tonumber(stock) < qty then " +
        "        -- 回滚已扣减的 " +
        "        for j = 1, i-1 do " +
        "            redis.call('INCRBY', KEYS[j], tonumber(ARGV[j])) " +
        "        end " +
        "        return 0 " +
        "    end " +
        "end " +
        "for i = 1, #KEYS do " +
        "    redis.call('DECRBY', KEYS[i], tonumber(ARGV[i])) " +
        "end " +
        "return 1";

public boolean batchTryDeductStock(Map<Long, Integer> skuQuantityMap) {
    if (skuQuantityMap.isEmpty()) return true;

    // 构建 KEYS 和 ARGV（保持顺序一致）
    List<Long> sortedSkuIds = new ArrayList<>(skuQuantityMap.keySet());
    Collections.sort(sortedSkuIds);

    List<String> keys = sortedSkuIds.stream()
            .map(id -> "sku:stock:" + id)
            .collect(Collectors.toList());
    String[] args = sortedSkuIds.stream()
            .map(id -> String.valueOf(skuQuantityMap.get(id)))
            .toArray(String[]::new);

    DefaultRedisScript<Long> script = new DefaultRedisScript<>(BATCH_DEDUCT_LUA, Long.class);
    Long result = redisTemplate.execute(script, keys, args);
    return result != null && result == 1;
}
```

### 3.2 Lua 脚本保证原子扣减

Lua 脚本的核心作用是将「检查库存是否充足」和「扣减库存」两个操作合并为一个原子操作，彻底避免并发下的竞态条件。

```lua
-- stock_deduct.lua
-- KEYS[1]: 库存 key（如 sku:stock:10001）
-- ARGV[1]: 扣减数量
-- 返回值: 1-成功 0-失败

-- 获取当前库存
local stock = redis.call('GET', KEYS[1])

-- 库存不存在或不足
if not stock then
    return 0
end

stock = tonumber(stock)
local deductQty = tonumber(ARGV[1])

if stock < deductQty then
    return 0
end

-- 原子扣减
redis.call('DECRBY', KEYS[1], deductQty)

-- 记录扣减后的库存（可选，用于监控）
redis.call('SET', KEYS[1] .. ':last_qty', stock - deductQty)

return 1
```

```lua
-- stock_revert.lua
-- KEYS[1]: 库存 key
-- ARGV[1]: 归还数量

local stock = redis.call('GET', KEYS[1])
if not stock then
    return 0
end

redis.call('INCRBY', KEYS[1], tonumber(ARGV[1]))
return 1
```

### 3.3 库存流水队列（RabbitMQ）

```java
@Configuration
public class StockMqConfig {

    // 库存扣减交换机
    @Bean
    public DirectExchange stockExchange() {
        return new DirectExchange("stock.exchange");
    }

    // 扣减队列
    @Bean
    public Queue stockDeductQueue() {
        return QueueBuilder.durable("stock.deduct.queue")
                .withArgument("x-dead-letter-exchange", "stock.dlx.exchange")
                .withArgument("x-dead-letter-routing-key", "stock.dlx")
                .build();
    }

    // 归还队列
    @Bean
    public Queue stockRevertQueue() {
        return QueueBuilder.durable("stock.revert.queue").build();
    }

    // 绑定
    @Bean
    public Binding deductBinding() {
        return BindingBuilder.bind(stockDeductQueue())
                .to(stockExchange()).with("stock.deduct");
    }

    @Bean
    public Binding revertBinding() {
        return BindingBuilder.bind(stockRevertQueue())
                .to(stockExchange()).with("stock.revert");
    }

    // 死信队列（处理失败消息）
    @Bean
    public DirectExchange stockDlxExchange() {
        return new DirectExchange("stock.dlx.exchange");
    }

    @Bean
    public Queue stockDlxQueue() {
        return new Queue("stock.dlx.queue", true);
    }

    @Bean
    public Binding dlxBinding() {
        return BindingBuilder.bind(stockDlxQueue())
                .to(stockDlxExchange()).with("stock.dlx");
    }
}
```

```java
@Component
@Slf4j
public class StockMqListener {

    @Autowired
    private StockService stockService;

    /**
     * 库存扣减消息处理（支付后确认扣减）
     */
    @RabbitListener(queues = "stock.deduct.queue")
    public void handleStockDeduct(StockDeductMessage message) {
        log.info("收到库存扣减消息: {}", message);
        try {
            for (SkuItem item : message.getSkuItems()) {
                stockService.confirmDeduct(item.getSkuId(), item.getQuantity(),
                        message.getOrderId());
            }
        } catch (Exception e) {
            log.error("库存扣减处理失败", e);
            // 不抛出异常，让消息进入死信队列进行补偿
            throw new AmqpRejectAndDontRequeueException(e);
        }
    }

    /**
     * 库存归还消息处理（取消/超时关单）
     */
    @RabbitListener(queues = "stock.revert.queue")
    public void handleStockRevert(StockRevertMessage message) {
        log.info("收到库存归还消息: {}", message);
        for (SkuItem item : message.getSkuItems()) {
            stockService.confirmRevert(item.getSkuId(), item.getQuantity(),
                    message.getOrderId());
        }
    }
}
```

***

## 4. 秒杀系统设计

### 4.1 秒杀的核心挑战

| 挑战 | 说明 | 后果 |
|------|------|------|
| 高并发 | 瞬间涌入百万级请求 | 打垮数据库、服务雪崩 |
| 防超卖 | 库存有限但请求无限 | 超卖导致资损 |
| 防刷 | 机器脚本抢购 | 普通用户抢不到 |
| 热点数据 | 同一商品被高并发访问 | 缓存击穿、数据库打爆 |
| 公平性 | 谁能抢到 | 需要公平的抢购机制 |

### 4.2 秒杀整体架构图

```
浏览器（Web/App）
    │
    ├── CDN（静态资源加速：页面、图片）
    │
    ├── Nginx 集群（Lua 限流 + 黑名单）
    │       │
    │       ├── 1. IP 限流（漏桶算法，单 IP 每秒 N 次）
    │       ├── 2. User-Agent 黑名单
    │       └── 3. 请求频率统计
    │
    ├── Spring Cloud Gateway（Sentinel 限流）
    │       │
    │       ├── 4. Sentinel 热点参数限流（按商品 ID）
    │       └── 5. 总 QPS 限流
    │
    ├── 秒杀业务服务（集群）
    │       │
    │       ├── 6. 令牌校验（获取令牌才进入秒杀）
    │       ├── 7. Redis 预扣库存（Lua 脚本）
    │       ├── 8. 请求去重（Redis Set 防重复下单）
    │       ├── 9. 验证码校验
    │       └── 10. 限购校验（每人限购 N 件）
    │
    ├── RabbitMQ（流量削峰）
    │       └── 异步写订单 + 扣减数据库库存
    │
    └── MySQL 数据库
            └── 乐观锁兜底（UPDATE ... WHERE stock > 0）
```

### 4.3 前端限流

```javascript
// 1. 按钮置灰（防止重复点击）
let isSubmitting = false;

function submitFlashOrder() {
    if (isSubmitting) return;
    isSubmitting = true;

    document.getElementById('submitBtn').disabled = true;
    document.getElementById('submitBtn').innerText = '提交中...';

    ajax.post('/flash/order', data)
        .then(res => {
            // 处理成功
        })
        .catch(err => {
            // 提示错误
        })
        .finally(() => {
            setTimeout(() => {
                isSubmitting = false;
                document.getElementById('submitBtn').disabled = false;
                document.getElementById('submitBtn').innerText = '立即抢购';
            }, 3000); // 3秒后可重新点击
        });
}

// 2. 验证码
function requestFlashToken() {
    // 先获取/刷新验证码
    refreshCaptcha();
}

function submitWithCaptcha(captchaCode) {
    // 提交时将验证码一并提交
    ajax.post('/flash/order', {
        skuId: skuId,
        captcha: captchaCode,
        captchaKey: captchaKey
    });
}
```

### 4.4 后端分层限流

**Nginx 层限流（Lua + 漏桶）：**

```nginx
http {
    # 定义限流区域：每个 IP 每秒最多 10 个请求
    limit_req_zone $binary_remote_addr zone=flash_limit:10m rate=10r/s;

    server {
        location /api/flash/ {
            # IP 限流
            limit_req zone=flash_limit burst=20 nodelay;

            # 使用 Lua 限流（灵活控制）
            access_by_lua_block {
                local limit = require "resty.limit.req"
                local lim, err = limit.new("flash_limit_store", 100, 100)
                local key = ngx.var.binary_remote_addr
                local delay, err = lim:incoming(key, true)
                if not delay then
                    ngx.exit(503)
                end
            }

            proxy_pass http://backend_servers;
        }
    }
}
```

**Sentinel 限流（Gateway 层）：**

```java
@Configuration
public class SentinelConfig {

    @Bean
    public SentinelResourceAspect sentinelResourceAspect() {
        return new SentinelResourceAspect();
    }

    /**
     * Gateway 层面按商品 ID 限流
     * 热点参数限流：同一个商品 ID 每秒 QPS 不超过 1000
     */
    @PostConstruct
    public void initSentinelRules() {
        // 定义热点规则：按商品 ID 限流
        ParamFlowRule rule = new ParamFlowRule("flashOrder")
                .setParamIdx(0)                         // 第一个参数（skuId）
                .setCount(1000)                          // 单商品 QPS 阈值
                .setDurationInSec(1)                     // 统计周期（秒）
                .setControlBehavior(RuleConstant.CONTROL_BEHAVIOR_RATE_LIMIT);

        ParamFlowRuleManager.loadRules(Collections.singletonList(rule));
    }
}
```

**业务层限流：**

```java
@Service
public class FlashSaleService {

    @Autowired
    private RedisTemplate<String, String> redisTemplate;

    /**
     * 业务层限流：使用 Redis 滑动窗口实现
     * 单用户每秒最多 1 次请求
     */
    public boolean rateLimitByUser(Long userId) {
        String key = "flash:rate:user:" + userId;
        long now = System.currentTimeMillis();

        // 移除 1 秒前的记录
        redisTemplate.opsForZSet().removeRangeByScore(key, 0, now - 1000);

        // 当前窗口内的请求数
        Long count = redisTemplate.opsForZSet().zCard(key);
        if (count != null && count >= 1) {
            return false; // 限流
        }

        // 记录本次请求
        redisTemplate.opsForZSet().add(key, String.valueOf(now), now);
        redisTemplate.expire(key, 2, TimeUnit.SECONDS);
        return true;
    }
}
```

### 4.5 Redis 预减库存 + MQ 异步下单

```java
@Service
@Slf4j
public class FlashOrderService {

    @Autowired
    private RedisTemplate<String, String> redisTemplate;
    @Autowired
    private RabbitTemplate rabbitTemplate;
    @Autowired
    private FlashOrderMapper flashOrderMapper;

    private static final DefaultRedisScript<Long> FLASH_DEDUCT_SCRIPT;

    static {
        FLASH_DEDUCT_SCRIPT = new DefaultRedisScript<>();
        FLASH_DEDUCT_SCRIPT.setScriptText(
                "local stock_key = KEYS[1] " +
                "local user_key = KEYS[2] " +
                "local user_id = ARGV[1] " +
                "local qty = tonumber(ARGV[2]) " +
                "local limit = tonumber(ARGV[3]) " +
                "// 检查用户是否已购买 " +
                "local bought = redis.call('GET', user_key) " +
                "if bought and tonumber(bought) >= limit then " +
                "    return -2 " +  // 超过限购数量
                "end " +
                "// 检查库存 " +
                "local stock = redis.call('GET', stock_key) " +
                "if not stock or tonumber(stock) < qty then " +
                "    return -1 " +  // 库存不足
                "end " +
                "// 预扣库存 " +
                "redis.call('DECRBY', stock_key, qty) " +
                "// 增加用户已购数量 " +
                "redis.call('INCRBY', user_key, qty) " +
                "redis.call('EXPIRE', user_key, 86400) " +  // 24小时过期
                "return 1"           // 成功
        );
        FLASH_DEDUCT_SCRIPT.setResultType(Long.class);
    }

    /**
     * 秒杀下单入口
     */
    public FlashResult flashOrder(FlashRequest request) {
        Long userId = request.getUserId();
        Long skuId = request.getSkuId();

        // 1. 令牌校验
        if (!checkFlashToken(request.getToken(), skuId)) {
            return FlashResult.fail("令牌无效");
        }

        // 2. 验证码校验
        if (!checkCaptcha(request.getCaptchaKey(), request.getCaptchaCode())) {
            return FlashResult.fail("验证码错误");
        }

        // 3. 用户维度限流
        String userRateKey = "flash:rate:" + userId;
        if (Boolean.FALSE.equals(redisTemplate.opsForValue()
                .setIfAbsent(userRateKey, "1", 1, TimeUnit.SECONDS))) {
            return FlashResult.fail("操作频率过快");
        }

        // 4. Redis Lua 原子预扣库存
        String stockKey = "flash:stock:" + skuId;
        String userBuyKey = "flash:bought:" + skuId + ":" + userId;

        Long result = redisTemplate.execute(FLASH_DEDUCT_SCRIPT,
                Arrays.asList(stockKey, userBuyKey),
                String.valueOf(userId), "1", String.valueOf(request.getLimit()));

        if (result == null || result < 0) {
            if (result != null && result == -2) {
                return FlashResult.fail("已达到限购数量");
            }
            return FlashResult.fail("库存不足");
        }

        // 5. 发送 MQ 消息异步落单
        FlashOrderMessage message = new FlashOrderMessage();
        message.setUserId(userId);
        message.setSkuId(skuId);
        message.setToken(request.getToken());

        rabbitTemplate.convertAndSend("flash.order.exchange",
                "flash.order.create", message);

        // 返回排队中（客户端轮询查询结果）
        return FlashResult.queued("已进入排队，请稍后查询结果");
    }

    /**
     * 校验秒杀令牌
     */
    private boolean checkFlashToken(String token, Long skuId) {
        if (StringUtils.isBlank(token)) return false;
        String tokenKey = "flash:token:" + skuId;
        // 令牌是一次性的，使用后删除
        Long removed = redisTemplate.opsForSet().remove(tokenKey, token);
        return removed != null && removed > 0;
    }
}
```

**MQ 消费者——异步落单：**

```java
@Component
@Slf4j
public class FlashOrderConsumer {

    @Autowired
    private FlashOrderMapper orderMapper;
    @Autowired
    private SkuStockMapper skuStockMapper;
    @Autowired
    private StockFlowMapper stockFlowMapper;

    @RabbitListener(queues = "flash.order.queue")
    @Transactional(rollbackFor = Exception.class)
    public void handleFlashOrder(FlashOrderMessage message) {
        log.info("处理秒杀订单: {}", message);

        // 1. 订单去重（防重复下单）
        String dedupKey = "flash:dedup:" + message.getSkuId() + ":" + message.getUserId();
        Boolean notExist = redisTemplate.opsForValue()
                .setIfAbsent(dedupKey, "1", 30, TimeUnit.SECONDS);
        if (Boolean.FALSE.equals(notExist)) {
            log.warn("重复秒杀请求，已忽略: userId={}, skuId={}",
                    message.getUserId(), message.getSkuId());
            return;
        }

        // 2. 数据库乐观锁兜底扣减
        int rows = skuStockMapper.deductAvailableStock(message.getSkuId(), 1);
        if (rows == 0) {
            log.error("数据库库存不足（兜底）, skuId={}", message.getSkuId());
            // 归还 Redis 库存
            redisTemplate.opsForValue()
                    .increment("flash:stock:" + message.getSkuId(), 1);
            return;
        }

        // 3. 创建秒杀订单
        FlashOrder order = new FlashOrder();
        order.setUserId(message.getUserId());
        order.setSkuId(message.getSkuId());
        order.setStatus(1); // 已支付（秒杀场景通常支付和下单一体）
        orderMapper.insert(order);

        // 4. 记录流水
        StockFlow flow = new StockFlow();
        flow.setSkuId(message.getSkuId());
        flow.setOrderId(order.getOrderId());
        flow.setChangeType(2);
        flow.setChangeAmount(-1);
        stockFlowMapper.insert(flow);

        log.info("秒杀订单创建成功: orderId={}", order.getOrderId());
    }
}
```

### 4.6 秒杀令牌机制

令牌机制防止用户绕开前端直接请求后端秒杀接口。

```java
@Service
public class FlashTokenService {

    @Autowired
    private RedisTemplate<String, String> redisTemplate;

    // 每个令牌的有效期
    private static final long TOKEN_TTL = 30; // 秒

    /**
     * 秒杀开始前，批量生成令牌并存入 Redis
     * 令牌数量 = 秒杀库存数量 × 放大系数（如 ×5）
     */
    public void preGenerateTokens(Long flashActivityId, Long skuId,
                                   int stockCount, int expandFactor) {
        int tokenCount = stockCount * expandFactor;
        String tokenKey = "flash:token:" + skuId;
        List<String> tokens = new ArrayList<>();

        for (int i = 0; i < tokenCount; i++) {
            tokens.add(UUID.randomUUID().toString().replace("-", ""));
        }

        // 批量写入 Redis Set
        redisTemplate.opsForSet().add(tokenKey, tokens.toArray(new String[0]));
        redisTemplate.expire(tokenKey, 24, TimeUnit.HOURS);

        log.info("已生成 {} 个秒杀令牌，活动ID={}, SKU={}, 库存={}",
                tokenCount, flashActivityId, skuId, stockCount);
    }

    /**
     * 用户抢购前，先获取令牌
     */
    public String acquireToken(Long userId, Long skuId) {
        // 用户限流：每个用户只分配一个令牌
        String userTokenKey = "flash:user:token:" + skuId + ":" + userId;
        String existingToken = redisTemplate.opsForValue().get(userTokenKey);
        if (existingToken != null) {
            return existingToken; // 复用已有令牌
        }

        // 从令牌池弹出一个
        String tokenKey = "flash:token:" + skuId;
        String token = redisTemplate.opsForSet().pop(tokenKey);
        if (token == null) {
            return null; // 令牌已耗尽
        }

        // 绑定令牌到用户（带过期时间）
        redisTemplate.opsForValue().set(userTokenKey, token, TOKEN_TTL, TimeUnit.SECONDS);
        return token;
    }
}
```

**令牌获取接口：**

```java
@RestController
@RequestMapping("/flash")
public class FlashTokenController {

    @Autowired
    private FlashTokenService tokenService;

    /**
     * 获取秒杀令牌
     * 前端在秒杀开始前调用此接口获取令牌
     */
    @GetMapping("/token")
    public Result<String> getToken(@RequestParam Long userId,
                                    @RequestParam Long skuId) {
        String token = tokenService.acquireToken(userId, skuId);
        if (token == null) {
            return Result.fail("令牌已发放完毕");
        }
        return Result.success(token);
    }

    /**
     * 查询抢购结果（前端轮询）
     */
    @GetMapping("/result")
    public Result<FlashOrderVO> getResult(@RequestParam Long userId,
                                           @RequestParam Long skuId) {
        FlashOrder order = flashOrderMapper.selectByUserAndSku(userId, skuId);
        if (order == null) {
            return Result.fail("正在排队中");
        }
        return Result.success(convertToVO(order));
    }
}
```

### 4.7 数据库层乐观锁兜底

MQ 消费者在写入订单时，使用乐观锁兜底扣减库存：

```sql
-- 数据库层最终兜底：乐观锁 + 库存 > 0 检查
UPDATE sku_stock
SET available_stock = available_stock - 1,
    sold_stock = sold_stock + 1,
    version = version + 1
WHERE sku_id = #{skuId}
  AND available_stock > 0
  AND version = #{version}
```

***

## 5. 防超卖设计

### 5.1 数据库乐观锁 UPDATE ... WHERE stock > 0

```java
/**
 * 乐观锁防超卖扣减
 * 条件中带上 stock > 0，保证不会扣到负数
 */
@Update("UPDATE sku_stock SET " +
        "available_stock = available_stock - #{quantity}, " +
        "locked_stock = locked_stock + #{quantity}, " +
        "version = version + 1 " +
        "WHERE sku_id = #{skuId} " +
        "AND available_stock >= #{quantity} " +
        "AND version = #{version}")
int safeDeductStock(@Param("skuId") Long skuId,
                    @Param("quantity") Integer quantity,
                    @Param("version") Integer version);
```

### 5.2 Redis Lua 脚本原子操作

已在 3.2 节详述。核心原则：检查与扣减在同一个 Lua 脚本中完成，保证原子性。

### 5.3 订单去重表（防止重复下单）

```sql
CREATE TABLE `order_dedup` (
    `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `dedup_key`   VARCHAR(64)     NOT NULL COMMENT '去重键：skuId_userId',
    `order_id`    VARCHAR(32)     NOT NULL COMMENT '订单号',
    `expire_time` DATETIME        NOT NULL COMMENT '过期时间',
    `create_time` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_dedup_key` (`dedup_key`) COMMENT '去重唯一键'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单去重表';

-- 去重逻辑示例
// 方案一：数据库去重键 INSERT IGNORE
@Insert("INSERT IGNORE INTO order_dedup (dedup_key, order_id, expire_time) " +
        "VALUES (#{dedupKey}, #{orderId}, #{expireTime})")
int insertDedup(@Param("dedupKey") String dedupKey,
                @Param("orderId") String orderId,
                @Param("expireTime") Date expireTime);

// 方案二：Redis SETNX（性能更高，但有丢失风险）
String dedupKey = "flash:dedup:" + skuId + ":" + userId;
Boolean notExist = redisTemplate.opsForValue()
        .setIfAbsent(dedupKey, orderId, 30, TimeUnit.MINUTES);
if (Boolean.FALSE.equals(notExist)) {
    throw new BusinessException("请勿重复下单");
}
```

**防超卖三层保护：**

```
第 1 层（性能层）：Redis Lua 脚本原子扣减
    ↓ 扣减成功
第 2 层（去重层）：订单去重表 / Redis SETNX
    ↓ 未重复
第 3 层（兜底层）：MySQL 乐观锁 UPDATE ... WHERE stock > 0
    ↓ 扣减成功
最终：订单创建成功
```

***

## 6. 库存一致性

### 6.1 库存对账机制（日结对账）

```java
@Component
@Slf4j
public class StockReconciliationTask {

    @Autowired
    private RedisTemplate<String, String> redisTemplate;
    @Autowired
    private SkuStockMapper skuStockMapper;

    /**
     * 每天凌晨 3:00 执行库存对账
     */
    @Scheduled(cron = "0 0 3 * * ?")
    public void dailyReconciliation() {
        log.info("开始每日库存对账...");

        List<SkuStock> dbStocks = skuStockMapper.selectAll();
        for (SkuStock dbStock : dbStocks) {
            String redisKey = "sku:stock:" + dbStock.getSkuId();
            String redisVal = redisTemplate.opsForValue().get(redisKey);
            if (redisVal == null) continue;

            int redisStock = Integer.parseInt(redisVal);
            int dbAvailableStock = dbStock.getAvailableStock();

            if (redisStock != dbAvailableStock) {
                log.warn("库存不一致：SKU={}, Redis={}, MySQL={}, 差异={}",
                        dbStock.getSkuId(), redisStock, dbAvailableStock,
                        redisStock - dbAvailableStock);

                // 记录对账差异
                insertReconciliationRecord(dbStock.getSkuId(),
                        redisStock, dbAvailableStock);
            }
        }

        log.info("每日库存对账完成");
    }

    private void insertReconciliationRecord(Long skuId, int redisStock, int dbStock) {
        // 插入对账差异表
        // ...略
    }
}
```

### 6.2 Redis 与 MySQL 库存一致性（Binlog 同步 / 定时校正）

**方案一：Canal Binlog 同步**

```
MySQL Binlog → Canal → MQ → 库存同步服务 → 更新 Redis
```

```java
/**
 * Canal Binlog 监听 MySQL 库存变更，同步至 Redis
 */
@Component
public class StockBinlogSync {

    @Autowired
    private RedisTemplate<String, String> redisTemplate;

    @RabbitListener(queues = "stock.binlog.queue")
    public void handleBinlog(StockBinlogMessage message) {
        // 解析 Binlog 变更
        String tableName = message.getTable();
        if (!"sku_stock".equals(tableName)) return;

        // 获取变更后的可用库存
        Long skuId = message.getAfter().getSkuId();
        Integer availableStock = message.getAfter().getAvailableStock();

        // 同步到 Redis
        String redisKey = "sku:stock:" + skuId;
        redisTemplate.opsForValue().set(redisKey, String.valueOf(availableStock));

        log.info("Binlog 同步库存：SKU={}, 库存={}", skuId, availableStock);
    }
}
```

**方案二：定时校正**

```java
/**
 * 定时将 MySQL 库存同步至 Redis（兜底方案）
 * 每 5 分钟执行一次
 */
@Scheduled(fixedRate = 5 * 60 * 1000)
public void syncDbToRedis() {
    log.debug("开始定时同步 MySQL 库存到 Redis");

    List<SkuStock> stocks = skuStockMapper.selectAll();
    for (SkuStock stock : stocks) {
        String key = "sku:stock:" + stock.getSkuId();
        String currentRedis = redisTemplate.opsForValue().get(key);

        // 只有 Redis 中不存在或为 0 时才同步
        // （正常流程下 Redis 优先，DB 同步只是修正）
        if (currentRedis == null || "0".equals(currentRedis)) {
            redisTemplate.opsForValue().set(key,
                    String.valueOf(stock.getAvailableStock()));
        }
    }

    log.debug("定时同步完成，共处理 {} 个 SKU", stocks.size());
}
```

### 6.3 库存补偿任务

某些场景下（如 MQ 消息丢失、服务宕机），库存可能出现未正确归还的情况，需要补偿任务扫描并修复。

```java
/**
 * 库存补偿任务
 * 扫描长时间未支付的订单，强制归还库存
 */
@Component
@Slf4j
public class StockCompensationTask {

    @Autowired
    private OrderMapper orderMapper;
    @Autowired
    private OrderItemMapper orderItemMapper;
    @Autowired
    private SkuStockMapper skuStockMapper;
    @Autowired
    private StockFlowMapper stockFlowMapper;

    /**
     * 每 10 分钟扫描一次「已创建超过 35 分钟但状态仍是待支付」的订单
     * （正常 30 分钟关单，35 分钟为补偿缓冲）
     */
    @Scheduled(fixedRate = 10 * 60 * 1000)
    @Transactional(rollbackFor = Exception.class)
    public void compensateStock() {
        // 查询超时待支付的订单
        Date threshold = new Date(System.currentTimeMillis() - 35 * 60 * 1000);
        List<Orders> timeoutOrders = orderMapper.selectTimeoutOrders(
                OrderStatus.WAIT_PAY.getCode(), threshold);

        for (Orders order : timeoutOrders) {
            try {
                // 取消订单
                int updated = orderMapper.updateStatusByOrderId(
                        order.getOrderId(),
                        OrderStatus.WAIT_PAY.getCode(),
                        OrderStatus.CANCELLED.getCode(),
                        null, null
                );

                if (updated == 0) continue; // 可能已被其他线程处理

                // 归还库存
                List<OrderItem> items = orderItemMapper.selectByOrderId(order.getOrderId());
                for (OrderItem item : items) {
                    skuStockMapper.revertStock(item.getSkuId(), item.getQuantity());

                    // 记录补偿流水
                    StockFlow flow = new StockFlow();
                    flow.setSkuId(item.getSkuId());
                    flow.setOrderId(order.getOrderId());
                    flow.setChangeType(3); // 取消归还
                    flow.setChangeAmount(item.getQuantity());
                    flow.setRemark("库存补偿-超时关单");
                    stockFlowMapper.insert(flow);
                }

                log.info("库存补偿完成：订单={}，SKU数量={}", order.getOrderId(), items.size());
            } catch (Exception e) {
                log.error("库存补偿异常：订单={}", order.getOrderId(), e);
            }
        }
    }
}
```

***

## 附录：关键设计要点总结

| 关注点 | 解决方案 |
|--------|---------|
| 库存模型 | `total = available + locked + sold + frozen` |
| 并发扣减 | Redis Lua 原子脚本（高性能） |
| 数据最终一致 | Redis 预扣 + MQ 异步同步 DB |
| 库存追踪 | 库存流水表（stock\_flow）记录每笔变更 |
| 秒杀高并发 | 前端限流 → Nginx限流 → Sentinel → 业务限流 |
| 流量削峰 | Redis 预减库存 + MQ 异步下单 |
| 防超卖三层 | Lua 原子扣减 → 去重表 → 乐观锁兜底 |
| 防刷 | 令牌机制 + 验证码 + 用户维度限流 |
| 库存一致性 | Binlog 同步（实时）+ 定时校正（准实时）+ 补偿任务 |
| 对账 | 日结对账 + 差异告警 |
| 库存补偿 | 定时扫描超时未支付订单，强制归还 |
