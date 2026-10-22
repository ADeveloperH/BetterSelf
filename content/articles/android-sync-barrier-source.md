---
id: "android-sync-barrier-source"
title: "Android 同步屏障：Oreo 源码摘记（历史）"
topic: "Android 开发"
domainId: "android"
categoryId: "framework"
noteType: "concept"
tags: ["Android", "Handler", "MessageQueue"]
summary: "Oreo 历史源码摘记；修正消息发送、屏障插入条件和 epoll 解释，保留简化片段与原参考链接。"
updatedAt: "2021-06-23"
verifiedAt: null
sample: false
applicability: "oreo-release 历史源码阅读；已复核部分机制和明显笔误，片段含省略项，未进行运行验证。"
sources: [{"kind": "personal", "title": "有道云笔记历史记录"}, {"kind": "external", "title": "AOSP Oreo：MessageQueue", "url": "https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/oreo-release/core/java/android/os/MessageQueue.java"}, {"kind": "external", "title": "AOSP Oreo：Handler", "url": "https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/oreo-release/core/java/android/os/Handler.java"}, {"kind": "external", "title": "AOSP Android 8：native Looper", "url": "https://raw.githubusercontent.com/aosp-mirror/platform_system_core/android-8.0.0_r1/libutils/Looper.cpp"}]
---

> 2021 年历史摘记，原文注明 oreo-release。2026-10-22 复核了部分源码机制并修正笔误；下列代码仍为省略片段，不能直接编译运行。源码依据：[Oreo MessageQueue](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/oreo-release/core/java/android/os/MessageQueue.java)、[Oreo Handler](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/oreo-release/core/java/android/os/Handler.java)。

先看[消息类型与场景整理](#/article/android-handler-sync-barrier)了解另一份笔记的组织方式，再按需对照本篇的历史源码片段。

## 阅读前提

想要了解清楚同步屏障机制，必须先完全理解[Android消息机制和应用](https://yanzhenjie.blog.csdn.net/article/details/89218745)，不了解的同学可以先去搜索相关资料熟悉一下再继续看下面的内容。

## 同步屏障与异步消息

我们知道消息机制中有一个重要的类是MessageQueue，望文生义就是消息队列的意思，在一般情况下，MessageQueue对于当前线程是同步的，那么什么是当前线程呢？就是实例化MessageQueue的线程，在消息机制这个完整的机制中，MessageQueue是在Looper的构造方法中被实例化。也就是说，MessageQueue正常情况是同步处理消息的，明白这一点就可以让同步屏障入场了。

同步屏障，看字面意思也能猜出个八九分，就是阻碍队列中同步消息的屏障，那么它是如何运行的呢？此时需要引进异步消息，在正常时候，我们发送的Message全都是同步消息，发送异步消息有两种方式，下面分别来看一下。

### 发送异步消息的原始示例

第一种发送异步消息的方式，使用Handler包含async参数的构造方法，例如下面这个。

```text
public Handler(boolean async) {
    this(null, async);
}
```

此历史内部构造方式会把该 Handler 发送的消息标记为异步；该构造方法带 `@hide`，普通应用不能按公开 SDK 方法直接调用。公开 SDK 的异步创建方式见关联概念篇。

```text
Handler mHandler = new Handler(true);
...

Message msg = mHandler.obtainMessage(...);
mHandler.sendMessageAtTime(msg, dueTime);
```

第二种方法，显示设置Message为异步消息

```text
Message msg = mHandler.obtainMessage(...);
msg.setAsynchronous(true);
msg.sendToTarget();
```

其实第一种方式也是在我们发送Message时，Handler内部帮我们调用了Message\#setAsynchronous(boolean)，且参数传了true，因此这两使用方式了解即可。

我们知道，上面的Message的target都是非空的，而在MessageQueue\#next()方法中，target非空的Message都会被正常处理（下面会有相关代码），因此在这个时候同步消息和异步消息并没有什么不同。如果同学们思路没有断的话，应该能想到，此时同步障碍就需要登场了。

## 屏障插入与队列取消息

现在我们要贴一点framework/base下的代码，都以oreo-release分支为准，因为不同版本SDK这些代码所在的为止略有不同。

如果相让异步消息起作用，就得开启同步障碍，同步障碍会阻碍同步消息，只允许通过异步消息，如果队列中没有异步消息，此时的loop()方法将被Linux epoll机制所阻塞。

开启同步障碍也很简单，调用MessageQueue\#postSyncBarrier()方法即可，一个 Looper 持有消息队列，Handler 绑定到 Looper；多个 Handler 可以共享同一个队列。框架内部可以这样操作，普通应用不能将隐藏接口当作公开 API：

```text
mHandler.getLooper().getQueue().postSyncBarrier();
```

它的代码也很简单：

```text
public int postSyncBarrier() {
    return postSyncBarrier(SystemClock.uptimeMillis());
}

private int postSyncBarrier(long when) {
  // 历史简化片段省略了 synchronized (this) 等实现；完整源码必须在锁内访问队列。
  final int token = mNextBarrierToken++;
  final Message msg = Message.obtain();
  msg.markInUse();
  msg.when = when;
  msg.arg1 = token;
  Message prev = null;
  Message p = mMessages;
  if (when != 0) {
    while (p != null && p.when <= when) {
      prev = p;
      p = p.next;
    }
  }
  if (prev != null) {
    msg.next = p;
    prev.next = msg;
  } else {
    msg.next = p;
    mMessages = msg;
  }
  return token;
}
```

可以看出，在实例化Message对象的时候并没有设置它的target成员变量的值，然后随即就根据执行时间把它放到链表的某个位置了，并非始终位于链表开头：这里会越过 `when <= 屏障时间` 的已有节点。只有取消息时队头是屏障，才进入向后找异步消息的路径。也就是说，当在消息队列中放入一个target为空的Message的时候，当前Handler的这一套消息机制就开启了同步阻断。

### MessageQueue.next 取消息

当开启同步障碍后，它是如何生效的呢？我们知道，Looper\#loop()方法最终还是调用了MessageQueue\#next()方法来获取队列中的消息，现在我们来看看该方法的代码：

```text
for (;;) {
  nativePollOnce(ptr, nextPollTimeoutMillis);
  synchronized (this) {
    final long now = SystemClock.uptimeMillis();
    Message prevMsg = null;
    Message msg = mMessages;
    // 如果当前开启了同步障碍
    if (msg != null && msg.target == null) {
      // 处理同步障碍，获取队列中的下一个异步消息
      do {
        prevMsg = msg;
        msg = msg.next;
        // 如果这个消息是同步的，那么继续向下找异步的
      } while (msg != null && !msg.isAsynchronous());
    }
    if (msg != null) {
      if (now < msg.when) {
        // 如果当前消息的执行时间没到，让它沉睡到下个消息的执行时间
        nextPollTimeoutMillis = msg.when - now;
      } else {
        ...
        return msg; // 执行时间到了，执行它
      }
    } else {
      // 当前没有任何消息需执行，一直沉睡
      nextPollTimeoutMillis = -1;
    }
  }
}
```

我摘抄出了主要的代码，为了方便同学们阅读理解，上述代码是简化过的。

可以看出来，当开启了同步障碍时，Looper在获取下一个要执行的消息时，会在链表中寻找第一个要执行的异步消息，如果没有找到异步消息，就让当前线程沉睡。

`nativePollOnce()` 最终可通过 native Looper 的 `epoll_wait` 等待事件。负超时表示无限等待，0 表示不等待，正值是等待超时上限；事件可以提前唤醒。等待的是当前线程，不是让 CPU 整体休眠，也不是让线程一直占用 CPU 运行。见 [Android 8 native Looper 实现](https://raw.githubusercontent.com/aosp-mirror/platform_system_core/android-8.0.0_r1/libutils/Looper.cpp)。

Looper 空闲等待本身不是 ANR 的原因；回调耗时、锁等待或未移除的屏障仍可能阻塞主线程工作。不能用 epoll 来保证“不会 ANR”。

## ViewRootImpl 绘制场景摘记

那么同步障碍有什么用呢？在我们日常的应用层开发中极少用到它，读了framework的代码后我们会发现，在ViewRootImpl.java中有使用它：

```text
void scheduleTraversals() {
  if (!mTraversalScheduled) {
    mTraversalScheduled = true;
    // 开启当前Handler的同步屏障
    mTraversalBarrier = mHandler.getLooper().getQueue().postSyncBarrier();
    // 注册遍历回调；不等同于直接发送 View.draw 消息
    mChoreographer.postCallback(..., mTraversalRunnable, null);
    if (!mUnbufferedInputDispatch) {
      scheduleConsumeBatchedInput();
    }
    
    notifyRendererOfFramePending();
    pokeDrawLockIfNeeded();
  }
}
```

实际上，这里的Handler使用的是主线程的Looper，因此这里会阻断主线程Looper的其他同步消息，在ViewRootImpl和Choreographer中多次使用到了异步消息，以完成View的整个绘制流程。

没错，也许有同学已经被启发了，当我们点击页面的某个控件时，希望瞬间得到它的回应，而不是卡在那里，最起码有个圈圈在转也行。当我们点击某个按钮，此时开启了一个Activity，如果队列中此时有很多消息在排队等候呢？那么这个Activity的测量、布局和绘制就得一直等到所有消息被处理完成才能执行，此时我们会看到页面一直黑着或者一直白着，反正不是我们想要的效果，因此如果这个消息队列有一个优先级的特点，那么不久可以解决这个问题了吗？

综上，所以在消息机制中也很巧妙的融入了优先级特点，这个同步障碍机制，实质上是一个对消息队列的优先级显示。关于[Java/Android中的优先级任务队列的实践](https://yanzhenjie.blog.csdn.net/article/details/71773950)，大家可以多搜索相关资料来学习，这个在日常开发中很有用。

## 复核范围与剩余事项

已修正 `msg.sendToTarget()`、ASCII 分号、`scheduleConsumeBatchedInput()` 拼写，以及队列插入位置和等待机制解释。上述摘要代码仍含 `...` 和省略的同步逻辑，未做运行验证。原来用 Activity 黑白屏类比优先级的段落仅为历史理解，不代表 Activity 启动链路已核验；新的调用链以关联概念篇所注明版本为准。

## 原始参考链接

[https://zhuanlan.zhihu.com/p/361508626](https://zhuanlan.zhihu.com/p/361508626)

[https://segmentfault.com/a/1190000039659685](https://segmentfault.com/a/1190000039659685)

[https://www.wanandroid.com/wenda/show/8710](https://www.wanandroid.com/wenda/show/8710)
