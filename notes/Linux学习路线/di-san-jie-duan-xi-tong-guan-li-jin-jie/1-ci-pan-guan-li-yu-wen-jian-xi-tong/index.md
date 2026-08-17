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

## 六、进阶：故障恢复、swap 调优与磁盘健康

### 6.1 fstab 错误与 emergency mode 恢复

```bash
# 场景：fstab 写错（挂载点/设备不存在）→ 开机进入 emergency mode 或卡在 fsck
# 恢复流程：
# 1. 输入 root 密码进入 emergency shell，重新挂载根为可写
mount -o remount,rw /

# 2. 查看 fstab 并修复（最常见的坑：用设备路径而非 UUID、目录不存在）
cat /etc/fstab
lsblk -f                        # 核对 UUID

# 3. 修复后测试
mount -a                        # 全部挂载一次，报错会指出问题行

# 4. 重启验证
reboot
```

> ⚠️ **预防**：改 fstab 前 `cp /etc/fstab /etc/fstab.bak`；生产环境优先用 **UUID** 而非 `/dev/sdX` 路径（盘符会随插拔变化）；新挂载点先 `mkdir` 再挂。

### 6.2 swap 调优与监控

```bash
# 查看 swap 使用
swapon --show                  # 列出 swap 设备/文件及优先级
free -h | grep -i swap

# ⭐ swap 倾向性：值越低越优先用物理内存，越高越早用 swap
cat /proc/sys/vm/swappiness    # 默认 60
# 调低到 10（服务器优先保内存，减少 swap 抖动）
echo 10 | sudo tee /proc/sys/vm/swappiness
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf   # 永久生效
```

> 💡 swap 本身在实践项目里已创建；这里补的是"用多少、何时用"的调优。数据库/中间件服务器通常希望 `swappiness` 调低（如 10）；内存紧张的小机器保留默认即可。与 **4.3 内核参数调优** 联动。

### 6.3 "df 满但找不到大文件"与磁盘配额

```bash
# 场景：df -h 显示满，但 du 找不出占用——文件被进程删除但未释放
lsof +L1                      # ⭐ 列出"已删除但仍被占用"的文件
lsof +L1 | grep -v '^COMMAND' | head
# 处理：重启对应进程，或重启服务释放 fd；必要时直接重启系统

# 磁盘配额（XFS）
sudo xfs_quota -x -c 'report' /data
sudo xfs_quota -x -c 'limit -u bsoft=90g bhard=100g alice' /data
```

> ⚠️ 日志/临时文件被进程持有而删除（最常见是 rsyslog、应用日志），重启进程后空间才会真正释放。这是运维高频坑。

### 6.4 LVM 快照与在线缩容

```bash
# ⭐ LVM 快照：秒级生成一致性快照，用于备份/回滚
sudo lvcreate -s -L 5G -n data-snap /dev/vg0/data     # 为 data 建 5G 快照
sudo mount /dev/vg0/data-snap /mnt/snap               # 从快照读取
sudo lvremove /dev/vg0/data-snap                       # 用完删除

# 在线缩容（ext4 可缩，XFS 只能扩不能缩 ⚠️）
sudo umount /data
sudo e2fsck -f /dev/vg0/data
sudo lvreduce -L -5G /dev/vg0/data                     # 先缩逻辑卷
sudo resize2fs /dev/vg0/data                           # 再缩文件系统
# XFS：xfs_growfs 只能扩容，缩容必须先重建
```

> 💡 快照是 LVM 相对分区方案的最大优势：升级前打快照，出事秒级回滚。注意快照会随写入增长，别长期占用空间。

### 6.5 磁盘健康检查

```bash
# SMART 健康检测 ⭐（需安装 smartmontools）
sudo apt install smartmontools -y
sudo smartctl -a /dev/sda            # 完整健康报告
sudo smartctl -H /dev/sda            # 只看健康状态
sudo smartctl -t short /dev/sda      # 后台自检（几分钟）
sudo smartctl -t long /dev/sda       # 完整自检（数小时）
# 关注字段：Reallocated_Sector_Ct、Pending_Sector、UDMA_CRC_Error

# 坏道检查（危险，只在已备份的空盘上做）
sudo badblocks -sv /dev/sdb

# dd 安全写入/备份
sudo dd if=/dev/sda of=/backup/disk.img bs=4M status=progress   # 显示进度 ⭐
sudo dd if=/dev/sda of=/backup/disk.img bs=4M conv=fsync        # 写入同步落盘
```

> 💡 服务器上定期 `smartctl -H` + 关注 SMART 属性，是"磁盘提前预警"最便宜的手段；出现 `Reallocated_Sector_Ct` 增长就该计划换盘了。

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
