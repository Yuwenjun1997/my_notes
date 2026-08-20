---
url: >-
  /my_notes/notes/JAVA学习路线/shen-du-xue-xi/02-spring-cloud-alibaba-shen-ru/6-duo-zu-hu-ge-li/index.md
---
# 多租户隔离深入学习文档

> 在 SaaS 架构下，多租户（Multi-Tenancy）是核心设计模式。本篇从数据库、应用层、MyBatis、JPA、微服务传递、缓存、消息队列、安全权限到性能优化，全面讲解多租户隔离方案。

***

## 目录

1. [多租户架构背景](#1-多租户架构背景)
2. [三种隔离模型对比](#2-三种隔离模型对比)
3. [数据库层隔离方案实现](#3-数据库层隔离方案实现)
4. [应用层多租户实现](#4-应用层多租户实现)
5. [MyBatis 多租户拦截器](#5-mybatis-多租户拦截器)
6. [JPA 多租户实现](#6-jpa-多租户实现)
7. [租户上下文传递（微服务间）](#7-租户上下文传递微服务间)
8. [缓存隔离](#8-缓存隔离)
9. [消息队列隔离](#9-消息队列隔离)
10. [安全与权限](#10-安全与权限)
11. [性能与扩展](#11-性能与扩展)
12. [方案对比总结](#12-方案对比总结)

***

## 1. 多租户架构背景

### 1.1 什么是 SaaS 与多租户

**SaaS（Software as a Service）** 是一种软件交付模式，多个租户（Tenant）共享同一套应用实例，但各自的数据和配置相互隔离。租户可以是一个企业、一个组织、一个部门，甚至一个终端用户。

**多租户的核心挑战：** 在共享资源的前提下，保证每个租户的数据安全、性能稳定、功能定制，同时控制运营成本。

### 1.2 单租户 vs 多租户架构

```
=== 单租户架构（每租户独立部署） ===

  租户A                    租户B                    租户C
┌──────────┐            ┌──────────┐            ┌──────────┐
│ App 实例  │            │ App 实例  │            │ App 实例  │
└────┬─────┘            └────┬─────┘            └────┬─────┘
     │                       │                       │
┌────▼─────┐            ┌────▼─────┐            ┌────▼─────┐
│ 数据库A  │            │ 数据库B  │            │ 数据库C  │
└──────────┘            └──────────┘            └──────────┘

  特点：完全隔离，成本高，运维复杂

=== 多租户架构（共享部署） ===

  租户A    租户B    租户C
   │        │        │
   └────┬───┘────────┘
        │
   ┌────▼─────┐
   │ 共享 App  │  ← 路由层根据 tenant-id 分发
   └────┬─────┘
        │
   ┌────▼─────────────┐
   │  共享数据库集群    │  ← 按隔离策略分库/分表
   └──────────────────┘

  特点：成本低，运维简单，隔离需设计
```

### 1.3 多租户需要解决的核心问题

| 问题维度 | 具体内容 |
|---------|---------|
| 数据隔离 | 防止租户间数据泄露和非法访问 |
| 资源隔离 | CPU、内存、连接池、带宽等资源不被单租户耗尽 |
| 功能隔离 | 租户间的定制化功能互不影响 |
| 性能隔离 | 一个租户的高负载不影响其他租户的响应时间 |
| 安全隔离 | 认证、授权、审计均需租户维度区分 |

***

## 2. 三种隔离模型对比

### 2.1 三种模型概述

#### 模型一：独立数据库（Database per Tenant）

```
  租户A          租户B          租户C
   │              │              │
   ▼              ▼              ▼
┌────────┐   ┌────────┐   ┌────────┐
│ DB-A   │   │ DB-B   │   │ DB-C   │
│ users  │   │ users  │   │ users  │
│ orders │   │ orders │   │ orders │
└────────┘   └────────┘   └────────┘
```

* 每个租户拥有独立的数据库实例或独立的 database
* 数据库级别的物理隔离
* 可以对单个租户做独立备份、恢复、调优

#### 模型二：共享数据库独立 Schema（Shared DB, Separate Schemas）

```
  租户A          租户B          租户C
   │              │              │
   └──────┬───────┘──────────────┘
          ▼
  ┌──────────────────────┐
  │     共享数据库实例      │
  │ ┌────────┐┌────────┐ │
  │ │Schema-A││Schema-B│ │  ← 不同 Schema
  │ │ users  ││ users  │ │
  │ │ orders ││ orders │ │
  │ └────────┘└────────┘ │
  └──────────────────────┘
```

* 多个租户共享数据库实例，但使用独立的 Schema
* Schema 级别的逻辑隔离
* 可通过 MySQL `USE schema_name` 切换

#### 模型三：共享表（Shared Tables with tenant\_id）

```
  租户A          租户B          租户C
   │              │              │
   └──────┬───────┘──────────────┘
          ▼
  ┌──────────────────────┐
  │     共享数据库实例      │
  │ ┌──────────────────┐ │
  │ │  共享表 users     │ │
  │ │  id | name | tenant_id │ │
  │ │  1  | Alice | A  │ │
  │ │  2  | Bob   | B  │ │
  │ │  3  | Carol | A  │ │
  │ └──────────────────┘ │
  └──────────────────────┘
```

* 所有租户共享同一组表，通过 `tenant_id` 字段区分
* 成本最低，但隔离级别最低
* 需要在应用层强制附加 `tenant_id` 条件

### 2.2 三种模型详细对比

| 对比维度 | 独立数据库 | 共享库独立 Schema | 共享表（tenant\_id） |
|---------|-----------|------------------|-------------------|
| 隔离级别 | 物理隔离（最高） | 逻辑隔离（中等） | 字段隔离（最低） |
| 数据安全性 | 最高，天然隔离 | 较高，Schema 隔离 | 依赖应用层过滤 |
| 运维成本 | 最高（N 套数据库） | 中等（N 个 Schema） | 最低（1 套表） |
| 开发复杂度 | 低（逻辑简单） | 中等（需路由 Schema） | 高（全局过滤） |
| 资源利用率 | 最低 | 中等 | 最高 |
| 单租户扩展 | 容易（独立调优） | 较容易 | 较难 |
| 数据迁移 | 简单（整体迁移） | 中等 | 复杂（需过滤） |
| Schema 变更 | 独立变更 | 逐 Schema 变更 | 统一变更 |
| 单租户备份恢复 | 独立操作 | 独立 Schema 操作 | 需过滤导出 |
| 适合租户规模 | 小规模（<50） | 中规模（50-500） | 大规模（500+） |
| 适合客户类型 | 企业大客户、政府 | 中型企业客户 | 中小企业/个人用户 |

### 2.3 选型决策矩阵

```
是否需要最强数据隔离？ ──── 是 ──→ 独立数据库
        │
        否
        │
租户数量是否超过 100？ ──── 是 ──→ 共享表（tenant_id）
        │
        否
        │
是否需要单租户定制 Schema？── 是 ──→ 共享库独立 Schema
        │
        否
        │
  运营成本是否敏感？ ──── 是 ──→ 共享表（tenant_id）
        │
        否 ──→ 共享库独立 Schema（折中方案）
```

实际项目中常见**混合方案**：大客户使用独立数据库，中小客户使用共享表，通过路由层自动分发。

***

## 3. 数据库层隔离方案实现

### 3.1 Schema 级隔离（MySQL）

```sql
-- 为每个租户创建独立 Schema
CREATE DATABASE IF NOT EXISTS `tenant_a` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS `tenant_b` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 在指定 Schema 下创建表
USE tenant_a;
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(64) NOT NULL,
    email VARCHAR(128),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

USE tenant_b;
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(64) NOT NULL,
    email VARCHAR(128),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2 共享表 tenant\_id 设计

```sql
-- 所有租户共享的表结构
CREATE TABLE orders (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(32) NOT NULL COMMENT '租户标识',
    user_id BIGINT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    status TINYINT DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    -- 复合索引：优先 tenant_id 以保证查询走索引
    INDEX idx_tenant_user (tenant_id, user_id),
    INDEX idx_tenant_status (tenant_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 查询时必须携带 tenant_id
SELECT * FROM orders WHERE tenant_id = 'tenant_a' AND user_id = 1001;
```

### 3.3 AbstractRoutingDataSource 动态数据源

```java
import org.springframework.jdbc.datasource.lookup.AbstractRoutingDataSource;
import javax.sql.DataSource;

/**
 * 动态数据源路由器
 * 根据当前线程绑定的租户标识，路由到对应的数据源
 */
public class DynamicDataSource extends AbstractRoutingDataSource {

    @Override
    protected Object determineCurrentLookupKey() {
        return TenantContextHolder.getTenantId();
    }
}
```

```java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import javax.sql.DataSource;
import java.util.HashMap;
import java.util.Map;

/**
 * 多数据源配置类
 * 为每个租户创建独立的 DataSource，并注册到动态路由中
 */
@Configuration
public class DataSourceConfig {

    @Bean
    public DataSource dynamicDataSource() {
        DynamicDataSource dynamicDataSource = new DynamicDataSource();

        // 创建各租户数据源
        Map<Object, Object> targetDataSources = new HashMap<>();

        targetDataSources.put("tenant_a", createDataSource(
                "jdbc:mysql://localhost:3306/tenant_a?useSSL=false&serverTimezone=Asia/Shanghai",
                "root", "root123"));
        targetDataSources.put("tenant_b", createDataSource(
                "jdbc:mysql://localhost:3306/tenant_b?useSSL=false&serverTimezone=Asia/Shanghai",
                "root", "root123"));

        dynamicDataSource.setTargetDataSources(targetDataSources);
        dynamicDataSource.setDefaultTargetDataSource(targetDataSources.get("tenant_a"));
        return dynamicDataSource;
    }

    private DataSource createDataSource(String url, String username, String password) {
        DriverManagerDataSource ds = new DriverManagerDataSource();
        ds.setUrl(url);
        ds.setUsername(username);
        ds.setPassword(password);
        return ds;
    }
}
```

### 3.4 TenantContextHolder（ThreadLocal 持有者）

```java
/**
 * 租户上下文持有者
 * 使用 ThreadLocal 在当前线程中保存/读取租户标识
 */
public class TenantContextHolder {

    private static final ThreadLocal<String> TENANT_ID = new ThreadLocal<>();

    public static void setTenantId(String tenantId) {
        TENANT_ID.set(tenantId);
    }

    public static String getTenantId() {
        return TENANT_ID.get();
    }

    public static void clear() {
        TENANT_ID.remove();
    }
}
```

***

## 4. 应用层多租户实现

### 4.1 TenantContext（统一上下文）

```java
/**
 * 多租户上下文
 * 封装租户标识的存取，提供默认租户兜底
 */
public class TenantContext {

    private static final ThreadLocal<String> CURRENT_TENANT = new ThreadLocal<>();
    private static final String DEFAULT_TENANT = "default";

    public static void setTenantId(String tenantId) {
        CURRENT_TENANT.set(tenantId);
    }

    public static String getTenantId() {
        String tenantId = CURRENT_TENANT.get();
        return tenantId != null ? tenantId : DEFAULT_TENANT;
    }

    public static String getRawTenantId() {
        return CURRENT_TENANT.get();
    }

    public static boolean isTenantSet() {
        return CURRENT_TENANT.get() != null;
    }

    public static void clear() {
        CURRENT_TENANT.remove();
    }
}
```

### 4.2 TenantInterceptor（拦截器提取 Header 中的租户信息）

```java
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * HTTP 拦截器：从请求 Header 中提取 X-Tenant-Id，注入到上下文
 */
@Component
public class TenantInterceptor implements HandlerInterceptor {

    private static final String TENANT_HEADER = "X-Tenant-Id";

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) {
        String tenantId = request.getHeader(TENANT_HEADER);
        if (tenantId == null || tenantId.isBlank()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            return false;
        }
        TenantContext.setTenantId(tenantId);
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request,
                                HttpServletResponse response,
                                Object handler, Exception ex) {
        TenantContext.clear();
    }
}
```

### 4.3 TenantFilter（Servlet Filter，确保所有请求都经过租户校验）

```java
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Servlet 过滤器：优先级最高，确保在拦截器之前完成租户识别
 * 适用于非 Spring MVC 路径（如 Actuator 端点）
 */
@Component
@Order(1)
public class TenantFilter implements Filter {

    private static final String TENANT_HEADER = "X-Tenant-Id";

    @Override
    public void doFilter(ServletRequest request, ServletResponse response,
                         FilterChain chain) throws IOException, ServletException {

        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        String tenantId = httpRequest.getHeader(TENANT_HEADER);
        if (tenantId == null || tenantId.isBlank()) {
            httpResponse.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            httpResponse.getWriter().write("{\"error\": \"Missing X-Tenant-Id header\"}");
            return;
        }

        TenantContext.setTenantId(tenantId);
        try {
            chain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }
}
```

### 4.4 WebMvcConfigurer 注册拦截器

```java
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Autowired
    private TenantInterceptor tenantInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(tenantInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns("/actuator/**", "/health");
    }
}
```

***

## 5. MyBatis 多租户拦截器

### 5.1 MyBatis-Plus TenantLineInnerInterceptor

MyBatis-Plus 内置了 `TenantLineInnerInterceptor`，自动在 SQL 语句中追加 `tenant_id` 条件。

```java
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.TenantLineInnerInterceptor;
import com.baomidou.mybatisplus.extension.plugins.handler.TenantLineHandler;
import net.sf.jsqlparser.expression.Expression;
import net.sf.jsqlparser.expression.LongValue;

/**
 * MyBatis-Plus 多租户插件配置
 */
@org.springframework.context.annotation.Configuration
public class MybatisPlusConfig {

    @org.springframework.context.annotation.Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();

        TenantLineInnerInterceptor tenantInterceptor = new TenantLineInnerInterceptor(
                new TenantLineHandler() {
                    @Override
                    public Expression getTenantId() {
                        // 返回当前租户 ID 作为 SQL 条件值
                        return new LongValue(TenantContext.getTenantId());
                    }

                    @Override
                    public String getTenantIdColumn() {
                        return "tenant_id";
                    }

                    @Override
                    public boolean ignoreTable(String tableName) {
                        // 需要忽略租户隔离的表（全局配置）
                        return ignoreTenantTable(tableName);
                    }
                }
        );

        interceptor.addInnerInterceptor(tenantInterceptor);
        return interceptor;
    }

    /**
     * 忽略租户隔离的白名单表
     * 这些表不追加 tenant_id 条件（如租户配置表、公共字典表）
     */
    private boolean ignoreTenantTable(String tableName) {
        Set<String> ignoreTables = Set.of(
                "sys_tenant",           // 租户信息表
                "sys_dict",             // 公共字典表
                "sys_config",           // 全局配置表
                "sys_region"            // 行政区划表
        );
        return ignoreTables.contains(tableName);
    }
}
```

### 5.2 自定义 SqlParser 手动追加条件

```java
import net.sf.jsqlparser.expression.Expression;
import net.sf.jsqlparser.expression.LongValue;
import net.sf.jsqlparser.expression.operators.conditional.AndExpression;
import net.sf.jsqlparser.parser.CCJSqlParserUtil;
import net.sf.jsqlparser.statement.Statement;
import net.sf.jsqlparser.statement.select.PlainSelect;
import net.sf.jsqlparser.statement.select.Select;

/**
 * 手动 SQL 解析追加 tenant_id 条件
 * 用于需要精细控制的场景（如直接写 SQL 的查询）
 */
public class TenantSqlParser {

    private static final Set<String> IGNORE_TABLES = Set.of(
            "sys_tenant", "sys_dict", "sys_config"
    );

    /**
     * 自动在 SQL 中追加 tenant_id 条件
     */
    public static String parse(String sql) throws Exception {
        Statement statement = CCJSqlParserUtil.parse(sql);

        if (statement instanceof Select select) {
            if (select.getSelectBody() instanceof PlainSelect plainSelect) {
                String tableName = plainSelect.getFromItem().toString();
                if (IGNORE_TABLES.contains(tableName)) {
                    return sql;
                }

                Expression tenantCondition = new LongValue(
                        "tenant_id = " + TenantContext.getTenantId());
                Expression where = plainSelect.getWhere();
                if (where == null) {
                    plainSelect.setWhere(tenantCondition);
                } else {
                    plainSelect.setWhere(new AndExpression(where, tenantCondition));
                }
            }
        }
        return statement.toString();
    }
}
```

***

## 6. JPA 多租户实现

### 6.1 Hibernate Filter + @FilterDef

```java
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.FilterDef;
import org.hibernate.annotations.ParamDef;

@Entity
@Table(name = "orders")
@FilterDef(
    name = "tenantFilter",
    parameters = @ParamDef(name = "tenantId", type = Long.class)
)
@Filter(name = "tenantFilter", condition = "tenant_id = :tenantId")
public class Order {

    @jakarta.persistence.Id
    @jakarta.persistence.GeneratedValue(strategy = jakarta.persistence.GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id")
    private Long tenantId;

    private String orderNo;
    private java.math.BigDecimal amount;

    // getter/setter 省略
}
```

### 6.2 CurrentTenantIdentifierResolver

```java
import org.hibernate.context.spi.CurrentTenantIdentifierResolver;
import org.springframework.stereotype.Component;

/**
 * Hibernate 多租户标识解析器
 * 每次 Hibernate 操作时获取当前租户 ID
 */
@Component
public class TenantIdentifierResolver implements CurrentTenantIdentifierResolver {

    @Override
    public String resolveCurrentTenantIdentifier() {
        String tenantId = TenantContext.getRawTenantId();
        return tenantId != null ? tenantId : "default";
    }

    @Override
    public boolean validateExistingCurrentSessions() {
        return true;
    }
}
```

### 6.3 MultiTenantConnectionProvider

```java
import org.hibernate.engine.jdbc.connections.spi.MultiTenantConnectionProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Map;

/**
 * Hibernate 多租户连接提供者
 * 根据租户 ID 从对应的数据源获取连接
 */
@Component
public class TenantConnectionProvider implements MultiTenantConnectionProvider {

    @Autowired
    private DataSource dynamicDataSource;

    private final Map<String, DataSource> tenantDataSources = Map.of(
            "tenant_a", createDataSource("jdbc:mysql://localhost:3306/tenant_a"),
            "tenant_b", createDataSource("jdbc:mysql://localhost:3306/tenant_b")
    );

    @Override
    public Connection getAnyConnection() throws SQLException {
        return dynamicDataSource.getConnection();
    }

    @Override
    public void releaseAnyConnection(Connection connection) throws SQLException {
        connection.close();
    }

    @Override
    public Connection getConnection(String tenantIdentifier) throws SQLException {
        DataSource ds = tenantDataSources.get(tenantIdentifier);
        if (ds == null) {
            throw new SQLException("Unknown tenant: " + tenantIdentifier);
        }
        return ds.getConnection();
    }

    @Override
    public void releaseConnection(String tenantIdentifier, Connection connection)
            throws SQLException {
        connection.close();
    }

    @Override
    public boolean supportsAggressiveRelease() {
        return false;
    }

    @Override
    public boolean isUnwrappableAs(Class<?> unwrapType) {
        return false;
    }

    @Override
    public <T> T unwrap(Class<T> unwrapType) {
        throw new UnsupportedOperationException("Unwrap not supported");
    }

    private DataSource createDataSource(String url) {
        org.springframework.jdbc.datasource.DriverManagerDataSource ds =
                new org.springframework.jdbc.datasource.DriverManagerDataSource();
        ds.setUrl(url);
        ds.setUsername("root");
        ds.setPassword("root123");
        return ds;
    }
}
```

### 6.4 application.yml Hibernate 多租户配置

```yaml
spring:
  jpa:
    hibernate:
      dialect: org.hibernate.dialect.MySQLDialect
      naming:
        physical-strategy: org.hibernate.boot.model.naming.PhysicalNamingStrategyStandardImpl
    properties:
      hibernate:
        multiTenancy: SCHEMA          # 多租户策略：SCHEMA / DATABASE / DISCRIMINATOR
        tenant_identifier_resolver: com.example.tenant.TenantIdentifierResolver
        multi_tenant_connection_provider: com.example.tenant.TenantConnectionProvider
        connection.provider_disables_autocommit: true
        jdbc:
          batch_size: 50
          batch_versioned_data: true
```

***

## 7. 租户上下文传递（微服务间）

在微服务架构中，一个用户请求会经过多个服务。租户上下文必须在服务间自动传递。

### 7.1 RestTemplate 拦截器

```java
import org.springframework.http.HttpRequest;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;

import java.io.IOException;

/**
 * RestTemplate 拦截器：自动携带租户 Header
 */
public class TenantRestTemplateInterceptor implements ClientHttpRequestInterceptor {

    private static final String TENANT_HEADER = "X-Tenant-Id";

    @Override
    public ClientHttpResponse intercept(HttpRequest request, byte[] body,
                                        ClientHttpRequestExecution execution)
            throws IOException {
        String tenantId = TenantContext.getTenantId();
        if (tenantId != null) {
            request.getHeaders().set(TENANT_HEADER, tenantId);
        }
        return execution.execute(request, body);
    }
}
```

```java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.util.List;

@Configuration
public class RestTemplateConfig {

    @Bean
    public RestTemplate restTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(5000);

        RestTemplate restTemplate = new RestTemplate(factory);
        restTemplate.setInterceptors(List.of(new TenantRestTemplateInterceptor()));
        return restTemplate;
    }
}
```

### 7.2 OpenFeign RequestInterceptor

```java
import feign.RequestInterceptor;
import feign.RequestTemplate;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenFeign 拦截器：Feign 远程调用时自动传递租户 Header
 */
@Configuration
public class FeignTenantConfig {

    @Bean
    public RequestInterceptor tenantRequestInterceptor() {
        return (RequestTemplate template) -> {
            String tenantId = TenantContext.getTenantId();
            if (tenantId != null) {
                template.header("X-Tenant-Id", tenantId);
            }
        };
    }
}
```

### 7.3 Spring Cloud Gateway 租户过滤器

```java
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * 网关全局过滤器：从请求中提取租户 Header 并向下游传递
 */
@Component
public class TenantGatewayFilter implements GlobalFilter, Ordered {

    private static final String TENANT_HEADER = "X-Tenant-Id";

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String tenantId = exchange.getRequest()
                .getHeaders()
                .getFirst(TENANT_HEADER);

        if (tenantId == null || tenantId.isBlank()) {
            exchange.getResponse().setStatusCode(
                    org.springframework.http.HttpStatus.BAD_REQUEST);
            return exchange.getResponse().setComplete();
        }

        // 向下游服务传递租户 Header
        ServerHttpRequest newRequest = exchange.getRequest().mutate()
                .header(TENANT_HEADER, tenantId)
                .build();

        return chain.filter(exchange.mutate().request(newRequest).build());
    }

    @Override
    public int getOrder() {
        return -100; // 高优先级
    }
}
```

### 7.4 RabbitMQ 消息 Header 传递租户信息

```java
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessagePostProcessor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * RabbitMQ 租户感知生产者：消息发送时自动携带租户 Header
 */
@Component
public class TenantAwareMessageProducer {

    @Autowired
    private RabbitTemplate rabbitTemplate;

    public void send(String exchange, String routingKey, Object payload) {
        MessagePostProcessor messagePostProcessor = message -> {
            org.springframework.amqp.core.MessageProperties props =
                    message.getMessageProperties();
            String tenantId = TenantContext.getTenantId();
            if (tenantId != null) {
                props.setHeader("X-Tenant-Id", tenantId);
            }
            return message;
        };

        rabbitTemplate.convertAndSend(exchange, routingKey, payload, messagePostProcessor);
    }
}
```

```java
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Component;

/**
 * RabbitMQ 租户感知消费者：从消息 Header 中恢复租户上下文
 */
@Component
public class TenantAwareMessageConsumer {

    @RabbitListener(queues = "order.queue")
    public void onOrderMessage(String payload,
                               @Header(value = "X-Tenant-Id", required = false) String tenantId) {
        try {
            if (tenantId != null) {
                TenantContext.setTenantId(tenantId);
            }
            // 业务处理
            processOrder(payload);
        } finally {
            TenantContext.clear();
        }
    }

    private void processOrder(String payload) {
        System.out.println("[" + TenantContext.getTenantId() + "] 处理订单: " + payload);
    }
}
```

***

## 8. 缓存隔离

### 8.1 Redis Key 前缀策略

在多租户场景下，Redis Key 必须加上租户前缀，防止不同租户的缓存数据混淆。

```
=== 无隔离的 Key ===
  order:1001          ← 租户 A 和 B 可能冲突

=== 带租户前缀的 Key ===
  tenant:A:order:1001  ← 租户 A
  tenant:B:order:1001  ← 租户 B
```

### 8.2 Spring Cache 自定义 KeyGenerator

```java
import org.springframework.cache.interceptor.KeyGenerator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.lang.reflect.Method;
import java.util.StringJoiner;

/**
 * 租户感知的缓存 Key 生成器
 * 缓存 Key 格式: tenant:{tenantId}:{className}:{methodName}:{参数}
 */
@Configuration
public class TenantCacheConfig {

    @Bean("tenantKeyGenerator")
    public KeyGenerator tenantKeyGenerator() {
        return (Object target, Method method, Object... params) -> {
            StringJoiner joiner = new StringJoiner(":");
            joiner.add("tenant");
            joiner.add(TenantContext.getTenantId());
            joiner.add(target.getClass().getSimpleName());
            joiner.add(method.getName());
            for (Object param : params) {
                joiner.add(param.toString());
            }
            return joiner.toString();
        };
    }
}
```

```java
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
public class OrderService {

    /**
     * 租户感知的缓存查询
     * 缓存 Key 示例: tenant:tenant_a:OrderService:getOrder:1001
     */
    @Cacheable(value = "orders", keyGenerator = "tenantKeyGenerator")
    public Order getOrder(Long orderId) {
        // 查询数据库
        return orderMapper.selectById(orderId);
    }
}
```

### 8.3 RedisTemplate 租户感知包装器

```java
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.concurrent.TimeUnit;

/**
 * 租户感知的 RedisTemplate 包装器
 * 所有操作自动加租户前缀
 */
@Component
public class TenantRedisTemplate {

    private final RedisTemplate<String, Object> redisTemplate;

    public TenantRedisTemplate(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    private String prefixKey(String key) {
        return "tenant:" + TenantContext.getTenantId() + ":" + key;
    }

    public void set(String key, Object value) {
        redisTemplate.opsForValue().set(prefixKey(key), value);
    }

    public void set(String key, Object value, long timeout, TimeUnit unit) {
        redisTemplate.opsForValue().set(prefixKey(key), value, timeout, unit);
    }

    @SuppressWarnings("unchecked")
    public <T> T get(String key) {
        return (T) redisTemplate.opsForValue().get(prefixKey(key));
    }

    public Boolean delete(String key) {
        return redisTemplate.delete(prefixKey(key));
    }

    public Boolean hasKey(String key) {
        return redisTemplate.hasKey(prefixKey(key));
    }

    public Boolean expire(String key, long timeout, TimeUnit unit) {
        return redisTemplate.expire(prefixKey(key), timeout, unit);
    }

    /**
     * 批量删除当前租户的所有缓存（租户数据刷新时使用）
     */
    public Long deleteByTenant() {
        String pattern = "tenant:" + TenantContext.getTenantId() + ":*";
        var keys = redisTemplate.keys(pattern);
        if (keys != null && !keys.isEmpty()) {
            return redisTemplate.delete(keys);
        }
        return 0L;
    }
}
```

***

## 9. 消息队列隔离

### 9.1 Topic/Tag 按租户分区策略

```
=== 策略一：Topic 级隔离（推荐大租户） ===
  tenant_a.order.topic    ← 租户 A 专用 Topic
  tenant_b.order.topic    ← 租户 B 专用 Topic

=== 策略二：Tag 级隔离（推荐中小租户） ===
  order.topic + Tag:tenant_a   ← 同一 Topic，按 Tag 过滤
  order.topic + Tag:tenant_b

=== 策略三：Header 传递（最灵活） ===
  order.topic + Header: X-Tenant-Id=tenant_a
  消费者根据 Header 过滤
```

### 9.2 RocketMQ 租户感知生产者

```java
import org.apache.rocketmq.client.producer.SendResult;
import org.apache.rocketmq.spring.core.RocketMQTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.Message;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.stereotype.Component;

/**
 * RocketMQ 租户感知生产者
 * 消息发送时自动携带 X-Tenant-Id Header
 */
@Component
public class TenantAwareMqProducer {

    @Autowired
    private RocketMQTemplate rocketMQTemplate;

    public SendResult sendOrder(String destination, Object payload) {
        Message<Object> message = MessageBuilder
                .withPayload(payload)
                .setHeader("X-Tenant-Id", TenantContext.getTenantId())
                .build();

        return rocketMQTemplate.syncSend(destination, message);
    }
}
```

### 9.3 RocketMQ 租户感知消费者

```java
import org.apache.rocketmq.spring.annotation.RocketMQMessageListener;
import org.apache.rocketmq.spring.core.RocketMQListener;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageHeaders;
import org.springframework.stereotype.Component;

/**
 * RocketMQ 租户感知消费者
 * 从消息 Header 中提取租户标识并注入上下文
 */
@Component
@RocketMQMessageListener(
        topic = "order-topic",
        consumerGroup = "order-consumer-group"
)
public class TenantAwareMqConsumer implements RocketMQListener<Message<Object>> {

    @Override
    public void onMessage(Message<Object> message) {
        MessageHeaders headers = message.getHeaders();
        String tenantId = (String) headers.get("X-Tenant-Id");

        try {
            if (tenantId != null) {
                TenantContext.setTenantId(tenantId);
            }
            processMessage(message.getPayload());
        } finally {
            TenantContext.clear();
        }
    }

    private void processMessage(Object payload) {
        System.out.println("[" + TenantContext.getTenantId() + "] 处理消息: " + payload);
    }
}
```

### 9.4 Kafka 租户感知生产者与消费者

```java
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.Message;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.stereotype.Component;

@Component
public class TenantAwareKafkaProducer {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public TenantAwareKafkaProducer(KafkaTemplate<String, Object> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void send(String topic, String key, Object payload) {
        Message<Object> message = MessageBuilder
                .withPayload(payload)
                .setHeader(KafkaHeaders.TOPIC, topic)
                .setHeader(KafkaHeaders.KEY, key)
                .setHeader("X-Tenant-Id", TenantContext.getTenantId())
                .build();

        kafkaTemplate.send(message);
    }
}
```

```java
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Component;

@Component
public class TenantAwareKafkaConsumer {

    @KafkaListener(topics = "order-topic", groupId = "order-group")
    public void onMessage(String payload,
                          @Header(value = "X-Tenant-Id", required = false) String tenantId) {
        try {
            if (tenantId != null) {
                TenantContext.setTenantId(tenantId);
            }
            System.out.println("[" + TenantContext.getTenantId() + "] Kafka 消费: " + payload);
        } finally {
            TenantContext.clear();
        }
    }
}
```

***

## 10. 安全与权限

### 10.1 租户级 RBAC 扩展模型

在传统 RBAC（用户-角色-权限）基础上增加**租户维度**：

```
  租户A（Tenant A）
  ├── 用户: Alice (admin), Bob (user)
  │     ├── Alice → 角色: 租户管理员 → 权限: [用户管理, 订单管理, 数据导出]
  │     └── Bob   → 角色: 普通用户   → 权限: [订单查看]
  └── 数据范围: 仅限 tenant_id = 'A' 的数据

  租户B（Tenant B）
  ├── 用户: Carol (admin)
  │     └── Carol → 角色: 租户管理员 → 权限: [用户管理, 订单管理]
  └── 数据范围: 仅限 tenant_id = 'B' 的数据
```

### 10.2 数据权限边界强制执行

```java
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;

/**
 * 租户数据权限切面
 * 在数据访问层强制校验租户边界
 */
@Aspect
@Component
public class TenantDataPermissionAspect {

    /**
     * 拦截所有 Mapper 方法，自动追加租户过滤
     */
    @Around("execution(* com.example.mapper.*.*(..))")
    public Object enforceTenantBoundary(ProceedingJoinPoint joinPoint) throws Throwable {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            throw new SecurityException("未设置租户上下文，拒绝数据访问");
        }

        // 校验当前用户是否有权访问目标数据
        validateTenantAccess(tenantId, joinPoint);

        return joinPoint.proceed();
    }

    private void validateTenantAccess(String tenantId, ProceedingJoinPoint joinPoint) {
        // 实际项目中可结合 Spring Security 的 Authentication 校验
        // 确保当前登录用户属于该租户
        // 此处为示例逻辑
        String currentUserTenant = getCurrentUserTenant();
        if (!tenantId.equals(currentUserTenant)) {
            throw new SecurityException(
                    "越权访问：当前用户属于租户 " + currentUserTenant
                    + "，尝试访问租户 " + tenantId + " 的数据");
        }
    }

    private String getCurrentUserTenant() {
        // 从 Spring Security 上下文中获取当前用户的租户信息
        return TenantContext.getTenantId();
    }
}
```

### 10.3 跨租户访问防护清单

| 防护层级 | 措施 | 实现方式 |
|---------|------|---------|
| 网关层 | 校验 X-Tenant-Id Header 存在性 | Gateway Filter |
| 应用层 | ThreadLocal 绑定租户 | TenantInterceptor |
| SQL 层 | 自动追加 tenant\_id 条件 | MyBatis/JPA 拦截器 |
| 接口层 | 校验资源归属 | AOP 切面 |
| 数据层 | 数据库行级安全策略 | PostgreSQL RLS / MySQL 触发器 |

***

## 11. 性能与扩展

### 11.1 租户路由索引优化

共享表方案下，所有查询都必须携带 `tenant_id`，因此**复合索引**设计至关重要：

```sql
-- 错误：单独索引 tenant_id 无法优化具体查询
CREATE INDEX idx_tenant ON orders(tenant_id);

-- 正确：将 tenant_id 作为复合索引的前缀列
CREATE INDEX idx_tenant_user ON orders(tenant_id, user_id);
CREATE INDEX idx_tenant_status_time ON orders(tenant_id, status, create_time);

-- 覆盖索引：避免回表查询
CREATE INDEX idx_tenant_order_cover
    ON orders(tenant_id, user_id, status, amount, create_time);
```

### 11.2 冷热数据分离

```sql
-- 热数据表（近 3 个月数据，存储在高性能磁盘）
CREATE TABLE orders_hot (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(32) NOT NULL,
    user_id BIGINT NOT NULL,
    amount DECIMAL(12, 2),
    status TINYINT DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_user (tenant_id, user_id)
) ENGINE=InnoDB;

-- 冷数据表（3 个月前数据，存储在低成本磁盘）
CREATE TABLE orders_cold (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(32) NOT NULL,
    user_id BIGINT NOT NULL,
    amount DECIMAL(12, 2),
    status TINYINT DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_time (tenant_id, create_time)
) ENGINE=InnoDB;
```

```java
/**
 * 数据归档服务：定期将热数据迁移到冷表
 */
@Service
public class DataArchiveService {

    @Autowired
    private OrderMapper orderMapper;

    @Scheduled(cron = "0 0 2 * * ?") // 每天凌晨 2 点执行
    public void archiveOldData() {
        // 按租户分批归档，避免单次操作数据量过大
        List<String> tenants = orderMapper.selectAllTenants();
        for (String tenantId : tenants) {
            archiveTenantData(tenantId, 90); // 归档 90 天前的数据
        }
    }

    private void archiveTenantData(String tenantId, int daysOld) {
        orderMapper.archiveToColdTable(tenantId, daysOld);
        orderMapper.deleteArchivedFromHot(tenantId, daysOld);
    }
}
```

### 11.3 连接池按租户分配

```yaml
# 每个租户可配置独立的连接池参数
spring:
  datasource:
    dynamic:
      datasource:
        tenant_a:
          url: jdbc:mysql://localhost:3306/tenant_a
          hikari:
            maximum-pool-size: 20
            minimum-idle: 5
            connection-timeout: 30000
        tenant_b:
          url: jdbc:mysql://localhost:3306/tenant_b
          hikari:
            maximum-pool-size: 50    # 大租户分配更多连接
            minimum-idle: 10
            connection-timeout: 30000
```

### 11.4 租户维度监控指标

```java
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.stereotype.Component;

/**
 * 租户维度的监控指标收集器
 * 支持按租户分别统计请求量、响应时间、错误率
 */
@Component
public class TenantMetricsCollector {

    private final MeterRegistry meterRegistry;

    public TenantMetricsCollector(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    public void recordRequest(String tenantId, String api, long durationMs, boolean success) {
        // 按租户统计请求量
        Counter.builder("tenant.requests.total")
                .tag("tenant_id", tenantId)
                .tag("api", api)
                .tag("status", success ? "success" : "error")
                .register(meterRegistry)
                .increment();

        // 按租户统计响应时间
        Timer.builder("tenant.request.duration")
                .tag("tenant_id", tenantId)
                .tag("api", api)
                .register(meterRegistry)
                .record(java.time.Duration.ofMillis(durationMs));
    }
}
```

***

## 12. 方案对比总结

### 12.1 全层隔离策略对比

| 隔离层级 | 方案 | 复杂度 | 隔离强度 | 性能影响 |
|---------|------|:------:|:-------:|:-------:|
| 数据库（结构） | 独立数据库 | 低 | 极强 | 无 |
| 数据库（Schema） | 共享库独立 Schema | 中 | 强 | 低 |
| 数据库（行级） | 共享表 + tenant\_id | 高 | 中 | 中（索引优化后低） |
| ORM 拦截 | MyBatis-Plus 插件 | 低 | 中 | 低 |
| ORM 拦截 | Hibernate Filter | 中 | 中 | 低 |
| 应用层 | ThreadLocal + 拦截器 | 低 | 中 | 极低 |
| 缓存 | Redis Key 前缀 | 低 | 强 | 极低 |
| 消息队列 | Header 传递 | 低 | 强 | 极低 |
| 网关层 | Gateway Filter | 低 | 强 | 极低 |
| 安全层 | AOP + RBAC 扩展 | 中 | 强 | 低 |
| 监控 | Micrometer 标签 | 低 | N/A | 极低 |

### 12.2 不同场景推荐方案

| 场景 | 推荐数据库模型 | 缓存策略 | MQ 策略 | 安全策略 |
|------|--------------|---------|--------|---------|
| SaaS 中小客户 | 共享表 + tenant\_id | Key 前缀 | Header 传递 | AOP 校验 |
| SaaS 企业客户 | 共享库独立 Schema | Key 前缀 | Header + Tag | AOP + 数据库约束 |
| 政府/金融 | 独立数据库 | 独立 Redis 实例 | 独立 Topic | 物理隔离 |
| 混合模式 | 路由层按客户分发 | 按模型选择 | 按模型选择 | 分层防护 |

### 12.3 关键注意事项

| 注意事项 | 说明 |
|---------|------|
| ThreadLocal 泄露 | 异步线程、线程池场景必须手动传递和清理租户上下文 |
| 数据库连接池 | 每个租户独立连接池可避免慢查询影响全局 |
| Schema 变更 | 共享 Schema 模式下需自动化脚本批量变更 |
| 缓存一致性 | 租户数据刷新时需精确清除对应前缀的缓存 |
| 日志隔离 | 日志中必须包含 tenant\_id，便于排查问题 |
| 租户配额 | 大租户需设置独立的 QPS/连接数配额 |
| 数据导出 | 租户数据导出必须限制只导出当前租户数据 |

***

> **参考资源：**
>
> * MyBatis-Plus 多租户插件: https://baomidou.com/plugins/tenant/
> * Hibernate 多租户: https://docs.jboss.org/hibernate/orm/6.2/userguide/html\_single/Hibernate\_User\_Guide.html#multitenacy
> * Spring Cloud Gateway: https://docs.spring.io/spring-cloud-gateway/docs/current/reference/html/
> * Alibaba Cloud 多租户方案: https://help.aliyun.com/zh/sae/
