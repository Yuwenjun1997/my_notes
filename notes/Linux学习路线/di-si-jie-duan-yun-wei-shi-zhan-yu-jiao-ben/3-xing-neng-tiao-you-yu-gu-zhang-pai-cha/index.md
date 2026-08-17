---
url: >-
  /my_notes/notes/Linux学习路线/di-si-jie-duan-yun-wei-shi-zhan-yu-jiao-ben/3-xing-neng-tiao-you-yu-gu-zhang-pai-cha/index.md
---
# 性能调优与故障排查

本章涵盖常见的性能瓶颈定位方法和故障排查工具，帮助你在生产环境中快速定位问题。

## 一、性能瓶颈定位

### 1.1 三步定位法

```text
服务器变慢了？
├── 第一步：看整体 → free -h, uptime, df -h, dmesg | tail
├── 第二步：看进程 → htop, ps aux --sort=-%cpu
└── 第三步：深入分析 → strace, lsof, perf, iostat
```

### 1.2 CPU 瓶颈

```bash
# 查看负载
uptime                    # 1/5/15 分钟平均负载
# 经验：负载 < CPU 核心数 → OK，负载 > 核心数 → CPU 瓶颈

# 找出 CPU 占用最高的进程
ps aux --sort=-%cpu | head -11

# 实时监控
htop                      # 彩色界面，可交互

# 查看 CPU 详情
lscpu
cat /proc/cpuinfo | grep "cpu cores" | uniq

# 查看某个进程的 CPU 亲和性
taskset -p <PID>

# 查看上下文切换
vmstat 1 5                # cs 列 = 每秒上下文切换数
```

### 1.3 内存瓶颈

```bash
# 查看内存概览
free -h

# 找出内存占用最高的进程
ps aux --sort=-%mem | head -11

# 持续监控
watch -n 2 free -h
vmstat 1 5                # si/so 列 = swap in/out（非零说明内存不足）

# 查看某个进程的详细内存
pmap -x <PID>
cat /proc/<PID>/status | grep -E "VmRSS|VmSwap"

# OOM Killer 日志
dmesg | grep -i "out of memory"
grep -i "out of memory" /var/log/syslog
```

### 1.4 磁盘 I/O 瓶颈

```bash
# I/O 实时监控
iostat -x 1              # 关注 %util（接近100% → I/O瓶颈）

# 找出正在大量读写的进程
sudo iotop -o            # 只看有 I/O 活动的进程

# 查看磁盘延迟
ioping -c 10 /data       # 需安装: sudo apt install ioping

# 查看磁盘调度器
cat /sys/block/sda/queue/scheduler
# [mq-deadline] none    ← 当前使用的调度器
```

***

## 二、诊断工具

### 2.1 strace — 跟踪系统调用

```bash
# 跟踪进程
sudo strace -p <PID>                     # 附加到运行中的进程
sudo strace -c -p <PID>                  # 统计系统调用耗时
sudo strace -e trace=open,read,write -p <PID>  # 只跟踪特定调用

# 跟踪命令
strace ls                                # 跟踪 ls 的系统调用

# 实用场景
# 1. 找出程序卡住的位置
sudo strace -p <PID> 2>&1 | tail

# 2. 查看 Java 应用打开的文件
sudo strace -e trace=open,openat -p $(pgrep java) 2>&1 | grep "\.jar\|\.so"

# 3. 统计哪个系统调用最耗时
sudo strace -c -p <PID> -T
# 输出会显示每个系统调用的次数、耗时
```

### 2.2 lsof — 列出打开的文件

```bash
# 查看进程打开的文件
sudo lsof -p <PID>                       # 指定进程
sudo lsof -c java                        # 指定命令名

# 查看端口占用 ⭐
sudo lsof -i :8080                       # 哪个进程占用了 8080
sudo lsof -i tcp:1-1024                  # 所有系统端口

# 查看文件被谁使用
sudo lsof /var/log/syslog                # 谁在写这个日志
sudo lsof /data                           # 谁在使用这个目录

# 查看网络连接
sudo lsof -i                             # 所有网络连接
sudo lsof -i @192.168.1.100              # 连接到指定 IP
```

### 2.3 其他实用工具

```bash
# 查看文件系统类型和挂载选项
findmnt -T /data

# 统计目录下的文件数
find /var/log -type f | wc -l

# 查看系统启动时间
systemd-analyze
systemd-analyze blame             # 各服务启动耗时

# 查看内核加载的模块
lsmod | sort
```

***

## 三、内核参数调优

### 3.1 sysctl 配置

```bash
# 查看当前值
sysctl -a | grep tcp_keepalive
sysctl net.ipv4.ip_forward

# 临时修改
sudo sysctl -w net.ipv4.ip_forward=1

# 永久修改
sudo vim /etc/sysctl.d/99-custom.conf
sudo sysctl -p /etc/sysctl.d/99-custom.conf
```

### 3.2 常用内核优化

```bash
sudo tee /etc/sysctl.d/99-server-tuning.conf << 'EOF'
# ===== 网络优化 =====
# TCP 连接复用（减少 TIME_WAIT）
net.ipv4.tcp_tw_reuse = 1

# 扩大端口范围
net.ipv4.ip_local_port_range = 1024 65535

# 启用 TCP keepalive（检测死连接）
net.ipv4.tcp_keepalive_time = 600
net.ipv4.tcp_keepalive_intvl = 60
net.ipv4.tcp_keepalive_probes = 3

# ===== 文件描述符限制 =====
fs.file-max = 655350
fs.inotify.max_user_watches = 524288   # 文件监控上限（IDE 和文件同步工具需要）

# ===== 内存优化 =====
# 减少 swap 使用倾向（0=尽量不用, 100=积极使用）
vm.swappiness = 10
# 保留最小空闲内存
vm.min_free_kbytes = 65536

# ===== 安全 =====
# 防止 SYN flood 攻击
net.ipv4.tcp_syncookies = 1
EOF

sudo sysctl -p /etc/sysctl.d/99-server-tuning.conf
```

***

## 四、常见故障场景与排查

### 4.1 磁盘空间满了

```bash
# 1. 确认是大分区满了
df -h

# 2. 找出大目录
sudo du -h --max-depth=1 / | sort -h | tail -10

# 3. 找出大文件
sudo find / -type f -size +1G 2>/dev/null

# 4. 检查已删除但未释放的文件（lsof 查 deleted）
sudo lsof +L1
# 如果有进程持有已删除的文件句柄，重启该进程即可释放空间

# 5. 检查 inode 是否用完
df -i
```

### 4.2 内存不足 / OOM

```bash
# 1. 确认内存使用
free -h

# 2. 找出内存大户
ps aux --sort=-%mem | head -10

# 3. 查看 OOM Killer 历史
dmesg | grep -i oom
grep -i "out of memory" /var/log/syslog

# 4. 检查 swap
swapon --show
cat /proc/swaps
```

### 4.3 进程无法杀死

```bash
# 1. 先尝试优雅终止
kill -15 <PID>

# 2. 若无效，检查进程状态
ps -p <PID> -o stat
# D 状态 = 等待磁盘 I/O，无法被 kill，只能等 I/O 完成

# 3. 找父进程
ps -p <PID> -o ppid

# 4. 最后手段
kill -9 <PID>
```

### 4.4 服务启动失败

```bash
# 1. 查看服务状态
sudo systemctl status myservice

# 2. 查看详细日志
journalctl -u myservice -n 50 --no-pager

# 3. 手动启动看报错
sudo /usr/bin/myapp --verbose

# 4. 检查端口是否被占用
sudo lsof -i :<PORT>

# 5. 检查配置文件语法
sudo nginx -t               # nginx
sudo apache2ctl configtest  # Apache
```

***

## 📝 实践项目

### 模拟 CPU 故障排查

```bash
# 1. 安装 stress 工具
sudo apt install stress -y

# 2. 模拟 CPU 压力
stress --cpu 2 --timeout 60s &

# 3. 在另一个终端排查
uptime                              # 看负载
htop                                # 找 CPU 最高的进程
ps aux --sort=-%cpu | head -5      # 确认

# 4. 停止 stress
pkill stress
```

### 模拟磁盘 I/O 排查

```bash
# 1. 模拟大量磁盘写入
dd if=/dev/zero of=/tmp/testfile bs=1M count=1000 oflag=direct &

# 2. 排查
iostat -x 1                         # 看 %util
sudo iotop -o                       # 找 I/O 进程

# 3. 清理
rm /tmp/testfile
```
