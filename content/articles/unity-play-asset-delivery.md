---
id: 'unity-play-asset-delivery'
title: 'Unity Play Asset Delivery 配置与模板升级'
topic: 'Unity 开发'
domainId: 'unity'
categoryId: 'build'
noteType: 'guide'
tags: ['Unity', 'Android', 'AAB', 'Play Asset Delivery', 'Gradle']
summary: '按 Editor 路径启用 AAB 与 Split Application Binary，说明自定义模板升级、交付方式、离线风险、验证和回退。'
updatedAt: '2026-10-27'
verifiedAt: null
sample: false
applicability: '面向通过 Google Play 发布 AAB 的 Unity Android 项目。不同 Unity 版本和 Google Play 限制会变化，配置时应切换到项目实际使用的 Unity 文档版本。'
sources:
  - kind: personal
    title: '有道云笔记：PAD 打包'
  - kind: external
    title: 'Unity 6：设置 Play 资源交付'
    url: 'https://docs.unity3d.com/cn/6000.0/Manual/android-asset-packs-set-up.html'
  - kind: external
    title: 'Android Developers：Play Asset Delivery'
    url: 'https://developer.android.com/guide/playcore/asset-delivery'
  - kind: external
    title: 'Unity 6：Android 构建设置'
    url: 'https://docs.unity3d.com/6000.0/Documentation/Manual/android-build-settings.html'
  - kind: external
    title: 'Unity 6：分离应用程序二进制文件'
    url: 'https://docs.unity3d.com/6000.0/Documentation/Manual/android-optimize-distribution-size.html'
  - kind: external
    title: 'Unity 6：资源包生成与交付限制'
    url: 'https://docs.unity3d.com/6000.0/Documentation/Manual/android-asset-packs-in-unity.html'
  - kind: external
    title: 'Unity 6：Gradle 模板变量'
    url: 'https://docs.unity3d.com/6000.0/Documentation/Manual/android-gradle-template-variables.html'
---

> Play Asset Delivery（PAD）是 Google Play 对 AAB 中大型游戏资源的交付方案。它解决的是安装包模块与资源交付，不等同于 Addressables 的任意服务器远程内容更新。

## 本次取值与验证边界

原笔记未保留原项目所有开关的初始值和 Play 测试记录。本篇给出“使用 Google Play AAB + PAD”的目标配置：AAB 开启、Split Application Binary 开启；没有实际修改 Unity 工程，也未上传业务包验证。文档入口核对范围是 Unity 2022.3 与 6000.0，界面名称应以项目具体 patch 为准。

## 配置一：选择 Android 与 AAB

**Editor 中怎么改：**

1. Unity 2022.3 打开 `File > Build Settings`，选 `Android`，尚未激活时点击 `Switch Platform`。Unity 6 打开 `File > Build Profiles`，选择并激活 Android 平台 / 对应构建配置。
2. 如果直接由 Unity 生成安装制品，关闭 `Export Project`，开启 `Build App Bundle (Google Play)`，目标产物为 `.aab`。
3. 如果需要导出后交给 Android Studio / CI 打包，开启 `Export Project`；Unity 6 对应选项为 `Export for App Bundle`。导出 Gradle 工程后仍需执行实际 bundle 构建任务，导出成功不等于生成 AAB。

**作用与副作用：** AAB 是供 Play 生成设备安装包的发布格式，不能像单个 APK 一样直接点开安装。它也不会自动把全部资源改为按需下载。对应自动化字段为 `EditorUserBuildSettings.buildAppBundle`，构建脚本可能覆盖手动选择；在日志中记录最终值。入口依据：[Unity Android 构建设置](https://docs.unity3d.com/6000.0/Documentation/Manual/android-build-settings.html)。

## 配置二：开启 Split Application Binary

**Editor 中怎么改：** 打开 `Edit > Project Settings > Player > Android > Publishing Settings`，开启 `Split Application Binary`。若字段不可用，先检查当前平台、AAB / 导出方式以及该 Editor 是否支持 PAD，不要直接修改序列化文件强行绕过界面限制。

**作用与边界：** 在 AAB 模式下，这个开关将内容拆为基础模块与资源包；在 APK 模式下，它对应 APK + OBB 的拆分，不能把后者称为 PAD。它也不是 `Split APKs by target architecture` 的 ABI 分包功能。依据：[Unity：分离应用程序二进制文件](https://docs.unity3d.com/6000.0/Documentation/Manual/android-optimize-distribution-size.html)。

脚本字段 `PlayerSettings.Android.useAPKExpansionFiles` 对应此开关。目标值为 `true`，原项目旧值未知；CI 应同时记录它和 AAB 字段，防止只改 GUI 后被脚本覆盖。

**可能的问题：** 资源位置、安装与下载时机发生变化；离线首启、读取 StreamingAssets 的路径和加载代码都要回归。构建没有报错也可能超出 Play 限制，必须检查实际包结构和测试轨道结果。

构建后，AAB 至少包含基础模块，并根据项目资源形成 asset pack 模块。asset pack 不包含可执行代码；需要运行时代码更新时，仍要使用应用版本发布或合规的代码方案。

## 选择交付模式

PAD 的资源包可采用三种交付方式：

| 模式         | 何时可用           | 适合内容                             |
| ------------ | ------------------ | ------------------------------------ |
| install-time | 随应用安装         | 首次启动必须使用的核心资源           |
| fast-follow  | 安装后自动继续下载 | 很快会使用、但不必阻塞首次安装的资源 |
| on-demand    | 应用运行时请求     | 关卡包、语言包等可延后内容           |

Unity 自动生成的资源拆分与自定义 asset pack 能力不同。**没有一个全局 Editor 下拉框能将所有自动资源包改为 on-demand。** 当前 6000.0 文档中，自动包由引擎按资源情况生成，交付方式不可直接修改；需要其他交付方式时应创建自定义包，并实现对应下载流程。旧 patch 的自动策略可能不同，应核对实际输出而非照搬包名和体积阈值。依据：[Unity：资源包生成规则](https://docs.unity3d.com/6000.0/Documentation/Manual/android-asset-packs-in-unity.html)。

选择 fast-follow 或 on-demand 可以延后部分下载，但相应内容首次使用时可能尚未到达，需要增加等待、失败重试和离线入口。本篇没有对原项目实施交付方式改造。

## 检查自定义 Gradle 模板

Unity 使用 `PLAY_ASSET_PACKS` 模板变量把 asset pack 模块写入 AAB。旧项目常见问题是：`launcherTemplate.gradle` 来自尚未支持 PAD 的 Unity 版本，因此没有这个变量。

不要只在旧模板末尾粘贴一个占位符。Unity 官方建议从当前 Editor 重新生成 Gradle 模板，再逐项重新应用项目定制。这样也能同步该版本的其他变量和 Gradle DSL 结构。

模板升级时可以使用下面的流程：

1. 备份现有模板并记录 Unity、AGP 和 Gradle 版本。
2. 在 `Edit > Project Settings > Player > Android > Publishing Settings > Build` 找到 `Custom Launcher Gradle Template`，记录原状态后关闭。将旧 `Assets/Plugins/Android/launcherTemplate.gradle` 备份并移出 `Assets`，再启用该选项，让 Editor 在文件不存在时生成基线。**只取消再勾选、保留旧文件，不保证重新生成。**
3. 比较旧模板中的仓库、依赖、签名和 packaging 配置。
4. 把必要修改小步迁回新模板，确保保留 `PLAY_ASSET_PACKS`。
5. 导出到新的空目录，检查 `launcher/build.gradle` 中展开后的 asset pack 配置，以及根 `settings.gradle` 中的模块引用；再构建 AAB，使用 `bundletool` 或 Android Studio 的包分析功能检查模块。

**配置作用：** `Custom Launcher Gradle Template` 让项目覆盖默认启动模块模板；`**PLAY_ASSET_PACKS**` 是 Unity 构建时替换的占位符，不能把它当作最终 Gradle 语法直接写入已导出的工程。具体位置和 DSL 应沿用当前 Editor 生成的模板。必要时同样备份、重建 Settings 模板，避免只接入 launcher 却漏了模块。依据：[Gradle 模板变量](https://docs.unity3d.com/6000.0/Documentation/Manual/android-gradle-template-variables.html)。

**可能的问题：** 模板整体替换可能丢失仓库、依赖和打包定制；只追加变量又可能混用新旧 DSL。逐项比较和重新构建后才能确认升级完成，本轮未对业务模板实际执行此操作。

## 运行时必须处理的状态

对 fast-follow 和 on-demand 内容，应用不能假设资源立即存在。至少需要处理：

- 等待下载、暂停、取消和失败。
- 蜂窝网络许可与剩余磁盘空间。
- 应用更新后旧资源包的兼容性。
- 下载完成但资源校验或加载失败。
- 用户离线启动时可进入的最小功能范围。

若资源同时受 Addressables 管理，要明确 catalog 中的路径最终指向 PAD 资源还是网络 bundle，并在设备上验证初始化顺序。两套系统都能“分发资源”，但生命周期和缓存来源不同。

## 发布验证

本地直接安装 APK 无法完整证明 Google Play 的资源交付行为。正式前至少完成：

1. 上传到 Play 内部测试轨道，并从 Play 安装。
2. 在空缓存设备记录首次安装体积、首次启动和资源到达时间。
3. 测试 Wi-Fi、蜂窝、断网、磁盘不足和下载中杀进程。
4. 从上一正式版本升级，确认旧存档与已下载资源仍可用。
5. 检查 AAB 中的 ABI、语言、密度拆分是否符合预期。
6. 保存版本对应的 AAB、启用 R8 混淆时的 mapping、native symbols 和 asset pack 清单，参见[原生崩溃符号与发布归档](#/article/unity-android-native-symbols)。

PAD 配置成功的证据不是“Unity 构建没有报错”，而是 Play 测试轨道按预期交付每个资源包，且应用能处理资源尚未到达的状态。

## 怎么回退

1. 恢复变更前的 AAB、Export Project、Split Application Binary 和模板选项，以及构建脚本中的对应字段。
2. 恢复已备份模板，在新的输出目录重新导出、构建并检查资源路径。关闭拆分可能使基础包明显增大，需要重新核对 Play 限制。
3. 对已经发布的版本，修改本地开关不会改变用户手中的包；应通过新的 version code 发布修正版。旧版本仍在使用时，保留其需要的资源和兼容逻辑，不能直接移除依赖。

如果需求是独立服务器上的内容更新，先另行设计 Addressables 的 catalog 与 bundle 生命周期，再确认是否要与 PAD 组合使用。
