---
url: >-
  /my_notes/notes/Linux学习路线/di-san-jie-duan-xi-tong-guan-li-jin-jie/1-ci-pan-guan-li-yu-wen-jian-xi-tong/index.md
---
# 磁盘管理与文件系统

## 一、磁盘基础

### 1.1 查看磁盘信息

```bash
lsblk                       # ⭐ 列出块设备树（磁盘、分区、挂载点）
lsblk -f                    # 显示文件系统类型和 UUID
lsblk -o NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE,UUID  # 自定义列

fdisk -l                    # 列出所有磁盘分区（需 sudo）
sudo fdisk -l /dev/sda      # 查看指定磁盘

parted -l                   # 另一种分区查看工具

# 查看磁盘型号和序列号
sudo hdparm -I /dev/sda | grep "Model Number"
```

### 1.2 磁盘命名规则

```text
/dev/sda     → 第一块 SCSI/SATA 硬盘
/dev/sda1    → 第一块硬盘的第一个分区
/dev/sdb     → 第二块硬盘
/dev/nvme0n1 → 第一块 NVMe SSD
/dev/vda     → KVM 虚拟化磁盘
```

***

## 二、分区管理

### 2.1 使用 fdisk 分区

```bash
# 进入 fdisk 交互模式
sudo fdisk /dev/sdb

# 常用命令：
#   m  帮助
#   p  打印分区表
#   n  创建新分区
#   d  删除分区
#   t  更改分区类型
#   w  写入并退出
#   q  不保存退出
```

### 2.2 分区类型

| 类型 | 说明 | 特点 |
|:-----|:-----|:-----|
| MBR (DOS) | 传统分区表 | 最大 2TB 磁盘，最多 4 个主分区 |
| GPT | 现代分区表 | 支持 2TB+，最多 128 个分区 ⭐ 推荐 |

```bash
# 创建 GPT 分区表
sudo parted /dev/sdb mklabel gpt

# 创建分区
sudo parted /dev/sdb mkpart primary ext4 0% 100%
```

***

## 三、格式化与挂载

### 3.1 创建文件系统

```bash
# 格式化为 ext4
sudo mkfs.ext4 /dev/sdb1

# 格式化为 XFS
sudo mkfs.xfs /dev/sdb1

# 添加标签
sudo mkfs.ext4 -L "DATA" /dev/sdb1

# 查看 UUID
sudo blkid /dev/sdb1
lsblk -f /dev/sdb1
```

### 3.2 临时挂载

```bash
# 创建挂载点
sudo mkdir -p /data

# 挂载
sudo mount /dev/sdb1 /data

# 带选项挂载
sudo mount -o rw,noatime,nodiratime /dev/sdb1 /data

# 查看挂载
mount | grep /data
df -h /data

# 卸载
sudo umount /data
sudo umount -l /data       # 强制卸载（busy 时）
```

### 3.3 永久挂载 (/etc/fstab)

```bash
# 编辑 fstab
sudo vim /etc/fstab
```

```text
# <设备>                <挂载点> <文件系统> <选项>                    <dump> <fsck>
UUID=abc-123-def-456   /data    ext4       defaults,noatime         0      2
/dev/sdb1              /data    ext4       defaults                 0      2   # 不建议用路径，用 UUID
```

挂载选项说明：

| 选项 | 含义 |
|:-----|:-----|
| `defaults` | 默认选项 (rw, suid, dev, exec, auto, nouser, async) |
| `noatime` | 不更新文件访问时间（提升性能）⭐ |
| `nodiratime` | 不更新目录访问时间 |
| `noexec` | 禁止执行该分区上的二进制文件 |
| `ro` | 只读挂载 |

```bash
# 测试 fstab 配置（不实际挂载）
sudo mount -a         # 挂载所有 fstab 中的设备
# 如果没报错，说明配置正确
```

> ⚠️ **注意事项**：修改 `/etc/fstab` 前务必备份！配置错误可能导致系统无法启动。修改后先运行 `sudo mount -a` 验证。

***

## 四、LVM 逻辑卷管理

### 4.1 LVM 架构

```text
┌─────────────────────────────────────┐
│   LV (逻辑卷)    │  /dev/vg0/data   │  ← 最终使用的"分区"
├─────────────────────────────────────┤
│   VG (卷组)      │  vg0             │  ← 汇聚多个 PV 的空间池
├─────────────────────────────────────┤
│   PV (物理卷)    │  /dev/sdb1       │  ← 真实的物理分区/磁盘
└─────────────────────────────────────┘
```

### 4.2 基本操作

```bash
# ===== 创建 LVM =====
# 1. 创建物理卷
sudo pvcreate /dev/sdb1 /dev/sdc1
sudo pvs                              # 查看物理卷

# 2. 创建卷组
sudo vgcreate vg0 /dev/sdb1 /dev/sdc1
sudo vgs                              # 查看卷组

# 3. 创建逻辑卷
sudo lvcreate -L 50G -n data vg0      # 创建 50G 逻辑卷
sudo lvcreate -l 100%FREE -n logs vg0 # 使用全部剩余空间
sudo lvdisplay vg0/data               # 查看逻辑卷详情

# 4. 格式化并挂载
sudo mkfs.ext4 /dev/vg0/data
sudo mount /dev/vg0/data /data

# ===== 扩容 =====
# 逻辑卷扩容（在线操作，无需卸载）
sudo lvextend -L +10G /dev/vg0/data   # 增加 10G
sudo resize2fs /dev/vg0/data          # 扩展文件系统（ext4）
# 或对于 XFS：sudo xfs_growfs /data

# 卷组扩容（添加新磁盘）
sudo pvcreate /dev/sdd1
sudo vgextend vg0 /dev/sdd1
```

***

## 五、磁盘性能测试

```bash
# 写入性能测试
dd if=/dev/zero of=./test bs=1M count=1024 oflag=direct
# 1024+0 records in
# 1024+0 records out
# 1073741824 bytes (1.1 GB) copied, 2.5 s, 429 MB/s

# 读取性能测试
dd if=./test of=/dev/null bs=1M count=1024

# 清理
rm ./test
```

> ⚠️ **注意事项**：`dd` 命令非常强大但也非常危险（俗称 disk destroyer）。使用前务必确认 `of=` 参数指向正确的目标，`of=/dev/sda` 会直接覆盖整个硬盘！

***

## 📝 实践项目

```bash
# 1. 查看系统磁盘布局
lsblk -f
df -h

# 2. 查看 fstab 配置
cat /etc/fstab

# 3. 找出占用空间最大的目录
sudo du -h --max-depth=1 / | sort -h | tail -10

# 4. 检查 inode 使用情况（inode 耗尽也会导致磁盘"满"）
df -i

# 5. 创建 swap 文件
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```
