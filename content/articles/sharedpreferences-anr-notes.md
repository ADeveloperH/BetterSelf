---
id: "sharedpreferences-anr-notes"
title: "Android：SharedPreferences 与 ANR 排查摘记（历史）"
topic: "Android 开发"
domainId: "android"
categoryId: "performance"
noteType: "troubleshooting"
tags: ["Android", "SharedPreferences", "ANR"]
summary: "按 Android 7.1.2、8.0、9.0 固定源码核对 QueuedWork 等待链，保留未验证的历史 hook 思路。"
updatedAt: "2020-04-04"
verifiedAt: null
sample: false
applicability: "固定 AOSP tag 对照与 API 文档复核；未复现原 ANR、厂商实现或 hook 效果。"
sources: [{"kind": "personal", "title": "有道云笔记历史记录"}, {"kind": "external", "title": "Android：SharedPreferences.Editor", "url": "https://developer.android.com/reference/android/content/SharedPreferences.Editor"}, {"kind": "external", "title": "AOSP：QueuedWork 7.1.2_r39", "url": "https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/android-7.1.2_r39/core/java/android/app/QueuedWork.java"}, {"kind": "external", "title": "AOSP：QueuedWork 8.0.0_r1", "url": "https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/android-8.0.0_r1/core/java/android/app/QueuedWork.java"}, {"kind": "external", "title": "AOSP：QueuedWork 9.0.0_r1", "url": "https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/android-9.0.0_r1/core/java/android/app/QueuedWork.java"}, {"kind": "external", "title": "AOSP：ActivityThread 9.0.0_r1", "url": "https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/android-9.0.0_r1/core/java/android/app/ActivityThread.java"}, {"kind": "external", "title": "AOSP：SharedPreferencesImpl 8.0.0_r1", "url": "https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/android-8.0.0_r1/core/java/android/app/SharedPreferencesImpl.java"}]
---

> 2020 年历史排查摘记；2026-10-22 仅按官方文档与三个固定 AOSP tag 复核。没有原 ANR 堆栈、设备实验或数据完整性结果，两种 hook 思路仍未验证。

## 为什么 apply 仍可能与 ANR 有关

`apply()` 先更新内存，再安排异步磁盘写入，不返回磁盘写入是否成功。异步写不代表应用主线程永远不会等待：框架在部分生命周期转换处等待未完成写入，可能间接造成主线程阻塞和 ANR。`commit()` 则同步写入；不能把主线程上的 `apply()` 一律改为 `commit()` 当作修复。见 [SharedPreferences.Editor 官方 API](https://developer.android.com/reference/android/content/SharedPreferences.Editor)。

在下列 Android 8 固定源码中，`apply()` 注册的 finisher 会等待 `writtenToDiskLatch`；磁盘写入结束后才解除等待。生命周期路径调用 `QueuedWork.waitToFinish()`，由此可以形成“主线程 → QueuedWork → 未完成磁盘写”的等待链。是否正是某次 ANR 的原因，仍需结合实际堆栈确认。见 [SharedPreferencesImpl：android-8.0.0_r1](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/android-8.0.0_r1/core/java/android/app/SharedPreferencesImpl.java)。

## 版本差异：不能只看旧消息常量

| 固定源码版本 | 队列与等待实现 | 阅读边界 |
| --- | --- | --- |
| `android-7.1.2_r39` | `sPendingWorkFinishers` 为 ConcurrentLinkedQueue；waitToFinish 轮询并执行 finisher | 对应原笔记的旧字段名 |
| `android-8.0.0_r1` | 改为 `sFinishers`、`sWork`；waitToFinish 先调用 `processPendingWork()`，再执行 finishers | 结构变化在 Android 8 已存在 |
| `android-9.0.0_r1` | 仍有上述工作 / finisher 处理及多处生命周期等待 | 旧 H 消息调度变化不等于等待消失 |

源码：[QueuedWork 7.1.2](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/android-7.1.2_r39/core/java/android/app/QueuedWork.java)、[QueuedWork 8.0](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/android-8.0.0_r1/core/java/android/app/QueuedWork.java)、[QueuedWork 9.0](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/android-9.0.0_r1/core/java/android/app/QueuedWork.java)。这些是固定 tag 的比较，不涵盖所有系统和厂商实现。

原笔记列出了五条 ActivityThread 线索。以 [ActivityThread：android-9.0.0_r1](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/android-9.0.0_r1/core/java/android/app/ActivityThread.java) 为例，它们仍包含 waitToFinish，但需要带上条件阅读：

| 路径 | 此版本中的条件 | 原记录的旧 H 标识 |
| --- | --- | --- |
| handleStopActivity | `!r.isPreHoneycomb()` | STOP_ACTIVITY_SHOW / STOP_ACTIVITY_HIDE |
| handleSleeping | `!r.isPreHoneycomb()` | SLEEPING |
| handleServiceArgs | 服务参数处理路径 | SERVICE_ARGS |
| handleStopService | 停止服务处理路径 | STOP_SERVICE |
| handlePauseActivity | `r.isPreHoneycomb()` | PAUSE_ACTIVITY / PAUSE_ACTIVITY_FINISHING |

`isPreHoneycomb()` 判断应用的 `targetSdkVersion < HONEYCOMB`（API 11），不是判断设备是否低于某个 Android 版本。Android 9 移除了部分旧 pause / stop 消息常量并引入 `EXECUTE_TRANSACTION` 调度，但 `SLEEPING` 仍存在；不能将旧常量表直接当作 Android 9 的完整调度表。

## 原 hook 思路及其限制

### 思路一：干预生命周期等待

原笔记尝试围绕上述 ActivityThread 路径收集 hook 点，但没有记录具体实现、执行记录或效果。绕开等待并不会完成磁盘写入，也不证明 ANR 根因消失；会改变框架原有的写入完成等待约定，必须另查数据完整性与进程退出场景。

### 思路二：替换 sPendingWorkFinishers

原记录参考猎豹和当时今日头条的方案，提出替换 QueuedWork 的 `sPendingWorkFinishers`、移除队列元素，或令 `poll()` 返回 null。具体版本未记录，归档原文保留；此处仅作历史思路说明。

这一字段名不能直接套用 Android 8 以后的上述源码。即使绕开 `sFinishers`，也不覆盖 `processPendingWork()` 的处理。没有实测证据支持将其当作生产修复，也不能直接断言每次都必然丢数据。涉及内部实现的 hook 还需逐版本验证。

## 下一次排查需要的证据

- 保存原 ANR traces，核对主线程是否确实阻塞在 QueuedWork / latch / 磁盘写入链上。
- 记录设备系统、厂商版本、应用 targetSdk、SP 文件大小、写入频率与调用位置。
- 对齐生命周期切换与写入时序，定位密集写入或慢磁盘；不要仅凭出现 apply 就定因。
- 若调整写入策略，比较 ANR、写入耗时和完整性，覆盖退出、重启及并发更新场景。

## 原始参考链接

以下三条是原笔记的二次资料，本轮未逐条复核，不作为上面版本结论的依据。

[https://mp.weixin.qq.com/s/IFgXvPdiEYDs5cDriApkxQ](https://mp.weixin.qq.com/s/IFgXvPdiEYDs5cDriApkxQ)

[https://www.jianshu.com/p/3f64caa567e5?utm\_source=desktop](https://www.jianshu.com/p/3f64caa567e5?utm_source=desktop)

[https://microstudent.github.io/2018/09/10/android-hack1/](https://microstudent.github.io/2018/09/10/android-hack1/)
