---
url: >-
  /my_notes/notes/Linux学习路线/di-yi-jie-duan-linux-ji-chu-ru-men/4-yong-hu-yu-quan-xian-guan-li/index.md
---
# 用户与权限管理

## 一、用户与组概念

### 1.1 用户分类

Linux 中每个用户有一个唯一的 **UID（User ID）** 和一个主组 **GID（Group ID）**。

| 用户类型 | UID 范围 | 说明 |
|:---------|:---------|:-----|
| **root** | 0 | 超级管理员，拥有所有权限 |
| **系统用户** | 1-999 | 用于运行系统服务（如 www-data、mysql） |
| **普通用户** | 1000+ | 日常登录用户 |

### 1.2 关键配置文件

| 文件 | 内容 | 示例 |
|:-----|:-----|:-----|
| `/etc/passwd` | 用户账号信息 | `user:x:1000:1000:User Name:/home/user:/bin/bash` |
| `/etc/shadow` | 加密密码（仅 root 可见） | `user:$6$salt$encrypted:19123:0:99999:7:::` |
| `/etc/group` | 组信息 | `sudo:x:27:user1,user2` |
| `/etc/sudoers` | sudo 权限配置 | 通过 `visudo` 编辑 |

**`/etc/passwd` 字段详解**：

```text
username:x:1000:1000:Full Name:/home/username:/bin/bash
  ①      ②  ③    ④     ⑤          ⑥           ⑦

① 用户名        ② 密码占位符（真实密码在 /etc/shadow）
③ UID          ④ GID（主组）
⑤ 用户全名（注释） ⑥ 家目录
⑦ 默认 Shell
```

***

## 二、文件权限体系

### 2.1 权限表示

使用 `ls -l` 查看文件权限：

```bash
$ ls -l myfile.txt
-rw-r--r-- 1 alice developers 1024 Jun 22 10:00 myfile.txt
```

```text
-   rw-  r--  r--   1   alice   developers   1024   Jun 22 10:00   myfile.txt
①   ②    ③    ④    ⑤   ⑥      ⑦            ⑧     ⑨              ⑩

① 文件类型（- = 普通文件）
② 所有者权限（owner）  rw-  →  读+写
③ 所属组权限（group）  r--  →  只读
④ 其他用户权限（other） r--  →  只读
⑤ 硬链接数
⑥ 所有者用户名
⑦ 所属组名
⑧ 文件大小（字节）
⑨ 最后修改时间
⑩ 文件名
```

### 2.2 权限含义

| 权限 | 字符 | 八进制 | 对文件的含义 | 对目录的含义 |
|:-----|:-----|:-------|:------------|:------------|
| 读 | `r` | 4 | 读取文件内容 | 列出目录内容（ls） |
| 写 | `w` | 2 | 修改文件内容 | 创建/删除目录中的文件 |
| 执行 | `x` | 1 | 执行文件（脚本/程序） | 进入目录（cd） |

### 2.3 八进制权限速查

```text
7 = rwx (4+2+1)    读写执行
6 = rw- (4+2+0)    读写
5 = r-x (4+0+1)    读+执行
4 = r-- (4+0+0)    只读
3 = -wx (0+2+1)    写+执行
2 = -w- (0+2+0)    只写
1 = --x (0+0+1)    仅执行
0 = --- (0+0+0)    无权限
```

常用组合：

```bash
chmod 755 script.sh    # rwxr-xr-x  脚本文件（所有者全权限，其他人读+执行）
chmod 644 config.txt   # rw-r--r--  配置文件（所有者可写，其他人只读）
chmod 600 id_rsa       # rw-------  SSH 私钥（仅所有者可读写）
chmod 777 shared/      # rwxrwxrwx  共享目录（所有人全权限，不安全！）
```

> ⚠️ **注意事项**：`chmod 777` 是非常危险的操作，它允许任何用户读取、修改、执行文件。**永远不要在生产环境使用 `chmod 777`**。

***

## 三、权限管理命令

### 3.1 chmod — 修改权限

```bash
# ===== 数字方式（推荐） =====
chmod 755 script.sh          # rwxr-xr-x
chmod 600 ~/.ssh/id_rsa      # rw-------

# ===== 符号方式 =====
chmod u+x script.sh           # 所有者(u)增加执行权限
chmod g-w file.txt            # 组(g)移除写权限
chmod o-rwx file.txt          # 其他人(o)移除所有权限
chmod a+r file.txt            # 所有人(a)增加读权限
chmod u=rwx,g=rx,o= script.sh # 精确设置

# ===== 递归修改 =====
chmod -R 755 /path/to/dir/    # 递归修改目录下所有文件
```

### 3.2 chown — 修改所有者

```bash
# 修改文件所有者
chown alice file.txt

# 修改所有者和组
chown alice:developers file.txt

# 只修改组
chown :developers file.txt

# 递归修改
chown -R alice:developers /app/
```

### 3.3 chgrp — 修改所属组

```bash
chgrp developers file.txt
chgrp -R developers /app/
```

### 3.4 umask — 默认权限掩码

新创建文件/目录的默认权限由 `umask` 决定：

```bash
# 查看当前 umask
umask        # 通常输出 0022

# 默认权限计算
# 目录默认：777 - umask = 777 - 022 = 755 (rwxr-xr-x)
# 文件默认：666 - umask = 666 - 022 = 644 (rw-r--r--)

# 临时修改（当前会话有效）
umask 027    # 更严格：目录 750，文件 640
```

***

## 四、sudo 权限管理

### 4.1 sudo 工作原理

`sudu` 允许普通用户**以 root 身份执行命令**，而非直接切换到 root 用户。

```bash
# 以 root 身份执行单条命令
sudo apt update

# 切换到 root 用户
sudo -i       # 或 sudo su -

# 以指定用户身份执行
sudo -u www-data ls /var/www
```

### 4.2 visudo 安全配置

**永远使用 `visudo` 编辑 sudoers 文件**，它会做语法检查，防止配置错误锁死系统。

```bash
sudo visudo
```

常用的 sudoers 规则：

```text
# 用户名  主机  =(以谁的身份)  命令列表
alice    ALL  =(ALL)         ALL              # alice 可以执行所有命令
bob      ALL  =(ALL)         NOPASSWD: ALL    # bob 无需密码执行所有命令
charlie  ALL  =(ALL)         /usr/bin/systemctl restart nginx  # 只能重启 nginx

# 组授权（% 表示组）
%developers  ALL=(ALL)  ALL                    # developers 组拥有完整 sudo 权限
%webadmins   ALL=(ALL)  /usr/bin/systemctl * nginx  # webadmins 组只能管理 nginx
```

***

## 五、用户管理命令

```bash
# ===== 用户操作 =====
sudo useradd -m -s /bin/bash alice     # 创建用户（-m 创建家目录）
sudo useradd -m -s /bin/bash -G sudo,developers bob  # 创建并加入附加组
sudo passwd alice                      # 设置/修改密码
sudo usermod -aG docker alice          # 将用户加入附加组（-a 追加，不加则覆盖）
sudo userdel -r alice                  # 删除用户（-r 同时删除家目录）
id alice                               # 查看用户的 UID 和所属组

# ===== 组操作 =====
sudo groupadd developers               # 创建组
sudo groupmod -n devs developers       # 重命名组
sudo groupdel developers               # 删除组
groups alice                           # 查看用户所属组
getent group developers                # 查看组信息

# ===== 查看登录信息 =====
who                                    # 当前登录的用户
w                                      # 更详细的登录信息
last                                   # 最近登录记录
lastlog                                # 所有用户最后登录时间
```

***

## 📝 实践项目

### 目标

掌握用户创建、权限设置和 sudo 配置。

### 步骤

1. **创建测试用户**
   ```bash
   sudo useradd -m -s /bin/bash testuser
   sudo passwd testuser
   id testuser
   ```

2. **创建组并添加用户**
   ```bash
   sudo groupadd devteam
   sudo usermod -aG devteam testuser
   groups testuser        # 验证
   ```

3. **权限实验**
   ```bash
   mkdir ~/perm-test && cd ~/perm-test
   echo "secret" > private.txt
   chmod 600 private.txt
   ls -l private.txt      # -rw-------

   # 切换到 testuser 尝试读取（应被拒绝）
   sudo -u testuser cat ~/perm-test/private.txt
   # 输出：cat: .../private.txt: Permission denied
   ```

4. **sudo 权限配置**
   ```bash
   sudo visudo
   # 添加：testuser ALL=(ALL) /usr/bin/systemctl status *
   # 验证：sudo -u testuser sudo systemctl status ssh
   ```

5. **查看权限配置文件**
   ```bash
   cat /etc/passwd | grep testuser
   sudo cat /etc/shadow | grep testuser
   cat /etc/group | grep devteam
   ```
