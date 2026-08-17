---
url: >-
  /my_notes/notes/JAVA学习路线/shen-du-xue-xi/02-spring-cloud-alibaba-shen-ru/2-seata-fen-bu-shi-shi-wu/index.md
---
# Seata 分布式事务学习文档

## 目录

1. [分布式事务基础](#1-分布式事务基础)
2. [AT 模式（Seata 核心模式）](#2-at-模式seata-核心模式)
3. [TCC 模式](#3-tcc-模式)
4. [SAGA 模式](#4-saga-模式)
5. [XA 模式](#5-xa-模式)
6. [事务隔离](#6-事务隔离)
7. [实战配置](#7-实战配置)
8. [常见问题](#8-常见问题)

***

## 1. 分布式事务基础

### 1.1 CAP 理论与 BASE 理论

**CAP 理论** 是分布式系统的基石，由 Eric Brewer 提出：

| 特性 | 说明 | 含义 |
|------|------|------|
| **C**onsistency（一致性） | 所有节点在同一时刻看到相同的数据 | 写操作完成后，任何后续读都能读到最新值 |
| **A**vailability（可用性） | 每个请求都能获得一个（非错误的）响应 | 系统始终对外提供服务，不因部分节点故障而停止 |
| **P**artition Tolerance（分区容错性） | 系统在出现网络分区时仍能正常运行 | 即使节点间通信中断，系统仍能工作 |

> **核心结论**：分布式系统中，P 是必须保证的，C 和 A 只能二选一。网络分区必然发生，因此必须在 CP 和 AP 之间做取舍。

**BASE 理论** 是对 CAP 中 AP 方案的延伸：

| 要素 | 说明 | 实践方式 |
|------|------|----------|
| **BA** - Basically Available（基本可用） | 系统允许部分功能降级 | 限流、降级、缓存 |
| **S** - Soft State（软状态） | 允许数据存在中间状态 | 状态在时间窗口内最终一致 |
| **E** - Eventually Consistent（最终一致） | 经过一定时间后数据达到一致 | 异步补偿、重试机制 |

### 1.2 刚性事务 vs 柔性事务

| 对比维度 | 刚性事务（ACID） | 柔性事务（BASE） |
|----------|-----------------|-----------------|
| 一致性 | 强一致性 | 最终一致性 |
| 隔离性 | 严格隔离 | 放宽隔离 |
| 适用场景 | 单体应用、短事务 | 分布式系统、长事务 |
| 典型实现 | 本地数据库事务 | Seata AT/TCC/SAGA/XA |
| 性能 | 低并发场景较好 | 高并发场景较好 |
| 典型代表 | 单库 MySQL 事务 | Seata、RocketMQ 事务消息 |

```java
// 刚性事务：依赖数据库本地事务
@Transactional
public void transferMoney(Long fromId, Long toId, BigDecimal amount) {
    accountDao.debit(fromId, amount);   // 扣钱
    accountDao.credit(toId, amount);    // 加钱
    // 任何一个失败，整个回滚
}

// 柔性事务：依赖 Seata 分布式事务
@GlobalTransactional
public void transferMoney(Long fromId, Long toId, BigDecimal amount) {
    accountService.debit(fromId, amount);   // 远程调用扣钱
    accountService.credit(toId, amount);    // 远程调用加钱
    // 任何一个失败，全局回滚（补偿）
}
```

### 1.3 2PC（两阶段提交）原理与缺陷

**2PC（Two-Phase Commit）** 是分布式事务的经典协议，包含两个角色：

* **协调者（Coordinator）**：负责调度参与者，决定提交或回滚
* **参与者（Participant）**：执行本地事务，响应协调者的指令

**第一阶段：准备阶段（Prepare Phase）**

```
协调者                 参与者1                 参与者2
   |---------------------->|                     |
   |   Prepare Request     |                     |
   |<----------------------|                     |
   |   Prepare OK (undo重做日志就绪)             |
   |------------------------------------------->|
   |                Prepare Request             |
   |<-------------------------------------------|
   |          Prepare OK (undo重做日志就绪)      |
```

* 协调者向所有参与者发送 Prepare 请求
* 参与者执行事务，写 undo/redo 日志，但不提交
* 参与者返回 Yes（就绪）或 No（失败）

**第二阶段：提交/回滚阶段（Commit/Abort Phase）**

```
协调者                 参与者1                 参与者2
   |---------------------->|                     |
   |   Commit Request      |                     |
   |<----------------------|                     |
   |   ACK                 |                     |
   |------------------------------------------->|
   |                Commit Request              |
   |<-------------------------------------------|
   |               ACK                          |
```

* 如果所有参与者都返回 Yes：协调者发送 Commit，所有参与者正式提交
* 如果有参与者返回 No 或超时：协调者发送 Rollback，所有参与者回滚

**2PC 的缺陷：**

| 缺陷 | 说明 | 后果 |
|------|------|------|
| **同步阻塞** | 准备阶段所有参与者锁定资源 | 高并发场景下性能极差 |
| **单点故障** | 协调者宕机，参与者一直阻塞 | 资源长时间锁定无法释放 |
| **数据不一致** | 第二阶段部分参与者收到 Commit，部分没收到 | 部分提交、部分回滚，数据不一致 |
| **脑裂问题** | 网络分区导致协调者无法与部分参与者通信 | 无法做出统一的提交/回滚决策 |

### 1.4 3PC（三阶段提交）

**3PC（Three-Phase Commit）** 是 2PC 的改进版，引入超时机制和额外阶段来减少阻塞时间。

**三个阶段的流程：**

```
阶段1: CanCommit（询问阶段）
协调者                 参与者
   |---------------------->|
   |   CanCommit?          |
   |<----------------------|
   |   Yes / No            |

阶段2: PreCommit（预提交阶段）
   |---------------------->|
   |   PreCommit           |
   |<----------------------|
   |   ACK                 |

阶段3: DoCommit（最终提交阶段）
   |---------------------->|
   |   DoCommit            |
   |<----------------------|
   |   ACK                 |
```

**3PC 与 2PC 的关键区别：**

| 对比项 | 2PC | 3PC |
|--------|-----|-----|
| 阶段数 | 2 个 | 3 个 |
| 参与者超时机制 | 无（一直阻塞等待协调者） | 有（超时后自动中断事务） |
| 协调者超时 | 无 | 有（超时后发送中止） |
| 性能 | 较低 | 相对较高 |
| 数据一致性风险 | 高 | 较低（但仍存在脑裂风险） |
| 实现复杂度 | 低 | 较高 |

> **3PC 仍然无法完全解决数据一致性问题**，因为网络分区下，部分参与者可能收到 Commit 而部分未收到。Seata 的 AT 模式正是为了解决这些问题而设计的。

***

## 2. AT 模式（Seata 核心模式）

### 2.1 整体架构

Seata 定义了三个核心角色：

| 角色 | 全称 | 职责 |
|------|------|------|
| **TC** | Transaction Coordinator（事务协调者） | 维护全局和分支事务的状态，驱动全局事务提交或回滚。即 Seata Server |
| **TM** | Transaction Manager（事务管理器） | 定义全局事务的范围：开始全局事务、提交或回滚全局事务 |
| **RM** | Resource Manager（资源管理器） | 管理分支事务处理的资源，与 TC 通信以注册分支事务和报告分支事务的状态 |

**架构交互图：**

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Service A  │      │   Service B  │      │   Service C  │
│   (TM + RM)  │      │    (RM)      │      │    (RM)      │
└──────┬───────┘      └──────┬───────┘      └──────┬───────┘
       │                     │                     │
       │    1. 开启全局事务    │                     │
       │──────┬──────────────│─────────────────────│─────┐
       │      │  TC          │                     │     │
       │      │ (Seata Server)                     │     │
       │<─────┴──────────────│─────────────────────│─────┘
       │     XID 返回        │                     │
       │                     │                     │
       │  2. 远程调用传播 XID │                     │
       │────────────────────>│                     │
       │                     │  3. 远程调用传播 XID │
       │                     │────────────────────>│
       │                     │                     │
       │  4. 注册分支事务     │                     │
       │────────────────────>│  4. 注册分支事务     │
       │                     │────────────────────>│
       │                     │                     │
       │  5. 提交/回滚全局事务                      │
       │──────────────────────│─────────────────────│─────> TC
       │<──────────────────────│─────────────────────│─────
       │     结果返回         │                     │
       │                     │                     │
```

### 2.2 AT 模式的执行流程

AT 模式的核心思想是：**对业务无侵入**，通过数据源代理自动生成 undo log，利用数据库的 ACID 事务来执行分支事务。

#### 一阶段：业务数据 + undo log（快照）

**执行流程：**

1. TM 向 TC 申请开启全局事务，TC 返回全局事务 XID
2. 业务通过 JDBC 执行 SQL，Seata 的数据源代理拦截 SQL
3. 在执行业务 SQL **之前**，先查询原始数据（**前镜像**）
4. 执行业务 SQL（INSERT / UPDATE / DELETE）
5. 查询修改后的数据（**后镜像**）
6. 构建 undo log，包含前镜像和后镜像
7. 将 undo log 和业务 SQL 放在同一个本地事务中，一起提交

```sql
-- 一阶段执行的完整 SQL（业务 SQL + undo log 在同一事务）
BEGIN;

-- 业务 SQL：扣减库存
UPDATE storage SET count = count - 1 WHERE id = 100;

-- Seata 自动生成的 undo log
INSERT INTO undo_log (
    id, branch_id, xid, context, rollback_info, log_status, log_created, log_modified
) VALUES (
    null, 12345, '192.168.1.100:8091:1234567890',
    '{"serializer":"jackson","compressor":"NONE"}',
    '{"beforeImage":{"rows":[{"values":{"id":100,"count":100}}],"tableName":"storage"},"afterImage":{"rows":[{"values":{"id":100,"count":99}}],"tableName":"storage"}}',
    0, NOW(), NOW()
);

COMMIT;
```

#### 二阶段提交：删除 undo log

当全局事务的所有分支都成功时：

```
TM --> TC：提交全局事务
TC --> 所有 RM：发送分支提交请求
RM --> 收到提交请求后：
  1. 删除对应分支的 undo_log 记录（异步、快速）
  2. 释放全局锁
  3. 返回提交成功
```

> **关键点**：二阶段提交只是清理 undo log，真正的数据已经在第一阶段提交了，所以非常快。

```sql
-- 二阶段提交：仅删除 undo log
DELETE FROM undo_log WHERE branch_id = 12345 AND xid = '192.168.1.100:8091:1234567890';
```

#### 二阶段回滚：根据 undo log 还原数据

当任意一个分支事务失败时：

```
TM --> TC：回滚全局事务
TC --> 所有 RM：发送分支回滚请求
RM --> 收到回滚请求后：
  1. 查询对应分支的 undo_log
  2. 校验后镜像（确认数据未被其他事务修改）
  3. 根据前镜像生成逆向 SQL 恢复数据
  4. 删除 undo_log
  5. 释放全局锁
  6. 返回回滚成功
```

```sql
-- 二阶段回滚：查询 undo log 并还原数据
-- Seata 内部执行逻辑（伪代码）
-- 1. 查询 undo_log
SELECT rollback_info FROM undo_log 
WHERE branch_id = 12345 AND xid = '192.168.1.100:8091:1234567890';

-- 2. 根据前镜像生成逆向 SQL
-- 原始 SQL: UPDATE storage SET count = count - 1 WHERE id = 100;
-- 前镜像: {id: 100, count: 100}
-- 后镜像: {id: 100, count: 99}
-- 逆向 SQL:
UPDATE storage SET count = 100 WHERE id = 100 AND count = 99;
-- 这里会做脏写检查：如果 count 不是 99（被其他事务改了），则抛出异常

-- 3. 删除 undo_log
DELETE FROM undo_log WHERE branch_id = 12345 AND xid = '192.168.1.100:8091:1234567890';
```

> **脏写检查**：回滚时会校验后镜像的当前值与快照是否一致，如果不一致说明发生了脏写，此时需要人工介入或记录异常日志。

### 2.3 完整 Spring Cloud 集成代码示例

#### Maven 依赖

```xml
<!-- Spring Cloud Alibaba 版本管理 -->
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>com.alibaba.cloud</groupId>
            <artifactId>spring-cloud-alibaba-dependencies</artifactId>
            <version>2022.0.0.0</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>

<!-- Seata 依赖 -->
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-seata</artifactId>
</dependency>

<!-- 数据库和连接池 -->
<dependency>
    <groupId>com.baomidou</groupId>
    <artifactId>mybatis-plus-boot-starter</artifactId>
    <version>3.5.3</version>
</dependency>
<dependency>
    <groupId>com.alibaba</groupId>
    <artifactId>druid-spring-boot-starter</artifactId>
    <version>1.2.16</version>
</dependency>
<dependency>
    <groupId>mysql</groupId>
    <artifactId>mysql-connector-java</artifactId>
    <version>8.0.33</version>
</dependency>
```

#### 业务表结构

```sql
-- 订单表
CREATE TABLE `order_tbl` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(64) DEFAULT NULL COMMENT '用户ID',
    `product_id` INT(11) DEFAULT NULL COMMENT '商品ID',
    `count` INT(11) DEFAULT NULL COMMENT '数量',
    `amount` DECIMAL(10,2) DEFAULT NULL COMMENT '金额',
    `status` INT(1) DEFAULT NULL COMMENT '订单状态: 0-创建中 1-已完成',
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 库存表
CREATE TABLE `storage_tbl` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `product_id` INT(11) DEFAULT NULL COMMENT '商品ID',
    `count` INT(11) DEFAULT NULL COMMENT '库存数量',
    `frozen` INT(11) DEFAULT '0' COMMENT '冻结库存',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_product_id` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 账户表
CREATE TABLE `account_tbl` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(64) DEFAULT NULL COMMENT '用户ID',
    `amount` DECIMAL(10,2) DEFAULT '0.00' COMMENT '账户余额',
    `frozen` DECIMAL(10,2) DEFAULT '0.00' COMMENT '冻结金额',
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- undo_log 表（每个业务库都需要创建）
CREATE TABLE `undo_log` (
    `id` BIGINT(20) NOT NULL AUTO_INCREMENT,
    `branch_id` BIGINT(20) NOT NULL COMMENT '分支事务ID',
    `xid` VARCHAR(128) NOT NULL COMMENT '全局事务ID',
    `context` VARCHAR(128) NOT NULL COMMENT '上下文信息',
    `rollback_info` LONGBLOB NOT NULL COMMENT '回滚信息（前镜像+后镜像）',
    `log_status` INT(11) NOT NULL COMMENT '日志状态: 0-正常 1-已清除',
    `log_created` DATETIME NOT NULL COMMENT '创建时间',
    `log_modified` DATETIME NOT NULL COMMENT '修改时间',
    `ext` VARCHAR(100) DEFAULT NULL COMMENT '扩展字段',
    PRIMARY KEY (`id`),
    UNIQUE KEY `ux_undo_log` (`xid`, `branch_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COMMENT='AT事务回滚日志';
```

#### 订单服务（OrderService）- 作为全局事务发起方

```java
@Service
@Slf4j
public class OrderService {

    @Autowired
    private OrderMapper orderMapper;
    @Autowired
    private AccountFeignClient accountFeignClient;
    @Autowired
    private StorageFeignClient storageFeignClient;

    /**
     * 创建订单：全局事务入口
     *
     * @GlobalTransactional 开启分布式事务
     *   timeoutMills: 全局事务超时时间（默认60秒）
     *   name: 全局事务实例名称
     */
    @GlobalTransactional(name = "create-order", timeoutMills = 60000)
    public Order createOrder(Order order) {
        log.info("======= 创建订单，开启全局事务 =======");
        log.info("当前 XID: {}", RootContext.getXID());

        // 1. 扣减库存（远程调用）
        storageFeignClient.deduct(order.getProductId(), order.getCount());

        // 2. 扣减账户余额（远程调用）
        accountFeignClient.debit(order.getUserId(), order.getAmount());

        // 3. 创建订单（本地事务）
        order.setStatus(0);
        orderMapper.insert(order);

        // 4. 模拟异常：测试全局回滚
        if (order.getAmount().compareTo(new BigDecimal("1000")) > 0) {
            throw new RuntimeException("金额超过1000，触发全局回滚");
        }

        // 5. 更新订单状态为完成
        order.setStatus(1);
        orderMapper.updateById(order);

        log.info("======= 订单创建成功 =======");
        return order;
    }
}
```

#### 库存服务（StorageService）

```java
@Service
@Slf4j
public class StorageService {

    @Autowired
    private StorageMapper storageMapper;

    /**
     * 扣减库存
     * 这里使用 @Transactional 管理本地事务（分支事务）
     * 全局事务由调用方的 @GlobalTransactional 管理
     */
    @Transactional(rollbackFor = Exception.class)
    public void deduct(Integer productId, Integer count) {
        log.info("======= 扣减库存，当前 XID: {} =======", RootContext.getXID());

        // 检查库存
        Storage storage = storageMapper.selectByProductId(productId);
        if (storage == null) {
            throw new RuntimeException("商品不存在");
        }
        if (storage.getCount() < count) {
            throw new RuntimeException("库存不足");
        }

        // 扣减库存
        int result = storageMapper.deductCount(productId, count);
        if (result == 0) {
            throw new RuntimeException("扣减库存失败");
        }

        log.info("======= 库存扣减成功 =======");
    }
}
```

#### 账户服务（AccountService）

```java
@Service
@Slf4j
public class AccountService {

    @Autowired
    private AccountMapper accountMapper;

    /**
     * 扣减账户余额
     */
    @Transactional(rollbackFor = Exception.class)
    public void debit(String userId, BigDecimal amount) {
        log.info("======= 扣减余额，当前 XID: {} =======", RootContext.getXID());

        // 检查余额
        Account account = accountMapper.selectByUserId(userId);
        if (account == null) {
            throw new RuntimeException("账户不存在");
        }
        if (account.getAmount().compareTo(amount) < 0) {
            throw new RuntimeException("余额不足");
        }

        // 扣减余额
        int result = accountMapper.debitAmount(userId, amount);
        if (result == 0) {
            throw new RuntimeException("扣减余额失败");
        }

        log.info("======= 余额扣减成功 =======");
    }
}
```

#### Feign 接口定义

```java
@FeignClient(name = "storage-service", path = "/storage")
public interface StorageFeignClient {

    @PostMapping("/deduct")
    Result<Void> deduct(@RequestParam("productId") Integer productId,
                        @RequestParam("count") Integer count);
}

@FeignClient(name = "account-service", path = "/account")
public interface AccountFeignClient {

    @PostMapping("/debit")
    Result<Void> debit(@RequestParam("userId") String userId,
                       @RequestParam("amount") BigDecimal amount);
}
```

### 2.4 @GlobalTransactional 与 @Transactional 配合

| 注解 | 作用范围 | 管理对象 | 提交/回滚逻辑 |
|------|---------|---------|--------------|
| `@GlobalTransactional` | 全局事务（跨服务） | 全局事务 XID | 二阶段提交：TC 控制所有分支的提交或回滚 |
| `@Transactional` | 本地事务（单服务内） | 数据库本地事务 | 一阶段提交：执行完 SQL 后立即提交本地事务 |

**配合机制：**

```java
@Service
public class BusinessService {

    @GlobalTransactional  // 开启全局事务
    public void businessMethod() {
        // 第1个分支事务
        serviceA.doWork();     // @Transactional 管理本地事务
        // 第2个分支事务
        serviceB.doWork();     // @Transactional 管理本地事务
        // 第3个分支事务
        serviceC.doWork();     // @Transactional 管理本地事务
    }
}
```

**执行流程分解：**

```
时间线：
│
├─ 1. TM 开启全局事务 ──────────────> TC 生成 XID
│
├─ 2. serviceA.doWork()
│     ├─ @Transactional 开启本地事务
│     ├─ 执行业务 SQL + 生成 undo log
│     ├─ RM 注册分支事务到 TC
│     └─ 本地事务提交（一阶段结束）
│
├─ 3. serviceB.doWork()
│     ├─ @Transactional 开启本地事务
│     ├─ 执行业务 SQL + 生成 undo log
│     ├─ RM 注册分支事务到 TC
│     └─ 本地事务提交（一阶段结束）
│
├─ 4. 业务方法执行完毕，无异常
│     └─ TM 请求 TC 提交全局事务
│         └─ TC 通知所有 RM 删除 undo log（二阶段提交）
│
│  (如果第3步抛异常)
├─ 4'. 捕获到异常
│     └─ TM 请求 TC 回滚全局事务
│         └─ TC 通知所有 RM：
│             ├─ serviceA：根据 undo log 前镜像还原数据
│             ├─ serviceB：根据 undo log 前镜像还原数据
│             └─ serviceC：无 undo log（本地事务未提交，自动回滚）
```

> **重点理解**：一阶段时，每个分支的本地事务已经提交了（数据已写入数据库），所以二阶段回滚不能依赖数据库的回滚，而是通过 undo log 做数据补偿。

### 2.5 AT 模式的核心代理机制

Seata AT 模式通过以下代理实现无侵入：

```java
// 数据源代理（Seata 自动配置）
@Configuration
public class SeataDataSourceProxyConfig {

    /**
     * Druid 数据源（业务数据源）
     */
    @Bean
    @ConfigurationProperties(prefix = "spring.datasource")
    public DataSource druidDataSource() {
        return new DruidDataSource();
    }

    /**
     * Seata 代理数据源
     * 所有 JDBC 操作通过此代理，自动生成 undo log
     * 必须使用 @Primary 覆盖默认数据源
     */
    @Primary
    @Bean("seataDataSourceProxy")
    public DataSourceProxy seataDataSourceProxy(DataSource druidDataSource) {
        return new DataSourceProxy(druidDataSource);
    }

    /**
     * SqlSessionFactory 使用代理数据源
     */
    @Bean
    public SqlSessionFactory sqlSessionFactory(DataSourceProxy dataSourceProxy) throws Exception {
        SqlSessionFactoryBean factoryBean = new SqlSessionFactoryBean();
        factoryBean.setDataSource(dataSourceProxy);
        factoryBean.setMapperLocations(new PathMatchingResourcePatternResolver()
            .getResources("classpath:mapper/*.xml"));
        return factoryBean.getObject();
    }
}
```

Seata 数据源代理的拦截链：

```
业务代码：storageMapper.deductCount(productId, count)
    │
    ▼
Seata DataSourceProxy
    │
    ├─ 1. 获取 PreparedStatementProxy（代理）
    ├─ 2. 执行前镜像查询
    │     └─ SELECT count FROM storage WHERE product_id = ?  (Before Image)
    ├─ 3. 执行业务 SQL
    │     └─ UPDATE storage SET count = count - ? WHERE product_id = ?
    ├─ 4. 执行后镜像查询
    │     └─ SELECT count FROM storage WHERE product_id = ?  (After Image)
    ├─ 5. 构建 undo_log 条目
    ├─ 6. 在同一个 JDBC 连接中提交（业务 SQL + undo_log）
    │
    ▼
数据库提交成功
```

***

## 3. TCC 模式

### 3.1 Try → Confirm → Cancel 三个阶段

TCC（Try-Confirm-Cancel）是一种**对业务有侵入**的分布式事务方案，需要业务方自行实现三个接口。

| 阶段 | 操作 | 说明 |
|------|------|------|
| **Try** | 资源预留 | 检查业务资源，并锁定/预留资源（如冻结库存、冻结金额） |
| **Confirm** | 确认提交 | 真正执行业务，使用 Try 阶段预留的资源 |
| **Cancel** | 取消回滚 | 释放 Try 阶段预留的资源 |

```
全局事务成功流程：

服务A                         服务B                         服务C
  | Try()                       | Try()                       | Try()
  | (冻结库存)                   | (冻结金额)                   | (预留优惠券)
  |----------------------------->|----------------------------->|
  |                             |                             |
  | Commit 全局事务              |                             |
  |----------------------------->|----------------------------->|
  | Confirm()                   | Confirm()                   | Confirm()
  | (真正扣库存)                 | (真正扣钱)                   | (真正使用优惠券)
  |<-----------------------------|<-----------------------------|
  |                             |                             |
  | 全局事务完成                 |                             |


全局事务回滚流程（服务B Try失败）：

服务A                         服务B                         服务C
  | Try()                       | Try()                       | Try()
  | (冻结库存)                   | (冻结金额-失败!)             | (预留优惠券)
  |                             |                             |
  | Rollback 全局事务            |                             |
  |<-----------------------------|<-----------------------------|
  | Cancel()                    | Cancel(无需执行)            | Cancel()
  | (释放冻结库存)               |                             | (释放优惠券)
  |                             |                             |
  | 全局事务完成                 |                             |
```

### 3.2 完整代码示例（Try/Confirm/Cancel）

#### TCC 接口定义

```java
/**
 * TCC 库存接口
 * 
 * 使用 @LocalTCC 声明这是一个 TCC 接口
 * 使用 @TwoPhaseBusinessAction 标记两阶段方法
 */
@LocalTCC
public interface StorageTccAction {

    /**
     * Try 阶段：冻结库存
     *
     * @param businessActionContext 事务上下文（Seata 自动注入）
     * @param productId 商品ID
     * @param count 冻结数量
     * @return 是否成功
     */
    @TwoPhaseBusinessAction(
        name = "storageTccAction",
        commitMethod = "confirm",
        rollbackMethod = "cancel"
    )
    boolean tryFreeze(
        BusinessActionContext businessActionContext,
        @BusinessActionContextParameter(paramName = "productId") Integer productId,
        @BusinessActionContextParameter(paramName = "count") Integer count
    );

    /**
     * Confirm 阶段：真正扣减库存
     * 必须与 @TwoPhaseBusinessAction 中 commitMethod 一致
     */
    boolean confirm(BusinessActionContext businessActionContext);

    /**
     * Cancel 阶段：释放冻结库存
     * 必须与 @TwoPhaseBusinessAction 中 rollbackMethod 一致
     */
    boolean cancel(BusinessActionContext businessActionContext);
}
```

#### TCC 实现类

```java
/**
 * 库存 TCC 实现
 * 
 * 注意：Confirm 和 Cancel 方法必须保证幂等性
 *      因为 TC 可能会重复调用它们直到成功
 */
@Service
@Slf4j
public class StorageTccActionImpl implements StorageTccAction {

    @Autowired
    private StorageMapper storageMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean tryFreeze(BusinessActionContext context, Integer productId, Integer count) {
        log.info("========= TCC Try 阶段：冻结库存 =========");
        log.info("XID: {}, BranchId: {}", context.getXid(), context.getBranchId());
        log.info("productId: {}, count: {}", productId, count);

        // 1. 检查库存
        Storage storage = storageMapper.selectByProductId(productId);
        if (storage == null || storage.getCount() < count) {
            throw new RuntimeException("库存不足");
        }

        // 2. 冻结库存（在 count 字段扣减，在 frozen 字段增加冻结数量）
        // 这里用冻结方式预留资源，实际库存未扣减
        int result = storageMapper.freezeStock(productId, count);
        if (result == 0) {
            throw new RuntimeException("冻结库存失败");
        }

        log.info("========= Try 阶段完成 =========");
        return true;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean confirm(BusinessActionContext context) {
        log.info("========= TCC Confirm 阶段：确认扣减 =========");
        log.info("XID: {}, BranchId: {}", context.getXid(), context.getBranchId());

        // 获取 Try 阶段的参数
        Integer productId = context.getActionContext("productId", Integer.class);
        Integer count = context.getActionContext("count", Integer.class);

        // Confirm：将冻结库存真正扣减掉
        // SQL: UPDATE storage SET frozen = frozen - ? WHERE product_id = ?
        // 实际上 frozen 中的就是已经确认要扣减的数量
        int result = storageMapper.confirmFreeze(productId, count);
        if (result == 0) {
            throw new RuntimeException("确认扣减失败");
        }

        log.info("========= Confirm 阶段完成 =========");
        return true;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean cancel(BusinessActionContext context) {
        log.info("========= TCC Cancel 阶段：释放冻结库存 =========");
        log.info("XID: {}, BranchId: {}", context.getXid(), context.getBranchId());

        // 获取 Try 阶段的参数
        Integer productId = context.getActionContext("productId", Integer.class);
        Integer count = context.getActionContext("count", Integer.class);

        // Cancel：将冻结的库存归还
        // SQL: UPDATE storage SET count = count + ?, frozen = frozen - ? WHERE product_id = ?
        int result = storageMapper.unfreezeStock(productId, count);
        if (result == 0) {
            // 幂等处理：如果已经释放过了（幂等表中有记录），返回成功
            log.warn("释放冻结库存失败，可能已被释放：productId={}", productId);
        }

        log.info("========= Cancel 阶段完成 =========");
        return true;
    }
}
```

#### TCC 业务调用方

```java
@Service
@Slf4j
public class TccBusinessService {

    @Autowired
    private StorageTccAction storageTccAction;
    @Autowired
    private AccountTccAction accountTccAction;

    /**
     * TCC 模式下的下单
     * @GlobalTransactional 仍然需要，用于标记全局事务范围
     */
    @GlobalTransactional(name = "tcc-create-order", timeoutMills = 300000)
    public Order createOrder(Order order) {
        log.info("========= TCC 下单：开始 =========");

        // Try 阶段：冻结库存和余额
        boolean storageResult = storageTccAction.tryFreeze(null, order.getProductId(), order.getCount());
        boolean accountResult = accountTccAction.tryDebit(null, order.getUserId(), order.getAmount());

        if (!storageResult || !accountResult) {
            throw new RuntimeException("Try 阶段失败");
        }

        // 保存订单
        order.setStatus(0);
        orderMapper.insert(order);

        // 如果这里抛出异常，Seata 会自动调用所有分支的 Cancel 方法
        // 如果正常返回，Seata 会自动调用所有分支的 Confirm 方法

        log.info("========= TCC 下单成功 =========");
        return order;
    }
}
```

### 3.3 空回滚与幂等问题

**空回滚（Empty Rollback）**：当 Try 阶段没有执行成功（例如网络超时），但 Cancel 被执行了。

```java
@Override
@Transactional(rollbackFor = Exception.class)
public boolean cancel(BusinessActionContext context) {
    // 空回滚处理：如果 Try 阶段没有冻结记录，直接返回成功
    Integer productId = context.getActionContext("productId", Integer.class);
    
    // 方案1：检查是否已有冻结记录
    Storage storage = storageMapper.selectByProductId(productId);
    if (storage.getFrozen() <= 0) {
        // 空回滚：Try 阶段未执行，无需释放
        log.info("空回滚：productId={} 无冻结记录", productId);
        return true;
    }
    
    // 方案2：使用幂等表（推荐）
    if (idempotentService.hasExecuted(context.getXid(), context.getBranchId(), "cancel")) {
        log.info("幂等处理：Cancel 已执行过");
        return true;
    }
    idempotentService.markExecuted(context.getXid(), context.getBranchId(), "cancel");
    
    // 正常释放冻结
    storageMapper.unfreezeStock(productId, 
        context.getActionContext("count", Integer.class));
    return true;
}
```

**幂等表设计：**

```sql
-- TCC 幂等记录表
CREATE TABLE `tcc_idempotent` (
    `id` BIGINT(20) NOT NULL AUTO_INCREMENT,
    `xid` VARCHAR(128) NOT NULL COMMENT '全局事务ID',
    `branch_id` BIGINT(20) NOT NULL COMMENT '分支事务ID',
    `action_type` VARCHAR(20) NOT NULL COMMENT '操作类型：try/confirm/cancel',
    `status` TINYINT(4) NOT NULL DEFAULT '0' COMMENT '状态：0-未执行 1-已执行',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_tx_action` (`xid`, `branch_id`, `action_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 3.4 悬挂事务处理

**悬挂事务**：即 Cancel 先于 Try 执行（由于网络延迟，Try 请求没到但 Cancel 到了）。

```java
@Service
@Slf4j
public class SafeStorageTccActionImpl implements StorageTccAction {

    /**
     * Try 阶段：需要检查是否已被 Cancel
     * 如果 Cancel 已执行，Try 应该拒绝执行
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean tryFreeze(BusinessActionContext context, Integer productId, Integer count) {
        log.info("Try 阶段检查是否已 Cancel");

        // 检查 Cancel 是否已执行过
        if (idempotentService.hasExecuted(context.getXid(), context.getBranchId(), "cancel")) {
            // 已执行过 Cancel，拒绝 Try（防止悬挂）
            log.warn("检测到悬挂事务，拒绝 Try 执行：xid={}", context.getXid());
            return false;
        }

        // 标记 Try 已执行
        idempotentService.markExecuted(context.getXid(), context.getBranchId(), "try");
        
        // ... 正常冻结逻辑
        return true;
    }
}
```

### 3.5 与 AT 模式的区别

| 对比维度 | AT 模式 | TCC 模式 |
|----------|--------|----------|
| **业务侵入性** | 无侵入（通过代理自动生成 undo log） | 强侵入（需实现 Try/Confirm/Cancel） |
| **一致性** | 最终一致（基于 undo log 补偿） | 最终一致（基于业务补偿） |
| **性能** | 较高（一阶段提交，二阶段异步清理） | 高（资源预留，粒度更细） |
| **代码量** | 少（只需关注业务） | 多（需编写三个方法+幂等处理） |
| **隔离性** | 支持写隔离（全局锁） | 由业务自己保证 |
| **适用场景** | CRUD 密集场景，单库事务 | 资源预留场景，需要高并发 |
| **资源锁定时间** | 整个全局事务期间 | Try 阶段完成后即解除 |
| **回滚代价** | 数据库回滚（undo log） | 业务补偿（Cancel 逻辑） |
| **数据库要求** | 每个库需要 undo\_log 表 | 无特定要求 |

***

## 4. SAGA 模式

### 4.1 SAGA 模式概述

SAGA 模式是一种**长事务解决方案**，将一个全局事务拆分为多个本地子事务，每个子事务都有对应的**补偿事务**。

**两种实现方式：**

| 方式 | 说明 | 特点 |
|------|------|------|
| **编排（Choreography）** | 每个服务完成后，触发下一个服务 | 去中心化，依赖事件驱动 |
| **编排（Orchestration）** | 由一个协调者负责按顺序调用各个服务 | 中心化控制，Seata 采用此方式 |

### 4.2 Seata 状态机引擎

Seata 使用**状态机引擎**来实现 SAGA 模式，通过 JSON 配置文件定义事务流程。

```json
{
    "Name": "createOrderSaga",
    "Comment": "创建订单的 SAGA 事务",
    "StartState": "DeductStock",
    "Version": "0.0.1",
    "States": {
        "DeductStock": {
            "Type": "ServiceTask",
            "ServiceName": "storageService",
            "ServiceMethod": "deduct",
            "Input": ["$request.productId", "$request.count"],
            "Output": {
                "stockResult": "$.#result"
            },
            "Next": "DebitAccount",
            "CompensateState": "CompensateStock"
        },
        "DebitAccount": {
            "Type": "ServiceTask",
            "ServiceName": "accountService",
            "ServiceMethod": "debit",
            "Input": ["$request.userId", "$request.amount"],
            "Output": {
                "accountResult": "$.#result"
            },
            "Next": "CreateOrder",
            "CompensateState": "CompensateAccount"
        },
        "CreateOrder": {
            "Type": "ServiceTask",
            "ServiceName": "orderService",
            "ServiceMethod": "create",
            "Input": ["$request.userId", "$request.productId", "$request.count", "$request.amount"],
            "Next": "Success",
            "CompensateState": "CompensateOrder"
        },
        "CompensateStock": {
            "Type": "ServiceTask",
            "ServiceName": "storageService",
            "ServiceMethod": "compensateDeduct",
            "Input": ["$request.productId", "$request.count"]
        },
        "CompensateAccount": {
            "Type": "ServiceTask",
            "ServiceName": "accountService",
            "ServiceMethod": "compensateDebit",
            "Input": ["$request.userId", "$request.amount"]
        },
        "CompensateOrder": {
            "Type": "ServiceTask",
            "ServiceName": "orderService",
            "ServiceMethod": "compensateCreate",
            "Input": ["$request.userId", "$request.productId"]
        },
        "Success": {
            "Type": "SuccessState"
        },
        "Fail": {
            "Type": "FailState",
            "ErrorCodes": ["SAGA_TRANSACTION_FAILED"]
        }
    }
}
```

**执行流程（正常情况）：**

```
DeductStock ──→ DebitAccount ──→ CreateOrder ──→ Success
（扣库存）       （扣余额）        （创建订单）      （成功）
```

**执行流程（异常情况 - 扣余额失败）：**

```
DeductStock ──→ DebitAccount ──→ [失败]
    │                              │
    │                   CompensateStock ←── 自动触发补偿
    │                        │
    │                   (将库存加回来)
    │                        │
    └─────────────────→ Fail
```

### 4.3 补偿事务的设计原则

```java
@Service
@Slf4j
public class SagaStorageService {

    /**
     * 正向操作：扣减库存
     */
    @Transactional(rollbackFor = Exception.class)
    public boolean deduct(Integer productId, Integer count) {
        log.info("SAGA 正向操作：扣减库存 productId={}, count={}", productId, count);
        
        Storage storage = storageMapper.selectByProductId(productId);
        if (storage == null || storage.getCount() < count) {
            throw new RuntimeException("库存不足");
        }
        
        // 直接扣减（非冻结方式，SAGA 不需要预留）
        storageMapper.deductCount(productId, count);
        return true;
    }

    /**
     * 补偿操作：增加库存（扣减的逆操作）
     * 
     * 设计原则：
     * 1. 补偿必须幂等（可能被重复调用）
     * 2. 补偿不能失败（如果失败需要记录日志并告警）
     * 3. 补偿必须能处理空补偿（正向操作未执行的情况）
     */
    @Transactional(rollbackFor = Exception.class)
    public boolean compensateDeduct(Integer productId, Integer count) {
        log.info("SAGA 补偿操作：恢复库存 productId={}, count={}", productId, count);

        // 1. 幂等检查
        if (compensateLogService.hasCompensated(productId, "deduct")) {
            log.info("补偿已执行过，跳过");
            return true;
        }

        // 2. 空补偿检查：如果库存没有减少过（正向操作未执行），则不需要补偿
        Storage storage = storageMapper.selectByProductId(productId);
        if (storage == null) {
            log.warn("商品不存在，空补偿处理");
            return true;
        }

        // 3. 执行补偿：将库存加回来
        storageMapper.increaseCount(productId, count);

        // 4. 记录补偿日志
        compensateLogService.record(productId, "deduct", true);

        log.info("SAGA 补偿完成");
        return true;
    }
}
```

### 4.4 SAGA 与 AT/TCC 对比

| 对比维度 | AT | TCC | SAGA |
|----------|----|-----|------|
| **一致性** | 最终一致 | 最终一致 | 最终一致 |
| **侵入性** | 无 | 强 | 中（需实现补偿方法） |
| **适用场景** | 简单 CRUD | 资源预留 | 长事务、多步骤流程 |
| **复杂性** | 低 | 高 | 中 |
| **隔离性** | 支持写隔离 | 业务保证 | 弱 |
| **典型应用** | 电商下单（数据库操作） | 库存冻结、资金预留 | 订单全流程、审批流程 |

***

## 5. XA 模式

### 5.1 基于数据库的 XA 协议

XA 是 **DTP（Distributed Transaction Processing）** 模型定义的规范，由数据库厂商实现。Seata 的 XA 模式是基于 XA 协议实现的强一致性分布式事务方案。

**XA 协议角色：**

| 角色 | 对应 |
|------|------|
| AP（Application Program） | 业务应用 |
| TM（Transaction Manager） | Seata TM |
| RM（Resource Manager） | 数据库（MySQL/Oracle 等） |

**XA 执行流程：**

```java
// XA 模式本质是 2PC，但由数据库实现
// 伪代码展示 XA 协议在 Seata 中的流程

// 第一阶段：Prepare
@GlobalTransactional
public void businessMethod() {
    // 数据库 XA 执行流程
    // 1. 分支1: XA START 'xid:branch1'
    //            执行 SQL: UPDATE storage SET count = count - 1 WHERE id = 100;
    //    XA END 'xid:branch1'
    //    XA PREPARE 'xid:branch1'  -- 数据库写 redo log，准备提交
    
    // 2. 分支2: XA START 'xid:branch2'
    //            执行 SQL: UPDATE account SET amount = amount - 100 WHERE user_id = 'U001';
    //    XA END 'xid:branch2'
    //    XA PREPARE 'xid:branch2'  -- 数据库写 redo log，准备提交
}

// 第二阶段：Commit（如果所有分支都 Prepare 成功）
// XA COMMIT 'xid:branch1'
// XA COMMIT 'xid:branch2'

// 第二阶段：Rollback（如果有分支 Prepare 失败）
// XA ROLLBACK 'xid:branch1'
// XA ROLLBACK 'xid:branch2'
```

### 5.2 XA 模式配置

```xml
<!-- Seata XA 模式依赖（与 AT 模式相同，通过配置切换） -->
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-seata</artifactId>
</dependency>
```

```yaml
# application.yml - 配置数据源为 XA 模式
spring:
  datasource:
    # 关键：必须使用支持 XA 的数据库和驱动
    driver-class-name: com.mysql.cj.jdbc.Driver
    url: jdbc:mysql://localhost:3306/seata_demo?useSSL=false&serverTimezone=Asia/Shanghai
    username: root
    password: root

# Seata 配置
seata:
  enabled: true
  application-id: ${spring.application.name}
  tx-service-group: my_test_tx_group
  # 数据源代理模式：XA 模式
  data-source-proxy-mode: XA
  config:
    type: nacos
    nacos:
      server-addr: 127.0.0.1:8848
      namespace: ""
      group: SEATA_GROUP
  registry:
    type: nacos
    nacos:
      application: seata-server
      server-addr: 127.0.0.1:8848
      group: SEATA_GROUP
```

### 5.3 XA 与 AT 模式对比

| 对比维度 | AT 模式 | XA 模式 |
|----------|--------|---------|
| **一致性级别** | 最终一致 | 强一致（遵循 ACID） |
| **协议** | 自定义（undo log 补偿） | 标准 XA 协议 |
| **资源锁定** | 一阶段提交后释放 | 一直锁定到二阶段完成 |
| **性能** | 高（锁时间短） | 较低（锁时间较长） |
| **数据库要求** | 需 undo\_log 表 | 需支持 XA 协议 |
| **回滚机制** | 基于 undo log 反向 SQL | 数据库原生回滚 |
| **业务入侵** | 无 | 无 |
| **适用场景** | 高性能要求的最终一致性场景 | 金融等强一致性场景 |

***

## 6. 事务隔离

### 6.1 写隔离（全局锁）

Seata AT 模式下，通过**全局锁**保证写隔离。全局锁由 TC 管理，**不同全局事务之间**不能同时修改同一行数据。

```java
// 全局锁的工作机制
// 事务1 修改库存行 ID=100
@GlobalTransactional
public void business1() {
    storageMapper.deductCount(100, 1);
    // 持有全局锁：storage:100
    
    // ... 长时间操作 ...
}

// 事务2 同时修改同一行
@GlobalTransactional
public void business2() {
    // 事务1 持有全局锁 storage:100
    // 事务2 尝试获取全局锁 storage:100
    storageMapper.deductCount(100, 1);
    // 获取失败，等待锁释放（默认重试 30 次，间隔 10ms）
    // 如果超时，抛出异常：Lock Conflict
}
```

**全局锁获取流程：**

```
分支事务执行 UPDATE 之前：
  1. 在本地数据库加行锁（for update / MVCC）
  2. 向 TC 申请全局锁（branchId, tableName, pk）
  3. TC 检查该行是否被其他全局事务锁定
     └─ 未被锁定 → 授予全局锁，返回成功
     └─ 已被锁定 → 返回失败，RM 重试
  4. 获取全局锁后，执行 SQL 并提交本地事务
  5. 本地事务提交后，释放数据库行锁
```

**全局锁与本地锁的释放时序：**

```
第一阶段（一阶段完成）：
  1. 获得全局锁（TC 记录）
  2. 执行 SQL
  3. 提交本地事务（释放数据库锁）
  4. 全局锁保持（防止其他全局事务修改）

第二阶段（二阶段提交）：
  1. 删除 undo log
  2. 释放全局锁

第二阶段（二阶段回滚）：
  1. 持有全局锁（防止其他事务修改）
  2. 根据 undo log 还原数据
  3. 释放全局锁
```

### 6.2 读隔离（SELECT FOR UPDATE）

Seata AT 模式通过 `SELECT FOR UPDATE` 实现读隔离，保证读取其他全局事务未提交的数据时能感知到全局锁。

```java
@Service
public class InventoryService {

    @Autowired
    private StorageMapper storageMapper;

    /**
     * 安全查询库存
     * 使用 @GlobalTransactional + select for update
     * 保证读到的是全局事务最终一致的数据
     */
    @GlobalTransactional(propagation = REQUIRES_NEW)
    public Storage safeQueryStock(Integer productId) {
        // 方式1：FOR UPDATE 语句，Seata 会检查全局锁
        // 如果该行被其他全局事务锁定，这里会等待
        Storage storage = storageMapper.selectByProductIdForUpdate(productId);
        return storage;
    }

    /**
     * 普通查询（不加锁）
     * 可能会读到全局事务未提交的脏数据
     * 适用于对一致性要求不高的场景
     */
    public Storage unsafeQueryStock(Integer productId) {
        // 方式2：普通 SELECT，不加锁
        // 可能读到其他全局事务一阶段已提交但二阶段未完成的数据
        return storageMapper.selectByProductId(productId);
    }
}
```

```java
// Mapper - FOR UPDATE 查询
public interface StorageMapper extends BaseMapper<Storage> {

    @Select("SELECT * FROM storage WHERE product_id = #{productId} FOR UPDATE")
    Storage selectByProductIdForUpdate(@Param("productId") Integer productId);
}
```

### 6.3 脏读问题与解决方案

**脏读产生的原因：**

```
时间线（无隔离措施）：
T1: 事务A @GlobalTransactional 开始
T2: 事务A 扣减库存 count: 100 -> 99（一阶段提交）
T3: 事务B 普通 SELECT 读到 count: 99（脏读！）
T4: 事务A 回滚，库存恢复 count: 99 -> 100
T5: 事务B 基于 count: 99 继续处理（数据不一致！）
```

**解决方案：**

```java
// 方案1：使用 FOR UPDATE 查询（Seata 会检查全局锁）
@GlobalTransactional
public Storage safeRead(Integer productId) {
    // Seata 代理会拦截 FOR UPDATE
    // 在返回前检查该行是否有其他全局事务的全局锁
    // 如果有：等待锁释放
    // 如果没有：直接返回
    return storageMapper.selectByProductIdForUpdate(productId);
}

// 方案2：使用 @GlobalLock 注解（不开启全局事务，只检查全局锁）
@Service
public class QueryService {

    /**
     * @GlobalLock 只检查全局锁，不开启全局事务
     * 如果该行被其他全局事务锁定，会等待或抛出异常
     * 适用于查询服务
     */
    @GlobalLock
    @Transactional
    public Storage queryWithLockCheck(Integer productId) {
        return storageMapper.selectByProductIdForUpdate(productId);
    }
}

// 方案3：使用 @GlobalTransactional(propagation = REQUIRES_NEW)
// 开启一个独立的全局事务来读取
@Service
public class ReportService {

    @GlobalTransactional(propagation = Propagation.REQUIRES_NEW)
    public Storage queryInNewTx(Integer productId) {
        return storageMapper.selectByProductIdForUpdate(productId);
    }
}
```

**Seata 事务隔离级别总结：**

| 隔离级别 | 是否支持 | 实现方式 |
|----------|---------|---------|
| 读未提交（Read Uncommitted） | 默认行为 | 普通 SELECT 可能读到一阶段已提交的数据 |
| 读已提交（Read Committed） | 通过 FOR UPDATE | 检查全局锁，等待其他事务完成 |
| 可重复读（Repeatable Read） | 数据库级别 | 依赖数据库的 MVCC |
| 串行化（Serializable） | 不推荐 | 性能太差 |

> **最佳实践**：写操作使用 `@GlobalTransactional` + `FOR UPDATE`；读操作使用 `@GlobalLock` + `FOR UPDATE`。对于最终一致性要求高的查询，使用 `@GlobalLock` 确保不会读到正在回滚的数据。

***

## 7. 实战配置

### 7.1 Seata Server 部署

#### 下载与启动

```bash
# 1. 下载 Seata Server
wget https://github.com/seata/seata/releases/download/v2.0.0/seata-server-2.0.0.zip
unzip seata-server-2.0.0.zip -d /opt/seata

# 2. 修改配置（选择 file 或 nacos 作为配置中心）

# 3. 启动 Seata Server
# Linux/Mac
cd /opt/seata/bin
sh seata-server.sh -p 8091 -h 127.0.0.1 -m db

# Windows
bin\seata-server.bat -p 8091 -h 127.0.0.1 -m db

# 参数说明：
# -p: 端口（默认 8091）
# -h: 主机地址
# -m: 存储模式（file / db / redis）
```

#### file 配置（简单模式）

```yaml
# file:/opt/seata/conf/application.yml
server:
  port: 7091

spring:
  application:
    name: seata-server

seata:
  config:
    # file 配置中心：直接读取本地文件
    type: file
    file:
      name: file:/opt/seata/conf/file.conf

  registry:
    # 注册中心：使用 file 类型（不需要注册到外部注册中心）
    type: file
    file:
      name: file:/opt/seata/conf/file.conf

  store:
    # 事务日志存储模式
    mode: db
    db:
      datasource: druid
      db-type: mysql
      driver-class-name: com.mysql.cj.jdbc.Driver
      url: jdbc:mysql://localhost:3306/seata?useUnicode=true&rewriteBatchedStatements=true
      user: root
      password: root
      min-conn: 5
      max-conn: 100
      global-table: global_table
      branch-table: branch_table
      lock-table: lock_table
      distributed-lock-table: distributed_lock
      query-limit: 100
      max-wait: 5000
```

```properties
# file:/opt/seata/conf/file.conf
transport.type=TCP
transport.server=NIO
transport.heartbeat=true
transport.enableTmClientBatchSendRequest=false
transport.enableRmClientBatchSendRequest=true

# 事务分组映射
service.vgroupMapping.my_test_tx_group=default
# 默认分组 Seata Server 地址列表
service.default.grouplist=127.0.0.1:8091
# 是否启用降级
service.enableDegrade=false
# 禁用全局事务（用于测试）
service.disableGlobalTransaction=false

# 客户端配置
client.rm.asyncCommitBufferLimit=10000
client.rm.lock.retryInterval=10
client.rm.lock.retryTimes=30
client.rm.lock.retryPolicyBranchRollbackOnConflict=true
client.rm.reportRetryCount=5
client.rm.tableMetaCheckEnable=true
client.rm.tableMetaCheckerInterval=60000
client.rm.sqlParserType=druid
client.rm.sagaBranchRegisterEnable=false
client.rm.sagaJsonParser=fastjson
client.rm.tccActionInterceptorOrder=-2147482648
client.tm.commitRetryCount=5
client.tm.rollbackRetryCount=5
client.tm.defaultGlobalTransactionTimeout=60000
client.tm.degradeCheck=false
client.tm.degradeCheckAllowTimes=10
client.tm.degradeCheckPeriod=2000
client.tm.interceptorOrder=-2147482648

# 二阶段提交/回滚线程池配置
client.undo.dataValidation=true
client.undo.logSerialization=jackson
client.undo.onlyCareUpdateColumns=true
server.undo.logSaveDays=7
server.undo.logDeletePeriod=86400000

# 服务端配置
server.maxCommitRetryTimeout=-1
server.maxRollbackRetryTimeout=-1
server.recovery.committingRetryPeriod=1000
server.recovery.asynCommittingRetryPeriod=1000
server.recovery.rollbackingRetryPeriod=1000
server.recovery.timeoutRetryPeriod=1000

# 事务存储
store.mode=db
store.lock.mode=db
```

#### Nacos 配置（生产推荐）

```yaml
# seata Server application.yml (Nacos 模式)
seata:
  config:
    type: nacos
    nacos:
      server-addr: 127.0.0.1:8848
      namespace: ""
      group: SEATA_GROUP
      data-id: seataServer.properties
      username: nacos
      password: nacos

  registry:
    type: nacos
    nacos:
      application: seata-server
      server-addr: 127.0.0.1:8848
      group: SEATA_GROUP
      namespace: ""
      cluster: default
      username: nacos
      password: nacos

  store:
    mode: db
    db:
      datasource: druid
      db-type: mysql
      driver-class-name: com.mysql.cj.jdbc.Driver
      url: jdbc:mysql://localhost:3306/seata?useUnicode=true&rewriteBatchedStatements=true
      user: root
      password: root
```

将以下配置推送到 Nacos 配置中心：

```properties
# Nacos 配置中心：dataId = seataServer.properties
# 事务分组映射
service.vgroupMapping.my_test_tx_group=default
service.default.grouplist=127.0.0.1:8091

# 客户端参数
client.rm.lock.retryInterval=10
client.rm.lock.retryTimes=30
client.tm.commitRetryCount=5
client.tm.rollbackRetryCount=5
client.tm.defaultGlobalTransactionTimeout=60000
```

### 7.2 业务服务完整配置

```yaml
# 业务服务 application.yml
server:
  port: 8081

spring:
  application:
    name: order-service
  datasource:
    driver-class-name: com.mysql.cj.jdbc.Driver
    url: jdbc:mysql://localhost:3306/seata_order?useUnicode=true&characterEncoding=utf-8&serverTimezone=Asia/Shanghai
    username: root
    password: root
    type: com.alibaba.druid.pool.DruidDataSource
    druid:
      initial-size: 5
      min-idle: 5
      max-active: 20
      max-wait: 60000

# Seata 配置
seata:
  enabled: true
  application-id: ${spring.application.name}
  # 事务服务分组名（必须与 Seata Server 配置一致）
  tx-service-group: my_test_tx_group
  # 数据源代理模式：AT（默认）
  data-source-proxy-mode: AT
  
  # 配置中心
  config:
    type: nacos
    nacos:
      server-addr: 127.0.0.1:8848
      namespace: ""
      group: SEATA_GROUP
      username: nacos
      password: nacos
      data-id: seataClient.properties
  
  # 注册中心
  registry:
    type: nacos
    nacos:
      application: seata-server
      server-addr: 127.0.0.1:8848
      group: SEATA_GROUP
      namespace: ""
      cluster: default
      username: nacos
      password: nacos

  # 服务端参数（可选覆盖客户端默认值）
  service:
    vgroup-mapping:
      my_test_tx_group: default
    grouplist:
      default: 127.0.0.1:8091

  # 客户端参数
  client:
    rm:
      async-commit-buffer-limit: 10000
      lock:
        retry-interval: 10
        retry-times: 30
        retry-policy-branch-rollback-on-conflict: true
      report-retry-count: 5
      table-meta-check-enable: true
      table-meta-checker-interval: 60000
      sql-parser-type: druid
    tm:
      commit-retry-count: 5
      rollback-retry-count: 5
      default-global-transaction-timeout: 60000
      degrade-check: false
      degrade-check-allow-times: 10
      degrade-check-period: 2000
    undo:
      data-validation: true
      log-serialization: jackson
      only-care-update-columns: true
    log:
      exception-rate: 100

# MyBatis-Plus 配置
mybatis-plus:
  mapper-locations: classpath:mapper/*.xml
  type-aliases-package: com.example.seata.entity
  configuration:
    map-underscore-to-camel-case: true
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl

# Feign 配置
feign:
  client:
    config:
      default:
        connect-timeout: 5000
        read-timeout: 10000
        logger-level: full
  sentinel:
    enabled: true

# 日志
logging:
  level:
    com.alibaba.seata: debug
    io.seata: debug
    com.example.seata: debug
```

### 7.3 Seata 数据库初始化

```sql
-- 1. 创建 Seata Server 存储库（seata 库）
-- 仅当 store.mode=db 时需要
CREATE DATABASE IF NOT EXISTS `seata` DEFAULT CHARSET utf8mb4;

USE `seata`;

-- 全局事务表
CREATE TABLE IF NOT EXISTS `global_table` (
    `xid` VARCHAR(128) NOT NULL COMMENT '全局事务ID',
    `transaction_id` BIGINT(20) DEFAULT NULL COMMENT '事务ID',
    `status` TINYINT(4) NOT NULL COMMENT '状态: 0-开始 1-已提交 2-提交失败 3-已回滚 4-回滚失败 5-异步提交 6-超时回滚',
    `application_id` VARCHAR(32) DEFAULT NULL COMMENT '应用ID',
    `transaction_service_group` VARCHAR(32) DEFAULT NULL COMMENT '事务服务分组',
    `transaction_name` VARCHAR(128) DEFAULT NULL COMMENT '事务名称',
    `timeout` INT(11) DEFAULT NULL COMMENT '超时时间(毫秒)',
    `begin_time` BIGINT(20) DEFAULT NULL COMMENT '开始时间',
    `application_data` VARCHAR(2000) DEFAULT NULL COMMENT '应用数据',
    `gmt_create` DATETIME DEFAULT NULL COMMENT '创建时间',
    `gmt_modified` DATETIME DEFAULT NULL COMMENT '修改时间',
    PRIMARY KEY (`xid`),
    KEY `idx_status_gmt_modified` (`status`, `gmt_modified`),
    KEY `idx_transaction_id` (`transaction_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='全局事务表';

-- 分支事务表
CREATE TABLE IF NOT EXISTS `branch_table` (
    `branch_id` BIGINT(20) NOT NULL COMMENT '分支事务ID',
    `xid` VARCHAR(128) NOT NULL COMMENT '全局事务ID',
    `transaction_id` BIGINT(20) DEFAULT NULL COMMENT '事务ID',
    `resource_group_id` VARCHAR(32) DEFAULT NULL COMMENT '资源组ID',
    `resource_id` VARCHAR(256) DEFAULT NULL COMMENT '资源ID',
    `branch_type` VARCHAR(8) DEFAULT NULL COMMENT '分支类型: AT/TCC/SAGA/XA',
    `status` TINYINT(4) DEFAULT NULL COMMENT '状态: 0-注册 1-一阶段完成 2-二阶段提交请求 3-二阶段回滚请求 4-二阶段提交完成 5-二阶段回滚完成',
    `client_id` VARCHAR(64) DEFAULT NULL COMMENT '客户端ID',
    `application_data` VARCHAR(2000) DEFAULT NULL COMMENT '应用数据',
    `gmt_create` DATETIME(6) DEFAULT NULL COMMENT '创建时间',
    `gmt_modified` DATETIME(6) DEFAULT NULL COMMENT '修改时间',
    PRIMARY KEY (`branch_id`),
    KEY `idx_xid` (`xid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分支事务表';

-- 全局锁表
CREATE TABLE IF NOT EXISTS `lock_table` (
    `row_key` VARCHAR(128) NOT NULL COMMENT '行键: resourceId:tableName:pk',
    `xid` VARCHAR(128) DEFAULT NULL COMMENT '全局事务ID',
    `transaction_id` BIGINT(20) DEFAULT NULL COMMENT '事务ID',
    `branch_id` BIGINT(20) NOT NULL COMMENT '分支事务ID',
    `resource_id` VARCHAR(256) DEFAULT NULL COMMENT '资源ID',
    `table_name` VARCHAR(32) DEFAULT NULL COMMENT '表名',
    `pk` VARCHAR(36) DEFAULT NULL COMMENT '主键值',
    `status` TINYINT(4) NOT NULL DEFAULT '0' COMMENT '状态: 0-锁定 1-已解锁',
    `gmt_create` DATETIME DEFAULT NULL COMMENT '创建时间',
    `gmt_modified` DATETIME DEFAULT NULL COMMENT '修改时间',
    PRIMARY KEY (`row_key`),
    KEY `idx_branch_id` (`branch_id`),
    KEY `idx_xid` (`xid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='全局锁表';

-- 分布式锁表
CREATE TABLE IF NOT EXISTS `distributed_lock` (
    `lock_key` VARCHAR(128) NOT NULL COMMENT '锁键',
    `lock_value` VARCHAR(255) DEFAULT NULL COMMENT '锁值',
    `expire` BIGINT(20) DEFAULT NULL COMMENT '过期时间',
    PRIMARY KEY (`lock_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分布式锁表';

-- 2. 业务库 undo_log 表（每个业务数据库都需要）
CREATE TABLE IF NOT EXISTS `undo_log` (
    `id` BIGINT(20) NOT NULL AUTO_INCREMENT,
    `branch_id` BIGINT(20) NOT NULL,
    `xid` VARCHAR(128) NOT NULL,
    `context` VARCHAR(128) NOT NULL,
    `rollback_info` LONGBLOB NOT NULL,
    `log_status` INT(11) NOT NULL,
    `log_created` DATETIME NOT NULL,
    `log_modified` DATETIME NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `ux_undo_log` (`xid`, `branch_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COMMENT='AT事务回滚日志';
```

### 7.4 高可用 Seata Server 集群搭建

**集群架构图：**

```
                     Nginx (负载均衡)
                   /        |        \
                  /         |         \
            Seata-1      Seata-2      Seata-3
            (8091)       (8092)       (8093)
                 \         |          /
                  \        |         /
                     MySQL (共享存储)
                   global_table
                   branch_table
                   lock_table
```

**Nginx 配置：**

```nginx
# nginx.conf - Seata Server 负载均衡
upstream seata_cluster {
    server 192.168.1.101:8091 max_fails=3 fail_timeout=30s;
    server 192.168.1.102:8091 max_fails=3 fail_timeout=30s;
    server 192.168.1.103:8091 max_fails=3 fail_timeout=30s;
}

server {
    listen 8091;
    server_name seata-cluster.example.com;

    location / {
        proxy_pass http://seata_cluster;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_connect_timeout 10s;
        proxy_read_timeout 30s;
    }
}
```

**客户端连接集群：**

```yaml
# 客户端配置：连接 Nginx 转发
seata:
  service:
    grouplist:
      # 连接 Nginx 负载均衡地址，而非单个 Seata Server
      default: 192.168.1.100:8091
  registry:
    type: nacos
    nacos:
      # 多个 Seata Server 注册到同一个 Nacos 集群
      server-addr: 192.168.1.201:8848,192.168.1.202:8848
      group: SEATA_GROUP
      cluster: default
```

***

## 8. 常见问题

### 8.1 超时处理

**全局事务超时：**

```java
@Service
public class TimeoutConfigService {

    /**
     * 方案1：通过注解设置超时时间
     * timeoutMills 设置全局事务超时（毫秒）
     */
    @GlobalTransactional(name = "timeout-demo", timeoutMills = 30000) // 30秒超时
    public void businessWithTimeout() {
        // 如果整体事务超过30秒，TC 会强制回滚
        // 即使业务方法还在执行
    }

    /**
     * 方案2：通过客户端配置全局超时
     * 在 application.yml 中配置：
     * seata.client.tm.defaultGlobalTransactionTimeout=60000
     */
}
```

**超时处理流程：**

```
1. TC 检查全局事务的 begin_time
2. 如果 (当前时间 - begin_time) > timeout
   ├─ TC 尝试通知所有 RM 回滚
   ├─ RM 收到回滚请求，根据 undo log 回滚
   └─ 如果 TM 还在执行，会抛异常：GlobalTransactionTimeoutException
```

**超时常见问题及解决：**

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 全局事务超时回滚失败 | 超时时业务正在执行，数据已变 | 增大 timeoutMills 值 |
| 分支事务注册超时 | 网络延迟导致 RM 与 TC 通信超时 | 增加 `client.rm.reportRetryCount` |
| 全局锁等待超时 | 两个事务同时修改同一行 | 减少锁定时间，优化业务逻辑 |
| UndoLog 清理超时 | 二阶段提交时大量 undo log 需要清理 | 调整 `async-commit-buffer-limit` |

### 8.2 异常恢复

**Seata Server 异常恢复机制：**

```yaml
# 服务端异常恢复配置
seata:
  server:
    recovery:
      # 提交中状态的事务重试间隔（毫秒）
      committing-retry-period: 1000
      # 异步提交重试间隔
      asyn-committing-retry-period: 1000
      # 回滚中状态的事务重试间隔
      rollbacking-retry-period: 1000
      # 超时事务重试间隔
      timeout-retry-period: 1000

    # 最大重试次数（-1 表示无限重试）
    max-commit-retry-timeout: -1
    max-rollback-retry-timeout: -1
```

**客户端异常处理：**

```java
@Service
@Slf4j
public class RecoveryService {

    /**
     * Seata 客户端异常重试配置
     * 
     * client.tm.commitRetryCount=5    -- 提交重试5次
     * client.tm.rollbackRetryCount=5  -- 回滚重试5次
     */
    
    /**
     * @GlobalTransactional 中的异常处理
     * 
     * 当全局事务中的分支抛出异常时：
     * 1. TM 感知到异常（或者方法抛出了未捕获的异常）
     * 2. TM 向 TC 发起回滚请求
     * 3. TC 向所有已注册的 RM 发送回滚请求
     * 4. 每个 RM 根据 undo_log 回滚数据
     * 
     * 异常分类处理：
     */
    @GlobalTransactional
    public void businessWithExceptionHandling() {
        try {
            // 业务逻辑
            serviceA.doWork();
            serviceB.doWork();
        } catch (BusinessException e) {
            // 业务异常：全局回滚已经开始
            // 无需手动回滚，Seata 自动处理
            log.error("业务异常，触发全局回滚", e);
            
            // 注意：这里不要再捕获异常后吞掉
            // 必须让异常继续抛出，否则 TM 认为事务成功
            throw e;
        } catch (TimeoutException e) {
            // 超时异常：可能回滚已经在进行
            log.error("超时异常", e);
            throw new GlobalTransactionException("全局事务超时", e);
        } catch (Exception e) {
            // 其他异常：记录日志后重新抛出
            log.error("未知异常，触发全局回滚", e);
            throw e;
        }
    }

    /**
     * 未决事务手动恢复
     * 适用于 Seata 无法自动恢复的极端情况
     */
    @Scheduled(fixedRate = 60000)
    public void checkPendingTransactions() {
        // 查询 TC 中长时间未完成的事务（通过 Seata API 或直接查数据库）
        // 如果发现 Table 'global_table' 中有长期处于 Committing/Rollbacking 状态的事务
        // 
        // 处理方式：
        // 1. 手动调用 TC API 强制提交或回滚
        // 2. 或者直接修改 global_table 的 status 字段
        // 3. 手动清理对应的 branch_table 和 lock_table 记录
        // 
        // 警告：这种操作风险极高，仅作为最后的兜底手段
        log.warn("检查异常事务...");
    }
}
```

**异常恢复监控 SQL：**

```sql
-- 查询所有正在提交中的全局事务
SELECT * FROM global_table WHERE status IN (1, 2, 5) 
AND gmt_modified < DATE_SUB(NOW(), INTERVAL 5 MINUTE);

-- 查询所有正在回滚中的全局事务
SELECT * FROM global_table WHERE status IN (3, 4) 
AND gmt_modified < DATE_SUB(NOW(), INTERVAL 5 MINUTE);

-- 手动强制提交（仅用于确认所有分支已提交）
-- UPDATE global_table SET status = 1 WHERE xid = 'xxx' AND status = 2;

-- 手动强制回滚（仅用于确认所有分支已回滚）
-- UPDATE global_table SET status = 3 WHERE xid = 'xxx' AND status = 4;
```

### 8.3 性能优化

**1. Seata Server 优化：**

```yaml
# 服务端性能优化配置
seata:
  store:
    db:
      # 连接池调优
      min-conn: 10
      max-conn: 200
      max-wait: 3000
      # 批量操作
      query-limit: 500

  server:
    # 最大提交/回滚重试超时
    max-commit-retry-timeout: 60000
    max-rollback-retry-timeout: 60000

    # 线程池配置
    # 增加处理线程提升并发能力
    service:
      # 默认线程池配置优化
      enableParameterValidator: false
```

**2. 客户端优化：**

```yaml
# 客户端性能优化配置
seata:
  client:
    # 启用批量发送（减少网络交互）
    tm:
      enable-tm-client-batch-send-request: false
    rm:
      enable-rm-client-batch-send-request: true

    rm:
      # 异步提交缓冲区（增大可提升吞吐量）
      async-commit-buffer-limit: 20000

      # 全局锁重试间隔（越小越快失败，越大越容易等待成功）
      lock:
        retry-interval: 5      # 5ms 重试间隔
        retry-times: 20        # 最多重试20次

      # 表元信息缓存
      table-meta-check-enable: true
      table-meta-checker-interval: 60000

    undo:
      # 关闭数据校验（提升性能，但降低一致性）
      data-validation: false
      # 只关心变化的列（减少 undo log 大小）
      only-care-update-columns: true
      # 使用 kryo 序列化（比 jackson 性能更好）
      log-serialization: kryo
```

**3. 业务层面优化：**

```java
@Service
@Slf4j
public class PerformanceOptimizationService {

    /**
     * 优化1：减少全局事务的范围
     * 
     * 不好的实践：将不需要事务的操作也包含在全局事务中
     */
    @GlobalTransactional
    public void badPractice() {
        serviceA.doWork();           // 需要事务
        sendNotification();          // 不需要事务 → 延长了全局事务时间
        serviceB.doWork();           // 需要事务
        writeAuditLog();             // 不需要事务 → 延长了全局事务时间
    }

    /**
     * 好的实践：只对需要事务的操作使用 @GlobalTransactional
     */
    @GlobalTransactional
    public void goodPractice() {
        serviceA.doWork();           // 需要事务
        serviceB.doWork();           // 需要事务
    }

    // 不需要事务的方法不要放在 @GlobalTransactional 里
    public void nonTransactionalOperations() {
        sendNotification();
        writeAuditLog();
    }

    /**
     * 优化2：合理设置超时时间
     * 太短 → 频繁超时，频繁重试
     * 太长 → 资源锁定时间过长
     * 
     * 建议：根据业务实际执行时间设置，留 50% 余量
     */
    @GlobalTransactional(timeoutMills = 30000)  // 预计执行 20s
    public void optimizedTimeout() {
        // ...
    }

    /**
     * 优化3：避免在事务中执行耗时操作
     */
    @GlobalTransactional
    public void avoidSlowOps() {
        // 快速数据库操作（应该在事务中）
        orderService.createOrder(order);

        // 慢速操作（移动到事务外）
        // imageService.compressImage(order.getImage());  // 压缩图片很耗时
        
        // 网络调用（移动到事务外）
        // smsService.sendNotification(order.getUserId());
    }

    /**
     * 优化4：批量操作代替循环
     * 
     * 不好的实践：循环中逐个操作（大量分支事务注册）
     */
    @GlobalTransactional
    public void badBatchProcess(List<Order> orders) {
        for (Order order : orders) {
            orderService.createOrder(order);  // 每个循环注册一个分支事务
        }
    }

    /**
     * 好的实践：批量合并
     */
    @Transactional
    public void goodBatchProcess(List<Order> orders) {
        // 一次性批量插入，只注册一个分支事务
        orderMapper.batchInsert(orders);
    }
}
```

**4. 性能监控指标：**

| 指标 | 说明 | 合理范围 | 异常处理 |
|------|------|---------|---------|
| 全局事务耗时 | 从开始到结束的时间 | < 5s | 超时时检查是否有慢 SQL 或网络延迟 |
| 分支事务数 | 单个全局事务中的分支数 | < 10 | 分支过多时考虑合并或拆分 |
| 全局锁等待时间 | 等待其他事务释放锁的时间 | < 100ms | 锁冲突严重时优化数据访问模式 |
| UndoLog 大小 | 单个分支事务的 undo log | < 100KB | undo log 过大会影响回滚性能 |
| TP99 响应时间 | 99% 请求的响应时间 | < 1s | 检查是否有资源竞争 |
| 二阶段提交耗时 | 从 TC 发出到 RM 确认 | < 500ms | 检查网络和数据库性能 |

**5. 避免分布式事务的场景：**

```java
/**
 * 很多时候可以用本地事务 + 消息队列代替分布式事务
 * 
 * 场景：创建订单后发送消息通知
 * 
 * 方案A：使用 @GlobalTransactional（不推荐）
 */
@GlobalTransactional
public void createOrderWithNotification(Order order) {
    orderMapper.insert(order);                    // 数据库操作
    notificationService.send(order.getUserId());  // 网络调用（不可控）
}

/**
 * 方案B：使用本地事务 + 消息队列（推荐）
 */
@Transactional
public void createOrderWithEvent(Order order) {
    // 1. 本地事务：创建订单 + 发送事件
    orderMapper.insert(order);
    eventPublisher.publishEvent(new OrderCreatedEvent(order.getId()));
    // 事件消费方异步处理通知
    // 如果失败，通过重试机制保证最终一致
}
```

### 8.4 常见问题排障清单

| 问题现象 | 可能原因 | 解决方案 |
|----------|---------|----------|
| `io.seata.core.exception.TmTransactionException: Could not register branch` | TM 与 TC 连接失败 | 检查 Seata Server 是否运行，网络是否通畅 |
| `Lock Conflict` 异常 | 全局锁冲突 | 检查是否有其他事务在修改同一行数据，增加重试次数 |
| `BranchTransactionException: Failed to require global lock` | 获取全局锁超时 | 优化事务执行时间，减少锁冲突 |
| 事务未回滚 | 异常被捕获后未重新抛出 | 确保 `@GlobalTransactional` 中抛出的异常未被吞掉 |
| 二阶段回滚失败 | undo log 被删除或数据被修改 | 检查 undo\_log 表是否正常，查看 Server 日志 |
| 数据不一致 | 脏写导致回滚后数据异常 | 开启 `undo.dataValidation=true`，检查业务逻辑 |
| `No available service` | 找不到 Seata Server | 检查注册中心配置，确认 grouplist 是否正确 |
| 性能急剧下降 | 全局事务范围过大 | 减少全局事务中的操作，或切换到 TCC 模式 |

***

## 总结

Seata 支持的四种分布式事务模式各有适用场景：

| 模式 | 一致性 | 侵入性 | 性能 | 适用场景 |
|------|--------|--------|------|---------|
| **AT** | 最终一致 | 无侵入 | 高 | 通用分布式事务，基于数据库操作 |
| **TCC** | 最终一致 | 强侵入 | 极高 | 资源预留，需要细粒度控制 |
| **SAGA** | 最终一致 | 中 | 高 | 长事务，多步骤流程 |
| **XA** | 强一致 | 无侵入 | 低 | 金融等需要强一致性的场景 |

**选型建议：**

* 如果业务主要是单表 CRUD，优先选 **AT 模式**
* 如果性能要求极高且愿意投入开发成本，选 **TCC 模式**
* 如果业务流程复杂、步骤多，选 **SAGA 模式**
* 如果需要强一致性且能接受性能损失，选 **XA 模式**
