---
id: 'unity-android-frame-pacing-case'
title: 'Unity Android 固定 30 FPS：一次帧同步对照实验'
topic: 'Unity 开发'
domainId: 'unity'
categoryId: 'performance'
noteType: 'troubleshooting'
tags: ['Unity', 'Android', 'Profiler', 'Frame Pacing', 'Swappy', '真机验证']
summary: '脚本很轻、整帧稳定 33 ms 时，结合线程等待和平台显示数据，通过帧同步开关对照缩小问题范围。'
updatedAt: '2026-10-26'
verifiedAt: null
sample: false
applicability: '历史实测环境为 Unity 2022.3.62f3、URP 14.0.12、Redmi Note 8 Pro、约 60 Hz 显示。单设备结果已记录，正式包、长时间和多设备兼容性仍待验证。'
sources:
  - kind: personal
    title: '个人 Unity Android 手机固定 30 FPS 排查与包对照记录'
  - kind: external
    title: 'Unity 2022.3：Android Player 设置'
    url: 'https://docs.unity3d.com/cn/2022.3/Manual/class-PlayerSettingsAndroid.html'
  - kind: external
    title: 'Unity 2022.3：PlayerSettings.Android.optimizedFramePacing'
    url: 'https://docs.unity3d.com/2022.3/Documentation/ScriptReference/PlayerSettings.Android-optimizedFramePacing.html'
  - kind: external
    title: 'Unity 2022.3：常见 Profiler 标记'
    url: 'https://docs.unity3d.com/2022.3/Documentation/Manual/profiler-markers.html'
  - kind: external
    title: 'Android：Frame Pacing library'
    url: 'https://developer.android.com/games/sdk/frame-pacing'
---

## 问题与结论范围

同一套激励框架在另一个游戏中可以运行较高帧率，而当前 3D 游戏在一台手机上稳定约 30 FPS。不能据此只归因于“3D 更重”，也不能直接排除框架：有效配置、场景负载、显示提交链路和设备都可能不同。

本次最强的证据是安装包对照：关闭 Unity Android Optimized Frame Pacing 后，应用输出从约 30 FPS 升至约 60 FPS。这个结果支持继续调查该设备上的帧同步/呈现路径，尚不能证明某个具体 Swappy 内部缺陷，更不能推广为“所有项目都应关闭”。

## 从实际输出确认30帧

设备为 Redmi Note 8 Pro，平台刷新约 60.33 Hz；原包 SurfaceView 应用输出约 30.00～30.05 FPS。刷新率和游戏输出是不同指标：屏幕以 60 Hz 刷新，游戏仍可能每两次刷新提供一张新画面。

源码设置 60 只说明代码意图。排查还要核对实际 `targetFrameRate`、渲染间隔、有效 Quality 和平台策略。省电关闭与某一时刻的电池温度不能覆盖所有限制；38.6°C 电池读数本身不足以判断热降频。

## Profiler 里的关键证据

历史样本约 300 帧、10 秒，完整帧平均约 33.31 ms，统计排除了最后一个不完整帧。

| 指标                                     |   平均值 | 说明                                        |
| ---------------------------------------- | -------: | ------------------------------------------- |
| 主线程 `WaitForTargetFPS`                | 11.34 ms | 存在明显等待，需看所在线程与嵌套关系        |
| 主线程 `Gfx.WaitForPresentOnGfxThread`   | 10.88 ms | 等待渲染/呈现链路                           |
| 主线程 `Update.ScriptRunBehaviourUpdate` |  0.57 ms | 本段脚本 Update 较轻，不能代表全部 CPU 工作 |
| 渲染线程 `Gfx.PresentFrame`              | 24.88 ms | 包含等待，不是 GPU 执行时间                 |

主线程和渲染线程会重叠，不能相加为帧耗时；同一线程内也要避免父子 Marker 重复计数。这次摘要中两段主线程等待合计约 22.2 ms，但该口径不能脱离原样本结构套用。

Unity 对 Present 的定义包含 VSync 等等待。因此“大量 Present 时间”是进一步查渲染/同步的线索，不是足够精确的 GPU 测量。[Unity 2022.3 Profiler 标记](https://docs.unity3d.com/2022.3/Documentation/Manual/profiler-markers.html)

性能面板里的 `Other` 若只是总时间减去 Update 和 Render，也不是 GPU 计时。没有 GPU 模块数据并不能反推打包错误；需核实引擎、图形 API 和设备的采样支持，或用平台工具及负载对照补证据。

## 这个开关控制什么

`Optimized Frame Pacing` 是 Unity Android Player 的构建配置。在本次使用的 Unity 2022.3 中，启用后由 Unity 集成的 Android Frame Pacing 库（Swappy）协调游戏提交帧与显示节奏，目标是减少帧率波动，使帧间隔更均匀。Unity 官方也把它描述为“更均匀地分布帧”。[Unity Android Player 设置](https://docs.unity3d.com/cn/2022.3/Manual/class-PlayerSettingsAndroid.html) [Android Frame Pacing 说明](https://developer.android.com/games/sdk/frame-pacing)

关闭这个开关只是不再使用 Unity 这层优化。它不会关闭 Android SurfaceFlinger、显示器刷新、系统缓冲或所有 VSync，也不会自动把 `Application.targetFrameRate` 改为 60。应用能否到 60 FPS，仍受目标帧率、每帧 CPU/GPU 用时、刷新率、温控和其他平台设置影响。

## 在 Unity Editor 中怎样关闭

以下路径适用于本次实测的 Unity 2022.3.62f3；其他版本若 Inspector 名称变化，应先查对应版本的 Player Settings 文档。

1. 打开 `File > Build Settings`，确认当前平台是 `Android`。如果尚未切换，选择 Android 后点击 `Switch Platform`。
2. 打开 `Edit > Project Settings > Player`。
3. 在 Player 设置顶部选择 Android 图标，避免改到 PC、iOS 等其他平台的设置。
4. 展开 `Resolution and Presentation`。
5. 找到 `Optimized Frame Pacing`，记录原值，然后取消勾选。
6. 保存项目，并重新构建 APK 或 AAB。已经安装在手机里的旧包不会随 Editor 设置自动变化，必须安装新构建才能验证。

这个 Inspector 开关序列化在 `ProjectSettings/ProjectSettings.asset`：

```yaml
# 开启
androidUseSwappy: 1

# 关闭
androidUseSwappy: 0
```

YAML 字段适合代码审查和排查“设置是否真的进入提交”，日常修改应优先通过 Editor 完成。直接改 YAML 容易在 Unity 打开项目、升级版本或多人合并时产生误改。若项目由脚本管理构建配置，对应的 Editor API 是 `PlayerSettings.Android.optimizedFramePacing`，也要保证测试包和正式包使用同一套构建入口。

## 单变量对照怎样打包

先构建 A 包并保留 `Optimized Frame Pacing` 开启，再只关闭这一项构建 B 包。两包应保持同一个提交、场景、Android Quality、URP Asset、图形 API、`Application.targetFrameRate`、分辨率和 Development Build 状态；在同一台设备、相同刷新率与相同操作下比较。

本次实际画质为 Balanced，MSAA 2x、Render Scale 1。临时增加一次性的启动日志来记录 Quality、目标帧率和关键配置，避免每帧打印干扰采样。包名或版本号应能区分 A/B 包，防止重复安装时把旧包当成新包。

Android Frame Pacing 本来用于改善帧节奏，这次异常不能反向证明它整体无用。修改后的安装包输出约 59.85～60.22 FPS，显示时间戳间隔约 16.65 ms，计算约 60.04 FPS。相比只看应用面板的一个数字，平台时间戳提供了更直接的补充证据。

这仍不是完整的实验室结论：启动日志在后续读取时部分滚出缓冲，没有现场捕获每个运行时字段；APK 的其余内容也必须可比。因此结论保留“其他条件一致时，强支持帧同步/呈现路径参与”的限定。

降低 Render Scale 到 0.5 是当时提出的另一个诊断实验，没有已执行记录，不把它计入结果。若后续做此实验：明显变化可支持像素/带宽相关方向；几乎不变则降低这一方向的优先级，仍不能单独排除所有 GPU 问题。

## 关闭后可能有什么问题

关闭后可能失去 Swappy 对提交时机和显示节奏的协调。平均 FPS 即使升高，帧间隔也可能变得不均匀，滚动和动画出现可感知的抖动；不同刷新率、Vulkan/OpenGL ES、GPU 驱动和设备可能得到相反结果。不能只因关闭了帧同步优化就断言一定出现画面撕裂，也不能只看平均 FPS 就认定体验更好。

这项改动还可能掩盖真正的 GPU 或 CPU 瓶颈。例如某台设备从 30 升到 60，不代表复杂场景在发热后仍能维持 60。正式保留前至少验证：

- 60、90、120 Hz 设备或刷新率模式，比较平均 FPS 与帧间隔分布。
- 项目实际支持的 Vulkan、OpenGL ES 组合。
- 非 Development 正式包，以及与对照包相同的 Quality 和场景操作。
- 冷启动、前后台切换、广告或系统页面返回后的呈现状态。
- 连续运行 15～20 分钟后的温度、降频、输入延迟和动画观感。

## 怎样判断生效并回退

构建前可在版本控制差异中确认 `ProjectSettings/ProjectSettings.asset` 只有预期的 `androidUseSwappy: 1 → 0`。构建后不要用 Editor 帧率作为结果；在目标 Android 设备上记录包版本、刷新率、应用输出 FPS、帧时间或系统显示时间戳，并对比固定操作。

若帧间隔、输入、兼容性或稳定性变差，回到 `Edit > Project Settings > Player > Android > Resolution and Presentation`，重新勾选 `Optimized Frame Pacing`，再重新构建和安装。回退同样需要新包，修改 Editor 里的勾选不会改变已经发布的 APK/AAB。

当前项目暂时保留关闭状态并移除临时诊断日志。如果只在部分组合有效，应继续评估 Unity 补丁版本、图形 API 或设备范围，再决定按设备分流还是恢复全局开启。

## 下次怎样复用

1. 确认是实际应用输出约 30，还是面板统计、目标帧率或显示刷新率造成误判。
2. 确认运行时配置和测试阶段；先读 Timeline，再决定优化脚本、渲染还是同步路径。
3. 一次改变一个主要变量，保存包、提交、设备环境与相同操作的显示/帧耗时记录。
4. 同时记录“支持了什么”和“还没有排除什么”；只有多设备证据才能扩大适用范围。

关联[移动端性能优化总览](#/article/unity-mobile-performance-playbook)，用于区分本案例与渲染配置精简后达到 60 FPS 的另一条优化路径。
