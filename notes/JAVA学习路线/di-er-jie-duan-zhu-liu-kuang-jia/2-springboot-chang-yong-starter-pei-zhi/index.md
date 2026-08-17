---
url: >-
  /my_notes/notes/JAVA学习路线/di-er-jie-duan-zhu-liu-kuang-jia/2-springboot-chang-yong-starter-pei-zhi/index.md
---
# Spring Boot 常用 Starter 配置指南

> 在 [2.1-Spring全家桶](./2.1-Spring全家桶.md) 中只列出了各 Starter 的 Maven 坐标，本文补齐它们**开箱即用所需的主流 `application.yml` 配置**，并逐项解释每个配置项的作用，让你拿到依赖就能跑起来。
>
> 本文默认 **Spring Boot 3.x**（依赖引入者自动获得括号内的默认值；配置前缀遵循 Boot 3 规范）。涉及的关键 2.x/3.x 前缀差异，在文末做了速查表。

***

## 一、Web 开发：spring-boot-starter-web

**作用**：内置嵌入式 Tomcat，提供 Spring MVC（REST API + 静态资源 + 异常处理）。

```yaml
# application.yml
server:
  port: 8080                     # 服务端口（默认 8080）
  address: 0.0.0.0               # 绑定网卡地址，0.0.0.0 允许所有网卡访问
  servlet:
    context-path: /api           # 统一访问前缀，如 localhost:8080/api/users
    encoding:
      charset: UTF-8             # 请求/响应字符编码
      force: true                # 强制使用 UTF-8，忽略客户端声明的编码
  tomcat:
    max-threads: 200             # 最大工作线程数（默认 200）
    min-spare-threads: 10        # 最小空闲线程数
    max-connections: 10000       # 最大连接数
    connection-timeout: 20000    # 连接超时（毫秒）

spring:
  mvc:
    static-path-pattern: /**     # 静态资源映射路径
  jackson:
    date-format: yyyy-MM-dd HH:mm:ss   # JSON 日期序列化格式
    time-zone: GMT+8             # 时区，避免 Date 差 8 小时
    default-property-inclusion: non_null  # 为 null 的字段不序列化输出
    serialization:
      write-dates-as-timestamps: false   # 日期不输出为时间戳
```

**各项作用解释**

| 配置项 | 作用 |
|--------|------|
| `server.port` | 嵌入式 Tomcat 监听端口。同机多应用部署须各自改端口 |
| `server.servlet.context-path` | 给所有接口加统一前缀，便于网关/反向代理区分应用，如网关转发 `lb://user-service/api/**` |
| `server.servlet.encoding` | 解决中文乱码；`force: true` 使响应头强制声明 `UTF-8` |
| `server.tomcat.max-threads` | Tomcat 处理请求的线程池上限，吞吐量瓶颈之一，配合连接数一起调 |
| `spring.jackson.*` | 控制 `@ResponseBody` 的 JSON 序列化行为。`time-zone: GMT+8` 是新手最常见的"时间差 8 小时"坑的解法 |

**✅ 提示**

1. `spring-jackson` 与 `spring.mvc` 前缀下有大量可选项，够用即可，不必全部配置。
2. 内嵌容器可切换：默认 Tomcat，把 `spring-boot-starter-web` 的 Tomcat 依赖 exclusions 掉，换上 `spring-boot-starter-jetty` 或 `spring-boot-starter-undertow` 依赖即可，配置项从 `server.tomcat.*` 换成 `server.jetty.*` / `server.undertow.*`。

***

## 二、数据访问：spring-boot-starter-jdbc

**作用**：引入 JDBC + Spring 事务 + **HikariCP** 连接池（Boot 默认连接池）。只做 JDBC 不需要 ORM 时用这个。

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/mydb?useSSL=false&serverTimezone=Asia/Shanghai
    username: root
    password: root123
    driver-class-name: com.mysql.cj.jdbc.Driver   # MySQL 8 以上必须用 cj 驱动
    hikari:
      pool-name: MyHikariPool     # 连接池名称（便于日志区分）
      maximum-pool-size: 20       # 最大连接数（默认 10）
      minimum-idle: 5             # 最小空闲连接数
      idle-timeout: 300000        # 空闲超时回收（毫秒，默认 10 分钟）
      connection-timeout: 30000   # 获取连接超时（毫秒，默认 30s）
      max-lifetime: 1800000       # 连接最大存活时间（毫秒，默认 30 分钟）
      connection-test-query: SELECT 1  # 保活校验 SQL
```

**各项作用解释**

| 配置项 | 作用 |
|--------|------|
| `spring.datasource.url` | 连接串，`useSSL=false` 关闭 SSL 校验（本地）；`serverTimezone` 解决驱动 8 小时时区偏差 |
| `driver-class-name` | MySQL 8+ 驱动类名为 `com.mysql.cj.jdbc.Driver`（旧版为 `com.mysql.jdbc.Driver`） |
| `hikari.maximum-pool-size` | 连接池上限。**不是越大越好**：与 CPU/IO 相关，常规 Web 应用 10~20 即可，过大反而拖垮数据库 |
| `hikari.idle-timeout` / `max-lifetime` | 前者回收空闲连接，后者兜底替换老化连接，防止数据库侧主动断开后客户端拿到半死连接 |
| `connection-test-query` | 默认由 HikariCP 依据驱动自动判断，一般无需手写，MySQL 惯例配置 `SELECT 1` |

**✅ 提示**

* HikariCP 的池参数调优细节见 `第一阶段-核心基础/1.2-数据库基础.md` §3.1 §3.2。
* 依赖还需引入对应数据库驱动（如 `mysql-connector-j`），starter-jdbc 只含池与抽象，不含驱动。

***

## 三、ORM 框架：spring-boot-starter-data-jpa

**作用**：JPA 规范 + Hibernate 实现，实体/Repository 一键 CRUD（用法见 2.1 §四）。

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/mydb?useSSL=false&serverTimezone=Asia/Shanghai
    username: root
    password: root123
    driver-class-name: com.mysql.cj.jdbc.Driver
  jpa:
    hibernate:
      ddl-auto: update            # 建表策略：none/validate/update/create
    show-sql: true                # 控制台打印 SQL（调试用，生产关闭）
    open-in-view: false           # 关闭 OSIV，避免长连接占会话（生产推荐 false）
    properties:
      hibernate:
        dialect: org.hibernate.dialect.MySQLDialect   # 方言（Boot 自动推断，一般不用写）
        format_sql: true          # 格式化打印的 SQL
    database-platform: org.hibernate.dialect.MySQLDialect
```

**各项作用解释**

| 配置项 | 作用 |
|--------|------|
| `spring.jpa.hibernate.ddl-auto` | 建表策略：`create`（每次启动删表重建，仅开发）、`update`（增量更新结构，开发常用）、`validate`（只校验实体与表一致，不合则启动报错，生产推荐）、`none`（完全交 DBA 手动管理） |
| `spring.jpa.show-sql` | 输出 Hibernate 生成的 SQL，调试 N+1 等问题的必备手段 |
| `spring.jpa.open-in-view` | 默认 `true` 会让每个请求占用一个数据库连接直到响应结束，高并发下容易打满连接池；生产改为 `false` 并用事务管理器显式管理 |
| `dialect` / `database-platform` | 指定数据库方言；Boot 依据 `spring.datasource.url` 自动推断，通常**无需手写** |

**✅ 提示**

* 生产环境强烈建议 `ddl-auto: validate`（或 `none`）+ 上线走 Flyway/Liquibase 迁移脚本，避免 Hibernate 自行改表导致数据丢失。
* 反向生成 `spring.jpa.properties.hibernate.naming.physical-strategy` 可控制下划线命名转驼峰的映射策略。

***

## 四、ORM 框架：mybatis-spring-boot-starter

**作用**：官方 MyBatis 集成 starter（数据库配置与 JPA 共用 `spring.datasource.*`）。在 2.1 §四.2 详述了 Mapper 写法，这里补上让 Mapper 生效的配套配置。

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/mydb?useSSL=false&serverTimezone=Asia/Shanghai
    username: root
    password: root123
    driver-class-name: com.mysql.cj.jdbc.Driver

mybatis:
  mapper-locations: classpath*:mapper/**/*.xml      # XML Mapper 扫描路径
  type-aliases-package: com.example.entity          # 实体类别名包（XML 里可省写全限定名）
  configuration:
    map-underscore-to-camel-case: true   # 下划线列名自动映射为驼峰属性
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl  # 控制台打印 SQL（调试）

# Mapper 接口上需加 @Mapper 注解，或在启动类上加 @MapperScan("com.example.mapper")
```

**各项作用解释**

| 配置项 | 作用 |
|--------|------|
| `mybatis.mapper-locations` | 指定 `*.xml` 的位置。`classpath*` 允许跨多个 jar/模块找到 mapper，微服务多模块项目必须用它 |
| `mybatis.type-aliases-package` | 批量注册实体类别名，XML 里写 `resultType="User"` 而非全限定名 |
| `mybatis.configuration.map-underscore-to-camel-case` | 自动把数据库 `create_time` 映射为实体 `createTime`，**不配置会让字段对应不上返回 null，最常见坑之一** |
| `log-impl` | 打印 SQL 用于调试，生产可改为 slf4j 或移除 |

**✅ 提示**

* 与 JPA 二选一：**JPA 适合表结构规整、CRUD 为主**；**MyBatis 适合复杂 SQL、报表、遗留库**（2.1 §4.3 有完整对比）。
* Mapper 必须在启动类 `@MapperScan` 或接口 `@Mapper` 二选一注册，否则启动即报"找不到 Bean"。

***

## 五、安全：spring-boot-starter-security

**作用**：引入 Spring Security + 默认登录页与默认账号；一旦引入，所有请求默认被认证拦截。

```yaml
spring:
  security:
    user:
      name: admin                # 默认登录账号（仅用默认认证时有效）
      password: admin123         # 默认登录密码
```

**各项作用解释**

| 配置项 | 作用 |
|--------|------|
| `spring.security.user.name/password` | 引入 starter 后无需任何代码即可用此账密登录（默认名 `user`、随机密码打印在启动日志）。**仅用于快速验证，正式系统必须自定义 `SecurityFilterChain`** |

**SecurityFilterChain 配置骨架（Spring Boot 3 / Spring Security 6）**

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())                        // 前后端分离关 CSRF
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS)) // 无状态（JWT）
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**", "/actuator/health").permitAll()  // 白名单
                .requestMatchers("/api/admin/**").hasRole("ADMIN")                // 角色控制
                .anyRequest().authenticated())                                     // 其余需登录
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class); // 自定义 JWT 过滤器
        return http.build();
    }
}
```

**✅ 提示**

* `SecurityFilterChain` 是 Spring Security 6 的推荐写法（旧版 `WebSecurityConfigurerAdapter` 已废弃）。
* 认证/授权/JWT/OAuth2 的完整讲解见 `第三阶段-进阶能力/3.3-安全.md`。

***

## 六、缓存：spring-boot-starter-cache

**作用**：提供 Spring Cache 抽象（`@Cacheable` / `@CacheEvict` 等注解），配合缓存实现自动读写缓存。

```yaml
spring:
  cache:
    type: simple                 # 缓存实现：simple/caffeine/redis
    cache-names: user, order     # 预声明缓存名（simple 类型必须声明才有容量）
    redis:
      time-to-live: 10m          # Redis 缓存过期时间（simple 类型不生效）
      cache-null-values: false   # 是否缓存 null（默认 false 可防缓存穿透，但注意击穿）

# Java 侧启用缓存：
# @EnableCaching              —— 启动类上开启缓存注解
# @Cacheable("user")          —— 方法结果进缓存，下次同 key 直接命中
```

**各项作用解释**

| 配置项 | 作用 |
|--------|------|
| `spring.cache.type` | 缓存存储后端。`simple`（进程内 ConcurrentHashMap，零依赖）、`caffeine`（本地高性能内存缓存，需另引依赖）、`redis`（分布式缓存，需配好 redis，见下节） |
| `spring.cache.redis.time-to-live` | 缓存过期时间。**不设置时 Redis 缓存的 key 默认永不过期**，是"缓存越积越多"的常见来源 |
| `spring.cache.cache-names` | 在启动时预创建缓存；`simple` 类型不预声明的话 key 数无容量限制会 OOM，务必配合 `specs` 限容量 |

**✅ 提示**

* 缓存穿透/击穿/雪崩与 `@Cacheable` 结合的最佳实践见 `第三阶段-进阶能力/3.1-缓存.md`。
* 多实例部署时，`simple`/`caffeine` 是本地缓存，各实例数据不一致；要全局一致必须用 `redis`。

***

## 七、Redis：spring-boot-starter-data-redis

**作用**：引入 Spring Data Redis（默认 Lettuce 客户端），提供 `RedisTemplate` / `StringRedisTemplate` 操作 Redis。

```yaml
spring:
  data:
    redis:
      host: localhost            # Redis 服务地址
      port: 6379                 # Redis 端口
      password: redispwd         # 无密码可省略
      database: 0                # 库下标（默认 0，多业务隔离常用 0/1/2）
      timeout: 5s                # 连接/读写超时
      lettuce:
        pool:
          max-active: 16         # 连接池最大活跃连接
          max-idle: 8            # 连接池最大空闲连接
          min-idle: 2            # 连接池最小空闲连接
```

**各项作用解释**

| 配置项 | 作用 |
|--------|------|
| `spring.data.redis.host/port` | **注意：Spring Boot 3 用 `spring.data.redis.*`；Spring Boot 2 用 `spring.redis.*`**，写错前缀会静默走默认值（localhost）连不上 |
| `spring.data.redis.database` | Redis 默认 16 个库，用不同下标做业务隔离；生产更建议 key 前缀区分 |
| `spring.data.redis.lettuce.pool.*` | Lettuce 默认**不使用池**（每次新建连接）只有配置了 `pool` 才启用；高并发下务必开池并合理调大 |
| `timeout` | 连接建立与读写超时，防止网络抖动时线程长时间挂起 |

**RedisTemplate 序列化配置（必配，否则 key 会出现 `\xac\xed\x00...` 乱码）**

```java
@Configuration
public class RedisConfig {

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);
        // key 用 String 序列化，避免默认 JDK 序列化产生乱码
        StringRedisSerializer keySerializer = new StringRedisSerializer();
        template.setKeySerializer(keySerializer);
        template.setHashKeySerializer(keySerializer);
        // value 用 JSON 序列化，便于读取与跨语言消费
        GenericJackson2JsonRedisSerializer valueSerializer = new GenericJackson2JsonRedisSerializer();
        template.setValueSerializer(valueSerializer);
        template.setHashValueSerializer(valueSerializer);
        template.afterPropertiesSet();
        return template;
    }
}
```

**✅ 提示**

* **"key 乱码"和"对象反序列化失败"是 Spring Data Redis 两大经典坑**，根源都是默认 JDK 序列化，统一换 String + Jackson 即可。
* Redis 数据结构与分布式锁详解见 `第三阶段-进阶能力/3.1-缓存.md`。

***

## 八、消息队列 - RabbitMQ：spring-boot-starter-amqp

**作用**：引入 Spring AMQP，提供 `RabbitTemplate`（发送）与 `@RabbitListener`（消费）。

```yaml
spring:
  amqp:                          # 可省略，Boot 自动推断地址
  rabbitmq:
    host: localhost
    port: 5672                   # AMQP 端口（管理台 15672 是另一个端口）
    username: guest              # 默认账号：guest/guest（仅本机可用）
    password: guest
    virtual-host: /              # 虚拟主机，多环境隔离常用
    publisher-confirm-type: correlated   # 消息发送方确认（可靠性投递）
    publisher-returns: true      # 不可路由的消息回退给生产者
    listener:
      simple:
        acknowledge-mode: manual # 消费确认模式：manual/auto/none
        prefetch: 10             # 单消费者预取数量（限流）
        default-requeue-rejected: false   # 处理失败是否重回队列
```

**各项作用解释**

| 配置项 | 作用 |
|--------|------|
| `spring.rabbitmq.host/port` | 连接地址。`port 5672` 是消息端口，浏览器控制台用的 `15672` 是 Web 管理端口，不要混淆 |
| `virtual-host` | 逻辑隔离，同一 RabbitMQ 实例按环境/业务拆 vhost |
| `publisher-confirm-type: correlated` | 开启发送方确认，`RabbitTemplate` 可回调拿到消息是否被 Broker 接收，解决"发出去丢没丢" |
| `listener.simple.acknowledge-mode` | `manual` 手动 ACK（代码里 `basicAck`）、`auto` 自动确认、`none` 不确认。可靠性要求高用 `manual` 配合死信处理 |
| `prefetch` | 消费者一次预取的未确认消息数，设置「小」可实现消费限流，防止堆积时把消费者打垮 |

**✅ 提示**

* Exchange 类型、消息可靠性（Confirm/ACK/DLQ 死信）、消费者组完整讲解见 `第三阶段-进阶能力/3.2-消息队列.md` §二。

***

## 九、消息队列 - Kafka：spring-kafka

**作用**：引入 Spring 对 Kafka 的集成，提供 `KafkaTemplate`（生产）与 `@KafkaListener`（消费）。

```yaml
spring:
  kafka:
    bootstrap-servers: localhost:9092    # Broker 地址（集群用逗号分隔多个）
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.apache.kafka.common.serialization.StringSerializer
      acks: all                  # 可靠性：all = 所有副本确认（强一致）
      retries: 3                 # 发送失败重试次数
      compression-type: snappy   # 压缩，降低网络与磁盘占用
    consumer:
      group-id: order-group      # 消费组（必配，决定消费水平扩展）
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      auto-offset-reset: earliest   # 无 offset 时从头消费（latest 则只消费新消息）
      enable-auto-commit: false  # 关闭自动提交，配合手动提交保证至少一次
```

**各项作用解释**

| 配置项 | 作用 |
|--------|------|
| `spring.kafka.bootstrap-servers` | Kafka Broker 地址列表，多个逗号分隔 |
| `producer.acks` | 写入确认级别：`0`（不等确认，最快但会丢）、`1`（leader 确认）、`all`（全部 ISR 副本确认，最可靠，默认就是这个） |
| `consumer.group-id` | 消费组 ID，**必配**。同组内消息分摊消费、实现水平扩展；不同组各自消费全量 |
| `auto-offset-reset` | 首次消费（无已提交 offset）时的策略：`earliest` 从最早开始、`latest` 只消费之后的新消息 |
| `enable-auto-commit: false` | 默认 true 自动提交可能"丢了消息"（poll 后崩溃），关掉改代码里手动 `acknowledgment.acknowledge()` 实现至少一次语义 |

**✅ 提示**

* Kafka 分区/副本/消费者组/顺序性完整讲解见 `第三阶段-进阶能力/3.2-消息队列.md` §三。

***

## 十、参数校验：spring-boot-starter-validation

**作用**：引入 Jakarta Validation（Hibernate Validator 实现），与 `@Valid` / `@Validated` 配合做请求参数声明式校验。

```yaml
# 无需强制配置；如需自定义错误提示语言，可声明：
spring.messages.basename: i18n/messages   # 校验消息 i18n 资源路径
```

**用法示例**

```java
public class UserCreateRequest {
    @NotBlank(message = "用户名不能为空")        // 非空
    private String name;

    @Email(message = "邮箱格式不正确")           // 邮箱格式
    private String email;

    @Size(min = 6, max = 20, message = "密码长度 6~20 位")
    private String password;

    @Min(1) @Max(120)                           // 数值范围
    private Integer age;
}

@RestController
@RequestMapping("/api/users")
public class UserController {
    @PostMapping
    public Result<User> create(@Valid @RequestBody UserCreateRequest request) {  // @Valid 触发校验
        ...
    }
}
```

**✅ 提示**

* 校验注解有：`@NotBlank`/`@NotNull`/`@Email`/`@Size`/`@Min`/`@Max`/`@Pattern`/`@Future` 等，全为 JSR-380 标准注解。
* 校验失败默认抛出 `MethodArgumentNotValidException`，需配合 `@RestControllerAdvice` 统一兜底返回 `{"code":400,"message":...}`（2.1 §五实践项目做了示范）。
* `@Validated` 用于类上开启分组校验，或对 `@RequestParam` 参数做校验。

***

## 十一、监控：spring-boot-starter-actuator

**作用**：暴露 `/actuator/*` 监控端点（健康检查、指标、线程转储等），为容器探针 / 监控系统提供数据。

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics
  endpoint:
    health:
      show-details: always
```

**✅ 提示**

* **详细配置、端点清单、自定义 `HealthIndicator` 已在 `2.1-Spring全家桶.md` §3.3（Actuator 监控）完整覆盖，此处不再重复。** 直接去那里看即可。

***

## 十二、测试：spring-boot-starter-test

**作用**：聚合 JUnit 5 + AssertJ + Mockito + JSONPath 等测试全家桶（`<scope>test</scope>`）。

```yaml
# 一般无需 yaml 配置；关键在注解选择
```

**常用测试注解分工**

| 注解 | 用途 |
|------|------|
| `@SpringBootTest` | 加载完整 Spring 上下文做集成测试（最重，慢） |
| `@WebMvcTest` | 只加载 Web 层（Controller/MVC），其他 Bean 用 `@MockBean` 打桩，快 |
| `@DataJpaTest` | 只加载 JPA 层，默认用内嵌数据库（H2）测 Repository |
| `@MockBean` / `@MockitoBean` | 替换真实 Bean 为 Mock（Boot 3.4 起推荐 `@MockitoBean`） |
| `@TestConfiguration` | 测试内补充的配置类，不会污染生产 |

**✅ 提示**

* 测试需分隔环境配置：`src/test/resources/application-test.yml` 配内嵌库（H2）+ 独立端口，避免连到开发库。

***

## 附：Spring Boot 2.x vs 3.x 配置前缀速查

| 配置项 | Spring Boot 2.x | Spring Boot 3.x |
|--------|-----------------|-----------------|
| Redis 地址 | `spring.redis.host` | `spring.data.redis.host` |
| Redis 连接池 | `spring.redis.lettuce.pool.*` | `spring.data.redis.lettuce.pool.*` |
| JPA 方言 | `spring.jpa.database-platform`（同） | 同 |
| `@SpringBootTest` Mock | `@MockBean` | `@MockBean`（3.4 起推荐 `@MockitoBean`） |
| Web 安全配置 | `WebSecurityConfigurerAdapter` 继承 | 无继承，`SecurityFilterChain` Bean |
| 自动配置注册 | `META-INF/spring.factories` | `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` |
| Jackson 默认时间戳 | 输出为时间戳 | 输出为 ISO 时间字符串 |

**最常见迁移坑**：Boot 2 → 3 升版后 Redis 连不上，绝大多数是 `spring.redis` 前缀忘了改成 `spring.data.redis`。
