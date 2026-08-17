---
url: >-
  /my_notes/notes/Linux学习路线/di-er-jie-duan-shell-yu-chang-yong-ming-ling/5-ruan-jian-bao-guan-li/index.md
---
# 软件包管理

Ubuntu 使用 **APT（Advanced Package Tool）** 和 **dpkg** 进行软件包管理。掌握包管理是 Linux 使用的基础技能。

## 一、apt — 高级包管理器

### 1.1 核心操作

```bash
# ===== 更新与升级 =====
sudo apt update                              # 更新软件包索引 ⭐
sudo apt upgrade -y                          # 升级所有可升级的软件包
sudo apt full-upgrade                        # 更彻底的升级（可处理依赖变更）

# 一条命令更新所有
sudo apt update && sudo apt upgrade -y

# ===== 搜索与查看 =====
apt search nginx                             # 搜索软件包
apt search --names-only nginx                # 只搜索包名
apt show nginx                               # 查看软件包详情（版本、依赖、描述）
apt list --installed                         # 列出已安装的包
apt list --installed | grep nginx            # 搜索已安装的包
apt list --upgradeable                       # 列出可升级的包
apt policy nginx                             # 查看软件包策略（各版本优先级）

# ===== 安装与删除 =====
sudo apt install nginx -y                    # 安装
sudo apt install nginx=1.18.0-0ubuntu1       # 安装指定版本
sudo apt remove nginx                        # 删除（保留配置文件）
sudo apt purge nginx                         # 完全删除（含配置文件）⭐ 推荐
sudo apt autoremove                          # 删除不再需要的自动依赖 ⭐
sudo apt autoremove --purge                  # 同上 + 清理配置

# ===== 清理 =====
sudo apt clean                               # 清空下载的 deb 缓存
sudo apt autoclean                           # 只删除过时的 deb 缓存
```

### 1.2 常见问题处理

```bash
# 修复损坏的依赖
sudo apt install -f                          # 或 sudo apt --fix-broken install

# 解锁 apt（当被其他进程占用时）
sudo rm /var/lib/dpkg/lock-frontend
sudo rm /var/lib/apt/lists/lock
sudo dpkg --configure -a

# 解决 GPG 密钥过期问题
sudo apt-key adv --keyserver keyserver.ubuntu.com --recv-keys KEY_ID
# 或
curl -fsSL https://example.com/key.gpg | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/example.gpg
```

> ⚠️ **注意事项**：
>
> * 安装新软件前务必先 `sudo apt update`，否则可能安装旧版本
> * 不要混用 `apt remove` 和 `apt purge` 的管理习惯，统一用 `purge` 更干净
> * `apt autoremove` 等于定期清理，可有效释放磁盘空间

***

## 二、dpkg — 底层包管理

```bash
# ===== 安装与删除本地 deb 包 =====
sudo dpkg -i package.deb                    # 安装本地 deb 包
sudo dpkg -r package-name                   # 删除（保留配置）
sudo dpkg -P package-name                   # 完全删除

# ===== 查询 =====
dpkg -l                                      # 列出所有已安装的包
dpkg -l | grep nginx                         # 搜索已安装的包
dpkg -L nginx                                # 列出包安装的所有文件 ⭐
dpkg -S /usr/sbin/nginx                      # 查找文件属于哪个包
dpkg -s nginx                                # 查看包的状态信息
dpkg --get-selections                        # 导出已安装包列表
dpkg --get-selections > packages.list        # 备份
sudo dpkg --set-selections < packages.list   # 恢复
```

***

## 三、PPA 与第三方源

### 3.1 PPA（Personal Package Archive）

PPA 是 Launchpad 上的个人软件仓库，可安装官方源中没有的软件。

```bash
# 添加 PPA
sudo add-apt-repository ppa:deadsnakes/ppa   # Python 多版本 PPA
sudo apt update

# 删除 PPA
sudo add-apt-repository --remove ppa:deadsnakes/ppa

# 列出已添加的 PPA
ls /etc/apt/sources.list.d/

# 常用 PPA 示例
sudo add-apt-repository ppa:git-core/ppa      # Git 最新版
sudo add-apt-repository ppa:ondrej/php        # PHP 多版本
```

### 3.2 手动添加第三方源

```bash
# 方式一：直接添加源文件
sudo vim /etc/apt/sources.list.d/docker.list
# 内容：
deb [arch=amd64] https://download.docker.com/linux/ubuntu noble stable

# 添加 GPG 密钥
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/docker.gpg

# 更新
sudo apt update
```

> ⚠️ **注意事项**：第三方源存在安全风险，只添加信任的来源。生产环境应尽量避免使用 PPA。

***

## 四、Snap 与 Flatpak

### 4.1 Snap（Ubuntu 官方推荐）

```bash
# 搜索与安装
snap find nvim                          # 搜索
sudo snap install nvim --classic        # 安装（--classic 允许访问系统文件）
sudo snap install nvim --channel=stable # 指定通道

# 管理
snap list                               # 列出已安装的 Snap
sudo snap refresh                       # 更新所有 Snap
sudo snap refresh nvim                  # 更新指定 Snap
sudo snap remove nvim                   # 删除
snap changes                            # 查看操作历史
```

### 4.2 apt vs snap vs flatpak

| 对比维度 | apt (deb) | Snap | Flatpak |
|:---------|:----------|:-----|:--------|
| 包体积 | 最小 | 较大（含依赖） | 较大（含运行时） |
| 更新方式 | 手动或 unattended-upgrades | 自动更新 | 手动 |
| 沙箱隔离 | 无 | 有（AppArmor） | 有（Bubblewrap） |
| 启动速度 | 快 | 较慢（首次） | 较慢 |
| 适用场景 | 系统核心、库、工具 | 桌面应用 | 桌面应用 |

***

## 五、源码编译安装

有些软件不在仓库中，需要从源码编译安装。

### 5.1 标准编译三步走

```bash
# 安装编译工具
sudo apt install build-essential -y

# 标准流程
./configure            # 1. 配置（检查依赖、生成 Makefile）
make                   # 2. 编译
sudo make install      # 3. 安装
```

### 5.2 实战：从源码安装 nginx

```bash
# 安装编译依赖
sudo apt build-dep nginx -y

# 下载源码
wget https://nginx.org/download/nginx-1.26.0.tar.gz
tar -xzvf nginx-1.26.0.tar.gz
cd nginx-1.26.0/

# 配置（指定安装路径和模块）
./configure \
    --prefix=/usr/local/nginx \
    --with-http_ssl_module \
    --with-http_v2_module \
    --with-stream

# 编译与安装
make -j$(nproc)        # -j 并行编译，利用多核
sudo make install

# 验证
/usr/local/nginx/sbin/nginx -v
```

### 5.3 卸载源码安装的软件

```bash
# 在源码目录中
sudo make uninstall      # 如果支持

# 或者直接删除安装目录
sudo rm -rf /usr/local/nginx
```

***

## 六、开发环境搭建

### 6.1 JDK 安装（Java 开发必备）

```bash
# 安装 OpenJDK 17
sudo apt install openjdk-17-jdk -y

# 安装 OpenJDK 21
sudo apt install openjdk-21-jdk -y

# 查看已安装的 Java 版本
update-java-alternatives --list

# 切换默认 Java 版本
sudo update-alternatives --config java

# 配置 JAVA_HOME
echo 'export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64' >> ~/.bashrc
echo 'export PATH=$JAVA_HOME/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### 6.2 其他开发工具

```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install nodejs -y

# Python 3
sudo apt install python3 python3-pip python3-venv -y

# Maven
sudo apt install maven -y

# Git（最新版）
sudo add-apt-repository ppa:git-core/ppa -y
sudo apt update && sudo apt install git -y

# Docker（使用官方脚本）
curl -fsSL https://get.docker.com | sudo bash
sudo usermod -aG docker $USER    # 免 sudo 使用 Docker
```

### 6.3 批量安装脚本

```bash
#!/bin/bash
# 一键安装 Java 开发常用工具
sudo apt update && sudo apt upgrade -y

# 基础工具
sudo apt install -y \
    build-essential \
    curl \
    wget \
    git \
    vim \
    htop \
    net-tools \
    unzip \
    jq

# 开发工具
sudo apt install -y \
    openjdk-17-jdk \
    maven \
    python3 python3-pip

echo "✅ 开发环境安装完成！"
```

***

## 七、进阶：版本锁定、多版本共存与故障修复

### 7.1 apt-mark 版本锁定与下载

```bash
# 锁定/解锁软件包版本（apt upgrade 时不会升级）⭐
sudo apt-mark hold redis          # 锁定 redis 版本
sudo apt-mark unhold redis        # 解锁
apt-mark showhold                 # 列出所有被锁定的包

# 只下载 deb 不安装（可离线/审计）
apt-get download redis            # 当前目录得到 redis*.deb
apt download nginx                # apt 语法同样支持

# apt-file 查找"文件属于哪个包"（解决缺头文件/库文件报错）⭐
sudo apt install apt-file -y
sudo apt-file update
apt-file search string.h          # 哪个包提供 string.h
```

### 7.2 deb822 源格式与 signed-by

```bash
# 新版 Ubuntu（22.04+）源默认改用 deb822 格式：
# /etc/apt/sources.list.d/ubuntu.sources

# 手动添加第三方源的推荐姿势（signed-by 明确绑定 GPG 密钥）⭐
curl -fsSL https://example.com/gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/example.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/example.gpg] https://example.com/ubuntu noble main" \
  | sudo tee /etc/apt/sources.list.d/example.list

# 验证源配置
apt-cache policy example-tool     # 看能否解析到版本
```

> ⚠️ **弃用 `apt-key add`**：它在 `/etc/apt/trusted.gpg.d` 里全局信任所有源，一旦密钥泄露影响面大。新姿势是每源一个密钥文件 + `signed-by` 绑定（**1.2 换源**已有说明）。2.5 §1.2 里的 `apt-key adv --recv-keys` 是遗留写法，仅作应急参考。

### 7.3 dpkg 维护与 broken 包修复

```bash
# 检查包数据库一致性
sudo dpkg --audit                       # 找出未配置/半安装的包

# 重新触发配置（改配置后想让服务重新生成配置）
sudo dpkg-reconfigure tzdata            # 重新配置时区
sudo dpkg-reconfigure openssh-server

# broken 包修复标准流程 ⭐
sudo dpkg --configure -a                # 修复未配置的包
sudo apt install -f                     # 修复损坏依赖
sudo apt update && sudo apt upgrade -y  # 恢复更新

# 查看包被哪些文件占用/包状态字段
dpkg -S /usr/sbin/nginx
dpkg-query -W -f='${Package} ${Version} ${Status}\n' nginx
```

### 7.4 update-alternatives：多版本共存切换

```bash
# 一个命令有多个候选版本时，用 alternatives 统一管理 ⭐
update-alternatives --list java                    # 列出所有候选
sudo update-alternatives --config java             # 交互式切换
sudo update-alternatives --install /usr/bin/java java /usr/lib/jvm/java-17-openjdk-amd64/bin/java 1700
sudo update-alternatives --install /usr/bin/java java /usr/lib/jvm/java-21-openjdk-amd64/bin/java 2100
#   最后一个数字是优先级，数值大者默认生效

# 手动切到指定版本
sudo update-alternatives --set java /usr/lib/jvm/java-17-openjdk-amd64/bin/java
# 移除候选
sudo update-alternatives --remove java /usr/lib/jvm/java-17-openjdk-amd64/bin/java
```

> 💡 比"改 `~/.bashrc` 的 PATH"更规范：alternatives 把版本切换做成系统级、可逆的，装多个 JDK/Node/Python 时用它（`update-java-alternatives` 是其 Java 专用封装，§6.1 已用到）。

### 7.5 apt 版本 pin 与 snap 进阶

```bash
# 版本 pin：锁定软件包的"来源/版本"优先级（/etc/apt/preferences.d/）
# 文件 99-pin
# Package: redis-server
# Pin: version 7.*
# Pin-Priority: 1001      # >1000 表示强制安装该版本

# snap 隔离等级
sudo snap install nvim --classic      # classic：无完整沙箱（如 IDE、CLI）
snap info nvim                        # 查看 confinement（confined/classic）

# snap 服务管理
snap services                         # 列出 snap 提供的服务 ⭐
sudo snap restart <snap>.service
snap connections nvim                  # 查看可插拔接口
```

***

## 📝 实践项目

### 目标

掌握软件包管理全流程。

### 步骤

1. **系统更新与清理**
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt autoremove --purge -y
   sudo apt autoclean
   ```

2. **搜索并安装软件**
   ```bash
   apt search "redis"              # 搜索 Redis
   apt show redis                  # 查看详情
   sudo apt install redis -y       # 安装
   dpkg -L redis                   # 查看安装的文件
   ```

3. **查看已安装软件信息**
   ```bash
   dpkg -l | grep redis            # 查看包状态
   apt list --installed | grep redis
   ```

4. **彻底卸载**
   ```bash
   sudo apt purge redis -y         # 删除包和配置
   sudo apt autoremove --purge -y  # 清理依赖
   dpkg -l | grep redis            # 确认已删除
   ```

5. **检查系统清理情况**
   ```bash
   df -h /                         # 查看磁盘空间
   du -sh /var/cache/apt/          # apt 缓存大小
   uname -r                        # 当前内核版本
   dpkg -l | grep linux-image      # 查看旧内核（可清理）
   ```
