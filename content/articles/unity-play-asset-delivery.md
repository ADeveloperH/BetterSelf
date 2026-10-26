---
id: 'unity-play-asset-delivery'
title: 'Unity Play Asset Delivery 配置与模板升级'
topic: 'Unity 开发'
domainId: 'unity'
categoryId: 'build'
noteType: 'guide'
tags: ['Unity', 'Android', 'AAB', 'Play Asset Delivery', 'Gradle']
summary: '说明 Unity 使用 Play Asset Delivery 的前置条件、资源包交付模式、Gradle 模板变量和发布前验证。'
updatedAt: '2026-10-26'
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
---

> Play Asset Delivery（PAD）是 Google Play 对 AAB 中大型游戏资源的交付方案。它解决的是安装包模块与资源交付，不等同于 Addressables 的任意服务器远程内容更新。

## 启用前提

Unity 当前文档给出的基础条件是：

1. 发布格式使用 Android App Bundle（AAB）。
2. 启用 **Split Application Binary**。
3. 使用支持 PAD 的 Unity Editor；如果选项不可用，应先核对 Editor 版本。

脚本设置 `PlayerSettings.Android.useAPKExpansionFiles = true` 对应 Split Application Binary，但发布配置最好在构建日志中显式打印，避免 GUI 状态和自动化脚本互相覆盖。

构建后，AAB 至少包含基础模块，并根据项目资源形成 asset pack 模块。asset pack 不包含可执行代码；需要运行时代码更新时，仍要使用应用版本发布或合规的代码方案。

## 选择交付模式

PAD 的资源包可采用三种交付方式：

| 模式         | 何时可用           | 适合内容                             |
| ------------ | ------------------ | ------------------------------------ |
| install-time | 随应用安装         | 首次启动必须使用的核心资源           |
| fast-follow  | 安装后自动继续下载 | 很快会使用、但不必阻塞首次安装的资源 |
| on-demand    | 应用运行时请求     | 关卡包、语言包等可延后内容           |

Unity 自动生成的资源拆分与自定义 asset pack 能力不同。设计前先确认资源由 Unity 自动放置还是由项目显式创建包，再决定运行时是否需要 Play Core 下载、进度和错误处理。

## 检查自定义 Gradle 模板

Unity 使用 `PLAY_ASSET_PACKS` 模板变量把 asset pack 模块写入 AAB。旧项目常见问题是：`launcherTemplate.gradle` 来自尚未支持 PAD 的 Unity 版本，因此没有这个变量。

不要只在旧模板末尾粘贴一个占位符。Unity 官方建议从当前 Editor 重新生成 Gradle 模板，再逐项重新应用项目定制。这样也能同步该版本的其他变量和 Gradle DSL 结构。

模板升级时可以使用下面的流程：

1. 备份现有模板并记录 Unity、AGP 和 Gradle 版本。
2. 在临时分支关闭并重新启用自定义模板，让当前 Unity 生成新基线。
3. 比较旧模板中的仓库、依赖、签名和 packaging 配置。
4. 把必要修改小步迁回新模板，确保保留 `PLAY_ASSET_PACKS`。
5. 构建 AAB，使用 `bundletool` 或 Android Studio APK Analyzer 检查模块。

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
6. 保存版本对应的 AAB、mapping、native symbols 和 asset pack 清单。

PAD 配置成功的证据不是“Unity 构建没有报错”，而是 Play 测试轨道按预期交付每个资源包，且应用能处理资源尚未到达的状态。
