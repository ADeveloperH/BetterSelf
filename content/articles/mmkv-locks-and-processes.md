---
id: "mmkv-locks-and-processes"
title: "MMKV：线程同步、文件锁与多进程摘记（历史）"
topic: "Android 开发"
domainId: "android"
categoryId: "storage-network"
noteType: "concept"
tags: ["MMKV", "C++", "pthread", "多进程"]
summary: "修正 pthread 示例笔误、LOCK_NB 和文件锁语义，补充 MMKV 历史设计来源及 CRC 的边界。"
updatedAt: "2020-06-27"
verifiedAt: null
sample: false
applicability: "2020 年历史摘记，MMKV 版本未注明；首个 pthread 示例经本机编译运行，其余片段仅作局部文档校对，未验证 Android 多进程行为。"
sources: [{"kind": "personal", "title": "有道云笔记历史记录"}, {"kind": "external", "title": "Linux：flock(2)", "url": "https://man7.org/linux/man-pages/man2/flock.2.html"}, {"kind": "external", "title": "POSIX：mutex 规范转录", "url": "https://man7.org/linux/man-pages/man3/pthread_mutex_lock.3p.html"}, {"kind": "external", "title": "POSIX：条件等待规范转录", "url": "https://man7.org/linux/man-pages/man3/pthread_cond_wait.3p.html"}, {"kind": "external", "title": "Tencent MMKV：历史多进程设计", "url": "https://raw.githubusercontent.com/wiki/Tencent/MMKV/android_ipc.md"}, {"kind": "external", "title": "Tencent MMKV：Android 使用说明", "url": "https://raw.githubusercontent.com/wiki/Tencent/MMKV/android_tutorial.md"}]
---

> 2020 年历史摘记，未注明 MMKV 版本。2026-10-22 修正明显代码笔误与部分锁语义；只有首个线程示例经过本机编译运行，其余 8 段仍是历史片段（含故意不安全 / 死锁反例），不等同于可复用队列或锁库。

## pthread 线程与同步基础

mmkv native 层已经处理了多线程调用的问题

c++ 中：

### 线程创建

POSIX，全称为可移植性操作系统接口。它包括了系统应用程序接口（简称API）。该标准的目的是定义了标准的基于UNIX操作系统的系统接口和环境来支持源代码级的可移植性，致力于提供基于不同语言的规范。POSIX的线程标准，定义了创建和操纵线程的一套API

**基本使用**：

```cpp
#include <pthread.h>
#include <cstdio>

void* run(void* args) {
    const int value = *static_cast<const int*>(args);
    std::printf("value=%d\n", value);
    return nullptr;
}

int main() {
    int value = 1; // 参数活到 join 完成
    pthread_t worker;
    const int created = pthread_create(&worker, nullptr, run, &value);
    if (created != 0) return created;
    const int joined = pthread_join(worker, nullptr);
    return joined;
}
```

### 线程同步

多线程同时读写同一份共享资源的时候，可能会引起冲突。需要引入线程“同步”机制，即各位线程之间有序地对共享资源进行操作。

```text
#include <pthread.h>
using namespace std;
queue<int> q;
void *pop(void* args) {
//线程未同步导致的多线程安全问题
// 会有重复的数据取出并出现异常
if (!q.empty())
{
printf("取出数据:%d\n", q.front());
q.pop();
}
else {
printf("无数据\n");
}
return 0;
}
int main()
{
for (size_t i = 0; i < 5; i++)
{
q.push(i);
}
pthread_t pid[10];
for (size_t i = 0; i < 10; i++)
{
pthread_create(&pid[i], 0, pop, &q);
}
system("pause");
return 0;
}
```

### 互斥量

pthread\_mutex\_t 互斥量就是一把锁。 当一个线程要访问一个共享变量时，先用锁把变量锁住，操作完了之后再释放掉锁。

当另一个线程也要访问这个变量时，发现这个变量被锁住了，此时无法访问，一直等待直到锁没了，才能够上锁与使用。

使用互斥量前要先初始化，使用的函数如下：

加入互斥锁

```text
queue<int> q;
pthread_mutex_t mutex; //互斥量：锁
void *pop(void* args) {
// 锁
pthread_mutex_lock(&mutex);
if (!q.empty())
{
printf("取出数据:%d\n", q.front());
q.pop();
}
else {
printf("无数据\n");
}
// 放
pthread_mutex_unlock(&mutex);
return 0;
}
int main()
{
//初始化互斥锁
pthread_mutex_init(&mutex, 0);
for (size_t i = 0; i < 5; i++)
{
q.push(i);
}
pthread_t pid[10];
for (size_t i = 0; i < 10; i++)
{
pthread_create(&pid[i], 0, pop, &q);
}
for (size_t i = 0; i < 10; i++)
{
pthread_join(pid[i], 0);
}
//需要释放
pthread_mutex_destroy(&mutex);
system("pause");
return 0;
}
```

不可把默认 mutex 的重复加锁行为统一描述成“必然死锁”。`PTHREAD_MUTEX_NORMAL` 同线程重复 lock 会死锁，`ERRORCHECK` 返回错误，`RECURSIVE` 使用计数；`DEFAULT` 的可移植行为不能依赖这一概括。下面是意图展示重复加锁问题的历史反例，未执行。见 [POSIX mutex 规范（man-pages 转录）](https://man7.org/linux/man-pages/man3/pthread_mutex_lock.3p.html)

```text
#include <iostream>
#include <queue>
#include <pthread.h>
using namespace std;
//互斥量 : 锁
pthread_mutex_t mutex;
queue<int> q;
void test(){
pthread_mutex_lock(&mutex); //线程阻塞，死锁
printf("队列大小:%d\n", q.size());
pthread_mutex_unlock(&mutex);
}
void *pop(void* args) {
int ret= pthread_mutex_lock(&mutex);
if (!q.empty()) {
printf("取出数据:%d\n", q.front());
q.pop();
}
else {
printf("无数据\n");
}
test(); //死锁
pthread_mutex_unlock(&mutex);
return 0;
}
```

#### 创建递归锁

需要在初始化 pthread\_mutex\_t 时指明：

```text
// 锁的属性 : pthread_mutex_t锁默认是非递归的
pthread_mutexattr_t attr;
pthread_mutexattr_init(&attr);
// 设置为递归锁
pthread_mutexattr_settype(&attr, PTHREAD_MUTEX_RECURSIVE);
// 初始化mutex
pthread_mutex_init(&mutex, &attr);
// 完成初始化后即可释放
pthread_mutexattr_destroy(&attr);
```

### 条件变量

条件变量是线程间进行同步的一种机制，主要包括两个动作：一个线程等待"条件变量的条件成立"而挂起；另一个线程使"条件成立",从而唤醒挂起线程

如：

```text
template <class T>
class SafeQueue {
public:
SafeQueue() {
pthread_mutex_init(&mutex,0);
}
~SafeQueue() {
pthread_mutex_destroy(&mutex);
}
void enqueue(T t) {
pthread_mutex_lock(&mutex);
q.push(t);
pthread_mutex_unlock(&mutex);
}
int dequeue(T& t) {
pthread_mutex_lock(&mutex);
if (!q.empty())
{
t = q.front();
q.pop();
pthread_mutex_unlock(&mutex);
return 1;
}
pthread_mutex_unlock(&mutex);
return 0;
}
private:
queue<T> q;
pthread_mutex_t mutex;
};
```

上面的模板类存放数据T，并使用互斥锁保证对queue的操作是线程安全的。这就是一个生产/消费模式。如果需要在取出数据的时候，queue为空，则一直等待，直到下一次enqueue加入数据。

此时可以加入条件变量使 “dequeue” 挂起,直到由其他地方唤醒：

```text
#include <queue>
using namespace std;
template <class T>
class SafeQueue {
queue<T> q;
pthread_mutex_t mutex;
pthread_cond_t cond; //条件变量
public:
SafeQueue() {
pthread_mutex_init(&mutex,0);
pthread_cond_init(&cond, 0); //初始化
}
~SafeQueue() {
pthread_mutex_destroy(&mutex);
pthread_cond_destroy(&cond); //销毁
}
void enqueue(T t) {
pthread_mutex_lock(&mutex);
q.push(t);
//发出信号 通知挂起线程
//1、由系统唤醒一个线程（随机）
//pthread_cond_signal(&cond);
//2、广播 唤醒所有等待条件线程
pthread_cond_broadcast(&cond);
pthread_mutex_unlock(&mutex);
}
int dequeue(T& t) {
pthread_mutex_lock(&mutex);
//可能因为某些特殊条件虚假唤醒 所以while循环等待唤醒。（与Java的wait一样）
while (q.empty())
{
pthread_cond_wait(&cond, &mutex); //等待并自动释放互斥锁
}
t = q.front();
q.pop();
pthread_mutex_unlock(&mutex);
return 1;
}
};
```

条件变量等待必须在持有相同 mutex 时循环检查共享条件。`pthread_cond_wait` 等待时原子释放锁，返回前重新获得锁。即使通知确实发生，消费者重新拿到锁时队列也可能已被另一消费者取空；此外还允许虚假唤醒，因此用 `while (q.empty())` 重新检查。不能把所有“醒来后条件不成立”都叫虚假唤醒。见 [POSIX 条件等待规范（man-pages 转录）](https://man7.org/linux/man-pages/man3/pthread_cond_wait.3p.html)。

上述模板仍缺少停止 / 关闭协议、错误处理和安全析构约束；销毁锁和条件变量之前必须保证没有仍在使用或等待它们的线程。拼写修正不表示整个实现已被验证。

### 锁的自动管理

在使用pthread\_mutex\_t时，lock之后，一定需要unlock。为了防止忘记解锁，同时方便使用，可以利用C++中构造方法与析构方法对锁进行封装，实现锁的自动管理。

```text
//封装互斥量： 锁
class ThreadLock {
private:
pthread_mutex_t m_lock;
public:
ThreadLock(){
//递归锁
pthread_mutexattr_t attr;
pthread_mutexattr_init(&attr);
pthread_mutexattr_settype(&attr, PTHREAD_MUTEX_RECURSIVE);
pthread_mutex_init(&m_lock, &attr);
pthread_mutexattr_destroy(&attr);
}
~ThreadLock(){
pthread_mutex_destroy(&m_lock);
}
void lock(){
auto ret = pthread_mutex_lock(&m_lock);
if (ret != 0) {
//失败
}
}
bool try_lock(){
auto ret = pthread_mutex_trylock(&m_lock);
return (ret == 0);
}
void unlock(){
auto ret = pthread_mutex_unlock(&m_lock);
if (ret != 0) {
//失败
}
}
};
//模板类
template <typename T>
class ScopedLock {
T *m_lock;
//禁止使用编译器默认生成的函数
//默认拷贝构造与=赋值
ScopedLock(const ScopedLock<T> &other) = delete;
ScopedLock &operator=(const ScopedLock<T> &other) = delete;
public:
//构造方法中上锁
ScopedLock(T *oLock) : m_lock(oLock) {
assert(m_lock);
lock();
}
//析构方法解除锁
~ScopedLock() {
unlock();
m_lock = nullptr;
}
void lock() {
if (m_lock) {
m_lock->lock();
}
}
bool try_lock() {
if (m_lock) {
return m_lock->try_lock();
}
return false;
}
void unlock() {
if (m_lock) {
m_lock->unlock();
}
}
};
//宏函数 __COUNTER__：初始值为0，编译单元内每出现一次出现该宏,便会加1。
#define SCOPEDLOCK(lock) _SCOPEDLOCK(lock, __COUNTER__)
#define _SCOPEDLOCK(lock, counter) __SCOPEDLOCK(lock, counter)
//decltype：推断变量类型；__scopedLock##counter(&lock)：##为连接符
#define __SCOPEDLOCK(lock, counter) ScopedLock<decltype(lock)> __scopedLock##counter(&lock)
//使用
ThreadLock lock;
void test(){
//创建 ScopedLock<ThreadLock> __scopedLock1对象，使用lock上锁
SCOPEDLOCK(lock);
//退出方法 执行__scopedLock1析构，解锁lock
}
```

## flock 文件锁与封装思路

在多个进程同时操作同一份文件的过程中，很容易导致文件中的数据混乱，需要锁操作来保证数据的完整性。 原记录称当时使用的 MMKV 版本通过 flock 文件锁完成多进程操作文件的同步（具体版本未注明）

```text
#include <sys/file.h>
// Returns 0 on success, or -1 on error
int flock (int fd, int operation);
```

flock()系统调用是在整个文件中加锁，通过对传入的fd所指向的文件进行操作，然后在通过operation参数所设置

的值来确定做什么样的操作。operation可以赋如下值:

LOCK\_SH，共享锁，多个进程可以使用同一把锁：读锁；

LOCK\_EX，排他锁，同时只允许一个进程使用：写锁；

LOCK\_UN，释放锁

LOCK\_NB，发起非阻塞请求，如：LOCK\_SH\|LOCK\_NB。

### Linux flock 语义与 MMKV 历史封装分开看

[Linux flock(2)](https://man7.org/linux/man-pages/man2/flock.2.html)描述的是协作式文件锁：相关代码都遵守锁协议时，锁才能协调访问。锁与 open file description 关联，不能简单归纳为“每个进程一把锁”。`LOCK_NB` 是非阻塞标记。

共享锁和独占锁可转换，但不保证原子；转换期间其他进程可能获得锁。因此不要把“只有自己持有共享锁”当成无间隙升级承诺，也不要断言 Linux flock 的双读者升级一定形成互等死锁。flock 本身不做死锁检测。转换后需要依据应用协议重新确认共享状态。

递归加锁、嵌套读写作用域与原始 flock 状态也不同：它没有业务层递归计数，`LOCK_UN` 不会替调用者逐层退栈。转成 `LOCK_SH` 与直接 `LOCK_UN` 的效果不同，不能说“降级就是无锁”。

[MMKV 官方历史多进程设计文档](https://raw.githubusercontent.com/wiki/Tencent/MMKV/android_ipc.md)介绍了用读写计数封装嵌套操作及升级 / 降级的思路。它可以解释原笔记的来源，但其中的概括不应覆盖特定系统的 flock 规范；本轮没有核对某个 MMKV release 的锁实现或故障恢复行为。

## MMKV 多进程一致性摘记

遵守兼容的锁协议可以协调多进程对文件的访问；共享锁仍允许多个读者。写入协调之外，还需感知其他进程对 mmap 数据的修改。以下是官方历史设计中的状态同步思路，不代表当前所有 release 的逐行实现。

MMKV 本质上是将文件 mmap 到内存块中，将新增的 key-value 统统 append 到内存中；到达边界后，进行重整回写以腾出空间，空间还是不够的话，就 double 内存空间；对于内存文件中可能存在的重复键值，MMKV 只选用最后写入的作为有效键值。那么其他进程为了保持数据一致，就需要处理这三种情况：**写指针增长、内存重整、内存增长**。但首先还得解决一个问题：怎么让其他进程感知这三种情况？

### 写指针的同步

我们可以在每个进程内部缓存自己的写指针，然后在写入键值的同时，还要把最新的写指针位置也写到mmap 内存中；这样每个进程只需要对比一下缓存的指针与 mmap 内存的写指针，如果不一样，就说明其他进程进行了写操作。事实上 MMKV 原本就在文件头部保存了有效内存的大小，这个数值刚好就是写指针的内存偏移量，我们可以重用这个数值来校对写指针。

### 内存重整的感知

考虑使用一个单调递增的序列号，每次发生内存重整，就将序列号递增。将这个序列号也放到 mmap 内存中，每个进程内部也缓存一份，只需要对比序列号是否一致，就能够知道其他进程是否触发了内存重整。

### 内存增长的感知

事实上 MMKV 在内存增长之前，会先尝试通过内存重整来腾出空间，重整后还不够空间才申请新的内存。所以内存增长可以跟内存重整一样处理。至于新的内存大小，可以通过查询文件大小来获得，无需在 mmap 内存另外存放。

在MMKV中会生成一份与数据文件同名的.crc文件，此文件中记录两个关键数据：数据内容的crc校验码与单调递增的序列号。

**CRC 校验码**：用于发现数据损坏，不能证明来源可信或数据没有被恶意篡改；校验码也可能碰撞。原稿用 MD5 判断文件“合法”的类比已删除。应把数据完整性检查与来源认证区分开。

递增的序列号：每次去重、扩容即执行全量更新，序列号+1并记录在crc文件中，不匹配则需要重新解析全部文件。

## 复核范围与后续事项

- 已修正第一个线程例子的参数解引用、线程 ID、分号与等待；移除 Windows 专属 pause。其余历史代码修正了 `destroy` 拼写，仍未整体编译。
- 默认 mutex 行为、条件等待谓词和 Linux flock 转换规则已按规范校对；没有做 Linux 多进程竞态测试。
- MMKV 有效数据长度、序列号、重整和扩容机制可对应官方历史设计，但未确定原笔记所用版本。使用时需按实际 release 核对模式、路径和 API，不能只凭这份摘记选锁。
- [官方 Android 使用说明](https://raw.githubusercontent.com/wiki/Tencent/MMKV/android_tutorial.md)展示多进程模式；本轮没有进行 Android 进程读写、崩溃恢复或性能验证。
