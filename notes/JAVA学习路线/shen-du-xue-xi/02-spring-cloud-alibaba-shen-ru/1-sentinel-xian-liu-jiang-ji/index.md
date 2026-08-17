---
url: >-
  /my_notes/notes/JAVA学习路线/shen-du-xue-xi/02-spring-cloud-alibaba-shen-ru/1-sentinel-xian-liu-jiang-ji/index.md
---
# Sentinel 限流降级学习文档

> 阿里巴巴开源的流量防卫兵，面向分布式服务架构的流量控制、熔断降级组件。

***

## 目录

1. [Sentinel 核心概念](#1-sentinel-核心概念)
2. [流量控制](#2-流量控制)
3. [熔断降级](#3-熔断降级)
4. [热点参数限流](#4-热点参数限流)
5. [系统自适应保护](#5-系统自适应保护)
6. [规则持久化](#6-规则持久化)
7. [Spring Cloud 集成](#7-spring-cloud-集成)
8. [Sentinel Dashboard](#8-sentinel-dashboard)

***

## 1. Sentinel 核心概念

### 1.1 资源（Resource）

资源是 Sentinel 中保护的最小单位，可以是任何 Java 方法、代码块、URL 或服务调用。

**定义资源的三种方式：**

```java
import com.alibaba.csp.sentinel.Entry;
import com.alibaba.csp.sentinel.SphU;
import com.alibaba.csp.sentinel.SphO;
import com.alibaba.csp.sentinel.slots.block.BlockException;
import com.alibaba.csp.sentinel.slots.block.RuleConstant;
import com.alibaba.csp.sentinel.slots.block.flow.FlowRule;
import com.alibaba.csp.sentinel.slots.block.flow.FlowRuleManager;
import java.util.ArrayList;
import java.util.List;

// 方式一：SphU —— 显式声明资源（抛出异常）
public class SphUDemo {
    public static void main(String[] args) {
        initFlowRules();
        Entry entry = null;
        try {
            entry = SphU.entry("HelloWorld");
            System.out.println("资源访问成功");
        } catch (BlockException e) {
            System.out.println("资源被限流：" + e.getMessage());
        } finally {
            if (entry != null) {
                entry.exit();
            }
        }
    }

    private static void initFlowRules() {
        List<FlowRule> rules = new ArrayList<>();
        FlowRule rule = new FlowRule();
        rule.setResource("HelloWorld");
        rule.setGrade(RuleConstant.FLOW_GRADE_QPS);
        rule.setCount(20);
        rules.add(rule);
        FlowRuleManager.loadRules(rules);
    }
}
```

```java
// 方式二：SphO —— 返回 boolean（不抛异常）
public class SphODemo {
    public static void main(String[] args) {
        initFlowRules();
        if (SphO.entry("HelloWorld")) {
            try {
                System.out.println("资源访问成功");
            } finally {
                SphO.exit();
            }
        } else {
            System.out.println("资源被限流");
        }
    }

    private static void initFlowRules() {
        List<FlowRule> rules = new ArrayList<>();
        FlowRule rule = new FlowRule();
        rule.setResource("HelloWorld");
        rule.setGrade(RuleConstant.FLOW_GRADE_THREAD);
        rule.setCount(5);
        rules.add(rule);
        FlowRuleManager.loadRules(rules);
    }
}
```

```java
// 方式三：@SentinelResource 注解（推荐，见第 7 章）
```

### 1.2 规则（Rule）

Sentinel 提供五大类规则，每类规则负责不同维度：

| 规则类型 | 核心类 | 作用维度 | 应用场景 |
|---------|--------|---------|---------|
| 流量控制 | `FlowRule` | QPS / 线程数 | 接口限流、防刷 |
| 熔断降级 | `DegradeRule` | RT / 异常比例 / 异常数 | 保护下游不稳定服务 |
| 系统保护 | `SystemRule` | Load / CPU / RT / 线程数 / 入口 QPS | 整体系统水位保护 |
| 热点参数 | `ParamFlowRule` | 特定参数值 | 商品 ID 级别的限流 |
| 授权规则 | `AuthorityRule` | 调用方来源 | 黑白名单控制 |

```java
// 规则管理的统一入口示例 —— 同时加载多种规则
import com.alibaba.csp.sentinel.slots.block.authority.AuthorityRule;
import com.alibaba.csp.sentinel.slots.block.authority.AuthorityRuleManager;
import com.alibaba.csp.sentinel.slots.block.degrade.DegradeRule;
import com.alibaba.csp.sentinel.slots.block.degrade.DegradeRuleManager;
import com.alibaba.csp.sentinel.slots.system.SystemRule;
import com.alibaba.csp.sentinel.slots.system.SystemRuleManager;

import java.util.*;

public class MultiRuleDemo {
    public static void initAllRules() {
        // 1. 流量控制规则
        List<FlowRule> flowRules = new ArrayList<>();
        FlowRule flowRule = new FlowRule("payService");
        flowRule.setGrade(RuleConstant.FLOW_GRADE_QPS);
        flowRule.setCount(100);
        flowRules.add(flowRule);
        FlowRuleManager.loadRules(flowRules);

        // 2. 熔断降级规则
        List<DegradeRule> degradeRules = new ArrayList<>();
        DegradeRule degradeRule = new DegradeRule("orderService")
                .setGrade(RuleConstant.DEGRADE_GRADE_RT)
                .setCount(200)
                .setTimeWindow(10);
        degradeRules.add(degradeRule);
        DegradeRuleManager.loadRules(degradeRules);

        // 3. 系统保护规则
        List<SystemRule> systemRules = new ArrayList<>();
        SystemRule systemRule = new SystemRule();
        systemRule.setHighestSystemLoad(3.0);
        systemRule.setAvgRt(100);
        systemRules.add(systemRule);
        SystemRuleManager.loadRules(systemRules);

        // 4. 授权规则
        List<AuthorityRule> authorityRules = new ArrayList<>();
        AuthorityRule authorityRule = new AuthorityRule();
        authorityRule.setResource("adminApi");
        authorityRule.setLimitApp("appA,appB");
        authorityRule.setStrategy(RuleConstant.AUTHORITY_WHITE);
        authorityRules.add(authorityRule);
        AuthorityRuleManager.loadRules(authorityRules);
    }
}
```

### 1.3 插槽链（Slot Chain）

Sentinel 采用责任链模式，每个 `ProcessorSlot` 负责一种功能，按顺序执行：

```
NodeSelectorSlot → ClusterBuilderSlot → LogSlot → StatisticSlot → AuthoritySlot → SystemSlot → FlowSlot → DegradeSlot
```

| 插槽名称 | 职责 | 执行阶段 |
|---------|------|---------|
| `NodeSelectorSlot` | 为当前资源构建调用树节点 | 前置统计 |
| `ClusterBuilderSlot` | 构建集群维度的统计节点 | 前置统计 |
| `LogSlot` | 日志记录 | 日志 |
| `StatisticSlot` | 实时统计（QPS、RT、线程数） | 统计 |
| `AuthoritySlot` | 授权规则校验 | 规则校验 |
| `SystemSlot` | 系统保护规则校验 | 规则校验 |
| `FlowSlot` | 流量控制规则校验 | 规则校验 |
| `DegradeSlot` | 熔断降级规则校验 | 规则校验 |

```java
// 自定义插槽 —— 扩展 Sentinel 插槽链
import com.alibaba.csp.sentinel.context.Context;
import com.alibaba.csp.sentinel.node.DefaultNode;
import com.alibaba.csp.sentinel.slotchain.AbstractLinkedProcessorSlot;
import com.alibaba.csp.sentinel.slotchain.ResourceWrapper;
import com.alibaba.csp.sentinel.slots.block.BlockException;

public class CustomSlot extends AbstractLinkedProcessorSlot<DefaultNode> {

    @Override
    public void entry(Context context, ResourceWrapper resourceWrapper,
                      DefaultNode node, int count, boolean prioritized,
                      Object... args) throws Throwable {
        System.out.println("[CustomSlot] 进入资源：" + resourceWrapper.getName());
        fireEntry(context, resourceWrapper, node, count, prioritized, args);
    }

    @Override
    public void exit(Context context, ResourceWrapper resourceWrapper,
                     DefaultNode node, int count, Object... args) {
        System.out.println("[CustomSlot] 退出资源：" + resourceWrapper.getName());
        fireExit(context, resourceWrapper, node, count, args);
    }
}
```

```java
// 注册自定义插槽（通过 SPI）
// 文件 META-INF/services/com.alibaba.csp.sentinel.slotchain.ProcessorSlotChain
// 内容：
// com.example.CustomSlotChain
//
// 或直接扩展默认插槽链：
// 文件 META-INF/services/com.alibaba.csp.sentinel.slotchain.DefaultSlotChainBuilder
import com.alibaba.csp.sentinel.slotchain.DefaultSlotChainBuilder;
import com.alibaba.csp.sentinel.slotchain.ProcessorSlotChain;

public class CustomSlotChainBuilder extends DefaultSlotChainBuilder {
    @Override
    public ProcessorSlotChain build() {
        ProcessorSlotChain chain = super.build();
        chain.addLast(new CustomSlot());
        return chain;
    }
}
```

***

## 2. 流量控制

### 2.1 QPS 限流与线程数限流

| 限流维度 | 阈值含义 | 统计方式 | 典型场景 |
|---------|---------|---------|---------|
| QPS | 每秒允许的请求数 | 滑动窗口计数器 | API 网关限流、读接口 |
| 线程数 | 并发线程数上限 | 当前活跃线程数 | 慢 I/O 写接口、数据库操作 |

```java
import com.alibaba.csp.sentinel.Entry;
import com.alibaba.csp.sentinel.SphU;
import com.alibaba.csp.sentinel.slots.block.BlockException;
import com.alibaba.csp.sentinel.slots.block.flow.FlowRule;
import com.alibaba.csp.sentinel.slots.block.flow.FlowRuleManager;
import java.util.ArrayList;
import java.util.List;

// QPS 限流示例
public class QpsLimitDemo {
    public static void initQpsRule() {
        List<FlowRule> rules = new ArrayList<>();
        FlowRule rule = new FlowRule();
        rule.setResource("queryOrder");
        rule.setGrade(RuleConstant.FLOW_GRADE_QPS);
        rule.setCount(10);
        rule.setLimitApp("default");
        rules.add(rule);
        FlowRuleManager.loadRules(rules);
    }

    public static void queryOrder(Long orderId) {
        Entry entry = null;
        try {
            entry = SphU.entry("queryOrder");
            System.out.println("查询订单：" + orderId);
            Thread.sleep(20);
        } catch (BlockException e) {
            System.out.println("queryOrder 被限流了");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            if (entry != null) {
                entry.exit();
            }
        }
    }

    public static void main(String[] args) {
        initQpsRule();
        for (int i = 0; i < 100; i++) {
            int finalI = i;
            new Thread(() -> queryOrder((long) finalI)).start();
        }
    }
}
```

```java
// 线程数限流示例 —— 保护慢接口
public class ThreadLimitDemo {
    public static void initThreadRule() {
        List<FlowRule> rules = new ArrayList<>();
        FlowRule rule = new FlowRule();
        rule.setResource("slowReport");
        rule.setGrade(RuleConstant.FLOW_GRADE_THREAD);
        rule.setCount(3);
        rules.add(rule);
        FlowRuleManager.loadRules(rules);
    }

    public static void generateReport() {
        Entry entry = null;
        try {
            entry = SphU.entry("slowReport");
            System.out.println("开始生成报表，当前线程：" + Thread.currentThread().getName());
            Thread.sleep(5000);
        } catch (BlockException e) {
            System.out.println("报表接口被限流");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            if (entry != null) entry.exit();
        }
    }

    public static void main(String[] args) {
        initThreadRule();
        for (int i = 0; i < 10; i++) {
            new Thread(ThreadLimitDemo::generateReport).start();
        }
    }
}
```

### 2.2 限流模式：直接、关联、链路

| 模式 | 说明 | 配置场景 |
|------|------|---------|
| 直接（DEFAULT） | 资源自身达到阈值即限流 | 最常用，独立接口限流 |
| 关联（RELATE） | A 关联 B，B 流量超过阈值时 A 被限流 | 读写分离场景，写压力大时降级读 |
| 链路（CHAIN） | 按调用链入口限流 | 内部调用链的不同入口 |

```java
// 关联限流：当 writeOrder 达到阈值时，readOrder 被限流
public class RelateLimitDemo {
    public static void initRelateRule() {
        List<FlowRule> rules = new ArrayList<>();
        FlowRule rule = new FlowRule();
        rule.setResource("readOrder");
        rule.setGrade(RuleConstant.FLOW_GRADE_QPS);
        rule.setCount(5);
        rule.setStrategy(RuleConstant.STRATEGY_RELATE);
        rule.setRefResource("writeOrder");
        rules.add(rule);
        FlowRuleManager.loadRules(rules);
    }

    public static void main(String[] args) {
        initRelateRule();
        for (int i = 0; i < 20; i++) {
            new Thread(() -> {
                try (Entry entry = SphU.entry("writeOrder")) {
                    Thread.sleep(100);
                } catch (BlockException | InterruptedException e) {
                    // ignore
                }
            }).start();
        }
        try (Entry entry = SphU.entry("readOrder")) {
            System.out.println("读订单成功");
        } catch (BlockException e) {
            System.out.println("读订单被限流（写压力过大）");
        }
    }
}
```

### 2.3 流控效果

#### 三种流控效果对比

| 效果 | 核心算法 | 行为 | 适用场景 |
|------|---------|------|---------|
| 快速失败（直接拒绝） | 滑动窗口 + 计数器 | 超过阈值立即拒绝 | 对延迟敏感的核心接口 |
| Warm Up（冷启动） | 令牌桶 | 阈值从 `count / coldFactor` 缓慢增加到 `count` | 系统刚启动、缓存预热 |
| 排队等待 | 漏桶 | 请求以固定速率通过，多余排队 | 消息推送、削峰填谷 |

```java
// 快速失败（默认）
public class FastFailDemo {
    public static List<FlowRule> buildFastFailRule() {
        List<FlowRule> rules = new ArrayList<>();
        FlowRule rule = new FlowRule("fastFailApi");
        rule.setGrade(RuleConstant.FLOW_GRADE_QPS);
        rule.setCount(10);
        rule.setControlBehavior(RuleConstant.CONTROL_BEHAVIOR_DEFAULT);
        rules.add(rule);
        return rules;
    }
}
```

```java
// Warm Up —— 冷启动
public class WarmUpDemo {
    public static List<FlowRule> buildWarmUpRule() {
        List<FlowRule> rules = new ArrayList<>();
        FlowRule rule = new FlowRule("warmUpApi");
        rule.setGrade(RuleConstant.FLOW_GRADE_QPS);
        rule.setCount(300);
        rule.setControlBehavior(RuleConstant.CONTROL_BEHAVIOR_WARM_UP);
        rule.setWarmUpPeriodSec(10);
        rules.add(rule);
        return rules;
    }
}
```

```java
// 排队等待 —— 漏桶算法
public class QueueWaitDemo {
    public static List<FlowRule> buildQueueWaitRule() {
        List<FlowRule> rules = new ArrayList<>();
        FlowRule rule = new FlowRule("queueApi");
        rule.setGrade(RuleConstant.FLOW_GRADE_QPS);
        rule.setCount(100);
        rule.setControlBehavior(RuleConstant.CONTROL_BEHAVIOR_RATE_LIMITER);
        rule.setMaxQueueingTimeMs(500);
        rules.add(rule);
        return rules;
    }
}
```

### 2.4 令牌桶与漏桶算法原理

```java
// 令牌桶算法实现 —— Sentinel Warm Up 底层
import java.util.concurrent.atomic.AtomicLong;

public class TokenBucket {
    private final long capacity;
    private final long refillRate;
    private long tokens;
    private long lastRefillTime;

    public TokenBucket(long capacity, long refillRate) {
        this.capacity = capacity;
        this.refillRate = refillRate;
        this.tokens = capacity;
        this.lastRefillTime = System.nanoTime();
    }

    public synchronized boolean tryAcquire(int permits) {
        refill();
        if (tokens >= permits) {
            tokens -= permits;
            return true;
        }
        return false;
    }

    private void refill() {
        long now = System.nanoTime();
        long elapsed = now - lastRefillTime;
        long tokensToAdd = (long) (elapsed / 1_000_000_000.0 * refillRate);
        if (tokensToAdd > 0) {
            tokens = Math.min(capacity, tokens + tokensToAdd);
            lastRefillTime = now;
        }
    }

    public static void main(String[] args) throws InterruptedException {
        TokenBucket bucket = new TokenBucket(10, 5);
        for (int i = 0; i < 20; i++) {
            boolean acquired = bucket.tryAcquire(1);
            System.out.println("请求 " + i + ": " + (acquired ? "通过" : "限流"));
            Thread.sleep(100);
        }
    }
}
```

#### 两算法对比

| 特性 | 令牌桶 | 漏桶 |
|------|-------|------|
| 核心思想 | 匀速生成令牌，有则通过 | 固定速率漏出，超出拒绝 |
| 应对突发 | 支持（桶中可积累令牌） | 不支持（匀速处理） |
| 适用范围 | 允许一定突发流量 | 严格要求平滑速率 |
| Sentinel 用途 | Warm Up 冷启动 | 排队等待 |

***

## 3. 熔断降级

### 3.1 熔断器三种状态

```
CLOSED（关闭） → OPEN（打开） → HALF_OPEN（半开） → CLOSED 或 OPEN
```

| 状态 | 含义 | 行为 |
|------|------|------|
| CLOSED | 熔断器关闭，正常调用 | 所有请求通过，统计指标 |
| OPEN | 熔断器打开，请求熔断 | 直接返回降级逻辑，拒绝调用 |
| HALF\_OPEN | 半开状态，探测恢复 | 允许少量请求通过，判断是否恢复 |

### 3.2 慢调用比例

当单位统计时长（`statIntervalMs`）内请求数 >= `minRequestAmount`，且慢调用比例 > `slowRatioThreshold`，则熔断。

```java
public class SlowCallRatioDemo {

    public static void initDegradeRule() {
        List<DegradeRule> rules = new ArrayList<>();
        DegradeRule rule = new DegradeRule("slowService");
        rule.setGrade(RuleConstant.DEGRADE_GRADE_RT);
        rule.setCount(100);
        rule.setTimeWindow(10);
        rule.setSlowRatioThreshold(0.5);
        rule.setMinRequestAmount(5);
        rule.setStatIntervalMs(1000);
        rules.add(rule);
        DegradeRuleManager.loadRules(rules);
    }

    public static void callSlowService() {
        Entry entry = null;
        try {
            entry = SphU.entry("slowService");
            if (Math.random() > 0.5) {
                Thread.sleep(200);
            } else {
                Thread.sleep(50);
            }
            System.out.println("调用成功");
        } catch (BlockException e) {
            System.out.println("服务熔断：" + e.getClass().getSimpleName());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            if (entry != null) entry.exit();
        }
    }

    public static void main(String[] args) throws InterruptedException {
        initDegradeRule();
        for (int i = 0; i < 50; i++) {
            callSlowService();
            Thread.sleep(100);
        }
    }
}
```

### 3.3 异常比例

当统计时长内请求数 >= `minRequestAmount`，且异常比例 > `count`，则熔断。

```java
public class ExceptionRatioDemo {

    public static void initDegradeRule() {
        List<DegradeRule> rules = new ArrayList<>();
        DegradeRule rule = new DegradeRule("erroneousService");
        rule.setGrade(RuleConstant.DEGRADE_GRADE_EXCEPTION_RATIO);
        rule.setCount(0.2);
        rule.setTimeWindow(10);
        rule.setMinRequestAmount(5);
        rules.add(rule);
        DegradeRuleManager.loadRules(rules);
    }

    public static void callErroneousService() throws Exception {
        Entry entry = null;
        try {
            entry = SphU.entry("erroneousService");
            if (Math.random() > 0.7) {
                throw new RuntimeException("服务异常");
            }
            System.out.println("调用成功");
        } catch (BlockException e) {
            System.out.println("服务熔断");
        } finally {
            if (entry != null) entry.exit();
        }
    }

    public static void main(String[] args) throws Exception {
        initDegradeRule();
        for (int i = 0; i < 50; i++) {
            callErroneousService();
            Thread.sleep(100);
        }
    }
}
```

### 3.4 异常数

当统计时长内异常数 > `count`，则熔断。

```java
public class ExceptionCountDemo {

    public static void initDegradeRule() {
        List<DegradeRule> rules = new ArrayList<>();
        DegradeRule rule = new DegradeRule("faultyService");
        rule.setGrade(RuleConstant.DEGRADE_GRADE_EXCEPTION_COUNT);
        rule.setCount(5);
        rule.setTimeWindow(30);
        rule.setMinRequestAmount(5);
        rule.setStatIntervalMs(60000);
        rules.add(rule);
        DegradeRuleManager.loadRules(rules);
    }

    private static void riskyCall() {
        Entry entry = null;
        try {
            entry = SphU.entry("faultyService");
            throw new RuntimeException("数据库连接失败");
        } catch (BlockException e) {
            System.out.println("触发熔断，快速失败");
        } finally {
            if (entry != null) entry.exit();
        }
    }

    public static void main(String[] args) throws Exception {
        initDegradeRule();
        for (int i = 0; i < 30; i++) {
            riskyCall();
            Thread.sleep(50);
        }
    }
}
```

### 降级规则配置一览

| 参数 | 说明 | 慢调用 | 异常比例 | 异常数 |
|------|------|--------|---------|-------|
| `grade` | 熔断策略 | `DEGRADE_GRADE_RT` | `DEGRADE_GRADE_EXCEPTION_RATIO` | `DEGRADE_GRADE_EXCEPTION_COUNT` |
| `count` | 阈值 | 最大 RT（ms） | 比例（0~1） | 异常数 |
| `timeWindow` | 熔断持续秒数 | 通用 | 通用 | 通用 |
| `minRequestAmount` | 最小请求数 | 可选 | 可选 | 可选 |
| `statIntervalMs` | 统计窗口 | 可选 | 可选 | 可选 |
| `slowRatioThreshold` | 慢调用比例阈值 | 需要 | 不需要 | 不需要 |

***

## 4. 热点参数限流

热点参数限流会统计**传入参数的特定值**，对不同参数值分别统计流量，实现**参数级别**的精细限流。

```java
import com.alibaba.csp.sentinel.slots.block.flow.param.ParamFlowItem;
import com.alibaba.csp.sentinel.slots.block.flow.param.ParamFlowRule;
import com.alibaba.csp.sentinel.slots.block.flow.param.ParamFlowRuleManager;
import java.util.ArrayList;
import java.util.List;

public class HotParamDemo {

    public static void initHotParamRule() {
        List<ParamFlowRule> rules = new ArrayList<>();
        ParamFlowRule rule = new ParamFlowRule("productQuery");
        rule.setParamIdx(0);
        rule.setDurationInSec(1);
        rule.setCount(10);

        List<ParamFlowItem> items = new ArrayList<>();
        ParamFlowItem hotItem = new ParamFlowItem();
        hotItem.setClassType(Integer.class.getName());
        hotItem.setCount(100);
        hotItem.setObject("1001");
        items.add(hotItem);

        ParamFlowItem seckillItem = new ParamFlowItem();
        seckillItem.setClassType(Integer.class.getName());
        seckillItem.setCount(5);
        seckillItem.setObject("1002");
        items.add(seckillItem);

        rule.setParamFlowItemList(items);
        rules.add(rule);
        ParamFlowRuleManager.loadRules(rules);
    }

    public static void queryProduct(int categoryId, Long productId) {
        Entry entry = null;
        try {
            entry = SphU.entry("productQuery", EntryType.IN, 1, categoryId);
            System.out.println("查询商品: category=" + categoryId + ", product=" + productId);
        } catch (BlockException e) {
            System.out.println("商品分类 " + categoryId + " 被限流");
        } finally {
            if (entry != null) entry.exit();
        }
    }

    public static void main(String[] args) throws InterruptedException {
        initHotParamRule();
        for (int i = 0; i < 20; i++) {
            queryProduct(9999, (long) i);
            Thread.sleep(50);
        }
        for (int i = 0; i < 50; i++) {
            queryProduct(1001, (long) i);
            Thread.sleep(10);
        }
        for (int i = 0; i < 10; i++) {
            queryProduct(1002, (long) i);
            Thread.sleep(50);
        }
    }
}
```

***

## 5. 系统自适应保护

系统规则根据系统负载自动调整入口流量的阈值，达到整体保护。Sentinel 会监控系统指标，当**任一指标**超过阈值时触发限流。

```java
import com.alibaba.csp.sentinel.slots.system.SystemRule;
import com.alibaba.csp.sentinel.slots.system.SystemRuleManager;
import java.util.ArrayList;
import java.util.List;

public class SystemGuardDemo {

    public static void initSystemRules() {
        List<SystemRule> rules = new ArrayList<>();

        SystemRule loadRule = new SystemRule();
        loadRule.setHighestSystemLoad(5.0);
        rules.add(loadRule);

        SystemRule cpuRule = new SystemRule();
        cpuRule.setHighestCpuUsage(0.8);
        rules.add(cpuRule);

        SystemRule rtRule = new SystemRule();
        rtRule.setAvgRt(100);
        rules.add(rtRule);

        SystemRuleManager.loadRules(rules);
    }

    public static void main(String[] args) throws InterruptedException {
        initSystemRules();
        for (int i = 0; i < 1000; i++) {
            Entry entry = null;
            try {
                entry = SphU.entry("systemEntry");
                Thread.sleep(10);
            } catch (BlockException e) {
                System.out.println("系统保护触发");
            } finally {
                if (entry != null) entry.exit();
            }
        }
    }
}
```

***

## 6. 规则持久化

### 6.1 为什么需要持久化

默认规则保存在内存，应用重启后丢失。生产环境需要使用配置中心（Nacos / Apollo）持久化规则。

### 6.2 Nacos 规则持久化

```xml
<dependency>
    <groupId>com.alibaba.csp</groupId>
    <artifactId>sentinel-datasource-nacos</artifactId>
    <version>1.8.6</version>
</dependency>
```

```yaml
spring:
  cloud:
    sentinel:
      datasource:
        flow:
          nacos:
            server-addr: 127.0.0.1:8848
            data-id: ${spring.application.name}-flow-rules
            group-id: SENTINEL_GROUP
            data-type: json
            rule-type: flow
        degrade:
          nacos:
            server-addr: 127.0.0.1:8848
            data-id: ${spring.application.name}-degrade-rules
            group-id: SENTINEL_GROUP
            data-type: json
            rule-type: degrade
```

```json
// Nacos 配置项 —— sentinel-flow-rules.json
// dataId: order-service-flow-rules
[
  {
    "resource": "orderService",
    "limitApp": "default",
    "grade": 1,
    "count": 100,
    "strategy": 0,
    "controlBehavior": 0,
    "clusterMode": false
  }
]
```

```java
// Java 方式向 Nacos 推送规则
import com.alibaba.csp.sentinel.datasource.nacos.NacosDataSource;
import com.alibaba.csp.sentinel.slots.block.flow.FlowRule;
import com.alibaba.csp.sentinel.slots.block.flow.FlowRuleManager;
import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.TypeReference;
import com.alibaba.nacos.api.NacosFactory;
import com.alibaba.nacos.api.config.ConfigService;
import java.util.List;

public class NacosRulePusher {

    public static void initNacosDataSource() throws Exception {
        NacosDataSource<List<FlowRule>> nacosDataSource = new NacosDataSource<>(
                "127.0.0.1:8848", "SENTINEL_GROUP", "order-service-flow-rules",
                source -> JSON.parseObject(source, new TypeReference<List<FlowRule>>() {})
        );
        FlowRuleManager.register2Property(nacosDataSource.getProperty());
    }
}
```

### 配置源对比

| 能力 | Nacos | Apollo | ZooKeeper |
|------|-------|--------|-----------|
| 配置管理 | 是 | 是 | 是 |
| 实时推送 | 长轮询 | 长轮询 | Watcher |
| 成熟度 | 高 | 高 | 高 |
| 推荐生产 | ✅ | ✅ | 一般 |

***

## 7. Spring Cloud 集成

### 7.1 @SentinelResource 注解

```xml
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-sentinel</artifactId>
</dependency>
```

```yaml
spring:
  cloud:
    sentinel:
      transport:
        dashboard: localhost:8080
        port: 8719
      eager: true
      web-context-unify: false
```

```java
@RestController
@RequestMapping("/order")
public class OrderController {

    @GetMapping("/{orderId}")
    @SentinelResource(
            value = "getOrder",
            blockHandler = "getOrderBlockHandler",
            fallback = "getOrderFallback",
            exceptionsToIgnore = {IllegalArgumentException.class}
    )
    public String getOrder(@PathVariable Long orderId) {
        if (orderId <= 0) throw new IllegalArgumentException("无效 ID");
        if (orderId == 9999) throw new RuntimeException("订单异常");
        return "订单: " + orderId;
    }

    public String getOrderBlockHandler(Long orderId, BlockException e) {
        return "请求太频繁: " + e.getClass().getSimpleName();
    }

    public String getOrderFallback(Long orderId, Throwable t) {
        return "服务降级: " + t.getMessage();
    }
}
```

### 7.2 Feign 集成 Sentinel

```yaml
feign:
  sentinel:
    enabled: true
```

```java
@FeignClient(name = "user-service", fallbackFactory = UserClientFallbackFactory.class)
public interface UserClient {
    @GetMapping("/user/{id}")
    User getUserById(@PathVariable("id") Long id);
}

@Component
class UserClientFallbackFactory implements FallbackFactory<UserClient> {
    @Override
    public UserClient create(Throwable cause) {
        return id -> new User(id, "降级用户", "异常降级");
    }
}
```

### 7.3 Gateway 集成 Sentinel

```xml
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-alibaba-sentinel-gateway</artifactId>
</dependency>
```

```java
@Configuration
public class GatewaySentinelConfig {

    @PostConstruct
    public void initGatewayRules() {
        Set<GatewayFlowRule> rules = new HashSet<>();
        rules.add(new GatewayFlowRule("order-route")
                .setCount(100).setIntervalSec(1));
        rules.add(new GatewayFlowRule("pay_api")
                .setCount(50).setIntervalSec(1));
        GatewayRuleManager.loadRules(rules);
    }
}
```

### 7.4 RestTemplate 集成 Sentinel

```java
@Bean
@SentinelRestTemplate(
        blockHandler = "handleBlock",
        blockHandlerClass = SentinelRestTemplateHandler.class
)
@LoadBalanced
public RestTemplate restTemplate() {
    return new RestTemplate();
}
```

***

## 8. Sentinel Dashboard

### 8.1 部署与控制台

```bash
java -jar sentinel-dashboard-1.8.6.jar \
  --server.port=8080 \
  --sentinel.dashboard.auth.username=sentinel \
  --sentinel.dashboard.auth.password=sentinel
```

### 8.2 实时监控指标

| 指标 | 含义 |
|------|------|
| 通过 QPS | 每秒通过的请求数 |
| 拒绝 QPS | 每秒被限流/熔断的请求数 |
| 平均 RT | 平均响应时间 (ms) |
| 并发线程数 | 当前活跃线程数 |

### 8.3 动态规则推送模式

| 模式 | 说明 | 推荐度 |
|------|------|:------:|
| 原始模式（内存） | 客户端内存，重启丢失 | ❌ |
| 拉模式（文件） | 客户端主动拉取 | ⚠️ |
| 推模式（Nacos） | 配置中心主动推送 | ✅ 推荐 |

### 8.4 常见问题排查

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| Dashboard 看不到应用 | 应用未连接 | 检查 `transport.dashboard` 配置 |
| 限流规则不生效 | 资源名不匹配 | 确保 `@SentinelResource(value)` 与规则一致 |
| 链路限流无效 | 未关闭上下文合并 | 设置 `web-context-unify: false` |
| 热点限流不生效 | 参数索引错误 | 检查 `paramIdx` |
| 规则重启丢失 | 未配置持久化 | 配置 Nacos 数据源 |

***

> **参考资源：**
>
> * Sentinel 官方文档: https://sentinelguard.io/zh-cn/
> * GitHub: https://github.com/alibaba/Sentinel
