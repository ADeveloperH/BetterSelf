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
    title: 'URP 14：Universal Renderer'
    url: 'https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/manual/urp-universal-renderer.html'
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

沿着运行时 Quality → URP Asset → Renderer → Camera 检查。只改一个没有被当前平台选中的资产不会产生预期效果；只关闭预制体投影也不能说明 SSAO 或主光源阴影 Pass 已关闭。

在本项目的移动端画面要求下，先移除不需要的阴影/SSAO，再关闭有效档位中的后处理与 HDR，并把 Renderer 的 Intermediate Texture 设为 Auto。组合调整后用户报告打包达到 60 FPS；没有每项独立基准，因此不承诺复制某个开关就能得到相同收益。

Auto 根据 Pass 需求判断中间纹理，仍可能创建；Always 用于兼容某些未正确声明输入的 Feature。修改后用 Frame Debugger 看实际 Pass/目标纹理，并回归 UI、透明、特效及自定义 Feature，不能仅凭 Inspector 开关认定生效。[URP 14 Renderer 设置](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/manual/urp-universal-renderer.html)

其他画质档位可能保留 HDR、不同 MSAA 或 Always。应按实际支持的档位做验证，不在没有测量时强行统一全部配置。

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
