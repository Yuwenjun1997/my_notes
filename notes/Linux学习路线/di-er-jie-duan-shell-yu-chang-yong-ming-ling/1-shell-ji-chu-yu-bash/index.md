---
url: >-
  /my_notes/notes/Linux学习路线/di-er-jie-duan-shell-yu-chang-yong-ming-ling/1-shell-ji-chu-yu-bash/index.md
---
# Shell 基础与 Bash

## 一、Shell 概述

### 1.1 Shell 是什么

Shell 是用户与 Linux 内核之间的**命令解释器**。用户输入命令，Shell 解析后交给内核执行。

```text
用户 → 终端模拟器 → Shell (bash/zsh) → Linux 内核 → 硬件
```

### 1.2 常见 Shell 类型

| Shell | 路径 | 特点 |
|:------|:-----|:-----|
| **bash** | `/bin/bash` | 默认 Shell，兼容 sh，功能全面 |
| **zsh** | `/bin/zsh` | 兼容 bash，功能更丰富（插件机制） |
| **sh** | `/bin/sh` | 最基础的 Shell，POSIX 标准 |
| **fish** | `/usr/bin/fish` | 开箱即用（自动补全、语法高亮） |
| **dash** | `/bin/dash` | 轻量、快速，Ubuntu 的默认 /bin/sh |

```bash
# 查看当前 Shell
echo $SHELL

# 查看已安装的 Shell
cat /etc/shells

# 切换 Shell（需重新登录生效）
chsh -s /bin/zsh
```

***

## 二、环境变量

### 2.1 核心环境变量

| 变量 | 含义 | 示例值 |
|:-----|:-----|:-------|
| `$HOME` | 当前用户家目录 | `/home/alice` |
| `$PATH` | 命令搜索路径（冒号分隔） | `/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin` |
| `$USER` | 当前用户名 | `alice` |
| `$SHELL` | 当前 Shell 路径 | `/bin/bash` |
| `$PWD` | 当前工作目录 | `/home/alice/projects` |
| `$OLDPWD` | 上一个工作目录 | `/home/alice` |
| `$LANG` | 系统语言 | `en_US.UTF-8` |
| `$$` | 当前 Shell 的 PID | `12345` |
| `$?` | 上一条命令的退出码 | `0`（成功）/ 非0（失败） |

```bash
# 查看所有环境变量
env
printenv

# 查看单个变量
echo $PATH

# 临时设置（当前会话有效）
export MY_VAR="hello"

# 永久设置（写入配置文件）
echo 'export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64' >> ~/.bashrc
source ~/.bashrc          # 立即生效
```

### 2.2 PATH 变量详解

当你输入 `ls` 时，Shell 按 `$PATH` 中的路径顺序查找：

```bash
$ echo $PATH
/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# which 查看命令的实际路径
$ which ls
/usr/bin/ls

$ which java
/usr/lib/jvm/java-17-openjdk-amd64/bin/java
```

***

## 三、命令格式

### 3.1 基本格式

```text
command [options] [arguments]

ls    -l       -a        /home
命令   选项     选项      参数
```

```bash
# 选项的三种写法
ls -l                # 短选项（单字母）
ls --all             # 长选项（全称）
ls -la               # 合并短选项
ls -l --all          # 短选项 + 长选项混用

# 带参数的选项
tail -n 50 /var/log/syslog     # -n 后跟行数
grep --color=auto "ERROR" log  # --color 后跟值
```

### 3.2 命令类型

```bash
# type 查看命令类型
type ls        # ls is aliased to `ls --color=auto'  （别名）
type cd        # cd is a shell builtin               （内置命令）
type java      # java is /usr/bin/java               （外部程序）
type myfunc    # myfunc is a function                 （自定义函数）
```

| 类型 | 说明 | 示例 |
|:-----|:-----|:-----|
| **别名（alias）** | 用户自定义的命令简写 | `alias ll='ls -lah'` |
| **内置命令（builtin）** | Shell 内部实现的命令 | `cd`, `echo`, `export`, `source` |
| **外部命令** | 独立的可执行文件 | `ls`, `grep`, `java`, `python` |
| **函数（function）** | Shell 中定义的函数 | 自定义功能 |

***

## 四、命令帮助系统

### 4.1 三级帮助

```bash
# 1. 快速查看命令用法（推荐首选）
命令 --help         # 大多数命令支持
ls --help
apt --help

# 2. 详细手册（最权威）
man 命令
man ls             # q 退出，/ 搜索，n 下一个匹配
man -k keyword     # 按关键字搜索手册页
man 5 crontab      # 查看第 5 节（配置文件格式）

# 3. 简洁示例（需安装 tldr）
sudo apt install tldr -y
tldr tar           # 显示常用示例
tldr grep
tldr find
```

### 4.2 man 手册页面分区

| 节号 | 内容 |
|:-----|:-----|
| 1 | 可执行程序或 Shell 命令 |
| 2 | 系统调用（内核函数） |
| 3 | 库函数 |
| 5 | 文件格式与配置文件 |
| 7 | 协议、约定、杂项 |
| 8 | 系统管理命令 |

***

## 五、输入输出重定向与管道

### 5.1 标准流

每个进程有三个标准流：

| 流 | 文件描述符 | 默认指向 | 符号 |
|:---|:----------|:---------|:-----|
| 标准输入（stdin） | 0 | 键盘 | `<` |
| 标准输出（stdout） | 1 | 终端屏幕 | `>` `>>` |
| 标准错误（stderr） | 2 | 终端屏幕 | `2>` `2>>` |

### 5.2 输出重定向

```bash
# 覆盖写入
command > file.txt           # stdout 写入文件（覆盖）
command 2> error.log         # stderr 写入文件

# 追加入
command >> file.txt          # stdout 追加
command 2>> error.log        # stderr 追加

# 合并输出
command > all.log 2>&1       # stdout 和 stderr 合并写入同一文件
command &> all.log           # 同上（bash 简写）

# 丢弃输出
command > /dev/null 2>&1     # 丢弃所有输出（黑洞设备）
```

```bash
# 实际示例
# 将编译输出和错误都保存到文件
mvn clean package > build.log 2>&1

# 只忽略错误信息
java -jar app.jar 2>/dev/null

# 追加日志
java -jar app.jar >> app.log 2>&1
```

### 5.3 输入重定向

```bash
command < file.txt            # 从文件读取输入
command << EOF                # Here Document（多行输入）
第一行
第二行
EOF
```

Here Document 在脚本中很实用：

```bash
cat << 'EOF' > config.txt
server {
    listen 80;
    server_name example.com;
}
EOF
```

### 5.4 管道（Pipe）

管道将**前一个命令的 stdout** 连接为**后一个命令的 stdin**。

```bash
# 基本用法
command1 | command2 | command3

# 实用示例
ps aux | grep java               # 查找 Java 进程
cat access.log | grep "404" | wc -l  # 统计 404 错误数
ls -l | sort -k5 -n              # 按文件大小排序
du -sh * | sort -h | tail -5     # 找出最大的 5 个目录
history | grep "docker" | tail   # 查找最近的 docker 命令
```

> ⚠️ **注意事项**：管道只传递 stdout，stderr 默认不会通过管道。如需传递 stderr：
>
> ```bash
> command 2>&1 | grep "ERROR"
> ```

***

## 六、命令连接符

| 符号 | 含义 | 示例 |
|:-----|:-----|:-----|
| `;` | 顺序执行（不管成败） | `cmd1; cmd2; cmd3` |
| `&&` | 前成功才执行后 | `./configure && make && sudo make install` |
| `\|\|` | 前失败才执行后 | `cd /backup \|\| mkdir /backup && cd /backup` |
| `\|` | 管道（传递输出） | `ps aux \| grep nginx` |

```bash
# 常见组合
sudo apt update && sudo apt upgrade -y     # 更新成功才升级
git pull || echo "拉取失败，请检查网络"      # 失败时输出提示
mkdir -p /app/logs && cd /app/logs || exit 1  # 目录创建成功才进入
```

***

## 七、Bash 进阶：让命令更高效

### 7.1 历史记录与行编辑

```bash
history                      # 查看命令历史
history | grep docker        # 搜索历史命令
!!                           # ⭐ 重复上一条命令
!$                           # 上一条命令的最后一个参数
!n                           # 执行历史中第 n 条命令
!docker                      # 执行最近一条以 docker 开头的命令
sudo !!                      # ⭐ 上一条命令忘了加 sudo，补 sudo 执行

Ctrl+R                       # ⭐ 反向搜索历史（输入关键词，多次按继续往前找）
```

历史带上时间戳（写入 `~/.bashrc`）：

```bash
export HISTTIMEFORMAT="%F %T  "
export HISTSIZE=10000        # 内存中保留的命令数
export HISTFILESIZE=20000    # 磁盘 history 文件保留条数
```

### 7.2 Bash 扩展机制

```bash
# 大括号展开
echo {1..5}                  # 1 2 3 4 5
echo {a..e}                  # a b c d e
mkdir -p {2024,2025}/{01..06}  # 批量建目录（2.2 的 file{1,2,3}.txt 就是它）

# 命令替换：把命令输出当"值"用
echo "今天是 $(date +%F)"     # ⭐ 推荐写法
echo "今天是 `date +%F`"      # 旧写法（反引号），易与引号混淆

# 算术展开
echo $((10/3))               # 3（整数除法）
echo $((2**10))              # 1024

# 波浪号展开
cd ~                        # 家目录
cd ~alice                   # alice 用户的家目录
cd ~-                       # 相当于 cd -（$OLDPWD）
```

### 7.3 启动文件加载顺序

```bash
# 登录交互 shell（SSH 登录）：
#   /etc/profile → ~/.profile → ~/.bashrc
# 非登录交互 shell（打开终端）：
#   ~/.bashrc（Ubuntu 默认终端走这条）
# 非交互 shell（运行脚本）：
#   以上都不读，只继承父进程环境
```

> ⚠️ **"环境变量不生效"排查**：写进 `~/.bashrc` 的变量，在**脚本里读不到**——因为脚本是非交互 shell，不读 `.bashrc`。要在脚本里用，就在启动脚本前显式 `export`，或脚本内 `source ~/.bashrc`。排查用：`grep -n 变量名 ~/.bashrc ~/.profile /etc/profile`。

### 7.4 alias 与函数

```bash
alias ll='ls -lah'           # 定义别名
alias grep='grep --color=auto'
unalias ll                  # 删除别名
type -a ll                  # 查看别名定义

# 别名只对交互 shell 生效，脚本里不展开 ⚠️
```

**alias vs 函数**：别名只是文本替换，不能带参数逻辑；需要参数/条件判断时用函数。

```bash
mytar() { tar -czvf "$1.tar.gz" "$1"; }   # 函数：mytar logs 把 logs 打成 logs.tar.gz
export -f mytar             # 导出函数给子 shell 使用
```

### 7.5 进程替换与 here-string

```bash
# 进程替换 <(...)：把命令输出当"文件"传给需要文件名参数的命令
diff <(ls dirA) <(ls dirB)         # ⭐ 对比两个目录内容差异
grep -f <(grep -r "TODO" src/) file.txt

# here-string <<<：把一行字符串塞进 stdin
grep -n "ERROR" <<< "a b ERROR c"      # 结果：1:ERROR
bc <<< "10 + 20"                       # 30（给计算器喂表达式）
```

> 💡 与管道/重定向的区别：`<(cmd)` 把命令输出放进**临时文件**，适合需要"文件名"的命令（`diff`/`comm`）；here-string `<<<` 是直接喂 stdin，比 `echo xxx |` 少一次管道。heredoc `<<` 是**多行**版本（**2.7 §1.3** 深化了引号与缩进细节）。

***

## 📝 实践项目

### 目标

掌握 Shell 基本操作和环境配置。

### 步骤

1. **探索 PATH**
   ```bash
   echo $PATH
   which ls java python3
   # 查找所有包含 "python" 的可执行文件
   whereis python3
   ```

2. **使用帮助系统**
   ```bash
   man ls          # 浏览手册（按 q 退出）
   tldr tar        # 查看简洁示例
   type ls cd echo # 查看命令类型
   ```

3. **重定向与管道练习**
   ```bash
   # 生成文件列表并保存
   ls -la /etc > ~/etc-list.txt

   # 只保存错误
   ls /nonexistent 2> ~/error.log

   # 管道实战：查找最大的 5 个文件
   find /usr -type f -exec ls -l {} \; 2>/dev/null | sort -k5 -rn | head -5
   ```

4. **配置环境变量**
   ```bash
   # 创建自定义 bin 目录
   mkdir -p ~/bin
   echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
   source ~/.bashrc
   echo $PATH   # 验证 ~/bin 已加入 PATH
   ```
