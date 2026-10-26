---
id: 'android-handler-message-loop'
title: 'Android Handler 消息机制：从入队到线程切换'
topic: 'Android 开发'
domainId: 'android'
categoryId: 'framework'
noteType: 'concept'
tags: ['Handler', 'Looper', 'MessageQueue', 'ThreadLocal', 'HandlerThread']
summary: '合并两份历史笔记，梳理 Handler、Looper 与 MessageQueue 的职责、延时消息、线程归属、IdleHandler 和 HandlerThread，并补充 Android 17 的队列实现变化。'
updatedAt: '2026-10-26'
verifiedAt: null
sample: false
applicability: '面向 Android 应用层消息调度。传统 MessageQueue 内部结构以 Android 16 及更早实现为背景；Android 17 对 targetSdk 37+ 引入无锁实现。本文未进行设备时序和性能实验。'
sources:
  [
    { 'kind': 'personal', 'title': '有道云笔记：Handler' },
    { 'kind': 'personal', 'title': '有道云笔记：Handler消息机制' },
    {
      'kind': 'external',
      'title': 'Android：Handler API',
      'url': 'https://developer.android.com/reference/android/os/Handler',
    },
    {
      'kind': 'external',
      'title': 'Android：Looper API',
      'url': 'https://developer.android.com/reference/android/os/Looper',
    },
    {
      'kind': 'external',
      'title': 'Android：MessageQueue API',
      'url': 'https://developer.android.com/reference/android/os/MessageQueue',
    },
    {
      'kind': 'external',
      'title': 'Android：IdleHandler API',
      'url': 'https://developer.android.com/reference/android/os/MessageQueue.IdleHandler',
    },
    {
      'kind': 'external',
      'title': 'Android：HandlerThread API',
      'url': 'https://developer.android.com/reference/android/os/HandlerThread',
    },
    {
      'kind': 'external',
      'title': 'Android 17：MessageQueue 行为变化',
      'url': 'https://developer.android.com/about/versions/17/changes/messagequeue',
    },
  ]
---

> 这篇文章把两份内容重叠的历史笔记合并为一个入口。原笔记中的 Toast 线程限制、固定 ANR 超时、Handler 弱引用模板和“MessageQueue 永远是单链表”等表述受版本或场景影响，未直接照搬。

## 四个角色分别做什么

| 角色           | 职责                                                             | 容易混淆的点                                                        |
| -------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| `Message`      | 描述一次待处理的工作及其数据，也可以承载 `Runnable`              | 它通过 `target` 关联最终处理它的 `Handler`                          |
| `Handler`      | 向指定 `Looper` 的队列提交工作，并在该 `Looper` 所在线程分发工作 | `Handler` 不创建线程，也不让代码自动并行                            |
| `MessageQueue` | 保存等待分发的消息，并在合适时间向 `Looper` 提供下一条消息       | 应通过 `Handler` 入队，不应依赖其私有字段和内部结构                 |
| `Looper`       | 驱动消息循环，从队列取出消息并交给目标 `Handler`                 | 一个线程至多关联一个 `Looper`，一个 `Looper` 可以服务多个 `Handler` |

创建 `Handler` 时应显式传入 `Looper`。无参构造函数已经弃用，因为隐式选择当前线程的 `Looper` 容易造成线程归属不清、消息丢失或在无 `Looper` 的线程上崩溃。

```java
Handler mainHandler = new Handler(Looper.getMainLooper());

Thread worker = new Thread(() -> {
    String result = loadData();
    mainHandler.post(() -> render(result));
});
worker.start();
```

`render(result)` 在主 `Looper` 所在线程执行。后台计算仍发生在 `worker` 中；`post()` 只负责把后续工作放进主线程队列。

## 一条消息如何完成分发

1. 调用 `post()` 或 `sendMessage()`，`Handler` 将工作关联到自己的 `Looper`。
2. 工作进入该 `Looper` 的 `MessageQueue`。延时消息在入队时已经带有目标执行时间，并不是先由另一个线程睡眠。
3. `Looper.loop()` 持续取得当前可以处理的消息。暂时没有到期工作时，底层等待机制会让线程阻塞等待，而不是忙循环占满 CPU。
4. `Looper` 调用目标 `Handler` 的分发逻辑。`Runnable`、`Handler.Callback` 和重写的 `handleMessage()` 按框架规则处理消息。
5. 回调运行在 `Looper` 关联的线程上，因此回调本身仍必须避免长时间阻塞该线程。

`nativePollOnce` 出现在主线程栈中不等于它导致了 ANR。Android 官方的 ANR 排查文档指出，它往往表示线程当时正在等待 Looper 消息。判断 ANR 要结合被阻塞的事件、其他线程和完整时间线。

## 队列顺序与版本边界

在传统实现中，普通消息按到期时间维护在链式结构中，`when` 较早的消息更靠前；相同时间的先后还取决于具体入队逻辑。`sendMessageAtFrontOfQueue()` 会把消息放到队首，官方文档警告它很容易让队列失序，应只在非常特殊的场景使用。

这个内部结构不能再概括为所有 Android 版本的永久规则。Android 17 针对 `targetSdkVersion 37` 及以上应用启用新的无锁 `MessageQueue` 实现。应用层可依赖的是公开 API 的调度语义，不应通过反射读取 `mMessages` 等私有字段，也不应把链表遍历成本当成跨版本不变结论。

`Handler` 的 `has...()` 和 `remove...()` 方法可能扫描待处理消息，队列很长时成本较高。可取消任务优先考虑显式状态标记、可取消的执行抽象，或让任务开始时更新自身状态。

## Looper 与 ThreadLocal 的关系

线程默认没有 `Looper`。需要手动建立消息循环时，调用顺序是 `Looper.prepare()`、创建绑定当前 `Looper` 的 `Handler`，最后进入 `Looper.loop()`。`Looper.myLooper()` 通过线程局部存储取得当前线程关联的实例；它保存的是每个线程自己的值，不是“线程 UID”。

```java
class LooperWorker extends Thread {
    Handler handler;

    @Override public void run() {
        Looper.prepare();
        handler = new Handler(Looper.myLooper(), message -> {
            handleWork(message);
            return true;
        });
        Looper.loop();
    }
}
```

手动写这段代码还要解决初始化竞态、退出和异常处理。需要一个带消息循环的后台线程时，可以使用 `HandlerThread`；如果业务只需要执行后台任务，Android 当前文档更推荐 `Executor`、`ExecutorService` 或 Kotlin 协程。

## IdleHandler 适合做什么

`MessageQueue.IdleHandler` 会在队列即将等待更多消息时收到回调。即使队列里仍有未来才到期的消息，也可能被视为空闲。`queueIdle()` 返回 `false` 表示执行后移除，返回 `true` 表示保留以便以后再次回调。

```java
MessageQueue queue = Looper.getMainLooper().getQueue();
queue.addIdleHandler(() -> {
    recordFirstIdle();
    return false;
});
```

它适合很短、允许推迟、且确实需要在该 Looper 线程完成的工作。它不是后台线程，也不提供截止时间保证。把资源解码、网络请求或大批初始化直接放进主线程 `queueIdle()`，仍可能造成掉帧或 ANR。

## HandlerThread 的使用边界

`HandlerThread` 是自带 `Looper` 的 `Thread`。它适合必须与只接受 `Handler` 的 API 协作，并且需要在独立 Looper 线程串行处理的场景。它不是通用线程池，也不会自动取消延时任务。

```java
HandlerThread thread = new HandlerThread("serial-io");
thread.start();
Handler workerHandler = new Handler(thread.getLooper());

workerHandler.post(this::performShortSerialWork);

// 结束使用时：处理已到期消息后退出；未来的延时消息不会继续执行。
thread.quitSafely();
```

大量按功能各建一个 `HandlerThread` 会增加常驻线程内存，还可能带来队列锁竞争和优先级反转。能用 `Executor` 或协程表达的普通后台任务，应优先使用它们提供的取消、异常传播和任务组合能力。

## 常见误区校正

- `Handler` 绑定的是 `Looper` 及其线程，不是通过 ThreadLocal 保存“线程 UID”。
- `sendMessage()` 可以从任意线程调用；要求当前线程已有 `Looper` 的是隐式创建 Handler 或调用依赖当前 Looper 的 API。
- `Looper` 等待消息本身通常不会占满 CPU，但在主线程回调中执行耗时工作仍会阻塞界面。
- `ThreadLocal` 在线程结束时并不等于业务资源一定立即释放。线程池线程寿命较长时，临时值应在 `finally` 中 `remove()`。
- 非静态内部类 Handler 可能间接持有外部对象，但“全部改成弱引用”不是统一答案。更直接的做法是缩短任务生命周期、取消回调，并让 Handler 不捕获不必要的界面对象。

## 与同步屏障笔记的关系

本文只讲普通消息循环。同步屏障和异步消息属于更具体的队列调度机制，见[Handler 同步屏障：机制、边界与风险](#/article/android-handler-sync-barrier)。那篇文章按 Android 15 源码梳理调用链，版本范围与本文不同。

## 核验状态

已按当前 Android API 文档核对 Handler、Looper、IdleHandler 和 HandlerThread 的公开语义，并补充 Android 17 的 MessageQueue 变化。本文没有在 Android 17 设备上比较新旧队列实现，也没有对示例做项目编译或时序测试，因此保持“未完整核验”。
