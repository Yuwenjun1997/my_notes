---
url: >-
  /my_notes/notes/数据库知识库/di-san-jie-duan-shi-zhan-yu-dui-bi/4-lian-jie-chi-yu-zhong-jian-jian-pei-zhi/index.md
---
# 连接池与中间件配置

## 一、Java 连接池 — HikariCP

HikariCP 是 Spring Boot 默认连接池，以高性能著称。

### 1.1 基础配置

```yaml
# application.yml（MySQL）
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/mydb?useUnicode=true&characterEncoding=utf-8&serverTimezone=Asia/Shanghai
    username: app_user
    password: ${DB_PASSWORD}
    driver-class-name: com.mysql.cj.jdbc.Driver
    hikari:
      pool-name: MySQL-Pool
      maximum-pool-size: 20          # 最大连接数
      minimum-idle: 5                # 最小空闲连接数
      idle-timeout: 300000           # 空闲连接超时（5分钟）
      max-lifetime: 1800000          # 连接最大存活时间（30分钟）
      connection-timeout: 30000      # 获取连接超时（30秒）
      leak-detection-threshold: 60000 # 连接泄漏检测（60秒）
```

```yaml
# application.yml（PostgreSQL）
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/mydb
    username: app_user
    password: ${DB_PASSWORD}
    driver-class-name: org.postgresql.Driver
    hikari:
      pool-name: PG-Pool
      maximum-pool-size: 20
      minimum-idle: 5
```

### 1.2 HikariCP 监控

```java
// 获取连接池指标
HikariPoolMXBean poolMXBean = dataSource.getHikariPoolMXBean();
log.info("活跃连接数: {}", poolMXBean.getActiveConnections());
log.info("空闲连接数: {}", poolMXBean.getIdleConnections());
log.info("等待线程数: {}", poolMXBean.getThreadsAwaitingConnection());
log.info("总连接数: {}", poolMXBean.getTotalConnections());
```

### 1.3 连接池大小计算建议

```
# HikariCP 作者推荐公式
connections = ((core_count * 2) + effective_spindle_count)

# 例如：4核 CPU + SSD
connections = (4 * 2) + 1 = 9

# 经验公式（更实用）：
connections = CPU核心数 * 2 + 磁盘数
# 8核 SSD 服务器：connections ≈ 17-20

# 注意：PostgreSQL 连接池应更小（每连接是进程，开销更大）
# PostgreSQL：建议 connections = CPU核心数 * 2 + 1（不超过 50）
```

***

## 二、Druid 连接池（阿里巴巴）

Druid 不仅是连接池，还提供 SQL 监控和防 SQL 注入功能。

### 2.1 基础配置

```yaml
# application.yml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/mydb
    username: app_user
    password: ${DB_PASSWORD}
    driver-class-name: com.mysql.cj.jdbc.Driver
    type: com.alibaba.druid.pool.DruidDataSource
    druid:
      initial-size: 5                 # 初始化连接数
      min-idle: 5                     # 最小空闲连接数
      max-active: 20                  # 最大连接数
      max-wait: 30000                 # 获取连接超时（毫秒）
      time-between-eviction-runs-millis: 60000  # 检测间隔
      min-evictable-idle-time-millis: 300000    # 空闲最小存活时间
      validation-query: SELECT 1      # 连接验证 SQL
      test-while-idle: true           # 空闲时验证
      test-on-borrow: false           # 借出时验证（影响性能）
      pool-prepared-statements: true  # 开启 PSCache
      max-pool-prepared-statement-per-connection-size: 20

      # 监控配置
      stat-view-servlet:
        enabled: true
        url-pattern: /druid/*
        login-username: admin
        login-password: ${DRUID_PASSWORD}
      filter:
        stat:
          enabled: true
          slow-sql-millis: 1000       # 慢 SQL 阈值（毫秒）
          log-slow-sql: true
        wall:
          enabled: true               # 防火墙（防 SQL 注入）
          config:
            multi-statement-allow: false
```

***

## 三、PgBouncer 连接池

PgBouncer 是 PostgreSQL 最常用的连接池，轻量级，性能极好。

### 3.1 安装与配置

```bash
# Ubuntu 安装
sudo apt install pgbouncer

# Docker 部署
docker run -d --name pgbouncer \
  -p 6432:6432 \
  -v pgbouncer.ini:/etc/pgbouncer/pgbouncer.ini \
  -v userlist.txt:/etc/pgbouncer/userlist.txt \
  edoburu/pgbouncer
```

### 3.2 配置详解

```ini
# /etc/pgbouncer/pgbouncer.ini

[databases]
# 数据库别名映射
mydb = host=127.0.0.1 port=5432 dbname=mydb
mydb_slave = host=192.168.1.101 port=5432 dbname=mydb

[pgbouncer]
# 监听配置
listen_addr = 0.0.0.0
listen_port = 6432

# 认证
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt

# 连接池配置
pool_mode = transaction            # 推荐 transaction 模式
default_pool_size = 20             # 每个数据库+用户的默认池大小
min_pool_size = 5                  # 最小池大小
reserve_pool_size = 5              # 突发流量预留池
reserve_pool_timeout = 3           # 预留池等待超时（秒）
max_client_conn = 1000             # 最大客户端连接
max_db_connections = 50            # 每个数据库最大后端连接

# 超时配置
server_idle_timeout = 300          # 后端空闲超时（秒）
client_idle_timeout = 0            # 客户端空闲超时（0=不限）
query_timeout = 0                  # 查询超时（0=不限）
query_wait_timeout = 120           # 查询等待超时（等待连接池）
```

### 3.3 userlist.txt 格式

```
"username" "password_hash"
```

```bash
# 生成密码哈希（SCRAM-SHA-256）
# 方式一：使用 PostgreSQL 生成
psql -U postgres -c "SELECT rolpassword FROM pg_authid WHERE rolname = 'app_user';"

# 方式二：使用 PgBouncer 工具
python3 -c "import hashlib; print('\"app_user\" \"SCRAM-SHA-256$...\"')"
```

***

## 四、ProxySQL（MySQL 中间件）

ProxySQL 是 MySQL 的高性能代理，支持读写分离、查询缓存、连接池。

### 4.1 Docker 部署

```bash
docker run -d --name proxysql \
  -p 6033:6033 \      # MySQL 协议端口（应用连接）
  -p 6032:6032 \      # 管理端口
  proxysql/proxysql
```

### 4.2 配置读写分离

```sql
-- 连接管理端口（6032）
mysql -u admin -padmin -h 127.0.0.1 -P 6032

-- 添加后端 MySQL 服务器
INSERT INTO mysql_servers (hostgroup_id, hostname, port, weight)
VALUES
  (10, '192.168.1.100', 3306, 1000),  -- 写组（主库）
  (20, '192.168.1.101', 3306, 1000),  -- 读组（从库1）
  (20, '192.168.1.102', 3306, 1000);  -- 读组（从库2）

-- 配置读写分离规则
INSERT INTO mysql_query_rules (rule_id, active, match_pattern, destination_hostgroup, apply)
VALUES
  (1, 1, '^SELECT .* FOR UPDATE$', 10, 1),    -- SELECT FOR UPDATE 走写组
  (2, 1, '^SELECT', 20, 1);                     -- 普通 SELECT 走读组

-- 添加监控用户
INSERT INTO mysql_users (username, password, default_hostgroup)
VALUES ('monitor', 'password', 10);

-- 加载配置
LOAD MYSQL SERVERS TO RUNTIME;
LOAD MYSQL QUERY RULES TO RUNTIME;
LOAD MYSQL USERS TO RUNTIME;
SAVE MYSQL SERVERS TO DISK;
SAVE MYSQL QUERY RULES TO DISK;
SAVE MYSQL USERS TO DISK;
```

***

## 五、连接池参数对比

| 参数 | HikariCP | Druid | PgBouncer |
|:-----|:---------|:------|:----------|
| **最大连接数** | `maximum-pool-size` | `max-active` | `max_client_conn` |
| **最小空闲** | `minimum-idle` | `min-idle` | `min_pool_size` |
| **获取连接超时** | `connection-timeout` | `max-wait` | `query_wait_timeout` |
| **连接空闲超时** | `idle-timeout` | `min-evictable-idle-time-millis` | `server_idle_timeout` |
| **连接最大存活** | `max-lifetime` | `maxEvictableIdleTimeMillis` | 无直接配置 |
| **连接验证** | `connection-test-query` | `validation-query` | 自动检查 |
| **泄漏检测** | `leak-detection-threshold` | `removeAbandoned` | 无（简单架构） |

***

## 六、选型建议

```
Java 项目（MySQL）：
├─ 小中型项目 → HikariCP（Spring Boot 默认，性能好，配置简单）
└─ 需要 SQL 监控 → Druid（自带监控面板，防 SQL 注入）

Java 项目（PostgreSQL）：
└─ HikariCP（通用推荐）

非 Java 项目（PostgreSQL）：
└─ PgBouncer（C 语言编写，极致轻量，推荐）

读写分离需求（MySQL）：
└─ ProxySQL（功能丰富，社区活跃）

读写分离需求（PostgreSQL）：
├─ PgBouncer + HAProxy（基础方案）
└─ PgPool-II（功能更完整）
```

***
