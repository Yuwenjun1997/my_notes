---
url: >-
  /my_notes/notes/Linux学习路线/di-er-jie-duan-shell-yu-chang-yong-ming-ling/6-wen-ben-cha-kan-yu-bian-ji/index.md
---
# 文本查看与编辑

Linux 终端里查看和编辑文件是最高频的操作之一。本节把工具分成两类：**查看**（只读，如 less/more/cat/head/tail）和**编辑**（修改内容，如 vim/nano），并深入讲解 less、vim、nano 三个主力工具的用法、快捷键参考和实用技巧。

## 一、文本查看与编辑概览

`cat`/`head`/`tail`/`more` 的基础用法已在 **2.2 §1.4 查看文件内容** 和 **2.3 §1.1 快速查看** 讲过，这里用一张表做全景对比：

| 命令 | 用途 | 适用场景 | 可翻页 | 可搜索 | 可编辑 |
|:-----|:-----|:---------|:------:|:------:|:------:|
| `cat` | 完整输出到终端 | 小文件、拼接文件 | ❌ | ❌ | ❌ |
| `head` | 查看开头 N 行 | 文件/日志头部 | ❌ | ❌ | ❌ |
| `tail` | 查看末尾 N 行 / `-f` 实时跟踪 | 日志最新内容 | ❌ | ❌ | ❌ |
| `more` | 旧版分页查看 | 极少用（兼容老习惯） | ✅ | 有限 | ❌ |
| `less` | ⭐ 高效分页查看 | 大文件、长命令输出 | ✅ | ✅ | ❌ |
| `vim` | 全功能编辑器 | 代码/系统配置/长期编辑 | ✅ | ✅ | ✅ |
| `nano` | 轻量编辑器 | 快速改配置 | ✅ | ✅ | ✅ |

> 💡 **选用原则**：只查看 → `less`（大文件/日志首选）；快速改几行配置 → `nano`；认真学编辑、运维必备 → `vim`；日常写代码 → 图形化 IDE（VS Code Remote），但命令行编辑器仍要会用。

***

## 二、less — 高效分页查看器

`less` 是 `more` 的增强版（名字玩的是 "less is more" 的梗）。它加载大文件快、可上下翻页、可搜索，是查看日志的第一选择。2.2 §1.4 已有 5 行最简速记，这里给出完整用法与快捷键参考。

### 2.1 基本用法

```bash
less /var/log/syslog          # 分页查看文件
less -N app.log               # 显示行号 ⭐ 最常用
less -R error.log             # 保留 ANSI 颜色（彩色日志）
less -S long.log              # 超长行截断（不换行，方向键横向滚动）
less -i app.log               # 搜索时忽略大小写

grep ERROR app.log | less     # ⭐ 管道分页查看长输出（管道见 2.1 §5.4）
sudo less +F /var/log/syslog  # 打开即进入实时跟踪模式
less +/Exception stack.log    # 打开即定位到第一个匹配

less f1.log f2.log            # 同时打开多个文件，:n 下一个 / :p 上一个
```

### 2.2 快捷键参考

| 按键 | 功能 |
|:-----|:-----|
| `空格` / `f` | 下一页 |
| `b` | 上一页 |
| `j` / `k` | 向下 / 向上滚动一行 |
| `g` / `G` | 跳到文件开头 / 末尾 |
| `100g` 或 `:100` | 跳到第 100 行 |
| `/关键词` | 向下搜索 |
| `?关键词` | 向上搜索 |
| `n` / `N` | 下一个 / 上一个匹配 |
| `F` | ⭐ 实时跟踪（同 `tail -f`），`Ctrl+C` 停止跟踪 |
| `=` | 显示当前行号、列号和文件进度百分比 |
| `v` | 用默认编辑器（vim）打开当前文件 |
| `m 字母` / `' 字母` | 当前位置打标记 / 跳回标记 |
| `h` | 打开内置帮助 |
| `q` | 退出 |

### 2.3 实战：查看大日志

```bash
# 查看系统主日志（大文件，less 几乎秒开）
sudo less -N /var/log/syslog
#   G 跳到文件末尾 → F 进入实时跟踪 → Ctrl+C 停止跟踪
#   → / 搜索关键词 → n 下一个匹配 → q 退出

# 排查认证日志中的暴力破解
sudo less /var/log/auth.log
#   /Failed password   回车   n 继续查看下一个匹配
```

> 💡 `/var/log` 下各日志文件的含义见 **3.4 日志管理与分析**；`journalctl ... | less` 的场景见 **3.3 §四 journalctl 日志管理**。

### 2.4 实用技巧

* **设置默认参数**：在 `~/.bashrc` 里加一行 `export LESS="-N -R"`，之后 `less` 自动带行号、保留颜色。
* **任何长输出都能分页**：`命令 | less`，例如 `ps aux | less`、`journalctl -u nginx -p err | less -R`。
* **大日志三步走**：`G` 跳末尾 → `F` 实时跟踪 → `Ctrl+C` 停下继续翻。
* **按 `v` 从 less 直接进入 vim** 编辑当前文件，改完退出 `:q` 后回到 less。
* ⚠️ less 只读不改，编辑文件请用 vim/nano。

***

## 三、more — 旧版分页查看器

```bash
more /etc/services      # 空格 下一页   b 上一页   / 搜索   q 退出
```

`more` 不能自由向上翻页、搜索能力弱、不支持光标键，功能是 `less` 的真子集。**统一用 `less` 即可**，习惯 `more` 的可以 `alias more=less` 把它替换掉。

***

## 四、vim — 终端编辑器之王

vim 的三种模式和基础操作速查已在 **2.3 §六 vim 基础操作** 介绍（含模式图解与 ⚠️ 模式混淆警告）。本节提供**完整快捷键参考与进阶技巧**，本文件列出的键是 2.3 所列键的超集，含义一致。

### 4.1 四种模式图解

```text
普通模式 Normal ── i/a/o/s ──→ 插入模式 Insert
      ↑                            │
      │         Esc / Ctrl+[ ──────┘
      │
      ├── v / V / Ctrl+v ──→ 可视模式 Visual
      ├── : ──→ 命令行模式 Command-line
      └── / ? ──→ 搜索模式
```

底部状态栏会显示当前处于哪种模式（如 `-- INSERT --`、`-- VISUAL --`），**进入 vim 后先看状态栏确认模式**，这是避免混乱的第一步。

### 4.2 快捷键参考

#### 模式切换

| 按键 | 功能 |
|:-----|:-----|
| `i` / `I` | 在光标前 / 行首插入 |
| `a` / `A` | 在光标后 / 行尾插入 |
| `o` / `O` | 在下一行 / 上一行新建一行插入 |
| `s` / `S` | 删除光标处字符 / 清空整行再插入 |
| `Esc` / `Ctrl+[` | 退出插入模式，回到普通模式 |
| `:` | 进入命令行模式 |
| `v` / `V` / `Ctrl+v` | 进入可视模式（字符 / 行 / 块） |

#### 移动光标（普通模式）

| 按键 | 功能 |
|:-----|:-----|
| `h j k l` | 左 下 上 右 |
| `w` / `b` | 下一个 / 上一个单词开头 |
| `e` | 单词结尾 |
| `0` / `^` | 行首 / 行首第一个非空字符 |
| `$` | 行尾 |
| `gg` / `G` | 文件开头 / 末尾 |
| `:N` 或 `Ngg` | 跳到第 N 行 |
| `Ctrl+d` / `Ctrl+u` | 向下 / 向上滚动半页 |
| `Ctrl+f` / `Ctrl+b` | 向下 / 向上翻整页 |
| `%` | 括号匹配（`(` 与 `)`、`{` 与 `}`） |
| `*` / `#` | 向下 / 向上搜索光标所在的词 |

#### 编辑操作（普通模式）

| 按键 | 功能 |
|:-----|:-----|
| `x` / `X` | 删除光标处 / 光标前字符 |
| `dd` | 删除整行 |
| `D` | 删除到行尾 |
| `yy` | 复制整行 |
| `p` / `P` | 粘贴到下一行 / 上一行 |
| `u` / `Ctrl+r` | 撤销 / 重做 |
| `.` | 重复上一次操作 |
| `~` | 切换大小写 |
| `J` | 合并下一行到当前行 |
| `>>` / `<<` | 整行缩进 / 反缩进 |
| `r` / `R` | 替换单个字符 / 连续替换模式 |
| `cw` / `cc` / `C` | 改单词 / 改整行 / 改到行尾 |

#### 搜索与替换

| 按键 | 功能 |
|:-----|:-----|
| `/关键词` | 向下搜索 |
| `?关键词` | 向上搜索 |
| `n` / `N` | 下一个 / 上一个匹配 |
| `*` | 向下搜索光标所在的词 |
| `:s/old/new/g` | 当前行全部替换 |
| `:%s/old/new/g` | 全文替换 |
| `:%s/old/new/gc` | 全文替换（每次确认）⭐ 最安全 |
| `:noh` | 清除搜索高亮 |

#### 保存与退出（命令行模式）

| 按键 | 功能 |
|:-----|:-----|
| `:w` | 保存 |
| `:q` | 退出 |
| `:wq` | 保存并退出 |
| `:q!` | ⚠️ 强制退出（不保存） |
| `ZZ` | 保存并退出（等同 `:wq`） |
| `:x` | 有改动才保存，然后退出 |

#### 多文件 / 缓冲 / 分屏

| 按键 | 功能 |
|:-----|:-----|
| `vim f1 f2` | 一次打开多个文件 |
| `:n` / `:prev` | 切换到下一个 / 上一个文件 |
| `:ls` | 列出所有缓冲文件 |
| `:b N` / `:bd` | 跳到第 N 个缓冲 / 关闭缓冲 |
| `:tabnew` / `gt` / `gT` | 新标签页 / 下一个标签 / 上一个标签 |
| `:sp` / `:vsp` | 水平 / 垂直分屏 |
| `Ctrl+w w` | 在窗口间切换 |
| `Ctrl+w h/j/k/l` | 切换到左 / 下 / 上 / 右窗口 |
| `Ctrl+w q` | 关闭当前窗口 |

#### 可视模式与寄存器

| 按键 | 功能 |
|:-----|:-----|
| `v` / `V` / `Ctrl+v` | 字符 / 行 / 块选择 |
| 选中后 `y` / `d` | 复制 / 删除选中内容 |
| 选中后 `>` / `<` | 缩进 / 反缩进选中块 |
| 选中后 `u` / `U` | 转为小写 / 大写 |
| `"ayy` | 复制整行到寄存器 a |
| `"ap` | 粘贴寄存器 a 的内容 |
| `"+y` / `"+p` | 复制到 / 粘贴系统剪贴板 |
| `:reg` | 查看所有寄存器内容 |

### 4.3 .vimrc 常用配置入门

vim 配置文件在 `~/.vimrc`，保存后执行 `:source ~/.vimrc` 立即生效。Ubuntu 默认只装了精简版 `vi`（vim-tiny），完整版需 `sudo apt install vim -y`（关联 **2.5 软件包管理**）。

```vim
set number              " 显示行号
set relativenumber      " 相对行号（配合 d N j 跳转很方便）
syntax on               " 语法高亮
set tabstop=4           " Tab 占 4 个空格宽度
set shiftwidth=4        " 缩进宽度 4
set expandtab           " 按 Tab 时插入空格
set autoindent          " 自动缩进
set hlsearch            " 搜索高亮
set incsearch           " 边输入边搜索
set ignorecase smartcase " 搜索忽略大小写（含大写字母时自动区分）
set mouse=a             " 支持鼠标操作
```

### 4.4 实用技巧与学习建议

* **先跑一遍 `vimtutor`**：vim 自带 30 分钟交互式教程，直接敲 `vimtutor` 进入，是公认的最佳入门方式。
* **学习顺序**：模式 → `hjkl` 移动 → `i/a/o` 插入 → `dd/yy/p` → 搜索替换 → 多文件分屏。
* **救命三连**：狂按 `Esc` 回普通模式 → 改乱了按 `u` 撤销 → 实在不行 `:q!` 放弃修改。
* **经常 `:w` 保存**；改系统配置文件前先备份：`sudo cp /etc/fstab /etc/fstab.bak`。
* **`Ctrl+w` 在 vim 里是窗口快捷键，不是退出**！想关窗口用 `Ctrl+w q`，退文件用 `:q`。

> ⚠️ **警告**：
>
> * 注意区分普通/插入模式（看底部状态栏确认 `-- INSERT --`）。
> * 未保存就 `:q!` 会丢失全部修改。
> * 使用中文输入法时，先切回英文输入法再按 `Esc` 或 `/`，否则会输入中文命令导致困惑。
> * 不要一开始就装一堆插件，先把原生键位练熟。

***

## 五、nano — 新手友好的编辑器

nano 是 Ubuntu 自带的轻量编辑器，打开即可所见即所得地输入，**屏幕底部两行常驻快捷键提示**，零学习成本，适合快速改配置。

### 5.1 基本操作

```bash
nano file.txt          # 打开/新建文件（直接输入即编辑）
nano -l file.txt       # 显示行号

# Ctrl+O 保存（Enter 确认）   Ctrl+X 退出（有修改会问 Y/N）
# Ctrl+W 搜索（再按 Ctrl+W 跳到下一个匹配）
# 底部提示中 ^ 表示 Ctrl，M 表示 Alt
```

### 5.2 快捷键参考

| 按键 | 功能 |
|:-----|:-----|
| `^G` | 打开完整帮助 |
| `^O` | 保存文件 |
| `^X` | 退出（未保存会提示） |
| `^W` | 搜索（`^W ^W` 下一个匹配） |
| `^\` | 替换 |
| `^K` / `^U` | 剪切当前行 / 粘贴 |
| `^C` | 显示当前行列位置 |
| `^_` | 跳到指定行号 |
| `^A` / `^E` | 跳到行首 / 行尾 |
| `^V` / `^Y` | 下一页 / 上一页 |

### 5.3 适用场景

* 快速修改系统配置（如 `sudo nano /etc/hosts`）比 vim 更省心，不需要记模式。
* 但 nano **没有正则替换、宏、可视块选择**，批量编辑能力弱。
* 建议：临时快速改配置用 nano；认真学习、复杂编辑用 vim（取舍对比见下一节）。

***

## 六、编辑器对比与选择

| 工具 | 定位 | 学习成本 | 编辑能力 | 推荐场景 |
|:-----|:-----|:--------:|:--------:|:---------|
| less | 分页查看器 | 低 | ❌ 不可编辑 | 查看大文件/长日志 |
| nano | 轻量编辑器 | 极低 | 基础编辑 | 快速改配置 |
| vim | 全功能编辑器 | 高 | ✅ 最强 | 代码/系统配置/长期使用 |
| VS Code (Remote) | 图形化 IDE | 低 | ✅ 强 | 大型项目开发（可选进阶） |

> 💡 **一句话选择**：只读文件用 `less`；快速改一行配置用 `nano`；系统运维长期使用用 `vim`；日常写代码用 IDE + 终端编辑器兼修。

***

## 七、进阶：环境变量、崩溃恢复与插件

> 本节与 **2.7 文本操作命令进阶** 分工：2.7 讲 vim 的**宏/可视块/寄存器/批量替换**；本节讲 less/vim 的**环境、恢复与集成**，都是"让日常更稳"的进阶。

### 7.1 less 环境变量与 lesspipe

```bash
# LESS 环境变量：默认参数（~/.bashrc 里设一次，之后 less 全生效）⭐
export LESS="-N -R"            # 自动行号 + 保留颜色
export LESS="-N -R -i"         # + 搜索忽略大小写

# lesspipe：预处理脚本，让 less 直接读压缩包/归档 ⭐
# （Ubuntu 的 less 已自动配置，可直接：）
less app.log.gz               # 压缩日志直接分页查看
less archive.tar.gz           # 自动列出 tar 内容（无需先解压）

# 其他实用启动参数
less -M file                  # 底部显示文件路径与百分比
less +G file                  # 打开即跳到文件末尾 ⭐（配合 -F 等于实时跟踪）
less +F /var/log/syslog       # 打开即实时跟踪（等价 tail -f）
```

### 7.2 vim 的 swap、备份与崩溃恢复

```bash
# 崩溃恢复：编辑中途终端掉线/断电，vim 会留下 .filename.swp ⭐
vim file.txt                  # 提示 "Swap file already exists"
vim -r file.txt               # 用 swap 恢复未保存内容
vim -r file.txt -c 'saveas ~/recovered.txt'   # 恢复到新文件再退出

# 编辑时保存原始文件备份
:set backup                   # 写文件前生成 file~ 备份
:set backupdir=~/.vim/backup  # 备份放到独立目录（避免污染源码目录）

# 预防：经常 :w 保存；处理完确认无 .swp 残留
ls -la | grep .swp
```

> ⚠️ 终端掉线是远程编辑的最高发事故。出现 `E325` swap 提示时：先判断是自己上次残留（`vim -r` 恢复后删除 `.swp`），还是另一个进程正在编辑（别动，等它结束）。**2.7 宏/可视块等批量操作都建立在"及时保存"上**。

### 7.3 只读模式与 less 联动

```bash
vim -R config.conf            # 只读打开（误操作会被拒绝写入）
view /etc/fstab               # 等同 vim -R，只读查看 ⭐
vim -M file                   # 强制只读（连 vim 命令都禁用）

# less 里按 v 直接进入 vim 编辑当前文件 ⭐
less -N app.log               # 看到第 100 行 → 按 v → vim 打开第 100 行
#   在 vim 改完 :wq 退出后，会回到 less 继续翻页
```

> 💡 检查系统配置只用 `view`/`less`，防止手滑改动生产配置；真正要改再用 `sudo vim`。less 的 `v` 是"只读浏览 → 紧急编辑"的桥。

### 7.4 运行时配置扩展：list / cursorline / fileformat

```vim
" 追加到 ~/.vimrc 后 :source ~/.vimrc 生效
set list                     " 显示不可见字符：Tab 显示为 ^I，行尾显示 $
set listchars=tab:»\ ,trail:· " 自定义符号（trail 标出行尾空格）
set cursorline               " 高亮当前行
set fileformat=unix          " 写文件用 LF 换行（去掉 ^M）⭐
set wrapscan                 " 搜索到文件末尾后回到开头
```

> 💡 与 **2.7 的 `cat -A`** 呼应：vim 里 `set list` 也能看不可见字符；发现 `^M` 时 `set fileformat=unix` + `:w` 即修复 DOS 换行。

### 7.5 插件入门：原生键位练熟后的进阶

```vim
" 安装 vim-plug（Ubuntu）：
" curl -fLo ~/.vim/autoload/plug.vim --create-dirs \
"   https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim

" ~/.vimrc 中声明插件
call plug#begin('~/.vim/plugged')
  Plug 'tpope/vim-surround'      " ys/cs/ds 快速加/改/删成对符号 ⭐
  Plug 'tpope/vim-commentary'    " gc 快速注释/取消注释 ⭐
  Plug 'preservim/nerdtree'      " 文件树（可选）
call plug#end()

" 安装：vim 里 :PlugInstall
```

> 💡 不要一上来装一堆插件——先把原生键位（**2.3 §六**、**2.6 §四**、**2.7 §三**）练熟。surround/commentary 是"加/改引号括号、注释"的高频刚需，两个就够。生产服务器上常没有插件环境，原生能力才是底线。

***

## 📝 实践项目

### 目标

熟练使用 less 分页查看与搜索日志，掌握 vim/nano 编辑文件。

### 步骤

1. **用 less 分页浏览系统日志**

   ```bash
   sudo less -N /var/log/syslog
   #   练习：空格 下一页 → b 上一页 → /kernel 搜索 → n 下一个 → G 末尾 → q 退出
   ```

2. **用 less 搜索与实时跟踪日志**

   ```bash
   sudo less /var/log/auth.log
   #   /Failed password  回车   n 查看下一个匹配
   #   按 G 到末尾，按 F 实时跟踪，Ctrl+C 停止，q 退出
   ```

3. **用 nano 快速修改配置文件**

   ```bash
   sudo cp /etc/hosts ~/hosts.bak
   sudo nano /etc/hosts
   #   加一行 127.0.0.1 myapp.local → Ctrl+O 保存 → Enter → Ctrl+X 退出
   ```

4. **用 vim 编辑文件并配置 .vimrc**

   ```bash
   vim ~/.vimrc
   #   按 i 插入，粘贴配置（set number / syntax on / set tabstop=4 ...）
   #   Esc 回普通模式 → :wq 保存退出

   vim ~/practice.txt
   #   练习 h/j/k/l 移动、dd 删行、yy 复制、p 粘贴、/ 搜索、:%s/word/WORD/g 替换
   ```

5. **vim 多文件与分屏**

   ```bash
   vim ~/practice.txt ~/notes.txt
   #   :vsp 垂直分屏 → Ctrl+w w 切换窗口 → :ls 查看缓冲 → :b1 跳回 → :wq 保存退出
   ```

### 进阶挑战

* 用 `grep -rn ERROR /var/log/ | less` 分页定位所有错误，并统计出错条数。
* 用 vim 分屏同时对比两个配置文件（`vim -d a.conf b.conf` 或 `:vsp`）。
* 写一份自己的 `~/.vimrc`，用 `:source ~/.vimrc` 立即生效。
* 用 `crontab -e` 打开定时任务编辑器（默认是 nano），添加一条定时任务（关联 **3.5 定时任务与自动化**）。
