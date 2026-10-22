---
id: "android-handler-sync-barrier"
title: "Android 同步屏障：消息类型与场景整理"
topic: "Android 开发"
domainId: "android"
categoryId: "framework"
noteType: "concept"
tags: ["Android", "Handler", "同步屏障"]
summary: "按 Android 15 固定源码核对同步屏障、遍历调度与异步消息，区分公开 API 和历史反射尝试。"
updatedAt: "2025-07-07"
verifiedAt: null
sample: false
applicability: "源码说明限定 android-15.0.0_r1；公开异步消息 API 分别自 API 22、28 提供。文档复核，未进行设备实验。"
sources: [{"kind": "personal", "title": "有道云笔记历史记录"}, {"kind": "external", "title": "AOSP Android 15：MessageQueue", "url": "https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/android-15.0.0_r1/core/java/android/os/MessageQueue.java"}, {"kind": "external", "title": "AOSP Android 15：ViewRootImpl", "url": "https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/android-15.0.0_r1/core/java/android/view/ViewRootImpl.java"}, {"kind": "external", "title": "AOSP Android 15：Choreographer", "url": "https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/android-15.0.0_r1/core/java/android/view/Choreographer.java"}, {"kind": "external", "title": "AOSP Android 15：InputEventReceiver", "url": "https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/android-15.0.0_r1/core/java/android/view/InputEventReceiver.java"}, {"kind": "external", "title": "Android：Message API", "url": "https://developer.android.com/reference/android/os/Message"}, {"kind": "external", "title": "Android：Handler API", "url": "https://developer.android.com/reference/android/os/Handler"}, {"kind": "external", "title": "Android：非 SDK 接口限制", "url": "https://developer.android.com/guide/app-compatibility/restrictions-non-sdk-interfaces"}]
---

> 2026-10-22 文档复核：下述调用链以 AOSP `android-15.0.0_r1` 为准。原 2025 年稿中的错误场景与反射代码已从阅读说明中移出，历史原件仍保留。

较早的阅读记录见[Oreo 源码摘记（历史）](#/article/android-sync-barrier-source)，两个版本分别阅读。

## 同步与异步仍在同一个 Looper 上执行

普通 Handler 发送的消息通常是同步消息。异步消息只是带有特殊标记，可以越过同步屏障；它仍由绑定的 Looper 线程执行，不会因此新建后台线程。

- `Message.setAsynchronous(true)`：公开 API 自 API 22 提供。
- `Handler.createAsync(looper)`：公开 API 自 API 28 提供，使该 Handler 发送的消息与 Runnable 不受同步屏障限制。
- 原稿的 `new Handler(true)` 属于历史内部构造方式，不能作为普通应用的公开 SDK 用法。

版本与顺序约束见 [Message API](https://developer.android.com/reference/android/os/Message)、[Handler API](https://developer.android.com/reference/android/os/Handler)。跨 Handler 的相对顺序不能只凭“异步”作保证。

## 屏障何时生效

在这一源码版本中，插入方法叫 `postSyncBarrier()`。它创建 `target == null` 的特殊消息，并按时间和队列状态插入，返回移除时使用的 token。它不是普通应用公开 SDK API。

当 `MessageQueue.next()` 检查到队头是屏障，会向后寻找异步消息；候选消息还必须到达其 `when` 时间才能取出。找不到可执行候选时进入等待。队列前面仍可能有其他正常消息，所以“队列里有屏障”不等于“所有同步消息均已暂停”。见 [MessageQueue：next / postSyncBarrier / removeSyncBarrier](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/android-15.0.0_r1/core/java/android/os/MessageQueue.java)。

下面只是取消息规则示意，省略了锁、唤醒、退出、空闲处理和多屏障细节，不能替代完整实现：

```text
候选 = 队头
如果候选是屏障：向后找第一个异步消息
如果候选已到期：交给 Looper 分发
否则：等待候选时间或队列唤醒
```

屏障不会抢占当前正在执行的回调，也不会改变线程调度优先级。主线程中的长任务仍可能导致卡顿或 ANR。框架插入屏障后必须在相应路径使用 token 移除；应用业务不应借此尝试强行提升任务优先级。

## ViewRootImpl 与 Choreographer 的分工

固定源码中的正常遍历流程是：

1. `ViewRootImpl.scheduleTraversals()` 插入屏障，然后向 Choreographer 注册 `CALLBACK_TRAVERSAL` 回调。
2. Vsync 驱动的路径中，`Choreographer.FrameDisplayEventReceiver.onVsync()` 将自身包装为异步 Message，随后进入 `doFrame()` 和各阶段回调。
3. 遍历回调进入 `ViewRootImpl.doTraversal()`；它先移除屏障，再执行 `performTraversals()`。取消遍历时，`unscheduleTraversals()` 也会移除屏障并撤销回调。

这不是把每次 `View.draw()` 单独包装成一条异步消息，也不是等绘制完成后才移除屏障。调用归属见 [ViewRootImpl：遍历调度](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/android-15.0.0_r1/core/java/android/view/ViewRootImpl.java)、[Choreographer：Vsync 和 doFrame](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/android-15.0.0_r1/core/java/android/view/Choreographer.java)。

这个安排能减少遍历相关帧处理被屏障后的同步消息拖延的机会；它不保证“立即执行”，也不保证 60fps。实际帧表现还取决于主线程工作量、刷新率及渲染链路。

## 输入、服务与动画：原稿场景如何处理

- **输入**：原稿标为 `InputEventReceiver.dispatchInputEvent()` 的“新建 Handler Message”代码与该版本不符。这里先记录序列映射，再调用 `onInputEvent()`；不能把所有输入统一描述成这段异步消息伪源码。[InputEventReceiver 源码](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/android-15.0.0_r1/core/java/android/view/InputEventReceiver.java)
- **系统服务**：移除“AMS / WMS 关键通信普遍靠插入屏障保证及时处理”的概括。每个调用路径需要直接源码证据，本轮未覆盖完整启动与窗口通信链路。
- **动画**：Choreographer 包含动画阶段回调，但这不证明每段动画都独立插入屏障、直到动画结束才移除。原稿所列通用流程不再作为结论。

## 反射示例的边界

`postSyncBarrier` 的隐藏 API 属性与 Java 访问修饰符是两回事。`setAccessible(true)` 也不保证能绕过 Android 的非 SDK 接口限制。原反射示例还存在先取走 token、移除失败后丢失 token 的问题，故保留在历史归档而不提供为可复制方案。见 [非 SDK 接口限制](https://developer.android.com/guide/app-compatibility/restrictions-non-sdk-interfaces)。

## 尚未验证

本轮核对的是源码与公开 API 文档，没有进行设备实验；未核对所有 Android 分支、厂商实现以及输入、服务、动画的完整链路。文章继续保留“未完整核验”状态。
