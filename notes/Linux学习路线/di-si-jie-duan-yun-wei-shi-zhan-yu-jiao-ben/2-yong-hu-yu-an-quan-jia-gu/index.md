---
url: >-
  /my_notes/notes/Linux学习路线/di-si-jie-duan-yun-wei-shi-zhan-yu-jiao-ben/2-yong-hu-yu-an-quan-jia-gu/index.md
---
# 用户与安全加固

服务器安全不是可选项。本章涵盖 Ubuntu 服务器的基本安全加固措施，适用于任何暴露在公网的服务器。

## 一、SSH 安全配置

SSH 是攻击者最常攻击的入口，安全配置至关重要。

### 1.1 核心安全配置

```bash
sudo vim /etc/ssh/sshd_config
```

```text
# ===== 必须修改的配置 =====
Port 2222                              # 修改默认端口（1024-65535 选一个）
PermitRootLogin no                     # ⭐ 禁止 root 直接登录
PasswordAuthentication no              # ⭐ 禁止密码登录（仅用密钥）
PubkeyAuthentication yes               # 启用密钥认证

# ===== 推荐的额外限制 =====
MaxAuthTries 3                         # 最大认证尝试次数
MaxSessions 3                          # 单连接最大会话数
ClientAliveInterval 300                # 客户端保活间隔（秒）
ClientAliveCountMax 2                  # 保活探测次数
AllowUsers alice bob                   # ⭐ 只允许指定用户登录
# AllowGroups sshusers                 # 只允许指定组的用户
Protocol 2                             # 仅使用 SSH 协议 v2

# ===== 可选禁用 =====
X11Forwarding no                       # 不需要图形转发就禁用
AllowAgentForwarding no                # 不需要 agent 转发就禁用
```

```bash
# 检查配置是否有语法错误
sudo sshd -t

# 重启 SSH 服务
sudo systemctl restart sshd
```

> ⚠️ **修改 SSH 端口或禁用密码前，务必保留一个已连接的终端！** 配置错误可能导致无法登录。

### 1.2 SSH 密钥管理

```bash
# 生成 Ed25519 密钥（推荐，比 RSA 更安全更快）
ssh-keygen -t ed25519 -C "your_email@example.com"

# 将公钥添加到服务器
ssh-copy-id -p 22 user@server
# 修改端口后记得改 -p 参数

# 查看已授权的公钥
cat ~/.ssh/authorized_keys

# 撤销某个密钥（删除对应行）
vim ~/.ssh/authorized_keys
```

***

## 二、fail2ban 防暴力破解

fail2ban 监控日志，连续登录失败达到阈值后自动封禁 IP。

```bash
# 安装
sudo apt install fail2ban -y

# 创建本地配置（不要修改默认的 jail.conf）
sudo tee /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600                  # 封禁时间（秒），默认 10 分钟
findtime = 600                  # 统计窗口（秒），默认 10 分钟
maxretry = 5                    # 最大失败次数
ignoreip = 127.0.0.1/8 192.168.0.0/16  # 白名单 IP
destemail = admin@example.com   # 通知邮箱
action = %(action_mw)s          # 封禁 + 发送邮件通知

[sshd]
enabled = true
port = 2222                     # 如果修改了 SSH 端口，这里要对应
maxretry = 3                    # SSH 的 maxretry 设低一些
EOF

# 启动并设置开机自启
sudo systemctl enable --now fail2ban

# 常用管理命令
sudo fail2ban-client status           # 查看状态
sudo fail2ban-client status sshd      # 查看 SSH jail 状态
sudo fail2ban-client set sshd unbanip 192.168.1.100  # 手动解封 IP
sudo tail -f /var/log/fail2ban.log   # 查看日志
```

***

## 三、审计（auditd）

auditd 记录系统的安全相关事件，用于事后排查。

```bash
# 安装
sudo apt install auditd -y

# 查看审计规则
sudo auditctl -l

# 添加审计规则（临时）
sudo auditctl -w /etc/passwd -p wa -k passwd_changes    # 监控 passwd 修改
sudo auditctl -w /etc/ssh/sshd_config -p wa -k sshd_config_changes
sudo auditctl -w /var/log/auth.log -p wa -k auth_log_changes

# 永久规则
sudo vim /etc/audit/rules.d/audit.rules
```

```text
# 监控关键文件
-w /etc/passwd -p wa -k passwd_changes
-w /etc/shadow -p wa -k shadow_changes
-w /etc/sudoers -p wa -k sudoers_changes
-w /etc/ssh/sshd_config -p wa -k sshd_config_changes

# 监控关键系统调用
-a always,exit -F arch=b64 -S execve -k command_exec
```

```bash
# 重启 auditd 使规则生效
sudo systemctl restart auditd

# 查看审计日志
sudo ausearch -k passwd_changes         # 按 key 搜索
sudo ausearch -m USER_LOGIN             # 查看登录事件
sudo aureport --summary                 # 审计报告摘要
```

***

## 四、系统安全最佳实践

### 4.1 用户与密码策略

```bash
# ===== 密码复杂度（通过 PAM 配置）=====
sudo apt install libpam-pwquality -y
sudo vim /etc/security/pwquality.conf
```

```text
minlen = 12                 # 最小密码长度
dcredit = -1                # 至少 1 个数字
ucredit = -1                # 至少 1 个大写字母
lcredit = -1                # 至少 1 个小写字母
ocredit = -1                # 至少 1 个特殊字符
```

```bash
# ===== 密码过期策略 =====
sudo chage -l alice                       # 查看密码到期信息
sudo chage -M 90 alice                    # 密码最大有效期 90 天
sudo chage -m 7 alice                     # 密码最小修改间隔 7 天
sudo chage -W 7 alice                     # 到期前 7 天警告

# ===== 检查空密码用户 =====
sudo awk -F: '($2 == "" || $2 == "!") {print $1}' /etc/shadow

# ===== 锁定/解锁用户 =====
sudo passwd -l alice     # 锁定
sudo passwd -u alice     # 解锁
```

### 4.2 文件权限检查

```bash
# 查找全局可写的文件
sudo find / -type f -perm -o+w 2>/dev/null

# 查找没有所有者的文件
sudo find / -nouser -o -nogroup 2>/dev/null

# 查找 SUID/SGID 文件（潜在提权风险）
sudo find / -perm -4000 -o -perm -2000 2>/dev/null

# 检查关键文件权限
ls -l /etc/passwd          # 应为 -rw-r--r-- (644)
ls -l /etc/shadow          # 应为 -rw-r----- (640)
ls -l /etc/sudoers         # 应为 -r--r----- (440)
ls -l ~/.ssh/id_rsa        # 应为 -rw------- (600)
```

### 4.3 安全更新自动化

```bash
# 安装无人值守更新
sudo apt install unattended-upgrades -y

# 启用自动安全更新
sudo tee /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

# 配置哪些更新自动安装
sudo vim /etc/apt/apt.conf.d/50unattended-upgrades
# 至少确保 "${distro_id}:${distro_codename}-security" 是启用的

# 查看自动更新日志
sudo tail -f /var/log/unattended-upgrades/unattended-upgrades.log
```

***

## 五、安全速查清单

```bash
#!/bin/bash
# 安全检查脚本 —— 在每台服务器上跑一次

echo "=== 安全检查清单 ==="

echo -n "SSH root 登录: "
sudo sshd -T | grep -i permitrootlogin

echo -n "SSH 密码登录: "
sudo sshd -T | grep -i passwordauth

echo -n "防火墙状态: "
sudo ufw status | head -1

echo "监听端口:"
sudo ss -tlnp

echo "最近登录记录:"
last -n 5

echo "SSH 认证失败记录:"
sudo grep "Failed password" /var/log/auth.log | tail -5

echo "可 sudo 的用户:"
grep -v '^#' /etc/group | grep "^sudo:" | cut -d: -f4
```

***

## 📝 实践项目

1. **修改 SSH 端口并禁用密码登录**
2. **安装配置 fail2ban**，尝试用错误密码登录 3 次观察被封禁
3. **运行安全检查清单脚本**，修复发现的问题
4. **配置自动安全更新**（unattended-upgrades）
