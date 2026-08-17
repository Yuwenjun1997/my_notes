---
url: >-
  /my_notes/notes/JAVA学习路线/shen-du-xue-xi/01-java-bing-fa-bian-cheng-yu-jvm/2-juc-bing-fa-bao-xiang-jie/index.md
---
# JUC 并发包详解

> Java Util Concurrent 并发包是 JDK 提供的并发编程核心工具集，涵盖了锁、同步器、线程池、原子类、并发容器等核心组件。本文从源码级别深入剖析每个组件的原理与实现。

***

## 1. AQS 抽象队列同步器

### 1.1 AQS 核心原理

**AbstractQueuedSynchronizer (AQS)** 是 JUC 锁和同步器的基础框架。其核心由三部分组成：

| 组件 | 作用 |
|------|------|
| **state** (volatile int) | 同步状态，0 表示未锁定，>0 表示重入次数或资源数量 |
| **CLH 队列** (FIFO 双向链表) | 等待获取锁的线程队列 |
| **CAS** | 对 state 和队列操作提供原子性保证 |

AQS 的设计精髓在于：**模板方法模式** —— 子类只需实现 `tryAcquire`/`tryRelease`（独占）或 `tryAcquireShared`/`tryReleaseShared`（共享），AQS 负责排队、阻塞、唤醒等通用逻辑。

```java
// AQS 核心字段
private volatile int state;           // 同步状态
private transient volatile Node head; // CLH 队列头
private transient volatile Node tail; // CLH 队列尾

// Node 节点内部类
static final class Node {
    volatile int waitStatus;    // 等待状态: CANCELLED(-1)/SIGNAL(-1)/CONDITION(-2)/PROPAGATE(-3)
    volatile Node prev;
    volatile Node next;
    volatile Thread thread;     // 当前节点持有的线程
    Node nextWaiter;            // Condition 队列中的下一个节点
}
```

### 1.2 独占锁与共享锁模式

**独占锁模式 (Exclusive)**：一次只有一个线程能获取锁，如 ReentrantLock。

```java
// 独占锁获取模板方法
public final void acquire(int arg) {
    if (!tryAcquire(arg) &&                 // 1. 尝试获取锁
        acquireQueued(addWaiter(Node.EXCLUSIVE), arg)) // 2. 失败则入队 + 自旋
        Thread.currentThread().interrupt();  // 3. 如果被中断过，恢复中断标志
}
```

**共享锁模式 (Shared)**：允许多个线程同时获取，如 Semaphore、CountDownLatch、ReadLock。

```java
// 共享锁获取模板方法
public final void acquireShared(int arg) {
    if (tryAcquireShared(arg) < 0)          // 返回值 < 0 表示获取失败
        doAcquireShared(arg);               // 入队自旋等待
}
```

### 1.3 acquire/release 源码级流程

```java
// === 获取锁完整流程 ===

// step 1: addWaiter — 将当前线程封装为 Node 加入 CLH 队列尾部
private Node addWaiter(Node mode) {
    Node node = new Node(Thread.currentThread(), mode);
    Node pred = tail;
    if (pred != null) {
        node.prev = pred;
        if (compareAndSetTail(pred, node)) { // CAS 设置尾节点
            pred.next = node;
            return node;
        }
    }
    enq(node); // 自旋入队（保证一定成功）
    return node;
}

// step 2: acquireQueued — 在队列中自旋等待
final boolean acquireQueued(final Node node, int arg) {
    boolean failed = true;
    try {
        boolean interrupted = false;
        for (;;) {
            final Node p = node.predecessor();
            if (p == head && tryAcquire(arg)) {  // 前驱是头节点 → 尝试获取
                setHead(node);                    // 获取成功，设为新头
                p.next = null;                    // 原头节点出队
                failed = false;
                return interrupted;
            }
            // 获取失败，检查是否需要阻塞
            if (shouldParkAfterFailedAcquire(p, node) &&
                parkAndCheckInterrupt())
                interrupted = true;
        }
    } finally {
        if (failed)
            cancelAcquire(node);
    }
}

// === 释放锁流程 ===
public final boolean release(int arg) {
    if (tryRelease(arg)) {
        Node h = head;
        if (h != null && h.waitStatus != 0)
            unparkSuccessor(h);  // 唤醒后继节点
        return true;
    }
    return false;
}
```

**核心等待机制**：`shouldParkAfterFailedAcquire` 将前驱节点状态设为 SIGNAL（-1），表示当前节点需要被前驱唤醒。然后 `parkAndCheckInterrupt` 通过 `LockSupport.park()` 阻塞线程。

### 1.4 自定义 AQS 实现不可重入锁

```java
import java.util.concurrent.locks.AbstractQueuedSynchronizer;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.Condition;

public class NonReentrantLock implements Lock {
    
    private final Sync sync = new Sync();

    // 内部同步器：独占锁，state 0=未锁定, 1=锁定
    private static class Sync extends AbstractQueuedSynchronizer {
        @Override
        protected boolean tryAcquire(int acquires) {
            if (compareAndSetState(0, 1)) { // CAS 抢锁
                setExclusiveOwnerThread(Thread.currentThread());
                return true;
            }
            return false;
        }

        @Override
        protected boolean tryRelease(int releases) {
            if (getExclusiveOwnerThread() != Thread.currentThread())
                throw new IllegalMonitorStateException();
            setExclusiveOwnerThread(null);
            setState(0); // volatile write
            return true;
        }

        @Override
        protected boolean isHeldExclusively() {
            return getState() == 1 && getExclusiveOwnerThread() == Thread.currentThread();
        }

        Condition newCondition() { return new ConditionObject(); }
    }

    @Override public void lock() { sync.acquire(1); }
    @Override public void lockInterruptibly() throws InterruptedException { sync.acquireInterruptibly(1); }
    @Override public boolean tryLock() { return sync.tryAcquire(1); }
    @Override public void unlock() { sync.release(1); }
    @Override public Condition newCondition() { return sync.newCondition(); }
}
```

```java
// 使用自定义锁
public class Demo {
    static int count = 0;
    static NonReentrantLock lock = new NonReentrantLock();

    public static void main(String[] args) throws InterruptedException {
        Runnable task = () -> {
            for (int i = 0; i < 10000; i++) {
                lock.lock();
                try {
                    count++;
                } finally {
                    lock.unlock();
                }
            }
        };
        Thread t1 = new Thread(task);
        Thread t2 = new Thread(task);
        t1.start(); t2.start();
        t1.join(); t2.join();
        System.out.println(count); // 输出 20000
    }
}
```

***

## 2. ReentrantLock

### 2.1 公平锁 vs 非公平锁源码对比

ReentrantLock 内部维护两个 Sync 实现：**NonfairSync** 和 **FairSync**。

```java
// 构造方法
ReentrantLock lock = new ReentrantLock();      // 默认非公平
ReentrantLock fairLock = new ReentrantLock(true); // 公平锁
```

**非公平锁 lock() 核心差异**：

```java
// === NonfairSync.lock() ===
final void lock() {
    // ★ 上来先 CAS 抢一次锁，不管队列里有没有人在等
    if (compareAndSetState(0, 1))
        setExclusiveOwnerThread(Thread.currentThread());
    else
        acquire(1); // 走正常 AQS 流程
}

// === FairSync.lock() ===
final void lock() {
    acquire(1); // 没有直接抢锁，老老实实走 AQS 队列
}

// ★ 核心区别：tryAcquire 中的 hasQueuedPredecessors()
// NonfairSync.tryAcquire:
protected final boolean tryAcquire(int acquires) {
    // ... 省略重入判断
    if (compareAndSetState(0, acquires)) { // 直接 CAS 抢
        setExclusiveOwnerThread(current);
        return true;
    }
    return false;
}

// FairSync.tryAcquire:
protected final boolean tryAcquire(int acquires) {
    // ...
    if (!hasQueuedPredecessors() &&   // ★ 先看队列中是否有等待线程
        compareAndSetState(0, acquires)) {
        setExclusiveOwnerThread(current);
        return true;
    }
    return false;
}
```

**公平锁 vs 非公平锁总结**：

| 特性 | 非公平锁 | 公平锁 |
|------|----------|--------|
| 性能 | 高（减少线程切换） | 较低（严格 FIFO） |
| 饥饿 | 可能 | 不会 |
| 场景 | 默认选择 | 需严格公平时 |

### 2.2 lock() / tryLock() / lockInterruptibly() 区别

```java
ReentrantLock lock = new ReentrantLock();

// 1. lock() — 阻塞直到获取，不响应中断（但获取后会处理中断标志）
lock.lock();
try {
    // 临界区
} finally {
    lock.unlock();
}

// 2. tryLock() — 立即返回，不阻塞
if (lock.tryLock()) {
    try { /* 临界区 */ } finally { lock.unlock(); }
} else {
    System.out.println("锁被占用，做其他事");
}

// 3. tryLock(timeout) — 限时等待
if (lock.tryLock(3, TimeUnit.SECONDS)) {
    // 3秒内获取到锁
} else {
    System.out.println("超时未获取到锁");
}

// 4. lockInterruptibly() — 可中断的阻塞获取
try {
    lock.lockInterruptibly();
    try { /* 临界区 */ } finally { lock.unlock(); }
} catch (InterruptedException e) {
    System.out.println("在等待锁时被中断");
}
```

**源码对比**：`lockInterruptibly` 调用 `acquireInterruptibly(1)`，在 `parkAndCheckInterrupt()` 检测到中断时直接抛出 `InterruptedException`；而 `lock()` 调用 `acquire(1)`，中断后只记录标志位。

### 2.3 Condition 的 await/signal 机制

Condition 类似 Object 的 wait/notify，但更灵活——一个 Lock 可创建多个 Condition。

```java
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;

public class BoundedQueue<T> {
    private final Object[] items;
    private int putIndex, takeIndex, count;
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition notFull  = lock.newCondition(); // 不满
    private final Condition notEmpty = lock.newCondition(); // 不空

    public BoundedQueue(int capacity) {
        items = new Object[capacity];
    }

    public void put(T t) throws InterruptedException {
        lock.lock();
        try {
            while (count == items.length)
                notFull.await();       // 队列满 → 等待"不满"
            items[putIndex] = t;
            if (++putIndex == items.length) putIndex = 0;
            count++;
            notEmpty.signal();         // 通知消费者"不空"
        } finally {
            lock.unlock();
        }
    }

    @SuppressWarnings("unchecked")
    public T take() throws InterruptedException {
        lock.lock();
        try {
            while (count == 0)
                notEmpty.await();      // 队列空 → 等待"不空"
            T t = (T) items[takeIndex];
            items[takeIndex] = null;
            if (++takeIndex == items.length) takeIndex = 0;
            count--;
            notFull.signal();          // 通知生产者"不满"
            return t;
        } finally {
            lock.unlock();
        }
    }
}
```

**Condition 源码核心**：每个 Condition 维护一个单向等待队列。`await()` 将当前线程封装为 Node.CONDITION 节点加入等待队列，释放锁，然后 `park()`。`signal()` 将等待队列头节点转移到 AQS 同步队列，使其可以参与锁竞争。

### 2.4 synchronized vs ReentrantLock 对比

| 特性 | synchronized | ReentrantLock |
|------|--------------|---------------|
| 锁机制 | 内置锁（JVM 层） | API 锁（Java 层） |
| 灵活性 | 低，自动获取/释放 | 高，需手动 lock/unlock |
| 公平性 | 非公平 | 可公平/非公平 |
| 可中断 | 等待时不可中断 | lockInterruptibly 可中断 |
| 超时 | 不支持 | tryLock(timeout) |
| 多个条件 | 一个锁一个 waitSet | 一个锁多个 Condition |
| 性能 | 优化后与 ReentrantLock 相近 | 与 synchronized 相近 |
| 底层 | monitor 对象 + 偏向锁/轻量锁 | AQS + LockSupport.park/unpark |

**选择建议**：大多数场景用 `synchronized`（简洁、防遗忘）；需要超时、可中断、多 Condition 时用 `ReentrantLock`；实测性能差异已很小。

***

## 3. CAS 原理

### 3.1 CAS 操作与 ABA 问题

**CAS (Compare-And-Swap)** 是一种乐观锁技术，包含三个操作数：**内存地址 V**、**预期值 A**、**新值 B**。仅当 V 的值等于 A 时，才将 V 更新为 B，**整个过程是原子的**。

```java
// CAS 的原子语义（Unsafe 层）
public final native boolean compareAndSwapObject(Object o, long offset,
                                                  Object expected, Object x);
public final native boolean compareAndSwapInt(Object o, long offset,
                                               int expected, int x);
public final native boolean compareAndSwapLong(Object o, long offset,
                                                long expected, long x);
```

**ABA 问题**：线程 1 读取 A → 线程 2 改为 B → 线程 2 改回 A → 线程 1 CAS 成功（实际上 A 已被修改过）。

```java
// ABA 问题演示
public class ABADemo {
    private static AtomicInteger atomic = new AtomicInteger(100);
    
    public static void main(String[] args) {
        Thread t1 = new Thread(() -> {
            atomic.compareAndSet(100, 101);
            atomic.compareAndSet(101, 100); // 改回 100
        });

        Thread t2 = new Thread(() -> {
            try { Thread.sleep(100); } catch (InterruptedException e) {}
            // CAS 成功！但实际上值已经被改过了
            boolean success = atomic.compareAndSet(100, 200);
            System.out.println("CAS result: " + success); // true
        });

        t1.start(); t2.start();
    }
}
```

**AtomicStampedReference 解决 ABA**：通过 **版本号（stamp）** 来检测中间修改。

```java
import java.util.concurrent.atomic.AtomicStampedReference;

public class ABASolveDemo {
    private static AtomicStampedReference<Integer> ref =
            new AtomicStampedReference<>(100, 0);

    public static void main(String[] args) {
        Thread t1 = new Thread(() -> {
            try { Thread.sleep(50); } catch (InterruptedException e) {}
            int[] stamp = {0};
            Integer value = ref.get(stamp);
            System.out.println("t1 读取: value=" + value + ", stamp=" + stamp[0]);

            ref.compareAndSet(100, 101, stamp[0], stamp[0] + 1);
            stamp[0] = ref.getStamp();
            ref.compareAndSet(101, 100, stamp[0], stamp[0] + 1);
        });

        Thread t2 = new Thread(() -> {
            try { Thread.sleep(150); } catch (InterruptedException e) {}
            int[] stamp = {0};
            Integer value = ref.get(stamp);
            System.out.println("t2 读取: value=" + value + ", stamp=" + stamp[0]);

            // 因为 stamp 已经变化，CAS 失败
            boolean success = ref.compareAndSet(100, 200, stamp[0], stamp[0] + 1);
            System.out.println("CAS result: " + success); // false
        });

        t1.start(); t2.start();
    }
}
```

### 3.2 Unsafe 类的操作

`Unsafe` 是 CAS 的底层支撑，提供了**直接操作内存**的能力。

```java
import sun.misc.Unsafe;
import java.lang.reflect.Field;

public class UnsafeExample {
    static final Unsafe unsafe;
    static final long stateOffset;
    private volatile int state = 0;

    static {
        try {
            // Unsafe 无法直接 new，通过反射获取
            Field f = Unsafe.class.getDeclaredField("theUnsafe");
            f.setAccessible(true);
            unsafe = (Unsafe) f.get(null);
            stateOffset = unsafe.objectFieldOffset(
                    UnsafeExample.class.getDeclaredField("state"));
        } catch (Exception e) {
            throw new Error(e);
        }
    }

    public boolean casState(int expect, int update) {
        return unsafe.compareAndSwapInt(this, stateOffset, expect, update);
    }

    public static void main(String[] args) {
        UnsafeExample ex = new UnsafeExample();
        System.out.println(ex.casState(0, 1)); // true
        System.out.println(ex.state);           // 1
    }
}
```

### 3.3 自旋与自适应自旋

**自旋锁**：线程获取锁失败时不立即阻塞，而是空转（busy-wait）不断重试。

```java
// 简单自旋锁实现
public class SpinLock {
    private AtomicReference<Thread> owner = new AtomicReference<>();

    public void lock() {
        Thread current = Thread.currentThread();
        // 自旋等待（不 park，占用 CPU）
        while (!owner.compareAndSet(null, current)) {
            // 可 Thread.yield() 让出 CPU 时间片
        }
    }

    public void unlock() {
        Thread current = Thread.currentThread();
        owner.compareAndSet(current, null);
    }
}
```

**自适应自旋（JVM 优化）**：JVM 根据前一次自旋等待时间动态调整自旋次数。如果上次自旋成功获取了锁，则下次多自旋几次；如果很少成功，则减少自旋甚至跳过，直接阻塞。

* **优点**：避免线程切换的昂贵开销
* **缺点**：占用 CPU 时间片
* **适用场景**：锁持有时间短、竞争不激烈的情况

***

## 4. ConcurrentHashMap

### 4.1 JDK 1.7 分段锁 → JDK 1.8 CAS+synchronized 演进

**JDK 1.7 分段锁架构**：

```
ConcurrentHashMap
  └── Segment[] (继承 ReentrantLock)         ← 分段锁
        └── HashEntry[] (每个 Segment 一个数组)
              └── HashEntry<K,V>
```

* 默认 16 个 Segment（并发度 16）
* 写操作只需锁一个 Segment，不影响其他 Segment
* 读操作不加锁（volatile 读）

**JDK 1.8 优化**：

```
ConcurrentHashMap
  └── Node<K,V>[] table                    ← 数组 + 链表/红黑树
```

* 摒弃分段锁，改用 **CAS + synchronized**（粒度更细）
* 链表长度 > 8 时转为红黑树（O(log n) 查找）
* 并发度提升到每个数组元素级别

### 4.2 put 方法源码分析（JDK 1.8）

```java
final V putVal(K key, V value, boolean onlyIfAbsent) {
    if (key == null || value == null) throw new NullPointerException();
    int hash = spread(key.hashCode());     // 扰动哈希
    int binCount = 0;

    for (Node<K,V>[] tab = table;;) {      // 自旋 + CAS
        Node<K,V> f; int n, i, fh;
        if (tab == null || (n = tab.length) == 0)
            tab = initTable();             // 延迟初始化

        // CASE 1: 槽位为空 → CAS 插入
        else if ((f = tabAt(tab, i = (n - 1) & hash)) == null) {
            if (casTabAt(tab, i, null, new Node<K,V>(hash, key, value, null)))
                break;
        }

        // CASE 2: 正在扩容 → 协助迁移
        else if ((fh = f.hash) == MOVED)
            tab = helpTransfer(tab, f);

        // CASE 3: 哈希冲突 → synchronized 锁住链表头节点
        else {
            V oldVal = null;
            synchronized (f) {
                if (tabAt(tab, i) == f) {   // 双重检查
                    if (fh >= 0) {          // 链表
                        binCount = 1;
                        for (Node<K,V> e = f;; ++binCount) {
                            K ek;
                            if (e.hash == hash &&
                                ((ek = e.key) == key || (ek != null && key.equals(ek)))) {
                                oldVal = e.val;
                                if (!onlyIfAbsent) e.val = value;
                                break;
                            }
                            Node<K,V> pred = e;
                            if ((e = e.next) == null) {
                                pred.next = new Node<K,V>(hash, key, value, null);
                                break;
                            }
                        }
                    } else if (f instanceof TreeBin) { // 红黑树
                        // ... 树节点插入
                    }
                }
            }
            if (binCount != 0) {
                if (binCount >= TREEIFY_THRESHOLD)
                    treeifyBin(tab, i);     // 链表 → 红黑树
                if (oldVal != null) return oldVal;
                break;
            }
        }
    }
    addCount(1L, binCount);  // 更新 size 并检查扩容
    return null;
}
```

**get 方法源码**：

```java
public V get(Object key) {
    Node<K,V>[] tab; Node<K,V> e, p; int n, eh; K ek;
    int h = spread(key.hashCode());
    if ((tab = table) != null && (n = tab.length) > 0 &&
        (e = tabAt(tab, (n - 1) & h)) != null) {
        if ((eh = e.hash) == h) {           // 头节点即目标
            if ((ek = e.key) == key || (ek != null && key.equals(ek)))
                return e.val;
        } else if (eh < 0)                  // 特殊节点（ForwardingNode/TreeBin）
            return (p = e.find(h, key)) != null ? p.val : null;
        while ((e = e.next) != null) {      // 链表遍历
            if (e.hash == h &&
                ((ek = e.key) == key || (ek != null && key.equals(ek))))
                return e.val;
        }
    }
    return null;
}
```

### 4.3 扩容机制（多线程协助迁移）

```java
// 触发扩容条件：链表长度 ≥ 8 且数组长度 < 64 时先扩容而非树化
// 或: addCount 时 size 超过 threshold

private final void transfer(Node<K,V>[] tab, Node<K,V>[] nextTab) {
    int n = tab.length, stride;
    // 每个线程负责 stride 个槽位（最少 16）
    stride = (NCPU > 1) ? (n >>> 3) / NCPU : n;
    if (stride < MIN_TRANSFER_STRIDE) stride = MIN_TRANSFER_STRIDE;

    if (nextTab == null) {             // 初始化新数组（2 倍扩容）
        nextTab = new Node<?,?>[n << 1];
        // ...
    }

    // ForwardingNode: 迁移完的槽位置入，hash=MOVED(-1)
    // 其他线程 put 时见到 ForwardingNode 就调用 helpTransfer 参与迁移
    // 实现了"多线程并发扩容"
}
```

**扩容要点**：

* 触发条件：元素个数 > 容量 \* 0.75（负载因子）
* 每次扩容为 2 倍（位移运算）
* **多线程并行**：每个线程领取一个 stride 区间进行迁移
* **ForwardingNode**：标记已迁移的槽位，新 put 查询到它时加入扩容

### 4.4 size 计算方法

```java
// JDK 1.8 size() 实现
public int size() {
    long n = sumCount();
    return ((n < 0L) ? 0 :
            (n > (long)Integer.MAX_VALUE) ? Integer.MAX_VALUE : (int)n);
}

// 核心计数: CounterCell[] 数组（类似 LongAdder 的分段计数思路）
final long sumCount() {
    CounterCell[] cs = counterCells;
    long sum = baseCount;
    if (cs != null) {
        for (CounterCell c : cs)
            if (c != null)
                sum += c.value;
    }
    return sum;
}
```

**原理**：使用 `baseCount` + `CounterCell[]` 分段计数机制。多线程时优先 CAS 更新 `baseCount`，失败则分散到 `CounterCell` 数组的不同槽位，避免多线程 CAS 冲突。最终 `size()` 累加所有计数值。

***

## 5. 读写锁

### 5.1 ReentrantReadWriteLock 原理

```java
ReentrantReadWriteLock rwLock = new ReentrantReadWriteLock();
Lock readLock = rwLock.readLock();   // 共享锁
Lock writeLock = rwLock.writeLock(); // 独占锁
```

**核心思路**：用一个 32 位 int 的 state 同时表示读锁和写锁的状态。

| 位 | 含义 |
|---|------|
| 高 16 位 | 读锁持有数量 |
| 低 16 位 | 写锁重入次数 |

```java
// state 的位运算操作
static final int SHARED_SHIFT   = 16;
static final int SHARED_UNIT    = (1 << SHARED_SHIFT); // 1 个读锁单位 = 65536
static final int MAX_COUNT      = (1 << SHARED_SHIFT) - 1; // 最大数量
static final int EXCLUSIVE_MASK = (1 << SHARED_SHIFT) - 1;

// 获取读锁数量
static int sharedCount(int c)    { return c >>> SHARED_SHIFT; }
// 获取写锁重入次数
static int exclusiveCount(int c) { return c & EXCLUSIVE_MASK; }
```

**写锁获取条件**（`tryAcquire`）：

1. 无读锁（sharedCount == 0）
2. 无写锁或当前线程已持有写锁（重入）
3. CAS 更新成功

**读锁获取条件**（`tryAcquireShared`）：

1. 写锁未被持有，或当前线程是写锁持有者（锁降级）
2. CAS 更新 state 高 16 位成功（或用 ThreadLocal 记录重入避免 CAS 冲突）

### 5.2 锁降级（写锁降级为读锁）

**定义**：持有写锁的线程在不释放写锁的情况下获取读锁，然后释放写锁，将锁级别从写降为读。目的是保证修改对后续读可见。

```java
public class LockDegradeDemo {
    private final ReentrantReadWriteLock rwLock = new ReentrantReadWriteLock();
    private volatile boolean dataReady = false;
    private Object data;

    public void process() {
        rwLock.readLock().lock();
        if (!dataReady) {              // 数据还没就绪
            rwLock.readLock().unlock();
            rwLock.writeLock().lock(); // 升级为写锁
            try {
                if (!dataReady) {      // 双重检查
                    data = fetchData();
                    dataReady = true;
                }
                // ★ 关键：在释放写锁前获取读锁（锁降级）
                rwLock.readLock().lock();
            } finally {
                rwLock.writeLock().unlock(); // 写锁释放 → 只剩下读锁
            }
        }
        try {
            System.out.println("读取数据: " + data);
        } finally {
            rwLock.readLock().unlock();
        }
    }

    private Object fetchData() {
        return "重要数据";
    }
}
```

### 5.3 StampedLock（乐观读）

`StampedLock` 是 JDK 1.8 引入的**性能更优**的读写锁，支持三种模式：

| 模式 | 说明 |
|------|------|
| **写锁** (writeLock) | 独占锁 |
| **读锁** (readLock) | 悲观读锁，同 ReadWriteLock 读锁 |
| **乐观读** (tryOptimisticRead) | 不加锁，后验验证 |

```java
import java.util.concurrent.locks.StampedLock;

public class StampedLockDemo {
    private final StampedLock sl = new StampedLock();
    private int x, y;

    // 写操作
    public void move(int deltaX, int deltaY) {
        long stamp = sl.writeLock();
        try {
            x += deltaX;
            y += deltaY;
        } finally {
            sl.unlockWrite(stamp);
        }
    }

    // 乐观读（核心优势：不加锁，读取后校验）
    public int distanceFromOrigin() {
        long stamp = sl.tryOptimisticRead(); // 获取乐观读戳
        int curX = x, curY = y;              // 读取值（可能不一致）
        if (!sl.validate(stamp)) {           // 校验：期间是否有写操作？
            stamp = sl.readLock();           // 有写操作 → 降级为悲观读
            try {
                curX = x;
                curY = y;
            } finally {
                sl.unlockRead(stamp);
            }
        }
        return (int) Math.sqrt(curX * curX + curY * curY);
    }

    // 锁升级（乐观读 → 悲观读 → 写锁）
    public void upgrade() {
        long stamp = sl.readLock();
        try {
            // ...
            long ws = sl.tryConvertToWriteLock(stamp); // 尝试升级为写锁
            if (ws != 0L) {
                stamp = ws;
                // 写操作
            } else {
                sl.unlockRead(stamp);
                stamp = sl.writeLock(); // 升级失败，直接获取写锁
            }
        } finally {
            sl.unlock(stamp);
        }
    }
}
```

**StampedLock 注意事项**：

* 不可重入
* 支持锁升级/降级/转换（`tryConvertToWriteLock`/`tryConvertToReadLock`）
* 乐观读**不加锁**，性能极高，读多写少场景首选
* 不支持 Condition
* 中断锁操作需使用 `readLockInterruptibly()`/`writeLockInterruptibly()`

***

## 6. LockSupport

### 6.1 park/unpark 原理

`LockSupport` 是 JUC 锁的底层阻塞/唤醒工具，基于 **Unsafe.park()/unpark()** 实现。

```java
// 核心 API
LockSupport.park();                // 阻塞当前线程
LockSupport.park(Object blocker);  // 带阻塞对象（方便监控排查）
LockSupport.parkNanos(long nanos); // 限时阻塞
LockSupport.unpark(Thread t);      // 唤醒指定线程
```

**底层原理**：

```
LockSupport.park()
  └── Unsafe.park(false, 0L)          ← JVM 平台相关实现
        ├── Linux: pthread_cond_wait
        └── Windows: WaitForSingleObject

LockSupport.unpark(thread)
  └── Unsafe.unpark(thread)           ← 设置许可 + 唤醒线程
```

**核心机制**：**许可（permit）机制**——每个线程关联一个 `_counter`（0 或 1）：

* `unpark(t)`：将 T 的 `_counter` 设为 1（如果原来是 0，且线程被 park 则唤醒）
* `park()`：将 `_counter` 置 0（如果原来是 1，直接返回；否则阻塞）

```java
// 使用示例
public class ParkUnparkDemo {
    public static void main(String[] args) throws InterruptedException {
        Thread t = new Thread(() -> {
            System.out.println("线程开始执行...");
            LockSupport.park();              // 阻塞，等待许可
            System.out.println("线程被唤醒!");
            System.out.println("中断状态: " + Thread.interrupted());
        });
        t.start();

        Thread.sleep(2000);
        LockSupport.unpark(t);              // 给线程发放许可
        // 或: t.interrupt();               // interrupt 也会让 park 返回
    }
}
```

### 6.2 与 wait/notify 对比

| 特性 | Object.wait/notify | LockSupport.park/unpark |
|------|-------------------|------------------------|
| 使用前提 | 必须在 synchronized 块中 | 无需锁 |
| 唤醒方式 | notify/notifyAll（随机或全部） | unpark(指定线程) |
| 许可累积 | 不支持 | 支持提前 unpark → park 直接返回 |
| 中断响应 | 抛出 InterruptedException | park 返回，不抛异常 |
| 唤醒顺序 | 无法精确控制 | 精准唤醒目标线程 |
| 超时 | wait(timeout) | parkNanos/parkUntil |

**关键优势**：`unpark` 可以比 `park` 先调用，许可会累积（最多一个），后续 `park` 直接消费许可返回；而 `wait` 如果在 `notify` 之后调用，就永远等不到了。

***

## 7. 并发工具类

### 7.1 CountDownLatch

**场景**：一个线程等待多个线程完成各自任务后再继续执行。

```java
public class CountDownLatchDemo {
    public static void main(String[] args) throws InterruptedException {
        int threadCount = 3;
        CountDownLatch latch = new CountDownLatch(threadCount);

        for (int i = 0; i < threadCount; i++) {
            final int taskId = i;
            new Thread(() -> {
                try {
                    Thread.sleep((long) (Math.random() * 2000));
                    System.out.println("任务 " + taskId + " 完成");
                } catch (InterruptedException e) {
                    e.printStackTrace();
                } finally {
                    latch.countDown(); // 计数器减 1
                }
            }).start();
        }

        System.out.println("主线程等待所有任务完成...");
        latch.await();  // 阻塞直到计数器为 0
        System.out.println("所有任务完成，主线程继续");
    }
}
```

**源码分析**：

```java
// CountDownLatch 内部 Sync 继承 AQS
// 构造时将 state 设为 count
public CountDownLatch(int count) {
    if (count < 0) throw new IllegalArgumentException("count < 0");
    this.sync = new Sync(count);
}

Sync(int count) {
    setState(count); // state = count
}

// await() → acquireSharedInterruptibly(1)
// state ≠ 0 → 入队阻塞

// countDown() → releaseShared(1)
// 每次 CAS 将 state 减 1，减到 0 时唤醒所有等待线程
protected boolean tryReleaseShared(int releases) {
    for (;;) {
        int c = getState();
        if (c == 0) return false;
        int nextc = c - 1;
        if (compareAndSetState(c, nextc))
            return nextc == 0;  // 减到 0 时返回 true → 触发 doReleaseShared
    }
}
```

**特点**：**一次性**——计数器归零后不可重置。

### 7.2 CyclicBarrier

**场景**：多个线程互相等待，全部到达屏障后再同时继续（可循环使用）。

```java
public class CyclicBarrierDemo {
    public static void main(String[] args) {
        int threadCount = 3;
        CyclicBarrier barrier = new CyclicBarrier(threadCount, () -> {
            System.out.println("=== 所有线程到达屏障，执行屏障动作 ===");
        });

        for (int i = 0; i < threadCount; i++) {
            final int id = i;
            new Thread(() -> {
                try {
                    System.out.println("线程 " + id + " 到达第一阶段");
                    barrier.await();  // 等待其他线程

                    System.out.println("线程 " + id + " 到达第二阶段");
                    barrier.await();  // ★ 可重复使用

                    System.out.println("线程 " + id + " 完成所有阶段");
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }).start();
        }
    }
}
```

**源码核心**：

```java
// CyclicBarrier 内部使用 ReentrantLock + Condition（非 AQS 子类）
private final ReentrantLock lock = new ReentrantLock();
private final Condition trip = lock.newCondition();
private final int parties;          // 参与者数量
private int count;                  // 剩余等待数
private Generation generation;      // 当前代数（可重置）

// await() → dowait()
private int dowait(boolean timed, long nanos) {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        final Generation g = generation;
        if (g.broken) throw new BrokenBarrierException();

        int index = --count;
        if (index == 0) {                // 最后一个到达
            Runnable command = barrierCommand;
            if (command != null) command.run(); // 执行屏障动作
            nextGeneration();            // 重置 count + generation
            trip.signalAll();            // 唤醒所有等待线程
            return 0;
        }

        // 未到达 → Condition.await() 阻塞
        for (;;) {
            trip.await(); // 阻塞
        }
    } finally {
        lock.unlock();
    }
}
```

**CountDownLatch vs CyclicBarrier**：

| 特性 | CountDownLatch | CyclicBarrier |
|------|---------------|---------------|
| 角色 | 等待者 vs 完成者 | 互相等待 |
| 重用 | 不可重置 | 可 reset() 重置 |
| 触发动作 | 无 | 可指定 barrierAction |
| 计数方式 | countDown() 递减 | await() 到达递减 |
| 内部实现 | AQS 共享锁 | ReentrantLock + Condition |

### 7.3 Semaphore 信号量

**场景**：控制同时访问特定资源的线程数量（限流）。

```java
public class SemaphoreDemo {
    public static void main(String[] args) {
        // 只有 3 个许可证 → 最多 3 个线程同时执行
        Semaphore semaphore = new Semaphore(3, true); // 公平模式

        for (int i = 0; i < 10; i++) {
            new Thread(() -> {
                try {
                    semaphore.acquire(); // 获取许可证（可中断）
                    System.out.println(Thread.currentThread().getName() + " 获得许可，开始工作");
                    Thread.sleep(1000);
                } catch (InterruptedException e) {
                    e.printStackTrace();
                } finally {
                    semaphore.release(); // 释放许可证
                    System.out.println(Thread.currentThread().getName() + " 释放许可");
                }
            }, "线程-" + i).start();
        }
    }
}
```

**源码核心**：基于 AQS 共享锁，state 表示剩余许可证数量。

```java
// 公平版 tryAcquireShared
protected int tryAcquireShared(int acquires) {
    for (;;) {
        if (hasQueuedPredecessors())  // 公平性检查
            return -1;
        int available = getState();
        int remaining = available - acquires;
        if (remaining < 0 || compareAndSetState(available, remaining))
            return remaining;
    }
}

// releaseShared → tryReleaseShared
protected boolean tryReleaseShared(int releases) {
    for (;;) {
        int current = getState();
        int next = current + releases;
        if (compareAndSetState(current, next))
            return true; // 释放成功 → 唤醒等待线程
    }
}
```

**可用方法**：

* `acquire()` / `acquire(int permits)` — 阻塞获取
* `tryAcquire()` / `tryAcquire(timeout, unit)` — 非阻塞获取
* `release()` / `release(int permits)` — 释放

### 7.4 Exchanger

**场景**：两个线程交换数据。

```java
import java.util.concurrent.Exchanger;

public class ExchangerDemo {
    public static void main(String[] args) {
        Exchanger<String> exchanger = new Exchanger<>();

        new Thread(() -> {
            try {
                String data = "来自线程 A 的数据";
                System.out.println("A 准备交换: " + data);
                String received = exchanger.exchange(data); // 阻塞等待交换
                System.out.println("A 接收到: " + received);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }, "线程A").start();

        new Thread(() -> {
            try {
                Thread.sleep(1000); // 模拟准备数据
                String data = "来自线程 B 的数据";
                System.out.println("B 准备交换: " + data);
                String received = exchanger.exchange(data);
                System.out.println("B 接收到: " + received);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }, "线程B").start();
    }
}
```

**内部原理**：使用 CAS + 自旋 + 槽位机制。线程到达交换点时，如果槽位空则放入数据并等待；另一个线程到达时取走数据并放入自己的数据。两个线程都到达后交换完成。

***

## 8. ForkJoinPool

### 8.1 工作窃取原理

**工作窃取 (Work-Stealing)** 是 ForkJoinPool 的核心设计思想：

1. 每个工作线程维护一个**双端队列**（Deque）
2. 线程从自己的队列**头部**取任务执行（LIFO）
3. 空闲线程从其他线程队列的**尾部**"窃取"任务执行（FIFO）
4. 窃取者和被窃取者**不竞争同一个端**，减少冲突

```
线程 1 队列 (Deque): [task4 ← task3 ← task2 ← task1]   head→task1, tail→task4
    ↑ 从头部取任务                                   ↑ 线程空闲，从尾部窃取
                                                     线程 2 (窃取)
```

**为什么高效**：

* LIFO（线程自己的任务）：子任务通常在数据局部性上相关，后产生的子任务先执行利于缓存命中
* FIFO（窃取）：窃取者拿最老的任务，任务切分粒度更粗，减少窃取频率

### 8.2 分治任务示例

```java
import java.util.concurrent.ForkJoinPool;
import java.util.concurrent.RecursiveTask;

public class ForkJoinSumDemo {
    static class SumTask extends RecursiveTask<Long> {
        private static final int THRESHOLD = 1000;
        private final int[] array;
        private final int start, end;

        SumTask(int[] array, int start, int end) {
            this.array = array;
            this.start = start;
            this.end = end;
        }

        @Override
        protected Long compute() {
            if (end - start <= THRESHOLD) {
                // 足够小 → 直接计算
                long sum = 0;
                for (int i = start; i < end; i++) sum += array[i];
                return sum;
            }
            // 太大 → 拆分成子任务
            int mid = (start + end) >>> 1;
            SumTask left = new SumTask(array, start, mid);
            SumTask right = new SumTask(array, mid, end);

            left.fork();              // 异步执行子任务
            long rightResult = right.compute(); // 在当前线程执行
            long leftResult = left.join();      // 等待子任务结果

            return leftResult + rightResult;
        }
    }

    public static void main(String[] args) {
        int[] array = new int[100_000];
        for (int i = 0; i < array.length; i++) array[i] = i + 1;

        ForkJoinPool pool = new ForkJoinPool(); // 默认并行度 = CPU 核心数
        long result = pool.invoke(new SumTask(array, 0, array.length));
        System.out.println("求和结果: " + result); // 5000050000
    }
}
```

**RecursiveAction** vs **RecursiveTask**：前者无返回值（void），后者有返回值。

### 8.3 与普通线程池对比

| 特性 | ThreadPoolExecutor | ForkJoinPool |
|------|-------------------|--------------|
| 队列策略 | 共享阻塞队列 | 每个线程独立双端队列 |
| 任务窃取 | 不支持 | 支持工作窃取 |
| 任务类型 | 独立任务 | 可拆分的分治任务 |
| 窃取冲突 | — | 不同端操作，冲突极少 |
| 适用场景 | IO 密集型/通用 | CPU 密集型/递归分治 |
| 任务拆分 | 手动 | fork/join 自动 |
| 线程管理 | 核心池 + 最大池 | 固定并行度 |

**选择建议**：

* 通用任务（IO 密集型、RPC 调用等）→ **ThreadPoolExecutor**
* CPU 密集型递归分治（大数组排序、大数据处理）→ **ForkJoinPool**
* `CompletableFuture` 默认使用 ForkJoinPool.commonPool()

***

## 9. CompletableFuture

CompletableFuture 是 JDK 1.8 引入的**异步编程利器**，支持函数式组合、异常处理、多任务编排。

### 9.1 supplyAsync / runAsync

```java
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;

public class CompletableFutureDemo {
    public static void main(String[] args) throws ExecutionException, InterruptedException {
        // runAsync: 无返回值
        CompletableFuture<Void> future1 = CompletableFuture.runAsync(() -> {
            System.out.println(Thread.currentThread().getName() + " 运行无返回任务");
        });

        // supplyAsync: 有返回值
        CompletableFuture<String> future2 = CompletableFuture.supplyAsync(() -> {
            System.out.println(Thread.currentThread().getName() + " 运行有返回任务");
            return "Hello";
        });

        // 默认使用 ForkJoinPool.commonPool()
        // 可指定自定义 Executor
        ExecutorService executor = Executors.newFixedThreadPool(4);
        CompletableFuture<String> future3 = CompletableFuture.supplyAsync(() -> {
            return "Custom Pool";
        }, executor);

        System.out.println(future1.get());  // null
        System.out.println(future2.get());  // "Hello"
        executor.shutdown();
    }
}
```

### 9.2 thenApply / thenCompose / thenCombine

```java
public class CompletableFutureChainDemo {
    public static void main(String[] args) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(4);

        // === thenApply: 转换（同步，Function） ===
        CompletableFuture.supplyAsync(() -> "Hello")
            .thenApply(s -> s + " World")      // 同步转换
            .thenApply(String::toUpperCase)     // "HELLO WORLD"
            .thenAccept(System.out::println);   // 消费

        // === thenCompose: 扁平化（异步组合） ===
        // thenApply 返回 CompletableFuture → 嵌套
        // thenCompose 自动展平
        CompletableFuture.supplyAsync(() -> "User-123")
            .thenCompose(id -> getUserById(id)) // 返回 CompletableFuture<User>
            .thenAccept(user -> System.out.println("用户: " + user));

        // === thenCombine: 合并两个独立异步结果 ===
        CompletableFuture<String> f1 = CompletableFuture.supplyAsync(() -> "Hello");
        CompletableFuture<String> f2 = CompletableFuture.supplyAsync(() -> "World");

        f1.thenCombine(f2, (a, b) -> a + " " + b)      // "Hello World"
            .thenApply(String::length)                  // 11
            .thenAccept(len -> System.out.println("长度: " + len));

        // === thenAcceptBoth: 消费两个结果（无返回值） ===
        f1.thenAcceptBoth(f2, (a, b) -> System.out.println(a + " " + b));

        executor.shutdown();
    }

    static CompletableFuture<String> getUserById(String id) {
        return CompletableFuture.supplyAsync(() -> "用户数据-" + id);
    }
}
```

**thenApply vs thenCompose**：

```
thenApply:  CompletableFuture<A> → (A → B)      → CompletableFuture<B>
thenCompose: CompletableFuture<A> → (A → CF<B>) → CompletableFuture<B>  (展平)

类似 Stream 的 map vs flatMap
```

**thenApply 与 thenApplyAsync 区别**：

* `thenApply`：在上一阶段同一线程或 ForkJoinPool 线程执行
* `thenApplyAsync`：提交到 ForkJoinPool 或指定 Executor，重新调度

### 9.3 exceptionally / handle / whenComplete

```java
public class CompletableFutureExceptionDemo {
    public static void main(String[] args) {
        // === exceptionally: 异常时提供降级值 ===
        CompletableFuture.supplyAsync(() -> {
            if (Math.random() > 0.5) throw new RuntimeException("出错了");
            return "成功";
        }).exceptionally(ex -> {
            System.out.println("异常: " + ex.getMessage());
            return "降级值";            // 异常时的默认返回值
        }).thenAccept(System.out::println);

        // === handle: 无论成功/失败都处理（可恢复） ===
        CompletableFuture.supplyAsync(() -> {
            if (Math.random() > 0.5) throw new RuntimeException("失败");
            return 100;
        }).handle((result, ex) -> {
            if (ex != null) {
                System.out.println("异常: " + ex.getMessage());
                return 0;               // 异常 → 返回默认值
            }
            return result * 2;
        }).thenAccept(System.out::println);

        // === whenComplete: 类似 finally，不改变结果 ===
        CompletableFuture.supplyAsync(() -> "数据")
            .whenComplete((result, ex) -> {
                if (ex != null) {
                    System.out.println("出错: " + ex.getMessage());
                } else {
                    System.out.println("完成: " + result);
                }
                // 不改变结果，不影响下游
            })
            .thenApply(s -> s + " 处理完毕")
            .thenAccept(System.out::println);
    }
}
```

| 方法 | 成功时 | 异常时 | 返回值 |
|------|--------|--------|--------|
| `exceptionally` | 不触发 | 执行回退函数 | 恢复为正常值 |
| `handle` | 执行（result ≠ null, ex = null） | 执行（result = null, ex ≠ null） | 转换结果或恢复 |
| `whenComplete` | 执行 | 执行 | 不改变结果 |

### 9.4 allOf / anyOf

```java
public class CompletableFutureCombineDemo {
    public static void main(String[] args) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(4);

        // === allOf: 等待所有任务完成 ===
        CompletableFuture<String> task1 = CompletableFuture.supplyAsync(() -> "A", executor);
        CompletableFuture<String> task2 = CompletableFuture.supplyAsync(() -> "B", executor);
        CompletableFuture<String> task3 = CompletableFuture.supplyAsync(() -> "C", executor);

        CompletableFuture<Void> allDone = CompletableFuture.allOf(task1, task2, task3);
        allDone.get(); // 阻塞直到所有完成

        // 收集结果
        String result = Stream.of(task1, task2, task3)
            .map(CompletableFuture::join)       // join 不抛受检异常
            .collect(Collectors.joining(", "));
        System.out.println("所有结果: " + result); // "A, B, C"

        // === anyOf: 任意一个完成即返回 ===
        CompletableFuture<String> fastTask = CompletableFuture.supplyAsync(() -> {
            sleep(500); return "快任务";
        }, executor);
        CompletableFuture<String> slowTask = CompletableFuture.supplyAsync(() -> {
            sleep(1500); return "慢任务";
        }, executor);

        Object firstResult = CompletableFuture.anyOf(fastTask, slowTask).get();
        System.out.println("最快的任务结果: " + firstResult); // "快任务"

        executor.shutdown();
    }

    static void sleep(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException e) { }
    }
}
```

**实际应用场景（并行调用多个微服务）**：

```java
public class ParallelServiceDemo {
    public UserInfo getUserInfo(String userId) {
        CompletableFuture<UserBase> baseFuture =
            CompletableFuture.supplyAsync(() -> userService.getBase(userId));
        CompletableFuture<List<Order>> ordersFuture =
            CompletableFuture.supplyAsync(() -> orderService.getOrders(userId));
        CompletableFuture<Address> addressFuture =
            CompletableFuture.supplyAsync(() -> addressService.getAddress(userId));

        // 并行调用三个服务，全部完成后再组装
        return CompletableFuture.allOf(baseFuture, ordersFuture, addressFuture)
            .thenApply(v -> {
                UserBase base = baseFuture.join();
                List<Order> orders = ordersFuture.join();
                Address addr = addressFuture.join();
                return new UserInfo(base, orders, addr);
            })
            .join();
    }
}
```

***

## 总结速查表

| 类/接口 | 模式 | 核心机制 | 使用场景 |
|---------|------|----------|----------|
| **AbstractQueuedSynchronizer** | 模板方法 | state + CLH 队列 + CAS | JUC 锁/同步器基础设施 |
| **ReentrantLock** | 独占锁 | AQS + Condition | 替代 synchronized，需高级功能 |
| **AtomicInteger/AtomicReference** | 乐观锁 | CAS + volatile | 计数器、状态标志 |
| **AtomicStampedReference** | 乐观锁 | CAS + 版本戳 | 解决 ABA 问题 |
| **ConcurrentHashMap** | 分段/细粒度 | CAS + synchronized + 红黑树 | 高并发 Map |
| **ReentrantReadWriteLock** | 读写分离 | 32 位 state 高低 16 位 | 读多写少场景 |
| **StampedLock** | 乐观读 | 版本戳验证 | 极高并发读场景 |
| **CountDownLatch** | 一次等待 | AQS 共享锁，state 递减 | 等待线程全部完成 |
| **CyclicBarrier** | 循环屏障 | ReentrantLock + Condition | 多线程同步点 |
| **Semaphore** | 信号量 | AQS 共享锁，state 控制许可数 | 限流、资源池控制 |
| **Exchanger** | 双线程交换 | CAS + 槽位 + 自旋 | 两个线程数据交换 |
| **ForkJoinPool** | 工作窃取 | 双端队列 + steal | 分治任务、并行计算 |
| **CompletableFuture** | 异步编排 | 函数式组合 + 回调 | 异步调用编排 |
| **LockSupport** | 阻塞原语 | Unsafe.park/unpark | 线程精确阻塞/唤醒 |

***

> **学习建议**：JUC 包的学习建议遵循"**先理解 AQS，再逐个击破**"的路线。AQS 是 JUC 锁和同步器的骨架，理解了 state + CLH 队列 + CAS 的组合模式，ReentrantLock、Semaphore、CountDownLatch 等工具的实现自然一目了然。CAS + volatile 是并发编程的原子基石，值得深入理解其底层 CPU 指令和内存屏障原理。
