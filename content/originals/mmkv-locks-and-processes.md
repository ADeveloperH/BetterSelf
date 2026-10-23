---
id: 'mmkv-locks-and-processes'
title: 'MMKV：线程锁与多进程一致性摘记'
topic: 'Android 开发'
domainId: 'android'
categoryId: 'storage-network'
noteType: 'concept'
tags: ['MMKV', 'C++', 'pthread', '多进程']
summary: '从 pthread 互斥锁、条件变量和锁封装，记录 MMKV 文件锁与多进程一致性思路。'
updatedAt: '2020-06-27'
verifiedAt: null
sample: false
applicability: '2020 年学习摘记；未注明 MMKV 版本，示例代码保留原文且未编译验证。'
sources: [{ 'kind': 'personal', 'title': '有道云笔记历史记录' }]
---

## mmkv 多线程调用

mmkv native 层已经处理了多线程调用的问题

c++ 中：

### 线程

POSIX，全称为可移植性操作系统接口。它包括了系统应用程序接口（简称API）。该标准的目的是定义了标准的基于UNIX操作系统的系统接口和环境来支持源代码级的可移植性，致力于提供基于不同语言的规范。POSIX的线程标准，定义了创建和操纵线程的一套API

**基本使用**：

```text
#include <iostream>
#include <queue>
#include <pthread.h>
void *run(void* args) {
//异步方法
int i = *(int*)i; // 1
return 0;
}
int main() {
int i = 1; //线程参数
pthread_create(&pid, 0, run, &i);//创建线程
pthread_join(pid,0)；//等待线程结束
system("pause");
return 0;
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

但是pthread\_mutex\_t锁是默认是非递归的，即**不可重入锁**。如果一个线程多次获取同一个非递归锁，则会产生死锁

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
pthread_mutex_destory(&mutex);
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
pthread_mutex_destory(&mutex);
pthread_cond_destory(&cond); //销毁
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

存在三个线程，分别为：生产者P、消费者C1与C2。

1、C1从队列中取出数据，此时队列为空；

2、C2也想从队列中获取一个元素，但此时队列为空，C2进入阻塞(cond.wait())，等待队列非空；

3、 P将一个元素入队，并唤醒条件变量；

4、C1与C2接收到唤醒信号，解除阻塞状态，上锁并获取队列中的元素;

5、C2优先获取到锁，移除队列元素并释放锁；

6、C1此时操作的队列为空，被虚假唤醒。

### 自动管理

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

## 文件锁

在多个进程同时操作同一份文件的过程中，很容易导致文件中的数据混乱，需要锁操作来保证数据的完整性。 在最新版本的MMKV中使用flock文件锁来完成多进程操作文件的同步

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

LOCK\_BN，发起非阻塞请求，如：LOCK\_SH\|LOCK\_BN。

任意数量的进程可同时持有一个文件上的共享锁（读锁），但只能有一个进程能够持有一个文件上的互斥锁(写锁)。flock支持锁升级：只有自己进程存在读锁，可以直接升级为写锁，在转换的过程中首先会删除既有的锁，然后创建新锁 。若其他进程存在读锁，需要等待释放读锁；

在设计MMKV中的文件锁需要实现：

### 递归锁

意思是如果一个进程/线程已经拥有了锁，那么后续的加锁操作不会导致卡死，并且解锁也不会导致外层的锁被解掉。对于文件锁来说，前者是满足的，后者则不然。因为文件锁是状态锁，没有计数器，无论加了多少次锁，一个解锁操作就全解掉。只要用到子函数，就非常需要递归锁。

### 锁升级/降级

锁升级是指将已经持有的共享锁，升级为互斥锁，亦即将读锁升级为写锁；锁降级则是反过来。文件锁支持锁升级，但是容易死锁：假如 A、B 进程都持有了读锁，现在都想升级到写锁，就会陷入相互等待的困境，发生死锁。另外，由于文件锁不支持递归锁，也导致了锁降级无法进行，一降就降到没有锁。

为了解决这两个难题，需要对文件锁进行封装，增加读锁、写锁计数器。

加写锁时，如果当前已经持有读锁，那么先尝试加写锁（try\_lock ），try\_lock 失败说明其他进程持有了读锁，我们需要**先将自己的读锁释放掉，再进行加写锁操作**，以避免死锁的发生。

解写锁时，假如之前曾经持有读锁，那么我们不能直接释放掉写锁，这样会导致读锁也解了。我们应该**加一个读锁，将锁降级。**

## MMKV多进程设计

上面我们讲过了flock文件锁能够实现同一时间只有一个进程在操作持久化文件，但是如果存在AB进程，在B进程修改完成之后，A进程如何知道B进程的修改？

MMKV 本质上是将文件 mmap 到内存块中，将新增的 key-value 统统 append 到内存中；到达边界后，进行重整回写以腾出空间，空间还是不够的话，就 double 内存空间；对于内存文件中可能存在的重复键值，MMKV 只选用最后写入的作为有效键值。那么其他进程为了保持数据一致，就需要处理这三种情况：**写指针增长、内存重整、内存增长**。但首先还得解决一个问题：怎么让其他进程感知这三种情况？

### 写指针的同步

我们可以在每个进程内部缓存自己的写指针，然后在写入键值的同时，还要把最新的写指针位置也写到mmap 内存中；这样每个进程只需要对比一下缓存的指针与 mmap 内存的写指针，如果不一样，就说明其他进程进行了写操作。事实上 MMKV 原本就在文件头部保存了有效内存的大小，这个数值刚好就是写指针的内存偏移量，我们可以重用这个数值来校对写指针。

### 内存重整的感知

考虑使用一个单调递增的序列号，每次发生内存重整，就将序列号递增。将这个序列号也放到 mmap 内存中，每个进程内部也缓存一份，只需要对比序列号是否一致，就能够知道其他进程是否触发了内存重整。

### 内存增长的感知

事实上 MMKV 在内存增长之前，会先尝试通过内存重整来腾出空间，重整后还不够空间才申请新的内存。所以内存增长可以跟内存重整一样处理。至于新的内存大小，可以通过查询文件大小来获得，无需在 mmap 内存另外存放。

在MMKV中会生成一份与数据文件同名的.crc文件，此文件中记录两个关键数据：数据内容的crc校验码与单调递增的序列号。

**CRC校验码**：循环冗余校验 ，类似文件MD5值。我们下载软件往往会附带MD5值，如AS。比较MD5值就能知道文件是否合法、完整，一旦修改了文件数据，MD5值将不匹配。

递增的序列号：每次去重、扩容即执行全量更新，序列号+1并记录在crc文件中，不匹配则需要重新解析全部文件。
