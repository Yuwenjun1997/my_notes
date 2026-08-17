---
url: >-
  /my_notes/notes/JAVA学习路线/shen-du-xue-xi/04-yun-wei-yu-gong-cheng-hua/4-arthas-xian-shang-zhen-duan/index.md
---
# Arthas 线上诊断

## 1. Arthas 简介

### 1.1 核心功能概述

Arthas（阿尔萨斯）是阿里巴巴开源的 Java 在线诊断工具。它允许开发者在不重启 JVM 的情况下，实时查看应用运行状态、定位问题瓶颈、分析性能热点，是 Java 线上问题排查的利器。

**核心能力：**

| 功能 | 说明 |
|------|------|
| 实时监控 | 查看线程、内存、GC、系统负载等实时指标 |
| 类/方法追踪 | 反编译运行时类、查看方法调用入参/返回值/异常 |
| 调用链路分析 | 追踪方法调用耗时，定位性能瓶颈 |
| 热替换 | 在线修改代码并热加载（需结合热部署组件） |
| 日志级别调整 | 运行时修改 Logger 级别 |
| 资源分析 | 生成堆转储、火焰图、查看类加载信息 |

**适用场景：**

* 线上 CPU 飙升、内存泄漏排查
* 接口响应慢，需要定位瓶颈方法
* 确认已发布的代码是否生效
* 临时调整日志级别以便排查
* 查看线上配置是否与预期一致

### 1.2 安装方式

#### 方式一：JAR 包启动（推荐）

```bash
# 下载 arthas-boot.jar
curl -O https://arthas.aliyun.com/arthas-boot.jar

# 启动 Arthas（会列出当前 Java 进程）
java -jar arthas-boot.jar

# 指定 PID 启动
java -jar arthas-boot.jar <PID>
```

启动后选择目标进程即可进入交互式命令行界面。

#### 方式二：作为 Agent 启动

在 JVM 启动参数中附加 Arthas Agent，适用于需要在应用启动时就附加诊断能力的情况：

```bash
java -javaagent:/path/to/arthas-agent.jar \
     -Darthas.appName=my-app \
     -Darthas.agentId=my-agent \
     -jar my-app.jar
```

Spring Boot 应用也可以在 `application.yml` 中集成：

```yaml
arthas:
  agent-id: my-app
  tunnel-server: ws://127.0.0.1:7777/ws
```

#### 方式三：as.sh 一键安装（Linux）

```bash
curl -L https://arthas.aliyun.com/install.sh | sh
./as.sh
```

### 1.3 启动与退出

```bash
# 启动（交互模式）
java -jar arthas-boot.jar
# 选择目标进程，进入 arthas 命令行

# 非交互模式（执行单个命令后退出）
java -jar arthas-boot.jar <PID> --command "dashboard -n 1"

# 退出交互模式
quit     # 退出当前会话
exit     # 退出当前会话
stop     # 关闭 Arthas 服务端（完全停止）
```

***

## 2. 常用命令详解

### 2.1 dashboard — 系统实时数据面板

**作用：** 查看 JVM 的实时运行状况，包括线程信息、内存使用、GC 情况、系统负载等。

**语法：**

```bash
dashboard [-i <间隔>] [-n <次数>]
```

**参数说明：**

| 参数 | 说明 |
|------|------|
| -i | 刷新间隔（毫秒），默认 5000ms |
| -n | 执行次数，默认持续刷新 |
| \[command] | 指定要执行的命令 |

**实际输出示例：**

```
ID     NAME                           GROUP           PRIORITY   STATE      %CPU      TIME     INTERRUPTED  DAEMON
-1     C2 CompilerThread0             -               -1         -          7.2       0:1.234  false        true
-1     C1 CompilerThread1             -               -1         -          3.1       0:0.567  false        true
24     http-nio-8080-exec-1           main            5          RUNNABLE   2.5       0:3.456  false        false
25     http-nio-8080-exec-2           main            5          TIMED_WAITING 0.1    0:0.123  false        false
11     Catalina-utility-1             main            5          TIMED_WAITING 0.0    0:0.045  false        true

Memory                     used       total       max        usage      GC
heap                       1.2G       2.0G        4.0G       30.68%     gc.ps_scavenge.count      128
ps_eden_space              512M       1.0G        1.5G       33.33%     gc.ps_scavenge.time(ms)   3245
ps_survivor_space          32M        64M         64M        50.00%     gc.ps_marksweep.count     8
ps_old_gen                 656M       936M        2.5G       27.47%     gc.ps_marksweep.time(ms)  1850

Runtime Info
----------------------------------------------------------------
OS Name                                                        Windows 10
OS Version                                                     10.0
Java Version                                                   1.8.0_292
Java Home                                                      C:/Program Files/Java/jdk1.8.0_292/jre
System Load Average                                            2.35
```

**关键指标解读：**

* **线程部分**：关注 `%CPU` 高的线程、`BLOCKED` 状态的线程，可能存在问题
* **内存部分**：关注堆使用率，Eden/Survivor/Old 各区的使用情况
* **GC 部分**：关注 GC 次数和耗时，频繁 GC 或 Full GC 时间长说明内存压力大
* **系统部分**：System Load Average 超过 CPU 核数说明系统负载高

***

### 2.2 thread — 查看线程栈

**作用：** 查看当前 JVM 的线程信息、线程堆栈，支持定位死锁和 CPU 消耗最高的线程。

**语法：**

```bash
thread [-n <数量>] [-b] [id]
```

**参数说明：**

| 参数 | 说明 |
|------|------|
| -n | 按 CPU 使用率排序，显示前 N 个线程 |
| -b | 查找当前 JVM 中死锁的线程 |
| id | 查看指定线程 ID 的堆栈信息 |

#### 示例：查看所有线程

```bash
thread
```

输出：

```
Threads Total: 32, NEW: 0, RUNNABLE: 8, BLOCKED: 0, WAITING: 6, TIMED_WAITING: 12, TERMINATED: 6
ID   NAME                         GROUP           PRIORITY   STATE      %CPU      TIME
24   http-nio-8080-exec-1         main            5          RUNNABLE   12.5      0:12.345
25   http-nio-8080-exec-2         main            5          TIMED_WAITING 0.2     0:0.123
...
```

#### 示例：查看 CPU 最高的前 3 个线程（定位 CPU 飙升）

```bash
thread -n 3
```

输出：

```
"C2 CompilerThread0" [Internal] CPU usage: 45.23%
    at java.lang.System.arraycopy(Native Method)
    at java.util.HashMap.resize(HashMap.java:704)
    at java.util.HashMap.putVal(HashMap.java:628)
    at java.util.HashMap.put(HashMap.java:611)
    ...

"http-nio-8080-exec-1" Id=24 cpuUsage=23.5% RUNNABLE
    at com.example.service.UserService.listUsers(UserService.java:35)
    at com.example.controller.UserController.list(UserController.java:22)
    at org.apache.tomcat.util.net.NioEndpoint$SocketProcessor.doRun(NioEndpoint.java:1575)
    ...

"http-nio-8080-exec-5" Id=28 cpuUsage=8.2% TIMED_WAITING
    at java.lang.Thread.sleep(Native Method)
    ...
```

#### 示例：定位死锁

```bash
thread -b
```

输出（有死锁时）：

```
"Thread-1" Id=12 BLOCKED on java.lang.String@1a2b3c owned by "Thread-0"
    at com.example.service.LockService.methodB(LockService.java:25)
    - waiting to lock <java.lang.String@1a2b3c>
    - locked <java.lang.String@4d5e6f>

"Thread-0" Id=11 BLOCKED on java.lang.String@4d5e6f owned by "Thread-1"
    at com.example.service.LockService.methodA(LockService.java:18)
    - waiting to lock <java.lang.String@4d5e6f>
    - locked <java.lang.String@1a2b3c>

Found 1 deadlock.
```

无死锁时输出：

```bash
No deadlock found.
```

***

### 2.3 jad — 反编译运行时类

**作用：** 反编译 JVM 中已加载的类的字节码，确认线上运行的代码是否与期望一致。常用于验证热部署是否生效、确认发布的版本是否正确。

**语法：**

```bash
jad [-c <classloader>] <全限定类名>
jad <全限定类名> <方法名>
```

**参数说明：**

| 参数 | 说明 |
|------|------|
| -c | 指定 ClassLoader 的 hash |
| --source-only | 只输出源码，不包含类信息头 |

#### 示例：反编译整个类

```bash
jad com.example.service.UserService
```

输出：

```java
ClassLoader:
+-sun.misc.Launcher$AppClassLoader@18b4aac2
  +-sun.misc.Launcher$ExtClassLoader@6e0be858

Location:
/var/app/my-app.jar!/com/example/service/UserService.class

/*
 * Decompiled with CFR 0_132.
 */
package com.example.service;

import com.example.entity.User;
import com.example.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class UserService {
    @Autowired
    private UserRepository userRepository;

    public User getUser(Long id) {
        System.out.println("getUser called with id: " + id);  // 确认此行是否存在
        return userRepository.findById(id).orElse(null);
    }

    public List<User> listUsers() {
        return userRepository.findAll();
    }
}

Affect(row-cnt:1) cost in 68 ms.
```

#### 示例：反编译指定方法

```bash
jad com.example.service.UserService getUser
```

输出只包含 `getUser` 方法的源码。

***

### 2.4 sc / sm — 查看已加载的类/方法信息

**作用：** 查看 JVM 中已加载的类的详细信息（sc）或方法信息（sm）。用于确认类是否被加载、来自哪个 jar、有哪些方法等。

#### sc — 查看类信息

**语法：**

```bash
sc [-d] [-f] <类名模式>
```

**参数说明：**

| 参数 | 说明 |
|------|------|
| -d | 显示类的详细信息 |
| -f | 显示类的 field 信息 |
| -E | 开启正则匹配 |

#### 示例：

```bash
sc -d com.example.service.UserService
```

输出：

```java
class-info        com.example.service.UserService
code-source       /var/app/my-app.jar!/com/example/service/UserService.class
name              com.example.service.UserService
isInterface       false
isAnnotation      false
isEnum            false
isAnonymousClass  false
isArray           false
isMemberClass     false
isSynthetic       false
simple-name       UserService
modifier          public
annotation        org.springframework.stereotype.Service
interfaces
super-class       +-java.lang.Object
class-loader      +-sun.misc.Launcher$AppClassLoader@18b4aac2
                    +-sun.misc.Launcher$ExtClassLoader@6e0be858
classLoaderHash   18b4aac2
```

#### sm — 查看方法信息

**语法：**

```bash
sm [-d] <类名> [方法名]
```

#### 示例：

```bash
sm -d com.example.service.UserService
```

输出：

```java
com.example.service.UserService <init>()
com.example.service.UserService getUser(Ljava/lang/Long;)Ljava/util/Optional;
  modifier: public
  annotation: @org.springframework.transaction.annotation.Transactional

com.example.service.UserService listUsers()Ljava/util/List;
  modifier: public
```

***

### 2.5 watch — 观察方法调用

**作用：** 观察方法调用的入参、返回值、异常信息，是排查接口数据不符合预期的利器。支持条件表达式和多种观察维度。

**语法：**

```bash
watch <类名> <方法名> <ognl表达式> [-x <展开深度>] [-b] [-e] [-s] [-f] [-c <条件>] [-n <次数>]
```

**参数说明：**

| 参数 | 说明 |
|------|------|
| -x | 展开结果的深度，默认 1 |
| -b | 观察方法调用前（入参阶段） |
| -e | 观察方法抛出异常时 |
| -s | 观察方法返回时 |
| -f | 观察方法结束（正常返回和异常都触发），默认值 |
| -n | 执行次数 |
| -c | 条件表达式 |

**OGNL 表达式常用变量：**

| 变量 | 说明 |
|------|------|
| params | 方法参数数组 |
| returnObj | 返回值 |
| throwExp | 抛出的异常 |
| target | 当前对象 |
| method | 当前方法名 |

#### 示例：观察方法入参、返回值和异常

```bash
watch com.example.service.UserService getUser '{params,returnObj,throwExp}' -x 3
```

输出：

```
method=com.example.service.UserService.getUser
[cost=2.345ms] rc=success
+--params
|  +--[0]=1001
+--returnObj
|  +--User@1a2b3c
|     +--id=1001
|     +--name="张三"
|     +--email="zhangsan@example.com"
|     +--address=Address@4d5e6f
|        +--province="北京"
|        +--city="北京"
|        +--detail="朝阳区xxx街道"
+--throwExp=null
```

#### 示例：只观察抛异常的情况

```bash
watch com.example.service.OrderService createOrder '{params,throwExp}' -e -x 2
```

#### 示例：观察参数满足条件的调用

```bash
watch com.example.service.UserService getUser '{params,returnObj}' "params[0] > 1000" -x 2
```

***

### 2.6 trace — 方法调用链路耗时追踪

**作用：** 追踪方法内部调用链路的耗时分布，用于定位"接口慢在哪里"。trace 会输出方法内部调用子方法的耗时，帮助快速找到性能瓶颈。

**语法：**

```bash
trace <类名> <方法名> [-n <次数>] [--skipJDKMethod <true/false>]
```

**参数说明：**

| 参数 | 说明 |
|------|------|
| -n | 追踪次数 |
| --skipJDKMethod | 是否跳过 JDK 方法追踪，默认 true |
| -E | 开启正则匹配 |
| --condition | 条件表达式 |

#### 示例：追踪订单创建方法

```bash
trace com.example.service.OrderService createOrder -n 5
```

输出：

```
`---ts=2026-06-22 10:23:45;thread_name=http-nio-8080-exec-3;id=24;is_daemon=false;priority=5;TCCL=sun.misc.Launcher$AppClassLoader@18b4aac2
    `---[2.456s] com.example.service.OrderService.createOrder()
        +---[0.015ms] org.springframework.beans.BeanUtils.copyProperties()  # 耗时极短
        +---[0.023ms] com.example.service.OrderService.generateOrderNo()   # 耗时极短
        +---[1.234s]  com.example.service.InventoryService.deductStock()    # 耗时 1.2s ★ 瓶颈
        |   `---[1.200s] com.example.service.InventoryService.updateStock()
        |       `---[1.180s] com.example.repository.InventoryRepository.update()
        |           `---[1.150s] org.hibernate.Session.save()               # 数据库写入慢
        +---[0.856s]  com.example.service.PaymentService.pay()             # 耗时 0.85s ★
        |   `---[0.830s] com.example.client.PaymentClient.request()
        |       `---[0.800s] org.apache.http.client.HttpClient.execute()   # HTTP 调用慢
        `---[0.012ms] com.example.service.OrderService.saveOrder()
```

**解读：** 从 trace 结果可以清晰看到，`InventoryService.deductStock` 耗时 1.2s（数据库写入慢），`PaymentService.pay` 耗时 0.85s（HTTP 调用第三方支付慢）。这就是接口慢的根本原因。

#### 示例：追踪特定条件的调用

```bash
trace com.example.service.OrderService createOrder --condition "params[0].amount > 10000" -n 3
```

***

### 2.7 monitor — 方法调用统计

**作用：** 统计指定方法的调用次数、成功次数、失败次数、平均耗时、失败率等指标，用于监控方法级别的健康状况。

**语法：**

```bash
monitor <类名> <方法名> [-c <统计周期>] [-n <次数>]
```

**参数说明：**

| 参数 | 说明 |
|------|------|
| -c | 统计周期（秒），默认 60 秒 |
| -n | 执行次数 |

#### 示例：

```bash
monitor com.example.service.OrderService createOrder -c 10
```

输出（每 10 秒统计一次）：

```
Timestamp                           Class                                       Method     Total   Success  Fail   Avg(ms)   FailRate
--------------------------------------------------------------------------------------------------------------------------------
2026-06-22 10:23:45                OrderService                                createOrder 120     115      5      235.45    4.17%
2026-06-22 10:23:55                OrderService                                createOrder 98      92       6      312.56    6.12%
2026-06-22 10:24:05                OrderService                                createOrder 135     130      5      198.23    3.70%
```

***

### 2.8 tt — TimeTunnel 时空隧道

**作用：** 录制方法的每次调用信息（入参、返回值、异常、调用时间等），并支持回放。相当于方法调用的"DVR"，可以回溯查看过去的调用，甚至重新执行一次。

**语法：**

```bash
tt -t <类名> <方法名> [-n <次数>] [-p <回放次数>] [-i <index>] [-l]
```

**参数说明：**

| 参数 | 说明 |
|------|------|
| -t | 记录方法调用 |
| -l | 显示所有已记录的调用 |
| -i | 查看具体某次调用的详细信息 |
| -p | 回放某次调用 |
| -n | 限制记录次数 |
| -s | 条件表达式 |

#### 示例：录制方法调用

```bash
tt -t com.example.service.UserService getUser -n 5
```

输出：

```
 INDEX   TIMESTAMP                COST(ms)   IS-RET   IS-EXP   OBJECT           CLASS                          METHOD
--------------------------------------------------------------------------------------------------------------------------------
 1000    2026-06-22 10:23:45      2.345      true     false    0x1a2b3c         UserService                    getUser
 1001    2026-06-22 10:23:50      1.234      true     false    0x1a2b3c         UserService                    getUser
 1002    2026-06-22 10:23:55      3.456      true     false    0x1a2b3c         UserService                    getUser
```

#### 示例：查看某次调用的详情

```bash
tt -i 1000
```

显示调用 `id=1000` 的详细入参和返回值。

#### 示例：回放某次调用

```bash
tt -i 1000 -p
```

重新执行 index=1000 的那次调用，保持相同的入参，输出新的返回值。

***

### 2.9 ognl — 在线执行表达式

**作用：** 在运行时执行 OGNL 表达式，可以获取/修改任意对象的属性、调用静态方法、修改 Spring Bean 属性等。常用于修改日志级别、查看配置、调用任意方法。

**语法：**

```bash
ognl <ognl表达式> [-c <classloader>] [-x <展开深度>]
```

**参数说明：**

| 参数 | 说明 |
|------|------|
| -c | 指定 ClassLoader |
| -x | 展开深度 |

#### 示例：查看静态字段（日志级别）

```bash
ognl '@com.example.config.AppConfig@logger.level'
```

输出：

```java
DEBUG
```

#### 示例：修改静态字段（修改日志级别）

```bash
ognl '#logger=@ch.qos.logback.classic.Logger@getLogger("com.example.service"),#logger.setLevel(@ch.qos.logback.classic.Level@ERROR)'
```

#### 示例：调用 Spring Bean 的方法

```bash
ognl '#bean=@com.example.config.ApplicationContextUtil@getBean("userService"),#bean.listUsers().size()'
```

#### 示例：查看系统属性

```java
ognl '@java.lang.System@getProperty("java.version")'
```

输出：

```
"1.8.0_292"
```

#### 示例：修改 HashMap 的值

```bash
ognl 'new java.util.HashMap().put("key","value")'
```

***

### 2.10 vmtool — 强制 GC / 获取 Spring Context / 执行任意代码

**作用：** vmtool 是 Arthas 3.5+ 引入的强力工具，可以绕过 JVM 限制执行各种操作，包括强制 GC、获取 Spring Context、执行任意代码等。

**语法：**

```bash
vmtool --action <action> [--className <类名>] [--express <表达式>]
```

**参数说明：**

| 参数 | 说明 |
|------|------|
| --action | 执行动作：getInstance（获取实例）、forceGc（强制GC）、exec（执行代码） |
| --className | 目标类名 |
| --express | OGNL 表达式 |
| --limit | 限制获取实例数量 |

#### 示例：获取 Spring Context 并操作 Bean

```bash
vmtool --action getInstance --className org.springframework.context.ApplicationContext --express 'instances[0].getBean("userService").listUsers()'
```

#### 示例：强制 GC

```bash
vmtool --action forceGc
```

输出：

```
Force GC success.
```

#### 示例：获取类的所有实例

```bash
vmtool --action getInstance --className com.example.entity.User --limit 10
```

返回 JVM 中 User 对象的前 10 个实例。

***

### 2.11 heapdump — 生成堆转储文件

**作用：** 生成 JVM 堆转储文件（.hprof），用于后续使用 MAT、VisualVM 等工具分析内存泄漏。

**语法：**

```bash
heapdump [--live] <文件路径>
```

**参数说明：**

| 参数 | 说明 |
|------|------|
| --live | 只转储存活对象，会先触发一次 Full GC |
| 文件路径 | 堆转储文件保存路径 |

#### 示例：

```bash
heapdump --live /var/app/dumps/heap-20260622.hprof
```

输出：

```
Heap dump file created: /var/app/dumps/heap-20260622.hprof (256 MB)
```

#### 示例：只转储 live 对象

```bash
heapdump --live /var/app/dumps/heap-live.hprof
```

***

### 2.12 profiler — 火焰图

**作用：** 生成 CPU 或内存的热点火焰图，可视化分析性能瓶颈。火焰图可以直观看到哪个方法的 CPU 占用最高。

**语法：**

```bash
profiler start [--event <event>]
profiler stop [--format <format>] [--file <文件路径>]
```

**参数说明：**

| 参数 | 说明 |
|------|------|
| start | 开始采样 |
| stop | 停止采样并生成火焰图 |
| --event | 采样事件：cpu（默认）、alloc（内存分配）、lock（锁竞争）、wall（时钟时间） |
| --format | 输出格式：html（默认，带交互）、svg、flamegraph |
| --file | 输出文件路径 |
| --duration | 采样时长（秒） |

#### 示例：CPU 采样 30 秒

```bash
profiler start --event cpu
# 等待 30 秒
profiler stop --format html --file /tmp/profiler-cpu.html
```

输出：

```
Profiling started (cpu event)
... 等待后 ...
Profiling stopped. Flames generated in /tmp/profiler-cpu.html
```

生成 HTML 火焰图后，用浏览器打开即可交互式查看：每个方块代表一个方法调用，宽度表示 CPU 占用比例。

#### 示例：内存分配采样

```bash
profiler start --event alloc
# 等待 30 秒
profiler stop --file /tmp/profiler-alloc.html
```

***

## 3. 常见问题排查案例

### 案例1：CPU 飙升排查

**问题现象：** 线上告警，某台服务器 CPU 使用率持续 99%，接口响应超时。

**排查步骤：**

```bash
# 1. 进入 Arthas 并 attach 到目标进程
java -jar arthas-boot.jar

# 2. 查看 CPU 最高的 3 个线程
thread -n 3
```

输出：

```
"C2 CompilerThread0" cpu usage: 5.2%        # JIT 编译器，正常
"http-nio-8080-exec-3" cpu usage: 67.8%     # ★ 业务线程 CPU 异常高
"http-nio-8080-exec-1" cpu usage: 8.1%
```

```bash
# 3. 查看 CPU 最高的线程的栈
thread 24    # 假设 24 是 http-nio-8080-exec-3 的线程 ID
```

输出：

```
"http-nio-8080-exec-3" Id=24 cpuUsage=67.8% RUNNABLE
    at com.example.service.UserService.processLargeData(UserService.java:56)
    at com.example.service.UserService.batchProcess(UserService.java:32)
    at com.example.controller.UserController.handleBatch(UserController.java:25)
    ...
    at java.util.regex.Pattern$CharProperty.match(Pattern.java:3345)   # ★ 正则匹配热点
```

```bash
# 4. 反编译确认代码
jad com.example.service.UserService processLargeData
```

发现 `processLargeData` 中有一个低效的正则表达式在大数据量下导致 CPU 飙高。

**解决方案：** 优化正则表达式或改用字符串直接匹配，上线后重新观察。

***

### 案例2：接口响应慢排查

**问题现象：** 线上接口 `/api/order/detail` 平均响应时间从 50ms 变成 3s。

**排查步骤：**

```bash
# 1. 追踪方法调用链路
trace com.example.controller.OrderController getDetail -n 5
```

输出：

```
`---[3.2s] com.example.controller.OrderController.getDetail()
    +---[0.012ms] org.springframework.beans.BeanUtils.copyProperties()
    +---[0.023ms] com.example.service.OrderService.convert()
    +---[2.856s]  com.example.service.OrderService.queryDetail()     # ★ 耗时 2.8s
    |   `---[2.820s] com.example.repository.OrderRepository.findById()  # SQL 慢
    |       `---[2.800s] org.hibernate.Session.load()
    `---[0.015ms] com.example.entity.Order.toString()

# 2. 进一步追踪具体 SQL
trace com.example.repository.OrderRepository findById
```

发现 Order 关联了大量懒加载的集合，在查询时触发了 N+1 查询问题。

```bash
# 3. 确认关联查询情况
watch com.example.repository.OrderRepository findById '{params,returnObj}' -x 3
```

**解决方案：** 改用 `@EntityGraph` 或 `@Query` 优化关联查询，使用 `FetchType.LAZY` 配合批量抓取。

***

### 案例3：OOM 内存泄漏

**问题现象：** 应用运行一段时间后 OutOfMemoryError，频繁 Full GC。

**排查步骤：**

```bash
# 1. dashboard 查看内存和 GC 情况
dashboard -i 5000 -n 3
```

关注点：

* Old 区持续增长，回收后不下降
* Full GC 次数和耗时不断增加

```bash
# 2. 生成堆转储
heapdump --live /tmp/heap-oom.hprof
```

```bash
# 3. 使用 sc 查看是否有大量对象实例
vmtool --action getInstance --className com.example.entity.Order --limit 10
```

```bash
# 4. 查看某个类的统计信息（哪些类实例数最多）
sc -d com.example.entity.Order
```

**MAT 分析步骤（线下）：**

1. 用 Eclipse MAT 打开 `heap-oom.hprof`
2. 运行 Leak Suspects Report
3. 查看 Dominator Tree，按 retained heap 排序
4. 找到占用内存最大的对象，回溯 GC Root 定位引用链

**常见原因：**

* `ThreadLocal` 未清理（线程池场景）
* 集合类使用不当（`HashMap` 无限 put）
* 连接池泄漏（数据库/HTTP 连接未关闭）
* CGLIB 动态代理类加载过多

***

### 案例4：线上日志级别临时调整

**问题现象：** 线上问题需要更详细的日志来排查，但不能重启应用（重启后问题可能复现不了）。

**排查步骤：**

```bash
# 1. 先查看当前日志级别
ognl '@ch.qos.logback.classic.Logger@getLogger("com.example.service")'

# 或者使用 Spring 的 Loggers
ognl '#bean=@com.example.config.ApplicationContextUtil@getBean("logManager"),#bean.getLoggerLevel("com.example.service")'
```

```bash
# 2. 临时修改日志级别为 DEBUG
ognl '@ch.qos.logback.classic.Logger@getLogger("com.example.service").setLevel(@ch.qos.logback.classic.Level@DEBUG)'
```

```bash
# 3. 确认修改成功
ognl '@ch.qos.logback.classic.Logger@getLogger("com.example.service").getLevel()'
```

输出：

```
DEBUG
```

**注意事项：**

* 修改仅对当前 JVM 生效，重启后丢失
* 如果不想重启后丢失，需要在配置文件中同时修改
* Log4j2 和 Logback 的 API 不同，部分方法名有差异

***

### 案例5：接口返回数据不符合预期

**问题现象：** 前端报错，后端接口返回的数据中某个字段值为 null，但数据库中有值。

**排查步骤：**

```bash
# 1. watch 观察接口方法的入参和返回值
watch com.example.controller.UserController getUser '{params,returnObj}' -x 3
```

输出发现返回的 User 对象中 `email` 字段为 null。

```bash
# 2. 追踪 Service 层，确认数据来源
watch com.example.service.UserService getUser '{params,returnObj}' -x 3
```

发现 Service 层返回的 User 中 email 字段正常有值。

```bash
# 3. 继续追踪数据转换逻辑
trace com.example.controller.UserController getUser
```

输出发现 Controller 调用了 `UserConverter.convert()` 方法进行转换。

```bash
# 4. 查看转换方法
watch com.example.converter.UserConverter convert '{params,returnObj}' -x 3
```

发现转换方法中漏掉了 `email` 字段的映射：

```java
// 问题代码
targetUser.setName(sourceUser.getName());
targetUser.setPhone(sourceUser.getPhone());
// ★ 缺少 targetUser.setEmail(sourceUser.getEmail());
```

**解决方案：** 补全转换逻辑中的 email 字段映射。

***

## 附：Arthas 常用命令速查表

| 命令 | 用途 | 最常用法 |
|------|------|----------|
| dashboard | 实时数据面板 | `dashboard -i 3000` |
| thread | 查看线程 | `thread -n 3`、`thread -b` |
| jad | 反编译 | `jad com.example.MyClass` |
| sc/sm | 查看类/方法信息 | `sc -d com.example.MyClass` |
| watch | 观察方法调用 | `watch XxxService method '{params,returnObj}' -x 2` |
| trace | 链路耗时追踪 | `trace XxxService method` |
| monitor | 方法统计监控 | `monitor XxxService method -c 10` |
| tt | 时空隧道 | `tt -t XxxService method` |
| ognl | 执行表达式 | `ognl '@java.lang.System@getProperty("java.version")'` |
| vmtool | 增强操作 | `vmtool --action forceGc` |
| heapdump | 堆转储 | `heapdump /tmp/dump.hprof` |
| profiler | 火焰图 | `profiler start; sleep 30; profiler stop` |
| logger | 查看/修改日志 | `logger --name ROOT --level DEBUG` |
| mc | 内存编译器 | `mc /tmp/MyClass.java -d /tmp/output` |
| redefine | 热替换 | `redefine /tmp/MyClass.class` |
| reset | 重置增强类 | `reset` |

***

> **总结：** Arthas 的核心价值在于"不改代码、不重启"就能深入 JVM 内部排查问题。掌握 `thread`、`watch`、`trace`、`jad`、`ognl` 这五个命令可以解决 80% 的线上问题。关键是培养排查思路：先看整体（dashboard/thread）→ 定位问题点（trace/watch）→ 深入分析（jad/ognl）→ 确认根因。
