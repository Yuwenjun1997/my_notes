---
url: >-
  /my_notes/notes/数据库知识库/di-yi-jie-duan-my-sql-he-xin/1-my-sql-an-zhuang-yu-pei-zhi/index.md
---
# MySQL 安装与配置

## 一、安装方式选择

### 1.1 三种安装方式对比

| 方式 | 适用场景 | 优点 | 缺点 |
|:-----|:---------|:-----|:-----|
| **apt/yum 包管理** | Linux 服务器生产部署 | 自动处理依赖、方便升级 | 版本可能偏旧 |
| **Docker** | 本地开发/测试环境 | 隔离性好、快速部署、多版本共存 | 需要理解 Docker 网络/卷 |
| **二进制包/源码编译** | 特定版本需求、定制化编译选项 | 灵活控制版本与功能 | 手动维护依赖、升级麻烦 |

### 1.2 Ubuntu apt 安装

```bash
# 更新软件源
sudo apt update

# 安装 MySQL Server（Ubuntu 22.04 默认 MySQL 8.0）
sudo apt install -y mysql-server

# 安装完成后，安全初始化（设置 root 密码、删除匿名用户等）
sudo mysql_secure_installation

# 启动并设置开机自启
sudo systemctl start mysql
sudo systemctl enable mysql

# 检查运行状态
sudo systemctl status mysql
```

### 1.3 CentOS/RHEL yum 安装

```bash
# 添加 MySQL 官方 yum 源（以 MySQL 8.0 为例）
sudo rpm -i https://dev.mysql.com/get/mysql80-community-release-el8-9.noarch.rpm

# 安装 MySQL Server
sudo yum install -y mysql-community-server

# 启动并设置开机自启
sudo systemctl start mysqld
sudo systemctl enable mysqld

# 获取临时 root 密码
sudo grep 'temporary password' /var/log/mysqld.log

# 安全初始化
mysql_secure_installation
```

### 1.4 Docker 安装（推荐本地开发）

```bash
# 拉取 MySQL 8.0 镜像
docker pull mysql:8.0

# 启动容器
docker run -d \
  --name mysql-dev \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root123 \
  -e MYSQL_DATABASE=testdb \
  -v mysql-data:/var/lib/mysql \
  mysql:8.0

# 进入容器连接 MySQL
docker exec -it mysql-dev mysql -uroot -proot123

# 查看日志
docker logs -f mysql-dev
```

> **注意**：生产环境**不要**使用 `-e MYSQL_ROOT_PASSWORD` 明文传递密码，应使用 Docker Secrets 或 `.env` 文件。

***

## 二、核心配置文件（my.cnf）

### 2.1 配置文件位置与加载顺序

| 位置 | 说明 |
|:-----|:-----|
| `/etc/my.cnf` | 全局配置（所有用户共用） |
| `/etc/mysql/my.cnf` | Debian/Ubuntu 系默认全局配置 |
| `~/.my.cnf` | 用户级配置（覆盖全局） |
| `/etc/mysql/conf.d/*.cnf` | 额外配置片段（Debian/Ubuntu） |
| `/etc/mysql/mysql.conf.d/mysqld.cnf` | mysqld 专用配置（Debian/Ubuntu） |

**加载顺序**：`/etc/my.cnf` → `/etc/mysql/my.cnf` → `/etc/mysql/conf.d/` → 用户目录 `.my.cnf`，后者覆盖前者。

### 2.2 常用 my.cnf 参数

```ini
[mysqld]
# ---- 基础配置 ----
port = 3306
socket = /var/run/mysqld/mysqld.sock
datadir = /var/lib/mysql
pid-file = /var/run/mysqld/mysqld.pid

# ---- 字符集（推荐 UTF-8） ----
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
init_connect = 'SET NAMES utf8mb4'

# ---- 连接相关 ----
max_connections = 200          # 最大连接数
max_connect_errors = 100       # 最大连接错误次数（超过后封禁 IP）
wait_timeout = 28800           # 非交互连接超时时间（秒）
interactive_timeout = 28800    # 交互连接超时时间（秒）

# ---- InnoDB 核心参数 ----
innodb_buffer_pool_size = 1G   # Buffer Pool 大小（建议物理内存的 50%-70%）
innodb_log_file_size = 256M    # Redo Log 文件大小
innodb_flush_log_at_trx_commit = 1  # 1=每次提交刷盘（最安全）
sync_binlog = 1                # 每次提交同步 binlog（最安全）
innodb_file_per_table = ON     # 每表一个独立表空间

# ---- 日志配置 ----
log_error = /var/log/mysql/error.log
slow_query_log = ON
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 1            # 慢查询阈值（秒）

# ---- binlog（用于主从复制和数据恢复） ----
server-id = 1
log-bin = mysql-bin
binlog_format = ROW            # 推荐 ROW 格式
expire_logs_days = 7           # binlog 保留天数
```

### 2.3 字符集配置要点

```sql
-- 查看当前字符集配置
SHOW VARIABLES LIKE 'character_set%';
SHOW VARIABLES LIKE 'collation%';

-- 推荐配置：utf8mb4（支持 emoji 和所有 Unicode 字符）
-- 注意：MySQL 中 utf8 只支持 3 字节，不能存储 emoji，必须用 utf8mb4
```

**最佳实践**：在 `my.cnf` 中统一配置字符集，建库建表时无需单独指定，避免字符集混乱。

***

## 三、启动与服务管理

### 3.1 systemctl 命令

```bash
# 启动/停止/重启
sudo systemctl start mysql
sudo systemctl stop mysql
sudo systemctl restart mysql

# 查看状态
sudo systemctl status mysql

# 开机自启/取消
sudo systemctl enable mysql
sudo systemctl disable mysql

# 重新加载配置（不重启服务）
sudo systemctl reload mysql
```

### 3.2 MySQL 命令行管理

```bash
# 连接 MySQL
mysql -u root -p
mysql -u root -p -h 127.0.0.1 -P 3306    # 指定主机和端口
mysql -u root -p -D testdb                # 指定默认数据库

# 执行 SQL 文件
mysql -u root -p testdb < /path/to/init.sql

# 查看服务状态（MySQL 内部）
SHOW STATUS LIKE 'Threads_connected';  # 当前连接数
SHOW PROCESSLIST;                      # 查看当前所有连接
SHOW VARIABLES LIKE 'max_connections'; # 查看最大连接数
```

### 3.3 远程访问配置

MySQL 8.0 默认只允许 root 本地访问，远程访问需要创建专用用户：

```sql
-- 创建远程访问用户（MySQL 8.0+）
CREATE USER 'appuser'@'%' IDENTIFIED BY 'strong_password';
GRANT ALL PRIVILEGES ON testdb.* TO 'appuser'@'%';
FLUSH PRIVILEGES;

-- 更安全：只允许特定 IP 段
CREATE USER 'appuser'@'192.168.1.%' IDENTIFIED BY 'strong_password';
GRANT ALL PRIVILEGES ON testdb.* TO 'appuser'@'192.168.1.%';
FLUSH PRIVILEGES;
```

***

## 四、Docker 多版本共存技巧

```bash
# 同时运行 MySQL 5.7 和 8.0
docker run -d --name mysql57 -p 3307:3306 \
  -e MYSQL_ROOT_PASSWORD=root123 \
  -v mysql57-data:/var/lib/mysql \
  mysql:5.7

docker run -d --name mysql80 -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root123 \
  -v mysql80-data:/var/lib/mysql \
  mysql:8.0

# 分别连接
mysql -h 127.0.0.1 -P 3307 -uroot -proot123   # MySQL 5.7
mysql -h 127.0.0.1 -P 3306 -uroot -proot123   # MySQL 8.0
```

***

## 五、常见安装问题排查

| 问题 | 原因 | 解决方案 |
|:-----|:-----|:---------|
| `Can't connect to local MySQL server` | MySQL 未启动或 socket 文件不存在 | `sudo systemctl start mysql` |
| `Access denied for user 'root'@'localhost'` | 密码错误或用户被锁 | `sudo systemctl stop mysql` → `mysqld --skip-grant-tables` → 重置密码 |
| `Too many connections` | 连接数超限 | 临时：`SET GLOBAL max_connections=500;`；永久：修改 `my.cnf` |
| `Table doesn't exist`（Docker） | 数据卷权限问题 | `sudo chown -R 1000:1000 /var/lib/mysql` 或重建容器 |
| `Authentication plugin 'caching_sha2_password'` | 旧客户端不兼容 | `ALTER USER 'user'@'%' IDENTIFIED WITH mysql_native_password BY 'password';` |

***
