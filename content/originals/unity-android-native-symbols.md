---
id: 'unity-android-native-symbols'
title: 'Native 崩溃分析（原始正文）'
updatedAt: null
captureMethod: 'mcp-text'
---

> MCP 返回纯文本，没有图片或附件引用。下面只整理换行，并保留原记录中的链接文字；部分链接指向旧版文档或已变更页面，当前做法请查看整理稿。

```text
Unity：
https://docs.unity3d.com/cn/2021.3/Manual/android-symbols.html

Firebase：
上传符号表：
https://firebase.google.com/docs/crashlytics/get-started?platform=unity&hl=zh-cn
https://firebase.google.com/docs/crashlytics/ndk-reports?hl=zh-cn
https://www.cnblogs.com/nickcan/p/16840953.html

GWP-ASan：可帮助查找释放后使用和堆缓冲区溢出错误
https://developer.android.com/ndk/guides/gwp-asan?authuser=0&hl=zh-cn#opt-in

Google Play：
https://developer.android.com/games/engines/unity/unity-symbolicate?hl=zh-cn

GP 的上传 app bundle 包自动会去符号化：
https://support.google.com/googleplay/android-developer/answer/9848633?hl=zh-Hans

在 Play 管理中心的符号化解析后的堆栈轨迹中获取函数名称：
https://developer.android.com/studio/build/shrink-code?authuser=0&hl=zh-cn#strip-native-libraries
```
