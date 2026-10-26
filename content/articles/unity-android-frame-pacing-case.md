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

## 对照实验怎么做

保留同设备、目标 60、相同有效画质与测试画面，将 `androidUseSwappy` 从 1 改为 0；这个字段对应本版本的 Optimized Frame Pacing。临时增加一次性配置记录以帮助核对运行时状态，避免每帧打印干扰采样。实际画质使用 Balanced，MSAA 2、Render Scale 1。

Android Frame Pacing 库也称 Swappy，目标是让游戏循环与显示系统合理配合，改善不均匀提交造成的体验问题。它本身是用于改善帧节奏的工具，这次异常不能反向证明其整体无用。[Android 官方说明](https://developer.android.com/games/sdk/frame-pacing)

修改后的安装包输出约 59.85～60.22 FPS，显示时间戳间隔约 16.65 ms，计算约 60.04 FPS。相比只看应用面板的一个数字，平台时间戳提供了更直接的补充证据。

这仍不是完整的实验室结论：启动日志在后续读取时部分滚出缓冲，没有现场捕获每个运行时字段；APK 的其余内容也必须可比。因此结论保留“其他条件一致时，强支持帧同步/呈现路径参与”的限定。

降低 Render Scale 到 0.5 是当时提出的另一个诊断实验，没有已执行记录，不把它计入结果。若后续做此实验：明显变化可支持像素/带宽相关方向；几乎不变则降低这一方向的优先级，仍不能单独排除所有 GPU 问题。

## 保留与回退

当前保留关闭帧同步优化的配置，移除临时诊断日志。关闭该库不等于关闭 Android 显示系统自身的缓冲和同步，也不能直接声称必然出现撕裂。

这是可以回退的构建配置取舍。后续应覆盖非 Development 包、多 GPU/设备和 60/90/120 Hz 显示，运行 15～20 分钟，检查帧间隔、温度、输入感受、广告返回和前后台恢复。如果只在部分组合有效，需要评估引擎补丁、图形 API 或设备范围，而非盲目全局应用。

## 下次怎样复用

1. 确认是实际应用输出约 30，还是面板统计、目标帧率或显示刷新率造成误判。
2. 确认运行时配置和测试阶段；先读 Timeline，再决定优化脚本、渲染还是同步路径。
3. 一次改变一个主要变量，保存包、提交、设备环境与相同操作的显示/帧耗时记录。
4. 同时记录“支持了什么”和“还没有排除什么”；只有多设备证据才能扩大适用范围。

关联[移动端性能优化总览](#/article/unity-mobile-performance-playbook)，用于区分本案例与渲染配置精简后达到 60 FPS 的另一条优化路径。
