---
id: 'android-memory-notes'
title: 'Android 内存优化：引用、泄漏与监控'
topic: 'Android 开发'
domainId: 'android'
categoryId: 'performance'
noteType: 'concept'
tags: ['Android', '内存优化', '内存泄漏', 'Handler']
summary: '汇集引用类型、OOM、泄漏与抖动、生命周期示例、内存监控及 LeakCanary 原理摘记。'
updatedAt: '2025-07-10'
verifiedAt: null
sample: false
applicability: '2025 年历史笔记；含旧 API 和概括性结论，需按目标 Android 与工具版本复核。'
sources: [{ 'kind': 'personal', 'title': '有道云笔记历史记录' }]
---

## 引用定义

### 强引用（StrongReference）

**特性**：

- 最常见的引用类型，如 `Object obj = new Object()`
- 只要强引用存在，对象就不会被 GC 回收
- 只有当强引用被显式置为 `null` 或超出作用域时，对象才可能被回收

### 软引用（SoftReference）

**特性**：

- 用 `SoftReference<T>` 类包装，如 `SoftReference<Bitmap> softBitmap = new SoftReference<>(bitmap)`
- **内存充足时**：对象不会被回收，可通过 `softBitmap.get()` 获取
- **内存不足时**：系统会优先回收软引用关联的对象，作为 GC 的 “最后防线”
- 适合缓存场景，避免内存溢出（OOM）

### 弱引用（WeakReference）

**特性**：

- 用 `WeakReference<T>` 类包装，如 `WeakReference<Activity> weakActivity = new WeakReference<>(activity)`
- **只要发生 GC**：无论内存是否充足，弱引用关联的对象都会被回收（前提是没有其他强引用）
- 回收后 `weakActivity.get()` 返回 `null`，需检查空值

### 虚引用（PhantomReference）

**特性**：

- 用 `PhantomReference<T>` 类包装，必须配合 `ReferenceQueue` 使用
- **完全不影响 GC**：对象该回收时就会被回收，`get()` 方法永远返回 `null`
- 主要用于追踪对象的回收时机，在对象被 GC 前执行特定操作（如释放非内存资源）

详细讲解：

[https://www.cnblogs.com/throwable/p/12271653.html\#phantomreference](https://www.cnblogs.com/throwable/p/12271653.html#phantomreference)

## 内存溢出（OOM）

- **大图片 / 大资源加载**：直接加载高分辨率图片（未压缩），Bitmap 占用内存过大（如 `BitmapFactory.decodeResource` 不设置 `inSampleSize`）。
- **内存泄漏累积**：长期运行中，内存泄漏的对象越来越多，耗尽可用内存（如反复打开 / 关闭 Activity 导致泄漏累积）。
- **大量数据缓存**：无限制缓存数据（如 List 存储过多数据、未设置缓存上限的 LruCache）。
- **第三方库滥用**：某些 SDK 或库内部存在内存管理问题，频繁创建大对象且未释放。

### 解决方案：

- **优化大资源加载**：
  - 图片压缩：使用 `BitmapFactory.Options` 设置 `inSampleSize`（缩放比例）、`inPreferredConfig`（如 `ARGB_4444` 替代 `ARGB_8888` 减少内存）。
  - 按需加载：列表图片使用 “缩略图 + 高清图” 懒加载（如 Glide/Picasso 自动处理）。
- **控制内存泄漏**：彻底解决内存泄漏问题（见下文 “内存泄漏解决方案”），避免可用内存被侵占。
- **合理使用缓存**：
  - 图片缓存：使用 LruCache 限制内存缓存大小（如 `new LruCache<>(maxSize)`，`maxSize` 设为可用内存的 1/8）。
  - 数据缓存：避免无限制存储大集合，及时清理过期数据。
- **内存优化工具**：启用 `android:largeHeap="true"`（谨慎使用，仅临时缓解，优先优化代码）。

## 内存泄漏（Memory Leak）

- **静态引用持有 Activity**：`static Activity sActivity` 在 Activity 销毁后未置空，导致 Activity 及内部 View 等资源无法回收。
- **非静态内部类持有外部引用**：如 Handler 作为非静态内部类，持有 Activity 引用，若消息队列有未处理消息，Activity 销毁后仍被 Handler 引用。
- **资源未关闭**：`Cursor`、`FileInputStream`、`Bitmap` 等资源未调用 `close()`，导致系统资源无法释放（部分资源关联内存对象）。
- **单例持有 Context**：单例模式中持有 Activity Context（而非 Application Context），Activity 销毁后单例仍存活，导致 Activity 无法回收。
- **集合未清理**：全局集合（如 `static List`）添加对象后未移除，对象生命周期结束后仍被集合引用。

### 解决方案：

- **避免静态持有 Activity/Fragment**：
  - 禁止 `static Activity mActivity`，若需持有上下文，使用 `Application Context`（如 `getApplicationContext()`）。
  - 必须持有时，用 **弱引用（WeakReference）** 包装（如 `new WeakReference<>(activity)`）。
- **优化内部类**：
  - 非静态内部类（如 Handler、Thread）改为 **静态内部类 + 弱引用**（避免持有外部 Activity 引用）。
- **及时释放资源**：
  - 流（Stream）、Cursor、Bitmap 等资源在 `onDestroy` 中调用 `close()` 或 `recycle()`（如 `bitmap.recycle()`）。
  - 注销监听器（如 `SensorManager.unregisterListener()`、`BroadcastReceiver.unregisterReceiver()`）。
- **单例模式优化**：单例中若需 Context，使用 `Application Context` 而非 Activity Context。

## 内存抖动（Memory Churn）

- **循环 / 频繁回调中创建对象**：如 `for` 循环中创建 `new Object()`、`onDraw()` 中创建 `Paint`/`Rect` 等对象（每帧调用，短时间创建大量对象）。
- **字符串频繁拼接**：使用 `+` 拼接字符串（每次拼接创建新 String 对象），而非 `StringBuilder`。
- **高频事件回调**：如 `onTouchEvent`、`SensorEventListener` 中创建临时对象（触发频率高，累积大量短期对象）。

### 解决方案：

- **避免高频创建对象**：
  - 循环 / 回调中（如 `onDraw()`、`onScroll()`）的临时对象（如 `new Rect()`）移至外部声明，复用对象。
  - 使用 **对象池（Object Pool）** 缓存频繁创建的对象（如列表项 ViewHolder 复用）。
- **优化字符串操作**：频繁拼接字符串时，用 `StringBuilder` 替代 `+`（`+` 会创建多个临时 String 对象）。
- **减少短生命周期对象**：避免在高频方法（如 `getView()`）中创建匿名类、集合等，提前初始化并复用。

## 常见内存泄露案例

#### Static Actitivities

这种泄漏

```text
private static MainActivity activity;

void setStaticActivity() {
    activity = this;
}
```

构造静态变量持有Activity对象很容易造成内存泄漏，因为静态变量是全局存在的，所以当MainActivity生命周期结束时，引用仍被持有。这种写法开发者是有理由来使用的，所以我们需要正确的释放引用让垃圾回收机制在它被销毁的同时将其回收。

Android提供了特殊的Set集合[https://developer.android.com/reference/java/lang/ref/package-summary.html\#classes](https://link.jianshu.com?t=https://developer.android.com/reference/java/lang/ref/package-summary.html#classes)

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

#### Static Views

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

#### Inner Class

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

#### Anonymous Classes

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

这次我们不能通过移除静态成员变量解决，因为线程是于应用生命周期相关的。为了避免泄漏，我们必须舍弃简洁偷懒的写法，把子类声明为静态内部类。

静态内部类不持有外部类的引用，打破了链式引用。

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

但是，如果你坚持使用匿名类，只要在生命周期结束时中断线程就可以。

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

#### Sensor Manager

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

#### 总结

Activity泄漏的案例我们已经都走过一遍了，其他都大同小异。建议日后遇到类似的情况时，就使用相应的解决方法。内存泄漏只要发生过一次，通过详细的检查，很容易解决并防范于未然。

## 内存监控

- 常规内存监控 —— 微信使用过程中，内存监控模块会根据斐波那契数列的特性，每隔一段时间（最长30分钟）获取内存的使用情况，从而获得微信随使用时间而变化的内存曲线。
- 低内存监控 —— 通过 **onLowMemory** 的回调，或者通过 **onTrimMemory** 回调且不同的标记位，结合 ActivityManager.MemoryInfo 的 lowMemory 标记，我们可以获得低内存的发生时机。这里需要注意，只有物理内存不足时，才会引起 onLowMemory 回调。超过虚拟内存的大小限制则直接触发 OOM 异常。因此我们也监听虚拟内存的占用情况，当虚拟内存占用超过最大限制的 90% 时，触发为低内存告警。低内存监控将监控低内存的发生频率、发生时各项内存使用情况监控、发生时微信的当前场景等。

## Android 中非静态内部类、Handler 与匿名内部类的内存泄漏问题

### 非静态内部类为何持有外部类的强引用？

**原因**：

Java 语言设计中，非静态内部类（包括普通内部类、匿名内部类、局部内部类）会隐式持有外部类的引用。这是为了让内部类能够直接访问外部类的成员（如字段、方法）。编译器会在内部类中添加一个隐藏的引用字段，指向外部类实例。

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

`InnerClass实例` → `MainActivity.this`（强引用） → `MainActivity实例`

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

`MessageQueue` → `Message` → `Handler` → `MainActivity` → 无法回收

### 匿名内部类的内存泄漏风险

**1. 匿名内部类同样持有外部类引用**

匿名内部类（如 `new Runnable()`、`new OnClickListener()`）属于非静态内部类，也会持有外部类的强引用。若生命周期超过外部类，会导致泄漏。

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

`Thread` → `Runnable`（匿名内部类） → `MainActivity` → 无法回收

### 解决方案

**1. Handler 的安全实现（静态内部类 + 弱引用）**

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

**2. 匿名内部类的安全实现**

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

### 总结

| **场景**                  | **内存泄漏风险**       | **原因**                                    | **解决方案**                           |
| ------------------------- | ---------------------- | ------------------------------------------- | -------------------------------------- |
| 非静态内部类              | 高风险                 | 隐式持有外部类强引用                        | 改为静态内部类 + 弱引用                |
| Handler 作为非静态类      | 高风险                 | 消息队列持有 Handler，Handler 持有 Activity | 静态 Handler + 弱引用 + 销毁时移除消息 |
| 匿名内部类（如 Runnable） | 高风险（若生命周期长） | 持有外部类强引用                            | 静态类 + 弱引用                        |
| 静态内部类                | 无风险                 | 不持有外部类引用                            | 无需特殊处理                           |

### 面试应答要点

1. **非静态内部类的本质**：Java 编译器通过 `OuterClass.this` 实现内部类对外部类成员的访问，导致强引用。
2. **Handler 泄漏的核心**：消息队列 → Handler → Activity 的引用链，需在 Activity 销毁时移除未处理消息。
3. **匿名内部类的风险**：生命周期超过外部类时（如异步任务），必须使用静态类 + 弱引用。
4. **解决方案**：统一采用 “静态类 + 弱引用” 模式，辅以资源释放（如 `onDestroy()` 中取消任务）。

通过理解引用链和生命周期管理，可有效避免 Android 中的内存泄漏问题。

## LeakCanary 原理

当一个Activity的onDestory方法被执行后，说明该Activity的生命周期已经走完，在下次GC发生时，该Activity对象应将被回收。

- 通过上面对引用的学习，可以考虑在onDestory发生时创建一个弱引用指R向Activity，并关联一个RefrenceQuence,当Activity被正常回收，弱引用实例本身应该出现在该RefrenceQuence中，否则便可以判断该Activity存在内存泄漏。
- 通过Application.registerActivityLifecycleCallbacks()方法可以注册Activity生命周期的监听，每当一个Activity调用onDestroy进行页面销毁时，去获取到这个Activity的弱引用并关联一个ReferenceQuence，通过检测ReferenceQuence中是否存在该弱引用判断这个Activity对象是否正常回收。
- 当onDestory被调用后，初步观察到Activity未被GC正常回收时，手动触发一次GC，由于**手动发起GC请求后并不会立即执行垃圾回收**，所以需要在一定时延后再二次确认Activity是否已经回收，如果再次判断Activity对象未被回收，则表示Activity存在内存泄漏。

[https://juejin.cn/post/6936452012058312740](https://juejin.cn/post/6936452012058312740)
