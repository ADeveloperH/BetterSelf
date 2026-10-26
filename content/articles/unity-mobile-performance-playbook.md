---
id: 'unity-mobile-performance-playbook'
title: 'Unity 移动端性能优化：诊断顺序与复用清单'
topic: 'Unity 开发'
domainId: 'unity'
categoryId: 'performance'
noteType: 'guide'
tags: ['Unity', 'Android', 'URP', 'Profiler', 'GC', '缓存', '对象池']
summary: '从实际帧率、线程等待、渲染 Pass 到按需刷新和对象复用，整理一组有验证范围的性能优化方法。'
updatedAt: '2026-10-26'
verifiedAt: null
sample: false
applicability: '来自 Unity 2022.3.62f3、URP 14.0.12 的 Android 项目实践。包含真机反馈、设备对照与 Editor 回归，逐项写明范围；未完成全部方法的独立真机基准。'
sources:
  - kind: personal
    title: '个人 Unity 移动端性能优化与回归实践'
  - kind: external
    title: 'Unity 2022.3：常见 Profiler 标记'
    url: 'https://docs.unity3d.com/2022.3/Documentation/Manual/profiler-markers.html'
  - kind: external
    title: 'Unity 2022.3：Application.targetFrameRate'
    url: 'https://docs.unity3d.com/2022.3/Documentation/ScriptReference/Application-targetFrameRate.html'
  - kind: external
    title: 'Unity 2022.3：Quality 设置'
    url: 'https://docs.unity3d.com/cn/2022.3/Manual/class-QualitySettings.html'
  - kind: external
    title: 'URP 14：Universal Render Pipeline Asset'
    url: 'https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/manual/universalrp-asset.html'
  - kind: external
    title: 'URP 14：Universal Renderer'
    url: 'https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/manual/urp-universal-renderer.html'
  - kind: external
    title: 'URP 14：Camera 组件'
    url: 'https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/manual/camera-component-reference.html'
  - kind: external
    title: 'URP 14：Screen Space Ambient Occlusion'
    url: 'https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/manual/post-processing-ssao.html'
  - kind: external
    title: 'Unity 2022.3：手动合并网格'
    url: 'https://docs.unity3d.com/2022.3/Documentation/Manual/combining-meshes.html'
---

## 先决定要改善什么

稳定游戏时的低帧率、动画帧间隔不均、切关停顿、首次加载慢和长时间运行发热，需要分别测量。减少切关 Instantiate 不等于提高稳定运行的目标帧率，平均达到 60 FPS 也不代表没有卡顿。

本轮实践留下三类结果：渲染配置精简后用户报告真机恢复 60 FPS；另一台设备通过帧同步开关对照实测约 30 → 60 FPS；其余缓存、复用和刷新优化已有代码、局部基准或功能回归证据，尚不能给出独立真机帧率收益。

## 可复用方法总表

| 方法                                                   | 适合的症状                                  | 本次结果和证据                                               | 主要代价或边界                                         |
| ------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------ |
| 检查有效 URP 配置，关闭不需要的阴影、SSAO、后处理、HDR | 3D 场景持续开销，存在不需要的渲染 Pass      | 组合调整后用户反馈新包正常 60 FPS                            | 改变画质；未隔离每个开关贡献                           |
| 中间纹理从 Always 改 Auto                              | 管线始终创建中间目标，而部分画面不需要      | 同一渲染配置批次内实施                                       | Auto 仍可能需要中间纹理；须验证自定义 Renderer Feature |
| 分析帧同步与呈现等待                                   | 实际稳定约 30 FPS，脚本很轻，大量时间在等待 | 特定 Android 设备 Swappy 对照约 30 → 60 FPS                  | 设备相关；不能全项目默认关闭                           |
| 合并单个对象的固定网格部件                             | 同材质、共同移动的小零件很多                | 三车型启用 MeshRenderer 从 13/15/21 分别降至 5；资源回归通过 | 未减面；Renderer 数不是整帧 Draw Calls                 |
| 布局计算缓存                                           | 屏幕和界面没变，仍每帧扫描/投影布局         | 已实施，历史功能反馈正常                                     | 屏幕、UI、相机输入改变时必须失效                       |
| 环境光按需更新                                         | 没改光照仍反复更新环境                      | 环境参数比较后才调用更新                                     | 场景切换/动态光照变化须触发                            |
| HUD 只刷新变化值                                       | 每帧查询库存、本地化、格式化和设置文本      | 已实施变化检测，库存轮询间隔 0.2 秒                          | 关键事件仍应及时刷新；不等于全游戏零分配               |
| 乘客逻辑与显示分离，按需创建并池化                     | 总队列很长，但同时可见对象少                | 可见队列 24，剩余保留逻辑数据，跨关复用                      | 上车/离场中的对象也要跟踪并清理                        |
| 关卡模板缓存 + 独立运行时副本                          | 重开反复加载、排序、解析同样资源            | 暖 Editor 局部 Load 约 1.1691 → 0.0016 ms                    | 只测数据 Load；占常驻内存，编辑后须失效                |
| 车辆按预制体池化                                       | 连续切关反复 Instantiate/Destroy            | 历史真实玩法回归通过                                         | 首次仍创建，容量按需求增长；必须重置关联状态           |
| UI SpriteAtlas                                         | 同屏 UI 有大量可共用纹理的 Sprite           | 已做按目录分组的资源处理                                     | 实际合批受材质、层级、遮罩影响；须查串边和内存         |

先按瓶颈选择对应项。此表是候选方法和证据清单，不是要求所有项目逐项打开的配置表。

## 第一步：确认实际帧率和测试条件

记录引擎、图形 API、包类型、设备、刷新率、有效 Quality/URP/Renderer、目标帧率、分辨率和测试操作。比较相同画面、相同运行阶段；首次加载与暖缓存分别统计。

`Application.targetFrameRate = 60` 指定尝试达到的目标，不能提供额外计算能力。Android 和桌面的帧率控制规则不同，Editor 的 100 多帧不能证明手机可以稳定输出同样帧率；Editor 软件限帧的表现也不能直接当成 Android 机制。[Unity 2022.3 帧率 API](https://docs.unity3d.com/2022.3/Documentation/ScriptReference/Application-targetFrameRate.html)

功能采样可以用 Development 包；发布性能应再用非 Development 包复测。Frame Debugger 和 Deep Profile 用于定位时开启，正式比较耗时时关闭。无法连接手机 Profiler 时，可用同一套操作、应用显示统计和平台显示时间戳补证据，明确统计口径。

## 第二步：区分计算、等待和分配

用 Timeline 同时看主线程与渲染线程：整帧 33 ms 不是“脚本算了 33 ms”。Present 阶段包含同步等待，不能当作精确 GPU 执行时间。GPU 数据缺失时保留不确定性，结合降渲染负载等对照实验判断方向。[Unity Profiler 标记说明](https://docs.unity3d.com/2022.3/Documentation/Manual/profiler-markers.html)

`GC.Alloc` 表示托管分配，`GC.Collect` 才是回收相关工作。定位到某个 Update 每帧分配，值得处理，但要再检查它是否与抖动帧对齐。某次采样没有回收，不代表长期不存在回收。

悬浮窗在低目标帧率下比高帧率更容易看出位移步进。比较平均 FPS、帧间隔、动画更新阶段和插值方式；旁边另一个动画看起来流畅只能作为线索。不要在没复现证据时把所有问题归因于 GC、GPU 或某个框架。

具体的等待对照见[Android 固定 30 FPS 案例](#/article/unity-android-frame-pacing-case)。

## 第三步：核实真正生效的渲染配置

按 `Android Quality → URP Asset → Universal Renderer Data → Camera` 的顺序检查。每次修改前记录资产名和原值；同一项目可以有多个 Quality、URP Asset、Renderer 和 Camera，只改一个未被当前 Android 包使用的资产不会生效。

本次组合调整包括关闭不需要的实时阴影、SSAO、Camera 后处理和 HDR，将 Intermediate Texture 从 Always 改为 Auto；基线保留 Render Scale 1 与 MSAA 2x。调整后用户反馈 Android 新包达到 60 FPS，但没有逐项独立基准，不能把全部收益归给其中一个开关。

### 先确认 Android 真正使用哪个 URP Asset

**Editor 操作：**

1. 打开 `File > Build Settings`，确认平台为 Android。
2. 打开 `Edit > Project Settings > Quality`。
3. 在顶部 Quality 矩阵中查看 Android 列；`Default` 行的绿色标记表示 Android 默认进入哪个 Quality。本项目实测档位为 `Balanced`。
4. 选中该 Quality，在下方 `Rendering > Render Pipeline Asset` 查看引用的 URP Asset。若为空，再到 `Edit > Project Settings > Graphics` 查看默认的 Scriptable Render Pipeline Asset。
5. 点击资产引用定位并选中真正生效的 URP Asset，然后再修改其 Inspector。

**配置作用：** Quality 可以给不同平台或档位指定不同的 Render Pipeline Asset；当前 Quality 的资产会覆盖 Graphics 中的默认资产。[Unity Quality 设置](https://docs.unity3d.com/cn/2022.3/Manual/class-QualitySettings.html)

**潜在问题：** 游戏代码可能在启动或运行中调用 `QualitySettings.SetQualityLevel`，使打包默认值与运行时实际值不同。只检查 Graphics 或只改一个“看起来像移动端”的资产，容易得到无效对照。

**验证与回退：** 测试包启动时一次性记录 `QualitySettings.names[QualitySettings.GetQualityLevel()]` 和 `GraphicsSettings.currentRenderPipeline.name`，确认资产名后移除日志。回退时恢复原 Quality/URP Asset 引用，不要只恢复资产内的某个字段。

### 关闭主光源和附加光源的实时阴影

**Editor 操作：** 选中有效 URP Asset，在 Inspector 展开 `Lighting`，分别取消 `Main Light > Cast Shadows` 与 `Additional Lights > Cast Shadows`。本次两个实时阴影入口都关闭；如果画面必须保留其中一种，应分别打包对照。

**配置作用：** 两个开关控制 URP 是否为主方向光和附加光生成实时阴影。关闭后可移除相应阴影贴图和渲染工作；它不同于单个 `Light` 或 `Mesh Renderer` 上的 Cast Shadows 设置。URP Asset 已全局关闭时，单个对象保留投影也不会恢复该类实时阴影。[URP Asset 的 Lighting 设置](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/manual/universalrp-asset.html#lighting)

**潜在问题：** 动态物体会失去实时投影，接地感、遮挡关系和玩法提示可能变弱。烘焙光照不应被简单当成等价替代，动态物体、昼夜变化或可移动光源尤其需要单独检查。

**验证与回退：** 用 Frame Debugger 检查主光/附加光 Shadow Map Pass 是否消失，并在角色脚下、车辆接触面、室内外切换处做画面对比。出现明显视觉或玩法损失时，重新勾选需要的 `Cast Shadows`；也可先保留主光阴影、降低分辨率和距离，再测试成本。

### 停用 SSAO Renderer Feature

**Editor 操作：** 在有效 URP Asset 的 Renderer 列表中定位当前 Camera 使用的 Universal Renderer Data，选中它；在 Inspector 的 `Renderer Features` 中找到 `Screen Space Ambient Occlusion`。为了便于回退，先取消该 Feature 标题旁的启用勾选；确认不再需要后再考虑从列表中删除。若项目有多个 Renderer，逐个核对 Camera 的 `Rendering > Renderer` 选择。

**配置作用：** URP 14 的 SSAO 是 Renderer Feature，不是 Volume 中的普通后处理。它根据深度/法线计算屏幕空间环境遮蔽，会增加纹理与采样 Pass。[URP 14 SSAO](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/manual/post-processing-ssao.html)

**潜在问题：** 缝隙、墙角和物体接触处会变亮，立体层次下降。关闭 Camera 的 Post Processing 不会自动关闭 SSAO；反过来，停用 SSAO 也不会关闭 Bloom、Color Adjustments 等 Volume 效果。

**验证与回退：** 在 Frame Debugger 中确认 SSAO Pass 和对应纹理不再生成，在墙角、车轮与地面等位置截图对比。需要恢复时重新启用同一个 Feature，原参数会保留；若已经删除，则需重新添加并恢复原参数，因此修改前应截图或记录配置。

### 关闭 Camera 后处理

**Editor 操作：** 在 Hierarchy 选中实际渲染游戏画面的 Camera，在 Inspector 展开 `Rendering`，取消 `Post Processing`。Camera Stack 或多场景含多个 Camera 时，逐个检查 Base/Overlay Camera；不要只修改当前打开场景里的预制体实例。

**配置作用：** 该字段决定 Camera 是否执行 URP 后处理。关闭后，Volume 中的 Bloom、Color Adjustments、Tonemapping 等效果即使仍配置，也不会由这个 Camera 应用。[URP Camera 组件](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/manual/camera-component-reference.html)

**潜在问题：** 画面色调、曝光、辉光、暗角和基于后处理的抗锯齿可能变化；依赖 Bloom 表达奖励或提示的内容还会影响可读性。多个 Camera 叠加时，关闭错误的 Camera 可能没有效果。

**验证与回退：** 用相同场景截图并在 Frame Debugger 确认后处理 Pass 是否消失，同时检查 UI、特效、亮部和颜色。若只有个别效果成本高，恢复 `Post Processing` 后在 Volume Profile 中逐项禁用并单变量测试。

### 关闭 HDR

**Editor 操作：** 选中有效 URP Asset，在 `Quality > HDR` 取消勾选。再选中 Base Camera，检查 `Output > HDR Rendering` 是否有独立覆盖；若 Camera 明确强制开启，改为跟随管线或关闭。Camera 输出到 Render Texture 时，HDR/格式可能由该 Render Texture 决定，也要核对目标纹理。

**配置作用：** URP Asset 的 HDR 允许 Camera 使用大于 1 的亮度范围和 HDR 颜色缓冲，Bloom、Tonemapping 和高亮细节可能依赖它。关闭可减少 HDR 计算或缓冲带宽，但收益取决于设备和管线。[URP Asset 的 Quality 设置](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/manual/universalrp-asset.html#quality)

**潜在问题：** 高亮可能被截断，Bloom、曝光和 Tonemapping 的观感改变，颜色分级结果也可能不同。这里的渲染 HDR 与 Android 设备是否支持 HDR 屏幕输出不是同一个层级。

**验证与回退：** 对比高亮、天空、粒子和 Bloom 场景，检查 Camera 或 Render Texture 没有重新覆盖。画质不接受时重新启用 URP Asset 的 `HDR`，并恢复 Camera 原值。

### 将 Intermediate Texture 从 Always 改为 Auto

**Editor 操作：** 选中当前使用的 Universal Renderer Data，在 Inspector 展开 `Compatibility`，把 `Intermediate Texture` 从 `Always` 改为 `Auto`。

**配置作用：** `Auto` 根据活动 Renderer Feature 通过 `ScriptableRenderPass.ConfigureInput` 声明的输入，决定是否需要中间纹理；`Always` 强制先渲染到中间纹理。Unity 建议只在兼容未正确声明输入的 Renderer Feature 时使用 Always，并指出它在某些平台上可能有明显性能影响。[URP 14 Universal Renderer](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/manual/urp-universal-renderer.html#compatibility)

**潜在问题：** Auto 不保证永远不创建中间纹理；需要 Camera Color/Depth 的 Feature 仍会触发它。旧的自定义 Renderer Feature 若没有正确声明输入，改成 Auto 后可能出现黑屏、采样错误、透明/UI 异常或效果消失。

**验证与回退：** 用 Frame Debugger 查看实际 Render Target 和 Pass，重点回归自定义 Renderer Feature、UI、透明材质、相机堆叠和特效。出现兼容问题时先恢复 `Always`，再修正 Feature 的输入声明。

### 保留 Render Scale 1 与 MSAA 2x，并把它们当作独立变量

**Editor 操作：** 选中有效 URP Asset，在 `Quality` 中设置 `Render Scale = 1`、`Anti Aliasing (MSAA) = 2x`。本次它们是记录下来的基线，并非本轮 60 FPS 结果的单独优化项。

**配置作用：** Render Scale 缩放 3D 渲染目标，UI 保持设备原生分辨率；低于 1 可以减少像素负载，但会降低清晰度。MSAA 对几何边缘做多重采样，2x/4x/8x 质量和成本递增；Camera 的 `Output > MSAA` 以及部分移动平台限制会影响最终是否生效。[URP Asset 设置](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/manual/universalrp-asset.html#quality)

**潜在问题：** 降低 Render Scale 会让 3D 画面模糊、细线闪烁；提高 MSAA 会增加带宽和内存成本。某些不支持 StoreAndResolve 的移动设备在启用 Opaque Texture 时会忽略 MSAA，Inspector 显示 2x 不代表运行时一定执行。

**验证与回退：** 单独测试 Render Scale 0.5/0.75/1 或 MSAA Disabled/2x，比较 GPU 时间、清晰度和 Frame Debugger，而不是与其他开关一起改。诊断结束后恢复记录的 1 与 2x；其他 Android Quality 也要按实际支持范围检查，不能默认全部统一。

## 第四步：把重复工作变成按需工作

布局缓存保存本关的稳定输入和初始实体范围，避免移动中的车辆不断改变取景。屏幕尺寸、UI 占位、相机参数或关卡变化时重新计算；不能只缓存结果而不设计失效条件。

环境更新比较真正影响画面的参数值，避免因新创建 Light 的实例 ID 不同就重复刷新。新场景要重新初始化；动态天气、时间变化等场景不能照搬“只更新一次”。

HUD 对关卡、进度、教程、库存和语言做变化检测；文本值不变就避免本地化/格式化和重复赋值。0.2 秒是本项目库存轮询的取舍，不是通用最佳值；有可靠事件时优先事件驱动，重要交互立即刷新。

关卡缓存保存只读模板，创建当前局面时深拷贝会修改的数组和对象。保留原有数据校验；编辑器导入、删除、移动资源及新运行时初始化时清缓存。历史局部基准仅测 `Load`，不能外推整个切关同样快，也没有有效证据宣称零分配。

## 第五步：缩小对象规模，再考虑复用

先区分逻辑总量与显示数量：长队列可以只创建前 24 个可见角色，其他颜色数据继续参与逻辑；逐步补齐显示。这个上限由画面和玩法决定。

车辆按三种预制体分别复用，乘客先归还，再归还全部借出车辆。退出棋盘、停车、隐藏或从活动数组移除的对象仍在借出登记中。清理协程、动画、延迟回调、粒子、引用和派生渲染状态后再初始化新关卡。详见[对象池生命周期与回归](#/article/unity-pooling-lifecycle-regression)。

复用减少后续重复创建，换来高水位对象常驻。分别记录首次创建、暖切关、连续切关内存和退出场景释放。当前环境、停车位和玩法管理器仍逐关构建，不应写成“整关全部池化”。

## 网格和图集的适用边界

同一辆车中相对位置固定、共用材质的部件适合合并；换色、隐藏、独立动画和挂点继续独立。合并不会自动减少三角形，还会改变剔除粒度，所以不要把跨大范围的独立物体无差别合成一个网格。[Unity 手动合并网格](https://docs.unity3d.com/2022.3/Documentation/Manual/combining-meshes.html)

在 Frame Debugger 比同一 Pass 的绘制事件，再看 Batches、SetPass、顶点/三角形和渲染线程耗时。三种车的 Renderer 数量下降是结构结果，不能直接推算整帧 Draw Calls。

SpriteAtlas 面向 Sprite，不能直接替代 3D 模型的材质、UV 与网格优化。按共同使用的 UI 分组有助于管理加载，但不能保证自动合成一批；回归过滤、压缩、缩放、Padding 和边缘，尤其手势图与透明边界。没有足够证据时，不把图集串边简单归为某一个配置错误。

## 每项优化的最小交付

保留“症状与环境 → 改动假设 → 可比测量 → 功能回归 → 收益/代价/适用边界”。缺少手机数据就写待测；自动回归结果与性能收益分开。优化后的反例同样值得记录，下次复用时先检查前置条件和已知风险。
