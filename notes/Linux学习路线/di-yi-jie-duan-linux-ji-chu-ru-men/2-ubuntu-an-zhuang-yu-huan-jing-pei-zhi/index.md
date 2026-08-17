---
url: >-
  /my_notes/notes/Linux学习路线/di-yi-jie-duan-linux-ji-chu-ru-men/2-ubuntu-an-zhuang-yu-huan-jing-pei-zhi/index.md
---
# Ubuntu 安装与环境配置

## 一、安装方式选择

### 1.1 三种主流安装方式对比

| 方式 | 优点 | 缺点 | 推荐场景 |
|:-----|:-----|:-----|:---------|
| **WSL2** | 与 Windows 无缝集成、资源占用小、启动快 | 无原生 GUI、systemd 需额外配置 | Windows 用户学习/开发 |
| **虚拟机（VMware/VirtualBox）** | 完整 Linux 环境、可快照回滚 | 占用资源多、性能损耗 | 需要完整桌面体验 |
| **双系统** | 原生性能、完整硬件访问 | 切换麻烦、有数据丢失风险 | 主力使用 Linux |

> 💡 **推荐**：Windows 用户首选 WSL2 方式，这是微软官方支持的方案，性能与便利性最佳平衡。

***

## 二、WSL2 安装 Ubuntu（推荐）

### 2.1 安装步骤

**Step 1：启用 WSL2**

在 Windows PowerShell（管理员）中执行：

```powershell
# 启用 WSL 功能
wsl --install

# 如果没有自动安装，手动启用
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

# 重启电脑后，设置 WSL2 为默认版本
wsl --set-default-version 2
```

**Step 2：安装 Ubuntu**

```powershell
# 查看可用发行版
wsl --list --online

# 安装 Ubuntu（推荐 24.04 LTS）
wsl --install -d Ubuntu-24.04

# 首次启动会提示创建用户名和密码
```

**Step 3：基本配置**

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 设置中文语言（可选）
sudo apt install language-pack-zh-hans -y
sudo update-locale LANG=zh_CN.UTF-8
```

### 2.2 WSL2 常用管理命令

```bash
# 在 Windows PowerShell 中执行

wsl --list --verbose          # 查看已安装的 WSL 发行版
wsl --shutdown                # 关闭所有 WSL 实例
wsl -d Ubuntu-24.04           # 启动指定发行版
wsl --export Ubuntu-24.04 ubuntu-backup.tar    # 导出备份
wsl --import Ubuntu-Copy .\Ubuntu-Copy ubuntu-backup.tar  # 导入备份
```

***

## 三、apt 换源（加速软件下载）

### 3.1 国内镜像源

Ubuntu 默认软件源在海外，国内访问速度慢。推荐换成清华或阿里云镜像。

**清华源配置（Ubuntu 24.04）**：

```bash
# 1. 备份原始源文件
sudo cp /etc/apt/sources.list /etc/apt/sources.list.backup

# 2. 编辑源文件
sudo vim /etc/apt/sources.list
```

将内容替换为：

```text
# 清华大学 Ubuntu 24.04 镜像源
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ noble main restricted universe multiverse
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ noble-updates main restricted universe multiverse
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ noble-backports main restricted universe multiverse
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ noble-security main restricted universe multiverse
```

```bash
# 3. 更新软件源
sudo apt update
```

> ⚠️ **注意事项**：不同 Ubuntu 版本的代号不同：
>
> * Ubuntu 22.04 → `jammy`
> * Ubuntu 24.04 → `noble`
> * 请根据实际版本替换源中的代号。

### 3.2 阿里云镜像（备选）

```text
deb https://mirrors.aliyun.com/ubuntu/ noble main restricted universe multiverse
deb https://mirrors.aliyun.com/ubuntu/ noble-updates main restricted universe multiverse
deb https://mirrors.aliyun.com/ubuntu/ noble-backports main restricted universe multiverse
deb https://mirrors.aliyun.com/ubuntu/ noble-security main restricted universe multiverse
```

***

## 四、SSH 远程连接配置

### 4.1 安装并启动 SSH 服务

```bash
# 安装 OpenSSH 服务端
sudo apt install openssh-server -y

# 启动 SSH 服务
sudo systemctl start ssh
sudo systemctl enable ssh     # 开机自启

# 查看 SSH 服务状态
sudo systemctl status ssh
```

### 4.2 SSH 配置文件（重要）

```bash
# 编辑 SSH 配置
sudo vim /etc/ssh/sshd_config
```

关键配置项：

```text
# 修改默认端口（安全加固）
Port 2222                              # 默认 22，建议修改

# 禁止 root 直接登录
PermitRootLogin no                     # 默认 prohibit-password

# 仅允许密钥登录（禁用密码登录）
PasswordAuthentication no              # 先配置好密钥再改为 no

# 允许的用户
AllowUsers yourusername
```

修改后重启服务：

```bash
sudo systemctl restart ssh
```

> ⚠️ **注意事项**：修改 SSH 配置前务必保留一个已连接的终端窗口，防止配置错误导致无法连接。

### 4.3 SSH 密钥认证

```bash
# 在本地（Windows）生成密钥对（PowerShell）
ssh-keygen -t ed25519 -C "your_email@example.com"

# 将公钥复制到 Ubuntu
ssh-copy-id -p 22 username@your-server-ip

# 或者手动复制
cat ~/.ssh/id_ed25519.pub | ssh user@host "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

***

## 五、终端美化（可选）

### 5.1 安装 Oh My Zsh

```bash
# 安装 Zsh
sudo apt install zsh -y

# 设为默认 Shell
chsh -s $(which zsh)

# 安装 Oh My Zsh
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
```

### 5.2 推荐插件

编辑 `~/.zshrc`，在 `plugins=` 中添加：

```bash
plugins=(
    git                    # Git 别名与快捷操作
    z                      # 智能目录跳转
    zsh-autosuggestions    # 命令自动建议（灰色提示）
    zsh-syntax-highlighting  # 命令语法高亮
    extract                # 万能解压命令
)
```

安装第三方插件：

```bash
# 自动建议
git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions

# 语法高亮
git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting
```

***

## 六、进阶：WSL2 调优、换源安全与 SSH 排障

### 6.1 WSL2 调优：.wslconfig 与 WSLg

```ini
# %USERPROFILE%\.wslconfig（Windows 用户目录下）
[wsl2]
memory=8GB            # 限制 WSL2 占用内存（默认取宿主机一半）
processors=4          # 限制 CPU 核数
swap=2GB
# 新版支持 GUI（WSLg），Windows 11 上可直接跑 Linux 图形应用
```

```bash
# 在 WSL2 里启用 systemd（新版默认已开；旧版在 /etc/wsl.conf 加）
# /etc/wsl.conf
# [boot]
# systemd=true
# 然后 wsl --shutdown 重启 WSL 生效（关联 3.3 systemd）

# /mnt/c 的性能注意：跨文件系统访问慢
# 代码/编译产物放 Linux 侧（~/），不要放 /mnt/c，IO 差 10 倍以上 ⭐
```

> 💡 WSL2 本质是**轻量 VM**（微软定制内核），所以资源/IO 与原生有差距；但它有快照、无缝集成、启动快等优势，是 Windows 上学习 Linux 的最佳平衡。生产仍是原生 Linux。

### 6.2 apt 换源的安全姿势（替代 §3 的旧写法）

```bash
# ⭐ 新版推荐：signed-by 绑定密钥 + deb822 源文件
# Ubuntu 22.04+ 源默认在 /etc/apt/sources.list.d/ubuntu.sources（deb822 格式）
cat /etc/apt/sources.list.d/ubuntu.sources

# 手动加第三方源的标准姿势（如 Docker 官方源）
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /usr/share/keyrings/docker.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu noble stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update
```

> ⚠️ **`apt-key` 已弃用**：它是全局信任，密钥泄露影响所有源。正确做法是每源一个密钥文件 + `signed-by` 绑定。细节见 **2.5 §7.2**。§3 里直接改 `sources.list` 的写法能用，但只适用于官方源换镜像（不涉及第三方 GPG）。

### 6.3 SSH 排障：连不上时看什么

```bash
# 1. 先加 -v 看握手过程卡在哪一步 ⭐
ssh -v user@server
#   debug1: Connecting to server ...      ← 连接阶段（不通=网络/防火墙）
#   debug1: Offering public key: ...      ← 认证阶段（报错=密钥/权限问题）

# 2. 判断错误类型
#   "Connection refused"   → SSH 服务没起来 / 端口被防火墙拒绝
#   "Connection timed out" → 网络不通（路由/防火墙 DROP），不是 SSH 的问题
nc -zv server 22        # 直接测端口通不通

# 3. known_hosts 冲突修复（提示 host key 变化时）⭐
ssh-keygen -R server        # 删除旧 host key 记录
ssh user@server             # 重新确认并记录新 key

# 4. 权限问题
chmod 600 ~/.ssh/id_ed25519         # 私钥必须 600
chmod 700 ~/.ssh
chmod 644 ~/.ssh/authorized_keys    # 服务器端公钥 644（目录 700）
```

### 6.4 WSL2 与 /mnt/c 性能

```bash
# 慢的根源：/mnt/c 走 9P 协议跨内核文件系统访问
# 优化建议：
#   - 项目代码放 ~/（Linux 原生 ext4），不要放 /mnt/c
#   - 需要共享给 Windows 的产物，构建后再 cp 到 /mnt/c
#   - 大量小文件读写（node_modules/编译缓存）差异最明显
time ls -R /mnt/c/Users/you/code 2>/dev/null | wc -l    # 对比 ~ 下的耗时
```

### 6.5 Oh My Zsh 的历史与别名

```bash
# ~/.zshrc 里配置历史与别名
export HISTFILE=~/.zsh_history
export HISTSIZE=10000
export SAVEHIST=10000
setopt HIST_IGNORE_DUPS        # 忽略连续重复命令
setopt SHARE_HISTORY           # 多个终端共享历史

alias ll='ls -lah'
alias gs='git status'
alias gd='git diff'
alias ..='cd ..'
# 定义后立即生效：source ~/.zshrc

# zsh 历史在 ~/.zsh_history，bash 在 ~/.bash_history
# 命令历史操作（!!、!$、Ctrl+R）在两个 shell 里通用（2.1 §7.1）
```

> 💡 别名/历史是每个终端用户的"第一生产力配置"。注意别名只在交互 shell 生效（**2.1 §7.4**），脚本里别依赖 `ll` 这类自定义别名。

***

## 📝 实践项目

### 目标

完成 Ubuntu 环境的完整搭建与配置。

### 步骤

1. **安装 Ubuntu**（WSL2 或虚拟机）
2. **执行系统更新**：`sudo apt update && sudo apt upgrade -y`
3. **换源**：将软件源更换为清华/阿里云镜像
4. **安装并配置 SSH**，使用密钥登录
5. **（可选）配置 Oh My Zsh** 美化终端
6. **验证**：在 Windows 终端通过 `ssh` 连接到 Ubuntu

### 验证清单

```bash
# ✅ 系统版本正确
lsb_release -a

# ✅ apt 源已更新
sudo apt update

# ✅ SSH 服务运行中
sudo systemctl status ssh

# ✅ 能从本地 SSH 连接
ssh username@localhost -p 2222
```
