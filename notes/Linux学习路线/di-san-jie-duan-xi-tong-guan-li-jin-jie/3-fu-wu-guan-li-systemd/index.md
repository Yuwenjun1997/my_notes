---
url: >-
  /my_notes/notes/Linux学习路线/di-san-jie-duan-xi-tong-guan-li-jin-jie/3-fu-wu-guan-li-systemd/index.md
---
# 服务管理（systemd）

systemd 是 Ubuntu 的初始化系统和服务管理器，PID 为 1，负责启动和管理所有系统服务。

## 一、systemd 架构概览

```text
systemd
├── Unit（单元）        ← 管理的对象
│   ├── .service       ← 服务（最常用）
│   ├── .socket        ← 套接字
│   ├── .timer         ← 定时器（替代 cron）
│   ├── .target        ← 运行级别（替代 runlevel）
│   ├── .mount         ← 挂载点
│   └── .device        ← 设备
├── systemctl          ← 管理命令
├── journald           ← 日志系统
└── 配置文件目录
    ├── /lib/systemd/system/    ← 系统包自带的 Unit
    ├── /etc/systemd/system/    ← 管理员自定义的 Unit ⭐
    └── /run/systemd/system/    ← 运行时 Unit
```

***

## 二、systemctl 常用操作

### 2.1 服务管理

```bash
# ===== 启动/停止/重启 =====
sudo systemctl start nginx           # 启动
sudo systemctl stop nginx            # 停止
sudo systemctl restart nginx         # 重启
sudo systemctl reload nginx          # 重新加载配置（不停机）⭐
sudo systemctl reload-or-restart nginx  # 支持 reload 则 reload，否则 restart

# ===== 查看状态 =====
systemctl status nginx               # ⭐ 最常用
systemctl is-active nginx            # 是否运行中
systemctl is-enabled nginx           # 是否开机自启
systemctl is-failed nginx            # 是否启动失败

# ===== 开机自启 =====
sudo systemctl enable nginx          # 启用开机自启
sudo systemctl disable nginx         # 禁用开机自启
sudo systemctl enable --now nginx    # 启用并立即启动
sudo systemctl mask nginx            # 屏蔽服务（无法手动启动）
sudo systemctl unmask nginx          # 取消屏蔽

# ===== 查看依赖 =====
systemctl list-dependencies nginx              # 查看依赖树
systemctl list-dependencies nginx --reverse    # 查看反向依赖（谁依赖它）
```

### 2.2 系统状态

```bash
# 查看所有 Unit
systemctl list-units                     # 所有已加载的 Unit
systemctl list-units --type=service      # 只显示服务
systemctl list-units --type=service --state=running  # 正在运行的服务
systemctl list-units --type=service --state=failed   # 启动失败的服务 ⭐
systemctl list-unit-files               # 所有已安装的 Unit 文件

# 系统信息
systemctl status                         # 系统总体状态
systemctl list-sockets                  # 查看所有 socket
systemctl list-timers                   # 查看所有定时器
systemctl get-default                   # 查看默认启动目标
systemctl set-default multi-user.target # 设置默认启动目标
```

***

## 三、编写自定义 .service 文件

### 3.1 基本结构

```bash
sudo vim /etc/systemd/system/myapp.service
```

```ini
[Unit]
Description=My Java Application           # 服务描述
After=network.target                      # 在网络启动后启动
Wants=network.target                      # 弱依赖网络

[Service]
Type=simple                               # 服务类型
User=appuser                              # 运行用户 ⭐ 不要用 root
Group=appgroup                            # 运行组
WorkingDirectory=/opt/myapp               # 工作目录
ExecStart=/usr/bin/java -jar /opt/myapp/app.jar   # 启动命令
ExecStop=/bin/kill -TERM $MAINPID         # 停止命令
ExecReload=/bin/kill -HUP $MAINPID        # 重载命令
Restart=on-failure                        # 失败时重启
RestartSec=10                             # 重启等待秒数
StandardOutput=journal                    # stdout 输出到 journal
StandardError=journal                     # stderr 输出到 journal
EnvironmentFile=/opt/myapp/env.conf       # 环境变量文件
Environment="JAVA_OPTS=-Xmx512m -Xms256m" # 环境变量

[Install]
WantedBy=multi-user.target                # 在哪类运行级别启动
```

### 3.2 Service Type 说明

| Type | 说明 | 适用场景 |
|:-----|:-----|:---------|
| **simple**（默认） | systemd 认为服务立即启动完成 | 大多数前台运行的服务 |
| **forking** | 服务 fork 后父进程退出 | 传统守护进程（如 nginx） |
| **oneshot** | 执行一次就退出 | 初始化脚本 |
| **notify** | 服务就绪时发信号通知 | 支持 sd\_notify 的服务 |

### 3.3 Restart 策略

| 值 | 含义 |
|:---|:-----|
| `no` | 不自动重启（默认） |
| `on-failure` | 非正常退出时重启 ⭐ 推荐 |
| `on-abnormal` | 被信号终止、超时时重启 |
| `on-abort` | 未捕获信号导致退出时重启 |
| `always` | 总是重启（即使正常退出） |

### 3.4 应用配置

```bash
# 重载 systemd 配置（新增或修改 unit 文件后必须执行）
sudo systemctl daemon-reload

# 启动并验证
sudo systemctl start myapp
sudo systemctl status myapp
sudo systemctl enable myapp    # 开机自启

# 查看日志
journalctl -u myapp -f
```

***

## 四、journalctl 日志管理

### 4.1 基本用法

```bash
# 查看日志
journalctl                              # 所有日志（按 G 跳到最后）
journalctl -n 50                        # 最近 50 条
journalctl -f                           # 实时跟踪 ⭐
journalctl -k                           # 只看内核日志

# 按服务过滤
journalctl -u nginx                     # nginx 服务日志 ⭐
journalctl -u nginx -u php-fpm          # 多个服务
journalctl -u nginx -f                  # 实时 + 过滤

# 按时间过滤
journalctl --since "10 minutes ago"     # 最近 10 分钟
journalctl --since "2024-06-22 10:00:00" --until "2024-06-22 12:00:00"
journalctl --since today
journalctl --since yesterday

# 按优先级过滤
journalctl -p err                       # ERROR 及以上
journalctl -p warning                   # WARNING 及以上
# 优先级: emerg(0) > alert(1) > crit(2) > err(3) > warning(4) > notice(5) > info(6) > debug(7)

# 输出控制
journalctl -u nginx --no-pager          # 不分页（适合脚本处理）
journalctl -u nginx -o json-pretty      # JSON 格式输出
journalctl -u nginx --output=short-full  # 显示完整时间戳
```

### 4.2 日志持久化与清理

```bash
# 默认日志存在 /run/log/journal/ 中（重启丢失）
# 持久化配置：
sudo mkdir -p /var/log/journal
sudo systemd-tmpfiles --create --prefix /var/log/journal
sudo systemctl restart systemd-journald

# 查看日志占用空间
journalctl --disk-usage

# 清理旧日志
sudo journalctl --vacuum-time=7d         # 保留 7 天
sudo journalctl --vacuum-size=500M       # 保留 500MB
sudo journalctl --vacuum-files=10        # 保留 10 个文件
```

***

## 五、systemd timer（替代 cron）

```ini
# /etc/systemd/system/cleanup.service
[Unit]
Description=Cleanup temporary files

[Service]
Type=oneshot
ExecStart=/usr/local/bin/cleanup.sh

# /etc/systemd/system/cleanup.timer
[Unit]
Description=Run cleanup daily

[Timer]
OnCalendar=daily                         # 每天执行
# OnCalendar=*-*-* 02:00:00              # 每天凌晨 2 点
# OnCalendar=Mon..Fri 09:00              # 工作日 9 点
# OnBootSec=5min                         # 启动后 5 分钟执行一次
Persistent=true                          # 错过时间后在下次启动时补执行

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now cleanup.timer
systemctl list-timers                    # 查看定时任务
```

***

## 六、进阶：依赖语义、drop-in 与资源加固

### 6.1 systemd 依赖语义

```bash
# 四种依赖的区别（配置在 [Unit] 段）
#   After=/Before=    只控制启动顺序，不建立依赖（A 先启动，但 A 失败不影响 B）
#   Wants=            软依赖：B 会启动，但 B 失败不影响 A 的状态
#   Requires=         硬依赖：B 启动失败会连带 A 失败
#   PartOf=           组件关系：B 重启/停止会联动 A

# 查看依赖树与启动链路 ⭐
systemctl list-dependencies nginx             # 启动 nginx 需要/会拉起哪些
systemd-analyze critical-chain nginx          # 启动链路瓶颈分析（看哪一步最慢）
systemd-analyze blame | head -20              # 各 Unit 启动耗时排行
```

> 💡 排查"服务启动失败但找不到原因"时，`systemd-analyze critical-chain` + `journalctl -u 服务 -b` 能快速定位是卡在等待哪一步（常见：等网络/等数据库超时）。

### 6.2 systemctl edit：drop-in 覆盖

```bash
# 直接改 /lib/systemd/system/ 下的自带 unit 会被升级覆盖。
# 正确姿势是 drop-in 覆盖 ⭐
sudo systemctl edit nginx                    # 打开覆盖文件，另存后自动生效

# 等价手写：/etc/systemd/system/nginx.service.d/override.conf
# [Service]
# LimitNOFILE=65535
# ExecStart=
# ExecStart=/usr/sbin/nginx -g 'daemon off;'   # ExecStart 需先清空再重写
# ProtectSystem=strict

sudo systemctl daemon-reload
sudo systemctl restart nginx

# 验证实际生效的属性
systemctl show nginx -p LimitNOFILE -p ProtectSystem
```

> 💡 升级系统包后自带 unit 更新，但 `/etc/systemd/system/*.d/` 的覆盖文件不会被动——所以"改第三方服务"一律用 drop-in，别改原始文件。

### 6.3 service 文件资源限制与安全加固

```ini
[Service]
# 资源限制（对应 ulimit）
LimitNOFILE=65535          # 打开文件数上限（联动 2.4 §6.5）
LimitNPROC=4096            # 进程/线程数上限
MemoryMax=1G               # 内存上限（超限触发 OOM kill）
CPUQuota=80%               # CPU 使用上限
TasksMax=512               # 允许的任务数

# 安全加固 ⭐
ProtectSystem=strict       # 除白名单目录外只读
ProtectHome=true           # 屏蔽家目录访问
PrivateTmp=true            # 独立的 /tmp
NoNewPrivileges=true       # 禁止提权（suid 失效）
RestrictSUIDSGID=true      # 禁止创建 setuid/setgid 文件
ReadWritePaths=/var/lib/myapp   # 配合 ProtectSystem 放行写目录
```

> 💡 与 **4.2 安全加固** 呼应：systemd 沙箱选项让"即使被攻破也难扩大影响"。新 service 建议至少 `NoNewPrivileges=true` + `PrivateTmp=true`。用 `systemctl show 服务 -p 属性` 验证是否生效。

### 6.4 journald 与 rsyslog 协同、历史与校验

```bash
# journald 配置（/etc/systemd/journald.conf）
#   Storage=persistent     持久化到磁盘（默认 auto）
#   ForwardToSyslog=yes    转发给 rsyslog（让 /var/log/syslog 也收到）
#   SystemMaxUse=500M      日志磁盘占用上限

# 按启动轮次定位历史 ⭐
journalctl --list-boots             # 列出历史启动及时间范围
journalctl -b -1                    # 上一次启动的日志
journalctl -b 0 -p err              # 本次启动的错误

# 校验 journal 完整性（排查日志丢失/损坏）
sudo journalctl --verify
```

### 6.5 journalctl 结构化字段过滤

```bash
# journal 按字段存储，可精确过滤 ⭐
journalctl -u myapp _PID=12345              # 指定进程 PID
journalctl -u myapp _COMM=java              # 按可执行名过滤
journalctl _SYSTEMD_UNIT=nginx.service _UID=0
journalctl PRIORITY=3 _HOSTNAME=web-01      # err 级 + 指定主机

# 查看一条日志的全部字段
journalctl -u myapp -n 1 --output=verbose   # ⭐ 显示 _PID/_BOOT_ID/_GID 等

# 组合查询：nginx 最近 5 分钟的 root 用户错误
journalctl -u nginx --since "5 minutes ago" PRIORITY=3 _UID=0
```

***

## 📝 实践项目

### 目标

将一个 Java 应用注册为 systemd 服务。

### 步骤

1. **创建服务用户**
   ```bash
   sudo useradd -r -s /usr/sbin/nologin appuser
   ```

2. **准备应用**
   ```bash
   sudo mkdir -p /opt/myapp
   # 假设 app.jar 已放在 /opt/myapp/ 下
   sudo chown -R appuser:appuser /opt/myapp
   ```

3. **创建 service 文件**
   ```bash
   sudo tee /etc/systemd/system/myapp.service << 'EOF'
   [Unit]
   Description=My Java App
   After=network.target

   [Service]
   User=appuser
   WorkingDirectory=/opt/myapp
   ExecStart=/usr/bin/java -Xmx512m -jar /opt/myapp/app.jar
   Restart=on-failure
   RestartSec=10
   StandardOutput=journal
   StandardError=journal

   [Install]
   WantedBy=multi-user.target
   EOF
   ```

4. **启动服务**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl start myapp
   sudo systemctl status myapp
   sudo systemctl enable myapp
   journalctl -u myapp -f
   ```
