---
url: >-
  /my_notes/notes/数据库知识库/di-yi-jie-duan-my-sql-he-xin/3-suo-yin-yu-cha-xun-you-hua/index.md
---
# 索引与查询优化

## 一、索引基础原理

### 1.1 B+ 树索引结构

MySQL InnoDB 使用 **B+ 树**作为索引数据结构：

```
          [30 | 60]                    ← 根节点（存储键值，指向子节点）
         /     |     \
   [10|20]  [40|50]  [70|80]          ← 内部节点（索引页，只存键值）
   / | \     / | \     / | \
 [数据页] [数据页] [数据页] ...        ← 叶子节点（存储完整数据/主键值）
 ←——————————————→  ←——————————————→
   叶子节点通过双向链表相连，支持范围查询
```

**B+ 树的核心优势**：

* **非叶子节点只存键值**：一个页能存更多索引项，树更矮（3层可存约 2000 万行）
* **叶子节点双向链表**：范围查询只需从起始节点沿链表扫描，无需回溯
* **所有数据都在叶子节点**：查询任何记录的 IO 次数相同（树高恒定）

### 1.2 聚簇索引 vs 非聚簇索引

| 特性 | 聚簇索引（Clustered） | 非聚簇索引（Secondary） |
|:-----|:-----|:-----|
| 另一个名字 | 主键索引 | 二级索引、辅助索引 |
| 叶子节点存储 | **完整行数据** | **主键值**（而非行数据） |
| 数量 | 每张表**只有一个** | 可以有**多个** |
| 默认创建 | 主键自动创建 | 手动 `CREATE INDEX` |
| 查询是否需要回表 | 否（直接取数据） | 需要（先查主键，再回表） |

**回表过程示例**：

```sql
-- idx_email 是二级索引
SELECT * FROM users WHERE email = 'test@example.com';
-- 1. 在 idx_email 索引树中找到 email='test@...' → 获得主键 id=42
-- 2. 用 id=42 在聚簇索引树中查找完整行数据 → 回表（额外一次 IO）
```

### 1.3 覆盖索引（Covering Index）

**覆盖索引**是指查询所需的所有列都包含在索引中，无需回表：

```sql
-- 如果有联合索引 idx_email_name(email, username)
-- 以下查询只需要扫描二级索引，无需回表
SELECT username FROM users WHERE email = 'test@example.com';
-- EXPLAIN Extra 显示：Using index
```

***

## 二、索引设计原则

### 2.1 最左前缀原则

联合索引 `idx(a, b, c)` 的使用规则：

| 查询条件 | 是否使用索引 | 说明 |
|:---------|:------------|:-----|
| `WHERE a = 1` | ✅ 使用 | 最左列命中 |
| `WHERE a = 1 AND b = 2` | ✅ 使用 | 使用 a、b 两列 |
| `WHERE a = 1 AND b = 2 AND c = 3` | ✅ 使用 | 全部三列命中 |
| `WHERE b = 2` | ❌ 不使用 | 缺少最左列 a |
| `WHERE a = 1 AND c = 3` | ⚠️ 部分使用 | 只用到 a（跳过 b，c 无法用索引） |
| `WHERE a = 1 AND b > 2 AND c = 3` | ⚠️ 部分使用 | a、b 用索引，c 无法用（范围查询后的列） |

**范围查询中断索引**：`>`、`<`、`BETWEEN`、`LIKE 'abc%'`（前缀匹配）会导致该列之后的索引列无法使用。

### 2.2 索引失效的常见场景

```sql
-- 1. 对索引列使用函数或运算
SELECT * FROM users WHERE YEAR(created_at) = 2025;    -- ❌ 失效
SELECT * FROM users WHERE created_at >= '2025-01-01'
  AND created_at < '2026-01-01';                       -- ✅ 使用索引

-- 2. LIKE 以通配符开头
SELECT * FROM users WHERE email LIKE '%example.com';   -- ❌ 失效
SELECT * FROM users WHERE email LIKE 'test%';          -- ✅ 使用索引

-- 3. OR 条件（两边字段都需有索引）
SELECT * FROM users WHERE id = 1 OR username = 'test'; -- 如果 username 无索引则失效
-- 改写为 UNION ALL：
SELECT * FROM users WHERE id = 1
UNION ALL
SELECT * FROM users WHERE username = 'test' AND id != 1;

-- 4. 隐式类型转换
-- phone 字段是 VARCHAR，传入数字会触发隐式转换导致索引失效
SELECT * FROM users WHERE phone = 13800138000;        -- ❌ 失效
SELECT * FROM users WHERE phone = '13800138000';      -- ✅ 使用索引

-- 5. IS NULL / IS NOT NULL（取决于数据分布）
-- 当 NULL 值占比很高时，IS NOT NULL 可能走全表扫描

-- 6. NOT IN / NOT EXISTS（通常不走索引，具体看优化器判断）
```

### 2.3 索引设计实践建议

| 场景 | 建议 |
|:-----|:-----|
| 主键选择 | 使用自增 BIGINT（避免 UUID，避免页分裂） |
| 单列索引 | 选择区分度高的列（`COUNT(DISTINCT col) / COUNT(*)` > 0.1） |
| 联合索引 | 把等值查询列放前面，范围查询列放后面 |
| 覆盖索引 | 高频查询尽量用覆盖索引避免回表 |
| 索引数量 | 单表索引建议不超过 5-6 个（写入时维护索引有开销） |
| 前缀索引 | 长字符串列用前缀索引：`INDEX idx_name (name(20))` |

***

## 三、EXPLAIN 深入解读

### 3.1 EXPLAIN 输出字段详解

```sql
EXPLAIN SELECT u.username, o.total
FROM users u
JOIN orders o ON u.id = o.user_id
WHERE u.status = 1 AND o.total > 100;
```

**核心字段说明**：

| 字段 | 含义 | 说明 |
|:-----|:-----|:-----|
| `id` | 查询编号 | 相同 id 从上到下执行，不同 id 大的先执行 |
| `select_type` | 查询类型 | `SIMPLE`（简单查询）/ `PRIMARY`（外层）/ `SUBQUERY`（子查询）/ `DERIVED`（派生表） |
| `table` | 访问的表 | 可能是表名或 `<derivedN>`（派生表别名） |
| `type` | **访问类型**（最重要） | 从好到差：`system` > `const` > `eq_ref` > `ref` > `range` > `index` > `ALL` |
| `possible_keys` | 可能使用的索引 | 优化器认为可能用到的索引 |
| `key` | **实际使用的索引** | `NULL` 表示全表扫描 |
| `key_len` | 索引使用长度（字节） | 越短越好，反映联合索引使用了几列 |
| `rows` | 预估扫描行数 | 越小越好 |
| `filtered` | 过滤比例（%） | 越高越好（100% 最优） |
| `Extra` | 额外信息 | 重要见下表 |

### 3.2 Extra 常见值与优化方向

| Extra 值 | 含义 | 优化方向 |
|:---------|:-----|:---------|
| `Using index` | **覆盖索引**，无需回表 | ✅ 最优 |
| `Using where` | 在存储引擎层过滤后，Server 层再过滤 | 可以尝试加索引减少 Server 层过滤 |
| `Using index condition` | **索引下推（ICP）**，在引擎层完成部分 WHERE 条件 | ✅ 良好 |
| `Using temporary` | 使用临时表（常见于 GROUP BY / DISTINCT） | 优化 GROUP BY，考虑加索引 |
| `Using filesort` | 额外排序（无法利用索引排序） | 为 ORDER BY 列加索引 |
| `Select tables optimized away` | 聚合函数直接从索引获取 | ✅ 最优 |

### 3.3 type 访问类型详解

| type | 含义 | 示例 |
|:-----|:-----|:-----|
| `system` | 表只有一行（系统表） | 极少见 |
| `const` | 主键或唯一索引等值查询 | `WHERE id = 1` |
| `eq_ref` | JOIN 时用主键/唯一索引关联 | `JOIN ON a.id = b.id`（a.id 是主键） |
| `ref` | 非唯一索引等值查询 | `WHERE email = 'x'`（email 有普通索引） |
| `range` | 索引范围扫描 | `WHERE id > 10`、`WHERE id IN (1,2,3)` |
| `index` | 全索引扫描（遍历整个索引树） | `SELECT id FROM users`（只查索引列） |
| `ALL` | **全表扫描**（最差） | 无可用索引 |

***

## 四、查询优化实战技巧

### 4.1 分页查询优化

```sql
-- 问题：OFFSET 越大越慢（需要跳过前面所有行）
SELECT * FROM orders ORDER BY id LIMIT 10 OFFSET 1000000;  -- 慢

-- 优化：使用书签法（需要记住上次最后的 id）
SELECT * FROM orders WHERE id > 1000000 ORDER BY id LIMIT 10;  -- 快

-- 延迟关联（先查主键，再回表取数据）
SELECT o.* FROM orders o
INNER JOIN (
  SELECT id FROM orders ORDER BY id LIMIT 10 OFFSET 1000000
) t ON o.id = t.id;
```

### 4.2 COUNT 优化

```sql
-- COUNT(*) 会统计所有行（包括 NULL），COUNT(col) 不统计 NULL
SELECT COUNT(*) FROM users;        -- 推荐（InnoDB 会优化为最小索引树扫描）
SELECT COUNT(id) FROM users;       -- 等价于 COUNT(*)
SELECT COUNT(email) FROM users;    -- 只统计 email 非 NULL 的行

-- 大表 COUNT 优化方案：
-- 1. 维护计数表（实时性要求高）
-- 2. 使用 SHOW TABLE STATUS 中的 Rows（近似值，不准确）
-- 3. 使用聚簇索引扫描（MySQL 会自动选择最小索引）
```

### 4.3 JOIN 优化

```sql
-- 小表驱动大表（MySQL 优化器通常会自动选择，但显式写更清晰）
-- 被驱动表的 JOIN 列必须有索引
SELECT u.username, o.order_no
FROM users u  -- 小表（驱动表）
INNER JOIN orders o ON u.id = o.user_id;  -- o.user_id 必须有索引

-- 避免 JOIN 多表（超过 3 张表时考虑反范式设计或冗余字段）
```

### 4.4 ORDER BY 优化

```sql
-- 利用索引排序（避免 filesort）
-- 如果有联合索引 idx_status_created(status, created_at)
SELECT * FROM orders WHERE status = 1 ORDER BY created_at DESC;  -- ✅ 索引已排序

-- 注意：ORDER BY 方向不一致时无法使用索引排序
-- idx(a ASC, b ASC) 不能用于 ORDER BY a ASC, b DESC
-- MySQL 8.0 支持降序索引：CREATE INDEX idx ON t(a ASC, b DESC);
```

***

## 五、索引优化检查清单

```
□ EXPLAIN 分析慢查询，确认 type 不是 ALL
□ 确认 key 字段是否使用了预期索引
□ 检查 key_len 确认联合索引使用了几列
□ 检查 Extra 是否有 Using filesort / Using temporary
□ 确认 WHERE 条件没有导致索引失效（函数/运算/类型转换）
□ 分页查询使用书签法或延迟关联
□ 高频查询尽量使用覆盖索引（Using index）
□ 单表索引数量不超过 6 个
□ 区分度低的列（如 status, gender）不单独建索引
```

***
