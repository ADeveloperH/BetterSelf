---
id: 'unity-android-native-symbols'
title: 'Unity Android 原生崩溃符号与发布归档'
topic: 'Unity 开发'
domainId: 'unity'
categoryId: 'performance'
noteType: 'guide'
tags: ['Unity', 'Android', 'IL2CPP', 'Native Crash', 'Symbols', 'Crashlytics']
summary: '区分 Java mapping 与 native symbols，说明 Unity 符号生成、Google Play 和 Firebase Crashlytics 上传，以及按发布版本归档的方法。'
updatedAt: '2026-10-26'
verifiedAt: null
sample: false
applicability: '适用于 Unity Android，尤其是 IL2CPP 构建。控制台入口、符号格式和上传命令可能随 Unity、Google Play 与 Firebase 版本变化；本轮未上传真实发布包验证。'
sources:
  - kind: personal
    title: '有道云笔记：Native 崩溃分析资料索引'
  - kind: external
    title: 'Unity 6：Android 符号'
    url: 'https://docs.unity3d.com/cn/6000.0/Manual/android-symbols.html'
  - kind: external
    title: 'Firebase Crashlytics：Unity 入门与符号上传'
    url: 'https://firebase.google.com/docs/crashlytics/unity/get-started'
  - kind: external
    title: 'Android NDK：GWP-ASan'
    url: 'https://developer.android.com/ndk/guides/gwp-asan'
---

> 原生崩溃中的程序计数器和内存地址只有与同一次构建的二进制和符号匹配，才能还原为可读函数名。重新构建一个“相同版本”不能保证地址一致，因此符号必须跟随每次发布归档。

## 先区分两条符号链

| 崩溃来源                    | 典型文件             | 用途                                        |
| --------------------------- | -------------------- | ------------------------------------------- |
| Java / Kotlin 的 R8 混淆    | `mapping.txt`        | 把混淆后的类和方法名 retrace 回源码名       |
| C / C++、Unity 引擎、IL2CPP | native debug symbols | 把 `.so` 地址符号化为函数、文件和可能的行号 |

`mapping.txt` 不能解析 `libil2cpp.so` 地址，native symbols 也不能还原 R8 名称。一个 Unity Android 发布通常要同时保存两套材料。

## Unity 会生成哪些符号

Unity 文档列出 `libmain`、`libunity` 和 `libil2cpp` 等库的符号。根据构建方式，符号可以：

- 生成供 APK 或 AAB 使用的 zip。
- 直接嵌入 AAB；Unity 不会把符号嵌入 APK。
- 在导出的 Gradle 工程中出现在 `unityLibrary/symbols`。

公共符号体积较小，包含符号表；调试符号包含更多调试信息。选择时要在可诊断程度、制品大小和上传限制之间权衡。无论选择哪种，都不应把未裁剪的发布符号放到公开下载目录。

## Google Play 流程

上传 AAB 时，可按 Unity 和 Play Console 当前支持的方式嵌入或单独上传 native symbols。发布前同时保存：

```text
release/<version-code>/
├── app.aab
├── mapping.txt
├── native-symbols.zip
├── build-metadata.json
└── checksums.txt
```

`build-metadata.json` 至少记录 Git 提交、Unity 版本、脚本后端、ABI、应用 version code、构建任务和时间。收到 Android Vitals 崩溃后，先按 version code 与 ABI 找对应制品，再确认控制台是否已经完成符号化。

## Firebase Crashlytics 的 IL2CPP 要求

Firebase 当前文档说明，Android 使用 IL2CPP 时，需要 Firebase CLI 上传符号，才能在 Crashlytics 看到 native library 的符号化堆栈；Mono 后端不需要这一步。每个希望查看符号化堆栈的发布构建都要执行上传。

命令结构为：

```sh
firebase crashlytics:symbols:upload \
  --app="$FIREBASE_APP_ID" \
  "$SYMBOL_PATH"
```

`FIREBASE_APP_ID` 是 Firebase Android App ID，不是 Android package name。它和上传凭据应由 CI secret 注入；命令日志不应回显 token。上传成功记录需要与构建号一起保存，避免“流水线成功”但符号步骤实际跳过。

## 收到 native crash 后

1. 锁定应用 version code、ABI、设备与 Android 版本。
2. 保存原始 tombstone 或崩溃平台下载的原始报告。
3. 核对报告中的 Build ID 与归档二进制 / 符号是否匹配。
4. 先恢复函数名，再结合线程、信号、fault address 和寄存器判断原因。
5. 对内存破坏问题使用可复现构建、AddressSanitizer 或 GWP-ASan 等工具补证据。

一个已符号化的栈顶不一定是根因。use-after-free 和堆越界可能在更晚的位置崩溃；需要结合分配历史、设备范围和复现条件分析。

## 发布门禁

- release 构建同时生成 AAB / APK、R8 mapping 和 native symbols。
- 每个制品都有哈希，且按 version code 和构建 ID 索引。
- Google Play、Crashlytics 等目标平台的上传步骤失败会阻止发布。
- 用内部测试包制造一次受控 native crash，确认平台能显示可读函数名。
- 制品访问权限和保留期明确；删除应用包前不会先删对应符号。

只有把符号“生成、上传、按版本找回、实际解析”完整跑通，线上 native crash 才能从一串地址变成可定位的问题。
