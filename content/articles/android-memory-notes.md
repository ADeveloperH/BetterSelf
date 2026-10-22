---
id: "android-memory-notes"
title: "Android 内存：引用、泄漏案例与监控摘记"
topic: "Android 开发"
domainId: "android"
categoryId: "performance"
noteType: "concept"
tags: ["Android", "内存优化", "内存泄漏", "Handler"]
summary: "校正引用可达性、Bitmap 与资源释放、内部类风险及新版内存回调；保留历史反例并标明未验证范围。"
updatedAt: "2025-07-10"
verifiedAt: null
sample: false
applicability: "历史案例保留；2026-10-22 局部文档复核，引用语义参照 Java17，Android 回调按当前 API 文档限定版本；20段历史代码未编译和设备验证。"
sources: [{"kind": "personal", "title": "有道云笔记历史记录"}, {"kind": "external", "title": "Java17：引用包", "url": "https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/lang/ref/package-summary.html"}, {"kind": "external", "title": "Java17：WeakReference", "url": "https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/lang/ref/WeakReference.html"}, {"kind": "external", "title": "Java17：PhantomReference", "url": "https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/lang/ref/PhantomReference.html"}, {"kind": "external", "title": "Android：Bitmap.Config", "url": "https://developer.android.com/reference/android/graphics/Bitmap.Config"}, {"kind": "external", "title": "Android：Bitmap", "url": "https://developer.android.com/reference/android/graphics/Bitmap"}, {"kind": "external", "title": "Android：Bitmap 缓存示例", "url": "https://developer.android.com/topic/performance/graphics/cache-bitmap"}, {"kind": "external", "title": "Android：Activity", "url": "https://developer.android.com/reference/android/app/Activity"}, {"kind": "external", "title": "Android：ComponentCallbacks", "url": "https://developer.android.com/reference/android/content/ComponentCallbacks"}, {"kind": "external", "title": "Android：ComponentCallbacks2", "url": "https://developer.android.com/reference/android/content/ComponentCallbacks2"}, {"kind": "external", "title": "LeakCanary：工作原理", "url": "https://square.github.io/leakcanary/fundamentals-how-leakcanary-works/"}]
---

> 2026-10-22 局部文档复核。已校正下述引用、图片和生命周期建议；20 段代码保留为历史案例，包含旧 API、故意死循环和不完整反例，未编译或上设备验证，不应直接运行。

## 引用类型摘记

这里讨论的是**从 GC Roots 出发的可达性**。一个已整体不可达的对象环即使互有强引用，也可能回收；局部变量是否写了 null 不是唯一判断条件。引用语义参照 [Java 17 引用包文档](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/lang/ref/package-summary.html)；实际 Android 版本行为还需对应其运行时。

### 强引用

对象仍可从 GC Roots 经强引用链到达时，不会因“某个局部变量已不用”而自动失去这条链。清理静态集合、回调注册和待处理任务时，要检查实际持有者。

### 软引用

软引用对象的清理取决于 GC 策略，不能保证“内存充足就永不清理”，也不能保证缓存一定避免 OOM。需要稳定容量预算的缓存，应明确大小与淘汰策略。

### 弱引用

当 GC 判定对象是弱可达时，才清除相应弱引用；不能概括成“每次 GC 都回收所有弱引用对象”。如果还有强 / 软可达路径，这个前提可能不成立。`get()` 可能返回 null；清除引用与回收对象内存也不是同一个可观测时刻。见 [WeakReference](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/lang/ref/WeakReference.html)。

### 虚引用

`get()` 总返回 null。以 Java 17 语义为例，GC 判定虚可达后清除引用，并在当时或之后将关联引用加入队列；它可用于安排清理，不能保证在某个确定时刻、尤其“对象 GC 前”完成资源释放。不同 Android / Java 版本需另核对，关键资源应显式关闭。见 [PhantomReference](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/lang/ref/PhantomReference.html)。

详细讲解：

[https://www.cnblogs.com/throwable/p/12271653.html\#phantomreference](https://www.cnblogs.com/throwable/p/12271653.html#phantomreference)

## 常见内存问题

### 内存溢出（OOM）

- **大图片 / 大资源加载**：直接加载高分辨率图片（未压缩），Bitmap 占用内存过大（如 ` BitmapFactory.decodeResource ` 不设置 ` inSampleSize `）。
- **内存泄漏累积**：长期运行中，内存泄漏的对象越来越多，耗尽可用内存（如反复打开 / 关闭 Activity 导致泄漏累积）。
- **大量数据缓存**：无限制缓存数据（如 List 存储过多数据、未设置缓存上限的 LruCache）。
- **第三方库滥用**：某些 SDK 或库内部存在内存管理问题，频繁创建大对象且未释放。

#### 原记录中的处理思路

- **优化大资源加载**：
    - 图片压缩：使用 ` BitmapFactory.Options ` 设置 ` inSampleSize `（缩放比例）、` inPreferredConfig `（需按质量、透明度和解码结果选择配置）。
    - 按需加载：列表图片使用 “缩略图 + 高清图” 懒加载（如 Glide/Picasso 自动处理）。
- **控制内存泄漏**：彻底解决内存泄漏问题（见下文 “内存泄漏解决方案”），避免可用内存被侵占。
- **合理使用缓存**：
    - 图片缓存：使用 LruCache 并明确容量单位；默认按条目计数，Bitmap 缓存可重写 `sizeOf` 按字节或 KiB 计量，保持与 `maxSize` 一致。官方示例的 1/8 是示例预算，不是通用比例。
    - 数据缓存：避免无限制存储大集合，及时清理过期数据。
- `largeHeap` 不作为常规修复：先按实际分配、持有链和缓存预算定位原因。

图片配置补充：`ARGB_4444` 已弃用，官方说明从 Android KitKat 起用它创建的 Bitmap 会改为 `ARGB_8888`，不能按旧公式认定节省一半。依据：[Bitmap.Config](https://developer.android.com/reference/android/graphics/Bitmap.Config)。缓存单位与预算见 [官方 Bitmap 缓存示例](https://developer.android.com/topic/performance/graphics/cache-bitmap)。

### 内存泄漏（Memory Leak）

- **静态引用持有 Activity**：` static Activity sActivity ` 在 Activity 销毁后未置空，导致 Activity 及内部 View 等资源无法回收。
- **非静态内部类持有外部引用**：如 Handler 作为非静态内部类，持有 Activity 引用，若消息队列有未处理消息，Activity 销毁后仍被 Handler 引用。
- **资源未按所有权释放**：Cursor、输入流等 Closeable 资源应在使用结束时关闭。Bitmap 没有 `close()`；`recycle()` 只适用于确定不再被使用的位图，不能对仍被 View / 图片库持有的位图统一调用。见 [Bitmap API](https://developer.android.com/reference/android/graphics/Bitmap)。
- **单例持有 Context**：单例模式中持有 Activity Context（而非 Application Context），Activity 销毁后单例仍存活，导致 Activity 无法回收。
- **集合未清理**：全局集合（如 ` static List `）添加对象后未移除，对象生命周期结束后仍被集合引用。

#### 原记录中的处理思路

- **避免静态持有 Activity/Fragment**：
    - 避免长生命周期持有者保留已销毁的 Activity；只需应用级上下文时可用 Application Context，需要 UI / 主题能力时按对应生命周期获取。
    - 弱引用只能改变持有关系，不能负责取消任务或验证 Activity 当前是否还能安全更新 UI。
- **优化内部类**：
    - 检查 Handler / Runnable 等持有者是否超出宿主生命周期；可取消任务、移除回调或解除持有，静态类 + 弱引用只是可选模式。
- **及时释放资源**：
    - 流与 Cursor 优先在使用范围内用 try-with-resources 关闭；监听和任务在配对生命周期中解除。`onDestroy()` 并非所有进程退出路径都会执行，不能把资源清理全押在这里。
    - 注销监听器（如 ` SensorManager.unregisterListener() `、` BroadcastReceiver.unregisterReceiver() `）。
- **单例模式优化**：单例中若需 Context，使用 ` Application Context ` 而非 Activity Context。

### 内存抖动（Memory Churn）

- **循环 / 频繁回调中创建对象**：如 ` for ` 循环中创建 ` new Object() `、` onDraw() ` 中创建 ` Paint `/` Rect ` 等对象（每帧调用，短时间创建大量对象）。
- **字符串频繁拼接**：使用 ` + ` 拼接字符串（每次拼接创建新 String 对象），而非 ` StringBuilder `。
- **高频事件回调**：如 ` onTouchEvent `、` SensorEventListener ` 中创建临时对象（触发频率高，累积大量短期对象）。

#### 原记录中的处理思路

- **避免高频创建对象**：
    - 循环 / 回调中（如 ` onDraw() `、` onScroll() `）的临时对象（如 ` new Rect() `）移至外部声明，复用对象。
    - 使用 **对象池（Object Pool）** 缓存频繁创建的对象（如列表项 ViewHolder 复用）。
- **优化字符串操作**：频繁拼接字符串时，用 ` StringBuilder ` 替代 ` + `（` + ` 会创建多个临时 String 对象）。
- **减少短生命周期对象**：避免在高频方法（如 ` getView() `）中创建匿名类、集合等，提前初始化并复用。

## 生命周期与引用持有：历史案例

> 历史反例区：以下代码保留原貌，包含 AsyncTask、隐式 Looper 的 Handler、超长延时和 `while(true)`。改为静态类只切断可能的隐式引用，不会让任务自动停止。线程中断需任务配合检查；取消策略、资源所有权和 UI 生命周期仍需单独设计。

### 静态 Activity 引用

这种泄漏

```text
private static MainActivity activity;

void setStaticActivity() {
    activity = this;
}
```

构造静态变量持有Activity对象很容易造成内存泄漏，因为静态变量是全局存在的，所以当MainActivity生命周期结束时，引用仍被持有。这种写法开发者是有理由来使用的，所以我们需要正确的释放引用使对象不再被这条长生命周期引用链保留；何时 GC 仍由运行时决定。

Java 的 java.lang.ref 包提供了引用包装类，并不是 Set 集合：[https://developer.android.com/reference/java/lang/ref/package-summary.html\#classes](https://link.jianshu.com?t=https://developer.android.com/reference/java/lang/ref/package-summary.html#classes)

允许开发者控制引用的“强度”。Activity对象泄漏是由于需要被销毁时，仍然被强引用着，只要强引用存在就无法被回收。

可以用弱引用代替强引用。

[https://developer.android.com/reference/java/lang/ref/WeakReference.html](https://link.jianshu.com?t=https://developer.android.com/reference/java/lang/ref/WeakReference.html).

弱引用不会阻止对象的内存释放，所以即使有弱引用的存在，该对象也可以被回收。

```text
 private static WeakReference<MainActivity> activityReference;

    void setStaticActivity() {
        activityReference = new WeakReference<MainActivity>(this);
    }
```

### 静态 View 引用

静态变量持有View

```text
private static View view;

void setStaticView() {
    view = findViewById(R.id.sv_button);
}
```

由于View持有其宿主Activity的引用，导致的问题与Activity一样严重。弱引用是个有效的解决方法，然而还有另一种方法是在生命周期结束时清除引用，Activity\#onDestory()方法就很适合把引用置空。

```text
private static View view;

@Override
public void onDestroy() {
    super.onDestroy();
    if (view != null) {
        unsetStaticView();
    }
}

void unsetStaticView() {
    view = null;
}
```

### 内部类

这种泄漏

```text
private static Object inner;

void createInnerClass() {
    class InnerClass {
    }
    inner = new InnerClass();
}
```

与上述两种情况相似，开发者必须注意**少用非静态内部类**，因为[非静态内部类](https://link.jianshu.com?t=https://docs.oracle.com/javase/tutorial/java/javaOO/nested.html)持有外部类的隐式引用，容易导致意料之外的泄漏。然而内部类可以访问外部类的私有变量，只要我们注意引用的生命周期，就可以避免意外的发生。

避免静态变量

这样持有内部类的成员变量是可以的。

```text
private Object inner;

void createInnerClass() {
    class InnerClass {
    }
    inner = new InnerClass();
}
```

### 匿名类与异步任务

前面我们看到的都是持有全局生命周期的静态成员变量引起的，直接或间接通过链式引用Activity导致的泄漏。这次我们用AsyncTask

```text
void startAsyncTask() {
    new AsyncTask<Void, Void, Void>() {
        @Override protected Void doInBackground(Void... params) {
            while(true);
        }
    }.execute();
}
```

Handler

```text
void createHandler() {
    new Handler() {
        @Override public void handleMessage(Message message) {
            super.handleMessage(message);
        }
    }.postDelayed(new Runnable() {
        @Override public void run() {
            while(true);
        }
    }, Long.MAX_VALUE >> 1);
}
```

Thread

```text
void scheduleTimer() {
    new Timer().schedule(new TimerTask() {
        @Override
        public void run() {
            while(true);
        }
    }, Long.MAX_VALUE >> 1);
}
```

全部都是因为[匿名类](https://link.jianshu.com?t=https://docs.oracle.com/javase/tutorial/java/javaOO/anonymousclasses.html)导致的。匿名类是特殊的内部类——写法更为简洁。当需要一次性特殊的子类时，Java提供的语法糖能让表达式最少化。这种很赞很偷懒的写法容易导致泄漏。正如使用内部类一样，只要不跨越生命周期，内部类是完全没问题的。但是，这些类是用于产生后台线程的，这些Java线程是全局的，而且持有创建者的引用（即匿名类的引用），而匿名类又持有外部类的引用。线程是可能长时间运行的，所以一直持有Activity的引用导致当销毁时无法回收。

线程 / 任务是否超出宿主生命周期，需要检查持有链、退出条件和取消逻辑；不是所有匿名类都会泄漏，也不是必须一律改为静态类。

静态内部类没有隐式的外部实例引用，但显式字段、捕获的回调和消息 payload 仍可能保留 Activity。

所以对于AsyncTask

```text
private static class NimbleTask extends AsyncTask<Void, Void, Void> {
    @Override protected Void doInBackground(Void... params) {
        while(true);
    }
}

void startAsyncTask() {
    new NimbleTask().execute();
}
```

Handler

```text
private static class NimbleHandler extends Handler {
    @Override public void handleMessage(Message message) {
        super.handleMessage(message);
    }
}

private static class NimbleRunnable implements Runnable {
    @Override public void run() {
        while(true);
    }
}

void createHandler() {
    new NimbleHandler().postDelayed(new NimbleRunnable(), Long.MAX_VALUE >> 1);
}
```

TimerTask

```text
private static class NimbleTimerTask extends TimerTask {
    @Override public void run() {
        while(true);
    }
}

void scheduleTimer() {
    new Timer().schedule(new NimbleTimerTask(), Long.MAX_VALUE >> 1);
}
```

下例只展示协作检查中断标记。调用 interrupt 不保证任意任务立即结束；不响应中断的循环、阻塞或外部库调用还需相应退出机制。

```text
private Thread thread;

@Override
public void onDestroy() {
    super.onDestroy();
    if (thread != null) {
        thread.interrupt();
    }
}

void spawnThread() {
    thread = new Thread() {
        @Override public void run() {
            while (!isInterrupted()) {
            }
        }
    }
    thread.start();
}
```

### SensorManager 监听器

这种泄漏

```text
void registerListener() {
    SensorManager sensorManager = (SensorManager) getSystemService(SENSOR_SERVICE);
    Sensor sensor = sensorManager.getDefaultSensor(Sensor.TYPE_ALL);
    sensorManager.registerListener(this, sensor, SensorManager.SENSOR_DELAY_FASTEST);
}
```

使用Android系统服务不当容易导致泄漏，为了Activity与服务交互，我们把Activity作为监听器，引用链在传递事件和回调中形成了。只要Activity维持注册监听状态，引用就会一直持有，内存就不会被释放。

在Activity结束时注销监听器

```text
private SensorManager sensorManager;
private Sensor sensor;

@Override
public void onDestroy() {
    super.onDestroy();
    if (sensor != null) {
        unregisterListener();
    }
}

void unregisterListener() {
    sensorManager.unregisterListener(this, sensor);
}
```

### 原案例小结

Activity泄漏的案例我们已经都走过一遍了，其他都大同小异。建议日后遇到类似的情况时，就使用相应的解决方法。泄漏诊断应结合可复现操作、持有链、宿主生命周期与修复后的重复检测；不能保证一次检查就覆盖所有路径。

## 补充：内部类与 Handler 引用链

本节与前面的内部类、匿名类、Handler 案例有概念重合，但包含额外的引用链与代码，暂时作为补充集中保留。

### 非静态内部类为何持有外部类的强引用？

**原因**：

实例上下文中的内部类可能保留外部实例，用于访问外部成员；是否形成实际持有链要看声明位置、捕获内容和编译结果，不能从“匿名 / 局部类”名称一概推断。下例访问 mData，展示了明确的外部实例依赖。

**示例代码与引用关系**：

```text
public class MainActivity extends Activity {
    private int mData = 100;
    // 非静态内部类
    private class InnerClass {
        public void printData() {
            // 直接访问外部类成员
            Log.d("TAG", "Data: " + mData); // 等价于 MainActivity.this.mData
        }
    }
}
```

**内存引用链**：

` InnerClass实例 ` → ` MainActivity.this `（强引用） → ` MainActivity实例 `

### Handler 导致内存泄漏的原因与场景

**1. 内存泄漏的本质**

当 Handler 作为非静态内部类使用时，会隐式持有外部 Activity/Fragment 的引用。若 Handler 中有未处理完的消息（如延迟消息），消息队列会持有 Handler 的引用，而 Handler 又持有 Activity，导致 Activity 在销毁后无法被回收。

**2. 典型场景**

```text
public class MainActivity extends Activity {
    // 非静态内部类，持有 MainActivity 的强引用
    private final Handler mHandler = new Handler() {
        @Override
        public void handleMessage(Message msg) {
            // 更新 UI
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 发送延迟消息（10分钟后执行）
        mHandler.sendEmptyMessageDelayed(0, 10 * 60 * 1000);
        // 旋转屏幕（Activity 重建）或退出 Activity
    }
}
```

**内存引用链**：

` MessageQueue ` → ` Message ` → ` Handler ` → ` MainActivity ` → 无法回收

### 匿名内部类的内存泄漏风险

**1. 匿名内部类同样持有外部类引用**

匿名类可能保留外部实例或被捕获对象；若有从长期存活对象到已失效宿主的持有链，就有泄漏风险。静态上下文、捕获内容和编译优化会影响结果，应查看实际持有链。

**2. 典型场景**

```text
public class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 匿名内部类（Runnable）持有 MainActivity 的引用
        new Thread(new Runnable() {
            @Override
            public void run() {
                // 模拟耗时操作（如网络请求）
                try {
                    Thread.sleep(30000); // 30秒
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
            }
        }).start();
        
        // 快速退出 Activity，线程仍在运行
    }
}
```

**内存引用链**：

` Thread ` → ` Runnable `（匿名内部类） → ` MainActivity ` → 无法回收

### 解决方案

**1. 历史 Handler 模式（静态类 + 弱引用，仍需生命周期检查）**

```text
public class MainActivity extends Activity {
    private static class SafeHandler extends Handler {
        private final WeakReference<MainActivity> mActivityRef;
        
        public SafeHandler(MainActivity activity) {
            mActivityRef = new WeakReference<>(activity);
        }
        
        @Override
        public void handleMessage(Message msg) {
            MainActivity activity = mActivityRef.get();
            if (activity != null) {
                // 安全操作 Activity
                activity.updateUI();
            }
        }
    }
    
    private final SafeHandler mHandler = new SafeHandler(this);
    
    @Override
    protected void onDestroy() {
        super.onDestroy();
        // 移除所有未处理的消息
        mHandler.removeCallbacksAndMessages(null);
    }
    
    private void updateUI() {
        // 更新 UI 的方法
    }
}
```

**2. 历史 Runnable 模式（只展示持有关系）**

```text
// 错误写法（直接使用匿名内部类）
new Thread(new Runnable() { ... }).start();

// 正确写法（静态类 + 弱引用）
private static class MyRunnable implements Runnable {
    private final WeakReference<MainActivity> mActivityRef;
    
    public MyRunnable(MainActivity activity) {
        mActivityRef = new WeakReference<>(activity);
    }
    
    @Override
    public void run() {
        MainActivity activity = mActivityRef.get();
        if (activity != null) {
            // 安全操作
        }
    }
}

// 使用静态类
new Thread(new MyRunnable(this)).start();
```

### 按持有链判断风险

| 场景 | 可能的风险 | 核对条件 | 可选处理 |
| --- | --- | --- | --- |
| 实例内部类 | 可能持有宿主 | 是否由长期存活对象保留 | 配对释放 / 限定任务生命周期 |
| Handler / 延迟任务 | 队列可能保留 Handler、回调或 payload | 是否跨越 UI 生命周期 | 取消相关回调并解除宿主持有 |
| 匿名 Runnable | 可能捕获宿主或其他对象 | 实际捕获与任务退出条件 | 取消 / 结束任务，必要时调整引用 |
| 静态内部类 | 仍可能显式持有 Activity | 字段、回调、Message.obj 等 | 检查实际字段与清理协议 |

### 原复述提纲的修订

本篇只保留阅读提纲，没有生成面试题或复习任务：检查 GC Roots → 持有者 → 已失效对象的链路；按生命周期取消工作；为资源明确所有权。静态类、弱引用、移除回调各解决不同问题，不能用“统一静态类 + 弱引用”替代诊断。

## 内存监控：历史描述与版本边界

原笔记提到微信使用斐波那契间隔、最长 30 分钟和 90% 告警阈值，但没有可核对的原始版本与出处。本轮不把这些数字作为通用监控建议，原文保留在归档。

`onLowMemory()` 从 API 34 起不再调用，在 API 35 弃用；`onTrimMemory()` 的若干旧等级从 API 34 起也不再通知，例如 RUNNING_LOW / RUNNING_CRITICAL。不能依赖这些回调保证 OOM 前一定预警。依据：[ComponentCallbacks](https://developer.android.com/reference/android/content/ComponentCallbacks)、[ComponentCallbacks2](https://developer.android.com/reference/android/content/ComponentCallbacks2)。

应区分 Java 堆占用、native 分配、进程总体指标与系统内存压力；不能把“虚拟内存到上限”笼统等同于 Java OOM 条件。监控阈值需要根据目标设备、版本和负载验证。

资源释放也不能只依赖 `onDestroy()`；进程被终止时不保证执行该回调。见 [Activity 生命周期文档](https://developer.android.com/reference/android/app/Activity)。

## LeakCanary：从 retained 对象到持有链

[LeakCanary 官方工作原理](https://square.github.io/leakcanary/fundamentals-how-leakcanary-works/)描述的流程是：观察预期应释放的对象，通过弱引用与延迟 GC 检查筛选 retained 对象；达到阈值时导出堆，使用 Shark 分析持有路径，再归类泄漏。

“延迟后仍未释放”首先是可疑保留对象，不应仅凭某次 ReferenceQueue 中没有条目就断言泄漏。GC 请求不保证即时执行，确认问题还需要检查持有链和期望生命周期。等待时间、阈值及观察对象随 LeakCanary 版本 / 配置而变；本轮未确定原笔记使用版本，也未运行检测器。

原笔记的二次学习链接（本轮未核验）：[LeakCanary 原文引用](https://juejin.cn/post/6936452012058312740)。

## 本轮复核范围与剩余事项

已校正引用可达性、Bitmap 省内存误区、资源关闭、静态类风险、回调版本及 LeakCanary 的判定层次。20 段历史代码保持原貌，未编译、运行或进行泄漏复现；仍需按实际 Android / 图片库 / LeakCanary 版本检查代码与设备指标。文章保持未完整核验。
