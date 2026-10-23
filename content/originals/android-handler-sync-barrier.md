---
id: 'android-handler-sync-barrier'
title: 'Handler 同步屏障：概念与场景整理'
topic: 'Android 开发'
domainId: 'android'
categoryId: 'framework'
noteType: 'concept'
tags: ['Android', 'Handler', '同步屏障']
summary: '整理同步消息、异步消息、屏障范围、绘制场景和反射示例。'
updatedAt: '2025-07-07'
verifiedAt: null
sample: false
applicability: '2025 年历史整理；API 名称、源码归属及应用场景描述需复核。'
sources: [{ 'kind': 'personal', 'title': '有道云笔记历史记录' }]
---

## Handler 同步屏障机制详解

Handler 的同步屏障（Synchronization Barrier）是 Android 消息机制中的一种特殊机制，用于让特定类型的消息（异步消息）获得优先处理权。这一机制在 Android 的 UI 渲染等场景中至关重要，能够确保关键消息被及时处理。

## 1.基本概念

### 1.1 同步（普通）消息

通过 Handler 发送消息（如调用Handler.sendMessage），最终都会调用 Handler.enqueueMessage()让消息入队。msg.target 被赋值为 this， this 即为 Handler 对象，并且 Message 的成员变量 mAsynchronous默认为 false，这种消息是同步消息，一般我们发送的消息都是同步消息。

- **特点**：
  - `target` 字段指向发送它的 `Handler`。
  - 在没有同步屏障的情况下，按 `when` 字段排序依次处理。
  - **会被同步屏障拦截**：当队列中存在屏障时，同步消息会暂停处理，直到屏障被移除。

### 1.2 异步消息

特殊标记的消息，可在同步屏障存在时优先处理。

- **特点**：
  - 通过 `Message.setAsynchronous(true)` 标记为异步（API 21+）。
  - 创建 Handler 时可指定 `async = true` 使其默认发送异步消息（API 28+）。
  - **不受同步屏障影响**：在屏障存在时，队列会跳过同步消息，优先处理异步消息。

### 1.3 屏障消息（同步屏障）

特殊的控制消息，用于阻挡同步消息，强制队列优先处理异步消息。

- **特点**：
  - `target` 字段为 `null`，通过 `MessageQueue.enqueueSyncBarrier()` 插入。
  - **按时间排序**：屏障消息会根据 `when` 字段插入到队列的合适位置。
  - **拦截范围**：仅拦截其**之后**的同步消息，不影响之前的消息。
  - **必须手动移除**：通过 `MessageQueue.removeSyncBarrier(token)` 移除，否则队列会一直阻塞同步消息。

## 2.应用场景

屏障消息（Sync Barrier）在 Android 系统中扮演着关键角色，其核心用途是**临时提升特定类型消息的优先级**，确保关键任务能够在不受干扰的情况下优先执行。以下是其具体应用场景和实际意义：

### 1. UI 渲染与 Vsync 机制

在 Android 的屏幕刷新机制中，`Choreographer` 利用屏障消息确保 **Vsync 信号触发的绘制任务** 能够优先执行：

#### 工作流程

1. **接收 Vsync 信号**：当屏幕刷新周期到来时，系统发送 Vsync 信号。
2. **插入屏障**：`Choreographer` 通过 `enqueueSyncBarrier()` 插入屏障，阻挡后续同步消息。
3. **发送异步绘制消息**：将绘制任务（如 `View.draw()`）作为异步消息发送到队列。
4. **执行绘制**：由于屏障存在，绘制任务会被立即处理，避免被其他同步消息（如网络回调、定时任务）阻塞。
5. **移除屏障**：绘制完成后，调用 `removeSyncBarrier()` 恢复正常消息处理。

#### 源码验证

```text
// ViewRootImpl.java
void scheduleTraversals() {
    if (!mTraversalScheduled) {
        mTraversalScheduled = true;
        // 插入屏障
        mTraversalBarrier = mHandler.getLooper().getQueue().enqueueSyncBarrier();
        // 发送异步绘制任务
        mChoreographer.postCallback(
            Choreographer.CALLBACK_TRAVERSAL, mTraversalRunnable, null);
    }
}

void unscheduleTraversals() {
    if (mTraversalScheduled) {
        mTraversalScheduled = false;
        // 移除屏障
        mHandler.getLooper().getQueue().removeSyncBarrier(mTraversalBarrier);
    }
}
```

#### 意义

- **避免卡顿**：确保每一帧的绘制任务在 Vsync 到来时立即执行，维持 60fps 的流畅体验。
- **优先级控制**：即使队列中存在大量同步消息（如用户频繁点击），绘制任务仍能优先处理。

### 2. 输入事件处理

触摸、按键等输入事件需要快速响应，屏障机制确保它们不会被其他任务阻塞：

#### 工作流程

1. **接收输入事件**：系统将输入事件封装为消息。
2. **标记为异步**：输入事件消息通过 `setAsynchronous(true)` 标记为异步。
3. **插入屏障（可选）**：在高优先级场景下，插入屏障阻挡同步消息。
4. **优先处理**：异步输入事件消息越过屏障，被立即处理。

#### 源码验证

```text
// InputEventReceiver.java
void dispatchInputEvent(int seq, InputEvent event) {
    // 发送异步消息处理输入事件
    Message msg = Message.obtain();
    msg.what = MSG_DISPATCH_INPUT_EVENT;
    msg.arg1 = seq;
    msg.obj = event;
    msg.setAsynchronous(true); // 标记为异步
    mHandler.sendMessage(msg);
}
```

#### 意义

- **提升交互响应速度**：用户操作（如滑动、点击）能立即触发 UI 反馈，避免 “卡顿感”。

### 3. 系统服务通信

Android 系统服务（如 `ActivityManagerService`、`WindowManagerService`）使用屏障机制确保关键通信不被延迟：

#### 典型场景

- **Activity 启动流程**：AMS 发送的启动 Activity 请求需快速响应，避免界面长时间空白。
- **窗口管理**：WMS 更新窗口层级时，通过屏障确保布局计算和绘制任务优先执行。

### 4. 动画与过渡效果

动画和过渡效果需要高帧率（如 60fps）流畅执行，屏障机制可保证其连续性：

#### 工作流程

1. **启动动画**：调用 `View.animate()` 或 `Animator` 触发动画。
2. **插入屏障**：动画系统插入屏障，阻挡非紧急同步消息。
3. **发送异步帧更新**：每一帧的更新作为异步消息处理。
4. **移除屏障**：动画结束后移除屏障。

#### 意义

- **保持动画流畅性**：避免动画帧被其他任务打断，确保视觉效果连贯。

## 3.常见问题

### 3.1 队列中有同步屏障，同步消息一定不会执行吗？

不一定。同步屏障仅拦截其之后的同步消息。若同步消息通过特殊方式（如 sendMessageAtFrontOfQueue()）插入到屏障之前，则仍会被执行。但在大多数场景下，同步屏障的目的正是为了阻塞后续的同步消息，优先处理异步消息（如 UI 渲染）

### 3.2 怎么设置同步屏障

由于MessageQueue的 postSyncBarrier 方法使用了 @UnsupportedAppUsage注解，无法直接调用需要使用反射

```text
   private Deque<Integer> mBarrierTokens = new LinkedList<>();
   private void addBarrier() {
        try {
            // 获得发送同步屏障的方法
            Method method = MessageQueue.class.getMethod("postSyncBarrier");
            method.setAccessible(true);
            // postSyncBarrier返回的token
            int barrierToken = (int) method.invoke(mHandler.getLooper().getQueue());
            mBarrierTokens.add(barrierToken);
        } catch (NoSuchMethodException e) {
            e.printStackTrace();
        } catch (IllegalAccessException e) {
            e.printStackTrace();
        } catch (InvocationTargetException e) {
            e.printStackTrace();
        }
    }

    private void removeBarrier() {
        if (mBarrierTokens.isEmpty()) {
            return;
        }
        try {
            // 获取移除同步屏障的方法
            Method method = MessageQueue.class.getMethod("removeSyncBarrier", int.class);
            method.setAccessible(true);
            int barrierToken = mBarrierTokens.pollLast();
            // 取出最新的token做为参数调用removeSyncBarrier方法
            method.invoke(mHandler.getLooper().getQueue(), barrierToken);
        } catch (NoSuchMethodException e) {
            e.printStackTrace();
        } catch (IllegalAccessException e) {
            e.printStackTrace();
        } catch (InvocationTargetException e) {
            e.printStackTrace();
        }
    }
```
