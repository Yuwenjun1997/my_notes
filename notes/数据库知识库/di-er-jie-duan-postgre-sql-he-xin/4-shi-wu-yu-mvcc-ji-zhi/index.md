---
url: >-
  /my_notes/notes/数据库知识库/di-er-jie-duan-postgre-sql-he-xin/4-shi-wu-yu-mvcc-ji-zhi/index.md
---
# 事务与 MVCC 机制

## 一、PostgreSQL MVCC 实现原理

PostgreSQL 与 MySQL 的 MVCC 实现方式有本质区别：

| 特性 | MySQL InnoDB | PostgreSQL |
|:-----|:-------------|:-----------|
| 版本存储位置 | Undo Log（独立空间） | **行内**（与数据行同存） |
| 版本清理 | 由 purge 线程异步清理 | 由 **VACUUM** 进程清理 |
| 旧版本可见性 | 通过 Undo Log 读取 | 直接在表中读取（可能跳过不可见版本） |
| 表膨胀 | 由 Undo Log 空间管理 | 由 dead tuple 堆积导致 |

### 1.1 隐藏系统列

PostgreSQL 每行数据都有两个隐藏列：

```sql
-- xmin：创建该行版本的事务 ID（INSERT 或 UPDATE 时设置）
-- xmax：删除或更新该行版本的事务 ID（0 表示未删除/更新）

-- 查看隐藏列
SELECT xmin, xmax, * FROM users WHERE id = 1;
```

**写操作的 MVCC 行为**：

```
INSERT：
  设置 xmin = 当前事务 ID，xmax = 0

UPDATE（PostgreSQL 是"先标记删除 + 再插入新行"）：
  1. 将旧行的 xmax = 当前事务 ID（标记为"已删除"）
  2. 插入新行，xmin = 当前事务 ID，xmax = 0

DELETE：
  将行的 xmax = 当前事务 ID（标记为"已删除"，但不物理删除）
```

### 1.2 事务快照与可见性

```sql
-- 事务开始时获得一个快照（Snapshot），包含：
-- 1. 当前活跃（未提交）的事务 ID 列表
-- 2. 最小活跃事务 ID
-- 3. 下一个将分配的事务 ID

-- 可见性判断：
-- 行的 xmin 已提交 且 < 快照的下一个事务 ID → 版本可见
-- 行的 xmax 为 0 或未提交 → 该版本未被删除
```

**RC vs RR 的区别**：

* **READ COMMITTED**：每条 SQL 语句开始时获取新快照
* **REPEATABLE READ / SERIALIZABLE**：事务开始时获取快照，整个事务期间复用

***

## 二、VACUUM 机制

### 2.1 为什么需要 VACUUM

PostgreSQL 的 UPDATE/DELETE 不会物理删除旧行，而是标记为"dead tuple"。VACUUM 负责清理这些死元组并回收空间：

```
未清理的表：
[活数据] [dead] [活数据] [dead] [dead] [活数据] [dead] ...

VACUUM 后：
[活数据] [活数据] [活数据] [空闲空间] [空闲空间] ...
  ↑ 空闲空间被标记为可复用（但不归还操作系统）
```

### 2.2 VACUUM 类型

| 类型 | 命令 | 说明 |
|:-----|:-----|:-----|
| **普通 VACUUM** | `VACUUM tablename;` | 回收 dead tuple 空间供表内复用，**不锁表** |
| **VACUUM FULL** | `VACUUM FULL tablename;` | 重写整张表，空间归还操作系统，**会锁表** |
| **ANALYZE** | `ANALYZE tablename;` | 更新统计信息供优化器使用 |
| **VACUUM ANALYZE** | `VACUUM ANALYZE tablename;` | VACUUM + ANALYZE 组合 |

### 2.3 Autovacuum（自动清理）

PostgreSQL 默认开启 Autovacuum：

```sql
-- 查看 Autovacuum 配置
SHOW autovacuum;
SHOW autovacuum_vacuum_threshold;    -- dead tuple 数量阈值（默认 50）
SHOW autovacuum_vacuum_scale_factor; -- dead tuple 比例阈值（默认 0.2）
SHOW autovacuum_analyze_threshold;   -- 行变化阈值（默认 50）
SHOW autovacuum_max_workers;         -- 最大并行清理数（默认 3）

-- 调整（针对大表可以单独设置）
ALTER TABLE big_logs SET (
  autovacuum_vacuum_scale_factor = 0.01,  -- 1% 行变化就触发清理
  autovacuum_analyze_scale_factor = 0.005
);

-- 查看表的统计信息
SELECT
  relname,
  n_live_tup,       -- 活行数
  n_dead_tup,       -- 死元组数
  last_vacuum,      -- 上次手动 VACUUM 时间
  last_autovacuum,  -- 上次自动 VACUUM 时间
  last_analyze
FROM pg_stat_user_tables
WHERE relname = 'users';
```

### 2.4 事务 ID 回卷防护

PostgreSQL 事务 ID（XID）是 32 位无符号整数，约 42 亿后会回卷。VACUUM 负责冻结旧事务 ID 防止回卷：

```sql
-- 查看数据库的事务 ID 消耗情况
SELECT
  datname,
  age(datfrozenxid) AS xid_age,
  2^31 - age(datfrozenxid) AS remaining_xids
FROM pg_database
WHERE datname = current_database();

-- 如果 remaining_xids 很小（< 1 亿），需要紧急 VACUUM FREEZE
VACUUM FREEZE tablename;
```

***

## 三、事务隔离级别

### 3.1 四种隔离级别

| 隔离级别 | 脏读 | 不可重复读 | 幻读 | Serialization Anomaly |
|:---------|:----:|:----------:|:----:|:---------------------|
| **READ UNCOMMITTED** | ❌ 不可能 | ✅ 可能 | ✅ 可能 | ✅ 可能 |
| **READ COMMITTED**（默认） | ❌ 不可能 | ✅ 可能 | ✅ 可能 | ✅ 可能 |
| **REPEATABLE READ** | ❌ 不可能 | ❌ 不可能 | ✅ 可能 | ✅ 可能 |
| **SERIALIZABLE** | ❌ 不可能 | ❌ 不可能 | ❌ 不可能 | ❌ 不可能 |

> **关键区别**：PostgreSQL 的 REPEATABLE READ **不解决幻读**（与 MySQL 不同），需要 SERIALIZABLE 才能完全隔离。

### 3.2 设置隔离级别

```sql
-- 设置当前事务的隔离级别
BEGIN ISOLATION LEVEL REPEATABLE READ;
-- 或
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- 设置会话级别
SET default_transaction_isolation = 'repeatable read';

-- 设置全局默认
ALTER SYSTEM SET default_transaction_isolation = 'read committed';
SELECT pg_reload_conf();
```

### 3.3 可序列化事务（SSI）

PostgreSQL 的 SERIALIZABLE 实现使用 **Serializable Snapshot Isolation（SSI）**，基于快照隔离检测读写冲突：

```sql
-- SSI 不使用锁来保证可序列化，而是检测危险结构：
-- 1. 读-写依赖链（rw dependency）
-- 2. 与读-写依赖链相关的写-读依赖链（ rw->wr conflict）

-- 当检测到可能导致非序列化结果的依赖时，回滚其中一个事务
-- 错误信息：ERROR: could not serialize access due to read/write dependencies

-- 应用需要处理序列化失败
BEGIN ISOLATION LEVEL SERIALIZABLE;
-- 执行 SQL ...
COMMIT;  -- 可能失败，需要重试
```

***

## 四、锁机制

### 4.1 锁类型

| 锁类型 | 说明 |
|:-------|:-----|
| **表级锁** | `ACCESS SHARE`（SELECT）→ `ROW EXCLUSIVE`（UPDATE/DELETE）→ `ACCESS EXCLUSIVE`（DDL） |
| **行级锁** | `FOR UPDATE`（排他）/ `FOR SHARE`（共享）/ `FOR NO KEY UPDATE` |
| **咨询锁** | `pg_advisory_lock()`，应用层自定义锁，用于协调分布式任务 |

### 4.2 行锁用法

```sql
-- SELECT ... FOR UPDATE（排他锁，其他事务不能修改/删除该行）
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;

-- SELECT ... FOR SHARE（共享锁，其他事务可以读但不能修改）
SELECT * FROM accounts WHERE id = 1 FOR SHARE;

-- SELECT ... FOR NO KEY UPDATE（弱排他锁，不阻止获取 KEY 权限）
-- 用于不需要完全锁定行的场景
SELECT * FROM users WHERE id = 1 FOR NO KEY UPDATE;

-- 超时设置（避免无限等待）
BEGIN;
SET lock_timeout = '5s';  -- 等待 5 秒后超时
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;
```

### 4.3 查看锁信息

```sql
-- 查看当前锁
SELECT
  l.locktype,
  l.relation::regclass AS table_name,
  l.pid,
  l.mode,
  l.granted,
  a.query
FROM pg_locks l
JOIN pg_stat_activity a ON l.pid = a.pid
WHERE l.relation = 'users'::regclass;

-- 查看锁等待
SELECT
  blocked.pid AS blocked_pid,
  blocked.query AS blocked_query,
  blocking.pid AS blocking_pid,
  blocking.query AS blocking_query
FROM pg_stat_activity blocked
JOIN pg_locks bl ON bl.pid = blocked.pid AND NOT bl.granted
JOIN pg_locks gl ON gl.locktype = bl.locktype
  AND gl.database IS NOT DISTINCT FROM bl.database
  AND gl.relation IS NOT DISTINCT FROM bl.relation
  AND gl.page IS NOT DISTINCT FROM bl.page
  AND gl.tuple IS NOT DISTINCT FROM bl.tuple
  AND gl.transactionid IS NOT DISTINCT FROM bl.transactionid
  AND gl.pid != bl.pid
  AND gl.granted
JOIN pg_stat_activity blocking ON gl.pid = blocking.pid;

-- 取消阻塞查询
SELECT pg_cancel_backend(<blocked_pid>);     -- 温和取消
SELECT pg_terminate_backend(<blocked_pid>);  -- 强制终止
```

***

## 五、dead tuple 与表膨胀

### 5.1 表膨胀原因

```sql
-- 频繁 UPDATE 会产生大量 dead tuple
-- 如果 VACUUM 不及时，表会膨胀：
-- 1. 磁盘空间浪费
-- 2. 顺序扫描变慢（需要扫描更多页）
-- 3. 索引效率降低

-- 监控表膨胀
SELECT
  relname,
  pg_size_pretty(pg_relation_size(relid)) AS table_size,
  n_live_tup,
  n_dead_tup,
  ROUND(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_pct
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
```

### 5.2 处理表膨胀

```sql
-- 1. 普通 VACUUM（回收空间供表内复用）
VACUUM VERBOSE users;

-- 2. VACUUM FULL（需要排他锁，重写整张表）
VACUUM FULL users;
-- 注意：VACUUM FULL 会锁表，生产环境慎用

-- 3. pg_repack（在线重建索引，不需要锁表）
-- 需要安装 pg_repack 扩展
pg_repack -d mydb -t users;

-- 4. 预防：合理配置 Autovacuum
ALTER TABLE users SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_cost_delay = 2  -- 降低清理延迟，更积极清理
);
```

***

## 六、MySQL vs PostgreSQL 事务对比

| 特性 | MySQL InnoDB | PostgreSQL |
|:-----|:-------------|:-----------|
| 默认隔离级别 | REPEATABLE READ | READ COMMITTED |
| MVCC 实现 | Undo Log（独立存储） | 行内 xmin/xmax |
| 清理机制 | purge 线程自动清理 Undo Log | VACUUM（手动/自动） |
| RR 下幻读 | 通过 Next-Key Lock 部分解决 | 未解决（需 SERIALIZABLE） |
| 锁粒度 | 行锁/间隙锁/临键锁 | 行锁/表锁（无间隙锁） |
| 序列化隔离 | 未原生支持（需应用层处理） | SSI（原生支持，自动检测冲突） |
| 咨询锁 | 不支持 | `pg_advisory_lock()` |

***
