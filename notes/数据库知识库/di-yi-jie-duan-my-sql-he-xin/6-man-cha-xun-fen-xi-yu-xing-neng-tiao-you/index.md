---
url: >-
  /my_notes/notes/数据库知识库/di-yi-jie-duan-my-sql-he-xin/6-man-cha-xun-fen-xi-yu-xing-neng-tiao-you/index.md
---
# 慢查询分析与性能调优

## 一、慢查询日志

### 1.1 配置慢查询日志

```sql
-- 查看慢查询配置
SHOW VARIABLES LIKE 'slow_query%';
SHOW VARIABLES LIKE 'long_query_time';

-- 开启慢查询日志（临时，重启失效）
SET GLOBAL slow_query_log = ON;
SET GLOBAL slow_query_log_file = '/var/log/mysql/slow.log';
SET GLOBAL long_query_time = 1;  -- 超过 1 秒记录为慢查询

-- 开启所有查询记录（用于调试，生产慎用）
SET GLOBAL log_queries_not_using_indexes = ON;
```

**永久配置（my.cnf）**：

```ini
[mysqld]
slow_query_log = ON
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 1
log_queries_not_using_indexes = ON
min_examined_row_limit = 100  # 扫描超过 100 行才记录（避免记录小表全表扫描）
```

### 1.2 慢查询日志格式

```sql
# Time: 2026-08-18T10:30:00.000000Z
# User@Host: root[root] @ localhost []  Id:   123
# Query_time: 2.500123  Lock_time: 0.000321  Rows_sent: 100  Rows_examined: 1000000
SET timestamp=1723977000;
SELECT * FROM orders WHERE created_at > '2025-01-01' AND status = 'pending';
```

***

## 二、慢查询分析工具

### 2.1 mysqldumpslow（MySQL 自带）

```bash
# 按执行时间排序，显示前 10 条
mysqldumpslow -s t -t 10 /var/log/mysql/slow.log

# 按出现次数排序
mysqldumpslow -s c -t 10 /var/log/mysql/slow.log

# 按锁等待时间排序
mysqldumpslow -s l -t 10 /var/log/mysql/slow.log

# -s 排序方式：t=时间, c=次数, l=锁等待, r=返回行数, at=平均时间
# -t 显示条数
# -a 不将数字替换为 N（显示具体值）
```

### 2.2 pt-query-digest（Percona Toolkit，推荐）

```bash
# 分析慢查询日志（输出最全面）
pt-query-digest /var/log/mysql/slow.log > /tmp/slow_report.txt

# 只分析最近 1 小时的慢查询
pt-query-digest --since '1h' /var/log/mysql/slow.log

# 按平均响应时间排序，显示前 20 条
pt-query-digest --limit 20 /var/log/mysql/slow.log

# 分析指定时间段
pt-query-digest --since '2026-08-18 09:00:00' --until '2026-08-18 10:00:00' /var/log/mysql/slow.log
```

**pt-query-digest 输出解读**：

```
# Profile
# Rank Query ID           Response time  Calls  R/Call  V/M
# ==== ================== ============== ====== ======= =====
#    1 0xABC123...        1250.0000 50.2%    100 12.5000  0.00
#    2 0xDEF456...         500.0000 20.1%    500  1.0000  0.00

# 每条 SQL 的详细分析：
# - Response time: 总响应时间和占比
# - Calls: 执行次数
# - R/Call: 平均每次执行时间
# - V/M: 方差/均值（越大说明执行时间波动越大）
```

***

## 三、全局参数调优

### 3.1 Buffer Pool 调优

```ini
[mysqld]
# Buffer Pool 大小（建议物理内存的 50%-70%，专用数据库服务器）
innodb_buffer_pool_size = 4G

# Buffer Pool 实例数（>1G 时建议多个，减少锁竞争）
innodb_buffer_pool_instances = 4

# Buffer Pool 预热（重启后自动加载热数据）
innodb_buffer_pool_dump_at_shutdown = ON
innodb_buffer_pool_load_at_startup = ON
```

### 3.2 Redo Log 调优

```ini
[mysqld]
# Redo Log 文件大小（写入密集型场景增大）
innodb_log_file_size = 1G

# Redo Log 文件数量
innodb_log_files_in_group = 2

# Redo Log 缓冲区
innodb_log_buffer_size = 64M

# 刷盘策略（安全 vs 性能权衡）
innodb_flush_log_at_trx_commit = 1  # 1=最安全 2=性能优先
sync_binlog = 1                      # 1=最安全 0=性能优先
```

### 3.3 连接与线程配置

```ini
[mysqld]
# 最大连接数（根据业务并发量调整）
max_connections = 500

# 每个连接的线程缓存（减少线程创建开销）
thread_cache_size = 64

# 表缓存（减少文件描述符打开关闭）
table_open_cache = 4000
table_open_cache_instances = 16
```

### 3.4 临时表与排序

```ini
[mysqld]
# 内存临时表大小（超过后写磁盘）
tmp_table_size = 64M
max_heap_table_size = 64M

# 排序缓冲区（每个连接独立分配）
sort_buffer_size = 4M

# JOIN 缓冲区
join_buffer_size = 4M

# 读缓冲区
read_buffer_size = 2M
read_rnd_buffer_size = 8M
```

> **注意**：`sort_buffer_size`、`join_buffer_size` 等是**每连接独立分配**的，设置过大在高并发时会消耗大量内存。

***

## 四、SQL 重写技巧

### 4.1 避免 SELECT \*

```sql
-- ❌ 不推荐
SELECT * FROM users WHERE id = 1;

-- ✅ 只查需要的列（可能命中覆盖索引）
SELECT id, username, email FROM users WHERE id = 1;
```

### 4.2 分页查询优化

```sql
-- ❌ 大偏移量分页
SELECT * FROM orders ORDER BY id LIMIT 1000000, 20;

-- ✅ 基于游标的分页（记住上次最大 id）
SELECT * FROM orders WHERE id > 1000000 ORDER BY id LIMIT 20;

-- ✅ 延迟关联
SELECT o.* FROM orders o
INNER JOIN (SELECT id FROM orders ORDER BY id LIMIT 1000000, 20) t
ON o.id = t.id;
```

### 4.3 批量操作优化

```sql
-- ❌ 逐条插入
INSERT INTO users (name, email) VALUES ('a', 'a@x.com');
INSERT INTO users (name, email) VALUES ('b', 'b@x.com');
INSERT INTO users (name, email) VALUES ('c', 'c@x.com');

-- ✅ 批量插入（一次提交，减少网络往返和事务开销）
INSERT INTO users (name, email) VALUES
  ('a', 'a@x.com'),
  ('b', 'b@x.com'),
  ('c', 'c@x.com');

-- ✅ 大批量更新分批提交
-- 每次更新 1000 行，循环执行
UPDATE orders SET status = 'archived'
WHERE created_at < '2024-01-01' AND status != 'archived'
LIMIT 1000;
```

### 4.4 EXISTS vs IN 选择

```sql
-- IN 适合子查询结果集小的情况
SELECT * FROM users WHERE id IN (SELECT user_id FROM orders WHERE total > 500);

-- EXISTS 适合外表大、子查询结果集小的情况
SELECT * FROM users u WHERE EXISTS (
  SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.total > 500
);
```

### 4.5 UNION vs UNION ALL

```sql
-- UNION 会去重（有额外排序开销）
SELECT user_id FROM orders WHERE status = 'paid'
UNION
SELECT user_id FROM orders WHERE status = 'refunded';

-- UNION ALL 不去重（性能更好）
SELECT user_id FROM orders WHERE status = 'paid'
UNION ALL
SELECT user_id FROM orders WHERE status = 'refunded';
-- 如果确定没有重复，或者业务允许重复，优先用 UNION ALL
```

***

## 五、性能监控常用命令

```sql
-- 查看当前连接和运行的查询
SHOW FULL PROCESSLIST;

-- 查看 InnoDB 引擎状态
SHOW ENGINE INNODB STATUS;

-- 查看 Buffer Pool 命中率
SELECT
  (1 - Innodb_buffer_pool_reads / Innodb_buffer_pool_read_requests) * 100 AS hit_rate
FROM (
  SELECT
    VARIABLE_VALUE AS Innodb_buffer_pool_reads
  FROM performance_schema.global_status
  WHERE VARIABLE_NAME = 'Innodb_buffer_pool_reads'
) a, (
  SELECT
    VARIABLE_VALUE AS Innodb_buffer_pool_read_requests
  FROM performance_schema.global_status
  WHERE VARIABLE_NAME = 'Innodb_buffer_pool_read_requests'
) b;

-- 查看 QPS 和 TPS
SHOW GLOBAL STATUS LIKE 'Queries';
SHOW GLOBAL STATUS LIKE 'Com_commit';
SHOW GLOBAL STATUS LIKE 'Com_rollback';

-- 查看 InnoDB 行操作统计
SHOW GLOBAL STATUS LIKE 'Innodb_rows_%';
```

***
