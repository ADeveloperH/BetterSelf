---
id: 'sharedpreferences-anr-notes'
title: 'SharedPreferences 引发 ANR 的历史排查记录'
topic: 'Android 开发'
domainId: 'android'
categoryId: 'performance'
noteType: 'troubleshooting'
tags: ['Android', 'SharedPreferences', 'ANR']
summary: '记录 QueuedWork 与组件生命周期的关联，以及当时收集的两种 hook 思路。'
updatedAt: '2020-04-04'
verifiedAt: null
sample: false
applicability: '2020 年历史排查；原记录注明 Android 9.0 行为变化，hook 方案未验证。'
sources: [{ 'kind': 'personal', 'title': '有道云笔记历史记录' }]
---

参考方案：

[https://mp.weixin.qq.com/s/IFgXvPdiEYDs5cDriApkxQ](https://mp.weixin.qq.com/s/IFgXvPdiEYDs5cDriApkxQ)

[https://www.jianshu.com/p/3f64caa567e5?utm\_source=desktop](https://www.jianshu.com/p/3f64caa567e5?utm_source=desktop)

[https://microstudent.github.io/2018/09/10/android-hack1/](https://microstudent.github.io/2018/09/10/android-hack1/)

方案一：hook activitythread 中 clear Queue

ActivityThread 中调用 QueuedWork.waitToFinish(); 已经对应的标识：

handleStopActivity：STOP\_ACTIVITY\_SHOW: STOP\_ACTIVITY\_HIDE:

handleSleeping：SLEEPING:

handleServiceArgs：SERVICE\_ARGS:

handleStopService：STOP\_SERVICE:

handlePauseActivity：PAUSE\_ACTIVITY: PAUSE\_ACTIVITY\_FINISHING:

注意：9.0 开始部分部分 code 已经没有了，可以查看源码确认

方案二：

参考猎豹和最新的今日头条的方案：

直接替换 QueuedWork 中的 sPendingWorkFinishers，进入队列直接移除或者 poll() 直接返回 null
