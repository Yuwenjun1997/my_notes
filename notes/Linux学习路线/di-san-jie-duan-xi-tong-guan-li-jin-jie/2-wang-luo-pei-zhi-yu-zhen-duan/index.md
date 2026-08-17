---
url: >-
  /my_notes/notes/Linux学习路线/di-san-jie-duan-xi-tong-guan-li-jin-jie/2-wang-luo-pei-zhi-yu-zhen-duan/index.md
---
# 网络配置与诊断

## 一、网络接口配置

### 1.1 查看网络信息

```bash
# IP 地址
ip addr show                          # ⭐ 现代方式
ip a                                  # 同上（简写）
ifconfig                              # 传统方式（需安装 net-tools）

# 路由表
ip route show                         # ⭐ 查看路由表
route -n                              # 传统方式

# DNS 配置
cat /etc/resolv.conf                   # DNS 服务器配置
resolvectl status                      # systemd-resolved 状态
systemd-resolve --status               # 旧版命令

# 网卡信息
ip link show                          # 查看所有网络接口
ethtool eth0                          # 网卡硬件信息（速度、双工模式）
```

### 1.2 Ubuntu 网络配置（netplan）

Ubuntu 17.10+ 使用 **netplan** 管理网络。

```bash
# 查看 netplan 配置
ls /etc/netplan/
cat /etc/netplan/00-installer-config.yaml
```

**静态 IP 示例**（`/etc/netplan/01-static.yaml`）：

```yaml
network:
  version: 2
  renderer: networkd
  ethernets:
    eth0:
      addresses:
        - 192.168.1.100/24
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses: [223.5.5.5, 8.8.8.8]
```

```bash
# 应用配置
sudo netplan apply
sudo netplan try           # 测试配置（超时自动回滚）
```

### 1.3 主机名

```bash
hostnamectl                         # 查看主机名信息
sudo hostnamectl set-hostname myserver  # 设置主机名

cat /etc/hostname                   # 主机名配置文件
cat /etc/hosts                      # 本地 DNS 解析
```

***

## 二、网络诊断工具

### 2.1 连通性测试

```bash
# ping — 测试网络连通性
ping -c 4 google.com                # 发送 4 个包
ping -i 0.5 google.com              # 每 0.5 秒发一个（需 sudo）

# traceroute — 追踪路由路径
traceroute google.com               # 需安装：sudo apt install traceroute
mtr google.com                      # 动态 traceroute（更好用）

# 测试端口是否通
nc -zv google.com 80                # nc (netcat) 测试端口
nc -zv 192.168.1.100 8080
timeout 3 bash -c '</dev/tcp/192.168.1.100/8080' && echo "OPEN" || echo "CLOSED"
```

### 2.2 DNS 诊断

```bash
# nslookup — 查询 DNS
nslookup google.com
nslookup google.com 8.8.8.8         # 用指定 DNS 服务器查询

# dig — 更详细的 DNS 查询 ⭐
dig google.com                      # 查询 A 记录
dig google.com +short               # 只显示 IP
dig -x 8.8.8.8                      # 反向查询（IP → 域名）
dig google.com MX                   # 查询 MX（邮件）记录
dig google.com NS                   # 查询 NS（域名服务器）记录
dig google.com ANY                  # 查询所有记录
dig @8.8.8.8 google.com             # 用指定 DNS 服务器

# resolvectl — systemd DNS
resolvectl query google.com
resolvectl statistics               # DNS 统计信息
```

### 2.3 HTTP 诊断 (curl)

```bash
# ===== 基本请求 =====
curl https://api.example.com/users          # GET 请求
curl -I https://api.example.com             # 只看响应头
curl -v https://api.example.com             # 显示详细过程（含请求头、SSL 握手）⭐
curl -o output.txt https://example.com      # 下载到文件
curl -O https://example.com/file.tar.gz     # 使用远程文件名保存

# ===== 发送数据 =====
curl -X POST https://api.example.com/users \
    -H "Content-Type: application/json" \
    -d '{"name":"Alice","age":30}'

# ===== 调试 ⭐ =====
# 查看完整请求和响应（最实用的调试方式）
curl -w "\n时间详情:\nDNS解析: %{time_namelookup}s\n连接: %{time_connect}s\nTTFB: %{time_starttransfer}s\n总时间: %{time_total}s\nHTTP状态码: %{http_code}\n" \
    -o /dev/null -s https://example.com
```

### 2.4 数据包捕获 (tcpdump)

```bash
# 基本抓包
sudo tcpdump -i eth0                        # 抓取 eth0 的所有流量
sudo tcpdump -i eth0 port 80                # 只抓 80 端口
sudo tcpdump -i eth0 host 192.168.1.100     # 只抓指定主机的流量
sudo tcpdump -i eth0 port 80 -w capture.pcap  # 保存到文件
sudo tcpdump -r capture.pcap                # 读取文件

# 实用组合
sudo tcpdump -i any port 443 -n             # 抓所有接口的 HTTPS 流量
sudo tcpdump -i eth0 'tcp[tcpflags] & (tcp-syn|tcp-fin) != 0'  # 抓 TCP 握手和挥手
```

***

## 三、防火墙配置 (ufw)

Ubuntu 推荐使用 **ufw（Uncomplicated Firewall）**，它是 iptables 的友好封装。

```bash
# ===== 基本操作 =====
sudo ufw status                      # 查看状态
sudo ufw status verbose              # 详细状态
sudo ufw enable                      # 启用防火墙
sudo ufw disable                     # 禁用防火墙
sudo ufw reload                      # 重新加载规则

# ===== 规则配置 =====
# 允许/拒绝端口
sudo ufw allow 22                    # 允许 SSH
sudo ufw allow 80/tcp                # 只允许 TCP 80 端口
sudo ufw allow 443                   # 允许 HTTPS（TCP 和 UDP）
sudo ufw allow 8080/tcp              # 允许 8080（Java 应用常用）
sudo ufw deny 3306                   # 拒绝 MySQL 端口

# 允许/拒绝 IP
sudo ufw allow from 192.168.1.100    # 允许该 IP 访问所有端口
sudo ufw allow from 192.168.1.0/24 to any port 22  # 允许网段访问 SSH

# 删除规则
sudo ufw status numbered             # 显示规则编号
sudo ufw delete 2                    # 按编号删除

# 默认策略
sudo ufw default deny incoming       # 默认拒绝入站 ⭐ 推荐
sudo ufw default allow outgoing      # 默认允许出站
```

### 典型的 Web 服务器防火墙配置

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22                    # SSH（如修改了端口则改此处）
sudo ufw allow 80/tcp                # HTTP
sudo ufw allow 443/tcp               # HTTPS
sudo ufw enable
sudo ufw status verbose
```

> ⚠️ **注意事项**：配置防火墙前确保已放行 SSH 端口（默认 22），否则可能把自己锁在外面！建议在本地终端（非 SSH）操作防火墙配置。

***

## 四、网络问题排查思路

```text
网络不通？
├── 1. 检查本机网络接口 → ip a
├── 2. 检查内网连通性  → ping 网关 IP
├── 3. 检查 DNS 解析    → nslookup/dig 目标域名
├── 4. 检查外网连通性  → ping 8.8.8.8
├── 5. 检查端口开放    → nc -zv 目标IP 端口
├── 6. 检查防火墙规则  → sudo ufw status
└── 7. 抓包分析       → sudo tcpdump -i any host 目标IP
```

***

## 📝 实践项目

```bash
# 1. 查看本机网络配置
ip a
ip route show
cat /etc/resolv.conf

# 2. 测试网络连通性
ping -c 4 8.8.8.8
ping -c 4 baidu.com
traceroute baidu.com

# 3. 用 dig 分析域名
dig baidu.com +short
dig baidu.com NS
dig baidu.com | grep -E "Query time|SERVER"

# 4. 用 curl 测试 API
curl -I https://httpbin.org/json
curl -w "\n总耗时: %{time_total}s\n" -o /dev/null -s https://httpbin.org/json

# 5. 配置并检查防火墙
sudo ufw status
# 如果未启用，不要在生产环境实验
# sudo ufw enable
# sudo ufw allow 22
```
