---
title: Linux 学习路线
permalink: /notes/Linux学习路线/
createTime: 2026/08/15 17:33:35
---

# 🐧 Linux 系统操作学习路线 (Ubuntu)

> 一份面向 Java 后端开发者的 Linux 系统化学习指南，涵盖**基础入门 → Shell 命令 → 系统管理 → 运维实战**四个阶段，聚焦 Ubuntu 发行版。

---

## 📋 目录索引

- [第一阶段：Linux 基础入门](#-第一阶段linux-基础入门)
- [第二阶段：Shell 与常用命令](#-第二阶段shell-与常用命令)
- [第三阶段：系统管理进阶](#-第三阶段系统管理进阶)
- [第四阶段：运维实战与脚本](#-第四阶段运维实战与脚本)
- [学习路线总览](#-学习路线总览)

---

## 📘 第一阶段：Linux 基础入门

> **学习周期**：1-2 周 | **每日建议**：2-3 小时
> **目标**：了解 Linux 历史与发行版体系，掌握 Ubuntu 安装配置、文件系统结构和用户权限基础。

| 模块 | 核心内容 | 文档 |
|:-----|:---------|:----:|
| **1.1 Linux 概述与发行版** | Linux 内核与 GNU 项目、主流发行版对比（Debian/Ubuntu/CentOS/Arch）、Ubuntu 版本周期（LTS 与非 LTS） | [📖 查看](./第一阶段-Linux基础入门/1.1-Linux概述与发行版.md) |
| **1.2 Ubuntu 安装与环境配置** | 安装方式（WSL2/虚拟机/双系统）、apt 换源（清华/阿里镜像）、SSH 远程连接配置、终端美化（Oh My Zsh） | [📖 查看](./第一阶段-Linux基础入门/1.2-Ubuntu安装与环境配置.md) |
| **1.3 文件系统与目录结构** | FHS 标准目录结构（/etc /var /usr /home /opt）、文件类型（普通/目录/链接/设备）、inode 与硬链接/软链接、挂载概念 | [📖 查看](./第一阶段-Linux基础入门/1.3-文件系统与目录结构.md) |
| **1.4 用户与权限管理** | 用户/组概念、`/etc/passwd` 与 `/etc/shadow`、文件权限（rwx）与八进制表示、chmod/chown/chgrp、sudo 配置（visudo） | [📖 查看](./第一阶段-Linux基础入门/1.4-用户与权限管理.md) |

---

## 🚀 第二阶段：Shell 与常用命令

> **学习周期**：3-4 周 | **每日建议**：2-3 小时
> **目标**：熟练掌握 Bash 操作和 Linux 核心命令，能够高效地在终端中完成日常文件操作、文本处理、进程管理和软件安装。

| 模块 | 核心内容 | 文档 |
|:-----|:---------|:----:|
| **2.1 Shell 基础与 Bash** | Shell 概念与类型（bash/zsh/fish）、环境变量（PATH/HOME/SHELL）、命令格式与帮助系统（man/tldr/--help）、输入输出重定向与管道 | [📖 查看](./第二阶段-Shell与常用命令/2.1-Shell基础与Bash.md) |
| **2.2 文件与目录操作** | ls/cd/pwd、cp/mv/rm/mkdir/touch、find/locate 文件查找、tar/gzip/zip 压缩归档、rsync 同步 | [📖 查看](./第二阶段-Shell与常用命令/2.2-文件与目录操作.md) |
| **2.3 文本处理命令** | cat/less/head/tail 查看、grep 搜索（正则）、sed 流编辑、awk 数据处理、sort/uniq/wc 统计、vim 基础操作 | [📖 查看](./第二阶段-Shell与常用命令/2.3-文本处理命令.md) |
| **2.4 进程管理与系统监控** | ps/top/htop 进程查看、kill/pkill 信号控制、后台运行（&/nohup）、systemd 服务管理、free/df/du/iostat 资源监控 | [📖 查看](./第二阶段-Shell与常用命令/2.4-进程管理与系统监控.md) |
| **2.5 软件包管理** | apt/dpkg 包管理、PPA 添加与管理、snap 与 flatpak、源码编译安装（./configure && make && make install）、常见开发环境搭建（JDK/Node/Python） | [📖 查看](./第二阶段-Shell与常用命令/2.5-软件包管理.md) |
| **2.6 文本查看与编辑** | less/more 分页查看、vim 编辑器进阶（模式/多文件/分屏/.vimrc）、nano 快速编辑、工具对比与选择 | [📖 查看](./第二阶段-Shell与常用命令/2.6-文本查看与编辑.md) |
| **2.7 文本操作命令进阶** | cat 高阶用法（-A/-s/heredoc/拼接）、查看命令全家桶速查（nl/rev/od）、vim 进阶技巧（宏/可视块/寄存器/批量替换）、nano 进阶配置 | [📖 查看](./第二阶段-Shell与常用命令/2.7-文本操作命令进阶.md) |

---

## ⚡ 第三阶段：系统管理进阶

> **学习周期**：2-3 周 | **每日建议**：2-3 小时
> **目标**：掌握磁盘管理、网络配置、服务管理和日志分析等系统管理核心技能。

| 模块 | 核心内容 | 文档 |
|:-----|:---------|:----:|
| **3.1 磁盘管理与文件系统** | 分区与挂载（fdisk/lsblk/mount）、文件系统类型（ext4/xfs/btrfs）、LVM 逻辑卷管理、磁盘配额、dd 与数据恢复 | [📖 查看](./第三阶段-系统管理进阶/3.1-磁盘管理与文件系统.md) |
| **3.2 网络配置与诊断** | 网络接口配置（netplan/ip）、DNS 配置（/etc/resolv.conf / systemd-resolved）、防火墙（ufw/iptables）、诊断工具（ping/ss/netstat/tcpdump/curl） | [📖 查看](./第三阶段-系统管理进阶/3.2-网络配置与诊断.md) |
| **3.3 服务管理（systemd）** | systemd 架构、Unit 类型与编写、journalctl 日志查看、target 运行级别、timer 替代 cron | [📖 查看](./第三阶段-系统管理进阶/3.3-服务管理-systemd.md) |
| **3.4 日志管理与分析** | syslog 协议与 rsyslog、journald 日志系统、logrotate 日志轮转、集中式日志方案简介（ELK/Loki） | [📖 查看](./第三阶段-系统管理进阶/3.4-日志管理与分析.md) |
| **3.5 定时任务与自动化** | Cron 表达式与 crontab、at 一次性任务、systemd timer 对比 cron、Ansible 基础入门 | [📖 查看](./第三阶段-系统管理进阶/3.5-定时任务与自动化.md) |

---

## 🏗️ 第四阶段：运维实战与脚本

> **学习周期**：3-4 周 | **每日建议**：3-4 小时
> **目标**：掌握 Shell 脚本编程，能够编写自动化脚本，具备 Linux 安全加固、性能调优和容器化部署能力。

| 模块 | 核心内容 | 文档 |
|:-----|:---------|:----:|
| **4.1 Shell 脚本编程** | 变量与参数、条件判断（if/case）、循环（for/while）、函数与模块化、错误处理（set -e/trap）、调试技巧（set -x）、实战脚本示例 | [📖 查看](./第四阶段-运维实战与脚本/4.1-Shell脚本编程.md) |
| **4.2 用户与安全加固** | SSH 安全配置（密钥认证/禁用 root/修改端口）、fail2ban 防暴力破解、审计（auditd）、最小权限原则实践 | [📖 查看](./第四阶段-运维实战与脚本/4.2-用户与安全加固.md) |
| **4.3 性能调优与故障排查** | CPU/内存/IO 瓶颈定位、strace/lsof 诊断工具、内核参数调优（sysctl）、常见故障场景与排查思路 | [📖 查看](./第四阶段-运维实战与脚本/4.3-性能调优与故障排查.md) |

---

## 📐 学习路线总览

```
第一阶段：Linux 基础入门（1-2周）
    │  概述 → 安装 → 文件系统 → 用户权限
    ▼
第二阶段：Shell 与常用命令（3-4周）
    │  Shell基础 → 文件操作 → 文本处理 → 进程管理 → 包管理 → 文本查看编辑 → 文本操作进阶
    ▼
第三阶段：系统管理进阶（2-3周）
    │  磁盘管理 → 网络配置 → systemd → 日志分析 → 定时任务
    ▼
第四阶段：运维实战与脚本（3-4周）
    Shell脚本 → 安全加固 → 性能调优
```

### 💡 学习建议

1. **动手优先**：每个命令都要在终端中实际敲一遍，不要只看文档。建议在 Ubuntu 22.04/24.04 LTS 环境中练习。
2. **善用 WSL2**：Windows 用户推荐使用 WSL2 安装 Ubuntu，既保留 Windows 桌面环境，又能获得接近原生 Linux 的体验。
3. **遇到问题查 man**：养成 `man <命令>` 或 `tldr <命令>` 查文档的习惯，不要只依赖搜索引擎。
4. **命令记笔记**：将常用命令和参数记录到个人 CheatSheet 中，方便日后查阅。
5. **脚本化思维**：重复操作超过两次，就考虑写成脚本自动化 —— 这是运维工程师的核心素养。
6. **安全第一**：在生产环境执行命令前，先确认影响范围（尤其是 `rm -rf`、`chmod 777`、`iptables` 等危险操作）。

### 🔧 推荐工具与资源

| 类别 | 工具/资源 | 说明 |
|:-----|:----------|:-----|
| 终端模拟器 | Windows Terminal / Tabby / iTerm2 | 现代化终端，支持多标签、分屏 |
| Shell | Oh My Zsh + Starship | Zsh 美化与智能提示 |
| 远程连接 | MobaXterm / Termius | SSH 客户端，支持 X11 转发 |
| 在线练习 | [OverTheWire Bandit](https://overthewire.org/wargames/bandit/) | 闯关式 Linux 命令练习 |
| 命令速查 | `tldr` / `cheat` 工具 | 比 man 更简洁的命令示例 |

---

## 🛡️ 常用命令速查表

### 系统信息

```bash
uname -a              # 查看内核/系统信息
lsb_release -a        # 查看 Ubuntu 发行版信息
hostnamectl           # 查看主机名与系统信息
uptime                # 查看系统运行时间
```

### 文件与目录

```bash
ls -lah               # 详细列表（含隐藏文件、人类可读大小）
find . -name "*.log"  # 按名称查找文件
du -sh * | sort -h    # 按大小排序显示目录占用
df -h                 # 查看磁盘挂载与使用情况
```

### 文本处理

```bash
grep -r "ERROR" /var/log/          # 递归搜索含 ERROR 的日志
sed -i 's/old/new/g' file.txt      # 原地替换文本
awk '{print $1, $3}' data.txt      # 打印第1、3列
tail -f /var/log/syslog            # 实时跟踪日志
less -N /var/log/syslog            # 分页查看日志（显示行号）
command | less                     # 长输出分页查看
vim /path/to/file                  # vim 编辑文件（:wq 保存退出）
nano /path/to/file                 # nano 快速编辑文件
```

### 进程管理

```bash
ps aux --sort=-%mem | head -10     # 按内存占用 Top 10
kill -9 <PID>                      # 强制终止进程
systemctl status nginx             # 查看服务状态
journalctl -u nginx -f             # 实时查看服务日志
```

### 网络

```bash
ss -tlnp                           # 查看所有监听端口
curl -I https://example.com        # 查看 HTTP 响应头
netstat -i                         # 查看网络接口统计
tcpdump -i eth0 port 80            # 抓取 80 端口流量
```

### 包管理

```bash
sudo apt update && sudo apt upgrade   # 更新系统
apt search <keyword>                  # 搜索软件包
apt show <package>                    # 查看包详情
sudo apt autoremove --purge           # 清理无用包
```

---

<!-- 最后更新时间：2026-08-14 -->
