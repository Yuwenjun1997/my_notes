---
url: >-
  /my_notes/notes/Linux学习路线/di-san-jie-duan-xi-tong-guan-li-jin-jie/5-ding-shi-ren-wu-yu-zi-dong-hua/index.md
---
# 定时任务与自动化

## 一、Cron 定时任务

### 1.1 Cron 表达式

```text
┌───────── 分钟 (0 - 59)
│ ┌───────── 小时 (0 - 23)
│ │ ┌───────── 日 (1 - 31)
│ │ │ ┌───────── 月 (1 - 12)
│ │ │ │ ┌───────── 星期 (0 - 7, 0 和 7 都表示周日)
│ │ │ │ │
* * * * * 要执行的命令
```

| 表达式 | 含义 |
|:-------|:-----|
| `*/5 * * * *` | 每 5 分钟 |
| `0 * * * *` | 每小时整点 |
| `0 2 * * *` | 每天凌晨 2 点 |
| `30 9 * * 1-5` | 工作日上午 9:30 |
| `0 0 1 * *` | 每月 1 号零点 |
| `0 0 * * 6` | 每周六零点 |
| `0 8,12,18 * * *` | 每天 8:00、12:00、18:00 |

特殊字符：

| 字符 | 含义 | 示例 |
|:-----|:-----|:-----|
| `*` | 任意值 | `* * * * *` 每分钟 |
| `,` | 列举 | `0 8,18 * * *` 8 点和 18 点 |
| `-` | 范围 | `0 9-17 * * 1-5` 工作时间 |
| `/` | 步进 | `*/10 * * * *` 每 10 分钟 |

### 1.2 crontab 命令

```bash
# 编辑当前用户的 crontab
crontab -e                # ⭐ 最常用

# 查看当前用户的 crontab
crontab -l

# 删除当前用户的 crontab
crontab -r

# 以指定用户身份编辑
sudo crontab -u alice -e

# 系统级 crontab
cat /etc/crontab
ls /etc/cron.d/
ls /etc/cron.daily/       # 每天执行
ls /etc/cron.hourly/      # 每小时执行
ls /etc/cron.weekly/      # 每周执行
ls /etc/cron.monthly/     # 每月执行
```

### 1.3 crontab 编写示例

```bash
# 编辑 crontab
crontab -e
```

```bash
# 变量设置
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
MAILTO=admin@example.com       # 任务输出发送到此邮箱

# 每天凌晨 3 点备份数据库
0 3 * * * /opt/scripts/backup-db.sh >> /var/log/backup.log 2>&1

# 每小时清理临时文件
0 * * * * find /tmp -type f -mtime +1 -delete

# 每 5 分钟检查服务健康
*/5 * * * * curl -s http://localhost:8080/health || echo "Health check failed at $(date)" >> /var/log/health.log

# 每周日凌晨 4 点更新系统
0 4 * * 0 sudo apt update && sudo apt upgrade -y >> /var/log/apt-upgrade.log 2>&1
```

> ⚠️ **注意事项**：
>
> * crontab 中 `%` 是特殊字符，需转义为 `\%`（如 `date +\%Y\%m\%d`）
> * cron 任务的环境变量非常精简（通常只有 HOME、LOGNAME、PATH=/usr/bin:/bin），**不要假设有完整 PATH**
> * cron 任务的**所有路径建议使用绝对路径**
> * 命令末尾加 `>> /var/log/xxx.log 2>&1` 记录日志，否则排查问题非常困难

***

## 二、at 一次性任务

```bash
# 安装
sudo apt install at -y

# 定时执行（一次性）
echo "tar -czvf /backup/data-$(date +%Y%m%d).tar.gz /data" | at 02:00
echo "shutdown -h now" | at 23:00
echo "/opt/scripts/deploy.sh" | at now + 1 hour     # 1 小时后
echo "/opt/scripts/cleanup.sh" | at now + 30 minutes # 30 分钟后

# 查看待执行任务
atq

# 删除任务
atrm 任务编号
```

***

## 三、systemd timer vs cron

| 对比维度 | cron | systemd timer |
|:---------|:-----|:--------------|
| 配置复杂度 | 极简 | 需要编写两个文件 |
| 日志 | 需手动配置 | 自动进入 journald ⭐ |
| 环境变量 | 极简（易出错） | 正常系统环境 |
| 错过补偿 | 无 | 支持 Persistent（补执行） |
| 资源限制 | 无 | 可限制 CPU/内存 |
| 适用场景 | 简单定时任务 | 复杂、需可靠执行的定时任务 |

**选择建议**：简单任务用 cron，需要可靠执行和日志追踪的用 systemd timer。

***

## 四、Ansible 基础入门

当管理的服务器超过 3 台，手动操作就不现实了。Ansible 是主流的自动化运维工具。

### 4.1 核心概念

```text
控制节点（Control Node）：安装了 Ansible 的机器
受控节点（Managed Nodes）：被管理的服务器（无需安装 agent，只需 SSH）

清单（Inventory）：管理主机的列表
剧本（Playbook）：YAML 格式的自动化任务脚本
模块（Module）：Ansible 执行具体操作的单元
```

### 4.2 安装与快速上手

```bash
# 安装 Ansible
sudo apt install ansible -y

# 验证
ansible --version
```

**创建 Inventory**：

```bash
# /etc/ansible/hosts 或自定义文件
sudo tee ~/inventory.ini << 'EOF'
[webservers]
web1 ansible_host=192.168.1.10 ansible_user=ubuntu
web2 ansible_host=192.168.1.11 ansible_user=ubuntu

[dbservers]
db1 ansible_host=192.168.1.20 ansible_user=ubuntu
EOF
```

**Ad-Hoc 命令**（单条执行）：

```bash
# Ping 所有主机
ansible all -i inventory.ini -m ping

# 在所有 web 服务器上执行命令
ansible webservers -i inventory.ini -m shell -a "uptime"

# 在所有主机上安装 nginx
ansible all -i inventory.ini -m apt -a "name=nginx state=present" --become
```

**Playbook 示例**（`deploy-web.yml`）：

```yaml
---
- name: 部署 Web 服务器
  hosts: webservers
  become: yes

  tasks:
    - name: 确保 nginx 已安装
      apt:
        name: nginx
        state: present

    - name: 确保 nginx 正在运行
      systemd:
        name: nginx
        state: started
        enabled: yes

    - name: 部署网站文件
      copy:
        src: ./index.html
        dest: /var/www/html/index.html
        owner: www-data
        group: www-data
        mode: '0644'

    - name: 确保防火墙已配置
      ufw:
        rule: allow
        port: '80,443'
        proto: tcp
```

```bash
# 执行 Playbook
ansible-playbook -i inventory.ini deploy-web.yml
```

***

## 📝 实践项目

### 目标

编写实用的定时备份任务。

### 步骤

1. **创建备份脚本**
   ```bash
   sudo tee /opt/scripts/backup.sh << 'EOF'
   #!/bin/bash
   BACKUP_DIR="/backup"
   DATE=$(date +%Y%m%d)
   RETENTION_DAYS=7

   mkdir -p "$BACKUP_DIR"

   # 备份 /etc 目录
   tar -czvf "$BACKUP_DIR/etc-$DATE.tar.gz" /etc

   # 备份数据库（示例）
   # mysqldump -u root myapp > "$BACKUP_DIR/db-$DATE.sql"

   # 清理旧备份
   find "$BACKUP_DIR" -type f -mtime +$RETENTION_DAYS -delete

   echo "[$(date)] Backup completed"
   EOF

   sudo chmod +x /opt/scripts/backup.sh
   ```

2. **配置 crontab**
   ```bash
   crontab -e
   ```
   添加：
   ```bash
   # 每天凌晨 2 点备份
   0 2 * * * /opt/scripts/backup.sh >> /var/log/backup.log 2>&1
   ```

3. **手动测试**
   ```bash
   sudo /opt/scripts/backup.sh
   ls -lh /backup/
   cat /var/log/backup.log
   ```

4. **检查 cron 日志**
   ```bash
   grep CRON /var/log/syslog | tail
   journalctl -u cron | tail
   ```
