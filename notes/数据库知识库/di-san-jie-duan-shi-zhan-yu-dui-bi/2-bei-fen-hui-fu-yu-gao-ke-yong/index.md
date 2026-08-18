---
url: >-
  /my_notes/notes/数据库知识库/di-san-jie-duan-shi-zhan-yu-dui-bi/2-bei-fen-hui-fu-yu-gao-ke-yong/index.md
---
# 备份恢复与高可用

## 一、MySQL 备份恢复

### 1.1 逻辑备份 — mysqldump

```bash
# 备份单个数据库
mysqldump -u root -p mydb > mydb_backup.sql

# 备份多个数据库
mysqldump -u root -p --databases db1 db2 db3 > multi_db_backup.sql

# 备份所有数据库
mysqldump -u root -p --all-databases > all_backup.sql

# 备份指定表
mysqldump -u root -p mydb users orders > tables_backup.sql

# 只备份表结构（不含数据）
mysqldump -u root -p --no-data mydb > schema_only.sql

# 只备份数据（不含结构）
mysqldump -u root -p --no-create-info mydb > data_only.sql

# 带一致性快照的备份（生产必用）
mysqldump -u root -p --single-transaction --routines --triggers --events mydb > consistent.sql

# 压缩备份
mysqldump -u root -p mydb | gzip > mydb_$(date +%Y%m%d).sql.gz
```

### 1.2 物理备份 — Percona XtraBackup

```bash
# 安装
sudo apt install percona-xtrabackup-80

# 全量备份
xtrabackup --backup --target-dir=/backup/full \
  --user=root --password=xxx

# 准备备份（应用 redo log）
xtrabackup --prepare --target-dir=/backup/full

# 恢复（需要停止 MySQL）
systemctl stop mysql
rm -rf /var/lib/mysql/*
xtrabackup --copy-back --target-dir=/backup/full
chown -R mysql:mysql /var/lib/mysql
systemctl start mysql
```

### 1.3 增量备份与恢复

```bash
# 全量备份
xtrabackup --backup --target-dir=/backup/full

# 增量备份（基于全量）
xtrabackup --backup --target-dir=/backup/inc1 \
  --incremental-basedir=/backup/full

# 恢复增量备份
xtrabackup --prepare --apply-log-only --target-dir=/backup/full
xtrabackup --prepare --apply-log-only --target-dir=/backup/full \
  --incremental-dir=/backup/inc1
xtrabackup --prepare --target-dir=/backup/full
```

### 1.4 基于 binlog 的时间点恢复

```bash
# 查看 binlog 列表
SHOW BINARY LOGS;

# 查看 binlog 内容
mysqlbinlog --start-datetime='2026-08-18 10:00:00' \
  --stop-datetime='2026-08-18 11:00:00' \
  mysql-bin.000001

# 恢复到指定时间点
mysqlbinlog --stop-datetime='2026-08-18 10:30:00' \
  mysql-bin.000001 | mysql -u root -p

# 恢复到指定位置
mysqlbinlog --start-position=154 --stop-position=1024 \
  mysql-bin.000001 | mysql -u root -p
```

***

## 二、PostgreSQL 备份恢复

### 2.1 逻辑备份 — pg\_dump

```bash
# 备份单个数据库
pg_dump -U postgres -d mydb > mydb_backup.sql

# 自定义格式（推荐，支持并行恢复和选择性恢复）
pg_dump -U postgres -d mydb -Fc > mydb_backup.dump

# 备份为目录格式（支持并行备份，大数据库推荐）
pg_dump -U postgres -d mydb -Fd -j 4 -f /backup/mydb_dir

# 只备份结构
pg_dump -U postgres -d mydb --schema-only > schema.sql

# 只备份数据
pg_dump -U postgres -d mydb --data-only > data.sql

# 备份指定表
pg_dump -U postgres -d mydb -t users -t orders > tables.sql

# 备份所有数据库
pg_dumpall -U postgres > all_backup.sql

# 压缩备份
pg_dump -U postgres -d mydb | gzip > mydb_$(date +%Y%m%d).sql.gz
```

### 2.2 恢复

```bash
# SQL 格式恢复
psql -U postgres -d mydb < mydb_backup.sql

# 自定义格式恢复（推荐）
pg_restore -U postgres -d mydb -Fc mydb_backup.dump

# 并行恢复（加速大数据库恢复）
pg_restore -U postgres -d mydb -Fd -j 4 /backup/mydb_dir

# 只恢复结构
pg_restore -U postgres -d mydb --schema-only mydb_backup.dump

# 只恢复指定表
pg_restore -U postgres -d mydb -t users mydb_backup.dump

# 清空数据库后恢复
dropdb -U postgres mydb
createdb -U postgres mydb
pg_restore -U postgres -d mydb mydb_backup.dump
```

### 2.3 物理备份 — pg\_basebackup

```bash
# 基础物理备份
pg_basebackup -U replicator -D /backup/base \
  -Fp -Xs -P -R

# 参数说明：
# -Fp: plain 格式
# -Xs: 通过 streaming 方式传输 WAL
# -P: 显示进度
# -R: 自动创建 standby.signal 文件（用于搭建从库）

# 恢复
systemctl stop postgresql
rm -rf /var/lib/postgresql/16/main/*
cp -r /backup/base/* /var/lib/postgresql/16/main/
chown -R postgres:postgres /var/lib/postgresql/16/main
systemctl start postgresql
```

***

## 三、主从复制

### 3.1 MySQL 主从复制

```sql
-- 主库配置（my.cnf）
-- [mysqld]
-- server-id = 1
-- log-bin = mysql-bin
-- binlog_format = ROW
-- sync_binlog = 1

-- 主库创建复制用户
CREATE USER 'repl'@'%' IDENTIFIED BY 'password';
GRANT REPLICATION SLAVE ON *.* TO 'repl'@'%';

-- 查看主库状态
SHOW MASTER STATUS;
-- 记录 File 和 Position
```

```sql
-- 从库配置
CHANGE MASTER TO
  MASTER_HOST = '192.168.1.100',
  MASTER_USER = 'repl',
  MASTER_PASSWORD = 'password',
  MASTER_LOG_FILE = 'mysql-bin.000001',
  MASTER_LOG_POS = 154;

START SLAVE;
SHOW SLAVE STATUS\G

-- 关键检查项：
-- Slave_IO_Running: Yes
-- Slave_SQL_Running: Yes
-- Seconds_Behind_Master: 0（复制延迟）
```

### 3.2 PostgreSQL 流复制

```sql
-- 主库配置（postgresql.conf）
-- wal_level = replica
-- max_wal_senders = 10
-- wal_keep_size = 1GB

-- 主库创建复制用户
CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'password';

-- pg_hba.conf 允许复制连接
-- host  replication  replicator  192.168.1.0/24  scram-sha-256
```

```bash
# 从库搭建
# 1. 停止从库 PostgreSQL
# 2. 清空数据目录
# 3. 使用 pg_basebackup 拉取主库数据
pg_basebackup -h 192.168.1.100 -U replicator -D /var/lib/postgresql/16/main -Fp -Xs -P -R
# 4. 启动从库
# -R 参数会自动创建 standby.signal 和配置连接信息
```

### 3.3 逻辑复制（PostgreSQL）

逻辑复制允许选择性地复制特定表：

```sql
-- 主库
-- postgresql.conf: wal_level = logical

-- 创建发布（主库）
CREATE PUBLICATION my_pub FOR TABLE users, orders;
-- 或发布所有表
CREATE PUBLICATION my_pub FOR ALL TABLES;

-- 从库
-- 创建与主库相同结构的表

-- 创建订阅
CREATE SUBSCRIPTION my_sub
  CONNECTION 'host=192.168.1.100 dbname=mydb user=replicator password=xxx'
  PUBLICATION my_pub;
```

***

## 四、高可用方案

### 4.1 MySQL 高可用

| 方案 | 原理 | 适用场景 |
|:-----|:-----|:---------|
| **主从复制** | 异步/半同步复制 | 读写分离，容灾 |
| **MHA** | 自动故障切换，保证数据一致性 | 中小规模 |
| **Orchestrator** | 自动拓扑管理和故障切换 | 大规模集群 |
| **MySQL Group Replication** | 多主/单主复制组 | 高可用集群 |
| **InnoDB Cluster** | MySQL Shell + Router + Group Replication | 官方推荐方案 |
| **Galera Cluster** | 同步多主复制 | 多主写入 |

### 4.2 PostgreSQL 高可用

| 方案 | 原理 | 适用场景 |
|:-----|:-----|:---------|
| **流复制** | 异步/同步流复制 | 基础高可用 |
| **Patroni** | 基于 DCS（etcd/ZooKeeper）的自动故障切换 | 生产推荐 |
| **repmgr** | 复制管理和自动故障切换 | 中小规模 |
| **PgBouncer + HAProxy** | 连接池 + 负载均衡 | 读写分离 |
| **Citus** | 分布式 PostgreSQL | 大规模水平扩展 |

### 4.3 Patroni 快速部署

```yaml
# patroni.yml
scope: pg-cluster
namespace: /db/
name: node1

etcd3:
  hosts: 192.168.1.10:2379,192.168.1.11:2379,192.168.1.12:2379

bootstrap:
  dcs:
    ttl: 30
    loop_wait: 10
    retry_timeout: 10
    maximum_lag_on_failover: 1048576
    postgresql:
      use_pg_rewind: true
      parameters:
        max_connections: 200
        shared_buffers: 4GB

postgresql:
  listen: 0.0.0.0:5432
  data_dir: /var/lib/postgresql/16/main
  authentication:
    replication:
      username: replicator
      password: password
    superuser:
      username: postgres
      password: password
```

***

## 五、备份策略建议

```
备份策略（3-2-1 原则）：
├─ 3 份数据副本
├─ 2 种不同存储介质
└─ 1 份异地备份

MySQL 推荐：
├─ 日常：mysqldump 逻辑备份（每日）
├─ 大库：XtraBackup 物理备份 + binlog 增量（每日）
└─ 保留：最近 7 天日备份 + 每月 1 次全量（保留 3 个月）

PostgreSQL 推荐：
├─ 日常：pg_dump -Fc 自定义格式备份（每日）
├─ 大库：pg_basebackup 物理备份 + WAL 归档（持续）
└─ 保留：同上
```

***
