---
url: >-
  /my_notes/notes/数据库知识库/di-er-jie-duan-postgre-sql-he-xin/3-suo-yin-yu-cha-xun-you-hua/index.md
---
# 索引与查询优化

## 一、PostgreSQL 索引类型概览

PostgreSQL 支持多种索引类型，远比 MySQL 丰富，不同索引适用于不同查询场景：

| 索引类型 | 适用场景 | 底层数据结构 |
|:---------|:---------|:-------------|
| **B-tree** | 等值查询、范围查询、排序（默认，最常用） | B+ 树 |
| **Hash** | 仅等值查询（PG 10+ WAL 支持，可恢复） | 哈希表 |
| **GiST** | 几何/地理数据、全文搜索、范围类型 | 平衡树 |
| **GIN** | 数组、JSONB、全文搜索、模糊匹配 | 倒排索引 |
| **BRIN** | 物理顺序与逻辑顺序相关的大表（如时间序列） | 块范围索引 |
| **SP-GiST** | 不平衡数据（如电话号码前缀、IP 地址） | 空间分区 |
| **bloom** | 多列等值查询的组合过滤 | 布隆过滤器 |

***

## 二、B-tree 索引

### 2.1 创建与使用

```sql
-- 单列索引
CREATE INDEX idx_users_email ON users (email);

-- 唯一索引
CREATE UNIQUE INDEX idx_users_username ON users (username);

-- 联合索引
CREATE INDEX idx_orders_status_date ON orders (status, created_at);

-- 降序索引
CREATE INDEX idx_orders_created ON orders (created_at DESC);

-- 带 NULLS 的索引（NULL 值排最后）
CREATE INDEX idx_users_phone ON users (phone) NULLS LAST;
```

### 2.2 B-tree 支持的操作符

`=`, `<`, `>`, `<=`, `>=`, `<>`, `BETWEEN`, `IN`, `IS NULL`, `IS NOT NULL`, `LIKE 'prefix%'`, `||`（前缀拼接）

***

## 三、GIN 索引（广义倒排索引）

GIN 是 PostgreSQL 最强大的索引类型之一，适合"包含"类查询：

### 3.1 JSONB 索引

```sql
-- 为 JSONB 列创建 GIN 索引
CREATE INDEX idx_events_data ON events USING gin (data);

-- 查询：包含特定键值
SELECT * FROM events WHERE data @> '{"type": "click"}';

-- 查询：包含特定路径值
SELECT * FROM events WHERE data @? '$.type == "click"';
```

### 3.2 数组索引

```sql
CREATE INDEX idx_articles_tags ON articles USING gin (tags);

-- 查询包含特定标签的文章
SELECT * FROM articles WHERE tags @> ARRAY['postgresql'];
```

### 3.3 全文搜索索引

```sql
-- 为全文搜索向量创建 GIN 索引
CREATE INDEX idx_articles_search ON articles USING gin (
  to_tsvector('english', title || ' ' || content)
);

-- 查询
SELECT * FROM articles
WHERE to_tsvector('english', title || ' ' || content) @@ to_tsquery('english', 'postgresql & tutorial');
```

***

## 四、BRIN 索引（块范围索引）

BRIN 索引非常小，适合物理有序的大表（如按时间插入的日志表）：

```sql
-- 创建 BRIN 索引（索引大小极小）
CREATE INDEX idx_logs_created ON logs USING brin (created_at);

-- BRIN 索引大小对比（1000 万行日志表）
-- B-tree: ~300MB
-- BRIN:   ~150KB（约 B-tree 的 1/2000）

-- 适用条件：数据的物理存储顺序与索引列值基本一致
-- 典型场景：时间序列数据（按时间顺序插入）
-- 不适用：频繁 UPDATE 导致物理顺序混乱的表
```

***

## 五、部分索引（Partial Index）

只索引满足条件的行，减少索引大小：

```sql
-- 只为活跃用户建立索引
CREATE INDEX idx_active_users ON users (email) WHERE status = 'active';
-- 查询必须包含 WHERE status = 'active' 才能使用此索引

-- 只为未处理的订单建索引
CREATE INDEX idx_pending_orders ON orders (created_at)
WHERE status = 'pending';

-- 好处：
-- 1. 索引更小，占用更少磁盘和内存
-- 2. 维护成本更低（插入/更新时维护更少条目）
-- 3. 查询更快（索引更紧凑）
```

***

## 六、表达式索引（函数索引）

```sql
-- 为函数计算结果建索引
CREATE INDEX idx_users_lower_email ON users (lower(email));
-- 查询时必须用相同的表达式才能命中索引
SELECT * FROM users WHERE lower(email) = 'test@example.com';

-- 日期截断索引
CREATE INDEX idx_orders_date ON orders (date_trunc('day', created_at));
SELECT * FROM orders WHERE date_trunc('day', created_at) = '2026-08-18'::date;

-- COALESCE 索引（处理 NULL）
CREATE INDEX idx_users_nickname ON users (COALESCE(nickname, username));
```

***

## 七、EXPLAIN (ANALYZE, BUFFERS) 深入解读

### 7.1 输出格式

```
Hash Join  (cost=1250.00..2500.00 rows=10000 width=48) (actual time=15.234..30.123 rows=10000 loops=1)
  Hash Cond: (u.id = o.user_id)
  Buffers: shared hit=500 read=200
  ->  Seq Scan on users u  (cost=0.00..150.00 rows=1000 width=24) (actual time=0.012..0.543 rows=1000 loops=1)
        Filter: (status = 'active')
        Rows Removed by Filter: 500
        Buffers: shared hit=100
  ->  Hash  (cost=800.00..800.00 rows=50000 width=24) (actual time=14.567..14.568 rows=50000 loops=1)
        Buckets: 65536  Batches: 1  Memory Usage: 3072kB
        Buffers: shared hit=400 read=200
        ->  Seq Scan on orders o  (cost=0.00..800.00 rows=50000 width=24) (actual time=0.008..8.234 rows=50000 loops=1)
              Buffers: shared hit=400 read=200
Planning Time: 0.234 ms
Execution Time: 32.456 ms
```

### 7.2 关键指标

| 指标 | 含义 | 关注点 |
|:-----|:-----|:-------|
| `actual time` | 实际执行时间（毫秒） | 越小越好 |
| `rows` | 实际返回行数 | 与 cost 中估算行数对比，偏差大说明统计信息不准 |
| `Buffers: shared hit` | 缓冲区命中（内存读取） | 越多越好 |
| `Buffers: shared read` | 磁盘读取 | 越少越好（可用 `shared_buffers` 或增大缓存） |
| `Rows Removed by Filter` | 被过滤掉的行数 | 越少越好，说明索引过滤有效 |
| `Memory Usage` | 操作符内存消耗 | work\_mem 不足会触发磁盘临时文件 |

### 7.3 常见查询计划节点

| 节点类型 | 说明 | 何时出现 |
|:---------|:-----|:---------|
| `Seq Scan` | 顺序扫描全表 | 无可用索引或小表 |
| `Index Scan` | 索引扫描 + 回表 | 索引命中但需要额外列 |
| `Index Only Scan` | 仅索引扫描 | 覆盖索引（所需列全在索引中） |
| `Bitmap Index Scan` | 位图索引扫描 | 多条件过滤，先收集匹配行位置 |
| `Bitmap Heap Scan` | 位图堆扫描 | 配合 Bitmap Index Scan 取数据 |
| `Hash Join` | 哈希连接 | 两个表 JOIN，小表建哈希表 |
| `Merge Join` | 合并连接 | 两个表已排序 |
| `Nested Loop` | 嵌套循环 | 一个表很小（或有索引） |
| `Sort` | 排序操作 | ORDER BY 无法利用索引 |
| `HashAggregate` | 哈希聚合 | GROUP BY |

***

## 八、索引优化实践建议

### 8.1 索引管理命令

```sql
-- 查看表的索引
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'users';

-- 查看索引大小
SELECT
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size
FROM pg_indexes
WHERE tablename = 'users';

-- 查看未使用的索引（PG 12+）
SELECT
  indexrelname AS index_name,
  idx_scan AS times_used,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND indexrelname NOT LIKE '%pkey%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- 删除未使用的索引
DROP INDEX idx_unused;
```

### 8.2 统计信息更新

```sql
-- 更新表的统计信息（优化器依赖这些信息选择执行计划）
ANALYZE users;

-- 更新全部表
ANALYZE;

-- 查看统计信息
SELECT
  attname,
  n_distinct,    -- 不同值的数量（-1 表示唯一）
  most_common_vals,  -- 最常见值
  correlation    -- 物理相关性（接近 1 或 -1 说明有序）
FROM pg_stats
WHERE tablename = 'users';
```

### 8.3 EXPLAIN 检查清单

```
□ Seq Scan 是否合理（小表可接受，大表需检查）
□ 索引是否被使用（Index Scan / Index Only Scan）
□ 行数估算是否准确（actual rows vs cost rows）
□ 是否有 Sort 节点（可以用索引避免排序）
□ Buffers: shared read 大不大（增大 shared_buffers）
□ HashAggregate 内存是否超出 work_mem（会用临时文件）
□ JOIN 方式是否合理（小表应该用 Hash Join 或 Nested Loop）
```

***
