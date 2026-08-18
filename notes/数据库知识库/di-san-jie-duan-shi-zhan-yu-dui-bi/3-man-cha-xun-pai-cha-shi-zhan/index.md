---
url: >-
  /my_notes/notes/数据库知识库/di-san-jie-duan-shi-zhan-yu-dui-bi/3-man-cha-xun-pai-cha-shi-zhan/index.md
---
# 慢查询排查实战

## 一、MySQL 慢查询排查流程

### 1.1 排查流程图

```
慢查询发现
├── 慢查询日志（slow_query_log）
├── 监控系统告警（PMM / Prometheus）
└── 应用层响应超时
        ↓
EXPLAIN 分析执行计划
├── type = ALL（全表扫描）？
├── key = NULL（未使用索引）？
├── rows 很大（扫描行数过多）？
├── Extra 有 Using filesort / Using temporary？
└── 预估行数与实际行数偏差大？
        ↓
确定优化方向
├── 添加合适索引
├── SQL 改写
├── 优化表结构（反范式/冗余）
└── 调整 MySQL 参数
        ↓
验证优化效果
├── EXPLAIN 重新分析
├── 对比优化前后 Query_time
└── 压力测试验证
```

### 1.2 实战案例一：全表扫描优化

**问题 SQL**：

```sql
-- 慢查询日志显示耗时 3.2 秒
SELECT * FROM orders
WHERE user_id = 10086 AND status = 'paid'
ORDER BY created_at DESC
LIMIT 20;
```

**EXPLAIN 分析**：

```
+----+-------------+--------+------+---------------+------+---------+------+--------+-----------------------+
| id | select_type | table  | type | possible_keys | key  | key_len | rows | filtered | Extra               |
+----+-------------+--------+------+---------------+------+---------+------+--------+-----------------------+
|  1 | SIMPLE      | orders | ALL  | NULL          | NULL | NULL    | 1000000 | 10.00 | Using where; Using filesort |
+----+-------------+--------+------+---------------+------+---------+------+--------+-----------------------+
```

**诊断**：`type=ALL` 全表扫描 100 万行，`key=NULL` 没有使用索引。

**解决方案**：

```sql
-- 创建联合索引（等值条件在前，排序列在后）
CREATE INDEX idx_orders_user_status_date ON orders (user_id, status, created_at DESC);

-- 优化后 EXPLAIN
-- type: ref, key: idx_orders_user_status_date, rows: 20
-- 执行时间：3.2s → 0.01s
```

### 1.3 实战案例二：子查询优化

**问题 SQL**：

```sql
SELECT * FROM users
WHERE id IN (SELECT user_id FROM orders WHERE total > 500)
AND status = 'active';
```

**EXPLAIN 分析**：子查询执行了全表扫描 orders，外层每个结果还要回查 users。

**解决方案**：

```sql
-- 改写为 JOIN（利用索引）
SELECT DISTINCT u.*
FROM users u
INNER JOIN orders o ON u.id = o.user_id
WHERE o.total > 500 AND u.status = 'active';

-- 或使用 EXISTS
SELECT * FROM users u
WHERE u.status = 'active'
AND EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.total > 500);
```

### 1.4 实战案例三：大偏移分页优化

**问题 SQL**：

```sql
-- 第 100001-100020 条（OFFSET 越大越慢）
SELECT * FROM orders ORDER BY id LIMIT 20 OFFSET 1000000;
-- 耗时 1.5 秒
```

**解决方案**：

```sql
-- 方案一：书签法（需记录上次最大 id）
SELECT * FROM orders WHERE id > 1000000 ORDER BY id LIMIT 20;

-- 方案二：延迟关联
SELECT o.* FROM orders o
INNER JOIN (SELECT id FROM orders ORDER BY id LIMIT 20 OFFSET 1000000) t
ON o.id = t.id;
-- 耗时：1.5s → 0.05s
```

***

## 二、PostgreSQL 慢查询排查流程

### 2.1 排查流程

```
慢查询发现
├── log_min_duration_statement（自动记录）
├── pg_stat_statements（统计分析）
├── pgBadger（日志分析报告）
└── 应用层响应超时
        ↓
EXPLAIN (ANALYZE, BUFFERS) 分析
├── Seq Scan（顺序扫描）？是否合理？
├── 估算行数 vs 实际行数偏差大？（统计信息过期）
├── Buffers: shared read 多不多？
├── 有 Sort 节点？能否用索引消除？
└── 内存使用是否超出 work_mem？
        ↓
确定优化方向
├── 添加合适索引
├── ANALYZE 更新统计信息
├── 调整 work_mem / effective_cache_size
└── SQL 改写
```

### 2.2 实战案例一：统计信息过期

**问题**：查询很慢，EXPLAIN 显示估算行数与实际行数偏差很大。

```sql
EXPLAIN ANALYZE SELECT * FROM logs WHERE created_at > '2026-08-01';
-- 估算 rows: 1000，实际 rows: 5000000（偏差 5000 倍）
```

**原因**：表经过大量数据变更后，统计信息过期，优化器选择了错误的执行计划。

**解决方案**：

```sql
-- 更新统计信息
ANALYZE logs;

-- 重新 EXPLAIN，估算行数更准确
EXPLAIN ANALYZE SELECT * FROM logs WHERE created_at > '2026-08-01';
-- 估算 rows: 4800000，实际 rows: 5000000（偏差 < 5%）
```

### 2.3 实战案例二：缺少 GIN 索引

**问题 SQL**：

```sql
-- 查询 JSONB 字段，全表扫描
SELECT * FROM events WHERE data @> '{"type": "click"}';
-- 耗时 8 秒（表有 2000 万行）
```

**解决方案**：

```sql
-- 添加 GIN 索引
CREATE INDEX idx_events_data ON events USING gin (data jsonb_path_ops);

-- 重新查询
-- 耗时：8s → 0.05s
```

### 2.4 实战案例三：连接数耗尽

**问题**：应用报错 `remaining connection slots are reserved`

```sql
-- 查看当前连接数
SELECT count(*) FROM pg_stat_activity;  -- 结果：198（max_connections=200）

-- 查看连接状态分布
SELECT state, COUNT(*) FROM pg_stat_activity GROUP BY state;
-- active: 5
-- idle: 180
-- idle in transaction: 13
```

**解决方案**：

```sql
-- 1. 清理长时间空闲事务
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND state_change < NOW() - INTERVAL '10 minutes';

-- 2. 部署 PgBouncer 连接池（根本解决）
-- 3. 设置 idle_in_transaction_session_timeout
ALTER SYSTEM SET idle_in_transaction_session_timeout = '5min';
SELECT pg_reload_conf();
```

***

## 三、锁等待排查实战

### 3.1 MySQL 锁等待

```sql
-- 查看当前锁等待
SELECT
  r.trx_id AS waiting_trx,
  r.trx_query AS waiting_query,
  b.trx_id AS blocking_trx,
  b.trx_query AS blocking_query,
  TIMESTAMPDIFF(SECOND, b.trx_wait_started, NOW()) AS wait_seconds
FROM information_schema.INNODB_LOCK_WAITS w
JOIN information_schema.INNODB_TRX b ON b.trx_id = w.blocking_trx_id
JOIN information_schema.INNODB_TRX r ON r.trx_id = w.requesting_trx_id;

-- 解决方案
-- 1. Kill 阻塞事务
KILL <blocking_trx_id>;
-- 2. 优化事务范围，减少锁持有时间
-- 3. 统一加锁顺序（避免死锁）
```

### 3.2 PostgreSQL 锁等待

```sql
-- 查看锁等待
SELECT
  blocked.pid AS blocked_pid,
  blocked.query AS blocked_query,
  blocking.pid AS blocking_pid,
  blocking.query AS blocking_query,
  AGE(NOW(), blocked.query_start) AS waiting_duration
FROM pg_stat_activity blocked
JOIN pg_locks bl ON bl.pid = blocked.pid AND NOT bl.granted
JOIN pg_locks gl ON gl.locktype = bl.locktype
  AND gl.relation IS NOT DISTINCT FROM bl.relation
  AND gl.pid != bl.pid AND gl.granted
JOIN pg_stat_activity blocking ON gl.pid = blocking.pid;

-- 解决方案
SELECT pg_cancel_backend(<blocked_pid>);      -- 温和取消
SELECT pg_terminate_backend(<blocking_pid>);   -- 强制终止阻塞源
```

***

## 四、排查工具速查

| 工具 | 用途 | 适用数据库 |
|:-----|:-----|:-----------|
| `EXPLAIN` | 查看执行计划 | MySQL + PostgreSQL |
| `EXPLAIN ANALYZE` | 实际执行并显示耗时 | PostgreSQL |
| `pt-query-digest` | 慢查询日志分析 | MySQL |
| `pgBadger` | 慢查询日志分析 | PostgreSQL |
| `pg_stat_statements` | SQL 统计信息 | PostgreSQL |
| `SHOW ENGINE INNODB STATUS` | InnoDB 锁和事务信息 | MySQL |
| `performance_schema.data_locks` | 锁信息 | MySQL 8.0+ |
| `pg_locks` | 锁信息 | PostgreSQL |
| `SHOW PROCESSLIST` / `pg_stat_activity` | 当前连接和查询 | MySQL / PostgreSQL |

***

## 五、优化前后对比模板

| 指标 | 优化前 | 优化后 |
|:-----|:-------|:-------|
| SQL 语句 | `SELECT ...` | `SELECT ...`（改写后） |
| EXPLAIN type | ALL | ref |
| EXPLAIN rows | 1000000 | 20 |
| 执行时间 | 3.2s | 0.01s |
| 磁盘读取 | 15000 pages | 20 pages |
| 优化措施 | - | 添加 idx\_xxx 联合索引 |

***
