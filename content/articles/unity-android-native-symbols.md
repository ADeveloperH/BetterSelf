---
id: 'unity-android-native-symbols'
title: 'Unity Android 原生崩溃符号与发布归档'
topic: 'Unity 开发'
domainId: 'unity'
categoryId: 'performance'
noteType: 'guide'
tags: ['Unity', 'Android', 'IL2CPP', 'Native Crash', 'Symbols', 'Crashlytics']
summary: '分别说明 Unity 2022 与 Unity 6 的符号生成入口、Public / Debugging 与输出方式，以及上传、验证、风险和版本归档。'
updatedAt: '2026-10-27'
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
  - kind: external
    title: 'Unity 2022.3：Android 符号与 Create symbols.zip'
    url: 'https://docs.unity3d.com/2022.3/Documentation/Manual/android-symbols.html'
  - kind: external
    title: 'Unity 6：Android 构建设置与符号输出选项'
    url: 'https://docs.unity3d.com/6000.0/Documentation/Manual/android-build-settings.html'
---

> 原生崩溃中的程序计数器和内存地址只有与同一次构建的二进制和符号匹配，才能还原为可读函数名。重新构建一个“相同版本”不能保证地址一致，因此符号必须跟随每次发布归档。

## 先区分两条符号链

| 崩溃来源                    | 典型文件             | 用途                                        |
| --------------------------- | -------------------- | ------------------------------------------- |
| Java / Kotlin 的 R8 混淆    | `mapping.txt`        | 把混淆后的类和方法名 retrace 回源码名       |
| C / C++、Unity 引擎、IL2CPP | native debug symbols | 把 `.so` 地址符号化为函数、文件和可能的行号 |

`mapping.txt` 不能解析 `libil2cpp.so` 地址，native symbols 也不能还原 R8 名称。启用 R8 混淆时归档 mapping，存在原生库时归档对应符号；未启用混淆的包不一定生成 mapping。

## 本次取值与验证边界

原笔记没有完整的旧配置截图、发布包和符号化结果。本篇补充操作方案，未修改业务工程、上传符号或触发业务崩溃。建议先用 `Public` 跑通发布符号流程，需要更多调试信息时评估 `Debugging`；这不是已在原项目执行过的“Disabled → Public”记录。

## 配置一：确认 Android 后端与 ABI

打开 `Edit > Project Settings > Player > Android > Other Settings > Configuration`，记录 `Scripting Backend` 和 `Target Architectures`。本篇 Firebase 上传流程主要针对 Android IL2CPP；保留项目实际发布后端和 ABI，不要为了生成符号临时切换后端，也不要只给 ARM64 归档却用它解析 ARMv7 报告。

后端决定脚本的运行实现，ABI 决定 native 二进制架构。修改它们可能改变插件兼容、构建时间、包体与设备覆盖，符号设置本身不要求进行这些修改。

## 配置二：在 Editor 中生成符号

### Unity 2022.3

1. 打开 `File > Build Settings`，选择并切换到 `Android`。
2. 找到 `Create symbols.zip`，从 `Disabled` 按需求改成 `Public` 或 `Debugging`；已有值先记录，不假定所有项目默认都是 Disabled。
3. 按正常发布配置构建，并在输出目录查找与这次包对应的符号 ZIP。自动化字段为 `EditorUserBuildSettings.androidCreateSymbols`。

入口依据：[Unity 2022.3：Android 符号](https://docs.unity3d.com/2022.3/Documentation/Manual/android-symbols.html)。

### Unity 6（6000.0 当前文档）

1. 打开 `File > Build Profiles`，选择当前激活的 Android 构建配置，在平台设置中找到 `Debug Symbols`。
2. 选择 `Public` 或 `Debugging`，并确认构建脚本没有将其覆盖回 `Disabled`。
3. 设置 `Symbols output options`：需要独立归档 / 交给 Firebase CLI 时选 `.zip`；希望同时在 AAB 中携带符号时选 `.zip + App Bundle`；只选 `App Bundle` 时不能假定另有独立 ZIP。

具体选项可见性受 AAB / APK 和 Editor patch 影响；早期 Unity 6 界面可能仍使用旧标签，应切换到安装版本对应的文档。当前 API 对应 `UnityEditor.Android.UserBuildSettings.DebugSymbols.level` 与 `.format`，旧 API 不应直接当作所有 Unity 6 版本的统一接口。依据：[Unity 6 Android 符号](https://docs.unity3d.com/6000.0/Documentation/Manual/android-symbols.html)、[Android 构建选项](https://docs.unity3d.com/6000.0/Documentation/Manual/android-build-settings.html)。

### 作用、代价与误区

`Public` 主要提供函数符号；`Debugging` 在可用时增加调试信息，有助于定位文件与行号。它不会补回第三方厂商已从 `.so` 中裁掉的调试信息；Unity 的 `libmain`、`libunity` 也不能因此获得完整引擎源码行号。第三方库需要向提供方取得同一次构建的符号。

调试信息会增加符号制品体积、处理时间、归档空间和上传成本；`Public` 是否足够应由实际堆栈验证，不能保证每层都有行号。符号是配套诊断制品，不等于把全部调试信息放入安装的 `.so`，也不需要为了生成发布符号而打开 `Development Build`。

## Unity 会生成哪些符号

Unity 文档列出 `libmain`、`libunity` 和 `libil2cpp` 等库的符号。根据构建方式，符号可以：

- 生成供 APK 或 AAB 使用的 zip。
- 直接嵌入 AAB；Unity 不会把符号嵌入 APK。
- 在导出的 Gradle 工程中出现在 `unityLibrary/symbols`；`libil2cpp` 符号可能要等实际 Gradle 构建完成后才生成，不能只看 Unity 导出结束时的空目录。

公共符号体积较小，包含符号表；调试符号包含更多调试信息。选择时要在可诊断程度、制品大小和上传限制之间权衡。无论选择哪种，都不应把未裁剪的发布符号放到公开下载目录。

## Google Play 流程

上传 AAB 时，可按 Unity 和 Play Console 当前支持的方式嵌入或单独上传 native symbols。发布前同时保存：

```text
release/<version-code>/
├── app.aab
├── mapping.txt          # 启用 R8 混淆时
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

**参数去哪里找：** 在 Firebase 项目设置的 `General > Your apps` 选择对应 Android 应用获取 App ID，也可核对项目 `google-services.json` 中的 `mobilesdk_app_id`。不要误用 Firebase Project ID 或 Android 包名。

`SYMBOL_PATH` 使用这次构建的符号位置：Unity 直接生成 APK 时可用配套 ZIP；导出工作流则在实际 Gradle 构建后检查 `unityLibrary/symbols`。AAB 工作流若选择独立 ZIP，应确认其中确实包含匹配的 native 符号，并核对 CLI 支持的输入格式，不把 AAB 文件直接充当符号目录。

正式上传前可以针对这份归档执行：

```sh
firebase crashlytics:symbols:upload \
  --app="$FIREBASE_APP_ID" \
  --dry-run \
  "$SYMBOL_PATH"
```

`--dry-run` 只在本地生成 / 处理符号，不执行上传；通过它也不能证明 Crashlytics 已收到符号。确认构建匹配、App ID 和输入格式后，再在有权限的发布流程中运行正式上传命令。命令行为依据：[Firebase Unity Crashlytics 官方流程](https://firebase.google.com/docs/crashlytics/unity/get-started)。本轮没有执行这两条命令。

## 怎么验证开关确实生效

1. 使用正常 Release 配置构建，记录 Editor 版本、脚本后端、ABI、version code、符号级别与输出方式。
2. 检查 ZIP / AAB 或构建完成的符号目录；按 ABI 核对实际发布库，特别是 IL2CPP 的 `libil2cpp`。保留文件哈希与 Build ID，而不是只确认“目录里有 ZIP”。
3. 上传到正确应用和发布版本，检查平台处理状态及缺失符号提示。上传成功不代表所有第三方库都有符号。
4. 在获准的内部测试环境，用配套二进制的受控 native 测试或已有匹配 native 报告，确认至少能解析预期函数。普通 C# 异常能显示堆栈，只能证明托管异常链路，不足以验证 native 地址解析。

本篇的完成范围是文档核对；上述实际构建、上传和设备验证仍待原项目执行。

## 收到 native crash 后

1. 锁定应用 version code、ABI、设备与 Android 版本。
2. 保存原始 tombstone 或崩溃平台下载的原始报告。
3. 核对报告中的 Build ID 与归档二进制 / 符号是否匹配。
4. 先恢复函数名，再结合线程、信号、fault address 和寄存器判断原因。
5. 对内存破坏问题使用可复现构建、AddressSanitizer 或 GWP-ASan 等工具补证据。

一个已符号化的栈顶不一定是根因。use-after-free 和堆越界可能在更晚的位置崩溃；需要结合分配历史、设备范围和复现条件分析。

## 发布门禁

- release 构建归档 AAB / APK、native symbols，以及启用 R8 混淆时的 mapping。
- 每个制品都有哈希，且按 version code 和构建 ID 索引。
- Google Play、Crashlytics 等目标平台的上传步骤失败会阻止发布。
- 在获准的内部测试中验证匹配 native 堆栈，确认平台能显示可读函数名。
- 制品访问权限和保留期明确；删除应用包前不会先删对应符号。

只有把符号“生成、上传、按版本找回、实际解析”完整跑通，线上 native crash 才能从一串地址变成可定位的问题。

## 如何回退配置

如果新级别带来制品过大或上传格式不兼容，先保留已经发布版本的符号，再将 `Debug Symbols` / `Create symbols.zip` 和输出方式恢复到修改前的值，同时恢复构建脚本，重新构建后验证。仅改回 Editor 而不改 CI，可能仍生成另一种格式。

关闭符号生成只影响后续构建，不能为旧包补出精确匹配的符号；也不能通过重新构建同一 version code 替代原归档。修复上传流程时应重用保存的原符号，不删除旧制品。
