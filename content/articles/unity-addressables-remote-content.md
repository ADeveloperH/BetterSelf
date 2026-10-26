---
id: 'unity-addressables-remote-content'
title: 'Addressables 远程内容发布与更新'
topic: 'Unity 开发'
domainId: 'unity'
categoryId: 'assets'
noteType: 'guide'
tags: ['Unity', 'Addressables', 'AssetBundle', '远程内容', '内容更新']
summary: '梳理 Addressables 1.21 的远程目录、Profile、内容更新、分组策略和缓存清理，并把历史问题记录与可复现结论分开。'
updatedAt: '2026-10-26'
verifiedAt: null
sample: false
applicability: '基于 Unity Addressables 1.21.21 文档整理；原问题环境为 Unity 2022.3.28f1 与 Addressables 1.21.14。本轮未取得原工程、服务器或设备，未实际执行 Player 构建、增量发布、回滚和缓存实验。'
sources:
  - kind: personal
    title: '有道云笔记：Addressable 使用与资源动态下发'
  - kind: external
    title: 'Unity Addressables 1.21：远程内容概览'
    url: 'https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/remote-content-intro.html'
  - kind: external
    title: 'Unity Addressables 1.21：启用远程分发'
    url: 'https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/remote-content-enable.html'
  - kind: external
    title: 'Unity Addressables 1.21：创建内容更新构建'
    url: 'https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/content-update-build-create.html'
  - kind: external
    title: 'Unity Addressables 1.21：远程 AssetBundle 缓存'
    url: 'https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/remote-content-assetbundle-cache.html'
  - kind: external
    title: 'Unity Addressables 1.21：下载依赖项'
    url: 'https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/DownloadDependenciesAsync.html'
---

> 两份原笔记主体几乎相同，因此合并为一个入口。原笔记给出了大量配置项和问题线索，但没有完整的构建、上传、客户端更新与回滚证据。本文把它们整理为可执行流程，并保留验证边界。

## 先确定发布模型

Addressables 的远程内容不是“把任意资源目录放到服务器”这么简单。客户端通过 catalog 解析地址和依赖，再按 catalog 中的内部 ID 下载对应 AssetBundle。一次可用的远程发布至少包含：

```text
远程 AssetBundle
      ↑
catalog.json 记录地址、依赖与 bundle 信息
      ↑
catalog.hash 帮助客户端判断 catalog 是否变化
```

Unity 官方文档要求同时上传远程 bundle、catalog 和 hash。启用远程 catalog 后，可以在不重新发布应用安装包的情况下改变远程资源；这不等于可以更新 Player 中的原生代码，也不自动解决业务版本兼容或回滚。

## 首次完整发布

一个最小的远程内容配置包括：

1. 在 Addressable Asset Settings 中启用 **Build Remote Catalog**，并把 catalog 的 Build & Load Paths 设为远程位置。
2. 在发布用 Profile 中配置 `RemoteBuildPath` 和 `RemoteLoadPath`。前者是构建产物目录，后者是客户端访问 URL。
3. 对需要远程分发的 Group，把 Build Path 设为 `RemoteBuildPath`，Load Path 设为 `RemoteLoadPath`。
4. 确认当前 Platform Target，再执行 **New Build > Default Build Script**。
5. 把生成的远程 bundle、catalog 和 hash 上传到 `RemoteLoadPath` 对应的服务器位置。
6. 构建 Player，并保存这次内容构建生成的 `addressables_content_state.bin`。

`addressables_content_state.bin` 是后续内容更新的基线。它应作为该 Player 版本的发布制品保存，不能在做更新前随意用新的完整构建覆盖。

## Play Mode 只回答不同问题

| 模式               | 适合检查                           | 不能证明                                   |
| ------------------ | ---------------------------------- | ------------------------------------------ |
| Use Asset Database | 地址与加载代码的快速迭代           | bundle 布局、网络下载和缓存行为            |
| Simulate Groups    | 依赖与分组关系                     | 真正的 bundle、平台着色器和服务器配置      |
| Use Existing Build | 使用已有构建数据，接近真实加载路径 | 线上文件已上传、CDN 缓存正确或设备更新成功 |

`Use Existing Build` 依赖与当前目标平台匹配的现有内容构建。拿 Android 构建结果在 Windows Editor 中验证材质，可能因为着色器平台不兼容而显示粉色，这不能直接判定远程资源损坏。

## 内容更新不是文件级补丁

更新已发布 Player 的远程内容时，使用该版本对应的 `addressables_content_state.bin` 执行 **Update a Previous Build**。新 catalog 仍能指向旧 bundle，同时把发生变化的内容指向新 bundle；客户端只需获取新 catalog 所需的 bundle。

实际下载粒度由 bundle 布局决定，不是“只下载修改过的单个文件”。一个资源变化可能让它所在 bundle 以及依赖 bundle 重新生成，因此需要结合 Build Layout 报告观察更新体积。

分组的 Update Restriction 用来控制这种代价：

- **Cannot Change Post Release**：适合体积较大、发布后很少变化的组。检查内容更新限制时，工具可以把已变资源移动到新的远程组，让未变化资源继续使用旧 bundle。旧版界面将这一选项称为 `Prevent Updates`。
- **Can Change Post Release**：适合经常变化且 bundle 较小的组。组内资源变化后，包含它们的 bundle 会整体重建并重新下载。

因此，分组应围绕更新频率、依赖关系和下载成本设计。仅勾选一个选项不能保证更新包一定很小。

## 运行时下载与缓存

需要在进入玩法前预下载一组资源时，可以先查询体积，再下载标签对应的依赖：

```csharp
var sizeHandle = Addressables.GetDownloadSizeAsync(label);
await sizeHandle.Task;

if (sizeHandle.Status == AsyncOperationStatus.Succeeded && sizeHandle.Result > 0)
{
    var downloadHandle = Addressables.DownloadDependenciesAsync(label);
    await downloadHandle.Task;
    Addressables.Release(downloadHandle);
}

Addressables.Release(sizeHandle);
```

正式代码还应处理失败、取消、磁盘空间、进度展示和重试策略。加载得到的资源句柄也需要按生命周期释放；释放句柄与删除磁盘 bundle 缓存是两件不同的事。

远程 bundle 默认会缓存在设备上。catalog 更新后，已经不再被新 catalog 引用的旧缓存不会因此立即消失：

- `Addressables.CleanBundleCache` 清理当前已加载 catalog 不再引用的 bundle。
- `Addressables.UpdateCatalogs(..., autoCleanBundleCache: true)` 可在 catalog 更新后触发清理。
- `Caching.ClearCache` 会清理整个 bundle 缓存，影响范围更大。

是否自动清理需要权衡磁盘占用、更新耗时和旧版本回退能力。不要依赖某个固定的 Windows 或 Android 绝对目录；缓存位置由平台、应用标识和 Unity 实现共同决定。

## URL 改写与下载排查

Profile 变量适合区分开发、测试和生产环境。运行时需要动态主机或签名 URL 时，可以使用 `Addressables.InternalIdTransformFunc`；需要统一修改请求头、证书或超时行为时，再考虑 `Addressables.WebRequestOverride`。这些入口应集中配置，避免直接修改 Addressables 包源码中的内部类型。

下载失败时按下面的顺序保留证据：

1. 记录 Player、Unity、Addressables 版本和目标平台。
2. 记录最终解析出的 catalog URL、bundle URL、HTTP 状态码和异常链。
3. 核对服务器上 bundle、catalog、hash 是否来自同一次构建。
4. 检查 Profile 与 Group 的 Build/Load Path，以及目标平台是否一致。
5. 比较首次完整构建和更新构建使用的 `addressables_content_state.bin`。
6. 用 Build Layout 检查依赖和实际重建的 bundle，不从文件修改数量推断下载体积。

## 三条历史问题如何看待

原记录包含 Unity 2022.3.28f1 与 Addressables 1.21.14 的三条处理经验：GUIStyle 名称错误、Build Layout 报告无法打开，以及跨平台已有构建导致材质变粉。本轮没有原工程和完整日志，不能把这些处理方式提升为通用修复。

遇到相同表象时，先保留完整堆栈并尝试可复现的最小工程，核对包的后续补丁版本，再决定是否临时关闭报告、重新构建目标平台内容或修改包源码。直接改 `Library/PackageCache` 中的文件难以复现，也可能在重新解析包后丢失。

## 发布前验证清单

- 用空缓存设备完成首次启动、下载、断点重试和离线重开。
- 从上一正式版本执行一次真实内容更新，核对下载字节数和资源版本。
- 验证 catalog 或 bundle 缺失、hash 不匹配和网络中断时的用户提示。
- 检查旧缓存清理后的磁盘占用，并确认仍被当前 catalog 引用的 bundle 可用。
- 回滚时使用一套完整且相互匹配的 catalog、hash 和 bundle；不要只替换单个 catalog 文件。
- 保存每次发布的 Player 版本、Addressables 版本、Profile、内容状态文件和产物清单。

完成这些步骤后，才能把“Editor 中能加载”提升为“远程发布流程可用”。
