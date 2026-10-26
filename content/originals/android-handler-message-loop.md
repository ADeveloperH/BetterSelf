---
id: "android-handler-message-loop"
title: "Handler 与 Handler消息机制（两份原始正文）"
updatedAt: "2025-10-19"
captureMethod: "mcp-text"
---

## 原笔记一：Handler

~~~text
1.Handler的三个核心
Message     Handler接收和处理的消息
MessageQueue             Message的队列，先进先出，每一个线程只有一个。结构非队列，单向链表实现的。Message有个next，将消息串联为单向链表，实际存储为链表头结点即Message。 存储逻辑，equeueMessage方法：队列为空或新消息，立即处理，否则遍历链表，通过when找到插入位置插入。when是消息执行时间戳。取出逻辑，next()方法：阻塞等待nativePollOnce，消息到达后，返回链表的头结点，并更新存储的头结点mMessages为下一个节点。
Looper            消息泵，是MessageQueue的管理者，会不断的从MessageQueue中取消息，并将消息分给对应的Handler处理，每个线程只有一个looper
2.Handler处理流程
先启动一个Looper，looper.loop，主线程默认启动一个looper，然后Handler sendMessage或post将MessageQueue对象发送到MessageQueue，looper就不停的从MessageQueue中取消息，然后分发给对应的Handler的handleMessage处理。
3.子线程如何使用Handler？
直接调用handler.sendMessage会报错，需要先Looper.prepare()
4.Toast可以在子线程中调用吗？怎么才可以
Toast不可以在子线程调用。其内部有handler处理，默认使用的是Looper.myLooper()。所以在子线程调用需要先Looper.prepare()，toast show之后要Looper.loop();注意要手动管理Looper使用完毕后，Looper.quit()退出循环，否则线程阻塞。 核心原因：主线程有系统级事件绑定、休眠优化，所以不阻塞。
private Looper getLooper(@Nullable Looper looper) {    if (looper != null) {        return looper;    }    return checkNotNull(Looper.myLooper(),            "Can't toast on a thread that has not called Looper.prepare()");}
5.Looper为什么不会导致ANR、卡死？
首先ANR是在一定的时间内事件无响应才会发生，Looper本身不会造成ANR。
Looper会让线程进入休眠，不会占用cpu资源，只有新消息到达时才会被唤醒，因此不会阻塞UI线程。
Looper通过休眠等待+精准唤醒机制（依赖的是linux的epoll和管道通信），将死循环转化为事件驱动的高效调度模型。
ANR时间
输入调度超时    5s       比如触摸 事件分发。
广播 10s    前台广播接收器
Service启动超时  20s
Binder通信超时   10s
6.Handler怎么保证不同线程处理消息的？
会通过ThreadLocal保存线程uid，来保证每个线程使用的是自己的Handler。
7.ThreadLocal介绍
ThreadLocal是一个线程内部的数据存储类，通过他可以在指定的线程存储数据，其他线程无法获取。
主要特点：线程隔离、不需要同步、与线程绑定，线程结束自动清理。
示例：
ThreadLocal<String> threadLocal = new ThreadLocal<String>();
//设置线程局部变量
threadLocal.set("线程A的值");
//获取线程局部变量
threadLocal.get("线程A的值");
//移除线程局部变量
threadLocal.remove();
典型的应用场景：
数据库连接管理（如Spring的事务管理）
用户会话信息存储
避免在方法间传递参数
日期格式化等非线程安全对象的管理
可以用ThreadLocal.withInitial()设置初始值。
8.Handler和IdleHandler区别
Handler     核心作用是线程通信与消息处理，消息入队时触发，即时执行，适用于UI更新、跨线程通讯。
IdleHandler      核心作用是空闲任务调度，消息队列MessageQueue空闲时触发，如果主线程忙自动延迟执行，适用于性能优化、后台任务。  可能的使用场景，低优先级的处理内容，比如下一页数据之类的，可以在空闲时再调用。或者优化Application启动，核心任务先执行，非核心任务空闲后执行。
源码流程：操作在MessageQueue，需要获取queue之后添加，addIdleHandler之后，会将IdleHandler保存在mIdleHandlers列表，是一个ArrayList<IdleHandler>。消息空闲时会for循环执行这个列表的所有IdleHandler。
Looper.getMainLooper().getQueue().addIdleHandler(new IdleHandler(){
public boolean queueIdle(){
//空闲时执行逻辑
return false;   //返回false只执行一次。true表示保留并重复触发
}
});
性能优化类任务：延迟执行GC操作、资源预加载（布局、图片等）、缓存清理或数据上报。
非紧急UI任务：延迟动画启动、界面元素预渲染、后台日志记录。
框架级应用： Activity生命周期状态同步、系统服务初始化。
注意：避免耗时操作，单个queueIdle()执行时间过长会导致ANR。 多次调用添加IdleHandler，消息队列空闲时会全部执行。
优先级控制，不适合实时性要求高的任务。
生命周期管理，注意及时移除可能引起内存泄漏的Handler。
在做启动性能优化的时候，要尽可能多地减少启动阶段主线程任务。对一些启动阶段非必须且一定要在主线程里完成的任务，我们可以在应用启动完成之后再去加载。正是考虑到这些google官方提供了IdleHandler机制来告诉我们线程空闲时机。
正确的使用方法：将启动过程中非紧急的主线程任务全部放进UITasks里，然后逐个执行，切记单个消息耗时不要太长。
private static List<Runnable> uiTasks = new ArrayList<>();
public static UIPoolManager addTasks(Runnable runnable){
tasks.add(runnable);
return this;
}
public static UIManager runUiTasks(){
NullHelper.requireNonNull(uiTasks);
IUiTask iUiTask = new IUiTask(){
public boolean queueIdle(){
if(!uiTask.isEmpty()){
Runnable task = uiTasks.get(0);
task.run();
//逐次取一个任务执行，避免占用主线程太久。
uiTasks.remove(task);
}
return !uiTasks.isEmpty();
}
}；
Looper.myQueue().addIdleHandler(iUiTask);
return this;
}
9.Handler和HandlerThread
线程关联性
Handler：必须绑定到特定线程的Looper，主线程默认自带Looper，用于在该线程处理消息。
HandlerThread：继承自Thread，内部自动创建Looper，提供自带消息循环的子线程。
实现复杂度
Handler：需手动管理Looper，子线程需要调用Looper.prepare()和Looper.loop()
HandlerThread：封装了Looper的创建流程，开箱即用。
任务处理能力
Handler：适合轻量级消息传递（如UI更新）
HandlerThread：支持耗时操作（如网络请求）
使用场景对比
Handler：典型场景：主线程UI更新、跨线程非耗时通信。 不适用场景：长时间阻塞操作（如文件下载等）
HandlerThread：典型场景：后台持续任务（如日志记录）、需要消息队列的耗时操作。不适用场景：高频短任务（线程切换开销大）
示例：
Handler
Handler uiHandler = new Handler(Looper.getMainLooper()){
public void handleMessage(Message msg){
textView.setText((String)msg.obj); // 安全更新UI
}
};
new Thread(()->{
Message msg = Message.obtain();
msg.obj = "数据加载完成";
uiHandler.sendMessage(msg);
}).start();
HandlerThread
//创建HandlerThread
HandlerThread workerThread = new HandlerThread("WorkerThread");
workerThread.start();
//绑定Handler
Handler workHandler = new Handler(workThread.getLooper()){
public void handleMessage(Message msg){
//执行耗时操作，如查询数据库等
String result = doBackgroundWork();
//完成后可通过uiHandler回传结果。
}
};
workerHandler.sendEmptyMessage(0);
HandlerThread有postDelayed()延迟执行和removeMessages()取消任务
关键注意事项：
内存泄漏：Handler持有Activity引用时需使用弱引用。
线程安全：HandlerThread处理共享数据需同步机制。
资源释放：HandlerThread退出时应调用quit()释放Looper。
~~~

## 原笔记二：Handler消息机制

~~~text
1.Handler 详解
消息机制简介
在Android中使用消息机制，我们首先想到的就是Handler。没错，Handler是Android消息机制的上层接口。我们通常只会接触到Handler和Message开完成消息机制，其实内部还有两大助手共同完成消息传递。
消息机制模型
消息机制主要包含：MessageQueue、Handler、Looper和Message这四大部分。
Message
需要传递的消息，可以传递数据
MessageQueue
消息队列，但是它的内部实现并不是用的队列，实际上是通过一个单链表的数据结构来维护消息列表，因为单链表在插入和删除上比较有优势。主要功能是向消息池传递消息（MessageQueue.enqueueMessage）和取走消息池的消息（MessageQueue.next）
Handler
消息辅助类，主要功能是向消息池发送各种消息事件（Handler.sendMessage）和处理相应消息事件（Handler.handleMessage）
Looper
不断循环执行（Looper.loop），从MessageQueue中读取消息，按分发机制将消息分发给目标处理者。
消息机制的架构
运行流程：
在子线程执行完耗时操作，当Handler发送消息时，将会调用MessageQueue.enqueueMessage，向消息队列中添加消息。当通过Looper.loop开启循环后，会不断的从线程池中读取消息，即调用MessageQueue.next，然后调用目标Handler（即发送该消息的Handler）的dispatchMessage方法传递消息，然后返回到Handler所在线程，目标Handler收到消息，调用handleMessage方法，接收消息，处理消息。
MessageQueue、Handler和Looper三者之间的关系：
每个线程中只能存在一个Looper，Looper是保存在ThreadLocal中。主线程已经创建一个Looper，所以在主线程中不需要在创建Looper，但是在其他线程中需要创建Looper。每个线程中可以有多个Handler，即一个Looper可以处理来自多个Handler的消息。Looper中维护一个MessageQueue，来维护消息队列，消息队列中的Message可以来自不同的Handler。
总结
Android消息机制之ThreadLocal的工作原理：
Looper中还有一个特殊的概念，那就是ThreadLocal，ThreadLocal并不是线程，它的作用是可以在每个线程中存储数据。大家知道，Handle创建的时候会采用当前线程的Looper来构造消息循环系统，那么Handle内部如何获取当前线程的Looper呢？这就要使用ThreadLocal了，ThreadLocal可以在不同的线程之中互不干扰的存储并提供数据，通过ThreadLocal可以轻松的获取每个线程的Looper。当然，需要注意的是，线程默认是没有Looper的，如果需要使用Handler就必须为线程创建Looper。大家经常提到的主线程，也叫UI线程，它就是ActivityThread，ActivityThread被创建时就会初始化Looper，这也是在主线程默认可以使用Handle的原因。
ThreadLocal是一个线程内部的数据存储类，通过它可以在指定的线程中存储数据，数据存储以后，只有在指定线程中可以获取到存储的数据，对于其他线程来说无法获取到数据。在日常开发中用到ThreadLocal的地方很少，但是在某些特殊的场景下，通过ThreadLocal可以轻松的实现一些看起来很复杂的功能，这一点在Android源码中也有所体现，比如Looper、ActivityThread以及AMS中都用到了ThreadLocal。具体到ThreadLocal的使用场景，这个不好统一来描述，一般来说，当某些数据是以线程为作用域并且不同线程具有不同的数据副本的时候，就可以采用ThreadLocal。比如对于Handle来说，它需要获取当前线程的Looper，很显然Looper的作用域就是线程并且不同线程具有不同的Looper，这个时候通过ThreadLocal就可以轻松的实现Looper在线程中的存取。
ThreadLocal另外一个使用场景是复杂逻辑下的对象传递，比如监听器的传递，有些时候一个线程中的任务过于复杂，这可能表现为函数调用栈比较深以及代码入口的多样性，在这种情况下，我们又需要监听器能够贯穿整个线程的执行过程，这个时候可以怎么做呢？其实就可以采用ThreadLocal，采用ThreadLocal可以让监听器作为线程内的局部对象而存在，在线程内部只要通过get方法就可以获取到监听器。而如果不采用ThreadLocal，那么我们能想到的可能就是一下两种方法：
将监听器通过参数的形式在函数调用栈中进行传递
在函数调用栈很深的时候，通过函数参数来传递监听器对象几乎是不可接受的
将监听器作为静态变量供线程访问
这是可以接受的，但是这种状态是不具有可扩充性的，比如如果同时有两个线程在执行，那就需要提供两个静态的监听器对象，如果有十个线程在并发执行呢？提供十个静态的监听器对象？这显然是不可思议的。而采用ThreadLocal每个监听器对象都在自己的线程内部存储，根本就不会有这个问题。
ThreadLocal<Boolean> threadLocal = new ThreadLocal<>();threadLocal.set(true);Log.i(TAG, "getMsg: MainThread"+threadLocal.get());new Thread("Thread#1"){    @Override    public void run() {        threadLocal.set(false);        Log.i(TAG, "run: Thread#1" + threadLocal.get());    }}.start();new Thread("Thread#2"){    @Override    public void run() {        Log.i(TAG, "run: Thread#2" + threadLocal.get());    }}.start();        输出：true、false、null
虽然在不同线程中访问的是同一个ThreadLocal对象，但是它们获取到的值却是不一样的。不同线程访问同一个ThreadLocal的get方法，ThreadLocal内部会从各自的线程中取出一个数组，然后再从数据中根据当前ThreadLocal的索引去查找出对应的value值，很显然，不同线程中的数组是不同的，这就是为什么通过ThreadLocal可以在不同的线程中维护一套数据副本并且彼此互不干扰。
ThreadLocal是一个泛型类，里面有两个重要方法：get()和set()方法。它们所操作的对象都是当前线程的localValues对象的table数组，因此在不同线程中访问同一个ThreadLocal的get和set方法，它们对ThreadLocal所做的读写操作仅限于各自线程的内部，这就是为什么ThreadLocal可以在多个线程中互不干扰的存储和修改数据。
https://blog.csdn.net/singwhatiwanna/article/details/48350919
创建 Message 实例的最佳方式
由于 Handler 极为常用，所以为了节省开销，Android 给 Message 设计了回收机制，所以我们在使用的时候尽量复用 Message ，减少内存消耗。
方法有二：
通过 Message 的静态方法 Message.obtain();   获取；
通过 Handler 的公有方法 handler.obtainMessage();
Android 子线程进行UI操作的方案
Activity.runOnUiThread()
Handler.post()
View.post()
其他：
SurfaceView
SurfaceView 通过独立的 Surface 进行渲染，支持在子线程中绘制：
TextureView
类似 SurfaceView，但渲染在 View 层级中，同样支持子线程绘制：
Handler 引起的内存泄露原因以及最佳解决方案
Handler 允许我们发送延时消息，如果在延时期间用户关闭了 Activity，那么该 Activity 会泄露。 这个泄露是因为 Message 会持有 Handler，而又因为 Java 的特性，内部类会持有外部类强引用，使得 Activity 会被 Handler 持有，这样最终就导致 Activity 泄露。
解决：将 Handler 定义成静态的内部类，在内部持有 Activity 的弱引用，并在Acitivity的onDestroy()中调用handler.removeCallbacksAndMessages(null)及时移除所有消息。
为什么我们能在主线程直接使用 Handler，而不需要创建 Looper ？
通常我们认为 ActivityThread 就是主线程。事实上它并不是一个线程，而是主线程操作的管理者。在 ActivityThread.main() 方法中调用了 Looper.prepareMainLooper() 方法创建了 主线程的 Looper ,并且调用了 loop() 方法，所以我们就可以直接使用 Handler 了。
因此我们可以利用 Callback 这个拦截机制来拦截 Handler 的消息。如大部分插件化框架中Hook ActivityThread.mH 的处理。
主线程的 Looper 不允许退出
Android 不允许手动退出主线程的 Looper（即 Looper.getMainLooper()）。调用 quit() 或 quitSafely() 会抛出异常：
Looper:public void quit() {    mQueue.quit(false);}MessageQueue:void quit(boolean safe) {    if (!mQuitAllowed) {        //退出会抛出异常        throw new IllegalStateException("Main thread not allowed to quit.");    }    .....}
Handler 里藏着的 Callback 能干什么？
Handler.Callback 有优先处理消息的权利 ，当一条消息被 Callback 处理并拦截（返回 true），那么 Handler 的 handleMessage(msg) 方法就不会被调用了；如果 Callback 处理了消息，但是并没有拦截，那么就意味着一个消息可以同时被 Callback 以及 Handler 处理。
子线程里弹 Toast 的正确姿势
本质上是因为 Toast 的实现依赖于 Handler，按子线程使用 Handler 的要求修改即可，同理的还有 Dialog。
妙用 Looper 机制
将 Runnable post 到主线程执行；
利用 Looper 判断当前线程是否是主线程。
主线程的死循环一直运行是不是特别消耗CPU资源呢？
1.Looper 死循环的实现原理
主线程的 Looper 通过 MessageQueue 实现消息处理，其核心逻辑是一个 for(;;) 死循环：
// Looper.loop() 简化代码public static void loop() {    for (;;) {        Message msg = queue.next(); // 从队列中取消息。这里如果没有消息可能会被阻塞进入休眠        if (msg == null) {            return; // 仅当队列退出时循环结束        }        msg.target.dispatchMessage(msg); // 分发消息到 Handler        msg.recycleUnchecked(); // 回收消息    }}
关键点：
queue.next() 是阻塞操作：当队列中没有消息时，线程会进入 休眠状态，释放 CPU 资源。
消息唤醒机制：当有新消息入队时，MessageQueue 会通过底层的 epoll 机制唤醒线程继续处理。
2. 为什么不会消耗 CPU？
MessageQueue 的阻塞是通过 Linux 的 epoll 机制实现的：
无消息时：线程进入 epoll_wait() 状态，此时线程处于 休眠状态，不占用 CPU 时间。
新消息入队时：epoll_ctl() 会唤醒线程，继续执行消息处理逻辑。
这种机制类似于 Java 的 BlockingQueue，但效率更高，因为它基于操作系统的 事件驱动 机制。
Handler postDelay这个延迟是怎么实现的？
handler.postDelay并不是先等待一定的时间再放入到MessageQueue中，而是直接进入MessageQueue，以MessageQueue的时间顺序排列和唤醒的方式结合实现的。
Handler 线程切换原理详解
Handler 是 Android 中实现线程间通信的核心机制，其核心原理在于 共享消息队列 + 线程绑定的 Looper。下面通过详细图解和代码分析来解释其工作流程。
工作流程图解：
子线程                     主线程  │                          │  │ 1. 创建 Message           │  │ 2. 调用 mainHandler.send() ────┐  │                          │    │  │                          │ 3. 消息入队到主线程 MessageQueue  │                          │    │  │                          │ 4. 主线程 Looper 循环取出消息  │                          │    │  │                          │ 5. 通过 msg.target.dispatch()  │                          │    │  │                          │ 6. 执行 Handler.handleMessage()  ↓                          ↓
MessageQueue （单链表）消息排序
MessageQueue 是一个按时间排序的单向链表，而非传统的 FIFO 队列。其核心排序逻辑基于消息的 when 字段（表示消息应当被处理的绝对时间），确保消息按预定时间顺序执行。
消息在入队时会根据 when 字段插入到链表的合适位置，具体规则如下：
时间越小越靠前：when 值越小的消息越靠近队首。
同步屏障特殊处理：屏障消息（target=null）会按时间插入，但在处理时会拦截其后的同步消息。
相同时间按入队顺序：若两条消息 when 相同，则先入队的排在前面。
//Handler.java //正常发生的消息会加上SystemClock.uptimeMillis()的时间public final boolean sendMessageDelayed(@NonNull Message msg, long delayMillis) {    if (delayMillis < 0) {        delayMillis = 0;    }    //第二个参数就是Message 的 when    return sendMessageAtTime(msg, SystemClock.uptimeMillis() + delayMillis);}// MessageQueue.javaboolean enqueueMessage(Message msg, long when) {    synchronized (this) {        msg.markInUse();        msg.when = when;        Message p = mMessages;                // 核心排序逻辑：根据 when 找到插入位置        if (p == null || when == 0 || when < p.when) {            // 队列为空 或 需要立即执行 或 时间小于队首消息            msg.next = p;            mMessages = msg; // 新消息成为队首            needWake = mBlocked; // 可能需要唤醒队列        } else {            // 寻找合适的插入位置（按 when 升序）            Message prev;            do {                prev = p;                p = p.next;            } while (p != null && p.when <= when);                        // 插入到 prev 和 p 之间            msg.next = p;            prev.next = msg;            needWake = false; // 不需要唤醒（队列已在运行）        }                // 唤醒可能正在等待的线程        if (needWake) {            nativeWake(mPtr);        }    }    return true;}
立即执行的消息（when=0）
通过 Handler.sendMessageAtFrontOfQueue() 发送的消息会强制 when=0，确保插入到队首
public final boolean sendMessageAtFrontOfQueue(Message msg) {    return enqueueMessage(mQueue, msg, 0); // 强制 when=0}
子线程真的不能更新UI么
~~~
