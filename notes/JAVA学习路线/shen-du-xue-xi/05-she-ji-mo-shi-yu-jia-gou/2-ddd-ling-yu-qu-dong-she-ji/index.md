---
url: >-
  /my_notes/notes/JAVA学习路线/shen-du-xue-xi/05-she-ji-mo-shi-yu-jia-gou/2-ddd-ling-yu-qu-dong-she-ji/index.md
---
# DDD 领域驱动设计

## 一、DDD 核心概念

### 1.1 什么是 DDD

领域驱动设计（Domain-Driven Design，DDD）是由 Eric Evans 在其同名著作中提出的一套软件设计方法论。核心思想是：**以业务领域为核心，通过将业务概念映射为代码模型，来解决复杂业务系统的设计与演化问题**。

DDD 解决的核心痛点：

| 问题 | DDD 的解决方式 |
|------|---------------|
| 业务与开发语言不一致 | 通过通用语言（Ubiquitous Language）统一团队沟通 |
| 需求变化导致代码频繁修改 | 通过边界划分（限界上下文）隔离变化 |
| 复杂业务难以维护 | 通过战术设计模式（实体、值对象、聚合）控制复杂度 |
| CRUD 贫血模型无法承载业务逻辑 | 通过领域模型将业务逻辑内聚到领域层 |

### 1.2 领域、子域与限界上下文

#### 领域（Domain）与子域（Subdomain）

领域是软件系统要解决的业务问题空间。一个大型领域可以拆分为多个**子域**。

**子域分类：**

| 类型 | 定义 | 示例（电商） |
|------|------|-------------|
| **核心域** | 系统的核心竞争力，投入最多资源 | 订单域、交易域 |
| **支撑域** | 支持核心域运行，有定制需求 | 库存域、物流域 |
| **通用域** | 通用能力，可采购现成方案 | 权限认证、通知推送 |

#### 限界上下文（Bounded Context）

限界上下文是 DDD 最核心的战略概念。每个限界上下文是一个**语义和业务边界的独立单元**，内部有统一的通用语言。

* 一个子域通常对应一个限界上下文
* 每个限界上下文有自己独立的数据库、模型和团队
* 不同上下文中相同的业务概念可能有完全不同的含义

**示例：电商系统的限界上下文划分**

```
┌─────────────────────────────────────────────────────┐
│                  电商系统                              │
│                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  订单上下文   │  │  商品上下文   │  │  库存上下文   │ │
│  │              │  │              │  │              │ │
│  │ Order Entity │  │ Product      │  │ Stock Entity │ │
│  │ OrderItem VO │  │ Category     │  │ Warehouse    │ │
│  │ ShippingAddr │  │ ProductSpec  │  │ Inventory    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  支付上下文   │  │  用户上下文   │  │  物流上下文   │ │
│  │              │  │              │  │              │ │
│  │ Payment      │  │ User Entity  │  │ Shipment     │ │
│  │ Transaction  │  │ Account VO   │  │ Tracking     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 1.3 实体（Entity）与值对象（Value Object）

#### 实体（Entity）

**定义：** 有唯一标识、有生命周期、可变化的对象。

* 通过 ID 区分（而非属性值）
* 属性可以变化，但 ID 不变
* 例如：用户、订单、商品

```java
public class User implements Entity<User> {
    private UserId userId;      // 唯一标识
    private String name;
    private Email email;
    private Address address;

    public User(UserId userId, String name, Email email) {
        this.userId = userId;
        this.name = name;
        this.email = email;
    }

    // 通过 ID 判断相等性
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        User user = (User) o;
        return userId.equals(user.userId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId);
    }

    // 行为：修改邮箱（不是简单的 setter，包含业务逻辑）
    public void changeEmail(Email newEmail) {
        // 业务规则：新邮箱不能为空，且不能与原邮箱相同
        if (newEmail == null) {
            throw new IllegalArgumentException("Email cannot be null");
        }
        if (this.email.equals(newEmail)) {
            throw new BusinessException("New email must be different from current email");
        }
        this.email = newEmail;
        // 触发领域事件
        DomainEventPublisher.publish(new EmailChangedEvent(this.userId, this.email, newEmail));
    }
}
```

#### 值对象（Value Object）

**定义：** 通过属性值定义、不可变、可互换的对象。

* 没有唯一标识
* 通过所有属性判断相等性
* 不可变（Immutable）
* 可以共享和复用

```java
// 值对象：地址
public class Address {
    private final String province;
    private final String city;
    private final String district;
    private final String street;
    private final String zipCode;

    public Address(String province, String city, String district, String street, String zipCode) {
        this.province = province;
        this.city = city;
        this.district = district;
        this.street = street;
        this.zipCode = zipCode;
    }

    // 通过所有属性比较
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Address address = (Address) o;
        return province.equals(address.province)
            && city.equals(address.city)
            && district.equals(address.district)
            && street.equals(address.street)
            && zipCode.equals(address.zipCode);
    }

    @Override
    public int hashCode() {
        return Objects.hash(province, city, district, street, zipCode);
    }

    // 没有 setters，只有纯函数方法
    public Address withStreet(String newStreet) {
        return new Address(province, city, district, newStreet, zipCode);
    }
}

// 值对象：金额
public class Money {
    private final BigDecimal amount;
    private final String currency;  // ISO 4217 货币代码

    public Money(BigDecimal amount, String currency) {
        // 业务规则：金额不能为负
        if (amount.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Amount cannot be negative");
        }
        this.amount = amount;
        this.currency = currency;
    }

    // 值对象的行为：加法（返回新对象，不修改原对象）
    public Money add(Money other) {
        if (!this.currency.equals(other.currency)) {
            throw new IllegalArgumentException("Cannot add different currencies");
        }
        return new Money(this.amount.add(other.amount), this.currency);
    }

    // 值对象的行为：乘法
    public Money multiply(int quantity) {
        return new Money(this.amount.multiply(BigDecimal.valueOf(quantity)), this.currency);
    }

    public BigDecimal getAmount() { return amount; }
    public String getCurrency() { return currency; }
}
```

#### 实体 vs 值对象对比

| 维度 | 实体 (Entity) | 值对象 (Value Object) |
|------|--------------|---------------------|
| 标识 | 有唯一标识（ID） | 无标识，通过属性值定义 |
| 相等性 | ID 相等 | 所有属性值相等 |
| 可变性 | 可变（Mutable） | 不可变（Immutable） |
| 生命周期 | 有独立生命周期 | 依附于实体 |
| 共享 | 不共享（每个实体独立） | 可共享（值相同则相同） |
| 持久化 | 独立表 | 嵌入到实体表中 |

***

### 1.4 聚合（Aggregate）与聚合根（Aggregate Root）

**聚合**是一组相关对象的集合，作为数据修改的**一致性边界**。

**聚合根**是聚合中唯一的根实体，外部只能通过聚合根访问聚合内的其他对象。

**聚合设计原则：**

1. 聚合根是唯一可被外部引用的入口
2. 一个事务只修改一个聚合
3. 聚合内部保持一致性，聚合之间通过领域事件异步同步

```java
// 订单聚合 — 聚合根是 Order
public class Order {
    private OrderId orderId;                    // 聚合根 ID
    private OrderNumber orderNo;                // 订单号（值对象）
    private UserId userId;                      // 引用其他聚合（通过 ID，而非对象引用）
    private OrderStatus status;                 // 状态枚举
    private Money totalAmount;                  // 总金额（值对象）
    private List<OrderItem> items;              // 聚合内的实体
    private Address shippingAddress;            // 值对象
    private PaymentInfo paymentInfo;            // 值对象
    private List<OrderEvent> events;            // 领域事件列表

    // 构造：创建订单 — 聚合根负责维护聚合内的一致性
    public Order(OrderId orderId, UserId userId, List<OrderItem> items, Address shippingAddress) {
        this.orderId = orderId;
        this.orderNo = OrderNumber.generate();
        this.userId = userId;
        this.status = OrderStatus.CREATED;
        this.items = items;
        this.shippingAddress = shippingAddress;
        this.events = new ArrayList<>();

        // 计算总金额
        this.totalAmount = items.stream()
            .map(item -> item.getSubtotal())
            .reduce(Money.ZERO, Money::add);

        // 发布订单创建事件
        this.events.add(new OrderCreatedEvent(this.orderId, this.orderNo, this.userId));
    }

    // 业务方法：添加订单项
    public void addItem(ProductId productId, String productName, Money unitPrice, int quantity) {
        if (this.status != OrderStatus.CREATED) {
            throw new IllegalStateException("Cannot add item to non-created order");
        }
        OrderItem item = new OrderItem(productId, productName, unitPrice, quantity);
        this.items.add(item);
        this.totalAmount = this.totalAmount.add(item.getSubtotal());
    }

    // 业务方法：提交订单
    public void submit() {
        if (this.status != OrderStatus.CREATED) {
            throw new IllegalStateException("Order can only be submitted once");
        }
        if (this.items.isEmpty()) {
            throw new IllegalStateException("Cannot submit empty order");
        }
        this.status = OrderStatus.SUBMITTED;
        this.events.add(new OrderSubmittedEvent(this.orderId, this.orderNo, this.userId));
    }

    // 业务方法：支付完成
    public void markPaid(PaymentInfo paymentInfo) {
        if (this.status != OrderStatus.SUBMITTED) {
            throw new IllegalStateException("Order must be submitted before payment");
        }
        this.status = OrderStatus.PAID;
        this.paymentInfo = paymentInfo;
        this.events.add(new OrderPaidEvent(this.orderId, this.orderNo, paymentInfo));
    }

    // 获取领域事件（清除模式，发布后需清空）
    public List<OrderEvent> releaseEvents() {
        List<OrderEvent> released = new ArrayList<>(this.events);
        this.events.clear();
        return released;
    }
}

// 订单项 — 聚合内的实体
public class OrderItem {
    private ProductId productId;
    private String productName;
    private Money unitPrice;
    private int quantity;
    private Money subtotal;

    public OrderItem(ProductId productId, String productName, Money unitPrice, int quantity) {
        this.productId = productId;
        this.productName = productName;
        this.unitPrice = unitPrice;
        this.quantity = quantity;
        this.subtotal = unitPrice.multiply(quantity);
    }

    public Money getSubtotal() { return subtotal; }
    // ... getters（没有 setters，通过 Order 聚合根的方法修改）
}
```

### 1.5 领域服务（Domain Service）

**当某些业务逻辑不适合放在实体或值对象中时，使用领域服务。**

判断标准：

* 涉及多个聚合之间的协作
* 操作是无状态的
* 不适合放在任意一个实体中

```java
// 领域服务：订单价格计算（涉及订单聚合 + 优惠券聚合）
public class OrderPricingService {

    // 计算订单的最终价格（考虑了优惠券、促销、运费）
    public PriceCalculationResult calculateFinalPrice(
            Order order,
            Coupon coupon,
            MemberLevel memberLevel) {

        // 1. 基础总价（取订单聚合的数据）
        Money subtotal = order.getTotalAmount();

        // 2. 应用优惠券
        Money afterCoupon = applyCoupon(subtotal, coupon);

        // 3. 应用会员折扣
        Money afterMemberDiscount = applyMemberDiscount(afterCoupon, memberLevel);

        // 4. 计算运费
        Money shippingFee = calculateShippingFee(order.getShippingAddress(), afterMemberDiscount);

        // 5. 返回最终价格
        return new PriceCalculationResult(afterMemberDiscount, shippingFee, afterMemberDiscount.add(shippingFee));
    }

    private Money applyCoupon(Money amount, Coupon coupon) {
        if (coupon == null || !coupon.isValid()) return amount;
        return coupon.apply(amount);
    }

    private Money applyMemberDiscount(Money amount, MemberLevel level) {
        BigDecimal discountRate = level.getDiscountRate();
        return amount.multiply(discountRate);
    }

    private Money calculateShippingFee(Address address, Money orderAmount) {
        // 满 199 包邮
        if (orderAmount.getAmount().compareTo(new BigDecimal("199")) >= 0) {
            return Money.ZERO;
        }
        // 根据地区计算运费
        if ("偏远地区".equals(address.getProvince())) {
            return new Money(new BigDecimal("20"), "CNY");
        }
        return new Money(new BigDecimal("10"), "CNY");
    }
}
```

### 1.6 领域事件（Domain Event）

领域事件表示领域中发生的、业务人员关心的事件。用于实现聚合之间的**最终一致性**。

```java
// 领域事件基类
public abstract class DomainEvent {
    private final String eventId;
    private final LocalDateTime occurredOn;

    protected DomainEvent() {
        this.eventId = UUID.randomUUID().toString();
        this.occurredOn = LocalDateTime.now();
    }

    public String getEventId() { return eventId; }
    public LocalDateTime getOccurredOn() { return occurredOn; }
}

// 具体领域事件：订单已支付
public class OrderPaidEvent extends DomainEvent {
    private final OrderId orderId;
    private final OrderNumber orderNo;
    private final PaymentInfo paymentInfo;

    public OrderPaidEvent(OrderId orderId, OrderNumber orderNo, PaymentInfo paymentInfo) {
        this.orderId = orderId;
        this.orderNo = orderNo;
        this.paymentInfo = paymentInfo;
    }

    // getters...
}

// 领域事件订阅者（在应用层处理）
@Component
public class OrderPaidEventHandler {

    @Autowired
    private InventoryService inventoryService;

    @Autowired
    private NotificationService notificationService;

    @TransactionalEventListener
    public void onOrderPaid(OrderPaidEvent event) {
        // 1. 扣减库存
        inventoryService.deductInventory(event.getOrderId());

        // 2. 发送通知
        notificationService.sendOrderPaidNotification(event.getOrderNo());
    }
}
```

### 1.7 仓储（Repository）

仓储封装了聚合的存储和检索逻辑，使领域层不依赖基础设施。

* **每个聚合对应一个仓储接口**
* **仓储接口定义在领域层，实现在基础设施层**

```java
// 仓储接口 — 定义在领域层
public interface OrderRepository {
    // 通过 ID 获取聚合
    Order findById(OrderId orderId);

    // 保存聚合（新增或更新）
    void save(Order order);

    // 删除聚合
    void delete(OrderId orderId);

    // 查询方法
    List<Order> findByUserId(UserId userId, Pageable pageable);
}

// 仓储实现 — 在基础设施层
@Repository
public class OrderRepositoryImpl implements OrderRepository {

    @Autowired
    private OrderJpaRepository jpaRepository;

    @Autowired
    private OrderMapper orderMapper;

    @Override
    public Order findById(OrderId orderId) {
        OrderPO orderPO = jpaRepository.findById(orderId.getValue())
            .orElseThrow(() -> new OrderNotFoundException(orderId));
        return orderMapper.toDomain(orderPO);
    }

    @Override
    public void save(Order order) {
        // 1. 获取领域事件
        List<OrderEvent> events = order.releaseEvents();

        // 2. 持久化订单
        OrderPO orderPO = orderMapper.toPO(order);
        jpaRepository.save(orderPO);

        // 3. 发布领域事件
        events.forEach(DomainEventPublisher::publish);
    }

    @Override
    public void delete(OrderId orderId) {
        jpaRepository.deleteById(orderId.getValue());
    }

    @Override
    public List<Order> findByUserId(UserId userId, Pageable pageable) {
        return jpaRepository.findByUserId(userId.getValue(), pageable)
            .stream()
            .map(orderMapper::toDomain)
            .collect(Collectors.toList());
    }
}
```

### 1.8 工厂（Factory）

工厂封装复杂对象的创建逻辑。当构造器不够用时（创建逻辑复杂），使用工厂方法。

```java
// 领域工厂：创建订单聚合
@Component
public class OrderFactory {

    private final ProductRepository productRepository;

    public OrderFactory(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    public Order createOrder(CreateOrderRequest request) {
        // 1. 生成订单 ID
        OrderId orderId = OrderId.generate();

        // 2. 将请求中的商品信息转换为订单项
        List<OrderItem> items = request.getItemRequests().stream()
            .map(itemReq -> {
                Product product = productRepository.findById(itemReq.getProductId());
                return new OrderItem(
                    product.getProductId(),
                    product.getName(),
                    product.getPrice(),
                    itemReq.getQuantity()
                );
            })
            .collect(Collectors.toList());

        // 3. 创建收货地址值对象
        Address address = new Address(
            request.getProvince(),
            request.getCity(),
            request.getDistrict(),
            request.getStreet(),
            request.getZipCode()
        );

        // 4. 创建订单聚合
        return new Order(orderId, request.getUserId(), items, address);
    }
}
```

***

## 二、DDD 战略设计

### 2.1 如何划分限界上下文（电商案例）

划分限界上下文是 DDD 战略设计的核心步骤，常见方法如下：

**步骤：**

1. **业务域分析**：与业务专家一起梳理业务流程
2. **语言识别**：识别业务概念和术语，找出统一的通用语言
3. **边界划分**：根据业务流程和团队结构划分边界
4. **关系梳理**：确定上下文之间的依赖关系

**电商系统限界上下文划分示例：**

| 限界上下文 | 核心概念 | 对应子域类型 | 独立数据库 | 独立团队 |
|-----------|---------|-------------|-----------|---------|
| 订单上下文 | Order、OrderItem、OrderStatus | 核心域 | 是 | 团队A |
| 商品上下文 | Product、Category、Specification | 核心域 | 是 | 团队B |
| 库存上下文 | Inventory、Warehouse、Stock | 支撑域 | 是 | 团队C |
| 支付上下文 | Payment、Transaction、Refund | 支撑域 | 是 | 团队A |
| 用户上下文 | User、Account、Address | 通用域 | 是 | 团队D |
| 物流上下文 | Shipment、Tracking、Delivery | 支撑域 | 是 | 团队C |
| 营销上下文 | Coupon、Promotion、Activity | 支撑域 | 是 | 团队B |

### 2.2 上下文映射图（Context Map）

上下文映射图展示了限界上下文之间的协作关系。

**常见关系类型：**

| 关系 | 说明 | 图示 | 适用场景 |
|------|------|------|---------|
| 合作关系（Partnership） | 两个上下文互相依赖，同步协调 | A ↔ B | 紧密耦合的业务关系 |
| 共享内核（Shared Kernel） | 共享一部分公共模型 | A ∩ B | 跨上下文的通用概念 |
| 客户-供应商（Customer-Supplier） | 上游影响下游 | A → B | API 提供者与消费者 |
| 防腐层（Anti-Corruption Layer） | 保护本地模型不受外部污染 | A → ACL → B | 与遗留系统集成 |
| 分离方式（Separate Ways） | 完全独立，无集成 | A   B | 不相关的业务能力 |
| 开放主机服务（Open Host Service） | 提供标准化协议 | A → OHS → B | 对外 API 提供 |

**电商上下文映射图示例：**

```
┌──────────┐    合作关系    ┌──────────┐
│  订单     │◄────────────►│  支付     │
│  上下文   │              │  上下文   │
└────┬─────┘              └──────────┘
     │                        │
     │ 客户-供应商            │ 客户-供应商
     ▼                        ▼
┌──────────┐              ┌──────────┐
│  库存     │              │  物流     │
│  上下文   │              │  上下文   │
└──────────┘              └──────────┘

┌──────────┐    防腐层     ┌──────────┐
│  商品     │──────────────►│  旧ERP   │
│  上下文   │    ACL       │  系统    │
└──────────┘              └──────────┘
```

### 2.3 防腐层（Anti-Corruption Layer）

防腐层（ACL）用于保护当前上下文不受外部系统（尤其是遗留系统）的模型污染。

```java
// 防腐层 — 保护订单上下文不受旧 ERP 系统的模型污染

// 外部系统接口（旧 ERP 的接口）
public interface LegacyErpClient {
    LegacyOrderResponse queryOrder(String orderCode);
    void updateOrderStatus(String orderCode, String status);
}

// 防腐层：将遗留系统的模型转换为当前上下文的模型
@Component
public class ErpAntiCorruptionLayer {

    private final LegacyErpClient erpClient;

    public ErpAntiCorruptionLayer(LegacyErpClient erpClient) {
        this.erpClient = erpClient;
    }

    // 转换：遗留系统的订单 → 当前上下文的订单
    public Order toDomainOrder(String orderCode) {
        LegacyOrderResponse legacyResponse = erpClient.queryOrder(orderCode);

        // 进行模型转换，隔离遗留系统的复杂模型
        OrderId orderId = new OrderId(legacyResponse.getId());
        Money total = new Money(legacyResponse.getTotalPrice(), "CNY");

        List<OrderItem> items = legacyResponse.getItems().stream()
            .map(item -> new OrderItem(
                new ProductId(item.getProductCode()),
                item.getProductName(),
                new Money(item.getUnitPrice(), "CNY"),
                item.getQuantity()
            ))
            .collect(Collectors.toList());

        Address address = new Address(
            legacyResponse.getProvince(),
            legacyResponse.getCity(),
            legacyResponse.getDistrict(),
            legacyResponse.getDetailAddress(),
            legacyResponse.getZipCode()
        );

        Order order = new Order(orderId, new UserId(legacyResponse.getUserId()), items, address);
        return order;
    }

    // 反向转换：当前上下文的订单状态 → 遗留系统的状态码
    public String toLegacyStatus(OrderStatus status) {
        switch (status) {
            case CREATED: return "10";
            case SUBMITTED: return "20";
            case PAID: return "30";
            case SHIPPED: return "40";
            case DELIVERED: return "50";
            case CANCELLED: return "90";
            default: throw new IllegalArgumentException("Unknown status: " + status);
        }
    }
}
```

### 2.4 共享内核（Shared Kernel）

共享内核用于在多个限界上下文之间共享一小部分通用模型，避免重复定义。

```java
// 共享内核模块（common 模块，被多个上下文依赖）
package com.example.common.domain;

// 共享的值对象
public class Money {
    private final BigDecimal amount;
    private final String currency;

    // ... 共享实现
}

// 共享的领域事件基类
public abstract class DomainEvent {
    private final String eventId = UUID.randomUUID().toString();
    private final LocalDateTime occurredOn = LocalDateTime.now();
    // ...
}
```

**使用共享内核的原则：**

1. 共享内容要**少**，仅限真正通用的概念
2. 共享内核的变更需要所有相关团队协商
3. 必须进行自动化测试来保证兼容性

***

## 三、DDD 战术设计

### 3.1 订单聚合的完整代码实现

下面是一个完整的订单聚合实现，展示了聚合根、实体、值对象的协作。

```java
package com.example.order.domain.aggregate;

import com.example.common.domain.Money;
import com.example.common.domain.AggregateRoot;
import java.time.LocalDateTime;
import java.util.*;

/**
 * 订单聚合根
 */
public class Order implements AggregateRoot<OrderId> {

    // ====== 聚合根属性 ======
    private OrderId orderId;
    private OrderNumber orderNo;
    private UserId userId;
    private OrderStatus status;
    private Money totalAmount;
    private Address shippingAddress;
    private LocalDateTime createdTime;
    private LocalDateTime paidTime;
    private LocalDateTime shippedTime;
    private LocalDateTime deliveredTime;

    // ====== 聚合内部实体 ======
    private List<OrderItem> items;

    // ====== 领域事件（待发布） ======
    private List<DomainEvent> pendingEvents = new ArrayList<>();

    // ====== 构造器（通过工厂创建，构造器包级可见） ======
    Order(OrderId orderId, OrderNumber orderNo, UserId userId,
          List<OrderItem> items, Address shippingAddress) {
        this.orderId = orderId;
        this.orderNo = orderNo;
        this.userId = userId;
        this.status = OrderStatus.CREATED;
        this.items = new ArrayList<>(items);
        this.shippingAddress = shippingAddress;
        this.totalAmount = calculateTotal();
        this.createdTime = LocalDateTime.now();
        addEvent(new OrderCreatedEvent(orderId, orderNo, userId));
    }

    // ====== 业务方法 ======

    /** 提交订单 */
    public void submit() {
        assertStatus(OrderStatus.CREATED);
        if (items.isEmpty()) {
            throw new BusinessException("Cannot submit order with no items");
        }
        this.status = OrderStatus.SUBMITTED;
        addEvent(new OrderSubmittedEvent(orderId, orderNo, userId));
    }

    /** 支付成功 */
    public void markPaid(PaymentInfo paymentInfo) {
        assertStatus(OrderStatus.SUBMITTED);
        this.status = OrderStatus.PAID;
        this.paidTime = LocalDateTime.now();
        addEvent(new OrderPaidEvent(orderId, orderNo, paymentInfo));
    }

    /** 发货 */
    public void ship(ShipmentInfo shipmentInfo) {
        assertStatus(OrderStatus.PAID);
        this.status = OrderStatus.SHIPPED;
        this.shippedTime = LocalDateTime.now();
        addEvent(new OrderShippedEvent(orderId, orderNo, shipmentInfo));
    }

    /** 确认收货 */
    public void confirmDelivery() {
        assertStatus(OrderStatus.SHIPPED);
        this.status = OrderStatus.DELIVERED;
        this.deliveredTime = LocalDateTime.now();
        addEvent(new OrderDeliveredEvent(orderId, orderNo));
    }

    /** 取消订单 */
    public void cancel(String reason) {
        if (this.status == OrderStatus.SHIPPED || this.status == OrderStatus.DELIVERED) {
            throw new BusinessException("Cannot cancel shipped/delivered order");
        }
        this.status = OrderStatus.CANCELLED;
        addEvent(new OrderCancelledEvent(orderId, orderNo, reason));
    }

    // ====== 内部帮助方法 ======

    private Money calculateTotal() {
        return items.stream()
            .map(OrderItem::getSubtotal)
            .reduce(Money.ZERO, Money::add);
    }

    private void assertStatus(OrderStatus expected) {
        if (this.status != expected) {
            throw new BusinessException(
                String.format("Order status %s does not match expected %s", this.status, expected));
        }
    }

    private void addEvent(DomainEvent event) {
        this.pendingEvents.add(event);
    }

    // ====== 事件获取方法（仓储调用） ======
    public List<DomainEvent> releaseEvents() {
        List<DomainEvent> released = new ArrayList<>(this.pendingEvents);
        this.pendingEvents.clear();
        return released;
    }

    // ====== Getters ======
    @Override
    public OrderId getId() { return orderId; }
    public OrderNumber getOrderNo() { return orderNo; }
    public UserId getUserId() { return userId; }
    public OrderStatus getStatus() { return status; }
    public Money getTotalAmount() { return totalAmount; }
    public Address getShippingAddress() { return shippingAddress; }
    public List<OrderItem> getItems() { return Collections.unmodifiableList(items); }
    public LocalDateTime getCreatedTime() { return createdTime; }
    // ... 其他 getters
}
```

### 3.2 值对象设计

```java
// 订单编号值对象
public class OrderNumber {
    private final String value;

    private OrderNumber(String value) {
        this.value = value;
    }

    // 工厂方法：生成订单号（包含日期+序列号）
    public static OrderNumber generate() {
        String datePart = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String seqPart = String.format("%06d", SequenceGenerator.next("order"));
        return new OrderNumber("ORD" + datePart + seqPart);
    }

    public static OrderNumber of(String value) {
        if (value == null || !value.matches("^ORD\\d{14}$")) {
            throw new IllegalArgumentException("Invalid order number format");
        }
        return new OrderNumber(value);
    }

    public String getValue() { return value; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        OrderNumber that = (OrderNumber) o;
        return value.equals(that.value);
    }

    @Override
    public int hashCode() { return Objects.hash(value); }
}

// 订单 ID 值对象（也是实体标识）
public class OrderId {
    private final String value;

    private OrderId(String value) {
        this.value = value;
    }

    public static OrderId generate() {
        return new OrderId(UUID.randomUUID().toString());
    }

    public static OrderId of(String value) {
        return new OrderId(value);
    }

    public String getValue() { return value; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        OrderId orderId = (OrderId) o;
        return value.equals(orderId.value);
    }

    @Override
    public int hashCode() { return Objects.hash(value); }
}
```

### 3.3 领域服务示例

```java
// 领域服务：订单取消处理（涉及多个聚合）
@Component
public class OrderCancellationService {

    private final OrderRepository orderRepository;
    private final PaymentService paymentService;
    private final InventoryService inventoryService;

    public OrderCancellationService(OrderRepository orderRepository,
                                    PaymentService paymentService,
                                    InventoryService inventoryService) {
        this.orderRepository = orderRepository;
        this.paymentService = paymentService;
        this.inventoryService = inventoryService;
    }

    @Transactional
    public void cancelOrder(OrderId orderId, String reason) {
        // 1. 获取订单聚合
        Order order = orderRepository.findById(orderId);

        // 2. 取消订单（聚合根负责维护自身一致性）
        order.cancel(reason);

        // 3. 如果已支付，发起退款
        if (order.getStatus() == OrderStatus.PAID || order.getStatus() == OrderStatus.SHIPPED) {
            boolean refundSuccess = paymentService.refund(order.getPaymentInfo());
            if (!refundSuccess) {
                throw new BusinessException("Refund failed for order: " + orderId);
            }
        }

        // 4. 恢复库存
        for (OrderItem item : order.getItems()) {
            inventoryService.restoreStock(item.getProductId(), item.getQuantity());
        }

        // 5. 保存聚合
        orderRepository.save(order);
    }
}
```

***

## 四、DDD 分层架构

### 4.1 DDD 经典四层架构

```
┌──────────────────────────────────────────────────────────┐
│              用户接口层（User Interface）                   │
│  Controller、DTO 转换器、WebSocket 监听器                  │
│  职责：接收请求、响应数据、DTO ↔ 命令/查询转换              │
├──────────────────────────────────────────────────────────┤
│              应用层（Application）                         │
│  ApplicationService、DTO、EventPublisher                  │
│  职责：事务协调、权限校验、事件发布、调用领域层               │
│  不包含业务逻辑！                                         │
├──────────────────────────────────────────────────────────┤
│              领域层（Domain）                              │
│  Entity、ValueObject、AggregateRoot、DomainService        │
│  Repository 接口、DomainEvent                             │
│  职责：核心业务逻辑、业务规则、业务状态管理                  │
│  不依赖任何外部层！                                        │
├──────────────────────────────────────────────────────────┤
│              基础设施层（Infrastructure）                   │
│  Repository 实现、消息队列、缓存、ORM 映射、外部 API 调用   │
│  职责：技术实现，供上层调用                                 │
└──────────────────────────────────────────────────────────┘
```

**依赖原则：上层依赖下层，下层不依赖上层。领域层是核心，不依赖任何外部框架。**

### 4.2 与传统三层架构对比

| 维度 | 传统三层架构 | DDD 四层架构 |
|------|-------------|-------------|
| 层次 | Controller → Service → DAO | UI → Application → Domain → Infrastructure |
| 业务逻辑位置 | Service 层（往往变成贫血的 Transaction Script） | Domain 层（实体、值对象、领域服务） |
| 数据库依赖 | Service 层通常依赖 ORM | 通过 Repository 接口隔离，领域层不感知数据库 |
| 模型复杂度 | 数据模型 = 数据库表映射，常为贫血模型 | 领域模型 = 业务概念映射，富领域模型 |
| 变更影响 | 数据库变更 → 所有层都需要修改 | 业务变更只影响领域层，技术变更只影响基础设施层 |
| 测试难度 | 需要模拟数据库，单元测试困难 | 领域层可独立测试，无需基础设施 |

### 4.3 代码组织结构（包结构示例）

```
com.example.order/
│
├── interfaces/                      # 用户接口层
│   ├── controller/
│   │   └── OrderController.java
│   ├── dto/
│   │   ├── CreateOrderRequest.java
│   │   └── OrderResponse.java
│   └── assembler/
│       └── OrderAssembler.java      # DTO ↔ Command 转换
│
├── application/                      # 应用层
│   ├── service/
│   │   ├── OrderApplicationService.java
│   │   └── OrderQueryService.java
│   ├── command/
│   │   ├── CreateOrderCommand.java
│   │   └── CancelOrderCommand.java
│   └── event/
│       └── OrderEventListener.java
│
├── domain/                           # 领域层 (核心)
│   ├── aggregate/
│   │   └── Order.java                # 聚合根
│   ├── entity/
│   │   └── OrderItem.java
│   ├── vo/                           # 值对象
│   │   ├── OrderId.java
│   │   ├── OrderNumber.java
│   │   ├── Money.java
│   │   ├── Address.java
│   │   └── PaymentInfo.java
│   ├── service/
│   │   └── OrderPricingService.java  # 领域服务
│   ├── repository/
│   │   └── OrderRepository.java      # 仓储接口
│   ├── event/
│   │   ├── DomainEvent.java
│   │   ├── OrderCreatedEvent.java
│   │   └── OrderPaidEvent.java
│   └── enums/
│       └── OrderStatus.java
│
└── infrastructure/                   # 基础设施层
    ├── persistence/
    │   ├── OrderRepositoryImpl.java
    │   ├── jpa/
    │   │   ├── OrderJpaRepository.java
    │   │   └── OrderPO.java
    │   └── mapper/
    │       └── OrderMapper.java
    ├── message/
    │   └── OrderEventPublisher.java
    └── client/
        └── PaymentClient.java
```

***

## 五、CQRS（命令查询职责分离）

### 5.1 概念

CQRS 的全称是 Command Query Responsibility Segregation，即**命令查询职责分离**。

核心思想：将系统的读写操作分离为不同的模型。

| 模型 | 用途 | 修改数据 | 返回值 |
|------|------|---------|--------|
| Command（命令） | 写操作 | 是 | 无（void） |
| Query（查询） | 读操作 | 否 | 有数据 |

### 5.2 Command 与 Query 分离

```java
// ====== 命令模型（写） ======

// 命令对象
public class CreateOrderCommand {
    private final Long userId;
    private final List<OrderItemCommand> items;
    private final AddressCommand address;

    // 构造器、getters...
}

// 命令处理器
@Component
public class CreateOrderCommandHandler implements CommandHandler<CreateOrderCommand, Void> {

    private final OrderFactory orderFactory;
    private final OrderRepository orderRepository;

    @Override
    @Transactional
    public Void handle(CreateOrderCommand command) {
        // 1. 创建订单聚合
        Order order = orderFactory.createOrder(command);
        // 2. 提交订单
        order.submit();
        // 3. 保存
        orderRepository.save(order);
        return null;
    }
}

// ====== 查询模型（读） ======

// 查询对象
public class OrderQuery {
    private final Long userId;
    private final int page;
    private final int size;
    // ...
}

// 查询服务（直接读数据库，不走领域模型）
@Service
public class OrderQueryService {

    // 独立的查询数据源（可能是读副本、缓存、或者单独的表结构）
    private final OrderReadRepository readRepository;

    public OrderListDTO queryOrders(OrderQuery query) {
        // 直接返回 DTO，不需要组装领域对象
        return readRepository.findOrders(query);
    }

    // 查询不需要经过聚合根、不需要加载整个聚合
    public OrderSummaryDTO getOrderSummary(Long orderId) {
        return readRepository.findSummary(orderId);
    }
}
```

### 5.3 Event Sourcing 事件溯源

事件溯源（Event Sourcing）是 CQRS 的常见搭配。它**不存储当前状态，而是存储所有状态变更事件**，当前状态由事件重放得到。

```java
// 事件溯源的聚合根
public class EventSourcedOrder {

    private OrderId orderId;
    private OrderStatus status;
    private Money balance;

    // 未提交的事件列表
    private final List<DomainEvent> changes = new ArrayList<>();

    // 构造：从历史事件重建聚合
    private EventSourcedOrder(List<DomainEvent> history) {
        for (DomainEvent event : history) {
            apply(event);
        }
    }

    // 从历史事件重建
    public static EventSourcedOrder recreateFrom(List<DomainEvent> history) {
        return new EventSourcedOrder(history);
    }

    // 创建新订单
    public static EventSourcedOrder create(CreateOrderCommand command) {
        EventSourcedOrder order = new EventSourcedOrder();
        order.applyChange(new OrderCreatedEvent(
            OrderId.generate(), OrderNumber.generate(), UserId.of(command.getUserId())
        ));
        return order;
    }

    // 提交订单
    public void submit() {
        applyChange(new OrderSubmittedEvent(orderId, null, null));
    }

    // 应用事件到当前状态
    private void apply(DomainEvent event) {
        if (event instanceof OrderCreatedEvent) {
            OrderCreatedEvent e = (OrderCreatedEvent) event;
            this.orderId = e.getOrderId();
            this.status = OrderStatus.CREATED;
        } else if (event instanceof OrderSubmittedEvent) {
            this.status = OrderStatus.SUBMITTED;
        } else if (event instanceof OrderPaidEvent) {
            this.status = OrderStatus.PAID;
        }
    }

    // 记录变更
    private void applyChange(DomainEvent event) {
        apply(event);
        changes.add(event);
    }

    // 获取未提交的变更事件
    public List<DomainEvent> getChanges() {
        return Collections.unmodifiableList(changes);
    }

    // 标记事件已提交
    public void markChangesAsCommitted() {
        changes.clear();
    }

    public OrderId getOrderId() { return orderId; }
    public OrderStatus getStatus() { return status; }
}

// 事件存储接口
public interface EventStore {
    void saveEvents(String aggregateId, List<DomainEvent> events, int expectedVersion);
    List<DomainEvent> getEvents(String aggregateId);
}

// 事件溯源的仓储实现
public class EventSourcedOrderRepository implements OrderRepository {

    private final EventStore eventStore;

    @Override
    public Order findById(OrderId orderId) {
        List<DomainEvent> events = eventStore.getEvents(orderId.getValue());
        if (events.isEmpty()) {
            throw new OrderNotFoundException(orderId);
        }
        // 从事件流重建聚合
        return EventSourcedOrder.recreateFrom(events);
    }

    @Override
    public void save(Order order) {
        EventSourcedOrder eventSourcedOrder = (EventSourcedOrder) order;
        List<DomainEvent> changes = eventSourcedOrder.getChanges();
        if (!changes.isEmpty()) {
            eventStore.saveEvents(
                order.getId().getValue(),
                changes,
                getNextVersion(order.getId())
            );
            eventSourcedOrder.markChangesAsCommitted();
        }
        // 发布事件
        changes.forEach(DomainEventPublisher::publish);
    }
}
```

**事件溯源的优势：**

* 完整的审计追踪：可以回溯任何历史状态
* 时间旅行：可以恢复到任意历史时间点
* 事件驱动：天然支持 CQRS 和微服务架构
* 写优化：追加写，无更新操作

**事件溯源的劣势：**

* 学习曲线陡峭
* 查询复杂（需事件重放或维护读模型快照）
* 事件模式难以变更（schema evolution）
* 存储量通常大于传统方案

***

## 六、电商 DDD 实战

### 6.1 订单子域建模

```java
// ====== 订单聚合 ======
// Order（聚合根）— 已在第三章详细实现

// ====== 值对象 ======
public class ShippingAddress {
    private final String fullName;
    private final String phone;
    private final String province;
    private final String city;
    private final String district;
    private final String detail;
    private final String zipCode;

    public ShippingAddress(String fullName, String phone, String province,
                           String city, String district, String detail, String zipCode) {
        this.fullName = fullName;
        this.phone = phone;
        this.province = province;
        this.city = city;
        this.district = district;
        this.detail = detail;
        this.zipCode = zipCode;
    }
    // equals & hashCode...
}

// ====== 领域服务 ======
// 检查订单是否可以取消
public class OrderValidationService {

    public boolean canCancel(Order order) {
        if (order.getStatus() == OrderStatus.SHIPPED || order.getStatus() == OrderStatus.DELIVERED) {
            return false;
        }
        // 已发货超过 7 天不能取消
        if (order.getStatus() == OrderStatus.PAID) {
            return Duration.between(order.getPaidTime(), LocalDateTime.now()).toDays() < 7;
        }
        return true;
    }
}

// ====== 领域事件 ======
public class OrderCreatedEvent {
    // 用于通知库存子域扣减库存
    // 用于通知营销子域更新用户购买记录
}
```

### 6.2 商品子域建模

```java
// ====== 商品聚合根 ======
public class Product implements AggregateRoot<ProductId> {

    private ProductId productId;
    private String name;
    private String description;
    private Money price;
    private CategoryId categoryId;
    private List<ProductSpec> specs;       // 商品规格（颜色、尺寸等）
    private ProductStatus status;          // UP / DOWN
    private LocalDateTime createdTime;
    private LocalDateTime updatedTime;

    public Product(ProductId productId, String name, Money price, CategoryId categoryId) {
        this.productId = productId;
        this.name = name;
        this.price = price;
        this.categoryId = categoryId;
        this.status = ProductStatus.UP;
        this.specs = new ArrayList<>();
        this.createdTime = LocalDateTime.now();
    }

    // 上架
    public void putOnSale() {
        if (this.status == ProductStatus.UP) return;
        this.status = ProductStatus.UP;
    }

    // 下架
    public void takeOffSale() {
        this.status = ProductStatus.DOWN;
    }

    // 修改价格
    public void changePrice(Money newPrice) {
        if (newPrice.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("Price must be positive");
        }
        this.price = newPrice;
        this.updatedTime = LocalDateTime.now();
    }

    // 添加规格
    public void addSpec(String specName, String specValue, BigDecimal extraPrice) {
        this.specs.add(new ProductSpec(specName, specValue, extraPrice));
    }

    // Getters...
}

// ====== 商品分类聚合根 ======
public class Category implements AggregateRoot<CategoryId> {

    private CategoryId categoryId;
    private String name;
    private CategoryId parentId;           // 父分类 ID
    private int level;                     // 层级：1级、2级、3级
    private int sortOrder;                 // 排序

    // 子分类（同一聚合内）
    private List<Category> children;

    // 添加子分类
    public Category addChild(String name, int sortOrder) {
        Category child = new Category(
            CategoryId.generate(), name, this.categoryId, this.level + 1, sortOrder
        );
        this.children.add(child);
        return child;
    }
}
```

### 6.3 库存子域建模

```java
// ====== 库存聚合根 ======
public class Inventory implements AggregateRoot<InventoryId> {

    private InventoryId inventoryId;
    private ProductId productId;
    private WarehouseId warehouseId;
    private int totalQuantity;             // 总库存
    private int reservedQuantity;          // 已锁定（已下单但未支付）
    private int availableQuantity;         // 可用库存 = total - reserved
    private int version;                   // 乐观锁版本号

    public Inventory(InventoryId inventoryId, ProductId productId,
                     WarehouseId warehouseId, int totalQuantity) {
        this.inventoryId = inventoryId;
        this.productId = productId;
        this.warehouseId = warehouseId;
        this.totalQuantity = totalQuantity;
        this.reservedQuantity = 0;
        this.availableQuantity = totalQuantity;
        this.version = 0;
    }

    // 预留库存（下单时调用）
    public void reserve(int quantity) {
        if (quantity <= 0) {
            throw new BusinessException("Reserve quantity must be positive");
        }
        if (this.availableQuantity < quantity) {
            throw new InsufficientInventoryException(productId, this.availableQuantity, quantity);
        }
        this.reservedQuantity += quantity;
        this.availableQuantity = this.totalQuantity - this.reservedQuantity;
    }

    // 扣减库存（支付时调用）
    public void deduct(int quantity) {
        if (quantity <= 0) {
            throw new BusinessException("Deduct quantity must be positive");
        }
        if (this.reservedQuantity < quantity) {
            throw new BusinessException("Reserved quantity is less than deduct quantity");
        }
        this.totalQuantity -= quantity;
        this.reservedQuantity -= quantity;
        // availableQuantity 不变（total 和 reserved 同时减少）
    }

    // 释放预留（取消订单时调用）
    public void releaseReserved(int quantity) {
        if (quantity <= 0) return;
        this.reservedQuantity = Math.max(0, this.reservedQuantity - quantity);
        this.availableQuantity = this.totalQuantity - this.reservedQuantity;
    }

    // 补充库存
    public void restock(int quantity) {
        if (quantity <= 0) {
            throw new BusinessException("Restock quantity must be positive");
        }
        this.totalQuantity += quantity;
        this.availableQuantity = this.totalQuantity - this.reservedQuantity;
    }

    public int getVersion() { return version; }
}

// ====== 库存领域服务 ======
@Service
public class InventoryManagementService {

    private final InventoryRepository inventoryRepository;
    private final WarehouseRepository warehouseRepository;

    @Transactional
    public boolean tryReserve(ProductId productId, int quantity) {
        // 可能涉及多个仓库
        List<Inventory> inventories = inventoryRepository.findByProductIdOrderByWarehouse(productId);

        int remaining = quantity;
        for (Inventory inv : inventories) {
            int canReserve = Math.min(inv.getAvailableQuantity(), remaining);
            if (canReserve > 0) {
                inv.reserve(canReserve);
                inventoryRepository.save(inv);
                remaining -= canReserve;
            }
            if (remaining == 0) break;
        }
        return remaining == 0;  // true=全部库存够，false=库存不足
    }
}
```

### 6.4 跨子域协作（事件驱动）

订单、商品、库存三个子域通过领域事件实现最终一致性：

```java
// 订单创建事件 — 订单上下文发布
public class OrderCreatedEvent extends DomainEvent {
    private OrderId orderId;
    private List<OrderItemInfo> items;  // 包含商品 ID 和数量
    // ...
}

// 库存上下文监听
@Component
public class InventoryEventListener {

    @Autowired
    private InventoryManagementService inventoryService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onOrderCreated(OrderCreatedEvent event) {
        // 异步扣减库存（最终一致性）
        for (OrderItemInfo item : event.getItems()) {
            boolean success = inventoryService.tryReserve(item.getProductId(), item.getQuantity());
            if (!success) {
                // 库存不足，触发订单取消流程
                DomainEventPublisher.publish(new InventoryShortageEvent(
                    event.getOrderId(), item.getProductId(), item.getQuantity()));
            }
        }
    }
}

// 订单上下文监听库存不足事件
@Component
public class OrderInventoryListener {

    @Autowired
    private OrderCancellationService cancellationService;

    @EventListener
    public void onInventoryShortage(InventoryShortageEvent event) {
        // 取消订单
        cancellationService.cancelOrder(event.getOrderId(), "库存不足");
    }
}
```

***

## 七、DDD 实施总结

### 7.1 什么时候用 DDD

| 适合 DDD | 不适合 DDD |
|---------|-----------|
| 业务逻辑复杂（如金融、电商、物流） | 简单的 CRUD 应用 |
| 需要与业务专家紧密协作 | 纯数据展示类应用 |
| 系统需要长期演进 | 一次性原型或简单工具 |
| 多个团队协作开发 | 单人小项目 |
| 微服务架构 | 单体简单应用 |

### 7.2 DDD 实施要点

1. **从战略设计开始**：先划分限界上下文（Bounded Context），再设计战术（Entity、VO、Aggregate）
2. **通用语言不可妥协**：代码中的命名必须与业务专家沟通中使用的术语一致
3. **聚合设计要小**：每个聚合尽量小，只包含必须保持一致的实体，一个大聚合往往意味着设计不合理
4. **仓储只负责聚合**：每个仓储对应一个聚合根，不暴露数据库细节
5. **领域事件实现最终一致性**：跨聚合的操作通过事件驱动，一个事务只修改一个聚合
6. **防腐层保护模型纯洁**：与外部系统交互时使用 ACL 转换，不要让外部模型进入领域层
7. **分层依赖原则**：领域层不依赖任何框架和基础设施，这是 DDD 的基本原则

### 7.3 DDD 与微服务

```
DDD 概念             微服务映射
─────────────────────────────────────
限界上下文       →    微服务边界
聚合根           →    微服务的操作入口
领域事件         →    服务间异步通信
仓储             →    数据持久化服务
防腐层           →    服务间适配器
共享内核         →    公共库/API 契约
```

**核心原则：一个限界上下文通常对应一个微服务，微服务之间的通信通过领域事件实现。**

***

> **总结：** DDD 不是银弹，但它为复杂业务系统的建模提供了系统化的方法论。核心价值在于：1）通过限界上下文划分合理的系统边界；2）通过聚合保证数据一致性边界；3）通过领域事件实现最终一致性的服务间通信。在实施 DDD 时，从战略设计入手，分清核心域和支撑域，逐步推进战术设计，才是成功的关键。
