---
url: >-
  /my_notes/notes/数据库知识库/di-yi-jie-duan-my-sql-he-xin/4-shi-wu-yu-suo-ji-zhi/index.md
---
# 事务与锁机制

## 一、事务基础

### 1.1 ACID 特性

| 特性 | 含义 | InnoDB 实现方式 |
|:-----|:-----|:----------------|
| **Atomicity**（原子性） | 事务要么全部成功，要么全部回滚 | Undo Log 实现回滚 |
| **Consistency**（一致性） | 事务前后数据库从一个一致状态到另一个一致状态 | 由其他三个特性共同保证 |
| **Isolation**（隔离性） | 并发事务之间互不干扰 | 锁 + MVCC 实现 |
| **Durability**（持久性） | 事务提交后数据永久保存 | Redo Log + DoubleWrite 实现 |

### 1.2 事务语法

```sql
-- 显式开启事务
START TRANSACTION;  -- 或 BEGIN;
-- 执行 SQL ...
COMMIT;             -- 提交
-- 或
ROLLBACK;           -- 回滚

-- 隐式提交的语句（执行后自动提交之前的事务）：
-- DDL（CREATE/ALTER/DROP）、LOCK TABLES、TRUNCATE 等

-- 查看当前事务状态
SELECT * FROM information_schema.INNODB_TRX;
```

***

## 二、事务隔离级别

### 2.1 四种隔离级别

| 隔离级别 | 脏读 | 不可重复读 | 幻读 | 说明 |
|:---------|:----:|:----------:|:----:|:-----|
| **READ UNCOMMITTED** | ✅ 可能 | ✅ 可能 | ✅ 可能 | 几乎不用，可读到未提交数据 |
| **READ COMMITTED**（RC） | ❌ 不可能 | ✅ 可能 | ✅ 可能 | Oracle 默认级别 |
| **REPEATABLE READ**（RR） | ❌ 不可能 | ❌ 不可能 | ⚠️ 部分解决 | **MySQL InnoDB 默认级别** |
| **SERIALIZABLE** | ❌ 不可能 | ❌ 不可能 | ❌ 不可能 | 串行执行，性能最差 |

### 2.2 各级别问题详解

**脏读**：读到其他事务未提交的数据

```sql
-- 事务 A：UPDATE users SET balance = 0 WHERE id = 1;（未 COMMIT）
-- 事务 B：SELECT balance FROM users WHERE id = 1; → 读到 0（脏数据）
-- 事务 A：ROLLBACK;  ← B 读到的是无效数据
```

**不可重复读**：同一事务内两次读取同一行，结果不同（被其他事务 UPDATE 了）

```sql
-- 事务 A：SELECT balance FROM users WHERE id = 1; → 100
-- 事务 B：UPDATE users SET balance = 200 WHERE id = 1; COMMIT;
-- 事务 A：SELECT balance FROM users WHERE id = 1; → 200（不可重复读）
```

**幻读**：同一事务内两次范围查询，结果行数不同（被其他事务 INSERT 了）

```sql
-- 事务 A：SELECT COUNT(*) FROM users WHERE age > 20; → 5
-- 事务 B：INSERT INTO users (age) VALUES (25); COMMIT;
-- 事务 A：SELECT COUNT(*) FROM users WHERE age > 20; → 6（幻读）
```

### 2.3 InnoDB 如何解决幻读（RR 级别）

InnoDB 在 RR 级别下通过 **MVCC** + **Next-Key Lock** 两种机制解决幻读：

* **快照读**（普通 `SELECT`）：通过 MVCC 读取事务开始时的快照，不受其他事务影响
* **当前读**（`SELECT ... FOR UPDATE` / `INSERT` / `UPDATE`）：通过 **Next-Key Lock**（行锁 + 间隙锁）锁住扫描范围，阻止其他事务插入

```sql
-- 当前读示例
SELECT * FROM users WHERE age > 20 FOR UPDATE;  -- 锁住 age > 20 的范围
-- 此时其他事务无法在该范围内 INSERT，避免幻读
```

***

## 三、MVCC 多版本并发控制

### 3.1 实现原理

InnoDB 为每行数据添加两个隐藏列：

* **DB\_TRX\_ID**：最后修改该行的事务 ID
* **DB\_ROLL\_PTR**：指向 Undo Log 中该行的上一个版本

```
当前行 ←→ Undo Log 版本1 ←→ Undo Log 版本2 ←→ ...
（版本链，链表结构）
```

**Read View（读视图）**：事务执行快照读时生成，包含：

* `m_ids`：当前活跃（未提交）的事务 ID 列表
* `min_trx_id`：最小活跃事务 ID
* `max_trx_id`：下一个将分配的事务 ID
* `creator_trx_id`：创建该 Read View 的事务 ID

**可见性判断规则**：

1. 如果行的 `DB_TRX_ID` == `creator_trx_id` → 可见（自己修改的）
2. 如果 `DB_TRX_ID` < `min_trx_id` → 可见（事务已提交）
3. 如果 `DB_TRX_ID` >= `max_trx_id` → 不可见（事务在 Read View 之后开启）
4. 如果 `DB_TRX_ID` 在 `m_ids` 中 → 不可见（事务未提交）
5. 否则 → 可见

### 3.2 RC 与 RR 的 Read View 差异

| 隔离级别 | Read View 生成时机 |
|:---------|:-------------------|
| **RC** | 每次 `SELECT` 都生成新的 Read View |
| **RR** | 只在事务第一次 `SELECT` 时生成，后续复用同一个 Read View |

这就是为什么 RR 能实现可重复读：始终读取同一个快照，不受其他已提交事务的影响。

***

## 四、锁机制详解

### 4.1 锁的粒度

| 锁类型 | 粒度 | 说明 |
|:-------|:-----|:-----|
| **表锁** | 整张表 | `LOCK TABLES t READ/WRITE`，MyISAM 只支持表锁 |
| **行锁** | 单行记录 | InnoDB 特有，锁定索引记录 |
| **间隙锁**（Gap Lock） | 索引记录之间的间隙 | 防止其他事务在间隙中插入（解决幻读） |
| **临键锁**（Next-Key Lock） | 行锁 + 间隙锁 | InnoDB 在 RR 级别下的默认锁类型 |
| **意向锁**（Intention Lock） | 表级 | `IS`（意向共享锁）/ `IX`（意向排他锁），用于表锁与行锁共存 |

### 4.2 行锁的加锁规则（RR 级别）

```sql
-- 等值查询，命中唯一索引 → 退化为 Record Lock（行锁）
SELECT * FROM users WHERE id = 1 FOR UPDATE;  -- 锁住 id=1 这一行

-- 等值查询，未命中唯一索引 → 退化为 Gap Lock（间隙锁）
SELECT * FROM users WHERE id = 5 FOR UPDATE;
-- 假设 id 有 1, 3, 7, 10，则锁住 (3, 7) 间隙，阻止 id=4,5,6 的插入

-- 范围查询 → Next-Key Lock
SELECT * FROM users WHERE id >= 3 AND id < 7 FOR UPDATE;
-- 锁住 [1,3], (3,7) 范围（取决于实际数据）

-- 无索引查询 → 锁住全表（升级为表锁）
SELECT * FROM users WHERE name = 'test' FOR UPDATE;
-- 如果 name 没有索引，InnoDB 会锁住所有行（等效表锁）
```

### 4.3 查看当前锁信息

```sql
-- MySQL 8.0+：performance_schema
SELECT * FROM performance_schema.data_locks;
SELECT * FROM performance_schema.data_lock_waits;

-- MySQL 5.7：information_schema
SELECT * FROM information_schema.INNODB_LOCKS;
SELECT * FROM information_schema.INNODB_LOCK_WAITS;

-- 查看当前运行的事务
SELECT * FROM information_schema.INNODB_TRX;

-- 查看正在等待锁的事务
SELECT
  r.trx_id AS waiting_trx,
  r.trx_query AS waiting_query,
  b.trx_id AS blocking_trx,
  b.trx_query AS blocking_query
FROM information_schema.INNODB_LOCK_WAITS w
JOIN information_schema.INNODB_TRX b ON b.trx_id = w.blocking_trx_id
JOIN information_schema.INNODB_TRX r ON r.trx_id = w.requesting_trx_id;
```

***

## 五、死锁

### 5.1 死锁产生条件

两个或多个事务互相等待对方持有的锁，形成循环依赖：

```sql
-- 事务 A：
BEGIN;
UPDATE users SET balance = balance - 100 WHERE id = 1;  -- 锁住 id=1
-- 等待 id=2 的锁...

-- 事务 B（同时执行）：
BEGIN;
UPDATE users SET balance = balance - 50 WHERE id = 2;   -- 锁住 id=2
UPDATE users SET balance = balance + 50 WHERE id = 1;   -- 等待 id=1 的锁（被 A 持有）
```

### 5.2 InnoDB 死锁检测与处理

InnoDB 默认开启 **死锁检测**（`innodb_deadlock_detect = ON`），会主动回滚代价较小的事务：

```sql
-- 查看死锁日志
SHOW ENGINE INNODB STATUS;  -- 在 LATEST DETECTED DEADLOCK 部分查看

-- 死锁检测开关（高并发时可关闭以减少 CPU 开销，改用锁等待超时）
SET GLOBAL innodb_deadlock_detect = ON;
SET GLOBAL innodb_lock_wait_timeout = 50;  -- 锁等待超时（秒）
```

### 5.3 死锁预防与排查

**预防策略**：

1. **固定加锁顺序**：多个事务按相同顺序访问表和行
2. **减小事务范围**：事务尽量短，不要在事务中做 RPC/HTTP 调用
3. **合理使用索引**：避免无索引查询导致锁升级为表锁
4. **降低隔离级别**：RC 级别下没有间隙锁，死锁概率更低

**排查流程**：

```sql
-- 1. 查看最近一次死锁日志
SHOW ENGINE INNODB STATUS;

-- 2. 查看当前锁等待
SELECT * FROM performance_schema.data_lock_waits;

-- 3. 找到阻塞源和被阻塞方，分析加锁顺序

-- 4. Kill 阻塞事务（谨慎操作）
KILL <blocking_trx_id>;
```

***

## 六、MVCC 与锁的实践总结

| 场景 | 建议 |
|:-----|:-----|
| 读多写少 | 使用默认 RR 级别 + MVCC，读不加锁，性能好 |
| 写多、死锁频繁 | 考虑降级为 RC 级别（无间隙锁，死锁大幅减少） |
| 需要严格一致性 | 使用 `SELECT ... FOR UPDATE` 或 `SERIALIZABLE` |
| 大批量更新 | 分批提交（每 500-1000 行提交一次），减少锁持有时间 |
| 事务中的查询 | 尽量在事务末尾做查询，避免过早获取 Read View |

***
