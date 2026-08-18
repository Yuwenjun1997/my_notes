---
url: >-
  /my_notes/notes/JAVA学习路线/shen-du-xue-xi/04-yun-wei-yu-gong-cheng-hua/4-xing-neng-ce-shi-yu-tiao-you/index.md
---
# 性能测试与调优

## 一、JMeter 性能测试

### 1.1 测试计划结构

JMeter 测试计划采用树状层级结构，核心组件如下：

```
Test Plan (测试计划)
├── User Defined Variables (用户自定义变量)
├── Thread Group (线程组)               ← 模拟并发用户
│   ├── Config Element                  ← 配置元件
│   │   ├── CSV Data Set Config         ← CSV参数化
│   │   ├── HTTP Cookie Manager         ← Cookie管理
│   │   └── HTTP Request Defaults       ← HTTP默认值
│   ├── Pre Processor                   ← 前置处理器
│   │   ├── User Parameters             ← 用户参数
│   │   └── JSR223 PreProcessor         ← 脚本预处理
│   ├── Sampler (取样器)                ← 发送请求
│   │   └── HTTP Request                ← HTTP请求
│   ├── Assertion (断言)                ← 结果校验
│   │   ├── Response Assertion          ← 响应断言
│   │   └── JSON Assertion              ← JSON断言
│   ├── Post Processor (后置处理器)     ← 提取数据
│   │   ├── Regular Expression Extractor  ← 正则提取
│   │   └── JSON Extractor              ← JSON提取
│   └── Listener (监听器)               ← 结果收集
│       ├── View Results Tree           ← 结果树（调试用）
│       ├── Summary Report              ← 汇总报告
│       └── Aggregate Report            ← 聚合报告
```

### 1.2 线程组配置详解

```xml
<!-- 等价 JMeter GUI 配置 -->
<ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="用户线程组">
  <intProp name="ThreadGroup.num_threads">100</intProp>         <!-- 线程数(虚拟用户数) -->
  <intProp name="ThreadGroup.ramp_time">30</intProp>            <!-- 启动时间(秒) -->
  <boolProp name="ThreadGroup.same_user_on_next_iteration">false</boolProp>
  <stringProp name="ThreadGroup.on_sample_error">continue</stringProp>  <!-- 错误后继续 -->
  <elementProp name="ThreadGroup.main_controller" elementType="LoopController">
    <boolProp name="LoopController.continuous">false</boolProp>
    <intProp name="LoopController.loops">10</intProp>           <!-- 循环次数 -->
  </elementProp>
</ThreadGroup>
```

**核心参数说明：**

| 参数 | 说明 | 推荐设置 |
|------|------|---------|
| Number of Threads | 并发用户数 | 按业务规模递增加压（50 → 100 → 200 → 500） |
| Ramp-up Period | 启动时长（秒） | 总线程数 / 每秒启动数，如 100 线程 30s 内启动 |
| Loop Count | 循环次数 | 压测持续时长 = ramp\_time + (loop\_count - 1) \* 单次耗时 |
| Same User on Next Iteration | 是否重用用户 | Cookie/Session 场景设为 false |

**三种常见施压模式：**

```bash
# 模式一：恒定负载
# 线程数 100，时长 600s，每秒恒定 100 QPS
jmeter -n -t test.jmx -Jthreads=100 -Jduration=600

# 模式二：阶梯加压（需要 jp@gc - Stepping Thread Group 插件）
# 每 60s 增加 20 线程，观察拐点性能

# 模式三：峰值突增（需要 jp@gc - Ultimate Thread Group 插件）
# 模拟秒杀/大促场景：0→100→500→1000→200→0
```

### 1.3 参数化 — CSV Data Set Config

```xml
<!-- CSV 参数化配置 -->
<CSVDataSet guiclass="TestBeanGUI" testclass="CSVDataSet" testname="用户数据参数化">
  <stringProp name="filename">/data/test_users.csv</stringProp>      <!-- CSV 文件路径 -->
  <stringProp name="fileEncoding">UTF-8</stringProp>                 <!-- 文件编码 -->
  <stringProp name="variableNames">userId,username,token</stringProp> <!-- 变量名（逗号分隔）-->
  <stringProp name="delimiter">,</stringProp>                        <!-- 分隔符 -->
  <boolProp name="quotedData">true</boolProp>                        <!-- 引号数据 -->
  <boolProp name="recycle">true</boolProp>                           <!-- 读取完毕是否循环 -->
  <boolProp name="stopThread">false</boolProp>                       <!-- 读取完毕是否停止线程 -->
  <stringProp name="sharingMode">all</stringProp>                    <!-- 共享模式 -->
</CSVDataSet>
```

**CSV 数据文件示例 (test\_users.csv)：**

```csv
userId,username,token
1001,zhangsan,token_abc_1001
1002,lisi,token_def_1002
1003,wangwu,token_ghi_1003
...
```

**在 HTTP 请求中使用参数化变量：**

```bash
# 直接引用：${variableName}
# 路径中使用：/api/user/${userId}
# 参数中使用：username=${username}
# Headers 中使用：Authorization: Bearer ${token}
```

### 1.4 断言配置

```xml
<!-- ===== 响应断言 ===== -->
<ResponseAssertion guiclass="AssertionGui" testclass="ResponseAssertion" testname="响应断言">
  <collectionProp name="Asserion.test_strings">
    <stringProp name="-1">"code":200</stringProp>   <!-- 断言响应包含指定内容 -->
    <stringProp name="-1">"success":true</stringProp>
  </collectionProp>
  <stringProp name="Assertion.test_field">ASSERTION_TEXT_RESPONSE</stringProp>  <!-- 检查响应文本 -->
  <boolProp name="Assertion.assume_success">false</boolProp>   <!-- 是否仅对成功响应断言 -->
  <intProp name="Assertion.test_type">2</intProp>              <!-- 2=包含(Contains), 1=等于(Equals), 6=匹配(Match) -->
</ResponseAssertion>

<!-- ===== 响应时间断言 ===== -->
<DurationAssertion guiclass="DurationAssertionGui" testclass="DurationAssertion" testname="响应时间断言">
  <longProp name="DurationAssertion.duration">3000</longProp>  <!-- 接口响应超过 3s 判为失败 -->
</DurationAssertion>

<!-- ===== JSON 断言 ===== -->
<JSONPathAssertion guiclass="JSONPathAssertionGui" testclass="JSONPathAssertion" testname="JSON断言">
  <stringProp name="JSON_PATH">$.data.status</stringProp>      <!-- JSONPath 表达式 -->
  <stringProp name="EXPECTED_VALUE">ACTIVE</stringProp>        <!-- 期望值 -->
  <boolProp name="JSONVALIDATION">true</boolProp>              <!-- 是否校验 JSON 合法性 -->
  <boolProp name="EXPECT_NULL">false</boolProp>
  <boolProp name="INVERT">false</boolProp>                     <!-- 反向断言 -->
  <boolProp name="ISREGEX">false</boolProp>                    <!-- 是否使用正则 -->
</JSONPathAssertion>
```

### 1.5 关联 — 后置处理器

```xml
<!-- ===== 正则表达式提取器 ===== -->
<RegexExtractor guiclass="RegexExtractorGui" testclass="RegexExtractor" testname="提取token">
  <stringProp name="RegexExtractor.referenceName">authToken</stringProp>   <!-- 变量名 -->
  <stringProp name="RegexExtractor.regex">"token":"([^"]+)"</stringProp>   <!-- 正则表达式 -->
  <stringProp name="RegexExtractor.template">$1$</stringProp>              <!-- 模板：$1$ 表示第一个捕获组 -->
  <stringProp name="RegexExtractor.match_number">1</stringProp>            <!-- 匹配序号：1 表示第1个匹配 -->
  <stringProp name="RegexExtractor.default">NOT_FOUND</stringProp>         <!-- 默认值 -->
  <stringProp name="RegexExtractor.headers">false</stringProp>             <!-- 是否搜索响应头 -->
</RegexExtractor>

<!-- ===== JSON Extractor ===== -->
<JSONPostProcessor guiclass="JSONPostProcessorGui" testclass="JSONPostProcessor" testname="提取订单ID">
  <stringProp name="JSONPostProcessor.referenceNames">orderId</stringProp>         <!-- 变量名 -->
  <stringProp name="JSONPostProcessor.jsonPathExprs">$.data.orderId</stringProp>   <!-- JSONPath -->
  <stringProp name="JSONPostProcessor.match_numbers">1</stringProp>                <!-- 匹配序号 -->
</JSONPostProcessor>
```

**关联典型场景 — 登录态传递：**

```bash
# 流程：登录 → 获取 token → 携带 token 访问业务接口
# 1. 登录接口（正则提取器提取 token）
#    JSON 响应：{"code":200,"data":{"token":"eyJhbGciOiJIUzI1NiJ9..."}}
#    正则：eyJ([^"]+).*                → ${jwtToken}
#    或 JSONPath：$.data.token         → ${jwtToken}

# 2. 后续接口（使用 HTTP Header Manager 传递 token）
#    Authorization: Bearer ${jwtToken}
```

### 1.6 分布式压测

**架构说明：**

```
Master (Controller)           — 控制机：负责分发脚本、收集结果
  ├── Agent / Slave 1         — 施压机：实际发送请求
  ├── Agent / Slave 2
  └── Agent / Slave N
```

**配置步骤：**

```bash
# ===== Agent (Slave) 端配置 =====
# 1. 修改 jmeter.properties
# vim apache-jmeter-5.6.2/bin/jmeter.properties

server.rmi.ssl.disable=true              # 关闭 SSL（内外网隔离时可开启）
server.rmi.localhostname=192.168.1.101   # Agent 本机 IP
server_port=1099                         # RMI 端口
server.rmi.port=1099

# 2. 启动 Agent（每台施压机）
jmeter-server -Djava.rmi.server.hostname=192.168.1.101

# ===== Master (Controller) 端配置 =====
# 1. 修改 jmeter.properties
remote_hosts=192.168.1.101:1099,192.168.1.102:1099,192.168.1.103:1099
mode=Standard                            # 结果收集模式
client.rmi.localport=1100

# 2. 启动 Master 远程执行
jmeter -n -t /data/test-plan.jmx \
    -R 192.168.1.101,192.168.1.102,192.168.1.103 \
    -l /data/results.jtl \
    -e -o /data/report/

# 参数说明：
# -n: 非 GUI 模式
# -t: 测试计划文件
# -R: 指定远程 Agent
# -l: 结果文件（JTL 格式）
# -e -o: 生成 HTML 报告
```

**分布式压测注意事项：**

```bash
# 1. 施压机与被测服务网络延迟应尽量低
# 2. CSV 参数文件需分发到每台 Agent（相同路径）
# 3. 控制机不要参与施压（仅做调度）
# 4. 避免使用 GUI 模式进行压测
# 5. 控制机 CPU/内存需充足，否则会成为瓶颈

# 查看 Agent 负载
top -H -p $(pgrep -f JMeter)

# 防火墙开放端口
firewall-cmd --add-port=1099/tcp --add-port=1100/tcp --permanent
```

### 1.7 主要性能指标

| 指标 | 说明 | 计算方式 | 参考阈值 |
|------|------|---------|---------|
| TPS (Transactions Per Second) | 每秒事务数 | 总事务数 / 耗时(秒) | 越高越好 |
| QPS (Queries Per Second) | 每秒查询数 | 总请求数 / 耗时(秒) | 越高越好 |
| P50 (中位数响应时间) | 50% 请求在此时长内完成 | 响应时间排序取中位 | < 200ms |
| P95 (95分位响应时间) | 95% 请求在此时长内完成 | 响应时间排序取 95% 位 | < 500ms |
| P99 (99分位响应时间) | 99% 请求在此时长内完成 | 响应时间排序取 99% 位 | < 1000ms |
| Error Rate | 错误率 | 错误请求数 / 总请求数 × 100% | < 0.1% |
| Throughput | 吞吐量 | 单位时间内处理的请求数 | 越高越好 |

**JMeter HTML 报告关键图表示例：**

```bash
# 生成 HTML 报告
jmeter -g results.jtl -o report/

# 报告包含：
# - Dashboard（概览：TPS、响应时间、错误率）
# - Charts（随时间变化的曲线图）
# - Statistics（各接口详细统计）
# - Errors（错误分布详情）
# - Top 5 Errors（最常见错误 TOP5）
```

***

## 二、性能瓶颈分析思路

### 2.1 系统性排查流程

```bash
# ==== 宏观排查 ====
# 1. 查看系统整体负载
top -H
# %CPU, %MEM, load average（1/5/15min）

# 2. 查看 CPU 分解
mpstat -P ALL 1
# %usr(用户态), %sys(内核态), %iowait(IO等待), %idle(空闲)

# 3. 查看内存
free -h
# total, used, buff/cache, available

# 4. 查看磁盘 IO
iostat -x 1
# r/s(读IOPS), w/s(写IOPS), await(IO等待时间), %util(磁盘利用率)

# 5. 查看网络
sar -n DEV 1
# rxkB/s, txkB/s 网络吞吐量

# 6. 查看进程级别
pidstat -p $(pgrep -f user-service) 1
# CPU、内存、线程变化
```

### 2.2 CPU 高排查

**现象：** `top` 显示 CPU 使用率持续 > 90%，服务响应变慢。

**排查步骤：**

```bash
# 1. 找到 CPU 最高的进程
top -o %CPU
# 记录 PID（假设 12345）

# 2. 查看该进程的线程 CPU 占用
top -H -p 12345
# 或
ps -mp 12345 -o THREAD,tid,time

# 3. 将高 CPU 线程 ID 转换十六进制
printf '%x\n' 12358   # 输出：3046

# 4. 获取线程堆栈（多次采样以确定热点）
jstack 12345 | grep -A 30 '0x3046'
# 或连续采样 5 次
for i in $(seq 1 5); do
  jstack 12345 > /tmp/thread_dump_$i.txt
  sleep 2
done

# 5. 分析堆栈中的热点方法
cat thread_dump_*.txt | grep -E "^\s+at" | sort | uniq -c | sort -rn | head -20
```

**常见 CPU 高原因：**

| 原因 | 特征 | 解决方案 |
|------|------|---------|
| 死循环 | 堆栈显示固定方法反复出现 | 检查 while/for 循环退出条件 |
| 频繁 Full GC | GC 线程 CPU 高 + `jstat -gcutil` 显示 FGCT 持续增大 | 调 JVM 参数、检查内存泄漏 |
| 正则回溯 | 堆栈显示 Pattern 类方法 | 优化正则表达式、控制输入长度 |
| 序列化/反序列化 | 堆栈显示 ObjectInputStream/ObjectOutputStream | 使用更高效的序列化协议（Protobuf） |
| 大量计算 | 堆栈显示业务逻辑方法 | 增加缓存、优化算法 |

```bash
# 查看 GC 情况
jstat -gcutil 12345 1000 10
# S0  S1  E   O   M  YGC  YGCT  FGC  FGCT  GCT
# 0.00 0.00 45.00 70.00 95.00 1200 12.34 5 20.45 32.79
# FGC 持续增大 = 频繁 Full GC

# 查看堆内存详情
jmap -heap 12345

# 快速查看存活大对象
jmap -histo:live 12345 | head -30
```

### 2.3 内存高排查

**现象：** 内存占用持续上升，最终 OOM 或被 OOM Killer 杀掉。

**排查步骤：**

```bash
# 1. 确认内存使用情况
free -m
# 重点关注 available（真正可用内存）

# 2. 查看进程堆内存
jmap -heap 12345

# 3. 查看堆中对象分布（查看大对象和异常对象）
jmap -histo:live 12345 | head -30
# num     #instances         #bytes  class name
# ----------------------------------------------
# 1:        1200000      96000000  [B         ← byte 数组（通常是大对象元凶）
# 2:         800000      64000000  java.util.HashMap$Node
# 3:         500000      40000000  com.example.model.OrderDTO
# ...

# 4. 持续监控 GC 情况（确认是否有内存泄漏）
jstat -gc 12345 1000 10
# EU: Eden 区使用量持续增长且 Full GC 后回收不明显 = 内存泄漏

# 5. 导出堆转储文件分析
jmap -dump:live,format=b,file=/tmp/heap.hprof 12345

# 6. 使用 MAT (Memory Analyzer Tool) 分析 hprof
# 命令行快速查看大对象
jhat /tmp/heap.hprof
# 访问 http://localhost:7000 查看
```

**常见内存问题：**

| 问题 | 特征 | 解决方案 |
|------|------|---------|
| 堆内存泄漏 | GC 后老年代持续增长 | 检查 ThreadLocal、静态集合、未关闭的连接 |
| 大对象 | 直接进入老年代的超大 byte\[]、char\[] | 分页查询、调整批处理大小 |
| 元空间泄漏 | 重复加载类（热部署/CGLIB） | 检查类加载器泄漏 |
| 堆外内存 | NIO Buffer 未释放 | 使用 DirectBuffer 监控工具 |

```bash
# 自动生成堆转储（配合 JVM 参数）
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/app/dumps/
-XX:+PrintGCDetails
-XX:+PrintGCDateStamps
-Xloggc:/app/logs/gc.log
```

### 2.4 IO 高排查

**现象：** `iostat` 显示磁盘 %util > 90% 或 await > 100ms。

```bash
# 1. 查看磁盘 IO 情况
iostat -x 1 5
# Device  r/s   w/s  rkB/s  wkB/s  await  svctm  %util
# sda     1200  800  48000  32000  80.0   0.35   85.0
# %util 接近 100% = 磁盘成为瓶颈

# 2. 查找 IO 高的进程
iotop -oP
# 或
pidstat -d 1

# 3. 如果是 Java 进程 IO 高，检查：
# - 日志配置：日志级别是否过高（DEBUG）
# - 数据库：慢查询、全表扫描
# - 文件读写：大数据量文件操作

# 追踪文件 IO（Linux）
strace -f -e trace=write -p 12345 2>&1 | grep "\.log"
```

**IO 高常见原因：**

| 原因 | 排查方法 | 解决方案 |
|------|---------|---------|
| 日志过多 | `lsof -p 12345` 查看打开的文件 | 降低日志级别、设置日志滚动 |
| 慢查询 | 慢查询日志 + `SHOW PROCESSLIST` | 加索引、SQL 优化 |
| 大量磁盘排序 | `SHOW STATUS LIKE 'Sort%'` | 优化排序字段、增加 sort\_buffer |
| 缓冲池太小 | `SHOW STATUS LIKE 'Innodb_buffer_pool%'` | 增大 innodb\_buffer\_pool\_size |

### 2.5 线程阻塞排查

**现象：** 服务无响应、请求堆积、`jstack` 发现大量线程处于 BLOCKED / WAITING 状态。

```bash
# 1. 查看 Java 进程线程状态分布
jstack 12345 | grep -E "java.lang.Thread.State:" | sort | uniq -c
# 输出示例：
#  45   java.lang.Thread.State: RUNNABLE
#  30   java.lang.Thread.State: TIMED_WAITING (parking)
#  20   java.lang.Thread.State: BLOCKED                ← 锁竞争严重
#   5   java.lang.Thread.State: WAITING (parking)

# 2. 查看死锁检测
jstack -l 12345 | grep -A 20 "Found one Java-level deadlock"

# 3. 持续监控线程状态变化
while true; do
  date >> thread_monitor.log
  jstack 12345 | grep -E "java.lang.Thread.State:" >> thread_monitor.log
  sleep 5
done

# 4. 分析锁等待链
jstack 12345 | grep -A 5 "waiting to lock"
```

**常见线程问题：**

| 问题 | 特征 | 排查方法 |
|------|------|---------|
| 死锁 | 两个线程互相持有对方需要的锁 | `jstack -l` 直接检测 |
| 锁竞争 | 大量线程 BLOCKED 等待同一把锁 | 查看锁对象、优化锁粒度 |
| 线程饥饿 | 低优先级线程长时间得不到执行 | 检查 ReentrantLock 公平性设置 |
| 线程泄漏 | 线程池中活跃线程数持续增加 | 检查任务是否未正常结束 |

***

## 三、数据库性能优化

### 3.1 慢查询定位

```sql
-- ===== 开启慢查询日志 =====
-- MySQL 5.7+
SET GLOBAL slow_query_log = ON;
SET GLOBAL slow_query_log_file = '/var/log/mysql/slow.log';
SET GLOBAL long_query_time = 2;         -- 超过 2 秒的记录
SET GLOBAL log_queries_not_using_indexes = ON;  -- 记录未使用索引的查询

-- MySQL 8.0+（持久化配置）
-- my.cnf:
-- [mysqld]
-- slow_query_log = 1
-- slow_query_log_file = /var/log/mysql/slow.log
-- long_query_time = 2
-- log_queries_not_using_indexes = 1

-- ===== 查看当前执行的查询 =====
SHOW FULL PROCESSLIST;
-- 重点关注：Time（执行时间）、State（状态）、Info（SQL语句）
-- 常见长时间等待状态：
-- Sending data        → 正在检索大量数据行
-- Creating sort index → 排序操作
-- Waiting for table   → 表锁等待
-- Locked              → 行锁等待

-- ===== 分析慢查询 =====
EXPLAIN SELECT
    o.id, o.order_no, o.amount, u.name
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
WHERE o.created_at > '2024-01-01'
ORDER BY o.amount DESC
LIMIT 100;

-- EXPLAIN 输出关键字段：
-- id: 查询序号
-- select_type: SIMPLE/PRIMARY/SUBQUERY/UNION
-- table: 表名
-- type: ALL(全表扫描) | index(索引扫描) | range(范围扫描) | ref(非唯一索引) | eq_ref(唯一索引) | const(常量)
-- possible_keys: 可能使用的索引
-- key: 实际使用的索引
-- rows: 扫描行数（估算）
-- Extra: Using where / Using index / Using filesort / Using temporary
```

### 3.2 索引优化

```sql
-- ===== 常见索引类型 =====
-- 1. 单列索引
CREATE INDEX idx_user_id ON orders(user_id);

-- 2. 联合索引（最左前缀原则）
CREATE INDEX idx_user_status_created ON orders(user_id, status, created_at);

-- 3. 覆盖索引（查询字段全部包含在索引中，避免回表）
-- orders 表上 idx_user_status_created 覆盖了 user_id、status、created_at
-- 以下查询可直接从索引返回，无需回表
EXPLAIN SELECT user_id, status, created_at FROM orders WHERE user_id = 1001;

-- 4. 前缀索引（大字段只索引前 N 位）
CREATE INDEX idx_title_prefix ON articles(title(20));

-- ===== 索引设计原则 =====
-- 1. 区分度高的列放前面（selectivity = COUNT(DISTINCT col) / COUNT(*)）
-- 2. 等值条件放前面，范围条件放后面
-- 3. 频繁排序的字段包含在索引中（避免 filesort）
-- 4. 小表不需要索引（全表扫描更快）

-- ===== 查看索引使用情况 =====
SHOW INDEX FROM orders;
-- Cardinality 越大 = 区分度越高

-- ===== 索引失效常见场景 =====
-- 1. 对索引列使用函数
WHERE DATE(created_at) = '2024-01-15'     -- 失效
WHERE created_at >= '2024-01-15' AND created_at < '2024-01-16'  -- 生效

-- 2. 隐式类型转换
WHERE user_id = '1001'  -- user_id 为 INT 类型，字符串比较导致索引失效

-- 3. LIKE 以通配符开头
WHERE name LIKE '%张三%'    -- 失效
WHERE name LIKE '张三%'     -- 生效

-- 4. OR 条件中包含非索引列
WHERE user_id = 1001 OR status = 1  -- user_id 有索引但 status 无索引，全表扫描
```

### 3.3 连接池调优

```yaml
# HikariCP 推荐配置（Spring Boot 默认连接池）
spring:
  datasource:
    hikari:
      # 核心配置
      maximum-pool-size: 20          # 最大连接数（核心参数）
      minimum-idle: 10               # 最小空闲连接
      connection-timeout: 5000       # 获取连接超时（ms）
      idle-timeout: 600000           # 空闲超时（10min）
      max-lifetime: 1800000          # 最大存活时间（30min）
      keepalive-time: 300000         # 保活检测间隔（5min）
      validation-timeout: 3000       # 连接检测超时

      # 连接池大小计算公式
      # PoolSize = Tn × (Cm - 1) / Cm
      # Tn: 核心线程数（如 8）
      # Cm: 单个连接上的并发请求数（通常取 3-5）
      # 推荐值：8 × (3-1)/3 ≈ 6 至 8 × (5-1)/5 ≈ 7
      # 实际值建议在 10~30 之间，压测后确定
```

**连接池大小选择：**

```bash
# 经验公式
# 公式一：PoolSize = ((core_count * 2) + effective_spindle_count)
#         8 核 CPU + 2 个磁盘 = 18

# 公式二：PoolSize = Tn × (Cm - 1) / Cm
#         Tn 为线程数, Cm 为每个连接上的并发请求数

# 实际建议：
# - CPU 密集型：10~15 连接（线程数 = CPU核数 + 1）
# - IO 密集型：20~30 连接（增加连接以提高吞吐）
# - 混合型：15~20 连接

# 压测验证：逐步增加连接数，观察 TPS 拐点
# TPS 不再明显增长或响应时间开始劣化时即为最佳值
```

### 3.4 SQL 改写技巧

```sql
-- ===== 技巧1：避免 SELECT * =====
-- 差
SELECT * FROM orders WHERE user_id = 1001;
-- 好
SELECT id, order_no, amount, status FROM orders WHERE user_id = 1001;

-- ===== 技巧2：分页优化（延迟关联）=====
-- 差（OFFSET 越大越慢）
SELECT * FROM orders ORDER BY id LIMIT 100000, 20;
-- 好（先查 ID 再关联原表）
SELECT * FROM orders
INNER JOIN (
    SELECT id FROM orders ORDER BY id LIMIT 100000, 20
) AS tmp ON orders.id = tmp.id;

-- ===== 技巧3：分批处理替代全量更新 =====
-- 差（一次性更新 100 万行，锁大量行）
UPDATE orders SET status = 'PROCESSED' WHERE created_at < '2023-01-01';
-- 好（分批更新，减少锁范围）
DO $$
DECLARE
    affected_rows INTEGER;
BEGIN
    LOOP
        UPDATE orders SET status = 'PROCESSED'
        WHERE id IN (
            SELECT id FROM orders
            WHERE created_at < '2023-01-01' AND status != 'PROCESSED'
            LIMIT 1000
        );
        GET DIAGNOSTICS affected_rows = ROW_COUNT;
        EXIT WHEN affected_rows = 0;
        COMMIT;
    END LOOP;
END $$;

-- ===== 技巧4：用 EXISTS 替代 IN（子查询结果集大时）=====
-- 差
SELECT * FROM users WHERE id IN (SELECT user_id FROM orders);
-- 好
SELECT * FROM users WHERE EXISTS (SELECT 1 FROM orders WHERE orders.user_id = users.id);

-- ===== 技巧5：合理利用 UNION ALL 替代 OR =====
-- 差
SELECT * FROM orders WHERE status = 'PAID' OR status = 'SHIPPED';
-- 好（可以分别利用不同索引）
SELECT * FROM orders WHERE status = 'PAID'
UNION ALL
SELECT * FROM orders WHERE status = 'SHIPPED';

-- ===== 技巧6：使用复合索引排序 =====
-- 在 (user_id, created_at) 上有联合索引
-- 差（filesort）
SELECT * FROM orders WHERE user_id = 1001 ORDER BY amount DESC;
-- 好（利用索引排序）
SELECT * FROM orders WHERE user_id = 1001 ORDER BY created_at DESC;
```

***

## 四、应用层面调优

### 4.1 JVM 参数调优

```bash
# ===== 生产环境 JVM 参数推荐 =====
JAVA_OPTS="-server                                          # 服务器模式
    -Xms4g -Xmx4g                                           # 堆大小（初始=最大，避免扩容开销）
    -Xmn2g                                                  # 年轻代大小
    -XX:MetaspaceSize=256m -XX:MaxMetaspaceSize=256m        # 元空间
    -XX:+UseG1GC                                            # G1 垃圾回收器
    -XX:MaxGCPauseMillis=200                                # 目标最大 GC 停顿时间(ms)
    -XX:InitiatingHeapOccupancyPercent=45                   # 触发并发标记的堆占用百分比
    -XX:G1HeapRegionSize=4m                                 # G1 Region 大小
    -XX:+ParallelRefProcEnabled                             # 并行处理引用对象
    -XX:-ResizePLAB                                         # 禁用 PLAB 大小调整
    -XX:+DisableExplicitGC                                  # 禁用 System.gc()
    -XX:+HeapDumpOnOutOfMemoryError                         # OOM 时生成堆转储
    -XX:HeapDumpPath=/app/dumps/                            # 堆转储路径
    -Xloggc:/app/logs/gc.log                                # GC 日志
    -XX:+PrintGCDetails                                     # GC 详情
    -XX:+PrintGCDateStamps                                  # GC 时间戳
    -XX:+UseGCLogFileRotation                               # GC 日志滚动
    -XX:NumberOfGCLogFiles=10                               # 保留 10 个 GC 日志
    -XX:GCLogFileSize=10M                                   # 每个 10M
    -Djava.security.egd=file:/dev/./urandom                 # 加速 SecureRandom
    -Dfile.encoding=UTF-8                                   # 文件编码
"

# ===== 不同场景 JVM 配置参考 =====
# 场景1：高吞吐批处理（离线计算）
JAVA_OPTS="-Xms8g -Xmx8g -Xmn6g -XX:+UseParallelGC -XX:ParallelGCThreads=8"

# 场景2：低延迟在线服务（响应时间敏感）
JAVA_OPTS="-Xms4g -Xmx4g -Xmn2g -XX:+UseG1GC -XX:MaxGCPauseMillis=100 \
    -XX:ParallelGCThreads=4 -XX:ConcGCThreads=2"

# 场景3：大内存机器（32G+）
JAVA_OPTS="-Xms16g -Xmx16g -Xmn8g -XX:+UseG1GC -XX:G1HeapRegionSize=16m \
    -XX:+UnlockExperimentalVMOptions -XX:G1NewSizePercent=10 \
    -XX:G1MaxNewSizePercent=50 -XX:G1HeapWastePercent=5"
```

**GC 选择指南：**

| GC | 适用场景 | 特点 |
|------|---------|------|
| Serial GC | 单线程、小内存 < 100M | 单线程暂停，延迟高 |
| Parallel GC | 高吞吐、批处理 | 多线程并行，追求吞吐量 |
| CMS | 低延迟（JDK9 废弃） | 并发标记清除，CPU 敏感 |
| G1 GC | 通用标配、4G+ 堆内存 | 分区管理，可预测停顿 |
| ZGC | 超低延迟 < 10ms、TB 级堆 | 染色指针，几乎无停顿 |
| Shenandoah | 低延迟 | 并发压缩，与 ZGC 类似 |

### 4.2 线程池调优

```java
// ===== 线程池核心参数 =====
@Bean("bizThreadPool")
public ThreadPoolTaskExecutor bizThreadPool() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();

    // 核心参数配置
    executor.setCorePoolSize(8);                // 核心线程数
    executor.setMaxPoolSize(16);                // 最大线程数
    executor.setQueueCapacity(200);             // 队列容量
    executor.setKeepAliveSeconds(60);           // 空闲线程存活时间
    executor.setThreadNamePrefix("biz-exec-");  // 线程名前缀

    // 拒绝策略
    executor.setRejectedExecutionHandler(
        new ThreadPoolExecutor.CallerRunsPolicy()  // 由调用线程执行
        // new ThreadPoolExecutor.AbortPolicy()    // 抛出异常（默认）
        // new ThreadPoolExecutor.DiscardPolicy()   // 丢弃任务
        // new ThreadPoolExecutor.DiscardOldestPolicy() // 丢弃最旧任务
    );

    // 预启动核心线程
    executor.setPrestartAllCoreThreads(true);

    // 等待所有任务完成再关闭
    executor.setWaitForTasksToCompleteOnShutdown(true);
    executor.setAwaitTerminationSeconds(30);

    executor.initialize();
    return executor;
}

// ===== 线程池大小计算公式 =====
// N_CPU = Runtime.getRuntime().availableProcessors()

// CPU 密集型任务：
// 线程数 = N_CPU + 1（保持 CPU 满载，+1 补偿缺页中断）
// 示例：8核 → 9线程

// IO 密集型任务：
// 线程数 = N_CPU * (1 + IO_WAIT_TIME / CPU_TIME)
// 示例：CPU 20ms + IO 80ms = 8 * (1 + 80/20) = 40线程

// 混合型应用：
// 线程数 = N_CPU * (1 + W / C)
// W = 等待时间（IO、网络、DB），C = 计算时间

// ===== 线程池监控 =====
@Component
@Slf4j
public class ThreadPoolMonitor {
    private final ThreadPoolTaskExecutor executor;

    public ThreadPoolMonitor(@Qualifier("bizThreadPool") ThreadPoolTaskExecutor executor) {
        this.executor = executor;
        // 启动监控定时任务
        scheduleMonitor();
    }

    @Scheduled(fixedRate = 10000)
    public void monitor() {
        ThreadPoolExecutor pool = executor.getThreadPoolExecutor();
        log.info("线程池监控=== active={}, core={}, max={}, queue={}, completed={}, rejected={}",
            pool.getActiveCount(),
            pool.getCorePoolSize(),
            pool.getMaximumPoolSize(),
            pool.getQueue().size(),
            pool.getCompletedTaskCount(),
            pool.getRejectedExecutionHandler()
        );
    }
}
```

### 4.3 缓存优化

```java
// ===== 多级缓存架构 =====
// 浏览器缓存（静态资源）← CDN 缓存 ← 应用本地缓存 ← Redis 分布式缓存 ← 数据库

// ===== Redis 缓存策略 =====
@Service
@Slf4j
public class CacheService {

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    // 1. 缓存穿透防护（布隆过滤器 + 空值缓存）
    public <T> T getWithProtection(String key, Class<T> type,
                                   long expireSeconds,
                                   Supplier<T> dbLoader) {
        T value = (T) redisTemplate.opsForValue().get(key);
        if (value != null) {
            // 检查是否是空值标记
            if (value instanceof NullValue) {
                return null;
            }
            return value;
        }

        // 同步加载（防止缓存击穿）
        synchronized (key.intern()) {
            // 双重检查
            value = (T) redisTemplate.opsForValue().get(key);
            if (value != null) {
                return value instanceof NullValue ? null : value;
            }

            T dbValue = dbLoader.get();
            if (dbValue == null) {
                // 缓存空值，设置较短过期时间（防穿透）
                redisTemplate.opsForValue().set(key, NullValue.INSTANCE,
                    Duration.ofSeconds(30));
            } else {
                redisTemplate.opsForValue().set(key, dbValue,
                    Duration.ofSeconds(expireSeconds));
            }
            return dbValue;
        }
    }

    // 2. 缓存过期策略（避免缓存雪崩）
    public void setWithRandomExpire(String key, Object value, long baseExpire) {
        // 基础过期时间 ± 随机偏移（1~5 分钟）
        long randomOffset = ThreadLocalRandom.current().nextLong(60, 300);
        redisTemplate.opsForValue().set(key, value,
            Duration.ofSeconds(baseExpire + randomOffset));
    }
}

// ===== 本地缓存（Caffeine）=====
@Configuration
public class LocalCacheConfig {

    @Bean
    public Cache<String, Object> caffeineCache() {
        return Caffeine.newBuilder()
            .initialCapacity(1000)              // 初始容量
            .maximumSize(10000)                 // 最大条目数
            .expireAfterWrite(5, TimeUnit.MINUTES)  // 写入后过期
            .expireAfterAccess(10, TimeUnit.MINUTES) // 访问后过期
            .recordStats()                      // 记录统计信息
            .build();
    }
}

// ===== 缓存统计监控 =====
@Component
@Slf4j
public class CacheMonitor {

    private final Cache<String, Object> caffeineCache;

    public CacheMonitor(Cache<String, Object> caffeineCache) {
        this.caffeineCache = caffeineCache;
        scheduleReport();
    }

    @Scheduled(fixedRate = 60000)
    public void report() {
        CacheStats stats = caffeineCache.stats();
        log.info("本地缓存统计: hitRate={}, missRate={}, loadCount={}, evictionCount={}",
            stats.hitRate(),
            1 - stats.hitRate(),
            stats.loadCount(),
            stats.evictionCount()
        );
    }
}
```

### 4.4 连接池优化

```yaml
# ===== HTTP 连接池配置（RestTemplate + HttpClient）=====
spring:
  rest-template:
    connect-timeout: 3000       # 建立连接超时（ms）
    read-timeout: 10000         # 读取数据超时（ms）
    max-total-connections: 200  # 最大总连接数
    max-per-route: 50           # 每个路由最大连接数

# ===== Feign 连接池配置（微服务场景）=====
feign:
  httpclient:
    enabled: true
    max-connections: 200
    max-connections-per-route: 50
    time-to-live: 60
    time-to-live-unit: MINUTES
    connection-timeout: 3000
    read-timeout: 10000
```

***

## 五、调优案例

### 案例1：接口响应慢（数据库慢查询 + 索引缺失）

**现象：** 订单列表接口 `/api/orders/list` 在数据量达到 100 万行时响应时间从 50ms 暴涨到 8s。

**排查过程：**

```bash
# 1. 打开慢查询日志
SET GLOBAL slow_query_log = ON;
SET GLOBAL long_query_time = 1;

# 2. 查看慢查询
# Time: 2024-06-15T10:30:00.123456Z
# Query_time: 8.234  Lock_time: 0.001 Rows_sent: 20  Rows_examined: 980000
SELECT o.*, u.name, u.mobile
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
WHERE o.status = 'PAID'
  AND o.created_at >= '2024-01-01'
ORDER BY o.created_at DESC
LIMIT 20 OFFSET 0;

# 3. EXPLAIN 分析
EXPLAIN SELECT o.*, u.name, u.mobile ...
# type: ALL (全表扫描) → 扫描 98 万行
# Extra: Using where; Using filesort (没有使用索引排序)
# key: null
```

**问题诊断：**

* `orders` 表 `status` 和 `created_at` 都没有索引
* ORDER BY 导致 `filesort` 全表排序
* `LEFT JOIN users` 需要回表查询

**解决方案：**

```sql
-- 1. 添加联合索引
ALTER TABLE orders ADD INDEX idx_status_created (status, created_at);

-- 2. 优化 SQL（只查询需要的字段）
-- 改前
SELECT o.*, u.name, u.mobile
FROM orders o LEFT JOIN users u ON o.user_id = u.id
WHERE o.status = 'PAID' AND o.created_at >= '2024-01-01'
ORDER BY o.created_at DESC LIMIT 20;

-- 改后（覆盖索引 + 延迟关联）
SELECT o.id, o.order_no, o.amount, o.status, o.created_at,
       u.name, u.mobile
FROM orders o
INNER JOIN (
    SELECT id FROM orders
    WHERE status = 'PAID' AND created_at >= '2024-01-01'
    ORDER BY created_at DESC LIMIT 20
) AS tmp ON o.id = tmp.id
LEFT JOIN users u ON o.user_id = u.id
ORDER BY o.created_at DESC;

-- 3. 为 orders.user_id 加索引提升 JOIN 性能
ALTER TABLE orders ADD INDEX idx_user_id (user_id);
```

**优化结果：**

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 扫描行数 | 980,000 | 20 |
| 查询时间 | 8.2s | 12ms |
| TPS | 5 | 800+ |

***

### 案例2：CPU 100%（频繁 Full GC）

**现象：** 服务上线后 CPU 逐步攀升至 100%，响应变慢，最终触发健康检查失败重启。

**排查过程：**

```bash
# 1. top 确认 CPU 飙升
top -o %CPU
# PID  USER      PR  NI  VIRT  RES  SHR  %CPU  %MEM  TIME+   COMMAND
# 23456 appuser   20  0   4.5g  2.8g 20m  200%   35%   15:30   java

# 2. 查看 GC 情况
jstat -gcutil 23456 1000 5
# S0    S1    E     O     M     YGC   YGCT  FGC  FGCT  GCT
# 0.00  0.00  95.0  80.0  95.0  1200  15.0  50   120.0  135.0
# 0.00  0.00  98.0  85.0  95.0  1210  15.2  55   130.0  145.2
# FGCT 持续增长 → 频繁 Full GC

# 3. 查看堆内存对象分布
jmap -histo:live 23456 | head -20
# num     #instances     #bytes      class name
# ------------------------------------------------
# 1:      5000000      200000000     [B              ← 大量 byte 数组
# 2:      3000000      120000000     java.util.ArrayList
# 3:      2000000      80000000      com.example.dto.OrderDTO

# 4. 导出堆转储
jmap -dump:live,format=b,file=/tmp/heap.hprof 23456

# 5. 使用 MAT 分析（命令行快速查看）
jhat /tmp/heap.hprof
# 访问 http://localhost:7000 查看大对象和 GC Root
```

**问题诊断：** 代码中存在大列表循环处理未分页，一次性加载 50 万条订单数据到内存中。

```java
// ===== 问题代码 =====
public void batchProcessOrders() {
    // 一次性加载全部数据到内存
    List<OrderDTO> orders = orderMapper.selectAll();  // 50万条
    for (OrderDTO order : orders) {
        processOrder(order);
    }
}
```

**解决方案：**

```java
// ===== 修复一：分页处理 =====
public void batchProcessOrders() {
    int pageSize = 1000;
    int pageNo = 1;
    List<OrderDTO> batch;

    do {
        batch = orderMapper.selectPage(pageNo++, pageSize);
        for (OrderDTO order : batch) {
            processOrder(order);
        }
        // 每批处理完后 GC 可以回收上一批的对象
    } while (!batch.isEmpty());
}

// ===== 修复二：使用游标 =====
public void batchProcessOrdersWithCursor() {
    try (Cursor<OrderDTO> cursor = orderMapper.selectCursor()) {
        cursor.forEach(this::processOrder);
    }
}

// ===== 修复三：线程池并行处理（进一步提升吞吐）=====
public void batchProcessOrdersParallel() {
    int batchSize = 500;
    List<Long> allIds = orderMapper.selectAllIds();
    List<List<Long>> batches = ListUtils.partition(allIds, batchSize);

    List<CompletableFuture<Void>> futures = batches.stream()
        .map(batch -> CompletableFuture.runAsync(() -> {
            List<OrderDTO> orders = orderMapper.selectByIds(batch);
            orders.forEach(this::processOrder);
        }, bizThreadPool))
        .collect(Collectors.toList());

    CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
}
```

**优化结果：**

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| CPU 使用率 | 200% | 40% |
| Full GC 频率 | 每 30s 一次 | 几乎无 Full GC |
| OOM | 每周 2~3 次 | 从未发生 |
| 批处理耗时 | 15min | 3min |

***

### 案例3：OOM 内存溢出（大对象 + 内存泄漏）

**现象：** 服务运行 2~3 天后 JVM 堆内存持续增长，最终 OOM 触发容器重启。

**排查过程：**

```bash
# 1. 查看堆内存使用趋势
jstat -gc 34567 5000 20  # 每 5s 采样一次
# 发现 EU (Eden Usage) 每次 GC 后回收不完全，OU (Old Usage) 持续攀升

# 2. 查看对象年龄分布
jmap -histo:live 34567 | head -10
# 发现 byte[] 和 OrderDTO 实例数量异常

# 3. JVM 参数添加自动 Dump
# 重启后加上：-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/app/dumps/

# 4. 分析 Dump 文件（使用 Eclipse MAT）
# - Leak Suspects Report: 发现 OrderExcelExporter 持有大量 byte[]
# - Dominator Tree: 找到最大的对象引用链
```

**问题诊断：**

```java
// ===== 问题1：大对象滞留 =====
@Service
public class OrderExportService {

    // 问题：使用 static 列表缓存导出数据，导致 GC 无法回收
    private static List<OrderDTO> exportCache = new ArrayList<>();

    public void exportLargeOrders() {
        // 每次导出都追加到静态列表，永不释放
        List<OrderDTO> orders = orderMapper.selectLargeOrders();
        exportCache.addAll(orders);   // ← 内存泄漏点
        ExcelExporter.export(exportCache);
    }
}

// ===== 问题2：ThreadLocal 未清理 =====
public class RequestContextHolder {

    // 问题：未在请求结束后 remove()
    private static ThreadLocal<byte[]> requestData = new ThreadLocal<>();

    public static void setData(byte[] data) {
        requestData.set(data);  // ← 线程池中线程不会销毁，数据无法回收
    }
}
```

**解决方案：**

```java
// ===== 修复一：移除静态缓存 =====
@Service
public class OrderExportService {

    public void exportLargeOrders() {
        List<OrderDTO> orders = orderMapper.selectLargeOrders();
        // 直接传给导出方法，方法返回后 orders 即可被 GC 回收
        ExcelExporter.export(orders);
    }
}

// ===== 修复二：正确使用 ThreadLocal =====
public class RequestContextHolder {

    private static ThreadLocal<byte[]> requestData = ThreadLocal.withInitial(() -> null);

    public static void setData(byte[] data) {
        requestData.set(data);
    }

    public static void clear() {
        requestData.remove();  // 必须清理，防止内存泄漏
    }
}

// ===== 拦截器确保清理 =====
@Component
public class ContextCleanupInterceptor implements HandlerInterceptor {

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        RequestContextHolder.clear();
    }
}

// ===== 修复三：优化导出逻辑（流式写入）=====
public void exportToExcelStream(OutputStream out) {
    // 使用 SXSSFWorkbook（流式写入，不缓存全部数据在内存）
    try (SXSSFWorkbook workbook = new SXSSFWorkbook(100)) { // 内存中保留 100 行
        Sheet sheet = workbook.createSheet("Orders");

        // 分页读取，流式写入
        int pageNo = 1;
        int pageSize = 5000;
        List<OrderDTO> batch;

        do {
            batch = orderMapper.selectPage(pageNo++, pageSize);
            int rowNum = (pageNo - 2) * pageSize + 1;
            for (OrderDTO order : batch) {
                Row row = sheet.createRow(rowNum++);
                row.createCell(0).setCellValue(order.getOrderNo());
                row.createCell(1).setCellValue(order.getAmount());
                // ... 写入其他字段
            }
            // 强制刷新到磁盘
            ((SXSSFSheet) sheet).flushRows(pageSize);
        } while (!batch.isEmpty());

        workbook.write(out);
    } finally {
        // SXSSFWorkbook.close() 会自动清理临时文件
    }
}
```

**优化结果：**

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 堆内存使用 | 持续增长至 OOM | 稳定在 2~3G |
| Full GC 频率 | 每日数十次 | 几乎为零 |
| 服务可用时长 | 2~3 天重启 | 持续运行 30+ 天 |
| Redis/DB 连接 | 频繁泄漏 | 稳定无泄漏 |

***

## 附：性能调优工具速查表

| 工具 | 用途 | 关键命令 |
|------|------|---------|
| top | 系统整体性能 | `top -o %CPU` / `top -H -p PID` |
| vmstat | 系统资源 | `vmstat 1` |
| iostat | 磁盘 IO | `iostat -x 1` |
| sar | 历史性能 | `sar -n DEV 1` / `sar -u 1` |
| pidstat | 进程级性能 | `pidstat -p PID 1` |
| strace | 系统调用追踪 | `strace -f -p PID` |
| jps | Java 进程列表 | `jps -lv` |
| jstat | JVM GC 统计 | `jstat -gcutil PID 1000` |
| jmap | 堆内存分析 | `jmap -histo:live PID` / `jmap -dump:live,...` |
| jstack | 线程堆栈 | `jstack PID` / `jstack -l PID` |
| jcmd | 综合 JVM 诊断 | `jcmd PID help` |
| MAT | 堆转储分析 | 图形化分析 hprof 文件 |
| Arthas | 在线诊断 | `curl -O https://arthas.aliyun.com/arthas-boot.jar && java -jar arthas-boot.jar` |
| Prometheus + Grafana | 监控大盘 | 可视化指标监控 |

**Arthas 在线诊断快速命令：**

```bash
# 启动 Arthas
java -jar arthas-boot.jar

# 查看最耗时的方法（按耗时排序）
trace com.example.service.OrderService getOrder '#cost > 100'

# 查看方法调用参数和返回值
watch com.example.service.OrderService getOrder '{params,returnObj}' -x 3

# 查看线程状态
thread -n 5  # 查看前 5 个最忙的线程

# 查看 JVM 信息
dashboard

# 重定义类（热替换）
redefine /tmp/OrderService.class
```
