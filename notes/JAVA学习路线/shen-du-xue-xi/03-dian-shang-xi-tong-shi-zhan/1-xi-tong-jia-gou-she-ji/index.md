---
url: >-
  /my_notes/notes/JAVA学习路线/shen-du-xue-xi/03-dian-shang-xi-tong-shi-zhan/1-xi-tong-jia-gou-she-ji/index.md
---
# 电商系统架构设计

> 本文档详细阐述一套高并发、高可用的电商平台系统架构设计方案，涵盖微服务拆分、数据库设计、核心业务服务、公共模块以及接口规范等内容。

***

## 一、整体架构设计

### 1.1 架构总览

本系统采用 **Spring Cloud Alibaba** 微服务架构体系，遵循领域驱动设计（DDD）的微服务拆分原则，将电商核心业务划分为以下独立服务：

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           客户端层 (Client Layer)                         │
│          Web端 / App端 / H5 / 小程序 / 开放平台API                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       网关层 (Gateway Layer)                              │
│           Spring Cloud Gateway ─ 统一鉴权 / 路由 / 限流 / 日志           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      业务服务层 (Business Service Layer)                  │
│                                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  用户服务  │  │  商品服务  │  │  订单服务  │  │  支付服务  │  │  库存服务  │  │
│  │  UserSvc  │  │ ProductSvc│  │  OrderSvc │  │  PaySvc   │  │ StockSvc │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│  │  物流服务  │  │  优惠券服务 │  │  通知服务  │  │  后台管理  │                │
│  │ LogisticSvc│ │ CouponSvc │  │ NoticeSvc│  │ AdminSvc │                │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      中间件层 (Middleware Layer)                          │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │          注册中心 / 配置中心 : Nacos                              │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │          服务熔断 / 限流 : Sentinel                              │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │          消息队列 : RocketMQ                                     │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │          分布式缓存 : Redis Cluster                              │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │          搜索引擎 : Elasticsearch                                │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │          分布式事务 : Seata                                      │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       数据层 (Data Layer)                                │
│                                                                         │
│  ┌────────────────────┐  ┌────────────────────┐                        │
│  │   MySQL 主库 (写)    │  │   MySQL 从库 (读)    │                        │
│  │   (ShardingSphere)  │  │   (ShardingSphere)  │                        │
│  └────────────────────┘  └────────────────────┘                        │
│  ┌────────────────────┐  ┌────────────────────┐                        │
│  │   Redis Cluster    │  │   Elasticsearch    │                        │
│  │   (缓存/Session)    │  │   (商品搜索)        │                        │
│  └────────────────────┘  └────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 微服务拆分原则

| 原则 | 说明 |
|------|------|
| **高内聚低耦合** | 每个服务拥有完整的业务领域边界，服务间通过 API 通信 |
| **单一职责** | 每个服务只负责一个业务领域（如订单服务只处理订单相关逻辑） |
| **数据独立** | 每个服务拥有独立的数据库实例或 Schema |
| **无状态化** | 服务实例无状态，便于水平扩展 |
| **故障隔离** | 一个服务的故障不影响其他服务 |

### 1.3 电商服务划分

| 服务名称 | 核心职责 | 数据存储 |
|----------|----------|----------|
| **用户服务 (user-svc)** | 用户注册登录、地址管理、用户等级积分 | user\_db |
| **商品服务 (product-svc)** | SPU/SKU 管理、分类、商品搜索、商品详情 | product\_db |
| **订单服务 (order-svc)** | 订单创建、订单状态流转、订单查询 | order\_db |
| **支付服务 (pay-svc)** | 支付通道对接、支付记录、退款处理 | pay\_db |
| **库存服务 (stock-svc)** | 库存扣减、库存预占、库存回滚 | stock\_db |
| **物流服务 (logistic-svc)** | 发货管理、物流轨迹查询 | logistic\_db |
| **优惠券服务 (coupon-svc)** | 优惠券发放、优惠券核销 | coupon\_db |
| **通知服务 (notice-svc)** | 短信、邮件、站内信、App Push | notice\_db |

### 1.4 技术选型

| 技术组件 | 版本 | 用途 |
|----------|------|------|
| Spring Boot | 2.7.x | 基础框架 |
| Spring Cloud Alibaba | 2021.0.x | 微服务框架 |
| Nacos | 2.2.x | 注册中心 + 配置中心 |
| Sentinel | 1.8.x | 服务熔断、限流、降级 |
| Feign + LoadBalancer | - | 服务间同步调用 |
| RocketMQ | 5.1.x | 异步消息、事务消息 |
| MyBatis-Plus | 3.5.x | ORM 框架 |
| MySQL | 8.0.x | 关系型数据库 |
| ShardingSphere | 5.3.x | 分库分表 + 读写分离 |
| Redis | 7.0.x | 缓存、分布式锁、Session |
| Elasticsearch | 8.x | 商品搜索 |
| Seata | 1.6.x | 分布式事务 |
| Caffeine | - | 本地缓存 |
| XXL-Job | - | 分布式定时任务 |
| SkyWalking | 9.x | 链路追踪 |

### 1.5 服务间通信方式

本系统采用 **同步 Feign + 异步 MQ** 混合通信模式：

```
┌──────────────────────────────────────────────────────────────────────┐
│                      通信模式对比                                     │
├──────────────────┬──────────────────┬───────────────────────────────┤
│    同步 (Feign)    │    异步 (MQ)      │          场景举例            │
├──────────────────┼──────────────────┼───────────────────────────────┤
│  实时性强         │  削峰填谷         │  下单：同步查用户+商品信息    │
│  调用链简单        │  解耦             │  下单成功后异步发通知        │
│  强一致性要求      │  最终一致性        │  支付成功异步通知订单服务   │
│  适合查询场景      │  适合事件通知      │  库存扣减异步回调           │
└──────────────────┴──────────────────┴───────────────────────────────┘
```

**Feign 调用示例：**

```java
// user-svc 暴露接口
@FeignClient(name = "user-svc", path = "/api/user", fallback = UserClientFallback.class)
public interface UserClient {

    @GetMapping("/{id}")
    Result<UserVO> getUserById(@PathVariable("id") Long id);

    @PostMapping("/address/list")
    Result<List<UserAddressVO>> getAddressList(@RequestBody @Valid AddressQueryDTO dto);
}

// user-svc 接口实现
@RestController
@RequestMapping("/api/user")
public class UserController {

    @GetMapping("/{id}")
    public Result<UserVO> getUserById(@PathVariable("id") Long id) {
        UserVO user = userService.getUserById(id);
        return Result.success(user);
    }
}

// order-svc 调用 user-svc
@Service
public class OrderServiceImpl implements OrderService {

    @Autowired
    private UserClient userClient;

    @Override
    public OrderVO createOrder(OrderCreateDTO dto) {
        // 同步调用用户服务获取用户信息
        Result<UserVO> userResult = userClient.getUserById(dto.getUserId());
        if (!userResult.isSuccess()) {
            throw new BizException("获取用户信息失败");
        }
        UserVO user = userResult.getData();
        // ... 后续下单逻辑
    }
}
```

**MQ 异步消息示例（订单创建后发送消息）：**

```java
@Service
public class OrderServiceImpl implements OrderService {

    @Autowired
    private RocketMQTemplate rocketMQTemplate;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public OrderVO createOrder(OrderCreateDTO dto) {
        // 1. 创建订单
        Order order = buildOrder(dto);
        orderMapper.insert(order);

        // 2. 扣减库存（同步 RPC 或本地事务）
        stockService.deductStock(dto.getSkuId(), dto.getQuantity());

        // 3. 发送订单创建事件（异步）
        OrderCreatedEvent event = new OrderCreatedEvent();
        event.setOrderId(order.getId());
        event.setUserId(order.getUserId());
        event.setAmount(order.getActualAmount());

        rocketMQTemplate.send(
            "order-topic:created",
            MessageBuilder.withPayload(event).build()
        );

        return OrderVO.from(order);
    }
}

// 通知服务监听订单创建事件
@Component
@RocketMQMessageListener(
    topic = "order-topic",
    selectorExpression = "created",
    consumerGroup = "notice-order-created-group"
)
public class OrderCreatedNoticeConsumer implements RocketMQListener<OrderCreatedEvent> {

    @Autowired
    private NoticeService noticeService;

    @Override
    public void onMessage(OrderCreatedEvent event) {
        log.info("收到订单创建事件: orderId={}", event.getOrderId());
        // 发送下单成功短信/站内信
        noticeService.sendOrderCreatedNotice(event.getUserId(), event.getOrderId());
    }
}
```

***

## 二、数据库设计

### 2.1 ER 核心表设计

#### 2.1.1 用户表 (user)

```sql
CREATE TABLE `user` (
    `id`            BIGINT       NOT NULL COMMENT '用户ID（雪花算法）',
    `username`      VARCHAR(32)  NOT NULL COMMENT '用户名',
    `password`      VARCHAR(128) NOT NULL COMMENT '加密密码',
    `phone`         VARCHAR(16)  DEFAULT NULL COMMENT '手机号',
    `email`         VARCHAR(64)  DEFAULT NULL COMMENT '邮箱',
    `nickname`      VARCHAR(64)  DEFAULT NULL COMMENT '昵称',
    `avatar`        VARCHAR(256) DEFAULT NULL COMMENT '头像URL',
    `gender`        TINYINT      DEFAULT 0 COMMENT '性别：0-未知 1-男 2-女',
    `status`        TINYINT      DEFAULT 1 COMMENT '状态：0-禁用 1-正常',
    `level`         TINYINT      DEFAULT 0 COMMENT '会员等级：0-普通 1-白银 2-黄金 3-钻石',
    `points`        INT          DEFAULT 0 COMMENT '积分',
    `last_login_ip` VARCHAR(32)  DEFAULT NULL COMMENT '最后登录IP',
    `last_login_time` DATETIME   DEFAULT NULL COMMENT '最后登录时间',
    `create_time`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted`       TINYINT      DEFAULT 0 COMMENT '逻辑删除：0-未删除 1-已删除',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_username` (`username`),
    UNIQUE KEY `uk_phone` (`phone`),
    KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';
```

#### 2.1.2 商品表 (product)

```sql
CREATE TABLE `product` (
    `id`              BIGINT       NOT NULL COMMENT '商品ID（雪花算法）',
    `category_id`     BIGINT       NOT NULL COMMENT '分类ID',
    `brand_id`        BIGINT       DEFAULT NULL COMMENT '品牌ID',
    `name`            VARCHAR(128) NOT NULL COMMENT '商品名称',
    `subtitle`        VARCHAR(256) DEFAULT NULL COMMENT '副标题',
    `description`     TEXT         DEFAULT NULL COMMENT '商品描述（富文本）',
    `main_image`      VARCHAR(256) DEFAULT NULL COMMENT '主图URL',
    `images`          JSON         DEFAULT NULL COMMENT '轮播图列表',
    `status`          TINYINT      DEFAULT 0 COMMENT '状态：0-下架 1-上架 2-待审核',
    `sales_count`     INT          DEFAULT 0 COMMENT '销量',
    `is_new`          TINYINT      DEFAULT 0 COMMENT '是否新品：0-否 1-是',
    `is_hot`          TINYINT      DEFAULT 0 COMMENT '是否热销：0-否 1-是',
    `create_time`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted`         TINYINT      DEFAULT 0,
    PRIMARY KEY (`id`),
    KEY `idx_category_id` (`category_id`),
    KEY `idx_status` (`status`),
    KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品表（SPU）';
```

#### 2.1.3 SKU 表 (sku)

```sql
CREATE TABLE `sku` (
    `id`              BIGINT       NOT NULL COMMENT 'SKU ID（雪花算法）',
    `product_id`      BIGINT       NOT NULL COMMENT '所属商品ID',
    `name`            VARCHAR(128) NOT NULL COMMENT 'SKU名称（如：iPhone 14 Pro 256G 深空灰）',
    `attrs`           JSON         DEFAULT NULL COMMENT '销售属性组合 [{attrId:1,attrValue:"红色"},{attrId:2,attrValue:"XL"}]',
    `price`           DECIMAL(12,2) NOT NULL COMMENT '售价',
    `original_price`  DECIMAL(12,2) DEFAULT NULL COMMENT '原价',
    `stock`           INT          DEFAULT 0 COMMENT '库存数量',
    `lock_stock`      INT          DEFAULT 0 COMMENT '锁定库存',
    `image`           VARCHAR(256) DEFAULT NULL COMMENT 'SKU图片',
    `weight`          DECIMAL(10,2) DEFAULT 0 COMMENT '重量（kg）',
    `sales_count`     INT          DEFAULT 0 COMMENT '销量',
    `status`          TINYINT      DEFAULT 1 COMMENT '状态：0-禁用 1-启用',
    `create_time`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted`         TINYINT      DEFAULT 0,
    PRIMARY KEY (`id`),
    KEY `idx_product_id` (`product_id`),
    KEY `idx_price` (`price`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SKU表（库存量单位）';
```

#### 2.1.4 订单表 (order)

```sql
CREATE TABLE `order` (
    `id`              BIGINT         NOT NULL COMMENT '订单ID（雪花算法）',
    `order_no`        VARCHAR(32)    NOT NULL COMMENT '订单编号（业务标识）',
    `user_id`         BIGINT         NOT NULL COMMENT '用户ID',
    `total_amount`    DECIMAL(12,2)  NOT NULL COMMENT '订单总金额',
    `discount_amount` DECIMAL(12,2)  DEFAULT 0.00 COMMENT '优惠金额',
    `freight_amount`  DECIMAL(10,2)  DEFAULT 0.00 COMMENT '运费金额',
    `actual_amount`   DECIMAL(12,2)  NOT NULL COMMENT '实付金额',
    `payment_method`  TINYINT        DEFAULT NULL COMMENT '支付方式：1-微信 2-支付宝 3-银联',
    `status`          TINYINT        NOT NULL DEFAULT 0 COMMENT '订单状态：0-待支付 1-待发货 2-已发货 3-已完成 4-已取消 5-售后中',
    `source`          TINYINT        DEFAULT 1 COMMENT '订单来源：1-App 2-Web 3-小程序 4-API',
    `consignee`       VARCHAR(32)    NOT NULL COMMENT '收货人姓名',
    `consignee_phone` VARCHAR(16)    NOT NULL COMMENT '收货人电话',
    `consignee_address` VARCHAR(256) NOT NULL COMMENT '收货地址',
    `delivery_company` VARCHAR(32)   DEFAULT NULL COMMENT '快递公司',
    `delivery_no`     VARCHAR(64)    DEFAULT NULL COMMENT '快递单号',
    `remark`          VARCHAR(256)   DEFAULT NULL COMMENT '订单备注',
    `pay_time`        DATETIME       DEFAULT NULL COMMENT '支付时间',
    `delivery_time`   DATETIME       DEFAULT NULL COMMENT '发货时间',
    `confirm_time`    DATETIME       DEFAULT NULL COMMENT '确认收货时间',
    `create_time`     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted`         TINYINT        DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_order_no` (`order_no`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_status` (`status`),
    KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单表';

-- === 注意：order 表名在 MySQL 中是关键字，实际使用时建议用 `t_order` 或 `orders` ===
```

#### 2.1.5 订单项表 (order\_item)

```sql
CREATE TABLE `order_item` (
    `id`              BIGINT         NOT NULL COMMENT '订单项ID',
    `order_id`        BIGINT         NOT NULL COMMENT '订单ID',
    `order_no`        VARCHAR(32)    NOT NULL COMMENT '订单编号',
    `user_id`         BIGINT         NOT NULL COMMENT '用户ID（用于分片）',
    `sku_id`          BIGINT         NOT NULL COMMENT 'SKU ID',
    `product_id`      BIGINT         NOT NULL COMMENT '商品ID',
    `product_name`    VARCHAR(128)   NOT NULL COMMENT '商品名称',
    `sku_attrs`       JSON           DEFAULT NULL COMMENT 'SKU属性快照',
    `product_image`   VARCHAR(256)   DEFAULT NULL COMMENT '商品图片',
    `price`           DECIMAL(12,2)  NOT NULL COMMENT '单价',
    `quantity`        INT            NOT NULL COMMENT '购买数量',
    `subtotal`        DECIMAL(12,2)  NOT NULL COMMENT '小计金额',
    `create_time`     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted`         TINYINT        DEFAULT 0,
    PRIMARY KEY (`id`),
    KEY `idx_order_id` (`order_id`),
    KEY `idx_sku_id` (`sku_id`),
    KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单项表';
```

#### 2.1.6 支付记录表 (payment\_record)

```sql
CREATE TABLE `payment_record` (
    `id`              BIGINT         NOT NULL COMMENT '支付记录ID',
    `pay_no`          VARCHAR(64)    NOT NULL COMMENT '支付流水号（支付系统生成）',
    `order_no`        VARCHAR(32)    NOT NULL COMMENT '订单编号',
    `user_id`         BIGINT         NOT NULL COMMENT '用户ID',
    `pay_method`      TINYINT        NOT NULL COMMENT '支付方式：1-微信 2-支付宝',
    `amount`          DECIMAL(12,2)  NOT NULL COMMENT '支付金额',
    `currency`        VARCHAR(8)     DEFAULT 'CNY' COMMENT '币种',
    `status`          TINYINT        NOT NULL DEFAULT 0 COMMENT '支付状态：0-待支付 1-支付成功 2-支付失败 3-已退款',
    `third_pay_no`    VARCHAR(128)   DEFAULT NULL COMMENT '第三方支付流水号（微信/支付宝）',
    `pay_time`        DATETIME       DEFAULT NULL COMMENT '支付成功时间',
    `notify_data`     JSON           DEFAULT NULL COMMENT '回调通知原始数据',
    `create_time`     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted`         TINYINT        DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_pay_no` (`pay_no`),
    UNIQUE KEY `uk_order_no` (`order_no`),
    KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='支付记录表';
```

#### 2.1.7 库存表 (stock)

```sql
CREATE TABLE `stock` (
    `id`              BIGINT       NOT NULL COMMENT '库存ID',
    `sku_id`          BIGINT       NOT NULL COMMENT 'SKU ID',
    `warehouse_id`    BIGINT       NOT NULL COMMENT '仓库ID',
    `quantity`        INT          NOT NULL DEFAULT 0 COMMENT '实际库存',
    `locked_quantity` INT          NOT NULL DEFAULT 0 COMMENT '锁定库存（已下单未支付）',
    `available_quantity` INT      NOT NULL DEFAULT 0 COMMENT '可用库存 = quantity - locked_quantity',
    `version`         INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本号',
    `create_time`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted`         TINYINT      DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_sku_warehouse` (`sku_id`, `warehouse_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='库存表';
```

#### 2.1.8 物流表 (logistics)

```sql
CREATE TABLE `logistics` (
    `id`              BIGINT       NOT NULL COMMENT '物流ID',
    `order_no`        VARCHAR(32)  NOT NULL COMMENT '订单编号',
    `user_id`         BIGINT       NOT NULL COMMENT '用户ID',
    `delivery_company` VARCHAR(32) NOT NULL COMMENT '快递公司',
    `delivery_no`     VARCHAR(64)  NOT NULL COMMENT '快递单号',
    `status`          TINYINT      DEFAULT 0 COMMENT '物流状态：0-待揽收 1-运输中 2-派送中 3-已签收 4-异常',
    `sender_name`     VARCHAR(32)  DEFAULT NULL COMMENT '发货人',
    `sender_address`  VARCHAR(256) DEFAULT NULL COMMENT '发货地址',
    `consignee_name`  VARCHAR(32)  DEFAULT NULL COMMENT '收货人',
    `consignee_address` VARCHAR(256) DEFAULT NULL COMMENT '收货地址',
    `create_time`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted`         TINYINT      DEFAULT 0,
    PRIMARY KEY (`id`),
    KEY `idx_order_no` (`order_no`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_delivery_no` (`delivery_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='物流表';

CREATE TABLE `logistics_trace` (
    `id`              BIGINT       NOT NULL COMMENT '轨迹ID',
    `logistics_id`    BIGINT       NOT NULL COMMENT '物流ID',
    `trace_time`      DATETIME     NOT NULL COMMENT '轨迹时间',
    `location`        VARCHAR(128) DEFAULT NULL COMMENT '所在地',
    `description`     VARCHAR(256) NOT NULL COMMENT '轨迹描述',
    `create_time`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_logistics_id` (`logistics_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='物流轨迹表';
```

### 2.2 主键策略：雪花算法

所有表的主键均使用 **雪花算法（Snowflake）** 生成 64 位 Long 型 ID，结构如下：

```
  0         41         51          64
 ├─┼─────────┼──────────┼──────────┤
 │0│ 时间戳  │ 机器ID   │ 序列号   │
 ├─┼─────────┼──────────┼──────────┤
 1bit      41bit      10bit      12bit
```

* 1 bit：符号位，恒为 0
* 41 bit：毫秒级时间戳（可使用 69 年）
* 10 bit：机器 ID（5bit 机房 + 5bit 机器，支持 1024 个节点）
* 12 bit：同一毫秒内的序列号（支持 4096 个并发 ID）

```java
/**
 * 雪花算法 ID 生成器
 */
@Component
public class SnowflakeIdGenerator {

    /** 开始时间戳：2023-01-01 00:00:00 */
    private static final long START_EPOCH = 1672502400000L;

    /** 机器 ID 所占位数 */
    private static final long WORKER_ID_BITS = 10L;

    /** 序列号所占位数 */
    private static final long SEQUENCE_BITS = 12L;

    /** 最大机器 ID */
    private static final long MAX_WORKER_ID = ~(-1L << WORKER_ID_BITS);

    /** 最大序列号 */
    private static final long MAX_SEQUENCE = ~(-1L << SEQUENCE_BITS);

    /** 机器 ID 左移位数 */
    private static final long WORKER_ID_SHIFT = SEQUENCE_BITS;

    /** 时间戳左移位数 */
    private static final long TIMESTAMP_SHIFT = SEQUENCE_BITS + WORKER_ID_BITS;

    private final long workerId;
    private long sequence = 0L;
    private long lastTimestamp = -1L;

    public SnowflakeIdGenerator(@Value("${snowflake.worker-id:1}") long workerId) {
        if (workerId < 0 || workerId > MAX_WORKER_ID) {
            throw new IllegalArgumentException("workerId out of range: " + workerId);
        }
        this.workerId = workerId;
    }

    public synchronized long nextId() {
        long timestamp = System.currentTimeMillis();

        if (timestamp < lastTimestamp) {
            throw new RuntimeException("Clock moved backwards");
        }

        if (timestamp == lastTimestamp) {
            sequence = (sequence + 1) & MAX_SEQUENCE;
            if (sequence == 0) {
                timestamp = tilNextMillis(lastTimestamp);
            }
        } else {
            sequence = 0L;
        }

        lastTimestamp = timestamp;
        return ((timestamp - START_EPOCH) << TIMESTAMP_SHIFT)
             | (workerId << WORKER_ID_SHIFT)
             | sequence;
    }

    private long tilNextMillis(long lastTimestamp) {
        long timestamp = System.currentTimeMillis();
        while (timestamp <= lastTimestamp) {
            timestamp = System.currentTimeMillis();
        }
        return timestamp;
    }
}
```

### 2.3 分库分表策略

使用 **ShardingSphere** 对订单相关表进行分库分表。

#### 分片策略

| 表 | 分片键 | 分库数量 | 分表数量 | 策略 |
|----|--------|---------|---------|------|
| `t_order` | user\_id | 4 (ds0-ds3) | 128 (0-127) | user\_id % 4 决定库，user\_id % 128 决定表 |
| `t_order_item` | user\_id | 4 | 128 | 与订单表一致，避免跨库 join |
| `payment_record` | user\_id | 4 | 64 | user\_id % 4 决定库 |

#### ShardingSphere 配置

```yaml
# application-order-svc.yml
spring:
  shardingsphere:
    datasource:
      names: ds0,ds1,ds2,ds3
      ds0:
        type: com.zaxxer.hikari.HikariDataSource
        driver-class-name: com.mysql.cj.jdbc.Driver
        jdbc-url: jdbc:mysql://192.168.1.10:3306/order_db_0?useUnicode=true&characterEncoding=utf8mb4&serverTimezone=Asia/Shanghai
        username: root
        password: ${DB_PASSWORD}
      ds1:
        type: com.zaxxer.hikari.HikariDataSource
        driver-class-name: com.mysql.cj.jdbc.Driver
        jdbc-url: jdbc:mysql://192.168.1.11:3306/order_db_1?useUnicode=true&characterEncoding=utf8mb4&serverTimezone=Asia/Shanghai
        username: root
        password: ${DB_PASSWORD}
      ds2:
        type: com.zaxxer.hikari.HikariDataSource
        driver-class-name: com.mysql.cj.jdbc.Driver
        jdbc-url: jdbc:mysql://192.168.1.12:3306/order_db_2?useUnicode=true&characterEncoding=utf8mb4&serverTimezone=Asia/Shanghai
        username: root
        password: ${DB_PASSWORD}
      ds3:
        type: com.zaxxer.hikari.HikariDataSource
        driver-class-name: com.mysql.cj.jdbc.Driver
        jdbc-url: jdbc:mysql://192.168.1.13:3306/order_db_3?useUnicode=true&characterEncoding=utf8mb4&serverTimezone=Asia/Shanghai
        username: root
        password: ${DB_PASSWORD}

    rules:
      sharding:
        tables:
          t_order:
            actual-data-nodes: ds$->{0..3}.t_order_$->{0..127}
            table-strategy:
              standard:
                sharding-column: user_id
                sharding-algorithm-name: order-table-hash
            database-strategy:
              standard:
                sharding-column: user_id
                sharding-algorithm-name: order-db-hash
            key-generate-strategy:
              column: id
              key-generator-name: snowflake
          t_order_item:
            actual-data-nodes: ds$->{0..3}.t_order_item_$->{0..127}
            table-strategy:
              standard:
                sharding-column: user_id
                sharding-algorithm-name: order-table-hash
            database-strategy:
              standard:
                sharding-column: user_id
                sharding-algorithm-name: order-db-hash
            key-generate-strategy:
              column: id
              key-generator-name: snowflake

        sharding-algorithms:
          order-db-hash:
            type: HASH_MOD
            props:
              sharding-count: 4
          order-table-hash:
            type: HASH_MOD
            props:
              sharding-count: 128

        key-generators:
          snowflake:
            type: SNOWFLAKE
            props:
              worker-id: ${SNOWFLAKE_WORKER_ID:1}

    props:
      sql-show: false
      sql-comment-parse-enabled: true
```

### 2.4 读写分离配置

```yaml
# application-product-svc.yml
spring:
  shardingsphere:
    datasource:
      names: write-ds,read-ds-0,read-ds-1
      write-ds:
        type: com.zaxxer.hikari.HikariDataSource
        driver-class-name: com.mysql.cj.jdbc.Driver
        jdbc-url: jdbc:mysql://192.168.1.100:3306/product_db?useUnicode=true&characterEncoding=utf8mb4&serverTimezone=Asia/Shanghai
        username: root
        password: ${DB_PASSWORD}
      read-ds-0:
        type: com.zaxxer.hikari.HikariDataSource
        driver-class-name: com.mysql.cj.jdbc.Driver
        jdbc-url: jdbc:mysql://192.168.1.101:3306/product_db?useUnicode=true&characterEncoding=utf8mb4&serverTimezone=Asia/Shanghai
        username: root
        password: ${DB_PASSWORD}
      read-ds-1:
        type: com.zaxxer.hikari.HikariDataSource
        driver-class-name: com.mysql.cj.jdbc.Driver
        jdbc-url: jdbc:mysql://192.168.1.102:3306/product_db?useUnicode=true&characterEncoding=utf8mb4&serverTimezone=Asia/Shanghai
        username: root
        password: ${DB_PASSWORD}

    rules:
      readwrite-splitting:
        data-sources:
          product-ds:
            write-data-source-name: write-ds
            read-data-source-names: read-ds-0,read-ds-1
            load-balancer-name: round-robin
        load-balancers:
          round-robin:
            type: ROUND_ROBIN

    props:
      sql-show: false
```

***

## 三、用户服务设计

### 3.1 注册 / 登录

#### 3.1.1 JWT Token 认证流程

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│  客户端   │         │ 网关 Gateway │       │ 用户服务  │
└────┬─────┘         └─────┬────┘         └─────┬────┘
     │                     │                     │
     │  POST /auth/login   │                     │
     │  {phone,code/pwd}   │                     │
     ├────────────────────►│                     │
     │                     │  转发至用户服务      │
     │                     ├────────────────────►│
     │                     │                     │ 验证账号密码
     │                     │                     ├──► Redis 刷新 Token
     │                     │ 返回 Token          │ 生成 JWT
     │                     │◄────────────────────┤
     │  200 {accessToken,  │                     │
     │       refreshToken} │                     │
     │◄────────────────────┤                     │
     │                     │                     │
     │  GET /api/user/info │                     │
     │  Authorization:     │                     │
     │  Bearer <token>     │                     │
     ├────────────────────►│                     │
     │                     │ 网关校验 JWT        │
     │                     │ 解析 userId         │
     │                     │ 转发请求 + userId   │
     │                     ├────────────────────►│
     │                     │                     │
     │ 用户信息            │                     │
     │◄────────────────────┤                     │
```

#### 3.1.2 JWT 工具类

```java
@Component
public class JwtTokenProvider {

    @Value("${jwt.secret}")
    private String secretKey;

    @Value("${jwt.access-token-expire:3600000}")     // 默认 1 小时
    private long accessTokenExpireMs;

    @Value("${jwt.refresh-token-expire:604800000}")   // 默认 7 天
    private long refreshTokenExpireMs;

    /**
     * 生成 Access Token
     */
    public String generateAccessToken(Long userId, String username) {
        Date now = new Date();
        return Jwts.builder()
                .setSubject(String.valueOf(userId))
                .claim("username", username)
                .claim("type", "access")
                .setIssuedAt(now)
                .setExpiration(new Date(now.getTime() + accessTokenExpireMs))
                .signWith(SignatureAlgorithm.HS256, secretKey.getBytes(StandardCharsets.UTF_8))
                .compact();
    }

    /**
     * 生成 Refresh Token
     */
    public String generateRefreshToken(Long userId) {
        Date now = new Date();
        return Jwts.builder()
                .setSubject(String.valueOf(userId))
                .claim("type", "refresh")
                .setIssuedAt(now)
                .setExpiration(new Date(now.getTime() + refreshTokenExpireMs))
                .signWith(SignatureAlgorithm.HS256, secretKey.getBytes(StandardCharsets.UTF_8))
                .compact();
    }

    /**
     * 解析 Token 获取用户 ID
     */
    public Long getUserIdFromToken(String token) {
        Claims claims = parseToken(token);
        return Long.parseLong(claims.getSubject());
    }

    /**
     * 验证 Token 是否有效
     */
    public boolean validateToken(String token) {
        try {
            Claims claims = parseToken(token);
            return !claims.getExpiration().before(new Date());
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Token 验证失败: {}", e.getMessage());
            return false;
        }
    }

    private Claims parseToken(String token) {
        return Jwts.parser()
                .setSigningKey(secretKey.getBytes(StandardCharsets.UTF_8))
                .parseClaimsJws(token)
                .getBody();
    }
}
```

#### 3.1.3 注册接口实现

```java
@Service
public class AuthServiceImpl implements AuthService {

    @Autowired
    private UserMapper userMapper;
    @Autowired
    private JwtTokenProvider jwtTokenProvider;
    @Autowired
    private RedisTemplate<String, String> redisTemplate;
    @Autowired
    private SnowflakeIdGenerator idGenerator;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AuthResponse register(RegisterDTO dto) {
        // 1. 校验手机号是否已注册
        User existUser = userMapper.selectByPhone(dto.getPhone());
        if (existUser != null) {
            throw new BizException("该手机号已注册");
        }

        // 2. 校验验证码
        String codeKey = "SMS:REGISTER:" + dto.getPhone();
        String cachedCode = redisTemplate.opsForValue().get(codeKey);
        if (!dto.getSmsCode().equals(cachedCode)) {
            throw new BizException("验证码错误或已过期");
        }

        // 3. 创建用户
        User user = new User();
        user.setId(idGenerator.nextId());
        user.setUsername(dto.getPhone());  // 默认手机号为用户名
        user.setPassword(PasswordEncoder.encode(dto.getPassword()));
        user.setPhone(dto.getPhone());
        user.setNickname("用户" + dto.getPhone().substring(dto.getPhone().length() - 4));
        user.setLevel(0);
        user.setPoints(0);
        user.setStatus(1);
        userMapper.insert(user);

        // 4. 清除验证码缓存
        redisTemplate.delete(codeKey);

        // 5. 生成 Token
        String accessToken = jwtTokenProvider.generateAccessToken(user.getId(), user.getUsername());
        String refreshToken = jwtTokenProvider.generateRefreshToken(user.getId());

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .expiresIn(3600)
                .userId(user.getId())
                .build();
    }

    @Override
    public AuthResponse login(LoginDTO dto) {
        // 1. 查询用户
        User user = userMapper.selectByPhone(dto.getPhone());
        if (user == null) {
            throw new BizException("用户不存在");
        }
        if (user.getStatus() == 0) {
            throw new BizException("账号已被禁用");
        }

        // 2. 校验密码
        if (!PasswordEncoder.matches(dto.getPassword(), user.getPassword())) {
            throw new BizException("密码错误");
        }

        // 3. 更新最后登录信息
        userMapper.updateLastLogin(user.getId(), IpUtil.getIpAddr(), new Date());

        // 4. 生成 Token
        String accessToken = jwtTokenProvider.generateAccessToken(user.getId(), user.getUsername());
        String refreshToken = jwtTokenProvider.generateRefreshToken(user.getId());

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .expiresIn(3600)
                .userId(user.getId())
                .build();
    }
}
```

#### 3.1.4 网关 JWT 鉴权过滤器

```java
@Component
public class JwtAuthGatewayFilterFactory
        extends AbstractGatewayFilterFactory<Object> {

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    /** 白名单路径 */
    private static final List<String> WHITE_LIST = Arrays.asList(
        "/auth/login", "/auth/register", "/auth/refresh",
        "/auth/sms-code", "/product/search", "/product/detail"
    );

    @Override
    public GatewayFilter apply(Object config) {
        return (exchange, chain) -> {
            ServerHttpRequest request = exchange.getRequest();
            String path = request.getURI().getPath();

            // 白名单直接放行
            if (WHITE_LIST.stream().anyMatch(path::contains)) {
                return chain.filter(exchange);
            }

            // 获取 Token
            String authHeader = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                return unauthorized(exchange, "缺少认证 Token");
            }

            String token = authHeader.substring(7);
            if (!jwtTokenProvider.validateToken(token)) {
                return unauthorized(exchange, "Token 无效或已过期");
            }

            // 将用户 ID 放入请求头，传递给下游服务
            Long userId = jwtTokenProvider.getUserIdFromToken(token);
            ServerHttpRequest mutatedRequest = request.mutate()
                    .header("X-User-Id", String.valueOf(userId))
                    .build();

            return chain.filter(exchange.mutate().request(mutatedRequest).build());
        };
    }

    private Mono<Void> unauthorized(ServerWebExchange exchange, String msg) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        byte[] body = JsonUtil.toJson(Result.error(401, msg)).getBytes(StandardCharsets.UTF_8);
        return response.writeWith(Mono.just(response.bufferFactory().wrap(body)));
    }
}
```

### 3.2 用户地址管理

```java
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("user_address")
public class UserAddress {
    @TableId
    private Long id;
    private Long userId;
    private String consignee;
    private String phone;
    private String province;
    private String city;
    private String district;
    private String detailAddress;
    private String postalCode;
    private Boolean isDefault;   // 是否默认地址
    private Integer status;      // 0-无效 1-有效
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}

// ---- Service ----

@Service
public class AddressServiceImpl implements AddressService {

    @Autowired
    private UserAddressMapper addressMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Long addAddress(AddressAddDTO dto, Long userId) {
        // 如果设置为默认地址，先取消其他默认地址
        if (dto.getIsDefault()) {
            addressMapper.cancelDefaultByUserId(userId);
        }

        UserAddress address = new UserAddress();
        BeanUtils.copyProperties(dto, address);
        address.setId(idGenerator.nextId());
        address.setUserId(userId);
        address.setStatus(1);
        addressMapper.insert(address);
        return address.getId();
    }

    @Override
    public List<UserAddressVO> listByUserId(Long userId) {
        LambdaQueryWrapper<UserAddress> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(UserAddress::getUserId, userId)
               .eq(UserAddress::getStatus, 1)
               .orderByDesc(UserAddress::getIsDefault)
               .orderByDesc(UserAddress::getCreateTime);
        return addressMapper.selectList(wrapper).stream()
                .map(this::toVO)
                .collect(Collectors.toList());
    }

    private UserAddressVO toVO(UserAddress address) {
        UserAddressVO vo = new UserAddressVO();
        BeanUtils.copyProperties(address, vo);
        return vo;
    }
}
```

### 3.3 用户等级与积分

```java
/**
 * 用户等级枚举
 */
public enum UserLevel {
    NORMAL(0, "普通会员", 0),
    SILVER(1, "白银会员", 1000),
    GOLD(2, "黄金会员", 5000),
    DIAMOND(3, "钻石会员", 20000);

    public final int code;
    public final String desc;
    public final int minPoints;

    UserLevel(int code, String desc, int minPoints) {
        this.code = code;
        this.desc = desc;
        this.minPoints = minPoints;
    }

    public static UserLevel getLevelByPoints(int points) {
        UserLevel[] levels = UserLevel.values();
        for (int i = levels.length - 1; i >= 0; i--) {
            if (points >= levels[i].minPoints) {
                return levels[i];
            }
        }
        return NORMAL;
    }
}

/**
 * 积分服务
 */
@Service
public class PointsServiceImpl implements PointsService {

    @Autowired
    private UserMapper userMapper;
    @Autowired
    private RocketMQTemplate rocketMQTemplate;

    /** 积分获取比例（每消费 1 元积 1 分） */
    private static final int POINTS_RATE = 1;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void addPoints(Long userId, BigDecimal amount) {
        // 1. 计算应得积分
        int earnedPoints = amount.multiply(BigDecimal.valueOf(POINTS_RATE)).intValue();
        if (earnedPoints <= 0) return;

        // 2. 更新用户积分（FOR UPDATE 防止并发）
        User user = userMapper.selectByIdForUpdate(userId);
        int newPoints = user.getPoints() + earnedPoints;
        userMapper.updatePoints(userId, newPoints);

        // 3. 判断是否需要升级
        UserLevel currentLevel = UserLevel.getLevelByPoints(user.getPoints());
        UserLevel newLevel = UserLevel.getLevelByPoints(newPoints);
        if (newLevel.code > currentLevel.code) {
            userMapper.updateLevel(userId, newLevel.code);
            // 发送等级提升通知
            rocketMQTemplate.send("user-topic:level-up",
                MessageBuilder.withPayload(new LevelUpEvent(userId, newLevel.desc)).build());
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deductPoints(Long userId, int points) {
        User user = userMapper.selectByIdForUpdate(userId);
        if (user.getPoints() < points) {
            throw new BizException("积分不足");
        }
        userMapper.updatePoints(userId, user.getPoints() - points);
    }
}
```

***

## 四、商品服务设计

### 4.1 SPU / SKU 模型

```
                     ┌─────────────────────┐
                     │      SPU 商品        │
                     │   Product（标准化产品单元） │
                     │   例：iPhone 14 Pro   │
                     └──────────┬──────────┘
                                │ 一对多
                   ┌────────────┴────────────┐
                   │                         │
           ┌───────▼───────┐       ┌─────────▼────────┐
           │  SKU 库存量单位  │  ...  │   SKU 库存量单位   │
           │  深空灰 256G   │       │   金色 512G      │
           │  价格: ¥8999   │       │   价格: ¥10699   │
           │  库存: 500     │       │   库存: 300      │
           └───────────────┘       └──────────────────┘
```

```java
/**
 * SPU（Standard Product Unit）- 标准化产品单元
 */
@Data
@TableName("product")
public class Product {
    @TableId
    private Long id;
    private Long categoryId;
    private Long brandId;
    private String name;
    private String subtitle;
    private String description;     // 富文本描述
    private String mainImage;
    private String images;          // JSON [{url:"",sort:1}]
    private Integer status;         // 0-下架 1-上架 2-待审核
    private Integer salesCount;
    private Boolean isNew;
    private Boolean isHot;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}

/**
 * SKU（Stock Keeping Unit）- 库存量单位
 */
@Data
@TableName("sku")
public class Sku {
    @TableId
    private Long id;
    private Long productId;
    private String name;
    private String attrs;           // JSON [{"attrId":1,"attrName":"颜色","attrValue":"深空灰"}]
    private BigDecimal price;
    private BigDecimal originalPrice;
    private Integer stock;
    private Integer lockStock;
    private String image;
    private BigDecimal weight;
    private Integer salesCount;
    private Integer status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}

/**
 * 销售属性定义
 */
@Data
@TableName("product_attr")
public class ProductAttr {
    @TableId
    private Long id;
    private Long categoryId;        // 所属分类
    private String attrName;        // 属性名（如：颜色、尺寸）
    private Integer inputType;      // 输入方式：0-下拉选择 1-手动输入
    private List<String> attrValues;// 可选值列表 ["红色","蓝色","黑色"]
    private Integer sort;
}

/**
 * 商品-属性关联
 */
@Data
@TableName("product_attr_value")
public class ProductAttrValue {
    private Long id;
    private Long productId;
    private Long attrId;
    private String attrValue;       // SPU级别的属性值
    private Integer sort;
}
```

### 4.2 商品分类（多级分类）

```sql
CREATE TABLE `category` (
    `id`          BIGINT       NOT NULL COMMENT '分类ID',
    `parent_id`   BIGINT       NOT NULL DEFAULT 0 COMMENT '父级ID（0为顶级）',
    `name`        VARCHAR(32)  NOT NULL COMMENT '分类名称',
    `level`       TINYINT      NOT NULL COMMENT '层级：1-一级 2-二级 3-三级',
    `icon`        VARCHAR(256) DEFAULT NULL COMMENT '图标URL',
    `sort`        INT          DEFAULT 0 COMMENT '排序字段',
    `status`      TINYINT      DEFAULT 1 COMMENT '状态：0-隐藏 1-显示',
    `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted`     TINYINT      DEFAULT 0,
    PRIMARY KEY (`id`),
    KEY `idx_parent_id` (`parent_id`),
    KEY `idx_level` (`level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品分类表';
```

```java
/**
 * 分类树结构
 */
@Data
public class CategoryVO {
    private Long id;
    private String name;
    private Long parentId;
    private Integer level;
    private String icon;
    private Integer sort;
    private List<CategoryVO> children;    // 子分类列表
}

@Service
public class CategoryServiceImpl implements CategoryService {

    @Autowired
    private CategoryMapper categoryMapper;

    /**
     * 获取全部分类树（缓存到 Redis）
     */
    @Override
    public List<CategoryVO> getCategoryTree() {
        // 从缓存获取
        String cacheKey = RedisKeys.CATEGORY_TREE;
        String cached = redisTemplate.opsForValue().get(cacheKey);
        if (cached != null) {
            return JsonUtil.parseList(cached, CategoryVO.class);
        }

        // 查询全部
        List<Category> allCategories = categoryMapper.selectList(
            new LambdaQueryWrapper<Category>()
                .eq(Category::getStatus, 1)
                .orderByAsc(Category::getSort)
        );

        // 构建树
        List<CategoryVO> tree = buildTree(allCategories, 0L);

        // 写入缓存（30分钟过期）
        redisTemplate.opsForValue().set(cacheKey, JsonUtil.toJson(tree), 30, TimeUnit.MINUTES);

        return tree;
    }

    private List<CategoryVO> buildTree(List<Category> all, Long parentId) {
        return all.stream()
                .filter(c -> c.getParentId().equals(parentId))
                .map(c -> {
                    CategoryVO vo = new CategoryVO();
                    BeanUtils.copyProperties(c, vo);
                    vo.setChildren(buildTree(all, c.getId()));
                    return vo;
                })
                .collect(Collectors.toList());
    }
}
```

### 4.3 商品搜索（Elasticsearch 集成）

#### 4.3.1 ES 索引映射

```json
PUT /product_index
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "analysis": {
      "analyzer": {
        "ik_smart_analyzer": {
          "type": "custom",
          "tokenizer": "ik_smart"
        },
        "ik_max_word_analyzer": {
          "type": "custom",
          "tokenizer": "ik_max_word"
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "productId":     { "type": "long" },
      "categoryId":    { "type": "long" },
      "categoryName":  { "type": "keyword" },
      "brandName":     { "type": "keyword" },
      "name":          { "type": "text", "analyzer": "ik_max_word", "search_analyzer": "ik_smart" },
      "subtitle":      { "type": "text", "analyzer": "ik_smart" },
      "mainImage":     { "type": "keyword", "index": false },
      "minPrice":      { "type": "double" },
      "maxPrice":      { "type": "double" },
      "salesCount":    { "type": "integer" },
      "status":        { "type": "byte" },
      "isNew":         { "type": "boolean" },
      "isHot":         { "type": "boolean" },
      "skuList": {
        "type": "nested",
        "properties": {
          "skuId":    { "type": "long" },
          "price":    { "type": "double" },
          "stock":    { "type": "integer" },
          "attrs":    { "type": "nested" }
        }
      },
      "createTime":    { "type": "date", "format": "yyyy-MM-dd HH:mm:ss" }
    }
  }
}
```

#### 4.3.2 商品数据同步（MQ 驱动）

```java
/**
 * 商品数据同步到 ES
 */
@Component
public class ProductSyncConsumer implements RocketMQListener<ProductSyncEvent> {

    @Autowired
    private ElasticsearchRestTemplate esTemplate;

    @Override
    public void onMessage(ProductSyncEvent event) {
        log.info("同步商品到 ES: productId={}", event.getProductId());

        ProductDocument doc = ProductDocument.builder()
                .productId(event.getProductId())
                .name(event.getName())
                .subtitle(event.getSubtitle())
                .minPrice(event.getMinPrice())
                .salesCount(event.getSalesCount())
                .status(event.getStatus())
                .isNew(event.getIsNew())
                .isHot(event.getIsHot())
                .categoryId(event.getCategoryId())
                .categoryName(event.getCategoryName())
                .mainImage(event.getMainImage())
                .skuList(event.getSkuList())
                .createTime(event.getCreateTime())
                .build();

        IndexQuery query = new IndexQueryBuilder()
                .withId(String.valueOf(event.getProductId()))
                .withObject(doc)
                .build();

        esTemplate.index(query, IndexCoordinates.of("product_index"));
    }
}
```

#### 4.3.3 商品搜索 API

```java
@Service
public class ProductSearchServiceImpl implements ProductSearchService {

    @Autowired
    private ElasticsearchRestTemplate esTemplate;

    @Override
    public PageResult<ProductVO> search(ProductSearchDTO dto) {
        // 1. 构建查询条件
        NativeSearchQueryBuilder queryBuilder = new NativeSearchQueryBuilder();

        // 1.1 关键字搜索（多字段匹配）
        if (StringUtils.hasText(dto.getKeyword())) {
            queryBuilder.withQuery(QueryBuilders.multiMatchQuery(dto.getKeyword(), "name", "subtitle")
                    .operator(Operator.OR));
        }

        // 1.2 分类过滤
        if (dto.getCategoryId() != null) {
            queryBuilder.withFilter(QueryBuilders.termQuery("categoryId", dto.getCategoryId()));
        }

        // 1.3 品牌过滤
        if (dto.getBrandId() != null) {
            queryBuilder.withFilter(QueryBuilders.termQuery("brandId", dto.getBrandId()));
        }

        // 1.4 价格区间过滤
        if (dto.getMinPrice() != null || dto.getMaxPrice() != null) {
            queryBuilder.withFilter(QueryBuilders.rangeQuery("minPrice")
                    .gte(dto.getMinPrice()).lte(dto.getMaxPrice()));
        }

        // 1.5 排序
        switch (dto.getSortBy()) {
            case "price_asc" -> queryBuilder.withSort(SortBuilders.fieldSort("minPrice").order(SortOrder.ASC));
            case "price_desc" -> queryBuilder.withSort(SortBuilders.fieldSort("minPrice").order(SortOrder.DESC));
            case "sales" -> queryBuilder.withSort(SortBuilders.fieldSort("salesCount").order(SortOrder.DESC));
            default -> queryBuilder.withSort(SortBuilders.scoreSort().order(SortOrder.DESC));
        }

        // 1.6 分页
        queryBuilder.withPageable(PageRequest.of(dto.getPageNum() - 1, dto.getPageSize()));

        // 1.7 高亮
        HighlightBuilder highlightBuilder = new HighlightBuilder();
        highlightBuilder.field("name").preTags("<em>").postTags("</em>");
        queryBuilder.withHighlightBuilder(highlightBuilder);

        // 2. 执行查询
        SearchHits<ProductDocument> searchHits = esTemplate.search(
                queryBuilder.build(), ProductDocument.class, IndexCoordinates.of("product_index"));

        // 3. 结果转换
        List<ProductVO> list = searchHits.getSearchHits().stream()
                .map(hit -> {
                    ProductDocument doc = hit.getContent();
                    ProductVO vo = new ProductVO();
                    BeanUtils.copyProperties(doc, vo);
                    // 替换高亮内容
                    Map<String, List<String>> highlightFields = hit.getHighlightFields();
                    if (highlightFields.containsKey("name")) {
                        vo.setName(highlightFields.get("name").get(0));
                    }
                    return vo;
                })
                .collect(Collectors.toList());

        return PageResult.of(list, searchHits.getTotalHits(), dto.getPageNum(), dto.getPageSize());
    }
}
```

### 4.4 商品详情缓存（Redis + Caffeine 多级缓存）

```java
/**
 * 多级缓存配置
 */
@Configuration
public class CacheConfig {

    /**
     * 本地缓存（Caffeine）
     */
    @Bean("caffeineCache")
    public Cache<String, Object> caffeineCache() {
        return Caffeine.newBuilder()
                .initialCapacity(256)           // 初始容量
                .maximumSize(10_000)             // 最大容量 10000 条
                .expireAfterWrite(5, TimeUnit.MINUTES)  // 写入后 5 分钟过期
                .recordStats()                   // 记录统计信息
                .build();
    }
}

/**
 * 多级缓存实现
 */
@Component
public class MultiLevelCacheService {

    @Autowired
    private Cache<String, Object> caffeineCache;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    /**
     * 商品详情缓存
     * 缓存策略：Caffeine（一级） -> Redis（二级） -> DB（三级）
     */
    public ProductDetailVO getProductDetail(Long productId) {
        String cacheKey = RedisKeys.PRODUCT_DETAIL + productId;

        // 1. 查 Caffeine（本地缓存）
        ProductDetailVO detail = (ProductDetailVO) caffeineCache.getIfPresent(cacheKey);
        if (detail != null) {
            log.debug("一级缓存命中: {}", cacheKey);
            return detail;
        }

        // 2. 查 Redis
        Object redisData = redisTemplate.opsForValue().get(cacheKey);
        if (redisData != null) {
            log.debug("二级缓存命中: {}", cacheKey);
            detail = (ProductDetailVO) redisData;
            // 回填 Caffeine
            caffeineCache.put(cacheKey, detail);
            return detail;
        }

        // 3. 查数据库
        log.debug("缓存穿透，查询数据库: productId={}", productId);
        detail = loadFromDb(productId);
        if (detail == null) {
            // 缓存空值，防止缓存穿透
            caffeineCache.put(cacheKey, new ProductDetailVO());
            redisTemplate.opsForValue().set(cacheKey, new ProductDetailVO(), 30, TimeUnit.SECONDS);
            return null;
        }

        // 4. 回填缓存
        caffeineCache.put(cacheKey, detail);
        redisTemplate.opsForValue().set(cacheKey, detail, 1, TimeUnit.HOURS);

        return detail;
    }

    /**
     * 当商品信息变更时，清除缓存
     */
    public void evictProductCache(Long productId) {
        String cacheKey = RedisKeys.PRODUCT_DETAIL + productId;

        // 删除本地缓存
        caffeineCache.invalidate(cacheKey);

        // 删除 Redis 缓存
        redisTemplate.delete(cacheKey);

        log.info("商品缓存已清除: productId={}", productId);
    }

    /**
     * 缓存预热（项目启动时或热门商品过期后重建）
     */
    @PostConstruct
    public void preheatHotProducts() {
        // 查询热销商品 ID 列表
        List<Long> hotProductIds = loadHotProductIds();

        for (Long productId : hotProductIds) {
            ProductDetailVO detail = loadFromDb(productId);
            if (detail != null) {
                String cacheKey = RedisKeys.PRODUCT_DETAIL + productId;
                caffeineCache.put(cacheKey, detail);
                redisTemplate.opsForValue().set(cacheKey, detail, 30, TimeUnit.MINUTES);
            }
        }
        log.info("缓存预热完成，共预热 {} 个商品", hotProductIds.size());
    }
}
```

***

## 五、公共模块

### 5.1 统一响应 Result 类

```java
/**
 * 统一响应包装类
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Result<T> implements Serializable {

    private static final long serialVersionUID = 1L;

    private int code;
    private String msg;
    private T data;

    // ---- 静态工厂方法 ----

    public static <T> Result<T> success() {
        return new Result<>(200, "success", null);
    }

    public static <T> Result<T> success(T data) {
        return new Result<>(200, "success", data);
    }

    public static <T> Result<T> success(String msg, T data) {
        return new Result<>(200, msg, data);
    }

    public static <T> Result<T> error(int code, String msg) {
        return new Result<>(code, msg, null);
    }

    public static <T> Result<T> error(String msg) {
        return new Result<>(500, msg, null);
    }

    public static <T> Result<T> error(ICode codeEnum) {
        return new Result<>(codeEnum.getCode(), codeEnum.getMsg(), null);
    }

    public boolean isSuccess() {
        return this.code == 200;
    }
}

/**
 * 业务错误码接口
 */
public interface ICode {
    int getCode();
    String getMsg();
}

/**
 * 业务错误码枚举
 */
public enum BizCode implements ICode {
    SUCCESS(200, "操作成功"),
    BAD_REQUEST(400, "请求参数错误"),
    UNAUTHORIZED(401, "未登录或 Token 已过期"),
    FORBIDDEN(403, "无权限访问"),
    NOT_FOUND(404, "请求资源不存在"),
    METHOD_NOT_ALLOWED(405, "请求方法不允许"),
    TOO_MANY_REQUESTS(429, "请求过于频繁"),

    // 业务错误码 (100xxx)
    USER_NOT_EXIST(100001, "用户不存在"),
    USER_PASSWORD_ERROR(100002, "密码错误"),
    USER_DISABLED(100003, "账号已被禁用"),
    USER_PHONE_EXIST(100004, "手机号已注册"),

    PRODUCT_NOT_EXIST(200001, "商品不存在"),
    PRODUCT_SOLD_OUT(200002, "商品已下架"),
    SKU_NOT_EXIST(200003, "SKU 不存在"),
    SKU_STOCK_INSUFFICIENT(200004, "库存不足"),

    ORDER_NOT_EXIST(300001, "订单不存在"),
    ORDER_STATUS_ERROR(300002, "订单状态异常"),
    ORDER_CANNOT_CANCEL(300003, "订单不可取消"),

    PAY_FAILED(400001, "支付失败"),

    COUPON_EXPIRED(500001, "优惠券已过期"),
    COUPON_USED(500002, "优惠券已使用"),
    ;

    private final int code;
    private final String msg;

    BizCode(int code, String msg) {
        this.code = code;
        this.msg = msg;
    }

    @Override
    public int getCode() { return code; }

    @Override
    public String getMsg() { return msg; }
}
```

### 5.2 全局异常处理

```java
/**
 * 全局异常处理器
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    /** 参数校验异常 */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Result<Void> handleValidationException(MethodArgumentNotValidException ex) {
        String msg = ex.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .collect(Collectors.joining(", "));
        log.warn("参数校验失败: {}", msg);
        return Result.error(BizCode.BAD_REQUEST.getCode(), msg);
    }

    /** 约束校验异常 */
    @ExceptionHandler(ConstraintViolationException.class)
    public Result<Void> handleConstraintViolation(ConstraintViolationException ex) {
        String msg = ex.getConstraintViolations().stream()
                .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                .collect(Collectors.joining(", "));
        return Result.error(BizCode.BAD_REQUEST.getCode(), msg);
    }

    /** 业务异常 */
    @ExceptionHandler(BizException.class)
    public Result<Void> handleBizException(BizException ex) {
        log.warn("业务异常: code={}, msg={}", ex.getCode(), ex.getMessage());
        return Result.error(ex.getCode() != 0 ? ex.getCode() : BizCode.BAD_REQUEST.getCode(), ex.getMessage());
    }

    /** 参数缺失异常 */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public Result<Void> handleMissingParam(MissingServletRequestParameterException ex) {
        return Result.error(BizCode.BAD_REQUEST.getCode(), "缺少参数: " + ex.getParameterName());
    }

    /** HTTP 请求方法不支持 */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public Result<Void> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex) {
        return Result.error(BizCode.METHOD_NOT_ALLOWED);
    }

    /** 限流异常 */
    @ExceptionHandler(BlockException.class)
    public Result<Void> handleBlockException(BlockException ex) {
        return Result.error(BizCode.TOO_MANY_REQUESTS);
    }

    /** 兜底异常 */
    @ExceptionHandler(Exception.class)
    public Result<Void> handleException(Exception ex) {
        log.error("系统异常", ex);
        return Result.error(BizCode.BAD_REQUEST.getCode(), "系统繁忙，请稍后重试");
    }
}

/**
 * 业务异常类
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class BizException extends RuntimeException {

    private int code;

    public BizException(String msg) {
        super(msg);
        this.code = 0;
    }

    public BizException(int code, String msg) {
        super(msg);
        this.code = code;
    }

    public BizException(ICode codeEnum) {
        super(codeEnum.getMsg());
        this.code = codeEnum.getCode();
    }
}
```

### 5.3 参数校验分组

```java
/**
 * 校验分组：新增
 */
public interface AddGroup {}

/**
 * 校验分组：更新
 */
public interface UpdateGroup {}

/**
 * 校验分组：查询
 */
public interface QueryGroup {}

// ---- 使用示例 ----

@Data
public class ProductCreateDTO {

    @Null(groups = AddGroup.class, message = "新增时 ID 必须为空")
    @NotNull(groups = UpdateGroup.class, message = "更新时 ID 不能为空")
    private Long id;

    @NotBlank(message = "商品名称不能为空")
    @Size(max = 128, message = "商品名称最长128字符")
    private String name;

    @NotNull(message = "分类不能为空")
    private Long categoryId;

    @NotNull(message = "品牌不能为空")
    private Long brandId;

    @NotNull(message = "请设置商品状态")
    private Integer status;

    @NotBlank(message = "主图不能为空")
    private String mainImage;

    @Valid
    @NotEmpty(message = "至少需要一个 SKU")
    private List<SkuDTO> skuList;

    @Data
    public static class SkuDTO {
        @Null(groups = AddGroup.class)
        @NotNull(groups = UpdateGroup.class)
        private Long id;

        @NotBlank(message = "SKU 名称不能为空")
        private String name;

        @NotNull(message = "SKU 价格不能为空")
        @DecimalMin(value = "0.01", message = "价格不能小于0.01")
        private BigDecimal price;

        @NotNull(message = "库存不能为空")
        @Min(value = 0, message = "库存不能为负数")
        private Integer stock;

        private String image;

        private List<SkuAttrDTO> attrs;
    }
}

// ---- Controller 中使用分组 ----

@RestController
@RequestMapping("/api/product")
public class ProductController {

    @PostMapping
    public Result<Long> create(@Validated(AddGroup.class) @RequestBody ProductCreateDTO dto) {
        Long id = productService.create(dto);
        return Result.success(id);
    }

    @PutMapping
    public Result<Void> update(@Validated(UpdateGroup.class) @RequestBody ProductCreateDTO dto) {
        productService.update(dto);
        return Result.success();
    }
}
```

### 5.4 分布式 ID 生成器

除了前文的雪花算法实现外，提供工厂模式支持多种 ID 策略：

```java
/**
 * ID 生成器策略接口
 */
public interface IdGenerator {
    Long nextId();
    String nextIdStr();
}

/**
 * 雪花算法实现
 */
@Component
@ConditionalOnProperty(name = "id-generator.type", havingValue = "snowflake", matchIfMissing = true)
public class SnowflakeIdGenerator implements IdGenerator {
    // ... 实现同前文 ...
}

/**
 * Redis 自增 ID（适用于短 ID 场景如订单号后6位）
 */
@Component
@ConditionalOnProperty(name = "id-generator.type", havingValue = "redis")
public class RedisIdGenerator implements IdGenerator {

    @Autowired
    private StringRedisTemplate redisTemplate;

    private static final String ID_KEY_PREFIX = "ID_GEN:";

    @Override
    public Long nextId() {
        // 使用 Redis INCR 生成每日自增序列
        String key = ID_KEY_PREFIX + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        return redisTemplate.opsForValue().increment(key, 1);
    }

    @Override
    public String nextIdStr() {
        // 生成格式: yyyyMMdd + 6位流水号
        String datePart = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        String seq = String.format("%06d", nextId());
        return datePart + seq;
    }
}

/**
 * ID 生成器工厂
 */
@Component
public class IdGeneratorFactory {

    @Autowired
    private Map<String, IdGenerator> generatorMap;  // Spring 自动注入所有 IdGenerator Bean

    private static final String DEFAULT = "snowflakeIdGenerator";

    public IdGenerator getGenerator(String type) {
        IdGenerator generator = generatorMap.get(type);
        if (generator == null) {
            generator = generatorMap.get(DEFAULT);
        }
        return generator;
    }
}
```

### 5.5 统一配置中心（Nacos）

```yaml
# bootstrap.yml
spring:
  application:
    name: order-svc
  cloud:
    nacos:
      config:
        server-addr: ${NACOS_SERVER:127.0.0.1:8848}
        namespace: ${NACOS_NAMESPACE:dev}
        group: DEFAULT_GROUP
        file-extension: yaml
        # 共享配置
        shared-configs:
          - data-id: common-datasource.yaml
            group: SHARED
            refresh: true
          - data-id: common-redis.yaml
            group: SHARED
            refresh: true
          - data-id: common-rocketmq.yaml
            group: SHARED
            refresh: true
      discovery:
        server-addr: ${NACOS_SERVER:127.0.0.1:8848}
        namespace: ${NACOS_NAMESPACE:dev}
```

**Nacos 配置示例（common-datasource.yaml）：**

```yaml
# common-datasource.yaml - 共享数据源配置
spring:
  datasource:
    type: com.zaxxer.hikari.HikariDataSource
    driver-class-name: com.mysql.cj.jdbc.Driver
    hikari:
      minimum-idle: 5
      maximum-pool-size: 20
      idle-timeout: 300000
      max-lifetime: 1200000
      connection-timeout: 30000
      connection-test-query: SELECT 1

mybatis-plus:
  configuration:
    map-underscore-to-camel-case: true
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl
  global-config:
    db-config:
      logic-delete-field: deleted
      logic-delete-value: 1
      logic-not-delete-value: 0
      id-type: none    # 不自动生成 ID，由应用层雪花算法生成
  mapper-locations: classpath:mapper/*.xml
```

***

## 六、接口设计文档

### 6.1 API 规范（RESTful）

#### 6.1.1 命名规范

| 资源 | HTTP 方法 | URL | 说明 |
|------|-----------|-----|------|
| 用户 | POST | `/api/user/register` | 注册 |
| 用户 | POST | `/api/user/login` | 登录 |
| 用户 | GET | `/api/user/{id}` | 获取用户信息 |
| 用户 | PUT | `/api/user/{id}` | 更新用户信息 |
| 地址 | GET | `/api/user/address/list` | 地址列表 |
| 地址 | POST | `/api/user/address` | 新增地址 |
| 地址 | PUT | `/api/user/address/{id}` | 修改地址 |
| 地址 | DELETE | `/api/user/address/{id}` | 删除地址 |
| 商品 | GET | `/api/product/{id}` | 商品详情 |
| 商品 | POST | `/api/product/page` | 分页查询商品 |
| 商品 | POST | `/api/product` | 创建商品 |
| 商品 | PUT | `/api/product` | 更新商品 |
| 商品 | GET | `/api/product/search` | 搜索商品 |
| 分类 | GET | `/api/category/tree` | 分类树 |
| 订单 | POST | `/api/order` | 创建订单 |
| 订单 | GET | `/api/order/{id}` | 订单详情 |
| 订单 | GET | `/api/order/page` | 我的订单列表 |
| 订单 | PUT | `/api/order/{id}/cancel` | 取消订单 |
| 订单 | PUT | `/api/order/{id}/confirm` | 确认收货 |
| 支付 | POST | `/api/pay/unified-order` | 统一下单 |
| 支付 | POST | `/api/pay/notify/{channel}` | 支付回调 |
| 库存 | GET | `/api/stock/{skuId}` | 查库存 |
| 物流 | GET | `/api/logistics/{orderNo}` | 查物流 |

#### 6.1.2 通用请求头

| 请求头 | 说明 | 是否必填 |
|--------|------|---------|
| `Content-Type` | 固定为 `application/json;charset=utf-8` | 是 |
| `Authorization` | Bearer 格式的 JWT Token | 鉴权接口必填 |
| `X-Request-Id` | 请求追踪 ID，用于链路追踪 | 推荐 |
| `X-User-Id` | 用户 ID（网关解析 Token 后注入） | 鉴权后必含 |
| `Accept-Language` | 语言偏好：zh-CN / en-US | 否 |
| `App-Version` | 客户端版本号 | 否 |
| `Device-Id` | 设备 ID（用于防重放） | 支付相关接口必填 |

### 6.2 统一分页请求/响应

```java
/**
 * 通用分页请求
 */
@Data
public class PageParam {
    @Min(value = 1, message = "页码最小为 1")
    @Max(value = 1000, message = "页码最大为 1000")
    private int pageNum = 1;

    @Min(value = 1, message = "每页条数最小为 1")
    @Max(value = 200, message = "每页条数最大为 200")
    private int pageSize = 20;

    public int getOffset() {
        return (pageNum - 1) * pageSize;
    }
}

/**
 * 分页查询参数（带排序）
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class PageQueryParam extends PageParam {
    private String sortBy;       // 排序字段
    private Boolean sortDesc;    // 是否降序
}

/**
 * 通用分页响应
 */
@Data
public class PageResult<T> implements Serializable {

    private int pageNum;
    private int pageSize;
    private int pages;          // 总页数
    private long total;         // 总条数
    private List<T> list;       // 数据列表

    public static <T> PageResult<T> of(List<T> list, long total, int pageNum, int pageSize) {
        PageResult<T> result = new PageResult<>();
        result.setList(list);
        result.setTotal(total);
        result.setPageNum(pageNum);
        result.setPageSize(pageSize);
        result.setPages((int) (total / pageSize) + (total % pageSize == 0 ? 0 : 1));
        return result;
    }

    /**
     * 从 MyBatis-Plus Page 转换
     */
    public static <T> PageResult<T> from(IPage<T> page) {
        return of(page.getRecords(), page.getTotal(), (int) page.getCurrent(), (int) page.getSize());
    }
}
```

### 6.3 接口签名与防重放

#### 6.3.1 签名机制

适用于开放平台 API（第三方接入），防止请求被篡改和重放攻击。

```
请求头或请求体参数：
  appId         - 应用 ID（平台分配）
  timestamp     - 请求时间戳（毫秒）
  nonce         - 随机字符串（每次请求唯一）
  sign          - 签名字符串

签名算法：
  sign = MD5(appSecret + sort(params) + timestamp + nonce)

验证步骤：
  1. 校验 timestamp 是否在有效时间窗口内（默认 5 分钟）
  2. 校验 nonce 是否已被使用（Redis 记录，过期时间 = 时间窗口）
  3. 校验 sign 是否匹配
```

```java
/**
 * API 签名工具
 */
@Component
public class ApiSignUtil {

    @Value("${api.sign.time-window:300000}")   // 5分钟时间窗口
    private long timeWindow;

    @Autowired
    private StringRedisTemplate redisTemplate;


    /**
     * 验证签名
     */
    public boolean verifySign(SignRequest request) {
        // 1. 验证时间戳
        long now = System.currentTimeMillis();
        if (Math.abs(now - request.getTimestamp()) > timeWindow) {
            log.warn("签名时间戳超时: {}", request.getTimestamp());
            return false;
        }

        // 2. 验证 nonce（防重放）
        String nonceKey = "API:NONCE:" + request.getNonce();
        if (Boolean.TRUE.equals(redisTemplate.hasKey(nonceKey))) {
            log.warn("nonce 重复使用: {}", request.getNonce());
            return false;
        }

        // 3. 存储 nonce（过期时间=时间窗口）
        redisTemplate.opsForValue().set(nonceKey, "1", timeWindow, TimeUnit.MILLISECONDS);

        // 4. 获取 appSecret（从数据库或缓存中根据 appId 查询）
        String appSecret = getAppSecret(request.getAppId());
        if (appSecret == null) {
            log.warn("无效 appId: {}", request.getAppId());
            return false;
        }

        // 5. 计算签名并比对
        String calculatedSign = calculateSign(appSecret, request);
        if (!calculatedSign.equals(request.getSign())) {
            log.warn("签名不匹配: expected={}, actual={}", calculatedSign, request.getSign());
            return false;
        }

        return true;
    }

    /**
     * 计算签名：MD5(appSecret + 排序参数 + timestamp + nonce)
     */
    private String calculateSign(String appSecret, SignRequest request) {
        TreeMap<String, String> params = new TreeMap<>();
        params.put("appId", request.getAppId());
        if (request.getBizParams() != null) {
            params.putAll(request.getBizParams());
        }

        StringBuilder sb = new StringBuilder(appSecret);
        params.forEach((k, v) -> sb.append(k).append("=").append(v).append("&"));
        sb.append(request.getTimestamp()).append(request.getNonce());

        return DigestUtils.md5DigestAsHex(sb.toString().getBytes(StandardCharsets.UTF_8));
    }

    private String getAppSecret(String appId) {
        // 实际应从数据库查询
        return "mock-secret-" + appId;
    }
}

/**
 * 签名请求对象
 */
@Data
public class SignRequest {
    private String appId;
    private Long timestamp;
    private String nonce;
    private String sign;
    private Map<String, String> bizParams;    // 业务参数
}

/**
 * 签名验证注解（AOP 实现）
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface CheckSign {}

/**
 * 签名验证切面
 */
@Aspect
@Component
public class SignCheckAspect {

    @Autowired
    private ApiSignUtil apiSignUtil;

    @Around("@annotation(com.ecommerce.common.annotation.CheckSign)")
    public Object checkSign(ProceedingJoinPoint joinPoint) throws Throwable {
        // 从请求中解析签名参数
        HttpServletRequest request = ((ServletRequestAttributes) RequestContextHolder
                .getRequestAttributes()).getRequest();

        SignRequest signReq = new SignRequest();
        signReq.setAppId(request.getHeader("X-App-Id"));
        signReq.setTimestamp(Long.valueOf(request.getHeader("X-Timestamp")));
        signReq.setNonce(request.getHeader("X-Nonce"));
        signReq.setSign(request.getHeader("X-Sign"));

        // 校验签名
        if (!apiSignUtil.verifySign(signReq)) {
            return Result.error(BizCode.FORBIDDEN.getCode(), "签名验证失败");
        }

        return joinPoint.proceed();
    }
}
```

#### 6.3.2 幂等性设计（防止重复提交）

```java
/**
 * 幂等注解
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Idempotent {
    /** 幂等 Key 前缀 */
    String value() default "";

    /** 过期时间（秒） */
    int expireSeconds() default 30;
}

/**
 * 幂等切面 - 防止重复提交
 */
@Aspect
@Component
public class IdempotentAspect {

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Around("@annotation(idempotent)")
    public Object handleIdempotent(ProceedingJoinPoint joinPoint, Idempotent idempotent) throws Throwable {
        // 构建幂等 Key
        String idempotentKey = buildIdempotentKey(joinPoint, idempotent);

        // 尝试加锁（SET NX EX）
        Boolean success = redisTemplate.opsForValue()
                .setIfAbsent(idempotentKey, "1", Duration.ofSeconds(idempotent.expireSeconds()));

        if (Boolean.FALSE.equals(success)) {
            log.warn("重复请求，幂等 Key: {}", idempotentKey);
            return Result.error("请勿重复提交");
        }

        try {
            return joinPoint.proceed();
        } catch (Exception e) {
            throw e;
        }
    }

    private String buildIdempotentKey(ProceedingJoinPoint joinPoint, Idempotent idempotent) {
        // 从请求头获取幂等 Token（客户端生成）
        HttpServletRequest request = ((ServletRequestAttributes) RequestContextHolder
                .getRequestAttributes()).getRequest();
        String idempotentToken = request.getHeader("X-Idempotent-Token");

        if (StringUtils.hasText(idempotentToken)) {
            return "IDEMPOTENT:" + idempotentToken;
        }

        // 兜底：使用用户 ID + 方法名 + 参数
        Long userId = getCurrentUserId();
        String methodName = joinPoint.getSignature().toShortString();
        String args = Arrays.toString(joinPoint.getArgs());

        return "IDEMPOTENT:" + userId + ":" + methodName + ":" + DigestUtils.md5DigestAsHex(args.getBytes());
    }
}
```

***

## 附录：项目工程结构

```
e-commerce-platform/
├── e-commerce-common/              # 公共模块
│   ├── src/main/java/com/ecommerce/common/
│   │   ├── constant/               # 常量定义
│   │   ├── domain/                 # 统一响应、分页
│   │   ├── exception/              # 统一异常
│   │   ├── util/                   # 工具类
│   │   ├── idgenerator/            # ID 生成器
│   │   ├── validation/             # 校验分组
│   │   └── config/                 # 公共配置
│   └── pom.xml
│
├── e-commerce-gateway/             # 网关服务
│   ├── src/main/java/com/ecommerce/gateway/
│   │   ├── filter/                 # JWT 鉴权、日志、限流
│   │   └── config/                 # 路由配置
│   └── pom.xml
│
├── e-commerce-user-svc/            # 用户服务
│   ├── src/main/java/com/ecommerce/user/
│   │   ├── controller/             # REST 控制器
│   │   ├── service/                # 业务逻辑
│   │   ├── mapper/                 # MyBatis Mapper
│   │   ├── model/                  # DO / DTO / VO
│   │   └── config/                 # 服务配置
│   └── pom.xml
│
├── e-commerce-product-svc/         # 商品服务
│   ├── src/main/java/com/ecommerce/product/
│   │   ├── controller/
│   │   ├── service/
│   │   ├── mapper/
│   │   ├── model/
│   │   ├── search/                 # ES 搜索
│   │   └── cache/                  # 多级缓存
│   └── pom.xml
│
├── e-commerce-order-svc/           # 订单服务
│   ├── src/main/java/com/ecommerce/order/
│   │   ├── controller/
│   │   ├── service/
│   │   ├── mapper/
│   │   ├── model/
│   │   └── mq/                     # MQ 生产者/消费者
│   └── pom.xml
│
├── e-commerce-pay-svc/             # 支付服务
│   ├── src/main/java/com/ecommerce/pay/
│   │   ├── controller/
│   │   ├── service/
│   │   ├── channel/                # 微信/支付宝适配器
│   │   └── model/
│   └── pom.xml
│
├── e-commerce-stock-svc/           # 库存服务
├── e-commerce-logistic-svc/        # 物流服务
├── e-commerce-coupon-svc/          # 优惠券服务
├── e-commerce-notice-svc/          # 通知服务
│
├── docker-compose/                 # Docker 编排
│   ├── docker-compose.yml
│   ├── mysql/
│   ├── redis/
│   ├── nacos/
│   ├── rocketmq/
│   └── elasticsearch/
│
└── docs/                           # 文档
    ├── 系统架构设计.md
    ├── 接口文档.md
    └── 部署文档.md
```

***

> **总结：** 本架构设计方案围绕高并发、高可用、可扩展三大目标，采用 Spring Cloud Alibaba 微服务架构体系，通过合理的服务拆分、分库分表、多级缓存、异步削峰、分布式事务等手段，构建了一个完整的企业级电商系统。实际落地时需根据业务量级逐步演进，初期可适当合并服务，降低运维复杂度。
