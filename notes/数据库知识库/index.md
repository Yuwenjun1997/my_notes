---
url: /my_notes/notes/数据库知识库/index.md
---
# 🗄️ 数据库知识库

> 一份面向后端开发者的 MySQL 与 PostgreSQL 系统化学习指南，涵盖**MySQL 核心 → PostgreSQL 核心 → 双库实战对比**三个阶段，聚焦实际开发中最常用的知识与调优技巧。

***

## 📋 目录索引

* [第一阶段：MySQL 核心](#-第一阶段mysql-核心)
* [第二阶段：PostgreSQL 核心](#-第二阶段postgresql-核心)
* [第三阶段：实战与对比](#-第三阶段实战与对比)
* [学习路线总览](#-学习路线总览)

***

## 📘 第一阶段：MySQL 核心

> **学习周期**：2-3 周 | **每日建议**：2-3 小时
> **目标**：掌握 MySQL 安装配置、SQL 基础语法、索引原理与优化、事务与锁机制、存储引擎，具备慢查询排查与用户权限管理能力。

| 模块 | 核心内容 | 文档 |
|:-----|:---------|:----:|
| **1.1 MySQL安装与配置** | 安装方式（apt/yum/docker）、my.cnf 核心参数、字符集配置、启动与服务管理 | [📖 查看](./第一阶段-MySQL核心/1.1-MySQL安装与配置.md) |
| **1.2 SQL基础与常用语法** | DDL/DML/DQL/DCL、JOIN、子查询、GROUP BY/HAVING、常用内置函数、EXPLAIN 用法 | [📖 查看](./第一阶段-MySQL核心/1.2-SQL基础与常用语法.md) |
| **1.3 索引与查询优化** | B+树原理、聚簇/非聚簇索引、覆盖索引、最左前缀原则、索引失效场景、EXPLAIN 深入解读 | [📖 查看](./第一阶段-MySQL核心/1.3-索引与查询优化.md) |
| **1.4 事务与锁机制** | ACID、隔离级别、MVCC、行锁/表锁/间隙锁、死锁排查与预防、锁等待查看 | [📖 查看](./第一阶段-MySQL核心/1.4-事务与锁机制.md) |
| **1.5 存储引擎** | InnoDB vs MyISAM 对比、InnoDB 架构（Buffer Pool/Redo/Undo/DoubleWrite）、表空间管理 | [📖 查看](./第一阶段-MySQL核心/1.5-存储引擎.md) |
| **1.6 慢查询分析与性能调优** | slow\_query\_log 配置、mysqldumpslow、pt-query-digest、全局参数调优、SQL 重写技巧 | [📖 查看](./第一阶段-MySQL核心/1.6-慢查询分析与性能调优.md) |
| **1.7 用户权限与安全管理** | 用户创建与授权（GRANT）、角色、权限最小化原则、SQL 注入防护、SSL 连接 | [📖 查看](./第一阶段-MySQL核心/1.7-用户权限与安全管理.md) |

***

## 🚀 第二阶段：PostgreSQL 核心

> **学习周期**：2-3 周 | **每日建议**：2-3 小时
> **目标**：掌握 PostgreSQL 安装配置、SQL 进阶特性、多种索引类型、MVCC 与 VACUUM 机制、JSONB 操作、扩展生态，具备性能调优与连接管理能力。

| 模块 | 核心内容 | 文档 |
|:-----|:---------|:----:|
| **2.1 PostgreSQL安装与配置** | apt/docker 安装、postgresql.conf 核心参数、pg\_hba.conf 认证、pg\_ctl 服务管理 | [📖 查看](./第二阶段-PostgreSQL核心/2.1-PostgreSQL安装与配置.md) |
| **2.2 SQL进阶与PostgreSQL特性** | WITH/CTE、窗口函数、LATERAL JOIN、数组/范围类型、RETURNING 子句、EXPLAIN ANALYZE | [📖 查看](./第二阶段-PostgreSQL核心/2.2-SQL进阶与PostgreSQL特性.md) |
| **2.3 索引与查询优化** | B-tree/GiST/GIN/BRIN 索引类型、部分索引、表达式索引、EXPLAIN(ANALYZE,BUFFERS) 解读 | [📖 查看](./第二阶段-PostgreSQL核心/2.3-索引与查询优化.md) |
| **2.4 事务与MVCC机制** | PostgreSQL MVCC 实现（xmin/xmax）、VACUUM 机制、事务隔离级别、dead tuple 清理 | [📖 查看](./第二阶段-PostgreSQL核心/2.4-事务与MVCC机制.md) |
| **2.5 JSONB与NoSQL能力** | JSONB 操作符、索引策略、@> 包含查询、jsonb\_path\_query、与 MongoDB 场景对比 | [📖 查看](./第二阶段-PostgreSQL核心/2.5-JSONB与NoSQL能力.md) |
| **2.6 扩展与插件生态** | pg\_stat\_statements、PostGIS、pg\_trgm、pgvector、CREATE EXTENSION 用法、常用扩展一览 | [📖 查看](./第二阶段-PostgreSQL核心/2.6-扩展与插件生态.md) |
| **2.7 性能调优与连接管理** | shared\_buffers/work\_mem/effective\_cache\_size 调优、PgBouncer 连接池、pgBadger 日志分析 | [📖 查看](./第二阶段-PostgreSQL核心/2.7-性能调优与连接管理.md) |

***

## ⚡ 第三阶段：实战与对比

> **学习周期**：1-2 周 | **每日建议**：2-3 小时
> **目标**：能够对比选型 MySQL 与 PostgreSQL，掌握备份恢复与高可用方案，具备慢查询排查与连接池配置实战能力。

| 模块 | 核心内容 | 文档 |
|:-----|:---------|:----:|
| **3.1 MySQL与PostgreSQL对比选型** | 语法差异、功能差异、生态工具对比、适用场景与选型决策框架 | [📖 查看](./第三阶段-实战与对比/3.1-MySQL与PostgreSQL对比选型.md) |
| **3.2 备份恢复与高可用** | mysqldump/xtrabackup/pg\_dump/pg\_basebackup、主从复制/流复制、高可用方案（MHA/Patroni） | [📖 查看](./第三阶段-实战与对比/3.2-备份恢复与高可用.md) |
| **3.3 慢查询排查实战** | 慢查询定位流程、执行计划分析、索引优化案例、SQL 改写案例、锁等待排查案例 | [📖 查看](./第三阶段-实战与对比/3.3-慢查询排查实战.md) |
| **3.4 连接池与中间件配置** | HikariCP/Druid（Java侧）、PgBouncer/pgbouncer、ProxySQL、读写分离中间件配置 | [📖 查看](./第三阶段-实战与对比/3.4-连接池与中间件配置.md) |
| **3.5 获取当前上下文信息** | MySQL/PostgreSQL 内置函数与常量：当前用户、数据库、版本、时间戳、事务状态、会话变量速查 | [📖 查看](./第三阶段-实战与对比/3.5-获取当前上下文信息-内置函数与常量.md) |

***

## 📐 学习路线总览

```
第一阶段：MySQL 核心（2-3周）
    │  安装配置 → SQL基础 → 索引优化 → 事务与锁 → 存储引擎 → 慢查询 → 用户权限
    ▼
第二阶段：PostgreSQL 核心（2-3周）
    │  安装配置 → SQL进阶 → 索引优化 → MVCC → JSONB → 扩展生态 → 性能调优
    ▼
第三阶段：实战与对比（1-2周）
    对比选型 → 备份恢复与高可用 → 慢查询实战 → 连接池与中间件 → 上下文函数速查
```

### 💡 学习建议

1. **先 MySQL 后 PostgreSQL**：MySQL 在国内使用率更高，优先掌握；PostgreSQL 的特有功能（JSONB、扩展生态）在特定场景下优势明显。
2. **动手实践**：每个 SQL 示例和配置项都要在实际数据库中跑一遍，建议用 Docker 快速搭建练习环境。
3. **带着项目学**：结合实际项目需求学习（如设计一个电商数据库），比孤立背知识点有效得多。
4. **重视 EXPLAIN**：无论是 MySQL 还是 PostgreSQL，EXPLAIN 是查询优化的核心工具，必须熟练掌握。
5. **关注生产环境**：慢查询日志、锁等待、连接池配置是生产环境最常见的问题，要重点练习。

### 🔧 推荐工具与资源

| 类别 | 工具/资源 | 说明 |
|:-----|:----------|:-----|
| 图形化管理 | DBeaver / Navicat / DataGrip | 跨数据库通用客户端 |
| MySQL 管理 | MySQL Workbench | 官方 GUI 工具 |
| PostgreSQL 管理 | pgAdmin | 官方 GUI 工具 |
| 慢查询分析 | pt-query-digest（MySQL）/ pgBadger（PostgreSQL） | 慢查询日志分析利器 |
| 连接池 | PgBouncer / ProxySQL | PostgreSQL / MySQL 连接池与读写分离 |

***
